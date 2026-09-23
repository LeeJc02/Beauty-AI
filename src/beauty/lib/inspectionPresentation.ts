import type {
  CoursewareInspectionTask,
  CoursewareInspectionEntry,
  CoursewareInspectionIdentity
} from './coursewareInspection'
import type { InspectionQueryResult } from './inspectionQuery'
import { inspectionRangeActive } from './inspectionTime'
import { trainingOutcome, trainingData, localDay, type TrainingRecord } from './trainingInspection'

/** 仅补全内置查询快照的历史，不替代真实查询执行，也不参与监督事件流。 */
export function completeInspectionQueryFixture(
  task: CoursewareInspectionTask,
  result: InspectionQueryResult,
  completedAt: string
): boolean {
  if (task.mode !== 'once' || task.completedAt) return false
  const entry = task.entries.find((item) => item.source === 'presentation' && !item.completedAt)
  if (!entry) return false
  const subject = task.subject === 'training' ? '培训' : '课件'
  const toolSubject = task.subject === 'training' ? 'training' : 'courseware'
  const steps = [
    [`${toolSubject}.read`, `已读取本次查询的${subject}记录，正在筛选已确认范围。`],
    [`${toolSubject}.filter`, '已按确认的范围筛选记录，正在核验记录依据。'],
    [`${toolSubject}.check`, '已完成逐项依据核验，正在整理查询汇总。'],
    [`${toolSubject}.summarize`, result.summary]
  ]
  // 保留旧事件及其原文；只追加尚未记录的处理步骤，时间不早于已有历史。
  const remaining = steps.filter(([tool]) => !entry.events.some((event) => event.tool === tool))
  const lastAt = Math.max(
    Date.parse(task.createdAt),
    ...entry.events.map((event) => Date.parse(event.at)).filter(Number.isFinite)
  )
  const finishedAt = Math.max(Date.parse(completedAt), lastAt)
  remaining.forEach(([tool, text], index) => {
    entry.events.push({
      at: new Date(lastAt + ((finishedAt - lastAt) * (index + 1)) / remaining.length).toISOString(),
      text,
      tool,
      input: task.question,
      output: text
    })
  })
  entry.presentationStage = steps.length
  entry.summary = result.summary
  entry.status = 'completed'
  entry.completedAt = new Date(finishedAt).toISOString()
  task.queryResult = result
  delete task.pendingQueryResult
  delete task.queryPending
  task.enabled = false
  task.completedAt = entry.completedAt
  return true
}

