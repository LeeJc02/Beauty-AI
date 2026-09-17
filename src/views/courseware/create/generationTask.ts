export const COURSEWARE_TASK_STATUS = {
  WAITING_INTEGRATION: 'WAITING_INTEGRATION',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  WAITING_FOR_CONFIRMATION: 'WAITING_FOR_CONFIRMATION',
  REVIEWING_OUTLINE: 'REVIEWING_OUTLINE',
  SPLITTING_OUTLINE: 'SPLITTING_OUTLINE',
  GENERATING_CHILDREN: 'GENERATING_CHILDREN',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
  UNKNOWN: 'UNKNOWN'
} as const

export type CoursewareTaskStatusKey =
  (typeof COURSEWARE_TASK_STATUS)[keyof typeof COURSEWARE_TASK_STATUS]

export interface CoursewareGenerationQuestionOptionVO {
  id: string
  label: string
  description?: string
  recommended?: boolean
}

export interface CoursewareGenerationQuestionVO {
  id: string
  question: string
  required: boolean
  options?: CoursewareGenerationQuestionOptionVO[]
  recommendedOptionId?: string
  allowCustom?: boolean
}

export interface CoursewareDesignDirectionVO {
  /** 第一个为页面底色，其余为正文/强调色。 */
  palette?: string[]
  typography?: string
  layout?: string
  imagery?: string
  mood?: string
}

export interface CoursewareGenerationPartPlanItemVO {
  partIndex: number
  partCount: number
  title: string
  estimatedDurationSeconds?: number
  outlineCount?: number
}

export interface CoursewareGenerationPartSelectionVO {
  required: boolean
  selectedPartIndexes?: number[]
  parts: CoursewareGenerationPartPlanItemVO[]
}

export interface CoursewareGenerationSummaryVO {
  title?: string
  audience?: string
  objective?: string
  language?: string
  targetDurationMinutes?: number
  deliveryFormat?: string
  style?: Record<string, unknown>
  designDirection?: CoursewareDesignDirectionVO
  assumptions?: string[]
  scope?: {
    mustInclude?: string[]
    mustExclude?: string[]
    optional?: string[]
  }
}

export interface CoursewareGenerationPromptEnhancementVO {
  promptVersion?: string
  modelRole?: string
  clarificationEligible?: boolean
  clarificationRound?: number
  specificationVersion?: string
  renderedPromptTemplateVersion?: string
  questions?: CoursewareGenerationQuestionVO[]
  knownRequirements?: Record<string, unknown>
  assumptions?: string[]
  summary?: CoursewareGenerationSummaryVO
}

export interface CoursewareGenerationResultVO {
  classroomId?: string
  url?: string
  previewUrl?: string
  downloadUrl?: string
  exportUrls?: {
    pptx?: string
    html?: string
    resourcePack?: string
    classroomZip?: string
  }
  scenesCount?: number
}

export interface CoursewareGenerationSeriesItemVO {
  childJobId: string
  coursewareId?: number
  resultCoursewareId?: number
  partIndex: number
  partCount: number
  title: string
  status: number | string
  progress?: number
  retryCount?: number
  classroomId?: string
  previewUrl?: string
  downloadUrl?: string
  estimatedDurationSeconds?: number
  openingContext?: string
  closingSummary?: string
  transitionToNext?: string
  homeworkGenerationStatus?: string
  homeworkGenerationMessage?: string
  error?: string
}

export interface CoursewareGenerationSeriesVO {
  seriesId: string
  title: string
  items: CoursewareGenerationSeriesItemVO[]
}

export interface CoursewareGenerationTaskLike {
  status?: number | string
  step?: string
  progress?: number | string
  done?: boolean
  generateHomeworkSync?: boolean
  homeworkGenerationStatus?: string
  result?: CoursewareGenerationResultVO
  series?: CoursewareGenerationSeriesVO
  partSelection?: CoursewareGenerationPartSelectionVO
  researchSummary?: Record<string, unknown>
  outlineGrouping?: {
    strategy?: string
    partCount?: number
    partDurationsSeconds?: number[]
  }
  promptEnhancement?: CoursewareGenerationPromptEnhancementVO
  sourcePreparation?: {
    status?: string
    error?: string
  }
}

