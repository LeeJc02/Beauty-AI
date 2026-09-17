import request from '@/config/axios'
import type { SbMaterialGenerateReqVO, SbMaterialReferenceVO } from '@/api/ai-training/materialLibrary'

const AI_REQUEST_TIMEOUT = 300000

const buildPageParams = (params: any) => {
  const { lang, ...rest } = params || {}
  return lang ? { ...rest, businessLang: lang } : rest
}

export interface AiTrainingCustomerVO {
  id?: number
  lang: string
  title: string
  tags?: string
  imageUrl?: string
  avatarUrl?: string
  voiceId?: string
  description?: string
  flow?: string
  prompt?: string
  /** 引用素材编号：保存时登记引用关系，用于素材库的「被 N 个资产引用」。 */
  materialIds?: number[]
  /** 引用来源明细：编辑时展示这条内容来自哪段真实案例。 */
  materialReferences?: SbMaterialReferenceVO[]
  bmConfigId?: number
  bmPromptId?: number
  status: number
  creatorOrgId?: number
  createTime?: number
  updateTime?: number
  areaIds?: number[]
  areaNames?: string[]
  knowledgeBaseId?: number
  knowledgeDocumentIds?: number[]
  knowledgeDocuments?: AiTrainingKnowledgeDocumentBindVO[]
}

export interface AiTrainingKnowledgeDocumentBindVO {
  knowledgeBaseId?: number
  documentId?: number
  docId?: string
  docName?: string
}

export interface AiTrainingKnowledgeGenerateReqVO {
  lang: string
  knowledgeBaseId: number
  documentIds: number[]
  trainerNotes?: string
  bmConfigId?: number
}

export interface AiTrainingCustomerPreviewMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiTrainingKnowledgeHit {
  index?: number
  pointId?: string
  docId?: string
  docName?: string
  title?: string
  content?: string
  score?: number
  rerankScore?: number
}

export interface AiTrainingCustomerPreviewResp {
  previewSessionId?: string
  reply: string
  llmEnabled?: boolean
  promptChanged?: boolean
  promptTip?: string
  knowledgeEnabled?: boolean
  knowledgeHits?: AiTrainingKnowledgeHit[]
  knowledgeError?: string
}

export const AiTrainingCustomerApi = {
  getPage: async (params: any) => await request.get({ url: '/ai-training/customer/page', params: buildPageParams(params) }),
  get: async (id: number | string) => await request.get<AiTrainingCustomerVO>({ url: '/ai-training/customer/get', params: { id } }),
  create: async (data: AiTrainingCustomerVO) => await request.post<number>({ url: '/ai-training/customer/create', data }),
  update: async (data: AiTrainingCustomerVO) => await request.put<boolean>({ url: '/ai-training/customer/update', data }),
  delete: async (id: number) => await request.delete<boolean>({ url: '/ai-training/customer/delete', params: { id } }),
  generateFromKnowledge: async (data: AiTrainingKnowledgeGenerateReqVO) =>
    await request.post<{ draft: AiTrainingCustomerVO; knowledgeDocuments: AiTrainingKnowledgeDocumentBindVO[] }>({
      url: '/ai-training/customer/generate-from-knowledge',
      data,
      timeout: AI_REQUEST_TIMEOUT
    }),
  generateFromMaterials: async (data: SbMaterialGenerateReqVO) =>
    await request.post<{ draft: AiTrainingCustomerVO; knowledgeDocuments: AiTrainingKnowledgeDocumentBindVO[] }>({
      url: '/ai-training/customer/generate-from-materials',
      data,
      timeout: AI_REQUEST_TIMEOUT
    }),
  previewChat: async (data: Partial<AiTrainingCustomerVO> & {
    userMessage?: string
    history?: AiTrainingCustomerPreviewMessage[]
    previewSessionId?: string
    promptChanged?: boolean
    resetConversation?: boolean
  }) =>
    await request.post<AiTrainingCustomerPreviewResp>({
      url: '/ai-training/customer/preview-chat',
      data,
      timeout: AI_REQUEST_TIMEOUT
    })
}
