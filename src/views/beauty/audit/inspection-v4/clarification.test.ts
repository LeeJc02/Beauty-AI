import { strict as assert } from 'node:assert'
import { test } from 'vitest'
import {
  clarificationQuestion,
  clarificationOptions,
  confirmedConfig,
  parseClarification
} from './clarification'
import { defaultToolPlan } from './executionPlan'

const complete = '查看南区新品培训，本周只查询一次'

test('当前状态从目标开始，每轮2至4选项且仅补本轮字段', () => {
  let state = parseClarification('查看当前状态')
  assert.equal(state.mode, undefined)
  for (const answer of ['培训达标', '新品', '全国', '本周', '定时查询', '每天09:00（推荐）']) {
    const options = clarificationOptions(state)
    assert.ok(options.length >= 2 && options.length <= 4)
    state = parseClarification(answer, state)
  }
  const config = confirmedConfig(state)!
  assert.equal(config.toolPlan?.cadenceSource, 'recommended')
  assert.equal(config.toolPlan?.remindEmployees, false)
  assert.equal(config.toolPlan?.escalateToCreator, false)
})
test('定时查询不会因一次或不要提醒降为单次', () => {
  for (const text of ['每隔几天查一次', '每3天9点查一次', '每天9点查一次，不要提醒']) {
    const state = parseClarification(text, parseClarification(complete))
    assert.equal(state.mode, 'scheduled', text)
    assert.equal(state.toolPlan?.remindEmployees, false)
  }
})
test('汇报、提醒与升级分开解析，否定关闭对应工具', () => {
  const state = parseClarification('南区新品培训未来一个月，每天9点定时查询，每轮飞书报告')
  assert.equal(confirmedConfig(state)?.toolPlan?.reportToCreator, true)
  assert.equal(state.toolPlan?.remindEmployees, false)
  assert.equal(parseClarification('不飞书', state).toolPlan?.reportToCreator, false)
  const supervision = parseClarification('监督，一次不合格提醒本人，连续三次不合格提醒我', state)
  assert.equal(supervision.toolPlan?.remindEmployees, true)
  assert.equal(supervision.toolPlan?.escalateToCreator, true)
  assert.equal(supervision.toolPlan?.escalationRule, 'consecutive')
  assert.equal(supervision.toolPlan?.escalationThreshold, 3)
  const after = parseClarification('提醒三次后仍未完成再通知我', state)
  assert.equal(after.toolPlan?.escalationRule, 'after-reminders')
  assert.equal(after.toolPlan?.escalationThreshold, 3)
  const negative = parseClarification('不要提醒，不要升级，不飞书', supervision)
  assert.equal(negative.mode, 'scheduled')
  assert.equal(negative.toolPlan?.remindEmployees, false)
  assert.equal(negative.toolPlan?.escalateToCreator, false)
  assert.equal(negative.toolPlan?.reportToCreator, false)
})
test('监督未授权动作先反问，推荐频率必须选择才生效', () => {
  let state = parseClarification('监督南区新品培训未来一个月')
  assert.equal(state.cadence, undefined)
  assert.equal(clarificationOptions(state)[0].recommended, true)
  state = parseClarification('由助手安排', state)
  assert.equal(state.toolPlan?.cadenceSource, 'recommended')
  assert.equal(confirmedConfig(state), null)
  assert.match(clarificationQuestion(state), /跟进/)
  state = parseClarification('未达标提醒本人，连续3轮未达标升级', state)
  assert.ok(confirmedConfig(state))
})

