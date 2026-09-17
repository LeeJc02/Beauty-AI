import request from '@/config/axios'
import download from '@/utils/download'
import type { SbMediaAnalysisSegmentVO, SbMediaSubmissionVO } from './mediaTypes'

const AI_REQUEST_TIMEOUT = 300000

/** 素材被陪练资产引用的记录：谁在什么时候用这条素材生成了什么资产。 */
export interface SbMaterialReferenceVO {
  id?: number
  materialId?: number
  materialTitle?: string
  materialVersion?: number
  targetType?: string
  targetTypeDesc?: string
  targetId?: number
  transcriptSnapshot?: string
  createTime?: string
}

/** 优秀案例素材：人工确认后的真实销售做法。 */
export interface SbMaterialVO {
  id?: number
  albumId?: number
  albumName?: string
  title: string
  transcript?: string
  summary?: string
  scope?: string
  scopeDesc?: string
  targetKind?: string
  targetLabel?: string
  tags?: string[]
  evidence?: SbMediaAnalysisSegmentVO[]
  sourceSubmissionId?: number
  version?: number
  status?: string
  statusDesc?: string
  retireReason?: string
  reviewer?: number
  reviewerName?: string
  reviewedAt?: string
  createTime?: string
  updateTime?: string
  taskId?: number
  taskTitle?: string
  userId?: number
  userName?: string
  deptName?: string
  fileUrl?: string
  durationSec?: number
  submittedAt?: string
  referenceCount?: number
  references?: SbMaterialReferenceVO[]
}

/** 素材专辑：素材的人工归类方式。 */
export interface SbGoldenAlbumVO {
  id?: number
  name: string
  description?: string
  sort?: number
  materialCount?: number
  createTime?: string
}

/** 引用素材生成陪练资产的入参：与知识库生成共用模型选型与提示词机制。 */
export interface SbMaterialGenerateReqVO {
  lang: string
  materialIds: number[]
  trainerNotes?: string
  bmConfigId?: number
  targetLabel?: string
  quoteCount?: number
}

/** 素材引用生成的金句草稿。 */
export interface SbMaterialQuoteVO {
  text: string
  hint?: string
  materialIds?: number[]
}

export const SbMaterialLibraryApi = {
  // ===== 提交视图（全部采集 / AI 候选推荐）=====
  getSubmissionPage: async (params: {
    pageNo?: number
    pageSize?: number
    taskId?: number
    areaId?: number
    keyword?: string
    enabled?: boolean
    analysisStatus?: string
    recommended?: boolean
    dismissed?: boolean
    titleKeyword?: string
  }): Promise<{ list: SbMediaSubmissionVO[]; total: number }> =>
    await request.get({ url: '/ai-training/material-library/submission/page', params }),

  getSubmission: async (id: number | string): Promise<SbMediaSubmissionVO> =>
    await request.get({ url: '/ai-training/material-library/submission/get', params: { id } }),

  exportSubmissions: async (params: {
    taskId?: number
    areaId?: number
    keyword?: string
    enabled?: boolean
    analysisStatus?: string
    recommended?: boolean
    dismissed?: boolean
    titleKeyword?: string
  }): Promise<Blob> => {
    return await request.download({ url: '/ai-training/material-library/submission/export', params })
  },

  // ===== 素材视图 =====
  getMaterialPage: async (params: {
    pageNo?: number
    pageSize?: number
    albumId?: number
    uncategorized?: boolean
    status?: string
    scope?: string
    taskId?: number
    keyword?: string
  }): Promise<{ list: SbMaterialVO[]; total: number }> =>
    await request.get({ url: '/ai-training/material-library/material/page', params }),

  getMaterial: async (id: number): Promise<SbMaterialVO> =>
    await request.get({ url: '/ai-training/material-library/material/get', params: { id } }),

  promoteMaterial: async (data: {
    submissionId: number
    title: string
    summary?: string
    transcript?: string
    scope?: string
    albumId?: number
  }): Promise<number> => await request.post({ url: '/ai-training/material-library/material/promote', data }),

  updateMaterial: async (data: {
    id: number
    title: string
    summary?: string
    transcript?: string
    scope?: string
    albumId?: number
  }): Promise<boolean> => await request.post({ url: '/ai-training/material-library/material/update', data }),

  retireMaterial: async (data: { id: number; reason: string }): Promise<boolean> =>
    await request.post({ url: '/ai-training/material-library/material/retire', data }),

  enableMaterial: async (id: number): Promise<boolean> =>
    await request.post({ url: '/ai-training/material-library/material/enable', params: { id } }),

  dismissRecommendation: async (data: { submissionId: number; reason: string }): Promise<boolean> =>
    await request.post({ url: '/ai-training/material-library/recommendation/dismiss', data }),

  // ===== 引用弹框取数 =====
  getReferenceableMaterials: async (params: {
    albumId?: number
    keyword?: string
    recommendedOnly?: boolean
  }): Promise<SbMaterialVO[]> =>
    await request.get({ url: '/ai-training/material-library/referenceable', params }),

  // ===== 专辑 =====
  getAlbumList: async (): Promise<SbGoldenAlbumVO[]> =>
    await request.get({ url: '/ai-training/material-library/album/list' }),

  createAlbum: async (data: { name: string; description?: string; sort?: number }): Promise<number> =>
    await request.post({ url: '/ai-training/material-library/album/create', data }),

  updateAlbum: async (data: {
    id: number
    name: string
    description?: string
    sort?: number
  }): Promise<boolean> => await request.post({ url: '/ai-training/material-library/album/update', data }),

  deleteAlbum: async (id: number): Promise<boolean> =>
    await request.post({ url: '/ai-training/material-library/album/delete', params: { id } }),

  downloadSubmissions: (data: Blob, fileName: string) => download.csv(data, fileName)
}

export const MATERIAL_AI_TIMEOUT = AI_REQUEST_TIMEOUT
