import request from '@/config/axios'

export interface AiTrainingDefaultPromptPartVO {
  id?: number
  name: string
  code: string
  promptType?: string
  version?: string
  content: string
  remark?: string
  requiredVariables?: string[]
  updateTime?: string
}

export const AiTrainingDefaultPromptPartApi = {
  list: async () =>
    await request.get<AiTrainingDefaultPromptPartVO[]>({
      url: '/ai-training/default-prompt-part/list'
    }),
  update: async (code: string, content: string) =>
    await request.put<AiTrainingDefaultPromptPartVO>({
      url: `/ai-training/default-prompt-part/item/${code}`,
      data: { content }
    })
}
