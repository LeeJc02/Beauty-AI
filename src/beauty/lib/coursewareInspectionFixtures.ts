import type {
  CoursewareInspectionIdentity,
  CoursewareInspectionTask,
  CoursewareInspectionEntry
} from './coursewareInspection'
import { completeInspectionQueryFixture } from './inspectionPresentation'

/** 仅用于前端业务初始数据，不调度事件或发送通知。版本随存储桶持久化。 */
export const COURSEWARE_INSPECTION_SEED_VERSION = 5

/** 只归档当前身份的两条 v4 内置在途查询，不触碰真实查询、已完成记录或自建任务。 */
export function archiveLegacyInspectionQueryFixtures(
  tasks: CoursewareInspectionTask[],
  actor: CoursewareInspectionIdentity,
  clock: Date
): boolean {
  const prefix = `business-seed-v4:${encodeURIComponent(String(actor.userId))}:${encodeURIComponent(actor.role)}:query:`
  let changed = false
  for (const task of tasks) {
    if (
      (task.id !== `${prefix}0` && task.id !== `${prefix}1`) ||
      task.ownerUserId !== String(actor.userId) ||
      task.mode !== 'once' ||
      !task.queryPending ||
      task.completedAt ||
      task.queryResult ||
      !task.pendingQueryResult
    )
      continue
    changed =
      completeInspectionQueryFixture(task, task.pendingQueryResult, clock.toISOString()) || changed
  }
  return changed
}

