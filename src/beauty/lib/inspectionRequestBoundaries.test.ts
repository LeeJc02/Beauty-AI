import assert from 'node:assert/strict'
import test from 'node:test'
import { planRequest, planFromTask, toInspectionRules } from './inspectionRequest'
import { createCoursewareInspectionFixtures } from './coursewareInspectionFixtures'
import { queryCurrentCourseware } from './inspectionQuery'

const once = () => planRequest('查一下当前课件预计学习时长，5到10分钟合格')
const ongoing = () => planRequest('以后新课件生成时检查时长5到10分钟，不合规提醒本人，连续3次汇报')

test('新课件是对象不是持续意图，当前账号不是一次意图', () => {
  for (const prefix of ['查一下当前新课件', '审查一遍当前新课件', '只看当前新课件']) {
    const plan = planRequest(`${prefix}预计学习时长，5到10分钟合格`)
    assert.equal(plan.mode, 'once', prefix)
    assert.equal(plan.ready, true, prefix)
    assert.ok(!plan.tools.some((tool) => tool.key === 'courseware.subscribe'))
  }
  assert.equal(planRequest('新课件预计学习时长5到10分钟').mode, undefined)
  assert.equal(planRequest('持续监督当前账号课件时长5到10分钟，不合规仅记录').mode, 'continuous')
  assert.equal(planRequest('当前账号', ongoing()).mode, 'continuous')
})

test('地区、定时和未知补充不能沿用ready或工具；选择支持能力可恢复', () => {
  for (const input of ['改成南区', '每天17点', '17:00执行', '改成紫色优先']) {
    const blocked = planRequest(input, once())
    assert.equal(blocked.ready, false, input)
    assert.ok(blocked.needsClarification)
    assert.deepEqual(blocked.tools, [])
    const recovered = planRequest('查询全部课件', blocked)
    assert.equal(recovered.ready, true, input)
    assert.equal(recovered.mode, 'once')
  }
  const training = planRequest('持续监督培训完成率')
  assert.equal(training.ready, false)
  assert.match(training.needsClarification!.question, /检查哪个地区/)
  assert.doesNotMatch(training.needsClarification!.question, /接入|接口/)
  assert.equal(planRequest('只查一次当前课件预计学习时长5到10分钟', training).ready, true)
})

test('非法数值不能截去负号或保留旧有效范围，修正后可恢复', async () => {
  for (const input of [
    '0到10分钟',
    '-5到10分钟',
    '5到-10分钟',
    'NaN到10分钟',
    '5到Infinity分钟',
    '5到999999分钟',
    '至少0分钟',
    '最多-1分钟',
    '5到1e100分钟',
    '10到5分钟'
  ]) {
    const invalid = planRequest(input, once())
    assert.equal(invalid.ready, false, input)
    assert.ok(invalid.needsClarification, input)
    assert.equal(planRequest('只查一次', invalid).ready, false, input)
    assert.equal(planRequest('5到10分钟', invalid).ready, true, input)
    await assert.rejects(
      queryCurrentCourseware(invalid, {
        getPage: async () => {
          assert.fail('不能读取')
        }
      })
    )
  }
  for (const value of [0, -1, NaN, Infinity, 1441]) {
    await assert.rejects(
      queryCurrentCourseware(
        { ...once(), minDurationMinutes: value },
        {
          getPage: async () => {
            assert.fail('不能读取')
          }
        }
      )
    )
  }
})