export type CoursewareGenerationStage =
  | 'queued'
  | 'reviewing_outline'
  | 'splitting_outline'
  | 'generating_scenes'
  | 'generating_media'
  | 'generating_tts'
  | 'persisting'
  | 'finalizing'
  | 'completed'
  | 'failed'

const COURSEWARE_STAGE_ALIASES: Record<string, CoursewareGenerationStage> = {
  queued: 'queued',
  reviewing_outline: 'reviewing_outline',
  splitting_outline: 'splitting_outline',
  generating_children: 'generating_scenes',
  generating_scenes: 'generating_scenes',
  generating_media: 'generating_media',
  generating_tts: 'generating_tts',
  persisting: 'persisting',
  finalizing: 'finalizing',
  completed: 'completed',
  succeeded: 'completed',
  failed: 'failed'
}

/** 保留后端 step 的细粒度信息，避免前端把后半程全部显示成“生成中”。 */
export function resolveCoursewareTaskStage(
  task?: Pick<
    CoursewareGenerationTaskLike,
    'status' | 'step' | 'done' | 'generateHomeworkSync' | 'homeworkGenerationStatus'
  > | null
): CoursewareGenerationStage {
  const status = resolveCoursewareTaskStatus(task?.status)
  if (status === COURSEWARE_TASK_STATUS.FAILED || status === COURSEWARE_TASK_STATUS.CANCELED) {
    return 'failed'
  }
  const step = String(task?.step || '')
    .trim()
    .toLowerCase()
  const homeworkStatus = task?.homeworkGenerationStatus?.trim().toLowerCase()
  const homeworkPending =
    task?.generateHomeworkSync === true &&
    task?.done !== true &&
    ['queued', 'running', 'succeeded'].includes(homeworkStatus || '')
  if (homeworkPending && (step === 'completed' || step === 'finalizing' || !step)) {
    return 'finalizing'
  }
  if (COURSEWARE_STAGE_ALIASES[step]) return COURSEWARE_STAGE_ALIASES[step]
  if (status === COURSEWARE_TASK_STATUS.QUEUED) return 'queued'
  if (status === COURSEWARE_TASK_STATUS.SUCCEEDED) return 'completed'
  return 'generating_scenes'
}

export interface CoursewareCreateFormDefaults {
  description: string
  trainingObjective: string
  category: string
  tags: string[]
  knowledgeMaterial: string
  language: string
  style: string
  generateHomeworkSync: boolean
  enableImageGeneration: boolean
  narratorVoiceId?: string
  narratorMinimaxVoiceId?: string
  prompt: string
  outlineEnhancementEnabled: boolean
}

export interface CoursewareRouteQueryLike {
  coursewareId?: string | string[] | null
  taskId?: string | string[] | null
  url?: string | string[] | null
  previewUrl?: string | string[] | null
  shareUrl?: string | string[] | null
  seriesId?: string | string[] | null
  currentPart?: string | string[] | null
}

export interface CoursewareResultState {
  mode: 'none' | 'single-preview' | 'series-list' | 'series-preview'
  previewUrl: string
  downloadUrl: string
  title: string
  series?: CoursewareGenerationSeriesVO
  currentItem?: CoursewareGenerationSeriesItemVO
}

function hasRouteQueryValue(value?: string | string[] | null): boolean {
  return Array.isArray(value) ? value.some(Boolean) : Boolean(value)
}

export function hasCoursewarePreviewRouteQuery(query: CoursewareRouteQueryLike): boolean {
  return [
    query.coursewareId,
    query.taskId,
    query.url,
    query.previewUrl,
    query.shareUrl,
    query.seriesId,
    query.currentPart
  ].some(hasRouteQueryValue)
}