export function createCoursewareInspectionFixtures(
  actor: CoursewareInspectionIdentity,
  clock: Date,
  previousVersion = 0
): CoursewareInspectionTask[] {
  const owner = String(actor.userId)
  const creator = actor.displayName?.trim() || '培训师'
  const at = (hours: number) => new Date(clock.getTime() - hours * 3600_000).toISOString()
  const definitions = [
    {
      name: '新品课件时长监督',
      keyword: '新品',
      titles: ['新品精华成分与卖点', '新品精华顾客问答', '新品精华搭配建议'],
      minutes: [6, 7, 8],
      outcomes: ['acknowledged', 'acknowledged', 'mismatch'],
      enabled: true
    },
    {
      name: '敏感肌产品知识',
      keyword: '敏感肌',
      titles: ['敏感肌屏障护理基础', '敏感肌产品选择要点'],
      minutes: [12, 14],
      outcomes: ['passed', 'passed'],
      enabled: true
    },
    {
      name: '门店服务话术',
      keyword: '门店服务',
      titles: ['门店服务接待与需求了解'],
      minutes: [null],
      outcomes: ['missing'],
      enabled: true
    },
    {
      name: '彩妆培训',
      keyword: '彩妆',
      titles: ['彩妆底妆技巧与常见问题'],
      minutes: [16],
      outcomes: ['passed'],
      enabled: false
    }
  ] as const
  const tasks: CoursewareInspectionTask[] = definitions.map((definition, index) => {
    const id = `business-seed-v1:${encodeURIComponent(owner)}:${encodeURIComponent(actor.role)}:${index}`
    const entries: CoursewareInspectionEntry[] = definition.titles.map(
      (title, offset): CoursewareInspectionEntry => {
        const minutes = definition.minutes[offset]
        const outcome = definition.outcomes[offset]
        const time = at(48 - index * 6 - offset * 3)
        const summary =
          outcome === 'missing'
            ? '课件已生成，尚缺预计学习时长，等待补齐依据后核验。'
            : outcome === 'passed'
              ? `已核验预计学习时长 ${minutes} 分钟，符合 10–20 分钟要求。`
              : `已核验预计学习时长 ${minutes} 分钟，不符合 10–20 分钟要求。${outcome === 'acknowledged' ? '本人已确认知晓，确认不代表整改达标。' : '等待本人确认知晓。'}`
        return {
          id: `${id}:entry:${offset}`,
          generationTaskId: -1000 - index * 10 - offset,
          title,
          creator,
          creatorId: owner,
          status:
            outcome === 'missing'
              ? 'missing_evidence'
              : outcome === 'mismatch'
                ? 'awaiting_confirmation'
                : 'completed',
          notificationState: 'inbox',
          summary,
          events: [
            { at: at(49 - index * 6 - offset * 3), text: `开始跟进${creator}创建的「${title}」。` },
            { at: time, text: summary }
          ],
          completedAt: outcome === 'passed' || outcome === 'acknowledged' ? time : undefined,
          outcome: outcome === 'missing' ? undefined : outcome,
          estimatedDurationSeconds: minutes == null ? undefined : minutes * 60
        }
      }
    )
    const content = `培训师${creator}连续 3 次课件预计学习时长不符合 10–20 分钟要求：${entries.map((entry) => `「${entry.title}」${(entry.estimatedDurationSeconds ?? 0) / 60} 分钟`).join('；')}。已形成飞书汇报，收件人为任务创建人${creator}。`
    return {
      id,
      subject: 'courseware',
      mode: 'continuous',
      name: definition.name,
      question: `关注标题包含“${definition.keyword}”的课件，预计学习时长应为 10–20 分钟；不符时提醒本人，连续三次不符向任务创建人汇报。`,
      scope: 'title_keyword',
      titleFilter: definition.keyword,
      minDurationMinutes: 10,
      maxDurationMinutes: 20,
      remind: true,
      reportRequested: true,
      createdAt: at(72 + index * 24),
      subscribedAt: clock.toISOString(),
      enabled: definition.enabled,
      entries,
      ignoredIds: [],
      ownerUserId: owner,
      trainerFailures: index === 0 ? { [owner]: 3 } : {},
      escalations:
        index === 0
          ? [
              {
                id: `${id}:report`,
                creatorId: owner,
                consecutiveFailures: 3,
                status: 'simulated',
                content,
                reason: content,
                at: at(42),
                recipientUserId: owner
              }
            ]
          : []
    }
  })
  tasks.push({
    id: `business-seed-v2:${encodeURIComponent(owner)}:${encodeURIComponent(actor.role)}:query`,
    subject: 'courseware',
    mode: 'once',
    name: '新品课件时长核对',
    question: '查询新品课件预计学习时长，5到10分钟合格',
    scope: 'title_keyword',
    titleFilter: '新品',
    minDurationMinutes: 5,
    maxDurationMinutes: 10,
    remind: false,
    reportRequested: false,
    enabled: false,
    createdAt: at(24),
    subscribedAt: at(24),
    completedAt: at(24),
    entries: [],
    ignoredIds: [],
    trainerFailures: {},
    escalations: [],
    ownerUserId: owner,
    queryResult: {
      status: 'complete',
      summary:
        '已查询 3 件新品课件，预计学习时长均符合 5–10 分钟要求。本次查询已完成，不持续关注后续事件。',
      columns: [
        { key: 'title', label: '课件' },
        { key: 'duration', label: '预计学习时长（分钟）' },
        { key: 'result', label: '核验结果' }
      ],
      rows: tasks[0].entries.map((entry) => ({
        title: entry.title,
        duration: entry.estimatedDurationSeconds! / 60,
        result: '符合时长要求'
      })),
      tools: [
        { key: 'courseware.duration', label: '核验预计学习时长', detail: '合格范围为 5–10 分钟' }
      ],
      evidence: ['依据已有新品课件核验记录中的产物预计学习时长。']
    }
  })
  const prefix = `business-seed-v3:${encodeURIComponent(owner)}:${encodeURIComponent(actor.role)}`
  const training: CoursewareInspectionTask = {
    id: `${prefix}:training`,
    subject: 'training',
    mode: 'continuous',
    name: '南区新品培训达标监督',
    question: '持续监督南区李欣今后新增的新品培训，完课且至少80分；不合规提醒本人，连续3次汇报。',
    scope: 'current_account',
    region: '南区',
    person: '李欣',
    product: '新品',
    timeMode: 'ongoing',
    minScore: 80,
    requireCourseCompleted: true,
    remind: true,
    reportRequested: true,
    enabled: true,
    createdAt: at(48),
    subscribedAt: clock.toISOString(),
    ownerUserId: owner,
    ignoredIds: [],
    trainerFailures: { 'li-xin': 1 },
    escalations: [],
    entries: [
      {
        id: `${prefix}:training:entry`,
        generationTaskId: -30001,
        source: 'training',
        title: '新品精华应用培训',
        creator: '李欣',
        creatorId: 'li-xin',
        person: '李欣',
        region: '南区',
        product: '新品',
        checkedAt: at(2),
        score: 72,
        courseCompleted: false,
        status: 'awaiting_confirmation',
        notificationState: 'inbox',
        outcome: 'mismatch',
        summary: '李欣尚未完成课程，考核72分，未达到完课且80分标准，等待确认提醒。',
        events: [
          { at: at(3), text: '已检测到南区李欣的新品精华应用培训记录。' },
          { at: at(2), text: '尚未完课，考核72分；已形成本人提醒，连续第一次未达标。' }
        ]
      }
    ]
  }
  const finishedTraining = JSON.parse(JSON.stringify(training)) as CoursewareInspectionTask
  finishedTraining.id = `${prefix}:training-ended`
  finishedTraining.name = '南区新品首批培训复核'
  finishedTraining.enabled = false
  finishedTraining.completedAt = at(1)
  finishedTraining.entries.forEach((entry) => {
    entry.id = `${finishedTraining.id}:entry`
    entry.completedAt = at(1)
    entry.status = 'completed'
    entry.outcome = 'acknowledged'
    entry.summary = '李欣已确认提醒，处理记录已归档。'
    entry.events.push({ at: at(1), text: entry.summary })
  })
  const finishedCourseware = JSON.parse(JSON.stringify(tasks[1])) as CoursewareInspectionTask
  finishedCourseware.id = `${prefix}:courseware-ended`
  finishedCourseware.name = '敏感肌首批课件复核'
  finishedCourseware.enabled = false
  finishedCourseware.completedAt = at(1)
  const trainingQuery: CoursewareInspectionTask = {
    ...JSON.parse(JSON.stringify(training)),
    id: `${prefix}:training-query`,
    name: '南区李欣新品培训核对',
    question: '查询截至当前南区李欣的新品培训情况，按完课且至少80分标准核验。',
    mode: 'once',
    timeMode: 'current',
    remind: false,
    reportRequested: false,
    enabled: false,
    entries: [],
    trainerFailures: {},
    completedAt: at(1),
    queryResult: {
      status: 'complete',
      summary: '已查询南区李欣1项新品培训：未完课，考核72分，未达到完课且80分标准。',
      columns: [
        { key: 'person', label: '受训人' },
        { key: 'region', label: '地区' },
        { key: 'product', label: '产品' },
        { key: 'courseCompleted', label: '完课情况' },
        { key: 'score', label: '成绩' },
        { key: 'result', label: '核验结果' }
      ],
      rows: [
        {
          person: '李欣',
          region: '南区',
          product: '新品',
          courseCompleted: '未完课',
          score: 72,
          result: '未达标'
        }
      ],
      tools: [
        { key: 'training.read', label: '读取培训记录', detail: '按地区、人员、产品和时间核验' }
      ],
      evidence: ['依据培训记录中的完课状态和考核成绩，合格标准为完课且至少80分。']
    }
  }
  const additions = [training, trainingQuery, finishedTraining, finishedCourseware]
  const completedQueries = [tasks[4], trainingQuery].map((original, index) => {
    const task = JSON.parse(JSON.stringify(original)) as CoursewareInspectionTask
    task.id = `business-seed-v4:${encodeURIComponent(owner)}:${encodeURIComponent(actor.role)}:query:${index}`
    task.name = index === 0 ? '新品课件质量核查' : '南区培训进度核查'
    task.question =
      index === 0
        ? '查询当前标题包含“新品”的课件，核验预计学习时长是否为5到10分钟。'
        : '查询截至现在南区李欣的新品培训，核验是否完课且至少80分。'
    task.createdAt = at(index === 0 ? 3 : 1)
    task.subscribedAt = task.createdAt
    task.timeMode = 'current'
    delete task.completedAt
    if (index === 1) {
      task.queryResult!.columns.splice(3, 0, { key: 'checkedAt', label: '培训记录时间' })
      task.queryResult!.rows[0].checkedAt = training.entries[0].checkedAt!
    }
    task.requestPlan = {
      question: task.question,
      name: task.name,
      mode: 'once',
      subject: task.subject,
      metric: index === 0 ? 'duration' : 'training',
      keyword: task.titleFilter,
      coursewareScopeConfirmed: index === 0,
      minDurationMinutes: task.minDurationMinutes,
      maxDurationMinutes: task.maxDurationMinutes,
      region: task.region,
      person: task.person,
      product: task.product,
      timeMode: 'current',
      minScore: task.minScore,
      requireCourseCompleted: task.requireCourseCompleted,
      remind: false,
      reportRequested: false,
      ready: true,
      summary: task.question,
      tools: task.queryResult!.tools
    }
    const summary = '查询条件已确认，正在读取范围内的记录。'
    task.entries = [
      {
        id: `${task.id}:reading`,
        generationTaskId: -40001 - index,
        source: 'presentation',
        presentationStage: 0,
        title: task.name,
        creator,
        creatorId: owner,
        status: 'checking',
        summary,
        events: [{ at: task.createdAt, text: summary }]
      }
    ]
    completeInspectionQueryFixture(
      task,
      task.queryResult!,
      new Date(Date.parse(task.createdAt) + 4000).toISOString()
    )
    return task
  })
  return [
    ...(previousVersion >= 2
      ? []
      : previousVersion >= 1
        ? tasks.filter((task) => task.mode === 'once')
        : tasks),
    ...(previousVersion >= 3 ? [] : additions),
    ...(previousVersion >= 4 ? [] : completedQueries)
  ]
}
