import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'
import { createCoursewareInspectionRuntime } from './coursewareInspection'
import {
  COURSEWARE_INSPECTION_SEED_VERSION,
  createCoursewareInspectionFixtures
} from './coursewareInspectionFixtures'

function fixture() {
  const actor = reactive({ userId: '7', role: 'trainer', displayName: '林悦' })
  const data = new Map<string, string>()
  let clock = new Date('2026-09-23T12:00:00Z')
  const options = {
    identity: () => actor,
    mode: 'demo' as const,
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      }
    },
    now: () => clock,
    seed: {
      version: COURSEWARE_INSPECTION_SEED_VERSION,
      create: createCoursewareInspectionFixtures
    }
  }
  return {
    actor,
    data,
    options,
    runtime: createCoursewareInspectionRuntime(options),
    advance: () => {
      clock = new Date(clock.getTime() + 86400_000)
    }
  }
}
test('首次和已存空桶均补业务任务一次；刷新保留修改、暂停与签收', () => {
  for (const empty of [false, true]) {
    const f = fixture()
    if (empty) f.data.set(f.runtime.identityKey()!, JSON.stringify({ tasks: [], knownIds: [] }))
    assert.equal(f.runtime.productTasks.value.length, 11)
    const [first, second] = f.runtime.productTasks.value
    assert.equal(first.entries[2].creatorId, '7')
    assert.equal(first.entries[2].creator, '林悦')
    assert.equal(first.entries[2].notificationState, 'inbox')
    assert.equal(f.runtime.acknowledge(first.id, first.entries[2].id), true)
    f.runtime.updateTask(second.id, { ...second, confirmed: true, name: '我修改的规则' })
    f.runtime.pauseTask(second.id)
    const before = JSON.stringify(f.runtime.tasks.value)
    f.advance()
    const restored = createCoursewareInspectionRuntime(f.options)
    assert.equal(JSON.stringify(restored.tasks.value), before)
    assert.equal(JSON.parse(f.data.get(restored.identityKey()!)!).seedVersion, 5)
    assert.equal(restored.tasks.value[1].enabled, false)
  }
})
test('按用户与角色隔离，旧自建和演示任务存储不删除，产品列表只过滤演示', () => {
  const f = fixture()
  const unseeded = createCoursewareInspectionRuntime({ ...f.options, seed: undefined })
  const input = {
    name: '自建任务',
    question: '关注课件',
    scope: 'current_account' as const,
    remind: false,
    reportRequested: false,
    confirmed: true as const
  }
  const own = unseeded.createTask(input)
  const demo = unseeded.createTask({ ...input, demoScenario: 'recovery' })
  assert.equal(f.runtime.tasks.value.length, 13)
  assert.equal(f.runtime.productTasks.value.length, 12)
  assert.ok(f.runtime.tasks.value.some((task) => task.id === demo))
  assert.equal(
    JSON.stringify(f.runtime.tasks.value.find((task) => task.id === own)),
    JSON.stringify(unseeded.tasks.value[0])
  )
  f.actor.role = 'manager'
  assert.equal(f.runtime.productTasks.value.length, 11)
  assert.ok(f.runtime.productTasks.value.every((task) => task.id.includes('manager')))
  f.actor.userId = '8'
  assert.ok(f.runtime.productTasks.value.every((task) => task.ownerUserId === '8'))
  f.actor.userId = '7'
  f.actor.role = 'trainer'
  assert.equal(f.runtime.tasks.value.length, 13)
})
test('业务样本不随时间演进；正常生产者事件按标题接续且仅新增一项提醒', () => {
  const f = fixture()
  const before = JSON.stringify(f.runtime.tasks.value)
  f.advance()
  assert.equal(JSON.stringify(f.runtime.tasks.value), before)
  const dto = { id: 900, title: '敏感肌保湿精华使用指南', status: 'running' }
  f.runtime.processCoursewareSnapshot(dto)
  f.runtime.processCoursewareSnapshot(
    { ...dto, status: 'succeeded', done: true, resultCoursewareId: 901 },
    { creatorId: '7', creatorName: '林悦', estimatedDurationSeconds: 180, source: 'metadata debug' }
  )
  const entries = f.runtime.tasks.value
    .flatMap((task) => task.entries)
    .filter((entry) => entry.generationTaskId === 900)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].status, 'awaiting_confirmation')
  assert.equal(entries[0].notificationState, undefined)
  for (const task of f.runtime.productTasks.value) {
    const text = [
      f.runtime.briefing(task.id),
      ...task.entries.flatMap((entry) => [
        entry.summary,
        ...entry.events.map((event) => event.text)
      ]),
      ...task.escalations.flatMap((receipt) => [receipt.content, receipt.reason])
    ].join(' ')
    assert.doesNotMatch(text, /演示|模拟|原型|本地|metadata|接口未接入|下一步/)
  }
})
test('旧 blocked 升级为业务汇报且持久化，不删除用户数据', () => {
  const f = fixture()
  const legacy = createCoursewareInspectionFixtures(f.actor, f.options.now())
  legacy[0].escalations[0].status = 'blocked'
  legacy[0].escalations[0].reason = '接口未接入，未发送'
  legacy[0].entries[2].events.push({
    at: f.options.now().toISOString(),
    text: '接口未接入，汇报受阻，未发送'
  })
  f.data.set(
    f.runtime.identityKey()!,
    JSON.stringify({ tasks: legacy, knownIds: [], seedVersion: 1 })
  )
  const task = f.runtime.productTasks.value[0]
  assert.equal(task.escalations[0].status, 'simulated')
  assert.doesNotMatch(task.escalations[0].reason, /接口|模拟|演示/)
  assert.equal(f.runtime.productTasks.value.length, 11)
  assert.equal(
    JSON.parse(f.data.get(f.runtime.identityKey()!)!).tasks[0].escalations[0].status,
    'simulated'
  )
})
