import type { DeepReadonly } from 'vue'
import { applyInspectionTime, validInspectionTime, inspectionRangeExpired } from './inspectionTime'
import {
  planTraining,
  finalizeTrainingPlan,
  trainingScopeValid,
  type TrainingScope
} from './trainingInspection'
import type { CoursewareInspectionRules, CoursewareInspectionTask } from './coursewareInspection'

export interface InspectionTool {
  key: string
  label: string
  detail: string
}
export interface InspectionRequestPlan extends TrainingScope {
  question: string
  /** 用户确认的任务计划文档；执行仍以核对后的结构化条件为准。 */
  planMarkdown?: string
  name: string
  mode?: 'once' | 'continuous'
  subject?: 'courseware' | 'training'
  metric?: 'duration' | 'quality' | 'training'
  keyword?: string
  coursewareScopeConfirmed?: boolean
  minDurationMinutes?: number
  maxDurationMinutes?: number
  remind: boolean
  reportRequested: boolean
  /** 当前持续模式下明确选择过通知动作，不能从对话全文推断授权。 */
  actionConfirmed?: boolean
  durationInvalid?: boolean
  ready: boolean
  summary: string
  tools: InspectionTool[]
  needsClarification?: { question: string; options: Array<{ label: string; answer: string }> }
}

