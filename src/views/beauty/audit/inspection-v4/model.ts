import { planFor, policySummary } from './executionPlan'

export type Scenario = 'training' | 'overview' | 'workload'
export type MaterialTab = 'report' | 'evidence' | 'process' | 'receipts'

export interface Person {
  id: string
  name: string
  store: string
  region: string
  course: boolean
  score: number | null
  status: 'qualified' | 'unqualified' | 'missing'
  /** 同一监督对象连续未达标次数；只在授权后的复查轮次累计。 */
  consecutiveUnqualified: number
  reminderCount: number
  escalated: boolean
}

export interface Receipt {
  id: string
  at: string
  kind:
    | 'authorization'
    | 'check'
    | 'report'
    | 'reminder'
    | 'escalation'
    | 'paused'
    | 'resumed'
    | 'finished'
  title: string
  detail: string
}

export interface SupervisionConfig {
  regions: string[]
  product: string
  startsOn: string
  endsOn: string
  escalationRecipient?: string
}

export interface InspectionCase {
  id: string
  title: string
  question: string
  scenario: Scenario
  region: string
  regions: string[]
  product: string
  period: string
  startsOn: string
  endsOn: string
  createdAt: string
  phase: 'ready' | 'running' | 'reported' | 'watching' | 'paused' | 'finished' | 'cancelled'
  round: number
  demoKey?: string
  archivedAt?: string
  queryMode?: 'once' | 'scheduled'
  toolPlan?: import('./executionPlan').ToolPlan
  executionStage?: number
  trace?: import('./taskFlow').AgentEvent[]
  people: Person[]
  receipts: Receipt[]
  authorized: boolean
  cadence: string
  recipient: string
  escalationRecipient: string
  messages: Array<{ id: string; role: 'user' | 'assistant'; text: string }>
}

export const DEMO_DATE = '2026-09-14'
export const DEMO_PERIOD = '2026-09-14 至 2026-09-18'

const SIMULATION = '固定示例数据；仅本地模拟，未发送；未连接后端、模型或飞书。'
const RULE =
  '课程完成且考试成绩 ≥ 80 分为达标；证据完整但未满足条件为未达标；成绩缺失单列为数据缺失，不计入未达标，不触发提醒或升级。'
const TITLES: Record<Scenario, string> = {
  training: '培训跟进',
  overview: '本周培训综合巡检',
  workload: '培训负担与排期巡检'
}
const NAMES = [
  '陈晨',
  '李欣',
  '王悦',
  '张静',
  '刘敏',
  '赵佳',
  '周婷',
  '吴楠',
  '徐丽',
  '孙颖',
  '胡蓉',
  '朱洁',
  '高倩',
  '林珊',
  '何芳',
  '郭琳',
  '马慧',
  '罗雪',
  '梁薇',
  '宋怡',
  '郑妍',
  '谢蕾',
  '韩梅',
  '唐宁',
  '冯雅',
  '于晴',
  '董媛',
  '萧悦',
  '程曦',
  '曹芸'
]
const STORES = ['中心旗舰店', '滨江店', '万象城店', '花园店', '新城店']
export const REGION_OPTIONS = ['南区', '北区', '东区', '西区', '巴厘岛', '泗水'] as const
export const PRODUCT_OPTIONS = ['新品', '敏感肌', '彩妆', '护肤'] as const
export const DEFAULT_START = DEMO_DATE
export const DEFAULT_END = '2026-09-18'

const addDays = (day: string, amount: number) => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

const periodOfQuestion = (question: string) =>
  /未来一个月|未来1个月|下个月|一个月/.test(question)
    ? { startsOn: addDays(DEMO_DATE, 1), endsOn: addDays(DEMO_DATE, 31) }
    : { startsOn: DEFAULT_START, endsOn: DEFAULT_END }

const regionsOfQuestion = (question: string) => {
  if (/各个地区|所有地区|全部地区|全国/.test(question)) return [...REGION_OPTIONS]
  const found = REGION_OPTIONS.filter((region) => question.includes(region))
  return found.length ? found : ['南区']
}

const productOfQuestion = (question: string) =>
  PRODUCT_OPTIONS.find((product) => question.includes(product)) ?? '新品'

// 所有场景与地区共用同一演示样本，不伪装成真实经营或工作量数据。
function peopleAt(round: number, regions: string[]): Person[] {
  const qualified = [22, 26, 27, 27, 27, 30][Math.min(round, 5)]
  return NAMES.map((name, index) => {
    const status: Person['status'] =
      index < qualified ? 'qualified' : index >= 28 ? 'missing' : 'unqualified'
    return {
      id: `person-${index + 1}`,
      name,
      store: STORES[Math.floor(index / 6)],
      region: regions[index % regions.length] ?? '南区',
      course: status !== 'unqualified' || index % 2 === 0,
      score:
        status === 'missing'
          ? null
          : status === 'qualified'
            ? 85 + (index % 15)
            : 60 + (index % 20),
      status,
      consecutiveUnqualified: 0,
      reminderCount: 0,
      escalated: false
    }
  })
}

