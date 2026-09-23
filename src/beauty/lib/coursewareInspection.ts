import { computed, effectScope, reactive, readonly, ref, watch, type DeepReadonly } from 'vue'
import type { InspectionRequestPlan } from './inspectionRequest'
import {
  inspectionDateInRange,
  inspectionRangeActive,
  inspectionRangeExpired
} from './inspectionTime'
import { inspectionEvaluation } from './inspectionEvaluation'
export { inspectionEvaluation } from './inspectionEvaluation'
import {
  trainingScopeValid,
  matchesTrainingScope,
  trainingOutcome,
  type TrainingScope,
  type TrainingRecord
} from './trainingInspection'
import { advanceInspectionPresentation } from './inspectionPresentation'
import { archiveLegacyInspectionQueryFixtures } from './coursewareInspectionFixtures'
import {
  assertQueryPlan,
  queryCurrentCourseware,
  type InspectionQueryResult
} from './inspectionQuery'
import type { CoursewareGenerationTaskVO } from '@/api/courseware'
import {
  isCoursewareTaskActive,
  isCoursewareTaskFailed,
  isCoursewareTaskResultReady,
  isCoursewareTaskSucceeded
} from '@/views/courseware/create/generationTask'

export interface CoursewareInspectionIdentity {
  userId: string | number
  role: string
  displayName?: string
}
export interface CoursewareInspectionRules extends TrainingScope {
  subject?: 'courseware' | 'training'
  requestPlan?: DeepReadonly<InspectionRequestPlan>
  name: string
  question: string
  scope: 'current_account' | 'title_keyword'
  titleFilter?: string
  minDurationMinutes?: number
  maxDurationMinutes?: number
  remind: boolean
  reportRequested: boolean
}
export type CoursewareInspectionStatus =
  'generating' | 'checking' | 'awaiting_confirmation' | 'missing_evidence' | 'completed' | 'failed'
export interface CoursewareInspectionEntry {
  evaluatedOutcome?: 'passed' | 'mismatch' | 'missing'
  source?: 'presentation' | 'training'
  presentationStage?: number
  region?: string
  product?: string
  person?: string
  score?: number
  courseCompleted?: boolean
  checkedAt?: string
  id: string
  generationTaskId: number
  /** 后端生成作业身份，snapshotVersion 只是状态版本，不是产物版本。 */
  externalTaskId?: string
  productKey?: string
  childJobId?: string
  coursewareId?: number
  title: string
  creator: string
  creatorId?: string
  status: CoursewareInspectionStatus
  /** 初始历史待办只进入任务收件箱；新生产者事件默认弹窗。 */
  notificationState?: 'inbox'
  summary: string
  events: Array<{ at: string; text: string; tool?: string; input?: string; output?: string }>
  completedAt?: string
  outcome?: 'passed' | 'mismatch' | 'acknowledged' | 'stopped'
  /** 内部幂等状态；UI 只读。 */
  fingerprint?: string
  version?: number
  retired?: boolean
  estimatedDurationSeconds?: number
}
export interface CoursewareInspectionTask extends CoursewareInspectionRules {
  id: string
  presentationSequence?: number
  mode?: 'once' | 'continuous'
  completedAt?: string
  queryResult?: InspectionQueryResult
  /** 仅兼容旧查询存储；新查询实际读取完成后才保存，不创建在途任务。 */
  queryPending?: boolean
  /** 保留旧查询读取后的原始字段，不含最终核验结论或汇报。 */
  queryIntermediate?: Pick<InspectionQueryResult, 'columns' | 'rows'>
  /** 仅用于归档旧内置查询，不能据此完成真实用户的在途请求。 */
  pendingQueryResult?: InspectionQueryResult
  requestPlan?: InspectionRequestPlan
  demoScenario?: 'escalation' | 'recovery'
  /** 修改规则后预设演示不可续播。 */
  demoInvalidated?: boolean
  createdAt: string
  enabled: boolean
  entries: CoursewareInspectionEntry[]
  subscribedAt: string
  ignoredIds: number[]
  ignoredProductKeys?: string[]
  trainerFailures: Record<string, number>
  presentationFailures?: Record<string, number>
  escalations: Array<{
    source?: 'presentation' | 'business'
    id: string
    creatorId: string
    consecutiveFailures: number
    status: 'blocked' | 'simulated'
    content?: string
    reason: string
    at: string
    recipientUserId: string
  }>
  ownerUserId: string
}
/** 使用后端课件 metadata 的预计学习时长；生成目标和网络耗时均不合法。 */
export interface CoursewareInspectionEvidence {
  creatorId?: string | number
  creatorName?: string
  estimatedDurationSeconds?: number
  source?: string
}
/** 内部产物标识不扩充后端 DTO，也不把状态版本当作新产物。 */
export interface CoursewareInspectionSnapshot extends CoursewareGenerationTaskVO {
  productKey?: string
  childJobId?: string
}
export function expandCoursewareInspectionSnapshots(
  dto: CoursewareInspectionSnapshot
): CoursewareInspectionSnapshot[] {
  if (!dto.series?.items.length) return [dto]
  return dto.series.items.map((item) => {
    const coursewareId = item.resultCoursewareId ?? item.coursewareId
    return {
      ...dto,
      series: undefined,
      productKey: coursewareId ? `courseware:${coursewareId}` : `child:${item.childJobId}`,
      childJobId: item.childJobId,
      title: item.title,
      coursewareId,
      resultCoursewareId: coursewareId,
      status: item.status,
      done: isCoursewareTaskSucceeded(item.status) && Boolean(coursewareId),
      homeworkGenerationStatus: item.homeworkGenerationStatus,
      errorMessage: item.error
    }
  })
}
interface Bucket {
  tasks: CoursewareInspectionTask[]
  knownIds: number[]
  seedVersion?: number
}
interface RuntimeOptions {
  identity: () => CoursewareInspectionIdentity | undefined
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  now?: () => Date
  /** demo 仅生成本地模拟回执，永远不发送网络请求。 */
  mode?: 'demo' | 'blocked'
  /** 产品入口显式启用；纯状态机和控制器不自动添加任务。 */
  seed?: {
    version: number
    create: (
      actor: CoursewareInspectionIdentity,
      now: Date,
      previousVersion?: number
    ) => CoursewareInspectionTask[]
  }
}