/** 确定性需求整理，不调用模型、读取数据或执行任务。 */
export function planRequest(text: string, previous?: InspectionRequestPlan): InspectionRequestPlan {
  const input = text.trim()
  const nextSubject = /课件/.test(input)
    ? 'courseware'
    : /培训|考核|考试|完课/.test(input)
      ? 'training'
      : previous?.subject
  if (previous?.subject && nextSubject !== previous.subject) previous = undefined
  if (
    (!/课件/.test(input) && /培训|考核|考试|完课/.test(input)) ||
    (previous?.subject === 'training' && !/课件/.test(input))
  )
    return planTraining(input, previous)
  const plan: InspectionRequestPlan = {
    ...previous,
    question: [previous?.question, input].filter(Boolean).join('；'),
    name: '',
    ready: false,
    summary: '',
    tools: [],
    remind: previous?.remind ?? false,
    reportRequested: previous?.reportRequested ?? false,
    needsClarification: undefined
  }
  const clarify = (question: string, options: Array<[string, string]>) => {
    plan.needsClarification = {
      question,
      options: options.map(([label, answer]) => ({ label, answer }))
    }
    plan.summary = question
    return plan
  }
  // 仅移除明确否定的执行方式，不能让“不要持续监督”反而授予订阅权限。
  const modeInput = input.replace(
    /(?:不要|不再|取消|停止|无需)(?:持续监督|持续检查|持续查询|持续关注|监督|订阅|只查一次|一次性查询|查询)/g,
    ''
  )
  const replacement = modeInput.split(/改为|改成/).at(-1)!
  const modeText =
    /持续|以后|每当|生成时|订阅|监督|一次|查一下|查询|审查一遍|只看当前|只查当前/.test(replacement)
      ? replacement
      : modeInput
  const continuous = /持续|以后|每当|生成时|订阅|监督/.test(modeText)
  const once = /一次|查一下|查询|审查一遍|只看当前|只查当前|现有|现在/.test(modeText)
  if (
    continuous &&
    /仅查一次|只查一次|只查当前|只看当前|审查一遍|一次性|查一下|查询/.test(
      modeText.replace(/持续查询/g, '持续')
    )
  ) {
    plan.mode = undefined
    plan.remind = false
    plan.reportRequested = false
    plan.actionConfirmed = false
    return clarify('本次只查当前数据，还是持续关注之后的新课件？', [
      ['只查一次', '只查一次'],
      ['持续监督', '持续监督']
    ])
  }
  if (continuous) plan.mode = 'continuous'
  else if (once) plan.mode = 'once'
  else if (modeInput !== input) {
    plan.mode = undefined
    plan.remind = false
    plan.reportRequested = false
    plan.actionConfirmed = false
  }
  if (plan.mode === 'once' || (plan.mode === 'continuous' && previous?.mode !== 'continuous')) {
    plan.remind = false
    plan.reportRequested = false
    plan.actionConfirmed = false
  }
  if (/南区|北区|东区|西区|地区|区域|门店范围/.test(input))
    return clarify('目前不支持按地区限定检查范围，请选择当前可见课件或标题关键词。', [
      ['当前可见课件', '查询全部课件'],
      ['新品课件', '标题包含“新品”']
    ])
  if (/每天|每日|每周|定时|定期|\d+\s*(?:点|时)|\d{1,2}:\d{2}/.test(input))
    return clarify('目前不支持定时触发，可只查一次，或在新课件生成时持续检查。', [
      ['只查一次', '只查一次'],
      ['生成时检查', '以后新课件生成时检查']
    ])
  // 查询层暂不支持结果/创建人筛选；标题中的这些字样仍然是合法关键词。
  const filterInput = input.replace(/(?:标题包含|标题含|关键词)[“"「'][^”"」']+[”"」']/g, '')
  if (
    /(?:只看|只查|只检查|仅看|仅查|仅检查|筛选|过滤|只保留|仅保留)\s*(?:不合规|合规|不符合(?:要求)?|符合(?:要求)?|未达标|达标)(?:的)?(?:课件|[，,；;。]|$)/.test(
      filterInput
    ) ||
    /(?:创建人|创建者|作者|培训师|(?:由|只看|只查|只检查|仅看|仅查|仅检查).*(?:创建|制作|生成)的课件|(?:只查|只看|仅查|仅看|改查)(?!昨天|昨日|今天|今日|明天|本周|上周|下周|新品|敏感肌|彩妆)[\u4e00-\u9fff]{2,4}的课件)/.test(
      filterInput
    )
  ) {
    plan.coursewareScopeConfirmed = false
    plan.keyword = undefined
    return clarify(
      '目前不支持按合规结果或创建人筛选课件，可查询当前可见的全部课件，或按标题关键词限定范围。',
      [
        ['当前可见课件', '查询全部课件'],
        ['新品课件', '标题包含“新品”']
      ]
    )
  }
  if (
    !/课件|培训|考核|考试|完课|时长|分钟|质量|生成状态|生成结果|标题|关键词|提醒|通知本人|记录|汇报|升级|一次|查一下|查询|审查一遍|只看当前|只查当前|现有|现在|持续|以后|每当|生成时|订阅|监督|当前账号|当前记录|截至现在|今后|之后|本周|今天|今日|\d{4}-\d{2}-\d{2}|确认|好的|取消下限|不限下限|取消上限|不限上限/.test(
      input
    )
  )
    return clarify('这项补充暂无法识别，请明确检查对象、时长条件或执行方式。', [
      ['查询课件时长', '查询课件预计学习时长'],
      ['持续检查时长', '持续监督课件预计学习时长']
    ])
  if (/销售额|库存|营收|客户流失|订单/.test(input) && !/课件/.test(input)) {
    plan.subject = undefined
    return clarify('当前尚不能核对这类业务数据，请明确是否改查课件。', [
      ['课件预计时长', '改查课件预计学习时长'],
      ['课件生成质量', '改查课件生成质量']
    ])
  }
  if (/课件/.test(input)) plan.subject = 'courseware'
  else if (/培训|考核|考试|完课/.test(input)) plan.subject = 'training'
  if (/时长|分钟/.test(input)) plan.metric = 'duration'
  else if (/质量|生成状态|生成结果/.test(input)) {
    plan.metric = 'quality'
    plan.minDurationMinutes = undefined
    plan.maxDurationMinutes = undefined
    plan.durationInvalid = false
  }
  const keyword = input.match(/(?:标题包含|标题含|关键词)[“"「']?([^，,；;。\s”"」']+)[”"」']?/)
  if (keyword) plan.keyword = keyword[1]
  const naturalKeyword =
    input.match(/(新品|敏感肌|彩妆)(?:的)?课件/) ??
    input.match(
      /^(?:改查|改看|只查|只看)((?!当前|全部|所有|昨天|昨日|今天|今日|明天|本周|上周|下周|最近)[\u4e00-\u9fff]{2,8})课件/
    )
  if (!keyword && naturalKeyword) plan.keyword = naturalKeyword[1]
  if (keyword || naturalKeyword) plan.coursewareScopeConfirmed = true
  if (/全部课件|所有课件|不限标题|当前课件|当前账号课件|新课件|新增课件/.test(input)) {
    plan.coursewareScopeConfirmed = true
    if (!keyword && !naturalKeyword && /全部课件|所有课件|不限标题/.test(input))
      plan.keyword = undefined
  }
  applyInspectionTime(input, plan)
  const numeric = '(?:[+-]?(?:\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?|Infinity)|NaN)'
  const range = input.match(
    new RegExp(`(${numeric})\\s*(?:到|至|[-~～–])\\s*(${numeric})\\s*分钟`, 'i')
  )
  if (range) {
    plan.minDurationMinutes = Number(range[1])
    plan.maxDurationMinutes = Number(range[2])
    plan.durationInvalid = !validInspectionDurationBounds(plan)
  } else {
    const min = input.match(new RegExp(`(?:至少|不少于|不低于|最短)\\s*(${numeric})\\s*分钟`, 'i'))
    const max = input.match(new RegExp(`(?:最多|不超过|不高于|最长)\\s*(${numeric})\\s*分钟`, 'i'))
    if (min || max) {
      if (min) plan.minDurationMinutes = Number(min[1])
      if (max) plan.maxDurationMinutes = Number(max[1])
      plan.durationInvalid = !validInspectionDurationBounds(plan)
    } else if (/分钟/.test(input)) plan.durationInvalid = true
  }
  if (/取消下限|不限下限/.test(input)) plan.minDurationMinutes = undefined
  if (/取消上限|不限上限/.test(input)) plan.maxDurationMinutes = undefined
  if (/取消下限|不限下限|取消上限|不限上限/.test(input))
    plan.durationInvalid = !validInspectionDurationBounds(plan)
  if (
    plan.mode === 'continuous' &&
    /提醒|通知本人|仅记录/.test(input) &&
    /汇报|升级|仅记录/.test(input)
  )
    plan.actionConfirmed = true
  if (/(?:不|无需|不用|不要)提醒|仅记录/.test(input)) plan.remind = false
  else if (/提醒|通知本人/.test(input)) plan.remind = true
  if (/(?:不|无需|不用|不要)(?:汇报|升级)|仅记录/.test(input)) plan.reportRequested = false
  else if (/连续\s*(?:3|三)\s*次.*(?:汇报|升级)/.test(input)) plan.reportRequested = true
  if (plan.mode === 'once') {
    plan.remind = false
    plan.reportRequested = false
    plan.actionConfirmed = false
  }
  if (plan.durationInvalid)
    return clarify('请给出有效时长范围：大于 0 且不超过 1440 分钟，下限不能大于上限。', [
      ['5–10 分钟', '5到10分钟合格'],
      ['10–20 分钟', '10到20分钟合格']
    ])
  if (!plan.subject)
    return clarify('您要检查哪类业务数据？', [
      ['课件', '检查课件'],
      ['培训', '检查培训']
    ])
  if (plan.subject !== 'courseware')
    return clarify(
      '当前支持核对课件预计学习时长和生成状态，不支持检查培训完成或考核情况。是否改查以下内容？',
      [
        ['改查课件时长', '改查课件预计学习时长'],
        ['改查课件生成质量', '改查课件生成质量']
      ]
    )
  if (!plan.mode)
    return clarify('这次只查询当前课件，还是持续关注之后的新课件？', [
      ['只查一次', '只查一次'],
      ['持续监督', '持续监督']
    ])
  if (!plan.coursewareScopeConfirmed)
    return clarify('检查哪些课件？请明确全部课件或标题关键词。', [
      ['全部课件', '全部课件'],
      ['新品课件', '标题包含“新品”']
    ])
  if (!validInspectionTime(plan, plan.mode))
    return clarify(
      '检查哪个时间范围内的课件？',
      plan.mode === 'once'
        ? [
            ['当前记录', '截至现在的当前记录'],
            ['本周', '本周']
          ]
        : [
            ['之后新增', '今后新增课件'],
            ['本周', '本周']
          ]
    )
  if (plan.mode === 'continuous' && inspectionRangeExpired(plan))
    return clarify('这个日期范围已结束，请改为一次查询，或监督今后新增课件。', [
      ['一次查询', '只查一次'],
      ['今后新增', '今后新增课件']
    ])
  if (!plan.metric)
    return clarify('您想核对课件的哪项信息？', [
      ['预计学习时长', '检查预计学习时长'],
      ['生成质量', '检查生成质量']
    ])
  if (plan.mode === 'continuous' && plan.metric !== 'duration')
    return clarify('目前持续监督支持预计学习时长；生成质量可以查询当前结果。您希望如何处理？', [
      ['查询生成质量', '只查一次课件生成质量'],
      ['监督预计时长', '持续监督课件预计学习时长']
    ])
  if (
    plan.metric === 'duration' &&
    plan.minDurationMinutes == null &&
    plan.maxDurationMinutes == null
  )
    return clarify('预计学习时长在什么范围内算合格？', [
      ['5–10 分钟', '5到10分钟合格'],
      ['10–20 分钟', '10到20分钟合格']
    ])
  if (
    plan.minDurationMinutes != null &&
    plan.maxDurationMinutes != null &&
    plan.minDurationMinutes > plan.maxDurationMinutes
  )
    return clarify('时长下限大于上限，请重新给出合格范围。', [
      ['5–10 分钟', '5到10分钟合格'],
      ['10–20 分钟', '10到20分钟合格']
    ])
  if (
    plan.mode === 'continuous' &&
    /连续\s*(?!3\b|三)[0-9一二四五六七八九十]+\s*次.*(?:汇报|升级)/.test(input)
  )
    return clarify('持续监督支持同一培训师连续三次不合规时汇报，是否采用此规则？', [
      ['连续三次汇报', '不合规提醒本人，连续3次汇报'],
      ['不汇报', '不合规提醒本人，不汇报']
    ])
  if (plan.mode === 'continuous' && !plan.actionConfirmed)
    return clarify('发现不合规课件后，如何处理？', [
      ['提醒并汇报', '不合规提醒本人，连续3次汇报'],
      ['仅记录', '不合规仅记录，不提醒，不汇报']
    ])
  if (plan.mode === 'once') {
    plan.remind = false
    plan.reportRequested = false
  }
  return finalizePlan(plan)
}

