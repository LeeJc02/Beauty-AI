import request from '@/config/axios'
import type { SbMaterialGenerateReqVO, SbMaterialReferenceVO } from '@/api/ai-training/materialLibrary'

const AI_REQUEST_TIMEOUT = 300000

const buildPageParams = (params: any) => {
  const { lang, ...rest } = params || {}
  return lang ? { ...rest, businessLang: lang } : rest
}

export interface AiTrainingSceneStepVO {
  id?: number
  stepNo: number
  title: string
  goal?: string
  guideText?: string
}

export interface AiTrainingSceneVO {
  id?: number
  lang: string
  title: string
  description?: string
  imageUrl?: string
  voiceId?: string
  tags?: string
  prompt?: string
  /** 引用素材编号：保存时登记引用关系。 */
  materialIds?: number[]
  /** 引用来源明细：编辑时展示这个剧本来自哪段真实案例。 */
  materialReferences?: SbMaterialReferenceVO[]
  bmConfigId?: number
  bmPromptId?: number
  status: number
  creatorOrgId?: number
  createTime?: number
  updateTime?: number
  areaIds?: number[]
  areaNames?: string[]
  steps?: AiTrainingSceneStepVO[]
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

export interface AiTrainingScenePreviewMessage {
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

export interface AiTrainingScenePreviewResp {
  previewSessionId?: string
  reply: string
  currentStepNo?: number
  stepCompleted?: boolean
  completedStepNo?: number
  reason?: string
  llmEnabled?: boolean
  promptChanged?: boolean
  promptTip?: string
  knowledgeEnabled?: boolean
  knowledgeHits?: AiTrainingKnowledgeHit[]
  knowledgeError?: string
}

export const AiTrainingSceneApi = {
  getPage: async (params: any) => await request.get({ url: '/ai-training/scene/page', params: buildPageParams(params) }),
  get: async (id: number | string) => await request.get<AiTrainingSceneVO>({ url: '/ai-training/scene/get', params: { id } }),
  create: async (data: AiTrainingSceneVO) => await request.post<number>({ url: '/ai-training/scene/create', data }),
  update: async (data: AiTrainingSceneVO) => await request.put<boolean>({ url: '/ai-training/scene/update', data }),
  delete: async (id: number) => await request.delete<boolean>({ url: '/ai-training/scene/delete', params: { id } }),
  generateFromKnowledge: async (data: AiTrainingKnowledgeGenerateReqVO) =>
    await request.post<{ draft: AiTrainingSceneVO; knowledgeDocuments: AiTrainingKnowledgeDocumentBindVO[] }>({
      url: '/ai-training/scene/generate-from-knowledge',
      data,
      timeout: AI_REQUEST_TIMEOUT
    }),
  generateFromMaterials: async (data: SbMaterialGenerateReqVO) =>
    await request.post<{ draft: AiTrainingSceneVO; knowledgeDocuments: AiTrainingKnowledgeDocumentBindVO[] }>({
      url: '/ai-training/scene/generate-from-materials',
      data,
      timeout: AI_REQUEST_TIMEOUT
    }),
  previewChat: async (data: Partial<AiTrainingSceneVO> & {
    userMessage?: string
    currentStepNo?: number
    history?: AiTrainingScenePreviewMessage[]
    previewSessionId?: string
    promptChanged?: boolean
    resetConversation?: boolean
  }) =>
    await request.post<AiTrainingScenePreviewResp>({
      url: '/ai-training/scene/preview-chat',
      data,
      timeout: AI_REQUEST_TIMEOUT
    })
}