export function createCoursewareInspectionRuntime(options: RuntimeOptions) {
  const buckets = reactive(new Map<string, Bucket>())
  const storageError = ref('')
  const now = () => (options.now?.() ?? new Date()).toISOString()
  let serial = 0
  const key = () => {
    const actor = options.identity()
    return actor && actor.userId && actor.role
      ? `courseware:inspection:v1:${encodeURIComponent(String(actor.userId))}:${encodeURIComponent(actor.role)}`
      : undefined
  }
  // 字符串身份相同不足以识别 A→B→A；同步观察每次身份变更使在途查询失效。
  let identityVersion = 0
  const identityWatcher = effectScope(true)
  identityWatcher.run(() =>
    watch(
      key,
      () => {
        identityVersion++
      },
      { flush: 'sync' }
    )
  )
  const bucket = (): Bucket | undefined => {
    const scope = key()
    if (!scope) return undefined
    if (!buckets.has(scope)) {
      let saved: Bucket = { tasks: [], knownIds: [] }
      try {
        const raw = options.storage?.getItem(scope)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (!validBucket(parsed)) throw new Error('invalid storage')
          saved = parsed
          for (const task of saved.tasks)
            for (const entry of task.entries) entry.evaluatedOutcome = inspectionEvaluation(entry)
          if (options.mode === 'demo') {
            for (const task of saved.tasks) {
              // 修正旧内置查询样本误带的监督问句，不改动用户自建或已编辑内容。
              if (
                task.id.startsWith('business-seed-v3:') &&
                task.id.endsWith(':training-query') &&
                task.mode === 'once' &&
                task.question ===
                  '持续监督南区李欣今后新增的新品培训，完课且至少80分；不合规提醒本人，连续3次汇报。'
              ) {
                task.question = '查询截至当前南区李欣的新品培训情况，按完课且至少80分标准核验。'
              }
              for (const receipt of task.escalations) {
                if (receipt.status === 'simulated') {
                  receipt.reason = businessText(receipt.reason)
                  if (receipt.content) receipt.content = businessText(receipt.content)
                  continue
                }
                receipt.status = 'simulated'
                receipt.reason = `培训师 ${receipt.creatorId} 连续三次课件预计学习时长不合规，已形成飞书汇报，收件人为任务创建人 ${receipt.recipientUserId}。具体核验依据见课件记录。`
                receipt.content = receipt.reason
              }
              for (const entry of task.entries) {
                entry.summary = businessText(entry.summary)
                for (const event of entry.events) {
                  event.text = businessText(event.text)
                  if (event.text.includes('汇报受阻'))
                    event.text = '已达到连续第三次不合规汇报条件，已形成发给任务创建人的飞书汇报。'
                }
              }
            }
          }
        }
      } catch {
        storageError.value = '课件监督记录无法读取；当前会话可继续使用。'
      }
      const archivedQueries = archiveLegacyInspectionQueryFixtures(
        saved.tasks,
        options.identity()!,
        new Date(now())
      )
      if (options.seed && (saved.seedVersion ?? 0) < options.seed.version) {
        const existingIds = new Set(saved.tasks.map((task) => task.id))
        saved.tasks.push(
          ...options.seed
            .create(options.identity()!, new Date(now()), saved.seedVersion ?? 0)
            .filter((task) => !existingIds.has(task.id))
        )
        saved.seedVersion = options.seed.version
      }
      for (const task of saved.tasks)
        for (const entry of task.entries) entry.evaluatedOutcome = inspectionEvaluation(entry)
      buckets.set(scope, saved)
      // 初次读取即保存版本，刷新不得补回被修改、暂停或签收的样本。
      if (options.seed || options.mode === 'demo' || archivedQueries) {
        try {
          options.storage?.setItem(scope, JSON.stringify(saved))
        } catch {
          storageError.value = '课件监督记录未能保存，刷新后可能丢失。'
        }
      }
    }
    const current = buckets.get(scope)!
    let expired = false
    for (const task of current.tasks) {
      if (
        task.mode !== 'once' &&
        !task.presentationFailures &&
        task.entries.some((entry) => entry.source === 'presentation')
      ) {
        task.presentationFailures = {}
        task.trainerFailures = {}
        for (const entry of task.entries) {
          if (!entry.creatorId) continue
          const outcome = inspectionEvaluation(entry)
          if (!outcome) continue
          const failures =
            entry.source === 'presentation' ? task.presentationFailures : task.trainerFailures
          failures[entry.creatorId] =
            outcome === 'mismatch' ? (failures[entry.creatorId] ?? 0) + 1 : 0
        }
      }
      if (
        task.mode === 'once' ||
        task.completedAt ||
        !inspectionRangeExpired(task, new Date(now()))
      )
        continue
      task.enabled = false
      task.completedAt = now()
      for (const entry of task.entries) {
        if (entry.completedAt || entry.retired) continue
        entry.evaluatedOutcome = inspectionEvaluation(entry)
        entry.outcome = 'stopped'
        entry.retired = true
        entry.status = 'completed'
        entry.completedAt = now()
        entry.summary = '监督日期范围已结束，本事项停止跟进；保留已有核验记录。'
        entry.events.push({ at: now(), text: entry.summary })
      }
      expired = true
    }
    if (expired) {
      try {
        options.storage?.setItem(scope, JSON.stringify(current))
      } catch {
        storageError.value = '监督到期状态未能保存。'
      }
    }
    return current
  }
  const persist = () => {
    const scope = key()
    if (!scope) return
    try {
      options.storage?.setItem(scope, JSON.stringify(bucket()))
    } catch {
      storageError.value = '课件监督记录未能保存，刷新后可能丢失。'
    }
  }
  const tasks = computed(() => readonly(bucket()?.tasks ?? []))
  const productTasks = computed(() => tasks.value.filter((task) => !task.demoScenario))
  const findTask = (id: string) => bucket()?.tasks.find((task) => task.id === id)
  const addEvent = (
    entry: CoursewareInspectionEntry,
    text: string,
    status: CoursewareInspectionStatus
  ) => {
    entry.status = status
    entry.summary = text
    entry.events.push({ at: now(), text })
  }
  const retire = (task: CoursewareInspectionTask, reason: string) => {
    for (const entry of task.entries) {
      if (
        !entry.completedAt &&
        !entry.retired &&
        !(entry.source === 'presentation' && reason.includes('暂停'))
      ) {
        addEvent(entry, reason, 'completed')
        entry.retired = true
        entry.evaluatedOutcome = inspectionEvaluation(entry)
        entry.outcome = 'stopped'
        entry.completedAt = now()
      }
    }
    task.ignoredIds = [...new Set([...task.ignoredIds, ...(bucket()?.knownIds ?? [])])]
    task.subscribedAt = now()
  }
  function createTask(
    input: CoursewareInspectionRules & { confirmed: true; demoScenario?: 'escalation' | 'recovery' }
  ): string {
    validateRules(input)
    if (inspectionRangeExpired(input, new Date(now())))
      throw new Error('监督日期范围已结束，请改为一次查询或今后新增')
    if (input.subject === 'training' && input.timeMode === 'current')
      throw new Error('持续监督请明确之后新增或日期范围')
    const current = bucket()
    if (!current) throw new Error('请先登录并确认当前角色')
    const id = globalThis.crypto?.randomUUID?.() ?? `inspection-${Date.now()}-${++serial}`
    current.tasks.push({
      ...rules(input),
      requestPlan: input.requestPlan ? JSON.parse(JSON.stringify(input.requestPlan)) : undefined,
      mode: 'continuous',
      demoScenario: input.demoScenario,
      id,
      createdAt: now(),
      subscribedAt: now(),
      enabled: true,
      entries: [],
      ignoredIds: [...current.knownIds],
      trainerFailures: {},
      escalations: [],
      ownerUserId: String(options.identity()!.userId)
    })
    persist()
    return id
  }
  function updateTask(id: string, input: CoursewareInspectionRules & { confirmed: true }) {
    validateRules(input)
    if (inspectionRangeExpired(input, new Date(now())))
      throw new Error('监督日期范围已结束，请改为一次查询或今后新增')
    const task = findTask(id)
    if (!task || task.mode === 'once' || task.completedAt) return false
    retire(task, '监督规则已修改；旧规则停止跟进，本事项未作达标结论。新规则仅用于之后的新课件。')
    Object.assign(task, rules(input))
    if (task.demoScenario) task.demoInvalidated = true
    task.trainerFailures = {}
    task.presentationFailures = {}
    persist()
    return true
  }
  function pauseTask(id: string) {
    const task = findTask(id)
    if (!task || task.mode === 'once' || task.completedAt || !task.enabled) return false
    task.enabled = false
    retire(task, '监督已暂停，本事项停止跟进；暂停期间不会处理或补发提醒。')
    persist()
    return true
  }
  function resumeTask(id: string) {
    const task = findTask(id)
    if (!task || task.mode === 'once' || task.completedAt || task.enabled) return false
    task.subscribedAt = now()
    task.ignoredIds = [...new Set([...task.ignoredIds, ...(bucket()?.knownIds ?? [])])]
    task.enabled = true
    persist()
    return true
  }
  function acknowledge(taskId: string, entryId: string) {
    const task = findTask(taskId)
    const entry = task?.entries.find((item) => item.id === entryId)
    if (
      !task?.enabled ||
      !entry ||
      entry.source === 'presentation' ||
      entry.retired ||
      entry.status !== 'awaiting_confirmation'
    )
      return false
    addEvent(entry, '当前账号本人已确认知晓不合规提醒；此确认不代表已整改或达标。', 'completed')
    entry.outcome = 'acknowledged'
    entry.completedAt = now()
    persist()
    return true
  }
  function recordOutcome(
    task: CoursewareInspectionTask,
    entry: CoursewareInspectionEntry,
    mismatch: boolean
  ) {
    entry.evaluatedOutcome = mismatch ? 'mismatch' : 'passed'
    const creatorId = entry.creatorId!
    const source = entry.source === 'presentation' ? 'presentation' : 'business'
    const failures =
      source === 'presentation' ? (task.presentationFailures ??= {}) : task.trainerFailures
    const count = mismatch ? (failures[creatorId] ?? 0) + 1 : 0
    failures[creatorId] = count
    if (
      count !== 3 ||
      !task.reportRequested ||
      task.escalations.some(
        (item) =>
          item.creatorId === creatorId &&
          (item.source ??
            (task.entries.find((entry) => `${entry.id}:escalation` === item.id)?.source ===
            'presentation'
              ? 'presentation'
              : 'business')) === source
      )
    )
      return
    const simulated = options.mode === 'demo' || Boolean(task.demoScenario)
    const evidence = task.entries
      .filter(
        (item) =>
          item.creatorId === creatorId &&
          (item.source === 'presentation' ? 'presentation' : 'business') === source &&
          inspectionEvaluation(item) === 'mismatch'
      )
      .slice(-3)
    const content = `${task.subject === 'training' ? '受训人' : '培训师'} ${entry.creator}（${creatorId}）本轮连续 3 次${task.subject === 'training' ? '培训未达标' : '课件预计学习时长不合规'}。证据：${evidence.map((item) => (task.subject === 'training' ? `「${item.title}」${item.courseCompleted ? '已完课' : '未完课'}，成绩${item.score}分` : `「${item.title}」预计学习时长 ${Number(((item.estimatedDurationSeconds ?? 0) / 60).toFixed(2))} 分钟`)).join('；')}。收件人：监督任务创建人（${task.ownerUserId}）。已形成飞书汇报。`
    task.escalations.push({
      id: `${entry.id}:escalation`,
      source,
      creatorId,
      consecutiveFailures: count,
      recipientUserId: task.ownerUserId,
      at: now(),
      status: simulated ? 'simulated' : 'blocked',
      content: simulated ? content : undefined,
      reason: simulated
        ? content
        : '同一培训师连续三次预计学习时长不合规，已达到向监督任务创建人汇报条件。'
    })
    if (entry.source !== 'presentation')
      entry.events.push({
        at: now(),
        text: simulated ? content : '已检测到该培训师连续第三次不合规，待向监督任务创建人汇报。'
      })
  }
  function processCoursewareSnapshot(
    dto?: CoursewareInspectionSnapshot,
    evidence?: CoursewareInspectionEvidence,
    targetTaskId?: string
  ) {
    const current = bucket()
    if (!current || !dto || !Number.isSafeInteger(dto.id)) return
    if (dto.series?.items.length) {
      for (const task of current.tasks) {
        if (task.subject === 'training') continue
        if (targetTaskId ? task.id !== targetTaskId : task.demoScenario) continue
        if (
          task.mode === 'once' ||
          task.completedAt ||
          !task.enabled ||
          task.ignoredIds.includes(dto.id)
        )
          continue
        const container = task.entries.find(
          (entry) => entry.generationTaskId === dto.id && !entry.productKey && !entry.completedAt
        )
        if (container) {
          addEvent(
            container,
            '生成任务已拆分为多个课件，接下来分别核验每个子课件；本条仅记录拆分，不作达标结论。',
            'completed'
          )
          container.completedAt = now()
          container.outcome = 'stopped'
          container.retired = true
        }
      }
      for (const child of expandCoursewareInspectionSnapshots(dto))
        processCoursewareSnapshot(child, evidence, targetTaskId)
      return
    }
    // 仅记录观察边界，不生成任务、条目、通知或网络请求。
    if (!targetTaskId && !current.knownIds.includes(dto.id)) current.knownIds.push(dto.id)
    if (!current.tasks.length) return
    for (const task of current.tasks) {
      if (task.subject === 'training') continue
      if (targetTaskId ? task.id !== targetTaskId : task.demoScenario) continue
      if (task.mode === 'once' || task.completedAt) continue
      if (
        task.timeMode === 'range' &&
        (!inspectionRangeActive(task, new Date(now())) ||
          inspectionDateInRange(dto.createTime, task) !== true)
      )
        continue
      if (!task.enabled) {
        if (!task.ignoredIds.includes(dto.id)) task.ignoredIds.push(dto.id)
        continue
      }
      if (task.ignoredIds.includes(dto.id)) continue
      const productBoundary = `${dto.id}:${dto.externalTaskId ?? 'initial'}:${dto.childJobId ?? dto.productKey ?? 'single'}`
      if (task.ignoredProductKeys?.includes(productBoundary)) continue
      let entry = [...task.entries]
        .reverse()
        .find(
          (item) =>
            item.generationTaskId === dto.id &&
            (dto.productKey
              ? item.productKey === dto.productKey ||
                Boolean(dto.childJobId && item.childJobId === dto.childJobId)
              : !item.productKey) &&
            (!dto.externalTaskId ||
              !item.externalTaskId ||
              item.externalTaskId === dto.externalTaskId)
        )
      if (entry && !entry.externalTaskId && dto.externalTaskId)
        entry.externalTaskId = dto.externalTaskId
      if (!entry) {
        const created = dto.createTime ? new Date(dto.createTime).getTime() : NaN
        if (
          (!isCoursewareTaskActive(dto.status) &&
            !(Number.isFinite(created) && created > Date.parse(task.subscribedAt)) &&
            !(
              dto.productKey &&
              task.entries.some((item) => item.generationTaskId === dto.id && !item.productKey)
            )) ||
          (Number.isFinite(created) && created < Date.parse(task.subscribedAt))
        ) {
          if (dto.productKey) (task.ignoredProductKeys ??= []).push(productBoundary)
          else task.ignoredIds.push(dto.id)
          continue
        }
        if (
          evidence?.creatorId != null &&
          String(evidence.creatorId) !== String(options.identity()?.userId)
        ) {
          if (dto.productKey) (task.ignoredProductKeys ??= []).push(productBoundary)
          else task.ignoredIds.push(dto.id)
          continue
        }
        if (
          task.scope === 'title_keyword' &&
          !dto.title?.toLocaleLowerCase().includes(task.titleFilter!.toLocaleLowerCase())
        )
          continue
        entry = {
          id: `${task.id}:${dto.id}:${dto.externalTaskId ?? 'initial'}:${dto.productKey ?? 'single'}`,
          generationTaskId: dto.id,
          externalTaskId: dto.externalTaskId,
          productKey: dto.productKey,
          childJobId: dto.childJobId,
          title: dto.title?.trim() || '未知课件',
          creator: evidence?.creatorName?.trim() || '未知创建人',
          status: 'generating',
          summary: '',
          events: []
        }
        task.entries.push(entry)
        addEvent(
          entry,
          `已检测到${entry.creator}正在生成「${entry.title}」，完成后将核验预计学习时长。`,
          'generating'
        )
      }
      if (entry.retired || entry.completedAt || entry.status === 'awaiting_confirmation') continue
      if (
        dto.snapshotVersion != null &&
        entry.version != null &&
        dto.snapshotVersion < entry.version
      )
        continue
      const fingerprint = JSON.stringify([
        dto.status,
        dto.done,
        dto.step,
        dto.generation?.phase,
        dto.resultCoursewareId,
        dto.coursewareId,
        isCoursewareTaskResultReady(dto),
        evidence
      ])
      if (entry.fingerprint === fingerprint) continue
      entry.fingerprint = fingerprint
      entry.version = dto.snapshotVersion ?? entry.version
      entry.productKey = dto.productKey ?? entry.productKey
      entry.coursewareId = dto.resultCoursewareId ?? dto.coursewareId
      entry.title = dto.title?.trim() || entry.title
      entry.creator = evidence?.creatorName?.trim() || entry.creator
      entry.creatorId = evidence?.creatorId != null ? String(evidence.creatorId) : entry.creatorId
      if (isCoursewareTaskFailed(dto.status)) {
        addEvent(entry, '生成失败或已取消，不能判定课件达标。', 'failed')
        entry.completedAt = now()
      } else if (isCoursewareTaskResultReady(dto)) {
        if (!entry.events.some((event) => event.text.startsWith('课件已生成完成'))) {
          addEvent(entry, '课件已生成完成，开始核验创建人、课件标识和预计学习时长。', 'checking')
        }
        const duration = evidence?.estimatedDurationSeconds
        const missing: string[] = []
        if (evidence?.creatorId == null) missing.push('创建人身份')
        else if (String(evidence.creatorId) !== String(options.identity()?.userId))
          missing.push('当前账号创建归属（返回创建人为其他账号）')
        if (!entry.coursewareId) missing.push('课件标识')
        const durationRequired = task.minDurationMinutes != null || task.maxDurationMinutes != null
        if (
          durationRequired &&
          (typeof duration !== 'number' ||
            !Number.isFinite(duration) ||
            duration < 0 ||
            !evidence?.source?.trim())
        )
          missing.push('预计学习时长')
        if (missing.length) {
          entry.evaluatedOutcome = 'missing'
          const text = `生成完成，但缺少${missing.join('、')}，暂不能判断是否符合监督条件。`
          if (entry.creatorId) task.trainerFailures[entry.creatorId] = 0
          if (entry.summary !== text) addEvent(entry, text, 'missing_evidence')
          continue
        }
        entry.estimatedDurationSeconds = duration
        if (!durationRequired) {
          entry.evaluatedOutcome = 'missing'
          task.trainerFailures[entry.creatorId!] = 0
          addEvent(
            entry,
            '已记录课件产物；未设置可核验的时长标准，不作时长或内容质量达标结论。',
            'completed'
          )
          entry.completedAt = now()
          continue
        }
        const minutes = (duration ?? 0) / 60
        const mismatch =
          durationRequired &&
          ((task.minDurationMinutes != null && minutes < task.minDurationMinutes) ||
            (task.maxDurationMinutes != null && minutes > task.maxDurationMinutes))
        if (mismatch) {
          entry.outcome = 'mismatch'
          recordOutcome(task, entry, true)
          const text = `已核验预计学习时长 ${Number(minutes.toFixed(2))} 分钟，不符合已确认的时长条件。`
          addEvent(
            entry,
            text +
              (task.remind
                ? '等待本人确认知晓；确认不代表整改达标。'
                : '已记录时长不符，无需本人确认。'),
            task.remind ? 'awaiting_confirmation' : 'completed'
          )
          if (!task.remind) entry.completedAt = now()
        } else {
          entry.outcome = 'passed'
          recordOutcome(task, entry, false)
          addEvent(
            entry,
            durationRequired
              ? `已核验预计学习时长 ${Number(minutes.toFixed(2))} 分钟，符合已确认的时长条件。`
              : '已核验当前账号创建归属，课件生成完成；未设置时长条件，不作时长达标结论。',
            'completed'
          )
          entry.completedAt = now()
        }
      } else if (entry.status === 'generating') {
        const stage = dto.generation?.phase ?? dto.step
        const descriptions: Record<string, string> = {
          sources: '正在处理课件素材',
          interview: '等待补充生成要求',
          plan: '正在整理课件方案',
          outline: '正在准备课件大纲',
          pages: '正在生成课件页面',
          generating_scenes: '正在生成课件页面',
          generating_media: '正在生成课件媒体',
          generating_tts: '正在生成课件讲解语音',
          finalizing: '正在保存生成结果',
          persisting: '正在保存生成结果'
        }
        const text =
          stage && descriptions[stage] ? `生成状态更新：${descriptions[stage]}。` : undefined
        if (text && entry.summary !== text) addEvent(entry, text, 'generating')
      }
    }
    persist()
  }
  function processTrainingRecord(record: TrainingRecord, targetTaskId?: string): boolean {
    let changed = false
    for (const task of bucket()?.tasks ?? []) {
      if (
        task.subject !== 'training' ||
        !task.enabled ||
        task.completedAt ||
        task.mode === 'once' ||
        (targetTaskId && targetTaskId !== task.id) ||
        !inspectionRangeActive(task, new Date(now())) ||
        !matchesTrainingScope(record, task, new Date(now())) ||
        Date.parse(record.checkedAt) < Date.parse(task.subscribedAt)
      )
        continue
      const id = `${task.id}:training:${record.id}`
      if (task.entries.some((entry) => entry.id === id)) continue
      const entry: CoursewareInspectionEntry = {
        id,
        generationTaskId: -Date.parse(record.checkedAt),
        source: 'training',
        title: record.title,
        creator: record.person,
        creatorId: record.personId,
        person: record.person,
        region: record.region,
        product: record.product,
        checkedAt: record.checkedAt,
        score: record.score,
        courseCompleted: record.courseCompleted,
        status: 'checking',
        summary: '',
        events: []
      }
      task.entries.push(entry)
      addEvent(
        entry,
        `已检测到${record.region}${record.person}的${record.product}培训记录「${record.title}」，开始核验。`,
        'checking'
      )
      const outcome = trainingOutcome(record, task)
      if (outcome === 'missing') {
        entry.evaluatedOutcome = 'missing'
        task.trainerFailures[record.personId] = 0
        addEvent(entry, '缺少完整完课或成绩依据，暂不判断，不新增提醒。', 'missing_evidence')
      } else {
        entry.outcome = outcome
        recordOutcome(task, entry, outcome === 'mismatch')
        addEvent(
          entry,
          `${record.person}${record.courseCompleted ? '已完课' : '未完课'}，成绩${record.score}分；${outcome === 'passed' ? '符合已确认标准，不打扰本人。' : task.remind ? '未达标，等待本人确认提醒；确认不代表整改达标。' : '未达标，已记录。'}`,
          outcome === 'mismatch' && task.remind ? 'awaiting_confirmation' : 'completed'
        )
        if (entry.status === 'completed') entry.completedAt = now()
      }
      changed = true
    }
    if (changed) persist()
    return changed
  }
  function advancePresentation(id: string): boolean {
    const task = findTask(id)
    if (
      !task ||
      task.mode === 'once' ||
      task.ownerUserId !== String(options.identity()?.userId) ||
      task.demoScenario
    )
      return false
    const changed = advanceInspectionPresentation(task, now(), recordOutcome, options.identity())
    if (changed) persist()
    return changed
  }
  function briefing(id: string): string {
    const task = findTask(id)
    if (!task) return '未找到当前账号和角色的监督任务。'
    if (task.mode === 'once')
      return task.queryPending && !task.completedAt
        ? (task.entries.find((entry) => entry.source === 'presentation')?.summary ??
            '查询条件已确认，正在读取范围内的记录。')
        : (task.queryResult?.summary ?? '本次查询已结束。')
    if (task.subject === 'training') {
      const checked = task.entries.filter((entry) =>
        ['passed', 'mismatch'].includes(inspectionEvaluation(entry) ?? '')
      )
      const missing = task.entries.filter(
        (entry) => inspectionEvaluation(entry) === 'missing'
      ).length
      const waiting = task.entries.filter(
        (entry) => entry.status === 'awaiting_confirmation'
      ).length
      return `已核验 ${checked.length} 项培训：${checked.filter((entry) => inspectionEvaluation(entry) === 'passed').length} 项达标，${checked.filter((entry) => inspectionEvaluation(entry) === 'mismatch').length} 项未达标。${missing ? `另有 ${missing} 项记录依据不全，暂不判断。` : ''}${task.entries.filter((entry) => !entry.completedAt).length} 项正在处理${waiting ? `，其中 ${waiting} 项等待本人确认` : ''}。${task.completedAt ? '监督已结束。' : task.enabled ? '继续关注已确认范围内的培训记录。' : '监督已暂停。'}${task.escalations.length ? `已形成 ${task.escalations.length} 项向创建人的飞书汇报。` : ''}`
    }
    const qualified = task.entries.filter(
      (entry) => inspectionEvaluation(entry) === 'passed'
    ).length
    const mismatched = task.entries.filter(
      (entry) => inspectionEvaluation(entry) === 'mismatch'
    ).length
    const acknowledged = task.entries.filter((entry) => entry.outcome === 'acknowledged').length
    const generating = task.entries.filter((entry) =>
      ['generating', 'checking'].includes(entry.status)
    ).length
    const checked = task.entries.filter((entry) =>
      ['passed', 'mismatch'].includes(inspectionEvaluation(entry) ?? '')
    ).length
    const reminders = task.entries.filter(
      (entry) => entry.status === 'awaiting_confirmation'
    ).length
    const missing = task.entries.filter((entry) => inspectionEvaluation(entry) === 'missing').length
    const next = task.completedAt
      ? '监督日期范围已结束，不再处理新课件。'
      : !task.enabled
        ? '监督已暂停，不处理新课件。'
        : reminders
          ? `等待本人签收 ${reminders} 项提醒。`
          : missing
            ? `等待 ${missing} 项课件补齐核验资料。`
            : '持续关注新课件，符合要求不打扰。'
    if (!task.entries.length)
      return task.completedAt
        ? '监督日期范围已结束，未收到范围内的课件生成事件。'
        : task.enabled
          ? '监督规则已确认，正在关注新的课件生成事件。收到产物后会核验预计学习时长；不合规才提醒本人，合规不打扰。'
          : '监督已暂停，尚未收到课件生成事件。'
    return `已检查 ${checked} 件课件：${qualified} 件符合时长要求，${mismatched} 件不合规。${acknowledged ? `其中 ${acknowledged} 项提醒已由本人确认知晓，确认不代表达标。` : ''}${generating ? `另有 ${generating} 件正在生成或核验。` : ''}${missing ? `${missing} 件缺少核验依据，暂不作判断。` : ''}${next}${task.escalations.length ? (options.mode === 'demo' || task.demoScenario ? `已形成 ${task.escalations.length} 项连续第三次不合规飞书汇报，收件人为任务创建人。` : `已有 ${task.escalations.length} 项连续第三次不合规汇报待处理。`) : ''}`
  }
  function saveQueryResult(
    plan: InspectionRequestPlan,
    result: InspectionQueryResult,
    confirmation: { confirmed: true; identityKey?: string; identityVersion?: number }
  ): string {
    if (confirmation.confirmed !== true) throw new Error('查询条件必须由本人最终确认')
    assertQueryPlan(plan)
    if (
      confirmation.identityKey != null &&
      (confirmation.identityKey !== key() || confirmation.identityVersion !== identityVersion)
    )
      throw new Error('查询期间账号或角色已切换，请重新执行')
    const current = bucket()
    if (!current) throw new Error('请先登录并确认当前角色')
    const id = globalThis.crypto?.randomUUID?.() ?? `query-${Date.now()}-${++serial}`
    const at = now()
    current.tasks.push({
      id,
      mode: 'once',
      subject: plan.subject,
      region: plan.region,
      person: plan.person,
      product: plan.product,
      timeMode: plan.timeMode,
      startsOn: plan.startsOn,
      endsOn: plan.endsOn,
      minScore: plan.minScore,
      requireCourseCompleted: plan.requireCourseCompleted,
      name: plan.name,
      question: plan.question,
      scope: plan.keyword ? 'title_keyword' : 'current_account',
      titleFilter: plan.keyword,
      minDurationMinutes: plan.minDurationMinutes,
      maxDurationMinutes: plan.maxDurationMinutes,
      remind: false,
      reportRequested: false,
      enabled: false,
      createdAt: at,
      subscribedAt: at,
      completedAt: at,
      ownerUserId: String(options.identity()!.userId),
      entries: [],
      ignoredIds: [],
      trainerFailures: {},
      escalations: [],
      queryResult: JSON.parse(JSON.stringify(result)),
      requestPlan: JSON.parse(JSON.stringify(plan))
    })
    persist()
    return id
  }
  async function executeQuery(
    plan: InspectionRequestPlan,
    confirmation: { confirmed: true },
    executor: (
      plan: InspectionRequestPlan,
      options?: { assertCurrentIdentity?: () => void }
    ) => Promise<InspectionQueryResult> = queryCurrentCourseware
  ): Promise<string> {
    if (confirmation.confirmed !== true) throw new Error('查询条件必须由本人最终确认')
    assertQueryPlan(plan)
    const identityKey = key()
    if (!identityKey) throw new Error('请先登录并确认当前角色')
    const capturedVersion = identityVersion
    const assertCurrentIdentity = () => {
      if (key() !== identityKey || identityVersion !== capturedVersion)
        throw new Error('查询期间账号或角色已切换，请重新执行')
    }
    const capturedPlan = JSON.parse(JSON.stringify(plan)) as InspectionRequestPlan
    const result = await executor(capturedPlan, { assertCurrentIdentity })
    assertCurrentIdentity()
    return saveQueryResult(capturedPlan, result, {
      confirmed: true,
      identityKey,
      identityVersion: capturedVersion
    })
  }
  return {
    tasks,
    dispose: () => identityWatcher.stop(),
    captureQueryContext: () => ({ identityKey: key(), identityVersion }),
    saveQueryResult,
    executeQuery,
    productTasks,
    identityKey: key,
    /** 返回身份副本，不暴露可修改的用户 store。 */
    actor: () => {
      const actor = options.identity()
      return actor ? { ...actor } : undefined
    },
    storageError: readonly(storageError),
    createTask,
    updateTask,
    pauseTask,
    resumeTask,
    processCoursewareSnapshot,
    processTrainingRecord,
    advancePresentation,
    acknowledge,
    briefing
  }
}

