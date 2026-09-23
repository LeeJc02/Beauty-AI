import { describe, expect, it } from 'vitest'
import { defaultToolPlan, type ToolPlan } from './executionPlan'
import {
  advanceCase,
  authorizeCase,
  checkDay,
  createCase,
  DEMO_DATE,
  DEMO_PERIOD,
  detectScenario,
  exportReport,
  pauseCase,
  resumeCase,
  summarizeCase,
  supervisionConfigError,
  type InspectionCase,
  type SupervisionConfig
} from './model'

const authorized = () => authorizeCase(createCase('南区培训达标情况'), '每天 09:00', '南区负责人')
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

function expectCounts(
  item: InspectionCase,
  qualified: number,
  unqualified: number,
  missing: number
) {
  expect(summarizeCase(item)).toEqual({ total: 30, qualified, unqualified, missing })
  const summary = summarizeCase(item)
  expect(summary.qualified + summary.unqualified + summary.missing).toBe(summary.total)
  for (const person of item.people) {
    const status =
      person.score === null
        ? 'missing'
        : person.course && person.score >= 80
          ? 'qualified'
          : 'unqualified'
    expect(person.status).toBe(status)
  }
}

describe('inspection-v4 工具组合授权', () => {
  const planned = (override: Partial<ToolPlan> = {}) =>
    authorizeCase(
      {
        ...createCase('南区培训未来一个月'),
        queryMode: 'scheduled',
        toolPlan: { ...defaultToolPlan(true), ...override }
      },
      '每天 09:00',
      '员工本人'
    )

  it('纯定时查询不自动提醒，也不因全员达标提前结束', () => {
    let item = planned({ stopWhenQualified: true })
    for (let i = 0; i < 6; i++) item = advanceCase(item)
    expect(item.phase).toBe('watching')
    expect(item.people.every((p) => p.status === 'qualified')).toBe(true)
    expect(item.receipts.some((r) => ['reminder', 'report', 'escalation'].includes(r.kind))).toBe(
      false
    )
  })

  it('定时汇报每轮生成独立 report 而不是 escalation', () => {
    let item = planned({ reportToCreator: true })
    for (let i = 0; i < 3; i++) item = advanceCase(item)
    expect(item.receipts.filter((r) => r.kind === 'report')).toHaveLength(3)
    expect(item.receipts.some((r) => ['reminder', 'escalation'].includes(r.kind))).toBe(false)
  })

  it('连续3轮在第三轮升级，不需要先开启员工提醒，且每人只升级一次', () => {
    let item = planned({ escalateToCreator: true })
    for (let i = 0; i < 2; i++) item = advanceCase(item)
    expect(item.receipts.some((r) => r.kind === 'escalation')).toBe(false)
    item = advanceCase(item)
    expect(item.receipts.filter((r) => r.kind === 'escalation')).toHaveLength(1)
    expect(item.receipts.at(-1)?.detail).toContain('连续 3 轮未达标')
    item = advanceCase(item)
    expect(item.receipts.filter((r) => r.kind === 'escalation')).toHaveLength(1)
    item = advanceCase(item)
    expect(item.people.find((p) => p.id === 'person-28')?.escalated).toBe(true)
    item = advanceCase({ ...item, round: 3 })
    expect(item.receipts.filter((r) => r.kind === 'escalation')).toHaveLength(1)
    expect(item.receipts.some((r) => r.kind === 'reminder')).toBe(false)
  })

  it('缺数据断连续但保留提醒历史，合格清零连续次数', () => {
    const item = planned({ remindEmployees: true, escalateToCreator: true })
    item.people = item.people.map((p) => ({ ...p, consecutiveUnqualified: 2, reminderCount: 2 }))
    const next = advanceCase(item)
    expect(next.people.find((p) => p.id === 'person-29')).toMatchObject({
      status: 'missing',
      consecutiveUnqualified: 0,
      reminderCount: 2,
      escalated: false
    })
    expect(next.people[0]).toMatchObject({ status: 'qualified', consecutiveUnqualified: 0 })
    expect(
      next.receipts
        .filter((r) => ['reminder', 'escalation'].includes(r.kind))
        .every((r) => !r.detail.includes('程曦'))
    ).toBe(true)
  })

  it('监督启用达标停止，授权保留明确标题、计划且不发送', () => {
    let item = planned({ remindEmployees: true, stopWhenQualified: true })
    expect(item.title).toContain('培训跟进')
    expect(item.receipts.at(-1)?.detail).toContain('不进行异常升级')
    for (let i = 0; i < 5; i++) item = advanceCase(item)
    expect(item.phase).toBe('finished')
    const initial = {
      ...createCase('培训'),
      title: '我的明确计划',
      toolPlan: defaultToolPlan(true)
    }
    expect(authorizeCase(initial, '每天 09:00', '本人').title).toBe('我的明确计划')
    const once = { ...initial, queryMode: 'once' as const }
    expect(authorizeCase(once, '每天 09:00', '本人')).toBe(once)
  })
})