export function createCoursewareFormDefaults(language: string): CoursewareCreateFormDefaults {
  return {
    description: '',
    trainingObjective: '',
    category: '',
    tags: [],
    knowledgeMaterial: '',
    language,
    style: 'interactive',
    generateHomeworkSync: true,
    enableImageGeneration: true,
    narratorVoiceId: undefined,
    narratorMinimaxVoiceId: undefined,
    prompt: '',
    // 系列子课件的承上启下依赖 outline 增强产出的 openingContext/closingSummary/
    // transitionToNext；关闭时只能落到空洞的兜底文案，所以默认开启。
    outlineEnhancementEnabled: true
  }
}

export function withOutlineEnhancementPayload<T extends Record<string, unknown>>(
  payload: T,
  outlineEnhancementEnabled: boolean
): T & { outlineEnhancementEnabled: boolean } {
  return {
    ...payload,
    outlineEnhancementEnabled
  }
}

export function resolveCoursewareTaskStatus(status: unknown): CoursewareTaskStatusKey {
  if (typeof status === 'number') {
    if (status === 0) return COURSEWARE_TASK_STATUS.WAITING_INTEGRATION
    if (status === 10) return COURSEWARE_TASK_STATUS.QUEUED
    if (status === 20) return COURSEWARE_TASK_STATUS.RUNNING
    if (status === 21) return COURSEWARE_TASK_STATUS.WAITING_FOR_USER
    if (status === 22) return COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION
    if (status === 30) return COURSEWARE_TASK_STATUS.SUCCEEDED
    if (status === 40) return COURSEWARE_TASK_STATUS.FAILED
    if (status === 50) return COURSEWARE_TASK_STATUS.CANCELED
    return COURSEWARE_TASK_STATUS.UNKNOWN
  }

  if (typeof status !== 'string') return COURSEWARE_TASK_STATUS.UNKNOWN
  const normalized = status.trim().toLowerCase()
  if (/^\d+$/.test(normalized)) return resolveCoursewareTaskStatus(Number(normalized))
  if (normalized === 'waiting_integration') return COURSEWARE_TASK_STATUS.WAITING_INTEGRATION
  if (normalized === 'queued') return COURSEWARE_TASK_STATUS.QUEUED
  if (normalized === 'running') return COURSEWARE_TASK_STATUS.RUNNING
  if (normalized === 'waiting_for_user') return COURSEWARE_TASK_STATUS.WAITING_FOR_USER
  if (normalized === 'waiting_for_confirmation')
    return COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION
  if (normalized === 'reviewing_outline') return COURSEWARE_TASK_STATUS.REVIEWING_OUTLINE
  if (normalized === 'splitting_outline') return COURSEWARE_TASK_STATUS.SPLITTING_OUTLINE
  if (normalized === 'generating_children') return COURSEWARE_TASK_STATUS.GENERATING_CHILDREN
  if (normalized === 'succeeded') return COURSEWARE_TASK_STATUS.SUCCEEDED
  if (normalized === 'failed') return COURSEWARE_TASK_STATUS.FAILED
  if (normalized === 'canceled' || normalized === 'cancelled')
    return COURSEWARE_TASK_STATUS.CANCELED
  return COURSEWARE_TASK_STATUS.UNKNOWN
}

const DISPLAY_STAGE_STATUS_KEYS: readonly CoursewareTaskStatusKey[] = [
  COURSEWARE_TASK_STATUS.REVIEWING_OUTLINE,
  COURSEWARE_TASK_STATUS.SPLITTING_OUTLINE,
  COURSEWARE_TASK_STATUS.GENERATING_CHILDREN
]

/**
 * The administration service normalizes several OpenMAIC phases to RUNNING
 * but keeps the original phase in `step`. Use that phase for user-facing
 * progress text without changing the task's lifecycle semantics.
 */
export function resolveCoursewareTaskDisplayStatus(
  task?: Pick<CoursewareGenerationTaskLike, 'status' | 'step'>
): CoursewareTaskStatusKey {
  const status = resolveCoursewareTaskStatus(task?.status)
  if (status !== COURSEWARE_TASK_STATUS.RUNNING && status !== COURSEWARE_TASK_STATUS.UNKNOWN) {
    return status
  }

  const stepStatus = resolveCoursewareTaskStatus(task?.step)
  return DISPLAY_STAGE_STATUS_KEYS.includes(stepStatus) ? stepStatus : status
}