/** 只构造展示内容和工具计划，不重新解释已确认的结构化授权。 */
function finalizePlan(plan: InspectionRequestPlan): InspectionRequestPlan {
  plan.ready = true
  plan.name ||= `课件${plan.metric === 'duration' ? '预计学习时长' : '生成质量'}${plan.mode === 'once' ? '查询' : '监督'}`
  const scope = plan.keyword ? `标题包含“${plan.keyword}”的课件` : '全部课件'
  const standard =
    plan.metric === 'duration'
      ? `预计学习时长${plan.minDurationMinutes != null ? `不少于 ${plan.minDurationMinutes} 分钟` : ''}${plan.minDurationMinutes != null && plan.maxDurationMinutes != null ? '、' : ''}${plan.maxDurationMinutes != null ? `不超过 ${plan.maxDurationMinutes} 分钟` : ''}`
      : '核对生成状态、预览或下载凭据；不代替内容质量评审'
  const timeSummary =
    plan.timeMode === 'range'
      ? `${plan.startsOn} 至 ${plan.endsOn}`
      : plan.timeMode === 'current'
        ? '截至当前'
        : '确认之后新增'
  plan.summary = `时间范围：${timeSummary}；${plan.mode === 'once' ? '一次查询当前可见的' : '持续关注当前账号之后新生成的'}${scope}；${standard}。${plan.mode === 'continuous' ? `${plan.remind ? '不合规提醒本人确认知晓' : plan.reportRequested ? '不合规记录但不提醒本人' : '不合规仅记录'}${plan.reportRequested ? '，同一培训师连续第三次不合规向任务创建人汇报' : '，不升级汇报'}；合规不打扰。` : '只读查询，不创建持续监督或发送提醒。'}请确认后执行。`
  plan.tools = [
    {
      key: plan.mode === 'once' ? 'courseware.read' : 'courseware.subscribe',
      label: plan.mode === 'once' ? '读取课件' : '关注课件生成',
      detail: plan.mode === 'once' ? '读取当前可见课件清单' : '仅处理确认之后的新课件事件'
    },
    {
      key: `courseware.${plan.metric}`,
      label: plan.metric === 'duration' ? '核验预计学习时长' : '核验生成结果',
      detail: standard
    },
    {
      key: plan.mode === 'once' ? 'query.save' : 'inspection.record',
      label: '保存处理记录',
      detail:
        plan.mode === 'once' ? '保存本次查询结果，不订阅后续事件' : '按已确认规则记录结果与提醒'
    }
  ]
  return plan
}

