import {
  advanceCase,
  authorizeCase,
  createCase,
  completeInitialCase,
  checkDay,
  demoTime,
  pauseCase,
  summarizeCase,
  type InspectionCase,
  type Scenario,
  type SupervisionConfig
} from './model'

import { defaultToolPlan, planFor, policySummary, toolLabels } from './executionPlan'

export interface QueryConfig extends SupervisionConfig {
  scenario: Scenario
  mode: 'once' | 'scheduled'
  cadence: string
  clarificationSummary?: string
  toolPlan?: import('./executionPlan').ToolPlan
}
export interface AgentEvent {
  id: string
  kind: 'analysis' | 'tool' | 'result' | 'waiting'
  title: string
  detail: string
  input?: string
  output?: string
  at?: string
  round?: number
}
// 活跃仅指已授权、尚未结束的定时监督；单次问答完成即归档。
export const isActiveTask = (item: InspectionCase) =>
  !item.archivedAt && item.authorized && ['watching', 'paused'].includes(item.phase)
export const isArchived = (item: InspectionCase) =>
  !isActiveTask(item) &&
  Boolean(item.archivedAt || ['reported', 'finished', 'cancelled'].includes(item.phase))
export function queryCase(question: string, config: QueryConfig) {
  const item = createCase(question, config.scenario)
  item.regions = [...config.regions]
  item.region = config.regions.join('、')
  item.product = config.product.trim()
  item.startsOn = config.startsOn
  item.endsOn = config.endsOn
  item.period = `${config.startsOn} 至 ${config.endsOn}`
  item.title = `${item.region}${item.product}${config.scenario === 'workload' ? '培训负担巡检' : config.scenario === 'overview' ? '综合巡检' : '培训巡检'}（示例）`
  item.people = item.people.map((p, index) => ({
    ...p,
    region: config.regions[index % config.regions.length]
  }))
  item.toolPlan = { ...(config.toolPlan ?? defaultToolPlan(config.mode === 'scheduled')) }
  if (config.mode === 'once')
    item.toolPlan = {
      ...item.toolPlan,
      scheduled: false,
      remindEmployees: false,
      escalateToCreator: false,
      stopWhenQualified: false
    }
  if (config.toolPlan)
    item.title += ` · ${
      toolLabels(item.toolPlan)
        .filter((label) => !['只读查询', '结果校验'].includes(label))
        .join(' / ') || '单次查询'
    }`
  item.queryMode = config.mode
  item.cadence = config.cadence
  item.escalationRecipient = config.escalationRecipient || item.escalationRecipient
  item.createdAt = demoTime(0, item.cadence, item.startsOn)
  item.receipts = item.receipts.map((receipt) => ({
    ...receipt,
    at: item.createdAt,
    detail: `${item.region} · ${item.product} · ${item.period}：30 人，22 人达标，6 人未达标，2 人数据缺失。固定示例数据；仅本地模拟，未发送。`
  }))
  return item
}
export function executionEvents(item: InspectionCase, recheck = false): AgentEvent[] {
  const summary = summarizeCase(item)
  const prefix = `${item.id}-${recheck ? `round-${item.round}` : 'initial'}`
  const event = (index: number, value: Omit<AgentEvent, 'id'> & { id?: string }): AgentEvent => ({
    id: `${prefix}-${index}`,
    at: demoTime(item.round, item.cadence, item.startsOn),
    round: item.round,
    ...value
  })
  const entries = [
    event(0, {
      kind: 'analysis',
      title: recheck ? `复查 Agent · 第 ${item.round} 轮` : '工具选择 · 已明确用户需求',
      detail: `${toolLabels(planFor(item)).join(' → ')}。${policySummary(planFor(item))}按已确认的${item.region}、${item.product}及 ${item.period} 核查。先读取样本，再校验口径；缺失记录单独处理。`
    }),
    event(1, {
      kind: 'tool',
      title: 'training_records.query',
      detail: '读取培训与考核记录 · 本地工具模拟',
      input: JSON.stringify(
        {
          regions: item.regions,
          product: item.product,
          from: item.startsOn,
          to: item.endsOn,
          source: 'frontend_fixture'
        },
        null,
        2
      ),
      output: JSON.stringify(
        { rows: summary.total, stores: 5, source: '固定人员样本', network: false },
        null,
        2
      )
    }),
    event(2, {
      kind: 'tool',
      title: 'qualification.evaluate',
      detail: '校验课程完成、考核成绩和数据完整性',
      input: '{ "courseCompleted": true, "scoreGte": 80, "missing": "exclude_from_reminders" }',
      output: JSON.stringify(summary, null, 2)
    }),
    event(3, {
      kind: 'analysis',
      title: '复核 Agent · 结果检查',
      detail:
        item.scenario === 'workload'
          ? '当前缺少工时和排班，负担分析只能返回数据不足；不将培训未达标解释为超负荷。'
          : `校验分母 ${summary.total} 人；${summary.missing} 人记录缺失，不计入未达标，不触发提醒。`
    }),
    event(4, {
      kind: 'result',
      title: recheck ? 'followup.preview · 复查结果' : 'report.compose · 简报就绪',
      detail: recheck
        ? '已按授权整理本轮复查回执。所有通知仅生成预览，未实际发送。'
        : '已生成巡检简报与人员依据，等待你决定下一步。',
      output: recheck
        ? item.receipts
            .filter((r) => r.id.includes('receipt'))
            .slice(-3)
            .map((r) => `${r.title}：${r.detail}`)
            .join('\n')
        : `${summary.qualified} 人达标 · ${summary.unqualified} 人未达标 · ${summary.missing} 人待核实`
    })
  ]
  if (!recheck) {
    const preview = completeInitialCase(item)
    const report = preview.receipts.find((receipt) => receipt.kind === 'report')
    entries[3].detail += ' 初查不触发员工提醒或升级；监督计数从授权后的第 1 轮开始。'
    if (item.toolPlan?.reportToCreator && report) {
      entries.splice(
        4,
        0,
        event(5, {
          kind: 'tool',
          title: 'feishu.report',
          detail: report.title,
          at: report.at,
          input: JSON.stringify({
            round: 0,
            recipient: item.escalationRecipient,
            receiptId: report.id,
            initial: true
          }),
          output: JSON.stringify({ receiptId: report.id, preview: report.detail, sent: false })
        })
      )
      entries[entries.length - 1].output += `\n${report.title}：${report.detail}`
    }
  }
  if (recheck) {
    const lastCheck = item.receipts.map((r) => r.kind).lastIndexOf('check')
    const expired = item.receipts.at(-1)?.title.includes('周期已到期')
    if (expired)
      return [
        event(0, {
          id: `${item.id}-scheduler-finished-${item.endsOn}`,
          kind: 'tool',
          title: 'scheduler.finish',
          input: JSON.stringify({ endsOn: item.endsOn, nextRun: checkDay(item, item.round + 1) }),
          output: JSON.stringify({ status: 'finished', queried: false, sent: false }),
          detail: item.receipts.at(-1)!.detail,
          at: item.receipts.at(-1)!.at
        })
      ]
    const notices = item.authorized
      ? item.receipts
          .slice(lastCheck + 1)
          .filter((r) => ['reminder', 'report', 'escalation'].includes(r.kind))
      : []
    const tools = {
      reminder: 'employee.remind',
      report: 'feishu.report',
      escalation: 'feishu.escalate'
    }
    entries.splice(
      4,
      0,
      ...notices.map((receipt, index) =>
        event(5 + index, {
          kind: 'tool',
          title: tools[receipt.kind as keyof typeof tools],
          detail: receipt.title,
          at: receipt.at,
          input: JSON.stringify({
            round: item.round,
            policy: planFor(item),
            receiptId: receipt.id,
            recipient: receipt.kind === 'reminder' ? item.recipient : item.escalationRecipient,
            excludeMissing: true
          }),
          output: JSON.stringify({ receiptId: receipt.id, preview: receipt.detail, sent: false })
        })
      )
    )
    entries[entries.length - 1].output = item.receipts
      .slice(lastCheck)
      .map((r) => `${r.title}：${r.detail}`)
      .join('\n')
    if (!notices.length) entries[3].detail += ' 本轮无已授权通知动作，仅完成查询与校验。'
  }
  return entries
}
export function supervisionEvent(item: InspectionCase): AgentEvent {
  if (!item.authorized || !planFor(item).scheduled)
    return {
      id: `${item.id}-scheduler-not-authorized`,
      kind: 'analysis',
      title: '未创建定时计划',
      detail: '仅授权的定时任务可创建本地调度。',
      at: demoTime(0, item.cadence, item.startsOn),
      round: 0
    }
  return {
    id: `${item.id}-supervision-create`,
    kind: 'tool',
    title: 'scheduler.create',
    at: demoTime(0, item.cadence, item.startsOn),
    round: 0,
    detail: '执行工具 · 根据用户确认的自然语言需求建立本机定时计划。',
    input: JSON.stringify(
      {
        title: item.title,
        regions: item.regions,
        product: item.product,
        from: item.startsOn,
        to: item.endsOn,
        cadence: item.cadence,
        toolPlan: planFor(item),
        timezone: 'Asia/Jakarta'
      },
      null,
      2
    ),
    output: JSON.stringify(
      {
        status: 'watching',
        backendScheduled: false,
        notificationsSent: false,
        trigger: '页面内加速或手动推进演示时钟'
      },
      null,
      2
    )
  }
}
export function seedTasks(): InspectionCase[] {
  let watching = authorizeCase(
    createCase('南区新品培训，持续跟进一个月'),
    '每天 09:00',
    '未达标员工本人'
  )
  watching = advanceCase(watching)
  watching.trace = executionEvents(watching, true)
  watching.messages.push({
    id: `${watching.id}-seed`,
    role: 'assistant',
    text: '第 1 轮复查已完成。当前等待下一次定时复查；你可以手动推进演示时钟查看执行过程，不会后台运行。'
  })
  const scheduled = authorizeCase(
    createCase('各个地区敏感肌培训，未来一个月'),
    '每周一 09:00',
    '未达标员工本人'
  )
  scheduled.trace = executionEvents(scheduled)
  let finished = authorizeCase(createCase('东区彩妆培训，本周巡检'), '每天 09:00', '未达标员工本人')
  for (let i = 0; i < 5; i++) finished = advanceCase(finished)
  finished.trace = executionEvents(finished, true)
  finished.archivedAt = '演示时间 2026-09-18'
  finished.messages.push({
    id: `${finished.id}-done`,
    role: 'assistant',
    text: '5 轮复查后，30 人全部达标，任务已完成并归档。可回看执行记录和导出材料。'
  })
  const answered = createCase('北区护肤培训，本周完成情况如何？')
  answered.queryMode = 'once'
  answered.trace = executionEvents(answered)
  const extra = [
    {
      key: 'paused-training',
      question: '北区护肤培训，持续监督未来一个月',
      cadence: '每天 17:00',
      rounds: 2,
      paused: true
    },
    {
      key: 'third-reminder',
      question: '西区彩妆培训，未来一个月每天盯进度',
      cadence: '每天 09:00',
      rounds: 3
    },
    {
      key: 'escalated-training',
      question: '东区敏感肌培训，未来一个月持续跟进',
      cadence: '每天 17:00',
      rounds: 4
    },
    {
      key: 'workload-gap',
      question: '泗水新品培训负担排期，未来一个月持续核查',
      cadence: '每周一 09:00',
      rounds: 1
    }
  ].map((spec) => {
    let item = authorizeCase(createCase(spec.question), spec.cadence, '未达标员工本人')
    item.demoKey = spec.key
    item.queryMode = 'scheduled'
    item.trace = [...executionEvents(item), supervisionEvent(item)]
    for (let i = 0; i < spec.rounds; i++) {
      item = advanceCase(item)
      item.trace = [...(item.trace ?? []), ...executionEvents(item, true)]
    }
    if (spec.paused) item = pauseCase(item)
    return item
  })
  watching.queryMode = scheduled.queryMode = 'scheduled'
  watching.trace.unshift(supervisionEvent(watching))
  scheduled.trace.push(supervisionEvent(scheduled))
  const combinations = [
    {
      key: 'scheduled-query',
      title: '南区新品培训 · 每3天定时查询',
      plan: defaultToolPlan(true),
      rounds: 1
    },
    {
      key: 'scheduled-report',
      title: '北区护肤培训 · 每轮飞书汇报',
      plan: { ...defaultToolPlan(true), reportToCreator: true },
      rounds: 2
    },
    {
      key: 'consecutive-escalation',
      title: '东区彩妆培训 · 连续3轮不合格通知我',
      plan: { ...defaultToolPlan(true), escalateToCreator: true, stopWhenQualified: true },
      rounds: 3
    }
  ].map((spec) => {
    let item = queryCase(spec.title, {
      scenario: 'training',
      regions: [
        spec.key === 'scheduled-query' ? '南区' : spec.key === 'scheduled-report' ? '北区' : '东区'
      ],
      product:
        spec.key === 'scheduled-report'
          ? '护肤'
          : spec.key === 'consecutive-escalation'
            ? '彩妆'
            : '新品',
      startsOn: '2026-09-14',
      endsOn: '2026-10-15',
      cadence: spec.key === 'scheduled-query' ? '每3天 09:00' : '每天 09:00',
      mode: 'scheduled',
      toolPlan: spec.plan
    })
    item.title = spec.title
    item.demoKey = spec.key
    item = authorizeCase(completeInitialCase(item), item.cadence, '未达标员工本人')
    item.trace = [...executionEvents(item), supervisionEvent(item)]
    for (let round = 0; round < spec.rounds; round++) {
      item = advanceCase(item)
      item.trace = [...(item.trace ?? []), ...executionEvents(item, true)]
    }
    return item
  })
  return [watching, scheduled, finished, answered, ...extra, ...combinations]
}

