import { PRODUCT_OPTIONS, REGION_OPTIONS, supervisionConfigError } from './model'
import type { QueryConfig } from './taskFlow'
import { defaultToolPlan } from './executionPlan'

export type ClarificationState = Partial<QueryConfig> & {
  issue?: string
  actionsExplicit?: boolean
}
export const scenarioLabels = { training: '培训达标', workload: '培训负担', overview: '综合巡检' }
const periodHint = '请说明时间范围：本周、未来一个月，或 YYYY-MM-DD 至 YYYY-MM-DD。'
const cadenceHint = '多久复查一次？可选择每天 09:00、每天 17:00、每3天 09:00 或每周一 09:00。'

/** 仅本地演示词法规则，不调用模型；未识别的条件不补默认值。 */
export function parseClarification(
  text: string,
  previous: ClarificationState = {}
): ClarificationState {
  const next: ClarificationState = { ...previous, issue: undefined }
  const input = text.trim()
  let recognized = /保留已明确需求|查看当前状态|看看情况|当前情况|当前状态/.test(input)
  const mark = () => {
    recognized = true
  }
  if (/综合|全面巡检/.test(input)) {
    next.scenario = 'overview'
    mark()
  } else if (/负担|负荷|工时|排班/.test(input)) {
    next.scenario = 'workload'
    mark()
  } else if (/培训|课程|考核/.test(input) || (!next.scenario && /达标/.test(input))) {
    next.scenario = 'training'
    mark()
  }

  if (/销售额|营收|库存|退款|天气|删除|发工资|修改成绩/.test(input)) {
    next.scenario = undefined
    next.issue =
      '当前演示只支持培训达标、培训负担（仅提示工时缺口）和综合巡检，不执行其他业务操作。你希望查看哪一项？'
  }
  const explicitProduct = input.match(/产品(?:是|为|改为|改成|换成)\s*[“「"]?([^，。；、\n”」"]+)/)
  const products = PRODUCT_OPTIONS.filter((value) => input.includes(value))
  if (explicitProduct) {
    const value = explicitProduct[1].trim()
    if (value.length <= 60 && !/不确定|不知道|待定|随便/.test(value)) {
      next.product = value
      mark()
    } else {
      next.product = undefined
      next.issue = '产品尚未明确，请用“产品是X”说明具体名称（不超过60字）。'
    }
  } else if (products.length === 1) {
    next.product = products[0]
    mark()
  } else if (products.length > 1) {
    next.product = undefined
    next.issue = '本次演示一次查询一个产品，请明确一个产品；也可以说“产品是X”。'
  }

  const regions = REGION_OPTIONS.filter((value) => input.includes(value))
  if (/各个地区|所有地区|全部地区|全国/.test(input)) {
    next.regions = [...REGION_OPTIONS]
    mark()
  } else if (regions.length) {
    next.regions = [...regions]
    mark()
  }
  if (
    /华东|华南|华北|华西|中区|海外|北京|上海|广州|深圳/.test(input) ||
    (/地区(?:是|为|改|换)/.test(input) && !regions.length && !/全部地区|所有地区/.test(input))
  ) {
    next.regions = undefined
    next.issue = `当前演示地区支持${REGION_OPTIONS.join('、')}或全部地区。请说明使用哪些演示地区？`
  }

  const dates = input.match(/\d{4}-\d{1,2}-\d{1,2}/g)
  if (dates) {
    next.startsOn = dates.length === 2 ? dates[0] : undefined
    next.endsOn = dates.length === 2 ? dates[1] : undefined
    mark()
    if (dates.length !== 2) next.issue = periodHint
  } else if (/未来(?:一|1)个月/.test(input)) {
    next.startsOn = '2026-09-15'
    next.endsOn = '2026-10-15'
    mark()
  } else if (/本周|这周/.test(input)) {
    next.startsOn = '2026-09-14'
    next.endsOn = '2026-09-18'
    mark()
  } else if (
    /下周|上周|下个月|上个月|明天|昨天|今天|月底|本月|这月|最近|近期|时间(?:改|是)|周期(?:改|是)|\d+月\d+日/.test(
      input
    )
  ) {
    next.startsOn = undefined
    next.endsOn = undefined
    next.issue = `该时间说法尚不支持。${periodHint}`
  }
  if (next.startsOn && next.endsOn) {
    const error = supervisionConfigError({
      regions: ['南区'],
      product: '日期校验',
      startsOn: next.startsOn,
      endsOn: next.endsOn
    })
    if (error) {
      next.startsOn = undefined
      next.endsOn = undefined
      next.issue = `${error}${periodHint}`
    }
  }

  const plan = { ...(previous.toolPlan ?? defaultToolPlan()) }
  const recurring = /每天|每日|每周|每隔|每[三3]天|定时|持续|盯|监督/.test(
    input.replace(/不(?:用|要)监督/g, '')
  )
  if (recurring) {
    if (previous.mode !== 'scheduled') next.actionsExplicit = false
    next.mode = 'scheduled'
    mark()
  } else if (/单次|只(?:查|查询|看)(?:询)?一次|一次查询|查询一次|不用监督|不要监督/.test(input)) {
    next.mode = 'once'
    next.cadence = ''
    Object.assign(plan, defaultToolPlan())
    next.actionsExplicit = true
    mark()
  }
  const noReminder = /不(?:用|要)?提醒|无需提醒|不通知员工/.test(input)
  const noReport = /不(?:用|要)?(?:发)?飞书|无需飞书|不(?:用|要)?汇报|不要报告/.test(input)
  const noEscalation = /不(?:用|要)?升级|不要通知我/.test(input)
  const positive = input.replace(/不(?:用|要)?(?:发?飞书|提醒|汇报|升级|通知)[^，。；、\n]*/g, '')
  if (/只汇总进度|仅查询|定时查询|定时查|只查不提醒/.test(input)) {
    plan.remindEmployees = false
    plan.reportToCreator = false
    plan.escalateToCreator = false
    plan.stopWhenQualified = false
    next.actionsExplicit = true
    mark()
  }
  if (
    /提醒(?:员工|本人|他|未达标|未完成)|未达标(?:就)?提醒|不合格(?:就)?提醒|员工提醒/.test(positive)
  ) {
    plan.remindEmployees = true
    plan.stopWhenQualified = true
    next.actionsExplicit = true
    mark()
  }
  const escalationIntent =
    /升级|(?:连续|提醒(?:满)?[一二三四五六七八九十\d]+次|仍|再|不合格|未达标).*?(?:通知我|提醒我|飞书给我|飞书通知|飞书汇报)/.test(
      positive
    )
  if (
    (/飞书|(?:汇报|报告|结果)给我|向我汇报|每轮.*(?:报告|汇报)|定时.*报告/.test(positive) &&
      !escalationIntent) ||
    /每(?:轮|次).*?(?:汇报|报告)|定时.*?汇报/.test(positive)
  ) {
    plan.reportToCreator = true
    next.actionsExplicit = true
    mark()
  }
  if (escalationIntent) {
    plan.escalateToCreator = true
    plan.remindEmployees = true
    plan.stopWhenQualified = true
    plan.escalationRule = /连续/.test(positive) ? 'consecutive' : 'after-reminders'
    const threshold = positive.match(/(?:连续|提醒(?:满)?)([一二三四五六七八九十\d]+)(?:次|轮)/)
    plan.escalationThreshold = threshold
      ? Number(threshold[1]) || '一二三四五六七八九十'.indexOf(threshold[1]) + 1
      : 3
    next.actionsExplicit = true
    mark()
  }
  if (noReminder) {
    plan.remindEmployees = false
    plan.escalateToCreator = false
    plan.stopWhenQualified = false
    next.actionsExplicit = true
    mark()
  }
  if (noReport) {
    plan.reportToCreator = false
    mark()
  }
  if (noEscalation) {
    plan.escalateToCreator = false
    mark()
  }
  if (!next.mode && (plan.remindEmployees || plan.escalateToCreator)) next.mode = 'scheduled'
  if (next.mode === 'once' && (plan.remindEmployees || plan.escalateToCreator)) {
    next.mode = undefined
    next.issue = '你同时提到了单次查询和员工提醒，请确认是只查询一次，还是持续监督并提醒？'
  }
  plan.scheduled = next.mode === 'scheduled'
  next.toolPlan = plan

  if (next.mode === 'scheduled') {
    const compact = input.replace(/\s/g, '')
    if (/每天|每日|每周|每隔|每[三3]天|频率|复查时间|由助手安排/.test(input)) {
      next.cadence = undefined
      if (
        /每(?:天|日)(?:早上|上午)?(?:0?9:00|9点|九点)(?!\d|半)/.test(compact) ||
        /由助手安排/.test(input)
      )
        next.cadence = '每天 09:00'
      else if (
        /每(?:天|日)(?:(?:下午)?(?:17:00|17点|十七点)|下午(?:五点|5点))(?!\d|半)/.test(compact)
      )
        next.cadence = '每天 17:00'
      else if (/每周一(?:早上|上午)?(?:0?9:00|9点|九点)(?!\d|半)/.test(compact))
        next.cadence = '每周一 09:00'
      else if (/每(?:隔)?[三3]天(?:早上|上午)?(?:0?9:00|9点|九点)(?!\d|半)/.test(compact))
        next.cadence = '每3天 09:00'
      if (!next.cadence) next.issue = cadenceHint
      else {
        plan.cadenceSource = /推荐|由助手安排/.test(input) ? 'recommended' : 'user'
        mark()
      }
    }
  }
  if (/不是|不要.*(?:区|产品)|排除|除了/.test(input)) {
    next.issue =
      '演示规则暂不解析排除或否定范围。请直接重述需要的目标、产品和地区，例如“查培训，产品是新品，北区”。'
  }
  if (!recognized && !next.issue)
    next.issue = '这句话尚未被本地演示规则识别，请按下面的提示补充具体需求。'
  return next
}