/** 只清理旧版本生成的系统措辞，不重写任务名称、用户规则或历史业务证据。 */
function businessText(text: string): string {
  return text
    .replace(/（来源：.*），/g, '，')
    .replace(/飞书演示：模拟发送完成，不实际发送。/g, '已形成飞书汇报。')
    .replace(
      /已加入本机弹窗提醒，等待本人确认知晓；未发送飞书。/g,
      '等待本人确认知晓；确认不代表整改达标。'
    )
    .replace(/后端返回的预计学习时长/g, '预计学习时长')
    .replace(/生成目标时长和请求耗时不作为预计学习时长。/g, '')
    .replace(/未返回创建时间，按订阅后的首次观察纳入。/g, '')
}

function rules(input: CoursewareInspectionRules): CoursewareInspectionRules {
  return {
    subject: input.subject ?? 'courseware',
    region: input.region,
    person: input.person,
    product: input.product,
    timeMode: input.timeMode,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    minScore: input.minScore,
    requireCourseCompleted: input.requireCourseCompleted,
    requestPlan: input.requestPlan ? JSON.parse(JSON.stringify(input.requestPlan)) : undefined,
    name: input.name.trim(),
    question: input.question.trim(),
    scope: input.scope,
    titleFilter: input.titleFilter?.trim(),
    minDurationMinutes: input.minDurationMinutes,
    maxDurationMinutes: input.maxDurationMinutes,
    remind: input.remind,
    reportRequested: input.reportRequested
  }
}
function validateRules(input: CoursewareInspectionRules & { confirmed: true }, stored = false) {
  if (input.confirmed !== true) throw new Error('监督条件必须由本人最终确认')
  if (!input.name?.trim() || !input.question?.trim()) throw new Error('请填写任务名称和监督问题')
  if (!stored && input.subject === 'training' && !trainingScopeValid(input))
    throw new Error('请补齐培训范围、时间和达标标准')
  if (!['current_account', 'title_keyword'].includes(input.scope))
    throw new Error('不支持该监督范围')
  if (input.scope === 'title_keyword' && !input.titleFilter?.trim())
    throw new Error('请填写标题关键词')
  for (const value of [input.minDurationMinutes, input.maxDurationMinutes]) {
    if (value != null && (!Number.isFinite(value) || value < 0))
      throw new Error('时长必须是非负有限数字')
  }
  if (
    input.minDurationMinutes != null &&
    input.maxDurationMinutes != null &&
    input.minDurationMinutes > input.maxDurationMinutes
  )
    throw new Error('最短时长不能大于最长时长')
}
function validBucket(value: any): value is Bucket {
  try {
    return Boolean(
      value &&
      Array.isArray(value.knownIds) &&
      value.knownIds.every(Number.isSafeInteger) &&
      Array.isArray(value.tasks) &&
      value.tasks.every((task: any) => {
        validateRules({ ...task, confirmed: true }, true)
        return (
          typeof task.id === 'string' &&
          typeof task.enabled === 'boolean' &&
          Number.isFinite(Date.parse(task.createdAt)) &&
          Number.isFinite(Date.parse(task.subscribedAt)) &&
          typeof task.ownerUserId === 'string' &&
          task.trainerFailures &&
          Object.values(task.trainerFailures).every(
            (count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
          ) &&
          Array.isArray(task.escalations) &&
          task.escalations.every(
            (item: any) =>
              ['blocked', 'simulated'].includes(item.status) && typeof item.reason === 'string'
          ) &&
          Array.isArray(task.ignoredIds) &&
          task.ignoredIds.every(Number.isSafeInteger) &&
          Array.isArray(task.entries) &&
          task.entries.every(
            (entry: any) =>
              typeof entry.id === 'string' &&
              Number.isSafeInteger(entry.generationTaskId) &&
              Array.isArray(entry.events) &&
              entry.events.every(
                (event: any) => typeof event.text === 'string' && typeof event.at === 'string'
              ) &&
              typeof entry.summary === 'string' &&
              typeof entry.title === 'string' &&
              typeof entry.creator === 'string' &&
              [
                'generating',
                'checking',
                'awaiting_confirmation',
                'missing_evidence',
                'completed',
                'failed'
              ].includes(entry.status)
          )
        )
      })
    )
  } catch {
    return false
  }
}
export type CoursewareInspectionRuntime = ReturnType<typeof createCoursewareInspectionRuntime>