/** 日期属于演示时钟，不是浏览器墙钟；周频次固定周一。 */
export function checkDay(item: Pick<InspectionCase, 'startsOn' | 'cadence'>, round: number) {
  const offset = Math.max(0, round - 1)
  if (/每\s*3\s*天/.test(item.cadence)) return addDays(item.startsOn, offset * 3)
  if (!item.cadence.startsWith('每周')) return addDays(item.startsOn, offset)
  const weekday = new Date(`${item.startsOn}T00:00:00Z`).getUTCDay()
  return addDays(item.startsOn, ((8 - weekday) % 7) + offset * 7)
}
export function demoTime(round: number, cadence = '每天 09:00', startsOn = DEMO_DATE): string {
  return `演示时间 ${checkDay({ startsOn, cadence }, round)} ${cadence.includes('17:00') ? '17:00' : '09:00'}`
}
export function supervisionConfigError(config: SupervisionConfig): string {
  if (
    !config.regions.length ||
    config.regions.some(
      (region) => !REGION_OPTIONS.includes(region as (typeof REGION_OPTIONS)[number])
    )
  )
    return '请至少选择一个支持的地区。'
  if (!config.product.trim()) return '请填写监督产品。'
  for (const day of [config.startsOn, config.endsOn]) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(day)) ||
      new Date(day).toISOString().slice(0, 10) !== day
    )
      return '请填写有效的起止日期。'
  }
  if (config.endsOn < config.startsOn) return '结束日期不能早于开始日期。'
  return ''
}

function withReceipt(
  item: InspectionCase,
  kind: Receipt['kind'],
  title: string,
  detail: string,
  at = demoTime(item.round, item.cadence, item.startsOn)
): InspectionCase {
  return {
    ...item,
    receipts: [
      ...item.receipts,
      {
        id: `${item.id}-receipt-${item.receipts.length + 1}`,
        at,
        kind,
        title,
        detail: `${detail} ${SIMULATION}`
      }
    ]
  }
}

export function detectScenario(question: string): Scenario {
  if (/工作量|工时|排班|负担|排期|接待量|接待人数/.test(question)) return 'workload'
  if (/总览|概览|综合|有什么问题|经营|业绩|营收|销售额/.test(question)) return 'overview'
  return 'training'
}

export function createCase(
  question: string,
  scenario: Scenario = detectScenario(question)
): InspectionCase {
  const id = `inspection-${globalThis.crypto.randomUUID()}`
  const regions = regionsOfQuestion(question)
  const region = question.includes('全国')
    ? '全国'
    : regions.length === REGION_OPTIONS.length
      ? '各地区'
      : regions.join('、')
  const product = productOfQuestion(question)
  const period = periodOfQuestion(question)
  const item: InspectionCase = {
    id,
    title: `${region}${product}${TITLES[scenario]}（示例）`,
    question,
    scenario,
    region,
    regions,
    product,
    period: `${period.startsOn} 至 ${period.endsOn}`,
    startsOn: period.startsOn,
    endsOn: period.endsOn,
    createdAt: demoTime(0),
    phase: 'reported',
    round: 0,
    people: peopleAt(0, regions),
    receipts: [],
    authorized: false,
    cadence: '每天 09:00',
    recipient: '未达标员工本人',
    escalationRecipient: '我（计划创建人）',
    messages: [
      { id: `${id}-user-1`, role: 'user', text: question },
      {
        id: `${id}-assistant-1`,
        role: 'assistant',
        text: `${region}的${product}示例初查：30 人，22 人达标，6 人未达标，2 人数据缺失。监督周期为 ${period.startsOn} 至 ${period.endsOn}。${SIMULATION}`
      }
    ]
  }
  return withReceipt(
    item,
    'check',
    '初查完成（本地模拟）',
    `${region} · ${product} · ${period.startsOn} 至 ${period.endsOn}：30 人，22 人达标，6 人未达标，2 人数据缺失。`
  )
}

export function summarizeCase(item: InspectionCase): {
  total: number
  qualified: number
  unqualified: number
  missing: number
} {
  const summary = { total: item.people.length, qualified: 0, unqualified: 0, missing: 0 }
  for (const person of item.people) summary[person.status] += 1
  return summary
}