test('模式切换重新征求通知动作；一次查询不保留任何通知授权', () => {
  const original = ongoing()
  assert.equal(original.ready, true)
  assert.equal(original.actionConfirmed, true)
  const query = planRequest('只查一次当前记录', original)
  assert.equal(query.ready, true)
  assert.equal(query.remind, false)
  assert.equal(query.reportRequested, false)
  assert.equal(query.actionConfirmed, false)
  const subscription = planRequest('持续监督今后新增课件', query)
  assert.equal(subscription.ready, false)
  assert.equal(subscription.remind, false)
  assert.equal(subscription.reportRequested, false)
  assert.match(subscription.needsClarification!.question, /如何处理/)
  assert.throws(() => toInspectionRules(subscription))
  const confirmed = planRequest('不合规仅记录，不提醒，不汇报', subscription)
  assert.equal(confirmed.ready, true)
  assert.equal(toInspectionRules(confirmed).remind, false)
  assert.equal(toInspectionRules(confirmed).reportRequested, false)
  const withReminder = planRequest('不合规提醒本人，连续3次汇报', subscription)
  assert.equal(withReminder.ready, true)
  assert.equal(withReminder.remind, true)
  const completeQuery = planRequest('只查一次当前课件时长5到10分钟，不合规提醒本人，连续3次汇报')
  assert.equal(completeQuery.ready, true)
  assert.equal(completeQuery.remind, false)
  assert.equal(completeQuery.reportRequested, false)
  const partialQuery = planRequest('只查一次课件时长，不合规提醒本人，连续3次汇报')
  assert.equal(partialQuery.ready, false)
  assert.equal(partialQuery.remind, false)
  assert.equal(partialQuery.reportRequested, false)
})

test('结构化任务恢复不重新解释自然语言，四种通知组合均完整保留', () => {
  const fixture = createCoursewareInspectionFixtures(
    { userId: '7', role: 'trainer' },
    new Date('2026-09-23T12:00:00Z')
  )[0]
  for (const remind of [false, true]) {
    for (const reportRequested of [false, true]) {
      const task = {
        ...fixture,
        requestPlan: undefined,
        timeMode: 'ongoing' as const,
        name: '定制监督名称',
        question: '旧问题不作为当前授权：不要提醒，不汇报',
        titleFilter: '仅记录，不汇报、南区、每天17点',
        minDurationMinutes: 5,
        maxDurationMinutes: 10,
        remind,
        reportRequested
      }
      const snapshot = JSON.stringify(task)
      const plan = planFromTask(task)
      assert.equal(plan.ready, true)
      assert.equal(plan.name, task.name)
      assert.equal(plan.question, task.question)
      assert.equal(plan.keyword, task.titleFilter)
      assert.equal(plan.minDurationMinutes, 5)
      assert.equal(plan.maxDurationMinutes, 10)
      assert.equal(plan.remind, remind)
      assert.equal(plan.reportRequested, reportRequested)
      assert.equal(plan.actionConfirmed, true)
      assert.equal(toInspectionRules(plan).reportRequested, reportRequested)
      assert.equal(plan.tools[0].key, 'courseware.subscribe')
      assert.equal(JSON.stringify(task), snapshot)
    }
  }
  for (const bounds of [
    { minDurationMinutes: undefined, maxDurationMinutes: 20 },
    { minDurationMinutes: 5, maxDurationMinutes: undefined }
  ]) {
    const restored = planFromTask({ ...fixture, ...bounds, timeMode: 'ongoing', requestPlan: undefined })
    assert.equal(restored.ready, true)
    assert.equal(restored.minDurationMinutes, bounds.minDurationMinutes)
    assert.equal(restored.maxDurationMinutes, bounds.maxDurationMinutes)
  }
  const restoredOnce = planFromTask({ ...fixture, requestPlan: undefined, mode: 'once', timeMode: 'current' })
  assert.equal(restoredOnce.ready, true)
  assert.equal(restoredOnce.remind, false)
  assert.equal(restoredOnce.reportRequested, false)
  const invalid = planFromTask({ ...fixture, requestPlan: undefined, minDurationMinutes: -5 })
  assert.equal(invalid.ready, false)
  assert.deepEqual(invalid.tools, [])
  const saved = ongoing()
  const clone = planFromTask({ ...fixture, requestPlan: saved })
  assert.deepEqual(clone, JSON.parse(JSON.stringify(saved)))
  clone.tools[0].label = '不修改原任务'
  assert.notEqual(clone.tools[0].label, saved.tools[0].label)
})