const ACTIVE_TASK_STATUS_KEYS: readonly CoursewareTaskStatusKey[] = [
  COURSEWARE_TASK_STATUS.WAITING_INTEGRATION,
  COURSEWARE_TASK_STATUS.QUEUED,
  COURSEWARE_TASK_STATUS.RUNNING,
  COURSEWARE_TASK_STATUS.WAITING_FOR_USER,
  COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION,
  COURSEWARE_TASK_STATUS.REVIEWING_OUTLINE,
  COURSEWARE_TASK_STATUS.SPLITTING_OUTLINE,
  COURSEWARE_TASK_STATUS.GENERATING_CHILDREN
]

const FAILED_TASK_STATUS_KEYS: readonly CoursewareTaskStatusKey[] = [
  COURSEWARE_TASK_STATUS.FAILED,
  COURSEWARE_TASK_STATUS.CANCELED
]

export function isCoursewareTaskActive(status: unknown): boolean {
  return ACTIVE_TASK_STATUS_KEYS.includes(resolveCoursewareTaskStatus(status))
}

export function isCoursewareTaskFailed(status: unknown): boolean {
  return FAILED_TASK_STATUS_KEYS.includes(resolveCoursewareTaskStatus(status))
}

export function isCoursewareTaskSucceeded(status: unknown): boolean {
  return resolveCoursewareTaskStatus(status) === COURSEWARE_TASK_STATUS.SUCCEEDED
}