/** 完成已确认需求的初查；通知仅生成预览，监督计数从后续首轮开始。 */
export function completeInitialCase(item: InspectionCase): InspectionCase {
  if (item.round !== 0 || item.authorized || !['ready', 'running', 'reported'].includes(item.phase))
    return item
  let next: InspectionCase = item.phase === 'reported' ? item : { ...item, phase: 'reported' }
  const summary = summarizeCase(next)
  if (!next.receipts.some((receipt) => receipt.kind === 'check'))
    next = withReceipt(
      next,
      'check',
      '初查完成（本地模拟）',
      `${item.region} · ${item.product} · ${item.period}：${summary.total} 人，${summary.qualified} 人达标，${summary.unqualified} 人未达标，${summary.missing} 人数据缺失。`
    )
  if (item.toolPlan?.reportToCreator && !next.receipts.some((receipt) => receipt.kind === 'report'))
    next = withReceipt(
      next,
      'report',
      '初查飞书汇报预览（本地模拟 / 未发送）',
      `接收人：${item.escalationRecipient}；初查：${summary.total} 人，${summary.qualified} 人达标，${summary.unqualified} 人未达标，${summary.missing} 人数据缺失。初查不触发员工提醒或升级，监督连续次数从授权后的第 1 轮开始累计。`
    )
  return next
}

export function authorizeCase(
  item: InspectionCase,
  cadence: string,
  recipient: string,
  config?: Partial<SupervisionConfig>
): InspectionCase {
  if (
    item.authorized ||
    item.phase !== 'reported' ||
    item.queryMode === 'once' ||
    (item.toolPlan && !item.toolPlan.scheduled)
  )
    return item
  const nextConfig = {
    regions: config?.regions ?? item.regions,
    product: config?.product ?? item.product,
    startsOn: config?.startsOn ?? item.startsOn,
    endsOn: config?.endsOn ?? item.endsOn
  }
  if (supervisionConfigError(nextConfig)) return item
  const region =
    nextConfig.regions.length === REGION_OPTIONS.length ? '各地区' : nextConfig.regions.join('、')
  return withReceipt(
    {
      ...item,
      authorized: true,
      phase: 'watching',
      cadence,
      recipient,
      escalationRecipient: config?.escalationRecipient || item.escalationRecipient,
      regions: nextConfig.regions,
      region,
      product: nextConfig.product,
      people: peopleAt(0, nextConfig.regions),
      startsOn: nextConfig.startsOn,
      endsOn: nextConfig.endsOn,
      period: `${nextConfig.startsOn} 至 ${nextConfig.endsOn}`,
      title: item.toolPlan
        ? item.title
        : `${region}${nextConfig.product}${TITLES[item.scenario]}（示例）`
    },
    'authorization',
    '已授权本地模拟巡检',
    `巡检范围：${region} · ${nextConfig.product} · ${nextConfig.startsOn} 至 ${nextConfig.endsOn}；复查：${cadence}；${policySummary(planFor({ ...item, authorized: true }))}接收人：${config?.escalationRecipient || item.escalationRecipient}。仅手动模拟，未创建后台任务。`
  )
}