describe('inspection-v4 固定数据模型', () => {
  it('初查固定 30 人，证据与统计一致，日期与中文样本固定', () => {
    const item = createCase('检查培训')
    expectCounts(item, 22, 6, 2)
    expect(DEMO_DATE).toBe('2026-09-14')
    expect(DEMO_PERIOD).toBe('2026-09-14 至 2026-09-18')
    expect(item.period).toBe(DEMO_PERIOD)
    expect(item.createdAt).toBe('演示时间 2026-09-14 09:00')
    expect(item.region).toBe('南区')
    expect(item.phase).toBe('reported')
    expect(new Set(item.people.map((person) => person.id)).size).toBe(30)
    expect(item.people.every((person) => /[\u4e00-\u9fff]/.test(person.name + person.store))).toBe(
      true
    )
    const another = createCase('检查培训')
    expect(another.id).not.toBe(item.id)
    expect(another.people).toEqual(item.people)
    expect(another.people[0]).not.toBe(item.people[0])
  })

  it.each(['南区', '北区', '东区', '西区', '全国'])('识别%s，但明确为示例数据', (region) => {
    const item = createCase(`请检查${region}培训情况`)
    expect(item.region).toBe(region === '全国' ? '全国' : region)
    expect(item.title).toContain('示例')
    expect(exportReport(item)).toContain(`${region}（示例数据）`)
    expectCounts(item, 22, 6, 2)
  })

  it('识别场景，允许显式指定，非培训场景不冒充真实指标', () => {
    expect(detectScenario('检查培训考试')).toBe('training')
    expect(detectScenario('全国经营总览')).toBe('overview')
    expect(detectScenario('门店工作量与排班')).toBe('workload')
    expect(createCase('经营总览').scenario).toBe('overview')
    expect(createCase('经营总览', 'workload').scenario).toBe('workload')
    expect(exportReport(createCase('经营总览'))).toContain('不代表真实经营或工作量数据')
  })

  it('只有 watching 且已授权时才能推进，终止状态不可授权或恢复', () => {
    const item = createCase('培训')
    expect(advanceCase(item)).toBe(item)
    const unauthorized: InspectionCase = { ...item, phase: 'watching' }
    expect(advanceCase(unauthorized)).toBe(unauthorized)
    expect(pauseCase(unauthorized)).toBe(unauthorized)
    expect(resumeCase({ ...item, phase: 'paused' }).phase).toBe('paused')
    const inactive: InspectionCase['phase'][] = [
      'ready',
      'running',
      'reported',
      'paused',
      'finished',
      'cancelled'
    ]
    for (const phase of inactive) {
      const guarded = freeze({ ...authorized(), phase })
      expect(advanceCase(guarded)).toBe(guarded)
      expect(pauseCase(guarded)).toBe(guarded)
    }
    for (const phase of ['finished', 'cancelled'] as const) {
      const terminal = freeze({ ...item, phase })
      expect(authorizeCase(terminal, '每天', '负责人')).toBe(terminal)
      expect(resumeCase(terminal)).toBe(terminal)
    }
  })

  it('授权幂等且不修改输入，不通过重复授权恢复暂停', () => {
    const initial = freeze(createCase('培训'))
    const item = authorizeCase(initial, '每天', '负责人')
    expect(item.authorized).toBe(true)
    expect(item.phase).toBe('watching')
    expect(item.cadence).toBe('每天')
    expect(item.recipient).toBe('负责人')
    expect(initial.authorized).toBe(false)
    expect(initial.receipts).toHaveLength(1)
    expect(authorizeCase(freeze(item), '每周', '另一个负责人')).toBe(item)
    expect(item.receipts.filter((receipt) => receipt.kind === 'authorization')).toHaveLength(1)
    const paused = pauseCase(item)
    expect(authorizeCase(paused, '每天', '负责人')).toBe(paused)
  })

  it('暂停停止推进，恢复保持轮次，重复暂停和恢复不增加回执', () => {
    const first = freeze(advanceCase(authorized()))
    const paused = freeze(pauseCase(first))
    expect(first.phase).toBe('watching')
    expect(paused.phase).toBe('paused')
    expect(paused.round).toBe(1)
    expect(advanceCase(paused)).toBe(paused)
    expect(pauseCase(paused)).toBe(paused)
    const resumed = freeze(resumeCase(paused))
    expect(resumed.phase).toBe('watching')
    expect(resumed.round).toBe(1)
    expect(resumeCase(resumed)).toBe(resumed)
    expect(advanceCase(resumed).round).toBe(2)
  })

  it('前三轮同一人提醒计数 1/2/3 不立即升级，第四轮升级，第五轮全部达标', () => {
    let item = freeze(authorized())
    const rounds: InspectionCase[] = []
    const counts = [
      [26, 2, 2],
      [27, 1, 2],
      [27, 1, 2],
      [27, 1, 2],
      [30, 0, 0]
    ]
    for (const [index, [qualified, unqualified, missing]] of counts.entries()) {
      const prior = item
      item = freeze(advanceCase(item))
      expect(prior.round).toBe(index)
      expect(item.round).toBe(index + 1)
      expectCounts(item, qualified, unqualified, missing)
      expect(new Set(item.receipts.map((receipt) => receipt.id)).size).toBe(item.receipts.length)
      expect(
        item.receipts.every((receipt) => /^演示时间 2026-09-1[4-8] 09:00$/.test(receipt.at))
      ).toBe(true)
      rounds.push(item)
    }
    const fourth = rounds[3]
    const persistent = fourth.people.filter((person) => person.status === 'unqualified')
    expect(persistent).toHaveLength(1)
    for (const [index, round] of rounds.slice(0, 3).entries()) {
      expect(round.phase).toBe('watching')
      expect(round.receipts.some((receipt) => receipt.kind === 'escalation')).toBe(false)
      expect(round.people.find((person) => person.id === persistent[0].id)).toMatchObject({
        status: 'unqualified',
        consecutiveUnqualified: index + 1,
        reminderCount: index + 1,
        escalated: false
      })
      const reminders = round.receipts.filter((receipt) => receipt.kind === 'reminder')
      expect(reminders).toHaveLength(index + 1)
      expect(reminders[index].detail).toContain(persistent[0].name)
      expect(reminders[index].detail).toContain(`第 ${index + 1}/3 次提醒`)
    }
    expect(fourth.phase).toBe('watching')
    expect(persistent[0]).toMatchObject({
      consecutiveUnqualified: 4,
      reminderCount: 3,
      escalated: true
    })
    const escalations = fourth.receipts.filter((receipt) => receipt.kind === 'escalation')
    expect(escalations).toHaveLength(1)
    expect(escalations[0].detail).toContain(persistent[0].name)
    expect(escalations[0].detail).toContain('已提醒 3 次，在下一轮复查中仍未达标')
    expect(fourth.receipts.filter((receipt) => receipt.kind === 'reminder')).toHaveLength(3)
    for (const receipt of fourth.receipts.filter((receipt) =>
      ['reminder', 'escalation'].includes(receipt.kind)
    )) {
      expect(receipt.detail).toContain('本地模拟，未发送')
      for (const person of fourth.people.filter((person) => person.status === 'missing')) {
        expect(receipt.detail).not.toContain(person.name)
        expect(person.reminderCount).toBe(0)
        expect(person.escalated).toBe(false)
      }
    }
    expect(item.receipts.filter((receipt) => receipt.kind === 'escalation')).toEqual(escalations)
    expect(item.people.every((person) => person.reminderCount === 0 && !person.escalated)).toBe(
      true
    )
    expect(item.phase).toBe('finished')
    expect(item.receipts.filter((receipt) => receipt.kind === 'finished')).toHaveLength(1)
    expect(item.receipts.filter((receipt) => receipt.kind === 'reminder')).toHaveLength(3)
    expect(advanceCase(item)).toBe(item)
    expect(pauseCase(item)).toBe(item)
    expect(resumeCase(item)).toBe(item)
    expect(authorizeCase(item, '每天', '负责人')).toBe(item)
  })

  it('已升级人员在仍未达标的复查中不重复提醒或升级', () => {
    let item = authorized()
    for (let round = 0; round < 4; round++) item = advanceCase(item)
    // 固定剧本第五轮全合格；保留已升级状态，重放仍未达标的第四轮以覆盖去重分支。
    const stillUnqualified = freeze({ ...item, round: 3 })
    const next = advanceCase(stillUnqualified)
    expectCounts(next, 27, 1, 2)
    expect(next.people.find((person) => person.status === 'unqualified')).toMatchObject({
      reminderCount: 3,
      escalated: true
    })
    for (const kind of ['reminder', 'escalation'] as const) {
      expect(next.receipts.filter((receipt) => receipt.kind === kind)).toEqual(
        item.receipts.filter((receipt) => receipt.kind === kind)
      )
    }
    expect(next.receipts.slice(item.receipts.length).map((receipt) => receipt.kind)).toEqual([
      'check'
    ])
  })

  it.each([
    ['每3天 09:00', '2026-09-16', 1, '2026-09-16'],
    ['每3天 09:00', '2026-09-16', 3, '2026-09-22'],
    ['每天 09:00', '2026-09-16', 1, '2026-09-16'],
    ['每天 17:00', '2026-09-16', 2, '2026-09-17'],
    ['每周一 09:00', '2026-09-14', 1, '2026-09-14'],
    ['每周一 09:00', '2026-09-16', 1, '2026-09-21'],
    ['每周一 09:00', '2026-09-20', 1, '2026-09-21'],
    ['每周一 09:00', '2026-09-16', 2, '2026-09-28']
  ])('%s 从 %s 起第 %i 轮日期为 %s', (cadence, startsOn, round, expected) => {
    expect(checkDay({ cadence, startsOn }, round)).toBe(expected)
  })

  it('周期包含截止当天，到期停止复查但不冒充人员全部完成', () => {
    let item = authorizeCase(createCase('培训'), '每天 09:00', '本人', {
      startsOn: '2026-09-16',
      endsOn: '2026-09-18'
    })
    for (let round = 0; round < 3; round++) item = advanceCase(freeze(item))
    expect(item.phase).toBe('watching')
    expect(item.round).toBe(3)
    expectCounts(item, 27, 1, 2)
    const expired = advanceCase(freeze(item))
    expect(expired.phase).toBe('finished')
    expect(expired.round).toBe(3)
    expect(expired.people).toEqual(item.people)
    expectCounts(expired, 27, 1, 2)
    const added = expired.receipts.slice(item.receipts.length)
    expect(added).toHaveLength(1)
    expect(added[0].kind).toBe('finished')
    expect(added[0].title).toContain('监督周期已到期')
    expect(added[0].detail).toContain('不视为完成')
    expect(added[0].detail).not.toContain('全部达标')
    expect(expired.receipts.some((receipt) => receipt.kind === 'escalation')).toBe(false)
    expect(advanceCase(expired)).toBe(expired)
  })

  it('周频率下首个周一已超过周期时不产生复查或提醒', () => {
    const item = freeze(
      authorizeCase(createCase('培训'), '每周一 09:00', '本人', {
        startsOn: '2026-09-16',
        endsOn: '2026-09-18'
      })
    )
    const expired = advanceCase(item)
    expect(expired.phase).toBe('finished')
    expect(expired.round).toBe(0)
    expectCounts(expired, 22, 6, 2)
    expect(expired.receipts.slice(item.receipts.length).map((receipt) => receipt.kind)).toEqual([
      'finished'
    ])
  })

  it.each<[string, Partial<SupervisionConfig>, string]>([
    ['无地区', { regions: [] }, '请至少选择一个支持的地区。'],
    ['不支持的地区', { regions: ['南区', '未知地区'] }, '请至少选择一个支持的地区。'],
    ['空产品', { product: '' }, '请填写监督产品。'],
    ['空白产品', { product: '  ' }, '请填写监督产品。'],
    ['空开始日期', { startsOn: '' }, '请填写有效的起止日期。'],
    ['空结束日期', { endsOn: '' }, '请填写有效的起止日期。'],
    ['非标准日期', { startsOn: '2026-9-14' }, '请填写有效的起止日期。'],
    ['无效日期', { startsOn: 'not-a-date' }, '请填写有效的起止日期。'],
    ['不存在的开始日期', { startsOn: '2026-02-30' }, '请填写有效的起止日期。'],
    ['不存在的结束日期', { endsOn: '2026-09-31' }, '请填写有效的起止日期。'],
    ['日期倒置', { endsOn: '2026-09-13' }, '结束日期不能早于开始日期。']
  ])('%s 配置校验失败且拒绝授权，不新增回执', (_label, override, error) => {
    const item = freeze(createCase('南区新品培训'))
    const config = freeze({
      regions: ['南区'],
      product: '新品',
      startsOn: '2026-09-14',
      endsOn: '2026-09-18',
      ...override
    })
    expect(supervisionConfigError(config)).toBe(error)
    expect(authorizeCase(item, '每天 09:00', '本人', config)).toBe(item)
    expect(item.authorized).toBe(false)
    expect(item.receipts).toHaveLength(1)
  })

  it('支持自定义产品及同日起止的有效配置', () => {
    const config = {
      regions: ['巴厘岛', '泗水'],
      product: '新品精华',
      startsOn: '2026-09-16',
      endsOn: '2026-09-16'
    }
    expect(supervisionConfigError(config)).toBe('')
    expect(authorizeCase(createCase('培训'), '每天 09:00', '本人', config).authorized).toBe(true)
  })

  it('从提问提取地区产品日期，授权后范围固化到证据、回执与报告', () => {
    const initial = freeze(createCase('未来一个月监督巴厘岛、泗水敏感肌培训'))
    expect(initial).toMatchObject({
      regions: ['巴厘岛', '泗水'],
      product: '敏感肌',
      startsOn: '2026-09-15',
      endsOn: '2026-10-15'
    })
    const config = freeze({
      regions: ['北区', '东区'],
      product: '彩妆',
      startsOn: '2026-09-16',
      endsOn: '2026-09-20',
      escalationRecipient: '计划创建人李经理'
    })
    let item = freeze(authorizeCase(initial, '每天 17:00', '员工本人', config))
    const scope = {
      ...config,
      region: '北区、东区',
      period: '2026-09-16 至 2026-09-20'
    }
    expect(item).toMatchObject(scope)
    expect(item.title).toContain('北区、东区彩妆')
    const authorization = item.receipts.find((receipt) => receipt.kind === 'authorization')!
    expect(authorization.detail).toContain('北区、东区 · 彩妆 · 2026-09-16 至 2026-09-20')
    expect(
      authorizeCase(item, '每周一 09:00', '其他人', {
        regions: ['西区'],
        product: '护肤',
        startsOn: '2027-01-01',
        endsOn: '2027-01-31'
      })
    ).toBe(item)
    for (let round = 1; round <= 4; round++) {
      item = freeze(advanceCase(item))
      expect(item).toMatchObject(scope)
      expect(new Set(item.people.map((person) => person.region))).toEqual(new Set(config.regions))
      const check = item.receipts.filter((receipt) => receipt.kind === 'check').at(-1)!
      expect(check.at).toBe(`演示时间 2026-09-${15 + round} 17:00`)
    }
    expect(item.receipts.find((receipt) => receipt.kind === 'reminder')!.detail).toContain('彩妆')
    expect(item.receipts.find((receipt) => receipt.kind === 'escalation')!.detail).toContain(
      '计划创建人李经理'
    )
    const report = exportReport(item)
    expect(report).toContain('地区：北区、东区（示例数据）；周期：2026-09-16 至 2026-09-20')
    expect(report).toContain('彩妆')
    expect(initial.product).toBe('敏感肌')
    expect(initial.regions).toEqual(['巴厘岛', '泗水'])
  })

  it('导出含证据、口径、回执、演示时间及本地模拟未发送声明', () => {
    const item = freeze(advanceCase(authorized()))
    const report = exportReport(item)
    for (const text of [
      '固定示例数据',
      '仅本地模拟，未发送',
      '未连接后端、模型或飞书',
      '## 证据',
      '## 口径',
      '## 回执',
      '不计入未达标',
      '演示时间 2026-09-14',
      DEMO_PERIOD
    ]) {
      expect(report).toContain(text)
    }
    for (const person of item.people)
      expect(report).toContain(`${person.id}｜${person.name}｜${person.store}`)
    for (const receipt of item.receipts) expect(report).toContain(receipt.detail)
    expect(report).toBe(exportReport(item))
  })
})
