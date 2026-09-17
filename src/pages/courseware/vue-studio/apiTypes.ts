export interface CoursewareGenerationQuestionOptionVO {
  id: string
  label: string
  description?: string
  recommended?: boolean
}

export interface CoursewareGenerationQuestionVO {
  id: string
  question: string
  reason?: string
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

export interface CoursewareGenerationSummaryVO {
  planningOutline?: Array<Omit<CoursewareOutlineDraftVO, 'type'>>
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
  message?: string
  history?: Array<{
    message?: string
    questions: CoursewareGenerationQuestionVO[]
    answers: Array<{ questionId: string; value: string; note?: string }>
  }>
  questions?: CoursewareGenerationQuestionVO[]
  knownRequirements?: Record<string, unknown>
  assumptions?: string[]
  summary?: CoursewareGenerationSummaryVO
}

export interface CoursewareGenerationTaskResultVO {
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

export interface CoursewareOutlineDraftVO {
  id: string
  type: 'slide' | 'quiz' | 'interactive' | 'pbl'
  title: string
  description: string
  keyPoints: string[]
}

export interface CoursewareStudioConfirmation {
  selectedPartIndexes?: number[]
  requirementEdits?: {
    title: string
    audience: string
    objective: string
    mustInclude: string[]
    planningOutline?: Array<Omit<CoursewareOutlineDraftVO, 'type'>>
  }
  outlineEdits?: Array<Omit<CoursewareOutlineDraftVO, 'type'>>
}

export interface CoursewareGenerationPartPlanItemVO {
  partIndex: number
  partCount: number
  title: string
  estimatedDurationSeconds?: number
  outlineCount?: number
  outlines?: CoursewareOutlineDraftVO[]
}

export interface CoursewareGenerationPartSelectionVO {
  /** true 表示任务正停在“等待勾选子课件”这一步。 */
  required: boolean
  /** 用户已勾选的子课件序号（1-based）。 */
  selectedPartIndexes?: number[]
  parts: CoursewareGenerationPartPlanItemVO[]
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

export interface CoursewarePageStateVO {
  id: string
  outlineId: string
  partIndex: number
  order: number
  title: string
  summary: string
  status: 'waiting' | 'generating' | 'retrying' | 'completed' | 'failed'
  retryCount: number
  maxRetries?: number
  mediaPending: boolean
  version: number
  error?: string
}

export interface CoursewareGenerationViewVO {
  phase:
    | 'sources'
    | 'interview'
    | 'plan'
    | 'outline'
    | 'pages'
    | 'finalizing'
    | 'completed'
    | 'failed'
    | 'canceled'
  sourceSummary?: string
  pages: CoursewarePageStateVO[]
  retry?: { phase: string; count: number; maxRetries?: number; retrying: boolean }
}

export interface CoursewarePagePreviewVO {
  pageId: string
  version: number
  mediaPending: boolean
  html: string
}

export interface CoursewareGenerationTaskVO {
  snapshotVersion?: number
  generation?: CoursewareGenerationViewVO
  id: number
  coursewareId?: number
  title?: string
  status: number | string
  step?: string
  progress?: number
  provider?: string
  externalTaskId?: string
  pollUrl?: string
  pollIntervalMs?: number
  message?: string
  errorMessage?: string
  error?: string
  errorCode?: string
  traceId?: string
  traceEvents?: Array<{
    at: string
    event: string
    status?: string
    step?: string
    progress?: number
    message?: string
    errorCode?: string
    error?: string
    traceId?: string
  }>
  resultCoursewareId?: number
  result?: CoursewareGenerationTaskResultVO
  series?: CoursewareGenerationSeriesVO
  partSelection?: CoursewareGenerationPartSelectionVO
  researchSummary?: {
    version?: string
    status?: 'complete' | 'partial' | 'failed' | 'disabled' | string
    queries?: Array<{ query?: string; intent?: string }>
    sources?: Array<{
      title?: string
      url?: string
      quality?: string
      label?: string
      queryIntent?: string
      adoptedConclusion?: string
    }>
    finalConclusions?: string[]
  }
  outlineGrouping?: {
    strategy?: string
    partCount?: number
    partDurationsSeconds?: number[]
  }
  promptEnhancement?: CoursewareGenerationPromptEnhancementVO
  sourcePreparation?: {
    status?: 'pending' | 'running' | 'succeeded' | 'failed' | string
    error?: string
  }
  done?: boolean
  generateHomeworkSync?: boolean
  homeworkGenerationStatus?: string
  homeworkGenerationProvider?: string
  homeworkGenerationRequestId?: string
  homeworkGenerationTaskId?: string
  homeworkGenerationMode?: string
  homeworkGenerationMessage?: string
  homeworkGenerationResult?: string
  requestSnapshot?: string
  createTime?: Date
}

