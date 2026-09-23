import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoursewareInspectionRuntime, inspectionEvaluation } from './coursewareInspection'
import { planRequest, toInspectionRules } from './inspectionRequest'
import { jakartaDay, jakartaWeek } from './inspectionCalendar'
import { inspectionDateInRange } from './inspectionTime'

test('课件呈现作者沿用当前身份但独立连续计数，暂停不抹去核验事实', () => {
  const runtime = createCoursewareInspectionRuntime({
    identity: () => ({ userId: '7', role: 'trainer', displayName: 'Sarah' }),
    mode: 'demo'
  })
  const id = runtime.createTask({
    ...toInspectionRules(
      planRequest('持续监督今后新增课件预计学习时长5到10分钟，不合规提醒本人，连续3次汇报')
    ),
    confirmed: true
  })
  for (let n = 1; n <= 2; n++) {
    runtime.processCoursewareSnapshot({ id: n, status: 'running', title: '新品' })
    runtime.processCoursewareSnapshot(
      { id: n, status: 'succeeded', done: true, resultCoursewareId: n },
      { creatorId: '7', creatorName: 'Sarah', estimatedDurationSeconds: 60, source: '课件产物' }
    )
  }
  const task = runtime.tasks.value.find((t) => t.id === id)!
  const producer = JSON.stringify(task.entries)
  for (let n = 0; n < 3; n++) runtime.advancePresentation(id)
  assert.equal(task.entries[2].creator, 'Sarah')
  assert.equal(task.entries[2].creatorId, '7')
  assert.equal(task.trainerFailures['7'], 2)
  assert.equal(task.presentationFailures?.['7'], 1)
  assert.equal(task.escalations.length, 0)
  assert.equal(JSON.stringify(task.entries.slice(0, 2)), producer)
  runtime.pauseTask(id)
  assert.equal(task.entries.filter((e) => inspectionEvaluation(e) === 'mismatch').length, 3)
  assert.match(runtime.briefing(id), /已检查 3 件课件/)
})
test('培训呈现沿用真实人员ID；缺依据归档和无时长标准均不判达标', () => {
  const runtime = createCoursewareInspectionRuntime({
    identity: () => ({ userId: '7', role: 'trainer' }),
    mode: 'demo'
  })
  const id = runtime.createTask({
    ...toInspectionRules(planRequest('持续监督南区李欣以后新增的新品培训，完课且80分，仅记录')),
    confirmed: true
  })
  for (let i = 0; i < 3; i++) runtime.advancePresentation(id)
  const task = runtime.tasks.value.find((t) => t.id === id)!
  assert.equal(task.entries[0].creatorId, 'li-xin')
  for (let i = 0; i < 24; i++) runtime.advancePresentation(id)
  const missing = task.entries.find((e) => e.evaluatedOutcome === 'missing')!
  assert.ok(missing.completedAt)
  assert.equal(inspectionEvaluation(missing), 'missing')
  assert.match(missing.summary, /缺少核验依据/)
  const quality = runtime.createTask({
    name: '生成检查',
    question: '关注产物',
    scope: 'current_account',
    remind: false,
    reportRequested: false,
    confirmed: true
  })
  for (let i = 0; i < 5; i++) runtime.advancePresentation(quality)
  assert.equal(
    inspectionEvaluation(runtime.tasks.value.find((t) => t.id === quality)!.entries[0]),
    'missing'
  )
})
test('Jakarta日界和周界一致，非法日期不抛异常', () => {
  assert.equal(jakartaDay(new Date('2026-09-20T17:01:00Z')), '2026-09-21')
  assert.deepEqual(jakartaWeek(new Date('2026-09-20T17:01:00Z')), {
    startsOn: '2026-09-21',
    endsOn: '2026-09-27'
  })
  assert.equal(jakartaDay(new Date('invalid')), '')
  assert.equal(
    inspectionDateInRange('invalid', {
      timeMode: 'range',
      startsOn: '2026-09-21',
      endsOn: '2026-09-21'
    }),
    undefined
  )
  assert.equal(
    inspectionDateInRange('2026-09-20T17:01:00Z', {
      timeMode: 'range',
      startsOn: '2026-09-21',
      endsOn: '2026-09-21'
    }),
    true
  )
})
test('未知人名和范围否定必须澄清，明确替换不保留旧地区', () => {
  const base = planRequest('查一下南区李欣本周新品培训，完课且80分')
  assert.equal(base.ready, true)
  assert.equal(planRequest('只看赵雷培训', base).ready, false)
  assert.equal(planRequest('不要全部人员', base).ready, false)
  assert.equal(planRequest('不是南区改北区', base).region, '北区')
  assert.equal(planRequest('最近3天', base).ready, false)
  assert.equal(planRequest('确认', planRequest('最近3天', base)).ready, false)
  assert.equal(planRequest('确认', planRequest('只看赵雷培训', base)).ready, false)
  assert.equal(planRequest('全部人员改李欣', base).person, '李欣')
})