function clampProgress(progress: unknown, fallback = 0): number {
  const value = Number(progress)
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function resolveCoursewareTaskProgress(task?: CoursewareGenerationTaskLike): number {
  if (isCoursewareTaskCompletionSettled(task)) return 100
  const progress = clampProgress(task?.progress)
  return isCoursewareTaskFailed(task?.status) ? Math.min(progress, 99) : progress
}

export function resolveCoursewareSeriesItemProgress(
  item: Pick<CoursewareGenerationSeriesItemVO, 'status' | 'progress' | 'homeworkGenerationStatus'>,
  homeworkRequired = false
): number {
  const progress = clampProgress(item.progress)
  const homework = item.homeworkGenerationStatus?.toLowerCase()
  if (homework === 'failed' || homework === 'canceled') return Math.min(progress, 99)
  if (homeworkRequired && homework !== 'imported') {
    return isCoursewareTaskSucceeded(item.status)
      ? homework === 'running'
        ? 95
        : 90
      : Math.min(90, Math.round(progress * 0.9))
  }
  if (isCoursewareTaskSucceeded(item.status)) return 100
  if (isCoursewareTaskFailed(item.status)) return Math.min(progress, 99)
  return progress
}

function isHomeworkGenerationImported(status?: string): boolean {
  return status?.trim().toLowerCase() === 'imported'
}

function areAllSeriesPartsReady(items?: CoursewareGenerationSeriesItemVO[]): boolean {
  if (!items?.length) return false

  const declaredPartCounts = items
    .map((item) => Number(item.partCount))
    .filter((count) => Number.isInteger(count) && count > 0)
  const expectedPartCount = Math.max(items.length, ...declaredPartCounts)
  if (declaredPartCounts.some((count) => count !== expectedPartCount)) return false
  if (items.length !== expectedPartCount) return false

  const partIndexes = new Set(
    items
      .map((item) => Number(item.partIndex))
      .filter((index) => Number.isInteger(index) && index > 0)
  )
  if (partIndexes.size !== expectedPartCount) return false
  for (let index = 1; index <= expectedPartCount; index += 1) {
    if (!partIndexes.has(index)) return false
  }

  return items.every((item) => isHomeworkGenerationImported(item.homeworkGenerationStatus))
}

/**
 * A generated courseware is available only after the parent task reaches its
 * durable terminal state. When synchronous homework is enabled, every series
 * item must also have completed import, association, and quiz backfill.
 */
function isCoursewareTaskCompletionSettled(task?: CoursewareGenerationTaskLike): boolean {
  if (!isCoursewareTaskSucceeded(task?.status) || task?.done !== true) {
    return false
  }

  if (task.generateHomeworkSync !== true) {
    return true
  }

  if (!isHomeworkGenerationImported(task.homeworkGenerationStatus)) {
    return false
  }

  return !task.series || areAllSeriesPartsReady(task.series.items)
}

/**
 * `done` is the durable provider/ADM terminal marker. A delayed numeric progress
 * snapshot must not overwrite that terminal state with an obsolete 64%/81%/87%.
 */
export function isCoursewareTaskResultReady(task?: CoursewareGenerationTaskLike): boolean {
  return isCoursewareTaskCompletionSettled(task)
}

export function getWaitingQuestions(task?: CoursewareGenerationTaskLike) {
  return resolveCoursewareTaskStatus(task?.status) === COURSEWARE_TASK_STATUS.WAITING_FOR_USER
    ? task?.promptEnhancement?.questions || []
    : []
}

export function getWaitingConfirmationSummary(task?: CoursewareGenerationTaskLike) {
  return resolveCoursewareTaskStatus(task?.status) ===
    COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION
    ? task?.promptEnhancement?.summary
    : undefined
}

/**
 * 拆分计划只在“确实等待用户勾选”时才会出现在界面上。
 * 返回 undefined 表示当前不是勾选阶段，不应渲染勾选面板。
 */
export function resolvePartSelectionPlan(
  task?: CoursewareGenerationTaskLike
): CoursewareGenerationPartSelectionVO | undefined {
  const plan = task?.partSelection
  if (!plan?.required || !plan.parts?.length) return undefined
  return plan
}

/** 计划身份标识：用于判断“是不是同一份拆分计划”，避免轮询重置用户勾选。 */
export function resolvePartSelectionSignature(plan?: CoursewareGenerationPartSelectionVO): string {
  return (plan?.parts || []).map((part) => part.partIndex).join('|')
}

/** 默认全选，让用户只需取消不需要的部分。 */
export function defaultSelectedPartIndexes(plan?: CoursewareGenerationPartSelectionVO): number[] {
  return (plan?.parts || []).map((part) => part.partIndex)
}

/**
 * 决定当前轮询是否应该（重新）初始化勾选状态。
 *
 * 轮询每隔几秒整体替换 task 对象，若每次都重置，用户永远来不及勾选；
 * 但用户主动“全部取消勾选”时也不能被下一轮轮询悄悄恢复成全选，
 * 所以判据必须是“计划身份是否变化”，而不是“当前勾选是否为空”。
 */
export function resolvePartSelectionInit(
  plan: CoursewareGenerationPartSelectionVO | undefined,
  initializedSignature: string
): { signature: string; indexes: number[] } | undefined {
  const signature = resolvePartSelectionSignature(plan)
  if (!signature) return { signature: '', indexes: [] }
  if (signature === initializedSignature) return undefined
  return { signature, indexes: defaultSelectedPartIndexes(plan) }
}

export function getSeriesTaskProgressSummary(task?: CoursewareGenerationTaskLike) {
  const items = task?.series?.items || []
  if (items.length === 0) return undefined
  return {
    total: items.length,
    completed: items.filter(
      (item) => isCoursewareTaskSucceeded(item.status) || isCoursewareTaskFailed(item.status)
    ).length
  }
}

/**
 * 反问问题集合的身份标识。轮询每隔几秒就替换整个 task 对象，但只要问题集合
 * 没变就不能重置用户已勾选的答案，否则手速慢的用户永远选不完。
 */
export function resolveWaitingQuestionSignature(
  questions: CoursewareGenerationQuestionVO[]
): string {
  return questions.map((question) => question.id).join('|')
}

/**
 * 保留仍然有效的已选答案；新问题优先采用后端给出的推荐项。
 * 推荐项只在没有已有选择时写入，避免轮询或重新渲染覆盖用户的主动选择。
 */
export const NONE_ANSWER = '__none__'

export function recommendedQuestionAnswer(question: CoursewareGenerationQuestionVO): string {
  return (
    (
      question.options?.find((option) => option.id === question.recommendedOptionId) ||
      question.options?.find((option) => option.recommended) ||
      question.options?.[0]
    )?.id || NONE_ANSWER
  )
}

export function mergeWaitingQuestionAnswers(
  previousAnswers: Record<string, string>,
  questions: CoursewareGenerationQuestionVO[]
): Record<string, string> {
  const merged: Record<string, string> = {}
  questions.forEach((question) => {
    const previousAnswer = previousAnswers[question.id]
    if (previousAnswer) {
      merged[question.id] = previousAnswer
      return
    }

    merged[question.id] = recommendedQuestionAnswer(question)
  })
  return merged
}

/** 保留仍然有效的问题备注；备注只作为该题的更具体约束。 */
export function mergeWaitingQuestionNotes(
  previousNotes: Record<string, string>,
  questions: CoursewareGenerationQuestionVO[]
): Record<string, string> {
  const merged: Record<string, string> = {}
  questions.forEach((question) => {
    merged[question.id] = previousNotes[question.id] || ''
  })
  return merged
}

export function buildTaskAnswerPayload(
  questions: CoursewareGenerationQuestionVO[],
  answers: Record<string, string>,
  notes: Record<string, string> = {}
): Array<{ id: string; value: string; note?: string }> {
  return questions.map((question) => {
    const note = (notes[question.id] || '').trim()
    return {
      id: question.id,
      value: (answers[question.id] || '').trim(),
      ...(note ? { note } : {})
    }
  })
}

function firstQueryValue(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

function resolveResultPreviewUrl(result?: CoursewareGenerationResultVO): string {
  return result?.previewUrl || result?.url || ''
}

function resolveResultDownloadUrl(result?: CoursewareGenerationResultVO): string {
  return (
    result?.downloadUrl ||
    result?.exportUrls?.pptx ||
    result?.exportUrls?.html ||
    result?.exportUrls?.resourcePack ||
    result?.exportUrls?.classroomZip ||
    ''
  )
}

export function resolveCoursewareTaskResult(
  task?: CoursewareGenerationTaskLike,
  query: CoursewareRouteQueryLike = {}
): CoursewareResultState {
  if (!isCoursewareTaskResultReady(task)) {
    return {
      mode: 'none',
      previewUrl: '',
      downloadUrl: '',
      title: ''
    }
  }

  const series = task?.series
  if (series?.items?.length) {
    if (series.items.length === 1) {
      const [singleItem] = series.items
      return {
        mode: 'single-preview',
        previewUrl: singleItem.previewUrl || '',
        downloadUrl: singleItem.downloadUrl || '',
        title: singleItem.title,
        currentItem: singleItem,
        series
      }
    }

    const routeSeriesId = firstQueryValue(query.seriesId)
    const routeCurrentPart = Number(firstQueryValue(query.currentPart))
    const currentItem =
      routeSeriesId && Number.isFinite(routeCurrentPart)
        ? series.items.find(
            (item) =>
              Number(item.partIndex) === routeCurrentPart && series.seriesId === routeSeriesId
          )
        : undefined

    if (!currentItem) {
      return {
        mode: 'series-list',
        previewUrl: '',
        downloadUrl: '',
        title: series.title,
        series
      }
    }

    return {
      mode: 'series-preview',
      previewUrl: currentItem.previewUrl || '',
      downloadUrl: currentItem.downloadUrl || '',
      title: currentItem.title,
      currentItem,
      series
    }
  }

  const previewUrl = resolveResultPreviewUrl(task?.result)
  const downloadUrl = resolveResultDownloadUrl(task?.result)
  if (!previewUrl && !downloadUrl) {
    return {
      mode: 'none',
      previewUrl: '',
      downloadUrl: '',
      title: ''
    }
  }

  return {
    mode: 'single-preview',
    previewUrl,
    downloadUrl,
    title: ''
  }
}
