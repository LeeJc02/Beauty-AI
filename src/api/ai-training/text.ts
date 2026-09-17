import request from '@/config/axios'

const AI_REQUEST_TIMEOUT = 300000

export interface AiTrainingTextGenerateReq {
  prompt: string
  bmConfigId?: number
}

export interface AiTrainingTextGenerateResp {
  content: string
}

export const AiTrainingTextApi = {
  generate: async (data: AiTrainingTextGenerateReq) =>
    await request.post<AiTrainingTextGenerateResp>({
      url: '/ai-training/text/generate',
      data,
      timeout: AI_REQUEST_TIMEOUT
    })
}