export function planFromTask(task: DeepReadonly<CoursewareInspectionTask>): InspectionRequestPlan {
  if (task.requestPlan) {
    const saved = JSON.parse(JSON.stringify(task.requestPlan)) as InspectionRequestPlan
    if (saved.subject !== 'training' && !validInspectionTime(saved, saved.mode))
      return planRequest('确认', { ...saved, coursewareScopeConfirmed: true })
    return saved
  }
  const mode = task.mode ?? 'continuous'
  const metric =
    task.queryResult && task.minDurationMinutes == null && task.maxDurationMinutes == null
      ? 'quality'
      : 'duration'
  const plan: InspectionRequestPlan = {
    question: task.question,
    name: task.name,
    mode,
    subject: task.subject ?? 'courseware',
    region: task.region,
    person: task.person,
    product: task.product,
    timeMode: task.timeMode,
    startsOn: task.startsOn,
    endsOn: task.endsOn,
    minScore: task.minScore,
    requireCourseCompleted: task.requireCourseCompleted,
    metric: task.subject === 'training' ? 'training' : metric,
    keyword: task.titleFilter,
    coursewareScopeConfirmed: true,
    minDurationMinutes: task.minDurationMinutes,
    maxDurationMinutes: task.maxDurationMinutes,
    remind: mode === 'continuous' && task.remind,
    reportRequested: mode === 'continuous' && task.reportRequested,
    actionConfirmed: mode === 'continuous',
    ready: false,
    summary: '',
    tools: []
  }
  if (task.subject === 'training')
    return trainingScopeValid(plan) ? finalizeTrainingPlan(plan) : planTraining('', plan)
  if (metric === 'duration' && !validInspectionDurationBounds(plan)) {
    plan.durationInvalid = true
    plan.summary = '原任务的时长条件无效，请重新确认合格范围。'
    plan.needsClarification = {
      question: plan.summary,
      options: [{ label: '5–10 分钟', answer: '5到10分钟合格' }]
    }
    return plan
  }
  if (!validInspectionTime(plan, plan.mode)) {
    plan.summary = '原任务未明确时间范围，请确认后再修改规则。'
    plan.needsClarification = {
      question: plan.summary,
      options:
        mode === 'once'
          ? [
              { label: '当前记录', answer: '截至现在的当前记录' },
              { label: '本周', answer: '本周' }
            ]
          : [
              { label: '之后新增', answer: '今后新增课件' },
              { label: '本周', answer: '本周' }
            ]
    }
    return plan
  }
  return finalizePlan(plan)
}