export function roundSummary(item: InspectionCase): string {
  const summary = summarizeCase(item)
  const lastCheck = item.receipts.map((r) => r.kind).lastIndexOf('check')
  const notices = item.receipts
    .slice(lastCheck + 1)
    .filter((r) => ['reminder', 'report', 'escalation'].includes(r.kind))
  const actions = notices.map((r) =>
    r.kind === 'reminder' ? '员工提醒预览' : r.kind === 'report' ? '飞书汇报预览' : '飞书升级预览'
  )
  const next =
    item.phase === 'paused'
      ? '计划已暂停'
      : ['finished', 'cancelled'].includes(item.phase)
        ? '计划已结束'
        : item.authorized && checkDay(item, item.round + 1) > item.endsOn
          ? '下一步：周期到期，停止后续查询'
          : item.authorized
            ? `下一次：${checkDay(item, item.round + 1)} ${item.cadence.includes('17:00') ? '17:00' : '09:00'}（演示日程）`
            : '单次查询已完成，未创建定时计划'
  return `${item.receipts[lastCheck]?.at ?? item.createdAt} · ${item.round ? `第 ${item.round} 轮` : '初查'}完成：${summary.total} 人，${summary.qualified} 人达标，${summary.unqualified} 人未达标，${summary.missing} 人缺数据。${actions.length ? `已生成${actions.join('、')}，未发送。` : '本轮无通知预览。'}${next}。`
}

/** 旧浏览器记录原样保留，仅补齐缺失的演示类别。 */
export function ensureDemoExamples(items: InspectionCase[]): InspectionCase[] {
  const samples = seedTasks()
  return [
    ...items,
    ...samples.filter(
      (sample) => sample.demoKey && !items.some((item) => item.demoKey === sample.demoKey)
    ),
    ...(!items.some(isActiveTask) ? [samples[0]] : []),
    ...(!items.some((item) => item.phase === 'finished') ? [samples[2]] : []),
    ...(!items.some((item) => item.phase === 'reported' && !item.authorized) ? [samples[3]] : [])
  ]
}
