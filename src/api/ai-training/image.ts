import request from '@/config/axios'

const AI_REQUEST_TIMEOUT = 300000

export interface AiTrainingImageGenerateReq {
  prompt: string
  size: string
  bmConfigId?: number
  fileNamePrefix?: string
  sourceModule?: string
  sourceBizId?: string
  assetName?: string
  tags?: string[]
}

export interface AiTrainingImageGenerateResp {
  fileName: string
  mimeType: string
  fileUrl: string
  imageAssetId?: number
  duplicateOfId?: number
}

export const AiTrainingImageApi = {
  generate: async (data: AiTrainingImageGenerateReq) =>
    await request.post<AiTrainingImageGenerateResp>({
      url: '/ai-training/image/generate',
      data,
      timeout: AI_REQUEST_TIMEOUT
    }),
  proxy: async (url: string) =>
    await request.download<Blob>({
      url: '/ai-training/image/proxy',
      params: { url },
      timeout: AI_REQUEST_TIMEOUT
    })
}