export function advanceCase(item: InspectionCase): InspectionCase {
  if (
    !item.authorized ||
    item.phase !== 'watching' ||
    item.queryMode === 'once' ||
    !planFor(item).scheduled
  )
    return item
  const round = item.round + 1
  if (checkDay(item, round) > item.endsOn) {
    return withReceipt(
      { ...item, phase: 'finished' },
      'finished',
      '监督周期已到期（本地模拟）',
      '到期后停止复查与提醒；未达标人员仍保留原状态，不视为完成。',
      demoTime(round, item.cadence, item.startsOn)
    )
  }
  const plan = planFor(item)
  const reminded: Person[] = []
  const escalated: Person[] = []
  const people = peopleAt(round, item.regions).map((person) => {
    const previous = item.people.find((entry) => entry.id === person.id)
    const next = { ...person }
    if (next.status === 'unqualified') {
      next.consecutiveUnqualified = (previous?.consecutiveUnqualified ?? 0) + 1
      next.reminderCount = previous?.reminderCount ?? 0
      next.escalated = previous?.escalated ?? false
      const thresholdReached =
        plan.escalationRule === 'consecutive'
          ? next.consecutiveUnqualified >= plan.escalationThreshold
          : next.reminderCount >= plan.escalationThreshold
      if (plan.escalateToCreator && thresholdReached && !next.escalated) {
        next.escalated = true
        escalated.push(next)
      }
      if (
        plan.remindEmployees &&
        !(previous?.escalated ?? false) &&
        (plan.escalationRule !== 'after-reminders' || next.reminderCount < plan.escalationThreshold)
      ) {
        next.reminderCount += 1
        reminded.push(next)
      }
    }
    // 新计划每人整个任务仅升级一次；旧计划保留原有合格清零语义。
    if (next.status === 'qualified' && item.toolPlan) next.escalated = previous?.escalated ?? false
    // 合格清零连续次数；缺数据断连续，保留历史提醒和升级状态。
    if (next.status === 'missing') {
      next.reminderCount = previous?.reminderCount ?? 0
      next.escalated = previous?.escalated ?? false
    }
    return next
  })
  let next: InspectionCase = { ...item, round, people }
  const summary = summarizeCase(next)
  next = withReceipt(
    next,
    'check',
    `第 ${round} 轮复查（本地模拟）`,
    `${summary.total} 人：${summary.qualified} 人达标，${summary.unqualified} 人未达标，${summary.missing} 人数据缺失。`
  )
  if (reminded.length)
    next = withReceipt(
      next,
      'reminder',
      '提醒预览（本地模拟 / 未发送）',
      `接收对象：${item.recipient}；${reminded.map((person) => `${person.name}（${person.region} · ${person.store}，第 ${person.reminderCount}/${plan.escalationThreshold} 次提醒）`).join('、')}，请完成 ${item.product} 培训。数据缺失人员排除。`
    )
  if (escalated.length)
    next = withReceipt(
      next,
      'escalation',
      '飞书升级预览（本地模拟 / 未发送）',
      `接收人：${item.escalationRecipient}；${escalated.map((person) => person.name).join('、')}${plan.escalationRule === 'consecutive' ? `连续 ${plan.escalationThreshold} 轮未达标，本轮达到确认阈值` : `已提醒 ${plan.escalationThreshold} 次，在下一轮复查中仍未达标`}，请人工跟进。每人本次跟进只升级一次。数据缺失人员排除。`
    )
  if (plan.reportToCreator)
    next = withReceipt(
      next,
      'report',
      '飞书汇报预览（本地模拟 / 未发送）',
      `接收人：${item.escalationRecipient}；第 ${round} 轮：${summary.total} 人，${summary.qualified} 人达标，${summary.unqualified} 人未达标，${summary.missing} 人数据缺失。缺失记录不触发人员提醒或升级。`
    )
  if (
    plan.stopWhenQualified &&
    (plan.remindEmployees || plan.escalateToCreator) &&
    summary.qualified === summary.total &&
    summary.total > 0
  )
    next = withReceipt(
      { ...next, phase: 'finished' },
      'finished',
      '巡检自动结束（本地模拟）',
      `${summary.total} 人全部达标，停止后续模拟复查。`
    )
  return next
}

export function pauseCase(item: InspectionCase): InspectionCase {
  if (!item.authorized || item.phase !== 'watching') return item
  return withReceipt(
    { ...item, phase: 'paused' },
    'paused',
    '已暂停本地模拟',
    '暂停期间不推进复查，不产生提醒。'
  )
}

export function resumeCase(item: InspectionCase): InspectionCase {
  if (!item.authorized || item.phase !== 'paused') return item
  return withReceipt(
    { ...item, phase: 'watching' },
    'resumed',
    '已恢复本地模拟',
    '从当前轮次继续；未补发任何消息。'
  )
}

export function exportReport(item: InspectionCase): string {
  const summary = summarizeCase(item)
  const labels: Record<Person['status'], string> = {
    qualified: '达标',
    unqualified: '未达标',
    missing: '数据缺失'
  }
  return [
    `# ${item.title}`,
    SIMULATION,
    '所有场景与地区共用培训证据示例，不代表真实经营或工作量数据。',
    `问题：${item.question}`,
    `地区：${item.region}（示例数据）；周期：${item.period}`,
    `创建：${item.createdAt}；当前：${demoTime(item.round, item.cadence, item.startsOn)}`,
    `状态：${item.phase}；复查：第 ${item.round} 轮`,
    `频率：${item.cadence}；接收人：${item.recipient}；授权：${item.authorized ? '已授权本地模拟' : '未授权'}`,
    `汇总：总计 ${summary.total} 人，达标 ${summary.qualified} 人，未达标 ${summary.unqualified} 人，数据缺失 ${summary.missing} 人。`,
    '\n## 口径',
    RULE,
    policySummary(planFor(item)),
    '\n## 证据（示例）',
    ...item.people.map(
      (person) =>
        `${person.id}｜${person.name}｜${person.store}｜课程${person.course ? '已完成' : '未完成'}｜成绩 ${person.score ?? '缺失'}｜地区 ${person.region}｜提醒 ${person.reminderCount} 次 · ${person.escalated ? '已生成升级预览' : '未升级'}｜${labels[person.status]}`
    ),
    '\n## 回执（本地模拟 / 未发送）',
    ...item.receipts.map((receipt) => `${receipt.at}｜${receipt.title}｜${receipt.detail}`)
  ].join('\n')
}