test('单端修改保留另一端，只有明确取消才清除，非法修改仍需澄清', () => {
  const base = once()
  const snapshot = JSON.stringify(base)
  const upper = planRequest('把上限改为不超过20分钟', base)
  assert.equal(upper.ready, true)
  assert.equal(upper.minDurationMinutes, 5)
  assert.equal(upper.maxDurationMinutes, 20)
  const lower = planRequest('把下限改为至少7分钟', base)
  assert.equal(lower.ready, true)
  assert.equal(lower.minDurationMinutes, 7)
  assert.equal(lower.maxDurationMinutes, 10)
  for (const text of ['取消下限', '不限下限']) {
    const cleared = planRequest(text, base)
    assert.equal(cleared.ready, true)
    assert.equal(cleared.minDurationMinutes, undefined)
    assert.equal(cleared.maxDurationMinutes, 10)
  }
  for (const text of ['取消上限', '不限上限']) {
    const cleared = planRequest(text, base)
    assert.equal(cleared.ready, true)
    assert.equal(cleared.minDurationMinutes, 5)
    assert.equal(cleared.maxDurationMinutes, undefined)
  }
  const combined = planRequest('取消下限，上限不超过20分钟', base)
  assert.equal(combined.minDurationMinutes, undefined)
  assert.equal(combined.maxDurationMinutes, 20)
  assert.equal(combined.ready, true)
  assert.equal(planRequest('取消下限，取消上限', base).ready, false)
  assert.equal(planRequest('不超过3分钟', base).ready, false)
  assert.equal(planRequest('至少12分钟', base).ready, false)
  assert.equal(planRequest('不超过-1分钟', base).ready, false)
  assert.equal(JSON.stringify(base), snapshot)
})

test('不支持合规结果及创建人筛选必须澄清，提供可恢复选项且不执行读取', async () => {
  for (const input of [
    '只看不合规课件',
    '只检查张三创建的课件',
    '筛选未达标课件',
    '创建人是张三'
  ]) {
    const base = once()
    const snapshot = JSON.stringify(base)
    const blocked = planRequest(input, base)
    assert.equal(blocked.ready, false, input)
    assert.deepEqual(blocked.tools, [])
    assert.match(blocked.needsClarification!.question, /目前不支持.*筛选/)
    await assert.rejects(
      queryCurrentCourseware(blocked, {
        getPage: async () => {
          assert.fail('不应读取课件')
        }
      })
    )
    for (const option of blocked.needsClarification!.options) {
      const recovered = planRequest(option.answer, blocked)
      assert.equal(recovered.ready, true, option.answer)
      assert.equal(recovered.mode, 'once')
      assert.equal(recovered.remind, false)
      assert.equal(recovered.reportRequested, false)
    }
    assert.equal(JSON.stringify(base), snapshot)
  }
  const keyword = planRequest('标题包含“张三创建的不合规课件”', once())
  assert.equal(keyword.ready, true)
  assert.equal(keyword.keyword, '张三创建的不合规课件')
})

test('否定监督及改为查询优先，真正模式冲突澄清且撤销旧通知权限', () => {
  const base = ongoing()
  const snapshot = JSON.stringify(base)
  const continuousQuery = planRequest('持续查询今后新增课件时长5到10分钟，仅记录')
  assert.equal(continuousQuery.mode, 'continuous')
  assert.equal(continuousQuery.ready, true)
  for (const input of [
    '不要持续监督，改为查询当前课件时长',
    '取消订阅，查询当前课件时长',
    '停止监督，只查一次当前记录',
    '持续监督改为查询当前课件时长'
  ]) {
    const query = planRequest(input, base)
    assert.equal(query.ready, true, input)
    assert.equal(query.mode, 'once', input)
    assert.equal(query.remind, false)
    assert.equal(query.reportRequested, false)
    assert.equal(query.actionConfirmed, false)
    assert.ok(!query.tools.some((tool) => tool.key === 'courseware.subscribe'))
  }
  for (const input of ['持续监督并只查一次', '查询课件并持续监督', '不要持续监督']) {
    const blocked = planRequest(input, base)
    assert.equal(blocked.ready, false, input)
    assert.equal(blocked.mode, undefined)
    assert.equal(blocked.remind, false)
    assert.equal(blocked.reportRequested, false)
    assert.equal(blocked.actionConfirmed, false)
    assert.deepEqual(blocked.tools, [])
    assert.ok(blocked.needsClarification)
  }
  const switched = planRequest('不要查询，改为持续监督', once())
  assert.equal(switched.mode, 'continuous')
  assert.equal(switched.ready, false)
  assert.equal(switched.actionConfirmed, false)
  assert.equal(JSON.stringify(base), snapshot)
})
