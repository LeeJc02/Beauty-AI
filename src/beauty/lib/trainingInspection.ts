import type { InspectionRequestPlan } from './inspectionRequest'
import { jakartaDay } from './inspectionCalendar'
import { applyInspectionTime, inspectionRangeExpired } from './inspectionTime'

export interface TrainingScope {
  region?: string
  person?: string
  product?: string
  timeMode?: 'current' | 'range' | 'ongoing'
  startsOn?: string
  endsOn?: string
  minScore?: number
  requireCourseCompleted?: boolean
}
export interface TrainingRecord {
  id: string
  person: string
  personId: string
  region: string
  product: string
  title: string
  checkedAt: string
  score?: number
  courseCompleted?: boolean
}
export const localDay = jakartaDay
function validDay(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function trainingScopeValid(scope: TrainingScope): boolean {
  return Boolean(
    scope.region &&
    scope.person &&
    scope.product &&
    scope.timeMode &&
    (scope.timeMode !== 'range' ||
      (scope.startsOn &&
        scope.endsOn &&
        /^\d{4}-\d{2}-\d{2}$/.test(scope.startsOn) &&
        /^\d{4}-\d{2}-\d{2}$/.test(scope.endsOn) &&
        scope.startsOn <= scope.endsOn &&
        validDay(scope.startsOn) &&
        validDay(scope.endsOn))) &&
    Number.isFinite(scope.minScore) &&
    scope.minScore! >= 0 &&
    scope.minScore! <= 100 &&
    typeof scope.requireCourseCompleted === 'boolean'
  )
}
export function matchesTrainingScope(
  record: TrainingRecord,
  scope: TrainingScope,
  clock = new Date()
): boolean {
  if (!scope.region || !scope.person || !scope.product || !scope.timeMode) return false
  if (
    ![
      ['region', record.region],
      ['person', record.person],
      ['product', record.product]
    ].every(
      ([key, value]) =>
        scope[key as 'region' | 'person' | 'product'] === '全部' ||
        scope[key as 'region' | 'person' | 'product'] === value
    )
  )
    return false
  const day = localDay(new Date(record.checkedAt))
  if (!Number.isFinite(Date.parse(record.checkedAt))) return false
  if (scope.timeMode === 'range')
    return Boolean(scope.startsOn && scope.endsOn && day >= scope.startsOn && day <= scope.endsOn)
  if (scope.timeMode === 'current') return Date.parse(record.checkedAt) <= clock.getTime()
  return true
}
export function trainingOutcome(
  record: TrainingRecord,
  scope: TrainingScope
): 'passed' | 'mismatch' | 'missing' {
  if (
    (scope.requireCourseCompleted && typeof record.courseCompleted !== 'boolean') ||
    typeof record.score !== 'number' ||
    !Number.isFinite(record.score) ||
    record.score < 0 ||
    record.score > 100
  )
    return 'missing'
  return (scope.requireCourseCompleted && !record.courseCompleted) || record.score < scope.minScore!
    ? 'mismatch'
    : 'passed'
}
export function trainingData(clock = new Date()): TrainingRecord[] {
  const at = (days: number) => new Date(clock.getTime() - days * 86400000).toISOString()
  return [
    {
      id: 'training-lixin-new',
      person: '李欣',
      personId: 'li-xin',
      region: '南区',
      product: '新品',
      title: '新品精华应用培训',
      checkedAt: at(0),
      score: 72,
      courseCompleted: false
    },
    {
      id: 'training-wang-new',
      person: '王芳',
      personId: 'wang-fang',
      region: '南区',
      product: '新品',
      title: '新品精华应用培训',
      checkedAt: at(0),
      score: 92,
      courseCompleted: true
    },
    {
      id: 'training-north',
      person: '陈晨',
      personId: 'chen-chen',
      region: '北区',
      product: '新品',
      title: '新品精华应用培训',
      checkedAt: at(0),
      score: 85,
      courseCompleted: true
    },
    {
      id: 'training-lixin-makeup',
      person: '李欣',
      personId: 'li-xin',
      region: '南区',
      product: '彩妆',
      title: '彩妆搭配培训',
      checkedAt: at(0),
      courseCompleted: true
    },
    {
      id: 'training-lixin-old',
      person: '李欣',
      personId: 'li-xin',
      region: '南区',
      product: '新品',
      title: '新品基础培训',
      checkedAt: at(40),
      score: 88,
      courseCompleted: true
    }
  ]
}

/** 培训专用多轮解析，未明确全部不能扩大范围。 */
export function planTraining(
  input: string,
  previous?: InspectionRequestPlan
): InspectionRequestPlan {
  const p: InspectionRequestPlan = {
    ...previous,
    question: [previous?.question, input].filter(Boolean).join('；'),
    subject: 'training',
    metric: 'training',
    name: '',
    ready: false,
    summary: '',
    tools: [],
    remind: previous?.remind ?? false,
    reportRequested: previous?.reportRequested ?? false,
    needsClarification: undefined
  }
  const ask = (question: string, options: Array<[string, string]>) => {
    p.summary = question
    p.needsClarification = {
      question,
      options: options.map(([label, answer]) => ({ label, answer }))
    }
    return p
  }
  const mode = input
    .replace(/(?:不要|取消|停止|无需)(?:持续监督|监督|一次查询|查询)/g, '')
    .split(/改为|改成/)
    .at(-1)!
  const continuous = /持续|监督|订阅|以后/.test(mode)
  const once = /查一下|查询|一次|只看当前|只查当前/.test(mode.replace(/持续查询/g, '持续'))
  if (continuous && once) p.mode = undefined
  else if (continuous) p.mode = 'continuous'
  else if (once) p.mode = 'once'
  else if (mode !== input && /不要|取消|停止|无需/.test(input)) p.mode = undefined
  if (p.mode !== 'continuous' || previous?.mode !== 'continuous') {
    p.actionConfirmed = false
    p.remind = false
    p.reportRequested = false
  }
  const replacementInput = input.split(/改为|改成|改看|改查|换成|改(?=[\u4e00-\u9fff])/).at(-1)!
  const region = replacementInput.match(/(?:华南区|华北区|南区|北区|东区|西区)/)
  if (region) p.region = region[0]
  if (/全部地区|所有地区|全部区域/.test(replacementInput)) p.region = '全部'
  const person =
    replacementInput.match(
      /(?:人员|受训人|姓名|检查人)[：:为]?\s*[“"「]?([\u4e00-\u9fff]{2,4})(?=[”"」\s，,；;。]|$)/
    ) ??
    replacementInput.match(
      /^(?:只查|只看|仅查|仅看)?((?!昨天|昨日|今天|今日|明天|本周|上周|下周)[\u4e00-\u9fff]{2,4})的培训/
    ) ??
    replacementInput.match(/(李欣|王芳|陈晨|张敏|刘洋)/)
  if (person) p.person = person[1]
  if (/全部人员|所有人员|所有人/.test(replacementInput)) p.person = '全部'
  const product =
    replacementInput.match(/(?:产品)[：:为]\s*[“"「]?([^”"」，,；;。\s]+)[”"」]?/) ??
    replacementInput.match(
      /^(?:只查|只看|仅查|仅看)?((?![\u4e00-\u9fff]*的)[\u4e00-\u9fff]{2,8})培训/
    ) ??
    replacementInput.match(/(新品|彩妆|敏感肌|精华|防晒)/)
  if (product) p.product = product[1]
  if (/全部产品|所有产品/.test(replacementInput)) p.product = '全部'
  applyInspectionTime(input, p)
  if (
    /人员|受训人|姓名/.test(replacementInput) &&
    !person &&
    !/全部人员|所有人员|所有人/.test(replacementInput)
  )
    p.person = undefined
  if (/产品/.test(replacementInput) && !product && !/全部产品|所有产品/.test(replacementInput))
    p.product = undefined
  const score = input.match(
    /(?:至少|不低于|最低|达到|及格线)?\s*([+-]?(?:\d+(?:\.\d+)?|Infinity|NaN))\s*分/i
  )
  if (score) p.minScore = Number(score[1])
  if (/无需完课|不要求完课|仅看成绩/.test(input)) p.requireCourseCompleted = false
  else if (/完课|完成课程/.test(input)) p.requireCourseCompleted = true
  if (
    p.mode === 'continuous' &&
    /提醒|通知本人|仅记录/.test(input) &&
    /汇报|升级|仅记录/.test(input)
  )
    p.actionConfirmed = true
  if (/(?:不|无需|不用|不要)提醒|仅记录/.test(input)) p.remind = false
  else if (/提醒|通知本人/.test(input)) p.remind = true
  if (/(?:不|无需|不用|不要)(?:汇报|升级)|仅记录/.test(input)) p.reportRequested = false
  else if (/连续\s*(3|三)\s*次.*(?:汇报|升级)/.test(input)) p.reportRequested = true
  if (
    (/不是|不要|不查|不看|排除|除了/.test(replacementInput) &&
      /区|人员|产品|李欣|王芳|陈晨|张敏|刘洋|全部|所有/.test(replacementInput)) ||
    (/只看|只查|仅看|仅查|人员|受训人|姓名/.test(input) &&
      !person &&
      !/全部人员|所有人员|所有人|当前|一次|记录|成绩|完课/.test(input))
  ) {
    p.person = undefined
    if (/区/.test(replacementInput)) p.region = undefined
    if (/产品/.test(replacementInput)) p.product = undefined
    return ask('人员或范围限制尚不能完整识别，请明确人员姓名或重新选择范围。', [
      ['李欣', '人员：李欣'],
      ['全部人员', '全部人员']
    ])
  }
  if (
    /仅查未达标|只查未达标|仅看未达标|只看未达标|只查达标|只看达标|排除|除了|西南区|东南区|东北区|西北区|华东区|华西区|华中区/.test(
      input
    )
  ) {
    p.region = undefined
    return ask('这项范围限制暂不能完整识别，请明确地区、人员、产品；不支持按核验结果预筛选。', [
      ['全部地区', '全部地区'],
      ['南区', '南区']
    ])
  }
  if (
    !p.timeMode &&
    /\d{4}(?:-|年)|上周|下周|上月|本月|去年|今年|昨天|昨日|明天|最近|近\d+天|\d+点|\d+小时/.test(
      input
    )
  ) {
    p.timeMode = undefined
    return ask('请将时间明确为起止日期，或选择当前记录、本周。', [
      ['本周', '本周'],
      ['当前记录', '截至现在的当前记录']
    ])
  }
  if (
    previous?.ready &&
    input &&
    !/培训|考核|考试|完课|分|南区|北区|东区|西区|地区|人员|受训人|姓名|产品|新品|彩妆|敏感肌|精华|防晒|李欣|王芳|陈晨|张敏|刘洋|本周|今天|今日|当前|历史|今后|之后|以后|新增|\d{4}-\d{2}-\d{2}|监督|订阅|一次|查询|查一下|提醒|记录|汇报|升级|确认/.test(
      input
    )
  )
    return ask('这项补充尚无法识别，请明确培训范围、时间或达标标准。', [
      ['范围不变', '确认'],
      ['全部人员', '全部人员']
    ])
  if (/每天|每日|定时|每周|库存|销售额|订单/.test(input))
    return ask('这项筛选或定时要求尚不能执行，请改为培训记录查询或新记录监督。', [
      ['一次查询', '只查一次'],
      ['新记录监督', '持续监督以后新增记录']
    ])
  if (!p.mode)
    return ask('只查询一次，还是持续监督新增培训记录？', [
      ['只查一次', '只查一次'],
      ['持续监督', '持续监督']
    ])
  if (!p.region)
    return ask('检查哪个地区？', [
      ['南区', '南区'],
      ['全部地区', '全部地区']
    ])
  if (!p.person)
    return ask('检查哪些受训人？可输入“人员：姓名”。', [
      ['李欣', '人员：李欣'],
      ['全部人员', '全部人员']
    ])
  if (!p.product)
    return ask('检查哪个产品的培训？', [
      ['新品', '新品培训'],
      ['全部产品', '全部产品']
    ])
  if (
    !p.timeMode ||
    (p.timeMode === 'range' &&
      (!p.startsOn ||
        !p.endsOn ||
        !validDay(p.startsOn) ||
        !validDay(p.endsOn) ||
        p.startsOn > p.endsOn)) ||
    (p.mode === 'continuous' && p.timeMode === 'current') ||
    (p.mode === 'once' && p.timeMode === 'ongoing')
  )
    return ask(
      '请明确记录的时间范围。',
      p.mode === 'once'
        ? [
            ['当前记录', '截至现在的当前记录'],
            ['本周', '本周']
          ]
        : [
            ['之后新增', '今后新增记录'],
            ['本周', '本周']
          ]
    )
  if (p.mode === 'continuous' && inspectionRangeExpired(p))
    return ask('这个日期范围已结束，请改为一次查询，或监督今后新增记录。', [
      ['一次查询', '只查一次'],
      ['今后新增', '今后新增记录']
    ])
  if (p.minScore == null || p.requireCourseCompleted == null || !trainingScopeValid(p))
    return ask('培训达标标准是什么？请确认完课要求和成绩阈值；日期范围须有效。', [
      ['完课且80分', '要求完课且至少80分'],
      ['只看80分', '不要求完课，成绩至少80分']
    ])
  if (
    p.mode === 'continuous' &&
    /连续\s*(?!3\b|三)[0-9一二四五六七八九十]+\s*次.*(?:汇报|升级)/.test(input)
  )
    return ask('支持同人连续三次不合规汇报，请确认处理规则。', [
      ['连续三次汇报', '不合规提醒本人，连续3次汇报'],
      ['仅记录', '仅记录，不提醒，不汇报']
    ])
  if (p.mode === 'continuous' && !p.actionConfirmed)
    return ask('不达标后如何提醒和汇报？', [
      ['提醒并汇报', '不合规提醒本人，连续3次汇报'],
      ['仅记录', '仅记录，不提醒，不汇报']
    ])
  if (p.mode === 'once') {
    p.remind = false
    p.reportRequested = false
  }
  return finalizeTrainingPlan(p)
}
export function finalizeTrainingPlan(p: InspectionRequestPlan): InspectionRequestPlan {
  p.ready = true
  p.name ||= `${p.region === '全部' ? '全区' : p.region}${p.product === '全部' ? '' : p.product}培训${p.mode === 'once' ? '查询' : '监督'}`
  p.summary = `${p.mode === 'once' ? '一次查询' : '持续监督'}${p.region}、${p.person}、${p.product}培训；${p.timeMode === 'range' ? `${p.startsOn}至${p.endsOn}` : p.timeMode === 'current' ? '截至当前记录' : '之后新增记录'}；${p.requireCourseCompleted ? '须完课且' : ''}成绩至少${p.minScore}分。${p.mode === 'once' ? '只读查询，不订阅、不提醒。' : `${p.remind ? '不合规提醒本人确认' : '不合规仅记录'}，${p.reportRequested ? '同人连续第三次不合规向创建人汇报' : '不升级汇报'}；达标清零，缺依据不判断。`}请确认后执行。`
  p.tools = [
    {
      key: `training.${p.mode === 'once' ? 'read' : 'subscribe'}`,
      label: p.mode === 'once' ? '读取培训记录' : '关注培训记录',
      detail: `${p.region} / ${p.person} / ${p.product}`
    },
    {
      key: 'training.check',
      label: '核验完课与成绩',
      detail: `${p.requireCourseCompleted ? '完成课程，' : ''}至少${p.minScore}分`
    },
    { key: 'inspection.record', label: '保存处理记录', detail: '保留每项核验依据' }
  ]
  return p
}
