import request from '@/config/axios'

export interface CoursewareVO {
  id?: number
  title: string
  summary?: string
  description?: string
  trainingObjective?: string
  category?: string
  tags?: string[]
  knowledgeMaterial?: string
  documentProcessingMode?: 'parse' | 'direct'
  generateHomeworkSync?: boolean | null
  language?: string
  style?: string
  status?: number
  creator?: string
  creatorName?: string
  createTime?: Date
  updateTime?: Date
  viewCount?: number
  learnerCount?: number
  linkedQuestionCount?: number
  publishTime?: Date
  previewUrl?: string
  embedUrl?: string
  downloadUrl?: string
  shareUrl?: string
  areaIds?: number[]
  areaNames?: string[]
  coverUrl?: string
  coverNeedsSync?: boolean
  estimatedDurationSeconds?: number | null
  durationCalculationVersion?: string
  catalogCategories?: CoursewareCatalogDisplayVO[]
  catalogBrands?: CoursewareCatalogDisplayVO[]
  catalogProducts?: CoursewareCatalogDisplayVO[]
  catalogCategoryCount?: number
  catalogBrandCount?: number
  catalogProductCount?: number
}

export interface CoursewareCatalogDisplayVO {
  id: number
  name: string
  pathName?: string
}

export interface CoursewareCatalogOptionsVO {
  brands: Array<{ id: number; name: string; sort?: number }>
  categories: Array<{
    id: number
    brandId: number
    parentId?: number
    name: string
    pathName?: string
    sort?: number
  }>
  products: Array<{
    id: number
    brandId: number
    categoryId: number
    name: string
    sort?: number
  }>
}

export interface CoursewareCatalogRelationVO {
  coursewareId: number
  brandIds: number[]
  categoryIds: number[]
  productIds: number[]
}

export interface CoursewarePageReqVO {
  pageNo: number
  pageSize: number
  keyword?: string
  status?: number
  tag?: string
  tags?: string[]
  sort?: string
  brandIds?: number[]
  categoryIds?: number[]
  productIds?: number[]
}

export interface CoursewareMaterialFileReqVO {
  fileId?: number
  configId?: number
  path?: string
  name: string
  url: string
  size?: number
  type?: string
}

export interface CoursewareSourceFileUploadInitReqVO {
  uploadId?: string
  name: string
  size: number
  type?: string
}

export interface CoursewareSourceFileUploadInitRespVO {
  uploadId: string
  configId: number
  bucket: string
  region: string
  endpoint: string
  objectKey: string
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
  maxSizeBytes: number
  allowedExtensions: string[]
}

export interface CoursewareSourceFileUploadCompleteReqVO {
  uploadId: string
  objectKey: string
  name: string
  size: number
  type?: string
}

export interface CoursewareSalesboostFileCapabilitiesVO {
  fileTypes?: Array<{
    extension: string
    mimeTypes?: string[]
    maxSizeBytes?: number
    parse?: boolean
    direct?: boolean
    enabled?: boolean
    label?: string
    supportedModes?: string[]
  }>
  supportedModes?: string[]
  defaultMode?: string
}

export interface CoursewareGenerationOptionsVO {
  homework: 'yes' | 'no' | 'ai'
  imageGeneration: 'yes' | 'no' | 'ai'
  splitOptimization: 'yes' | 'no' | 'ai'
  coursewareMode: 'ai_rebuild' | 'preserve_original' | 'ai_decide'
}

export interface CoursewareGenerationReqVO {
  manualSelectionEnabled?: boolean
  generationOptions?: CoursewareGenerationOptionsVO
  title?: string
  description?: string
  trainingObjective?: string
  category?: string
  tags?: string[]
  knowledgeMaterial?: string
  materialFiles?: CoursewareMaterialFileReqVO[]
  additionalInstruction?: string
  documentProcessingMode?: 'parse' | 'direct'
  language?: string
  style?: string
  generateHomeworkSync?: boolean
  narratorVoiceId?: string
  narratorMinimaxVoiceId?: string
  outlineEnhancementEnabled?: boolean
  promptEnhancementEnabled?: boolean
  enableImageGeneration?: boolean
  brandIds?: number[]
  categoryIds?: number[]
  productIds?: number[]
}

export interface CoursewareSalesboostEmbedVO {
  url: string
  token: string
  expiresAt: number
  coursewareId: number
  classroomId: string
}

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
  /** 必须由用户明确选择，不能预选或自动提交。 */
  requiresExplicitAnswer?: boolean
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

