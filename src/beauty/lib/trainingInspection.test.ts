import test from 'node:test'
import assert from 'node:assert/strict'
import { planRequest, toInspectionRules, planFromTask } from './inspectionRequest'
import { queryCurrentCourseware } from './inspectionQuery'
import { createCoursewareInspectionRuntime } from './coursewareInspection'
import { trainingData, matchesTrainingScope, trainingOutcome } from './trainingInspection'

const trainingPlan = () =>
  planRequest('持续监督南区李欣以后新增的新品培训，完课且至少80分，不合规提醒本人，连续3次汇报')
test('培训逐项澄清、结构化恢复和两领域两模式', async () => {
  let p = planRequest('查一下南区李欣本周新品培训是否达标')
  assert.equal(p.ready, false)
  assert.equal(p.region, '南区')
  assert.equal(p.person, '李欣')
  assert.equal(p.product, '新品')
  assert.equal(p.timeMode, 'range')
  p = planRequest('要求完课且至少80分', p)
  assert.equal(p.ready, true)
  const result = await queryCurrentCourseware(p)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].person, '李欣')
  assert.equal(result.rows[0].score, 72)
  assert.equal(result.rows[0].result, '未达标')
  assert.ok(result.toolRuns?.length)
  const runtime = createCoursewareInspectionRuntime({
    identity: () => ({ userId: '7', role: 'trainer' }),
    mode: 'demo'
  })
  const id = runtime.createTask({ ...toInspectionRules(trainingPlan()), confirmed: true })
  const task = runtime.tasks.value.find((t) => t.id === id)!
  assert.deepEqual(planFromTask(task), JSON.parse(JSON.stringify(trainingPlan())))
  const queryId = await runtime.executeQuery(p, { confirmed: true })
  const q = runtime.tasks.value.find((t) => t.id === queryId)!
  assert.equal(q.subject, 'training')
  assert.ok(q.completedAt)
  assert.equal(q.enabled, false)
  assert.equal(q.entries.length, 0)
  assert.equal(runtime.advancePresentation(queryId), false)
  assert.equal(planRequest('查询当前课件预计学习时长5到10分钟').ready, true)
  assert.equal(planRequest('持续监督今后新增课件预计学习时长5到10分钟，仅记录').ready, true)
})
test('培训地区、人员、产品、日期严格过滤，缺成绩不判未达标', () => {
  const clock = new Date('2026-09-23T12:00:00Z')
  const data = trainingData(clock)
  const scope = {
    region: '南区',
    person: '李欣',
    product: '新品',
    timeMode: 'range' as const,
    startsOn: '2026-09-21',
    endsOn: '2026-09-27',
    minScore: 80,
    requireCourseCompleted: true
  }
  assert.deepEqual(
    data.filter((r) => matchesTrainingScope(r, scope, clock)).map((r) => r.id),
    ['training-lixin-new']
  )
  for (const key of ['region', 'person', 'product'] as const)
    assert.equal(
      data.filter((r) => matchesTrainingScope(r, { ...scope, [key]: '不存在' }, clock)).length,
      0
    )
  assert.equal(trainingOutcome({ ...data[0], score: undefined }, scope), 'missing')
})
test('培训事件不串课件，第三次升级幂等；达标清零、缺证据断连续', () => {
  let clock = new Date('2026-09-23T12:00:00Z')
  const runtime = createCoursewareInspectionRuntime({
    identity: () => ({ userId: '7', role: 'trainer' }),
    now: () => clock,
    mode: 'demo'
  })
  const id = runtime.createTask({ ...toInspectionRules(trainingPlan()), confirmed: true })
  const coursewareId = runtime.createTask({
    ...toInspectionRules(
      planRequest('持续监督今后新增课件预计学习时长5到10分钟，不合规提醒本人，连续3次汇报')
    ),
    confirmed: true
  })
  const send = (n: number, score: number | undefined = 72, courseCompleted = false) => {
    clock = new Date(clock.getTime() + 1000)
    return runtime.processTrainingRecord({
      ...trainingData(clock)[0],
      id: `event-${n}`,
      score,
      courseCompleted
    })
  }
  for (let n = 0; n < 3; n++) assert.equal(send(n), true)
  const task = runtime.tasks.value.find((t) => t.id === id)!
  assert.equal(task.escalations.length, 1)
  assert.equal(task.trainerFailures['li-xin'], 3)
  assert.equal(runtime.processTrainingRecord({ ...trainingData(clock)[0], id: 'event-2' }), false)
  send(4, 90, true)
  assert.equal(task.trainerFailures['li-xin'], 0)
  send(5)
  send(6, undefined) // 默认参数补值，以下显式缺证据
  clock = new Date(clock.getTime() + 1000)
  runtime.processTrainingRecord({ ...trainingData(clock)[0], id: 'missing', score: undefined })
  assert.equal(task.trainerFailures['li-xin'], 0)
  send(7)
  send(8)
  send(9)
  assert.equal(task.escalations.length, 1)
  assert.equal(runtime.tasks.value.find((t) => t.id === coursewareId)!.entries.length, 0)
  const count = task.entries.length
  runtime.processCoursewareSnapshot({ id: 123, title: '新品课件', status: 'running' })
  assert.equal(task.entries.length, count)
})
test('可见详情每步仅一个事件、暂停恢复、归档保留事件、刷新续播且不改生产者', () => {
  let saved = ''
  const options = {
    identity: () => ({ userId: '7', role: 'trainer' }),
    mode: 'demo' as const,
    storage: {
      getItem: () => saved || null,
      setItem: (_: string, v: string) => {
        saved = v
      }
    }
  }
  const runtime = createCoursewareInspectionRuntime(options)
  for (const plan of [
    trainingPlan(),
    planRequest('持续监督今后新增课件预计学习时长5到10分钟，不合规提醒本人，连续3次汇报')
  ]) {
    const id = runtime.createTask({ ...toInspectionRules(plan), confirmed: true })
    assert.equal(runtime.advancePresentation(id), true)
    let task = runtime.tasks.value.find((t) => t.id === id)!
    assert.equal(task.entries[0].events.length, 1)
    runtime.advancePresentation(id)
    assert.equal(task.entries[0].events.length, 2)
    runtime.pauseTask(id)
    const snapshot = JSON.stringify(task.entries)
    assert.equal(runtime.advancePresentation(id), false)
    assert.equal(JSON.stringify(task.entries), snapshot)
    runtime.resumeTask(id)
    const restored = createCoursewareInspectionRuntime(options)
    task = restored.tasks.value.find((t) => t.id === id)!
    restored.advancePresentation(id)
    assert.equal(task.entries[0].events.length, 3)
    for (let i = 0; i < 3; i++) restored.advancePresentation(id)
    assert.ok(task.entries[0].completedAt)
    assert.equal(task.entries[0].events.length, 6)
    restored.advancePresentation(id)
    assert.equal(task.entries.length, 2)
    assert.equal(task.entries[0].events.length, 6)
  }
})