/** 当前支持的课件时长上限为一天，拒绝零值、非有限数和反向区间。 */
export function validInspectionDurationBounds(
  plan: Pick<InspectionRequestPlan, 'minDurationMinutes' | 'maxDurationMinutes'>
): boolean {
  const { minDurationMinutes: min, maxDurationMinutes: max } = plan
  return (
    [min, max].some((value) => value != null) &&
    [min, max].every(
      (value) => value == null || (Number.isFinite(value) && value > 0 && value <= 1440)
    ) &&
    !(min != null && max != null && min > max)
  )
}

export function toInspectionRules(plan: InspectionRequestPlan): CoursewareInspectionRules {
  if (
    !plan.ready ||
    plan.mode !== 'continuous' ||
    !plan.actionConfirmed ||
    !(plan.subject === 'training'
      ? trainingScopeValid(plan)
      : plan.subject === 'courseware' &&
        plan.metric === 'duration' &&
        validInspectionTime(plan, plan.mode) &&
        validInspectionDurationBounds(plan))
  )
    throw new Error('请先补齐并确认持续监督条件')
  return {
    subject: plan.subject,
    region: plan.region,
    person: plan.person,
    product: plan.product,
    timeMode: plan.timeMode,
    startsOn: plan.startsOn,
    endsOn: plan.endsOn,
    minScore: plan.minScore,
    requireCourseCompleted: plan.requireCourseCompleted,
    requestPlan: JSON.parse(JSON.stringify(plan)),
    name: plan.name,
    question: plan.question,
    scope: plan.keyword ? 'title_keyword' : 'current_account',
    titleFilter: plan.keyword,
    minDurationMinutes: plan.minDurationMinutes,
    maxDurationMinutes: plan.maxDurationMinutes,
    remind: plan.remind,
    reportRequested: plan.reportRequested
  }
}