export const CoursewareApi = {
  getCoursewarePage: async (params: CoursewarePageReqVO) => {
    return await request.get({ url: '/ai/courseware/page', params })
  },

  getCourseware: async (id: number) => {
    return await request.get({ url: '/ai/courseware/get?id=' + id })
  },

  getCoursewareTags: async () => {
    return await request.get({ url: '/ai/courseware/tags' })
  },

  getCatalogOptions: async (): Promise<CoursewareCatalogOptionsVO> => {
    return await request.get({ url: '/ai/courseware/catalog/options' })
  },

  getCatalogRelation: async (coursewareId: number): Promise<CoursewareCatalogRelationVO> => {
    return await request.get({ url: '/ai/courseware/catalog/relation', params: { coursewareId } })
  },

  replaceCatalogRelation: async (
    data: CoursewareCatalogRelationVO
  ): Promise<CoursewareCatalogRelationVO> => {
    return await request.put({ url: '/ai/courseware/catalog/relation', data })
  },

  createCourseware: async (data: CoursewareVO) => {
    return await request.post({ url: '/ai/courseware/create', data })
  },

  updateCourseware: async (data: CoursewareVO) => {
    return await request.put({ url: '/ai/courseware/update', data })
  },

  deleteCourseware: async (id: number) => {
    return await request.delete({ url: '/ai/courseware/delete?id=' + id })
  },

  publishCourseware: async (id: number) => {
    return await request.put({ url: '/ai/courseware/publish?id=' + id })
  },

  unpublishCourseware: async (id: number) => {
    return await request.put({ url: '/ai/courseware/unpublish?id=' + id })
  },

  copyCoursewareLink: async (id: number) => {
    return await request.get({ url: '/ai/courseware/copy-link?id=' + id })
  },

  syncCoursewareDownloadUrl: async (id: number) => {
    return await request.post({ url: '/ai/courseware/sync-download-url?id=' + id })
  },

  syncCoursewareCoverUrl: async (id: number) => {
    return await request.post({ url: '/ai/courseware/sync-cover-url?id=' + id })
  },

  createGenerationTask: async (data: CoursewareGenerationReqVO) => {
    return await request.post({ url: '/ai/courseware/generation-task/create', data })
  },

  initSourceFileUpload: async (data: CoursewareSourceFileUploadInitReqVO) => {
    return await request.post({ url: '/ai/courseware/source-file/upload-init', data })
  },

  completeSourceFileUpload: async (data: CoursewareSourceFileUploadCompleteReqVO) => {
    return await request.post({ url: '/ai/courseware/source-file/upload-complete', data })
  },

  abortSourceFileUpload: async (data: { uploadId: string }) => {
    return await request.post({ url: '/ai/courseware/source-file/upload-abort', data })
  },

  getSalesboostFileCapabilities: async (): Promise<CoursewareSalesboostFileCapabilitiesVO> => {
    return await request.get({ url: '/ai/courseware/salesboost/file-capabilities' })
  },

  getGenerationPagePreview: async (
    id: number,
    pageId: string
  ): Promise<CoursewarePagePreviewVO> => {
    return await request.get({
      url: '/ai/courseware/generation-task/page-preview',
      params: { id, pageId }
    })
  },

  getGenerationTask: async (id: number, options?: { silentNetworkError?: boolean }) => {
    return await request.get({
      url: '/ai/courseware/generation-task/get?id=' + id,
      silentNetworkError: options?.silentNetworkError
    })
  },

  answerGenerationTask: async (data: {
    id: number
    answers: Array<{ id: string; value: string; note?: string }>
  }) => {
    return await request.post({
      url: '/ai/courseware/generation-task/answer?id=' + data.id,
      data: { answers: data.answers }
    })
  },

  confirmGenerationTask: async (data: {
    id: number
    confirmed: boolean
    /** 拆分后确认时提交用户勾选的子课件序号；为空表示全部生成。 */
    selectedPartIndexes?: number[]
    requirementEdits?: CoursewareStudioConfirmation['requirementEdits']
    outlineEdits?: CoursewareStudioConfirmation['outlineEdits']
  }) => {
    return await request.post({
      url: '/ai/courseware/generation-task/confirm?id=' + data.id,
      data: {
        confirmed: data.confirmed,
        ...(data.selectedPartIndexes !== undefined
          ? { selectedPartIndexes: data.selectedPartIndexes }
          : {}),
        ...(data.requirementEdits ? { requirementEdits: data.requirementEdits } : {}),
        ...(data.outlineEdits ? { outlineEdits: data.outlineEdits } : {})
      }
    })
  },

  getActiveGenerationTask: async () => {
    return await request.get({ url: '/ai/courseware/generation-task/active' })
  },

  getSalesboostEmbed: async (id: number) => {
    return await request.get({ url: '/ai/courseware/salesboost/embed?id=' + id })
  },

  cancelGenerationTask: async (id: number) => {
    return await request.put({ url: '/ai/courseware/generation-task/cancel?id=' + id })
  },

  retryGenerationTask: async (id: number) => {
    return await request.post({ url: '/ai/courseware/generation-task/retry?id=' + id })
  },

  regenerateHomework: async (
    data: number | { coursewareId: number; generationTaskId?: number }
  ): Promise<CoursewareGenerationTaskVO> => {
    const payload = typeof data === 'number' ? { coursewareId: data } : data
    return await request.post({
      url: '/ai/courseware/homework/regenerate',
      params: payload
    })
  },

  regenerateCover: async (id: number) => {
    return await request.post({ url: '/ai/courseware/regenerate-cover?id=' + id })
  },

  updateCoursewareTitle: async (data: { id: number; title: string }) => {
    return await request.put({ url: '/ai/courseware/update-title', data })
  }
}