export function clarificationQuestion(state: ClarificationState): string {
  if (!state.scenario) return '你具体希望查培训达标、培训负担，还是做综合巡检？'
  if (!state.product)
    return '你要关注哪个产品？例如新品、敏感肌、彩妆、护肤；其他产品请说“产品是X”。'
  if (!state.regions?.length)
    return `要查看哪些地区？支持${REGION_OPTIONS.join('、')}，也可以说全部地区。`
  if (!state.startsOn || !state.endsOn) return periodHint
  if (!state.mode) return '这次只查询一次，还是需要持续监督？请直接告诉我。'
  if (state.mode === 'scheduled' && !state.cadence) return cadenceHint
  if (state.mode === 'scheduled' && !state.actionsExplicit)
    return '复查后希望如何跟进？只汇总进度、未达标提醒本人，还是提醒本人并连续3轮未达标升级给你？'
  return ''
}

export interface ClarificationOption {
  label: string
  answer: string
  reason: string
  recommended?: boolean
}
export function clarificationOptions(state: ClarificationState): ClarificationOption[] {
  const option = (
    label: string,
    answer = label,
    reason = '仅回答这一轮，不会立即执行。'
  ): ClarificationOption => ({ label, answer, reason })
  if (!state.scenario)
    return [
      option('培训达标', '培训达标', '检查课程完成情况和考核成绩。'),
      option('培训负担', '培训负担', '查看人员覆盖及工时数据缺口。'),
      option('综合巡检', '综合巡检', '一起查看培训达标与负担信息。')
    ]
  if (!state.product) return PRODUCT_OPTIONS.map((value) => option(value))
  if (!state.regions?.length)
    return [
      option('全国 / 全部地区', '全国', '覆盖全部六个演示地区。'),
      option('南区 + 北区', '南区和北区', '对比南北两个地区。'),
      option('东区 + 西区', '东区和西区', '对比东西两个地区。'),
      option('巴厘岛 + 泗水', '巴厘岛和泗水', '查看两个印尼地区；也可自己输入任意地区组合。')
    ]
  if (!state.startsOn || !state.endsOn)
    return [
      option('本周', '本周', '演示日期 2026-09-14 至 09-18。'),
      option('未来一个月', '未来一个月', '演示日期 2026-09-15 至 10-15。')
    ]
  if (!state.mode)
    return [
      option('只查询一次', '只查询一次', '只展示当前查询结果，不创建定时任务。'),
      option('定时查询', '定时查询', '周期复查，只在工作台汇总，不提醒员工。'),
      option('定时查询 + 飞书报告', '定时查询，每轮飞书汇报', '每轮生成给你的飞书报告预览。'),
      option(
        '监督 + 员工提醒 + 异常升级',
        '持续监督，未达标提醒本人，连续3轮未达标升级',
        '连续三轮未达标时升级给你。'
      )
    ]
  if (state.mode === 'scheduled' && !state.cadence)
    return [
      {
        ...option(
          '每天 09:00',
          '每天09:00（推荐）',
          '每天上班时核对进度，及时发现缺口，又避免频繁打扰。'
        ),
        recommended: true
      },
      option('每天 17:00', '每天17:00', '在工作日结束前汇总。'),
      option('每3天 09:00', '每3天09:00', '降低复查频率，按三天间隔跟进。'),
      option('每周一 09:00', '每周一09:00', '每周开始时统一复查。')
    ]
  if (state.mode === 'scheduled' && !state.actionsExplicit)
    return [
      option('只汇总进度', '只汇总进度', '不提醒员工，不进行异常升级。'),
      option('未达标提醒本人', '未达标提醒本人', '每次未达标都生成员工提醒预览。'),
      option(
        '提醒本人 + 连续3轮升级',
        '未达标提醒本人，连续3轮未达标升级',
        '同一人员连续三轮未达标，第3轮升级给你。'
      )
    ]
  return [option('保留已明确需求', '保留已明确需求'), option('改为只查询一次', '只查询一次')]
}

export function confirmedConfig(state: ClarificationState): QueryConfig | null {
  if (state.issue || clarificationQuestion(state)) return null
  const config: QueryConfig = {
    scenario: state.scenario!,
    product: state.product!,
    regions: [...state.regions!],
    startsOn: state.startsOn!,
    endsOn: state.endsOn!,
    mode: state.mode!,
    cadence: state.mode === 'scheduled' ? state.cadence! : '',
    toolPlan: {
      ...defaultToolPlan(state.mode === 'scheduled'),
      ...state.toolPlan,
      scheduled: state.mode === 'scheduled'
    }
  }
  const threshold = config.toolPlan!.escalationThreshold
  return supervisionConfigError(config) ||
    !Number.isInteger(threshold) ||
    threshold < 1 ||
    threshold > 10
    ? null
    : config
}
