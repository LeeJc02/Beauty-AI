import { describe, expect, it } from 'vitest'
import { defaultToolPlan } from './executionPlan'
import {
  advanceCase,
  authorizeCase,
  completeInitialCase,
  createCase,
  summarizeCase,
  type InspectionCase
} from './model'
import {
  ensureDemoExamples,
  executionEvents,
  isActiveTask,
  isArchived,
  queryCase,
  seedTasks,
  supervisionEvent,
  type QueryConfig
} from './taskFlow'

const config = (overrides: Partial<QueryConfig> = {}): QueryConfig => ({
  scenario: 'training',
  regions: ['北区', '巴厘岛'],
  product: '  自定义修护精华  ',
  startsOn: '2026-10-01',
  endsOn: '2026-10-31',
  mode: 'scheduled',
  cadence: '每周一 09:00',
  ...overrides
})

describe('taskFlow 查询配置与任务分类', () => {
  it.each(['once', 'scheduled'] as const)(
    '%s 初查汇报幂等、输入不变，工具预览对应最终回执',
    (mode) => {
      const item = queryCase(
        '明确要求初查发飞书',
        config({
          mode,
          toolPlan: {
            ...defaultToolPlan(mode === 'scheduled'),
            reportToCreator: true,
            remindEmployees: true,
            escalateToCreator: true
          }
        })
      )
      item.phase = 'running'
      item.receipts = []
      const before = structuredClone(item)
      const events = executionEvents(item)
      const result = completeInitialCase(item)
      expect(item).toEqual(before)
      expect(result.phase).toBe('reported')
      expect(result.receipts.map((r) => r.kind)).toEqual(['check', 'report'])
      expect(
        result.people.every(
          (p) => p.reminderCount === 0 && p.consecutiveUnqualified === 0 && !p.escalated
        )
      ).toBe(true)
      expect(completeInitialCase(result)).toBe(result)
      const tool = events.find((e) => e.title === 'feishu.report')!
      expect(JSON.parse(tool.output!)).toMatchObject({
        receiptId: result.receipts[1].id,
        sent: false
      })
      expect(tool.round).toBe(0)
      expect(events).toHaveLength(6)
      expect(events.some((e) => ['employee.remind', 'feishu.escalate'].includes(e.title))).toBe(
        false
      )
      expect(result.receipts[1].detail).toContain('第 1 轮开始累计')
    }
  )

  it('未明确要求飞书的初查只补查询回执，授权后的任务不重复完成初查', () => {
    const item = queryCase('查询', config())
    item.receipts = []
    const done = completeInitialCase(item)
    expect(done.receipts.map((r) => r.kind)).toEqual(['check'])
    const authorized = authorizeCase(done, done.cadence, '本人')
    expect(completeInitialCase(authorized)).toBe(authorized)
    expect(completeInitialCase(advanceCase(authorized)).round).toBe(1)
  })

  it('新任务默认纯查询；once 仅保留明确汇报，不创建调度', () => {
    const item = queryCase('每天检查', config())
    const authorized = authorizeCase(item, item.cadence, '本人')
    expect(advanceCase(authorized).receipts.some((r) => r.kind === 'reminder')).toBe(false)
    expect(supervisionEvent(item).kind).toBe('analysis')
    const once = queryCase(
      '查询',
      config({ mode: 'once', toolPlan: { ...defaultToolPlan(true), reportToCreator: true } })
    )
    expect(once.toolPlan).toEqual({ ...defaultToolPlan(false), reportToCreator: true })
    expect(
      executionEvents(once)
        .filter((e) => e.title.startsWith('feishu.'))
        .map((e) => e.title)
    ).toEqual(['feishu.report'])
  })

  it('工具记录逐一对应本轮回执，组合动态变化且具备演示时间', () => {
    let item = authorizeCase(
      queryCase(
        '完整组合',
        config({
          cadence: '每天 09:00',
          toolPlan: {
            ...defaultToolPlan(true),
            reportToCreator: true,
            remindEmployees: true,
            escalateToCreator: true
          }
        })
      ),
      '每天 09:00',
      '本人'
    )
    for (let i = 0; i < 3; i++) item = advanceCase(item)
    const events = executionEvents(item, true)
    const calls = events.filter((e) =>
      ['employee.remind', 'feishu.report', 'feishu.escalate'].includes(e.title)
    )
    expect(calls.map((e) => e.title)).toEqual([
      'employee.remind',
      'feishu.escalate',
      'feishu.report'
    ])
    expect(events).toHaveLength(8)
    expect(events.every((e) => e.at === '演示时间 2026-10-03 09:00' && e.round === 3)).toBe(true)
    const lastCheck = item.receipts.map((r) => r.kind).lastIndexOf('check')
    expect(calls.map((e) => JSON.parse(e.output!).receiptId)).toEqual(
      item.receipts.slice(lastCheck + 1).map((r) => r.id)
    )
    expect(
      executionEvents({ ...item, authorized: false }, true).some((e) =>
        e.title.startsWith('feishu.')
      )
    ).toBe(false)
  })

  it('到期不会重放上轮查询或通知调用', () => {
    let item = authorizeCase(
      queryCase(
        '汇报',
        config({
          startsOn: '2026-10-01',
          endsOn: '2026-10-01',
          cadence: '每天 09:00',
          toolPlan: { ...defaultToolPlan(true), reportToCreator: true }
        })
      ),
      '每天 09:00',
      '本人'
    )
    item = advanceCase(advanceCase(item))
    expect(executionEvents(item, true).map((event) => event.title)).toEqual(['scheduler.finish'])
    expect(executionEvents(item, true)[0].id).toContain('scheduler-finished')
  })

  it.each(['once', 'scheduled'] as const)('%s 配置覆盖自然语言预填且不自动授权提醒', (mode) => {
    const input = config({ mode })
    const item = queryCase('南区本周新品培训，提醒三次后发飞书', input)
    expect(item).toMatchObject({
      scenario: 'training',
      regions: ['北区', '巴厘岛'],
      region: '北区、巴厘岛',
      product: '自定义修护精华',
      startsOn: '2026-10-01',
      endsOn: '2026-10-31',
      period: '2026-10-01 至 2026-10-31',
      queryMode: mode,
      cadence: '每周一 09:00',
      authorized: false,
      round: 0
    })
    expect(item.title).toContain('北区、巴厘岛自定义修护精华培训巡检')
    expect(item.regions).not.toBe(input.regions)
    expect(item.people).toHaveLength(30)
    expect(new Set(item.people.map((person) => person.region))).toEqual(new Set(input.regions))
    expect(item.people.every((person) => person.reminderCount === 0 && !person.escalated)).toBe(
      true
    )
    expect(
      item.receipts.some((receipt) =>
        ['authorization', 'reminder', 'escalation'].includes(receipt.kind)
      )
    ).toBe(false)
    expect(isArchived(item)).toBe(true)
  })

  it.each([
    ['training', '培训巡检'],
    ['overview', '综合巡检'],
    ['workload', '培训负担巡检']
  ] as const)('明确选择 %s 覆盖原问题场景', (scenario, title) => {
    const item = queryCase('南区培训', config({ scenario }))
    expect(item.scenario).toBe(scenario)
    expect(item.title).toContain(title)
  })

  it('工具 JSON 使用确认后的地区、产品和日期，并明确本地样本来源', () => {
    const item = queryCase('南区新品培训', config())
    const before = structuredClone(item)
    const events = executionEvents(item)
    expect(events.map((event) => event.kind)).toEqual([
      'analysis',
      'tool',
      'tool',
      'analysis',
      'result'
    ])
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length)
    const query = events.find((event) => event.title === 'training_records.query')!
    expect(JSON.parse(query.input!)).toEqual({
      regions: ['北区', '巴厘岛'],
      product: '自定义修护精华',
      from: '2026-10-01',
      to: '2026-10-31',
      source: 'frontend_fixture'
    })
    expect(JSON.parse(query.output!)).toEqual({
      rows: 30,
      stores: 5,
      source: '固定人员样本',
      network: false
    })
    const evaluate = events.find((event) => event.title === 'qualification.evaluate')!
    expect(JSON.parse(evaluate.input!)).toEqual({
      courseCompleted: true,
      scoreGte: 80,
      missing: 'exclude_from_reminders'
    })
    expect(JSON.parse(evaluate.output!)).toEqual({
      total: 30,
      qualified: 22,
      unqualified: 6,
      missing: 2
    })
    expect(events[0].detail).toContain('2026-10-01 至 2026-10-31')
    expect(events.at(-1)?.detail).toContain('等待你决定下一步')
    expect(item).toEqual(before)
  })

  it.each(['ready', 'running', 'reported', 'watching', 'paused', 'cancelled', 'finished'] as const)(
    '%s 按授权与生命周期分类，归档标记优先',
    (phase: InspectionCase['phase']) => {
      for (const authorized of [false, true]) {
        const item = {
          ...createCase('南区培训'),
          phase,
          authorized,
          queryMode: 'scheduled' as const
        }
        expect(isActiveTask(item)).toBe(authorized && ['watching', 'paused'].includes(phase))
        expect(isArchived(item)).toBe(['reported', 'finished', 'cancelled'].includes(phase))
        expect(isActiveTask({ ...item, archivedAt: '2026-09-18' })).toBe(false)
        expect(isArchived({ ...item, archivedAt: '2026-09-18' })).toBe(true)
      }
    }
  )

  it('旧监督按实际回执生成明确工具，第三次提醒不当场升级', () => {
    let item = authorizeCase(createCase('监督培训未来一个月'), '每天 09:00', '未达标员工本人')
    const create = supervisionEvent(item)
    expect(create.title).toBe('scheduler.create')
    expect(JSON.parse(create.input!)).toMatchObject({
      regions: ['南区'],
      timezone: 'Asia/Jakarta'
    })
    expect(JSON.parse(create.output!)).toMatchObject({
      status: 'watching',
      backendScheduled: false,
      notificationsSent: false
    })
    for (let round = 1; round <= 4; round++) {
      item = advanceCase(item)
      const events = executionEvents(item, true)
      expect(events).toHaveLength(6)
      expect(new Set(events.map((event) => event.id)).size).toBe(6)
      const tool = events.find(
        (event) => event.title === (round <= 3 ? 'employee.remind' : 'feishu.escalate')
      )!
      expect(JSON.parse(tool.input!)).toMatchObject({ round, excludeMissing: true })
      expect(JSON.parse(tool.output!).sent).toBe(false)
      expect(tool.at).toContain(`2026-09-${14 + round}`)
      expect(tool.round).toBe(round)
    }
  })

  it('v2 四个旧示例保留原样，仅按 demoKey 补齐七个样例', () => {
    const old = seedTasks().slice(0, 4)
    const migrated = ensureDemoExamples(old)
    expect(migrated).toHaveLength(11)
    old.forEach((item, index) => expect(migrated[index]).toBe(item))
    expect(new Set(migrated.filter((item) => item.demoKey).map((item) => item.demoKey)).size).toBe(
      7
    )
    expect(ensureDemoExamples(migrated)).toEqual(migrated)
  })

  it('完成状态无需手动归档标记即归入归档', () => {
    expect(isArchived({ ...createCase('培训'), phase: 'finished' })).toBe(true)
  })

  it('旧数据补齐缺失类别，保留原对象且重复检查不重复补齐', () => {
    const old = createCase('旧的单次查询')
    const migrated = ensureDemoExamples([old])
    expect(migrated).toHaveLength(10)
    expect(migrated[0]).toBe(old)
    expect(migrated.filter(isActiveTask)).toHaveLength(8)
    expect(migrated.filter((item) => item.phase === 'finished')).toHaveLength(1)
    expect(ensureDemoExamples(migrated)).toEqual(migrated)
    expect(ensureDemoExamples(seedTasks())).toHaveLength(11)
  })

  it('seed 提供六个活跃监督、完成监督和单次问答，记录可回看且互不共享', () => {
    const tasks = seedTasks()
    expect(tasks).toHaveLength(11)
    expect(new Set(tasks.map((item) => item.id)).size).toBe(11)
    const active = tasks.filter(isActiveTask)
    expect(active).toHaveLength(9)
    expect(active.slice(0, 2).map((item) => [item.phase, item.round, item.cadence])).toEqual([
      ['watching', 1, '每天 09:00'],
      ['watching', 0, '每周一 09:00']
    ])
    expect(active.every((item) => item.authorized)).toBe(true)
    expect(tasks.filter(isArchived)).toHaveLength(2)
    expect(tasks[3]).toMatchObject({ phase: 'reported', authorized: false, queryMode: 'once' })
    const finished = tasks.find((item) => item.phase === 'finished')!
    expect(finished).toMatchObject({ phase: 'finished', round: 5 })
    expect(finished.archivedAt).toBeTruthy()
    expect(summarizeCase(finished)).toEqual({
      total: 30,
      qualified: 30,
      unqualified: 0,
      missing: 0
    })
    expect(finished.receipts.filter((receipt) => receipt.kind === 'reminder')).toHaveLength(3)
    expect(finished.receipts.filter((receipt) => receipt.kind === 'escalation')).toHaveLength(1)
    expect(finished.receipts.filter((receipt) => receipt.kind === 'finished')).toHaveLength(1)
    expect(finished.messages.at(-1)?.text).toContain('30 人全部达标')
    for (const item of tasks) {
      expect(item.trace!.length).toBeGreaterThanOrEqual(5)
      expect(item.trace?.some((event) => event.title === 'training_records.query')).toBe(true)
    }
    expect(finished.trace?.[0].title).toContain('第 5 轮')
    expect(tasks.filter((item) => item.demoKey).map((item) => item.demoKey)).toEqual([
      'paused-training',
      'third-reminder',
      'escalated-training',
      'workload-gap',
      'scheduled-query',
      'scheduled-report',
      'consecutive-escalation'
    ])
    expect(active.find((item) => item.demoKey === 'paused-training')?.phase).toBe('paused')
    tasks[0].people[0].name = '不会污染其他样本'
    expect(tasks[1].people[0].name).not.toBe(tasks[0].people[0].name)
    expect(seedTasks()[0].people[0].name).not.toBe(tasks[0].people[0].name)
  })
})
