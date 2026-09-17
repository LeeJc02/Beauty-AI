import request from '@/config/axios'
import { AiFileParseFileVO } from './fileParse'

export interface AiProductExtractionBatchVO {
  id: number
  sourceFileId: number
  sourceFileName?: string
  sourceFileOriginalName?: string
  parseResultId: number
  bmConfigId?: number
  status: string
  candidateCount: number
  pendingCount: number
  appliedCount: number
  ignoredCount: number
  errorMessage?: string
  progressStage?: string
  receivedChars?: number
  createTime?: string
  updateTime?: string
}

export interface AiProductCandidateVO {
  id: number
  batchId: number
  sourceFileId: number
  parseResultId: number
  candidateType?: string
  status: string
  lang?: string
  brandName?: string
  productName?: string
  categoryName?: string
  tagName?: string
  description?: string
  imageUrl?: string
  imageAssetId?: number
  sellingPoints?: string[]
  ingredients?: string[]
  effects?: string[]
  usageMethods?: string[]
  targetAudience?: string[]
  contraindications?: string[]
  sourceExcerpt?: string
  sourcePageNo?: number
  sourceImageUrls?: string[]
  evidence?: Record<string, any>
  semanticJson?: Record<string, any>
  confidence?: number
  matchedBrandId?: number
  matchedCategoryId?: number
  matchedTagId?: number
  matchedProductId?: number
  appliedProductId?: number
  appliedTargetType?: string
  appliedPTagId?: number
  appliedBindingId?: number
  appliedBrandId?: number
  appliedCategoryId?: number
  appliedTagId?: number
  reviewRemark?: string
  sort?: number
  createTime?: string
  updateTime?: string
}

export interface AiProductExtractionReqVO {
  fileId: number
  resultId?: number
  bmConfigId?: number
  limit?: number
}

export interface AiProductExtractionManualImportReqVO {
  fileId: number
  batchId?: number
  jsonContent: string
}

export interface AiProductCandidateUpdateReqVO extends Partial<AiProductCandidateVO> {
  id: number
  productName?: string
}

export interface AiProductCandidateApplyReqVO {
  id: number
  applyTargetType: string
  targetName?: string
  productId?: number
  brandId?: number
  categoryId?: number
  tagId?: number
  tagBindingTargetType?: string
  tagBindingTargetId?: number
  productTags?: string[]
}

export interface AiProductCandidateBatchApplyReqVO {
  ids: number[]
  applyTargetType: string
  brandId?: number
  categoryId?: number
  tagId?: number
  tagBindingTargetType?: string
  tagBindingTargetId?: number
  renameRule?: {
    removePrefix?: string
    removeSuffix?: string
    find?: string
    replace?: string
  }
  items?: Array<{
    id: number
    targetName?: string
  }>
}

export interface AiProductCandidateBatchApplyRespVO {
  totalCount: number
  validCount: number
  successCount: number
  failedCount: number
  skippedCount: number
  items: Array<{
    id: number
    candidateType?: string
    sourceName?: string
    targetName?: string
    action?: string
    valid?: boolean
    message?: string
    targetId?: number
    bindingId?: number
  }>
}

export interface AiProductExtractionPromptVO {
  id: number
  name: string
  code: string
  promptType: string
  version?: string
  content: string
  remark?: string
  requiredVariables: string[]
  updateTime?: string
}

export const AiProductExtractionApi = {
  getSourceFilePage: async (params: any) => {
    return await request.get<{ list: AiFileParseFileVO[]; total: number }>({
      url: '/ai-resource/product-extraction/source-file/page',
      params
    })
  },

  getBatchPage: async (params: any) => {
    return await request.get({ url: '/ai-resource/product-extraction/batch/page', params })
  },

  extract: async (data: AiProductExtractionReqVO) => {
    return await request.post<AiProductExtractionBatchVO>({
      url: '/ai-resource/product-extraction/extract',
      data
    })
  },

  getBatch: async (id: number) => {
    return await request.get<AiProductExtractionBatchVO>({
      url: '/ai-resource/product-extraction/batch/get',
      params: { id }
    })
  },

  deleteBatch: async (id: number) => {
    return await request.delete<boolean>({
      url: '/ai-resource/product-extraction/batch/delete',
      params: { id }
    })
  },

  stopBatch: async (id: number) => {
    return await request.post<AiProductExtractionBatchVO>({
      url: '/ai-resource/product-extraction/batch/stop',
      params: { id }
    })
  },

  manualImport: async (data: AiProductExtractionManualImportReqVO) => {
    return await request.post<AiProductExtractionBatchVO>({
      url: '/ai-resource/product-extraction/source-file/manual-import',
      data,
      returnErrorMsg: true
    })
  },

  getCandidatePage: async (params: any) => {
    return await request.get({ url: '/ai-resource/product-extraction/candidate/page', params })
  },

  getCandidate: async (id: number) => {
    return await request.get<AiProductCandidateVO>({
      url: '/ai-resource/product-extraction/candidate/get',
      params: { id }
    })
  },

  updateCandidate: async (data: AiProductCandidateUpdateReqVO) => {
    return await request.put<AiProductCandidateVO>({
      url: '/ai-resource/product-extraction/candidate/update',
      data
    })
  },

  ignoreCandidate: async (id: number) => {
    return await request.post<AiProductCandidateVO>({
      url: '/ai-resource/product-extraction/candidate/ignore',
      params: { id }
    })
  },

  applyCandidate: async (data: AiProductCandidateApplyReqVO) => {
    return await request.post<AiProductCandidateVO>({
      url: '/ai-resource/product-extraction/candidate/apply',
      data
    })
  },

  previewBatchApply: async (data: AiProductCandidateBatchApplyReqVO) => {
    return await request.post<AiProductCandidateBatchApplyRespVO>({
      url: '/ai-resource/product-extraction/candidate/batch-apply-preview',
      data
    })
  },

  batchApplyCandidates: async (data: AiProductCandidateBatchApplyReqVO) => {
    return await request.post<AiProductCandidateBatchApplyRespVO>({
      url: '/ai-resource/product-extraction/candidate/batch-apply',
      data
    })
  },

  getPrompt: async () => {
    return await request.get<AiProductExtractionPromptVO>({
      url: '/ai-resource/product-extraction/prompt/get'
    })
  },

  updatePrompt: async (content: string) => {
    return await request.put<AiProductExtractionPromptVO>({
      url: '/ai-resource/product-extraction/prompt/update',
      data: { content }
    })
  }
}