/** 可见详情调用的本地业务事件流；不会触及生产者事件。 */
export function advanceInspectionPresentation(
  task: CoursewareInspectionTask,
  now: string,
  recordOutcome: (
    task: CoursewareInspectionTask,
    entry: CoursewareInspectionEntry,
    mismatch: boolean
  ) => void,
  actor?: CoursewareInspectionIdentity
): boolean {
  if (
    !task.enabled ||
    task.completedAt ||
    task.mode === 'once' ||
    !inspectionRangeActive(task, new Date(now))
  )
    return false
  let entry = task.entries.find(
    (item) => item.source === 'presentation' && !item.completedAt && !item.retired
  )
  const event = (text: string, status: CoursewareInspectionEntry['status']) => {
    entry!.events.push({
      at: now,
      text,
      tool: 'inspection.event',
      input: [entry!.region, entry!.person || entry!.creator, entry!.product, entry!.title]
        .filter(Boolean)
        .join(' / '),
      output: text
    })
    entry!.summary = text
    entry!.status = status
  }
  if (!entry) {
    const n = (task.presentationSequence ?? 0) + 1
    task.presentationSequence = n
    const candidate = trainingData(new Date(now)).find(
      (record) =>
        (task.person === '全部' || task.person === record.person) &&
        (task.region === '全部' || task.region === record.region) &&
        (task.product === '全部' || task.product === record.product)
    )
    const person =
      task.subject === 'training'
        ? task.person && task.person !== '全部'
          ? task.person
          : (candidate?.person ?? '李欣')
        : actor?.displayName?.trim() ||
          task.entries.find((item) => item.creatorId === task.ownerUserId)?.creator ||
          '当前账号'
    const creatorId =
      task.subject === 'training'
        ? task.entries.find(
            (item) =>
              item.person === person &&
              item.creatorId &&
              !item.creatorId.startsWith('presentation:')
          )?.creatorId ||
          candidate?.personId ||
          `training-person:${person}`
        : task.ownerUserId
    const product =
      task.product && task.product !== '全部' ? task.product : task.titleFilter || '新品'
    const region =
      task.subject === 'training'
        ? task.region && task.region !== '全部'
          ? task.region
          : candidate?.region || '南区'
        : undefined
    const checkedAt = now
    const variant = n % 6
    const min = task.minDurationMinutes ?? 0
    const max = task.maxDurationMinutes ?? Math.max(min + 10, 20)
    entry = {
      id: `${task.id}:presentation:${n}`,
      generationTaskId: -1000000 - n,
      source: 'presentation',
      presentationStage: 0,
      title: `${product}${task.subject === 'training' ? '产品应用培训' : '知识课件'} · ${n}`,
      creator: person,
      creatorId,
      person,
      region,
      product,
      checkedAt,
      score:
        variant === 5
          ? undefined
          : variant === 4
            ? Math.max(task.minScore ?? 80, 92)
            : Math.max(0, (task.minScore ?? 80) - 8),
      courseCompleted: variant === 4,
      estimatedDurationSeconds:
        variant === 5
          ? undefined
          : (variant === 4 ? (min + max) / 2 : min > 0 ? min / 2 : max + 5) * 60,
      status: 'generating',
      notificationState: 'inbox',
      summary: '',
      events: []
    }
    task.entries.push(entry)
    event(
      `${localDay(new Date(checkedAt))}，${region ?? ''}${person}的「${entry.title}」记录已进入检查范围，产品：${product}。`,
      'generating'
    )
    return true
  }
  const stage = entry.presentationStage ?? 0
  if (stage === 0) {
    event(
      task.subject === 'training'
        ? `正在核验${entry.person}的完课状态与考核成绩。`
        : `正在核验「${entry.title}」的产物预计学习时长。`,
      'checking'
    )
  } else if (stage === 1) {
    const outcome =
      task.subject === 'training'
        ? trainingOutcome({ ...entry, personId: entry.creatorId! } as TrainingRecord, task)
        : (task.minDurationMinutes == null && task.maxDurationMinutes == null) ||
            entry.estimatedDurationSeconds == null
          ? 'missing'
          : (task.minDurationMinutes != null &&
                entry.estimatedDurationSeconds / 60 < task.minDurationMinutes) ||
              (task.maxDurationMinutes != null &&
                entry.estimatedDurationSeconds / 60 > task.maxDurationMinutes)
            ? 'mismatch'
            : 'passed'
    entry.evaluatedOutcome = outcome
    if (outcome === 'missing') {
      ;(task.presentationFailures ??= {})[entry.creatorId!] = 0
      event('核验依据尚不完整，暂不判断、不新增提醒，本轮连续计数中断。', 'missing_evidence')
    } else {
      entry.outcome = outcome
      recordOutcome(task, entry, outcome === 'mismatch')
      event(
        `${task.subject === 'training' ? `完课状态：${entry.courseCompleted ? '已完成' : '未完成'}，成绩 ${entry.score} 分` : `预计学习时长 ${Number((entry.estimatedDurationSeconds! / 60).toFixed(2))} 分钟`}；${outcome === 'passed' ? '符合已确认条件，本轮连续未达标计数清零，不打扰本人。' : `不符合已确认条件，同人本轮连续 ${task.presentationFailures?.[entry.creatorId!] ?? 0} 次未达标。${task.escalations.some((item) => item.id === `${entry!.id}:escalation`) ? '已形成给任务创建人的飞书汇报。' : ''}`}`,
        'checking'
      )
    }
  } else if (stage === 2) {
    event(
      entry.outcome === 'mismatch' && task.remind
        ? `已形成给${entry.person}的提醒，等待对方确认知晓；确认不代表整改达标。`
        : entry.outcome === 'passed'
          ? '检查结果已记录，无需提醒。'
          : entry.status === 'missing_evidence'
            ? '已记录待补齐依据，不作达标结论。'
            : '已按规则记录不合规事项，不提醒本人。',
      entry.outcome === 'mismatch' && task.remind
        ? 'awaiting_confirmation'
        : entry.evaluatedOutcome === 'missing'
          ? 'missing_evidence'
          : 'checking'
    )
  } else if (stage === 3 && entry.outcome === 'mismatch' && task.remind) {
    entry.outcome = 'acknowledged'
    event(`${entry.person}已确认提醒；本次回执仅表示知晓，不代表整改达标。`, 'checking')
  } else {
    event(
      entry.evaluatedOutcome === 'missing'
        ? '缺少核验依据的处理记录已归档，仍不作达标结论。'
        : '本次处理记录已归档，继续关注范围内的新事项。',
      'completed'
    )
    entry.completedAt = now
    const completed = task.entries.filter(
      (item) => item.source === 'presentation' && item.completedAt
    )
    const remove = new Set(
      completed.slice(0, Math.max(0, completed.length - 100)).map((item) => item.id)
    )
    task.entries = task.entries.filter((item) => !remove.has(item.id))
  }
  entry.presentationStage = stage + 1
  return true
}
