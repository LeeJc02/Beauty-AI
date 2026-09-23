import test from 'node:test'
import assert from 'node:assert/strict'
import { planRequest, planFromTask, toInspectionRules } from './inspectionRequest'
import { queryCurrentCourseware } from './inspectionQuery'
import { createCoursewareInspectionRuntime } from './coursewareInspection'
import { createCoursewareInspectionFixtures } from './coursewareInspectionFixtures'

test('四个业务引导必须逐轮确认时间、标准及通知，关键词不丢失', () => {
  const cases = [
    ['帮我查一下新品课件的预计学习时长是否符合要求', ['截至现在的当前记录', '5到10分钟合格']],
    [
      '帮我持续监督新品课件的预计学习时长',
      ['今后新增课件', '5到10分钟合格', '不合规提醒本人，连续3次汇报']
    ],
    ['查一下南区李欣的新品培训是否达标', ['截至现在的当前记录', '要求完课且至少80分']],
    [
      '持续关注南区的新品培训，不达标时提醒本人',
      ['全部人员', '今后新增记录', '要求完课且至少80分', '不合规提醒本人，连续3次汇报']
    ]
  ] as const
  for (const [initial, replies] of cases) {
    let plan = planRequest(initial)
    for (const reply of replies) {
      assert.equal(plan.ready, false, initial)
      assert.ok(plan.needsClarification)
      plan = planRequest(reply, plan)
    }
    assert.equal(plan.ready, true, JSON.stringify(plan))
    if (plan.subject === 'courseware') assert.equal(plan.keyword, '新品')
    else {
      assert.equal(plan.region, '南区')
      assert.equal(plan.product, '新品')
    }
  }
  assert.equal(planRequest('查一下课件预计学习时长5到10分钟').ready, false)
  assert.equal(planRequest('查一下当前课件预计学习时长5到10分钟').ready, true)
  for (const word of ['新品', '敏感肌', '彩妆'])
    assert.equal(planRequest(`查一下${word}课件预计学习时长`).keyword, word)
})
test('跨领域撤销旧范围、标准及授权，旧任务只提供时间确认不篡改', () => {
  const original = planRequest(
    '持续监督南区李欣以后新增的新品培训，完课且80分，不合规提醒本人，连续3次汇报'
  )
  const switched = planRequest('改查课件', original)
  assert.equal(switched.region, undefined)
  assert.equal(switched.person, undefined)
  assert.equal(switched.timeMode, undefined)
  assert.equal(switched.minScore, undefined)
  assert.equal(switched.reportRequested, false)
  assert.equal(switched.ready, false)
  const training = planRequest('改查培训', planRequest('查询当前新品课件预计学习时长5到10分钟'))
  assert.equal(training.keyword, undefined)
  assert.equal(training.minDurationMinutes, undefined)
  assert.equal(training.timeMode, undefined)
  const old = createCoursewareInspectionFixtures({ userId: '7', role: 'trainer' }, new Date())[0]
  const saved = JSON.stringify(old)
  const proposal = planFromTask(old)
  assert.equal(proposal.ready, false)
  assert.match(proposal.needsClarification!.question, /时间/)
  assert.equal(JSON.stringify(old), saved)
})
test('课件查询严格筛选日期，未知日期仅列缺依据，不得判合格', async () => {
  const plan = planRequest('查询全部课件，2026-09-21到2026-09-27，预计学习时长5到10分钟')
  assert.equal(plan.ready, true)
  const result = await queryCurrentCourseware(plan, {
    getPage: async () => ({
      total: 3,
      list: [
        {
          id: 1,
          title: '区间内',
          createTime: new Date('2026-09-23T12:00:00Z'),
          estimatedDurationSeconds: 420
        },
        {
          id: 2,
          title: '区间外',
          createTime: new Date('2026-08-23T12:00:00Z'),
          estimatedDurationSeconds: 420
        },
        { id: 3, title: '缺日期', estimatedDurationSeconds: 420 }
      ]
    })
  })
  assert.equal(result.status, 'partial')
  assert.deepEqual(
    result.rows.map((row) => row.id),
    [1, 3]
  )
  assert.match(String(result.rows[1].result), /缺少创建时间/)
  assert.equal(planRequest('2026-02-30到2026-03-02', plan).ready, false)
})
test('过期范围不会产生新事件，旧存储无时间规则仍可读取', () => {
  let clock = new Date('2026-09-23T12:00:00Z')
  const runtime = createCoursewareInspectionRuntime({
    identity: () => ({ userId: '7', role: 'trainer' }),
    now: () => clock
  })
  const plan = planRequest(
    '持续监督全部课件，2026-09-21到2026-09-27，预计学习时长5到10分钟，仅记录'
  )
  const id = runtime.createTask({ ...toInspectionRules(plan), confirmed: true })
  assert.equal(runtime.advancePresentation(id), true)
  clock = new Date('2026-09-28T12:00:00Z')
  const before = JSON.stringify(runtime.tasks.value)
  assert.equal(runtime.advancePresentation(id), false)
  runtime.processCoursewareSnapshot({
    id: 42,
    status: 'running',
    title: '新课件',
    createTime: clock
  })
  assert.equal(JSON.stringify(runtime.tasks.value), before)
})
