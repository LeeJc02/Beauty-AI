import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'
import { planRequest, planFromTask } from './inspectionRequest'
import { queryCurrentCourseware } from './inspectionQuery'
import { createCoursewareInspectionRuntime } from './coursewareInspection'
import {
  createCoursewareInspectionFixtures,
  COURSEWARE_INSPECTION_SEED_VERSION
} from './coursewareInspectionFixtures'

const once = () => planRequest('查一下当前课件预计学习时长，5到10分钟合格')
test('完整查询与监督意图、逐轮澄清和不支持域', () => {
  assert.equal(once().mode, 'once')
  assert.equal(once().ready, true)
  const continuous = planRequest('以后新课件生成时检查时长5到10分钟，不合规提醒本人，连续3次汇报')
  assert.equal(continuous.mode, 'continuous')
  assert.equal(continuous.ready, true)
  assert.equal(continuous.reportRequested, true)
  let plan = planRequest('检查课件')
  assert.equal(plan.ready, false)
  plan = planRequest('只查一次', plan)
  plan = planRequest('预计学习时长', plan)
  assert.equal(plan.ready, false)
  plan = planRequest('当前全部课件，5到10分钟合格', plan)
  assert.equal(plan.ready, true)
  assert.equal(planRequest('持续监督培训完成率').ready, false)
  assert.equal(planRequest('10到5分钟', once()).ready, false)
  assert.equal(planRequest('以后新课件只查当前时长5到10分钟').ready, false)
  const switched = planRequest('只查一次', continuous)
  assert.equal(switched.remind, false)
  assert.equal(switched.reportRequested, false)
  assert.ok(!switched.tools.some((tool) => tool.key === 'courseware.subscribe'))
})
test('只核对产物预计时长，缺证据 partial、读取失败 error', async () => {
  const result = await queryCurrentCourseware(once(), {
    getPage: async () => ({
      total: 3,
      list: [
        { id: 1, title: '课件A', estimatedDurationSeconds: 420 },
        { id: 2, title: '课件B', estimatedDurationSeconds: 900 },
        { id: 3, title: '课件C', targetDurationMinutes: 7 } as any
      ]
    })
  })
  assert.equal(result.status, 'partial')
  assert.equal(result.rows[0].result, '符合时长要求')
  assert.equal(result.rows[1].result, '不符合时长要求')
  assert.equal(result.rows[2].duration, null)
  const failed = await queryCurrentCourseware(once(), {
    getPage: async () => {
      throw new Error('unavailable')
    }
  })
  assert.equal(failed.status, 'error')
})
test('未确认无读取，确认后独立完成，不接收事件，不可恢复，账号切换不串写', async () => {
  const actor = reactive({ userId: '7', role: 'readonly' })
  const runtime = createCoursewareInspectionRuntime({ identity: () => actor })
  const result = await queryCurrentCourseware(once(), {
    getPage: async () => ({ list: [], total: 0 })
  })
  let calls = 0
  const execute = async () => {
    calls++
    return result
  }
  await assert.rejects(runtime.executeQuery(once(), { confirmed: false } as any, execute))
  assert.equal(calls, 0)
  assert.equal(runtime.tasks.value.length, 0)
  const id = await runtime.executeQuery(once(), { confirmed: true }, execute)
  assert.equal(runtime.tasks.value[0].mode, 'once')
  assert.ok(runtime.tasks.value[0].completedAt)
  assert.equal(planFromTask(runtime.tasks.value[0]).mode, 'once')
  runtime.processCoursewareSnapshot({ id: 999, title: '课件', status: 'running' })
  assert.equal(runtime.tasks.value[0].entries.length, 0)
  assert.equal(runtime.resumeTask(id), false)
  assert.equal(runtime.tasks.value[0].escalations.length, 0)
  await assert.rejects(
    runtime.executeQuery(once(), { confirmed: true }, async () => {
      actor.userId = '8'
      return result
    })
  )
  assert.equal(runtime.tasks.value.length, 0)
  actor.userId = '7'
  assert.equal(runtime.tasks.value.length, 1)
})
test('v1升级仅补完成记录，原任务修改保留且刷新幂等，暂停未完成', () => {
  const actor = { userId: '7', role: 'trainer' }
  const clock = new Date('2026-09-23T12:00:00Z')
  const legacy = createCoursewareInspectionFixtures(actor, clock).filter((task) =>
    task.id.startsWith('business-seed-v1:')
  )
  legacy[0].name = '保留修改'
  legacy[0].enabled = false
  let saved = JSON.stringify({ tasks: legacy, knownIds: [], seedVersion: 1 })
  const options = {
    identity: () => actor,
    storage: {
      getItem: () => saved,
      setItem: (_: string, value: string) => {
        saved = value
      }
    },
    seed: {
      version: COURSEWARE_INSPECTION_SEED_VERSION,
      create: createCoursewareInspectionFixtures
    }
  }
  const runtime = createCoursewareInspectionRuntime(options)
  assert.equal(runtime.tasks.value.length, 11)
  assert.equal(runtime.tasks.value[0].name, '保留修改')
  assert.equal(runtime.tasks.value[0].completedAt, undefined)
  assert.equal(runtime.tasks.value.filter((task) => task.completedAt).length, 6)
  assert.equal(createCoursewareInspectionRuntime(options).tasks.value.length, 11)
})
