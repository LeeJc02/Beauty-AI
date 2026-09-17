import request from '@/config/axios'

export interface AiImageAssetVO {
  id: number
  name: string
  imageUrl: string
  thumbnailUrl?: string
  fileName?: string
  originalPath?: string
  mimeType?: string
  fileSize?: number
  width?: number
  height?: number
  format?: string
  sourceType: string
  sourceModule?: string
  sourceBizId?: string
  sourceFileId?: number
  parseTaskId?: number
  parseResultId?: number
  pageNo?: number
  position?: Record<string, any>
  contentHash?: string
  perceptualHash?: string
  label?: string
  keywords?: string[]
  tags?: string[]
  productCandidates?: Record<string, any>[]
  auditStatus: string
  usageStatus: string
  recommendedMainImage?: boolean
  duplicateOfId?: number
  usedCount?: number
  remark?: string
  createTime?: string
  updateTime?: string
}

export interface AiImageAssetUpdateReqVO {
  id: number
  name?: string
  tags?: string[]
  keywords?: string[]
  auditStatus?: string
  usageStatus?: string
  recommendedMainImage?: boolean
  remark?: string
}

export interface AiImageAssetBatchUpdateReqVO {
  ids: number[]
  tags?: string[]
  auditStatus?: string
  usageStatus?: string
  recommendedMainImage?: boolean
}

export interface AiImageAssetBatchHashReqVO {
  ids: number[]
}

export interface AiImageAssetImportRespVO {
  totalCount: number
  createdCount: number
  updatedCount: number
}

export const AiImageAssetApi = {
  getPage: async (params: any) => {
    return await request.get({ url: '/ai-resource/image-asset/page', params })
  },

  get: async (id: number) => {
    return await request.get<AiImageAssetVO>({ url: '/ai-resource/image-asset/get', params: { id } })
  },

  upload: async (data: FormData) => {
    const res = await request.upload({ url: '/ai-resource/image-asset/upload', data })
    return res.data as AiImageAssetVO
  },

  update: async (data: AiImageAssetUpdateReqVO) => {
    return await request.put<AiImageAssetVO>({ url: '/ai-resource/image-asset/update', data })
  },

  batchUpdate: async (data: AiImageAssetBatchUpdateReqVO) => {
    return await request.put<number>({ url: '/ai-resource/image-asset/batch-update', data })
  },

  rebuildContentHash: async (id: number) => {
    return await request.post<AiImageAssetVO>({
      url: '/ai-resource/image-asset/rebuild-content-hash',
      params: { id }
    })
  },

  batchRebuildContentHash: async (data: AiImageAssetBatchHashReqVO) => {
    return await request.post<number>({ url: '/ai-resource/image-asset/batch-rebuild-content-hash', data })
  },

  importFileParseImages: async (resultId: number) => {
    return await request.post<AiImageAssetImportRespVO>({
      url: '/ai-resource/image-asset/import-file-parse',
      params: { resultId }
    })
  },

  delete: async (id: number) => {
    return await request.delete<boolean>({ url: '/ai-resource/image-asset/delete', params: { id } })
  }
}
