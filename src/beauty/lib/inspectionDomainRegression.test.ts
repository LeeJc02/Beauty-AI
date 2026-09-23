import test from 'node:test'
import assert from 'node:assert/strict'
import { planRequest, toInspectionRules } from './inspectionRequest'
import { createCoursewareInspectionRuntime, inspectionEvaluation } from './coursewareInspection'
import { trainingData } from './trainingInspection'
import { queryCurrentCourseware } from './inspectionQuery'

const training = () =>
  planRequest('持续监督南区李欣以后新增的新品培训，完课且至少80分，不合规提醒本人，连续3次汇报')
const courseware = () =>
  planRequest('持续监督今后新增课件预计学习时长5到10分钟，不合规提醒本人，连续3次汇报')
test('否定汇报或升级撤销两领域旧授权', () => {
  for (const base of [training(), courseware()])
    for (const word of ['无需汇报', '不用汇报', '不要汇报', '无需升级', '不用升级', '不要升级']) {
      const plan = planRequest(`不提醒，${word}`, base)
      assert.equal(plan.ready, true)
      assert.equal(plan.remind, false)
      assert.equal(plan.reportRequested, false)
    }
})
test('范围替换不沿用旧人员产品；不支持课件人名筛选必须追问', async () => {
  const base = planRequest('查一下南区李欣当前记录新品培训，完课且80分')
  const person = planRequest('改查赵敏的培训', base)
  assert.equal(person.person, '赵敏')
  assert.equal(person.product, '新品')
  assert.equal(person.ready, true)
  assert.equal((await queryCurrentCourseware(person)).rows.length, 0)
  const product = planRequest('改查面霜培训', base)
  assert.equal(product.product, '面霜')
  assert.equal(product.person, '李欣')
  assert.equal(product.ready, true)
  assert.equal((await queryCurrentCourseware(product)).rows.length, 0)
  const unsupported = planRequest(
    '只查李欣的课件',
    planRequest('查询当前课件预计学习时长5到10分钟')
  )
  assert.equal(unsupported.ready, false)
  assert.equal(planRequest('确认', unsupported).ready, false)
})
test('昨天与中文日期覆盖旧当前范围，过去持续范围必须改选', () => {
  for (const subject of ['课件', '培训']) {
    const base =
      subject === '课件'
        ? planRequest('查询当前课件预计学习时长5到10分钟')
        : planRequest('查询南区李欣当前记录新品培训，完课且80分')
    const yesterday = planRequest(`改查昨天的${subject}`, base)
    assert.equal(yesterday.timeMode, 'range')
    const chinese = planRequest(`改查2026年9月1日至2026年9月3日的${subject}`, base)
    assert.equal(chinese.ready, true)
    assert.equal(chinese.startsOn, '2026-09-01')
    assert.equal(chinese.endsOn, '2026-09-03')
  }
  for (const base of [training(), courseware()]) {
    const expired = planRequest('2020-01-01至2020-01-31', base)
    assert.equal(expired.ready, false)
    assert.match(expired.summary, /已结束/)
    assert.equal(planRequest('只查一次', expired).ready, true)
    assert.equal(planRequest('今后新增', expired).ready, true)
  }
})
test('两来源同名同ID独立计数、清零、证据与升级幂等', () => {
  for (const plan of [training(), courseware()]) {
    let clock = new Date('2026-09-23T12:00:00Z')
    const runtime = createCoursewareInspectionRuntime({
      identity: () => ({ userId: '7', role: 'trainer', displayName: 'Sarah' }),
      now: () => clock,
      mode: 'demo'
    })
    const id = runtime.createTask({ ...toInspectionRules(plan), confirmed: true })
    const send = (n: number, outcome: 'mismatch' | 'passed' | 'missing' = 'mismatch') => {
      clock = new Date(clock.getTime() + 1000)
      if (plan.subject === 'training')
        runtime.processTrainingRecord({
          ...trainingData(clock)[0],
          id: `business-${n}`,
          title: `业务培训${n}`,
          score: outcome === 'missing' ? undefined : outcome === 'passed' ? 95 : 50,
          courseCompleted: true
        })
      else {
        runtime.processCoursewareSnapshot({ id: n, status: 'running', title: `业务课件${n}` })
        runtime.processCoursewareSnapshot(
          { id: n, status: 'succeeded', done: true, resultCoursewareId: n, title: `业务课件${n}` },
          {
            creatorId: '7',
            creatorName: 'Sarah',
            estimatedDurationSeconds:
              outcome === 'missing' ? undefined : outcome === 'passed' ? 420 : 60,
            source: '产物'
          }
        )
      }
    }
    for (let i = 0; i < 12; i++) runtime.advancePresentation(id)
    const task = runtime.tasks.value.find((t) => t.id === id)!
    const actor = plan.subject === 'training' ? 'li-xin' : '7'
    assert.equal(task.presentationFailures?.[actor], 2)
    send(1)
    assert.equal(task.trainerFailures[actor], 1)
    assert.equal(task.escalations.length, 0)
    for (let i = 0; i < 6; i++) runtime.advancePresentation(id)
    assert.equal(task.escalations.length, 1)
    assert.equal(task.escalations[0].source, 'presentation')
    send(2, 'passed')
    assert.equal(task.presentationFailures?.[actor], 3)
    send(3)
    send(4, 'missing')
    assert.equal(task.trainerFailures[actor], 0)
    assert.equal(task.presentationFailures?.[actor], 3)
    send(5)
    for (let i = 0; i < 12; i++) runtime.advancePresentation(id)
    assert.equal(task.presentationFailures?.[actor], 0)
    assert.equal(task.trainerFailures[actor], 1)
    send(6)
    send(7)
    assert.equal(task.escalations.length, 2)
    const receipt = task.escalations.find((item) => item.source === 'business')!
    assert.match(receipt.content!, /业务/)
    assert.doesNotMatch(receipt.content!, / · /)
    send(8)
    assert.equal(task.escalations.length, 2)
  }
})
test('到期拒绝新建并终止活跃任务，保留核验事实及完成时间', () => {
  let clock = new Date('2026-09-23T12:00:00Z')
  let saved = ''
  const options = {
    identity: () => ({ userId: '7', role: 'trainer' }),
    now: () => clock,
    mode: 'demo' as const,
    storage: {
      getItem: () => saved || null,
      setItem: (_: string, value: string) => {
        saved = value
      }
    }
  }
  const runtime = createCoursewareInspectionRuntime(options)
  const rules = toInspectionRules(courseware())
  assert.throws(
    () =>
      runtime.createTask({
        ...rules,
        timeMode: 'range',
        startsOn: '2020-01-01',
        endsOn: '2020-01-31',
        confirmed: true
      }),
    /已结束/
  )
  const id = runtime.createTask({
    ...rules,
    timeMode: 'range',
    startsOn: '2026-09-21',
    endsOn: '2026-09-27',
    confirmed: true
  })
  for (let i = 0; i < 3; i++) runtime.advancePresentation(id)
  clock = new Date('2026-09-28T12:00:00Z')
  assert.equal(runtime.advancePresentation(id), false)
  const task = runtime.tasks.value.find((t) => t.id === id)!
  assert.ok(task.completedAt)
  assert.equal(task.enabled, false)
  assert.equal(inspectionEvaluation(task.entries[0]), 'mismatch')
  assert.match(runtime.briefing(id), /已结束/)
  const restored = createCoursewareInspectionRuntime(options)
  assert.equal(restored.storageError.value, '')
  assert.equal(restored.tasks.value[0].completedAt, task.completedAt)
  // 旧不完整培训范围、无时间规则和已结束记录均不得被新建守卫拒绝加载。
  const bucket = JSON.parse(saved)
  bucket.tasks.push({
    ...bucket.tasks[0],
    id: 'legacy-training',
    subject: 'training',
    timeMode: undefined,
    minScore: undefined,
    completedAt: undefined,
    enabled: true
  })
  saved = JSON.stringify(bucket)
  const legacy = createCoursewareInspectionRuntime(options)
  assert.equal(legacy.tasks.value.length, 2)
  assert.equal(legacy.storageError.value, '')
  assert.equal(legacy.tasks.value.find((t) => t.id === 'legacy-training')!.enabled, true)
})