test('不默认目标、产品、地区、周期或方式', () => {
  const empty = parseClarification('帮我处理一下')
  assert.equal(empty.scenario, undefined)
  assert.equal(empty.product, undefined)
  assert.equal(empty.regions, undefined)
  assert.equal(empty.startsOn, undefined)
  assert.equal(empty.mode, undefined)
  assert.match(clarificationQuestion(empty), /培训达标.*培训负担.*综合/)
  assert.equal(confirmedConfig(empty), null)
})
test('反问逐轮补齐，明确前禁止确认', () => {
  let state = parseClarification('培训达标')
  assert.match(clarificationQuestion(state), /产品/)
  state = parseClarification('敏感肌', state)
  assert.match(clarificationQuestion(state), /地区/)
  state = parseClarification('北区和东区', state)
  assert.match(clarificationQuestion(state), /时间/)
  state = parseClarification('本周', state)
  assert.match(clarificationQuestion(state), /一次/)
  assert.equal(confirmedConfig(state), null)
  state = parseClarification('只查询一次', state)
  assert.deepEqual(confirmedConfig(state), {
    scenario: 'training',
    product: '敏感肌',
    regions: ['北区', '东区'],
    startsOn: '2026-09-14',
    endsOn: '2026-09-18',
    mode: 'once',
    cadence: '',
    toolPlan: defaultToolPlan()
  })
})
test('初始完整目标直接总结，不重复问参数', () => {
  assert.ok(confirmedConfig(parseClarification(complete)))
  assert.equal(clarificationQuestion(parseClarification(complete)), '')
})
test('持续监督必须明确频率，不默认每天九点', () => {
  let state = parseClarification('帮我盯南区新品培训，未来一个月')
  assert.equal(state.mode, 'scheduled')
  assert.equal(state.startsOn, '2026-09-15')
  assert.equal(state.endsOn, '2026-10-15')
  assert.equal(confirmedConfig(state), null)
  state = parseClarification('只汇总进度', state)
  state = parseClarification('每天上午9点', state)
  assert.equal(confirmedConfig(state)?.cadence, '每天 09:00')
  assert.equal(parseClarification('每天17:00', state).cadence, '每天 17:00')
  assert.equal(parseClarification('每周一09:00', state).cadence, '每周一 09:00')
})
test('未知产品可显式指定；未知产品不会默认为新品', () => {
  assert.equal(parseClarification('查南区精华液培训，本周').product, undefined)
  assert.equal(parseClarification('产品是星光精华').product, '星光精华')
  assert.equal(parseClarification('产品是不确定').product, undefined)
})
test('日期范围严格验证，不允许自动滚动、倒序和不完整日期', () => {
  for (const period of [
    '2026-02-30 至 2026-03-03',
    '2026-09-18 至 2026-09-14',
    '2026-09-15',
    '2026-9-14 至 2026-9-18',
    '下周'
  ]) {
    const state = parseClarification(period, parseClarification(complete))
    assert.equal(confirmedConfig(state), null, period)
    assert.equal(state.startsOn, undefined)
  }
  const state = parseClarification('2026-10-01 至 2026-10-31', parseClarification(complete))
  assert.equal(confirmedConfig(state)?.endsOn, '2026-10-31')
})
test('自然语言修订覆盖指定字段，保留其余条件', () => {
  let state = parseClarification('地区改成北区', parseClarification(complete))
  assert.deepEqual(confirmedConfig(state)?.regions, ['北区'])
  assert.equal(state.product, '新品')
  state = parseClarification('持续监督，每天17:00，只汇总进度', state)
  assert.equal(confirmedConfig(state)?.mode, 'scheduled')
  state = parseClarification('不用监督，只查一次', state)
  assert.equal(confirmedConfig(state)?.mode, 'once')
  assert.equal(state.cadence, '')
})
test('不支持的目标、地区、频率和无法理解的修订阻止确认', () => {
  const state = parseClarification(complete)
  for (const request of [
    '查库存',
    '地区改成杭州',
    '改为每周二09:00监督',
    '改为每天10:00监督',
    '随便改改',
    '不要南区',
    '最近半年'
  ]) {
    const next = parseClarification(request, state)
    assert.ok(next.issue, request)
    assert.equal(confirmedConfig(next), null, request)
  }
})
test('支持综合与负担目标，但多个产品需反问', () => {
  assert.equal(parseClarification('查培训负担').scenario, 'workload')
  assert.equal(parseClarification('综合巡检').scenario, 'overview')
  assert.equal(confirmedConfig(parseClarification('查新品和彩妆培训，全部地区，本周')), null)
})

test('条件性飞书升级不误判为每轮汇报，单次提醒冲突需重新确认', () => {
  const legacy = parseClarification(
    '监督南区新品培训未来一个月，每天09:00，未达标就提醒，提醒三次后仍未完成再发飞书给我'
  )
  assert.equal(legacy.toolPlan?.remindEmployees, true)
  assert.equal(legacy.toolPlan?.escalateToCreator, true)
  assert.equal(legacy.toolPlan?.reportToCreator, false)
  assert.equal(legacy.toolPlan?.escalationRule, 'after-reminders')
  const consecutive = parseClarification(
    '监督南区新品培训未来一个月，每天09:00，一次不合格提醒他，连续三次不合格就提醒我'
  )
  assert.equal(consecutive.toolPlan?.escalationRule, 'consecutive')
  assert.equal(consecutive.toolPlan?.escalationThreshold, 3)
  const conflicting = parseClarification('本周南区新品培训只查询一次，未达标提醒本人')
  assert.equal(confirmedConfig(conflicting), null)
  assert.match(conflicting.issue || '', /单次查询和员工提醒/)
})
