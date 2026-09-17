/**
 * 优秀案例采集（音视频）相关的视图对象。
 *
 * 原先从 `@/api/taskCenter` 借类型，但本工程不包含周期任务模块，
 * 因此把素材库真正用到的这几个 VO 收敛到这里，保持类型不变。
 */
export interface SbMediaSubmissionVO {
  id: number
  taskId: number
  assignmentId: number
  targetId?: number
  userId: number
  userName?: string
  deptName?: string
  source?: string
  fileUrl?: string
  fileName?: string
  contentType?: string
  size?: number
  durationSec?: number
  submittedAt?: string
  enabled?: boolean
  reviewReason?: string
  reviewedAt?: string
  /** AI 分析摘要：列表行展示。 */
  analysisId?: number
  analysisStatus?: string
  analysisStatusDesc?: string
  analysisScore?: number
  analysisRecommended?: boolean
  /** AI 分析明细：仅提交详情接口返回。 */
  analysis?: SbMediaAnalysisVO
  /** 素材库视图字段：跨任务列表自带的任务标题。 */
  taskTitle?: string
  /** 素材库视图字段：模型的推荐理由。 */
  analysisRecommendReason?: string
  /** 素材库视图字段：是否已被人工标记「不再推荐」。 */
  recommendationDismissed?: boolean
  /** 素材库视图字段：这条提交已产出的素材数量。 */
  goldenMaterialCount?: number
}

/** 优秀案例采集的 AI 分析结果（转写、点评、维度评分、证据片段与推荐结论）。 */
export interface SbMediaAnalysisVO {
  id: number
  submissionId: number
  status?: string
  statusDesc?: string
  transcript?: string
  summary?: string
  insights?: string[]
  segments?: SbMediaAnalysisSegmentVO[]
  dimensions?: SbMediaAnalysisDimensionVO[]
  overallScore?: number
  recommended?: boolean
  recommendReason?: string
  tags?: string[]
  model?: string
  confidence?: number
  error?: string
  retryCount?: number
  startedAt?: string
  completedAt?: string
}

export interface SbMediaAnalysisSegmentVO {
  startSec?: number
  endSec?: number
  text?: string
  reason?: string
}

export interface SbMediaAnalysisDimensionVO {
  dimensionId?: string
  name?: string
  weight?: number
  required?: boolean
  score?: number
  comment?: string
}
