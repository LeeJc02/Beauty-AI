import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'
import { createCoursewareInspectionRuntime } from './coursewareInspection'
import { planRequest } from './inspectionRequest'
import { queryCurrentCourseware, type InspectionQueryResult } from './inspectionQuery'

const plan = () => planRequest('查一下当前课件预计学习时长5到10分钟')
test('A→B→A身份回切不能恢复在途查询，逐页读取前后校验', async () => {
  const actor = reactive({ userId: 7, role: 'A' })
  const runtime = createCoursewareInspectionRuntime({ identity: () => actor })
  let pages = 0
  await assert.rejects(
    runtime.executeQuery(plan(), { confirmed: true }, (request, context) =>
      queryCurrentCourseware(request, {
        ...context,
        getPage: async () => {
          pages++
          actor.role = 'B'
          actor.role = 'A'
          return { list: [{ id: 1, title: '课件', estimatedDurationSeconds: 360 }], total: 2 }
        }
      })
    ),
    /账号或角色已切换/
  )
  assert.equal(pages, 1)
  assert.equal(runtime.tasks.value.length, 0)
  runtime.dispose()
})
test('自定义读取器未实现逐页守卫时，最终保存也拒绝身份回切', async () => {
  const actor = reactive({ userId: 7, role: 'A' })
  const runtime = createCoursewareInspectionRuntime({ identity: () => actor })
  let resolve!: (result: InspectionQueryResult) => void
  const pending = runtime.executeQuery(
    plan(),
    { confirmed: true },
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  actor.userId = 8
  actor.userId = 7
  resolve({ status: 'complete', summary: '结果', rows: [], columns: [], evidence: [], tools: [] })
  await assert.rejects(pending, /账号或角色已切换/)
  assert.equal(runtime.tasks.value.length, 0)
  runtime.dispose()
})
test('直接保存异步结果必须携带有效的身份版本', () => {
  const actor = reactive({ userId: 7, role: 'A' })
  const runtime = createCoursewareInspectionRuntime({ identity: () => actor })
  const context = runtime.captureQueryContext()
  actor.role = 'B'
  actor.role = 'A'
  assert.throws(
    () =>
      runtime.saveQueryResult(
        plan(),
        { status: 'complete', summary: '', rows: [], columns: [], evidence: [], tools: [] },
        { confirmed: true, ...context }
      ),
    /账号或角色已切换/
  )
  runtime.dispose()
})
