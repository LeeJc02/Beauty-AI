import request from '@/config/axios'

export interface AiVolcKnowledgeTagVO {
  fieldName: string
  fieldType: string
  fieldValue: string | string[] | number | boolean
}

export interface AiVolcKnowledgeBaseVO {
  id?: number
  name: string
  resourceId?: string
  collectionName?: string
  projectName?: string
  host?: string
  region?: string
  accessKey?: string
  secretKey?: string
  apiKey?: string
  accessKeyConfigured?: boolean
  secretKeyConfigured?: boolean
  apiKeyConfigured?: boolean
  parserStrategies?: AiVolcKnowledgeParserStrategyVO[]
  enabled: number
  description?: string
  createTime?: string
  updateTime?: string
}

export interface AiVolcKnowledgeParserStrategyVO {
  name: string
  resourceId: string
}

export interface AiVolcKnowledgeTagFieldVO {
  fieldName: string
  fieldType: string
  defaultValue?: string | string[] | number | boolean
  ifFilter?: boolean
}

export interface AiVolcKnowledgeTagFieldDetailVO {
  source: 'VOLC'
  message?: string
  fields: AiVolcKnowledgeTagFieldVO[]
}

export interface AiVolcKnowledgeDocumentVO {
  id: number
  knowledgeBaseId: number
  docId: string
  docName: string
  docType: string
  fileUrl: string
  fileName?: string
  fileSize?: number
  parserStrategyId?: string
  parserStrategyName?: string
  tags?: AiVolcKnowledgeTagVO[]
  taskId?: number
  processStatus?: number
  status: string
  failedCode?: number
  failedMsg?: string
  pointNum?: number
  docHash?: string
  docSummary?: string
  lastSyncTime?: string
  syncBatchNo?: string
  createTime?: string
  updateTime?: string
}

export interface AiVolcKnowledgePointVO {
  pointId: string
  docId?: string
  docName?: string
  title?: string
  content?: string
  mdContent?: string
  htmlContent?: string
  chunkType?: string
  score?: number
  rerankScore?: number
  attachments?: Record<string, any>[]
}

export interface AiAssistantConfigVO {
  id?: number
  assistantCode: string
  name: string
  enabled: number
  knowledgeBaseId?: number
  knowledgeEnabled: number
  knowledgeLimit?: number
  denseWeight?: number
  rerankEnabled?: number
  rerankRetrieveCount?: number
  rerankModel?: string
  rerankThreshold?: number
  rerankInstruction?: string
  chunkDiffusionCount?: number
  chunkGroup?: number
  getAttachmentLink?: number
  maxContextChars?: number
  failOnError?: number
  showSource?: number
  imageTextEnabled?: number
  bmConfigId?: number
  promptContent?: string
  welcomeText?: string
  suggestedQueries?: string
  remark?: string
}

export interface AiVolcKnowledgeDocumentSyncRespVO {
  syncBatchNo: string
  fetchedCount: number
  insertedCount: number
  updatedCount: number
  deletedCount: number
  duplicateCount?: number
  hasMore?: boolean
  nextToken?: string
}

export interface AiVolcKnowledgeSearchReqVO {
  knowledgeBaseId?: number
  query: string
  limit?: number
  denseWeight?: number
  rerankEnabled?: number
  rerankRetrieveCount?: number
  chunkDiffusionCount?: number
  chunkGroup?: number
  getAttachmentLink?: number
  tags?: AiVolcKnowledgeTagVO[]
  docIds?: string[]
}

export interface AiAssistantPreviewRespVO {
  reply: string
  llmEnabled: boolean
  knowledgeEnabled: boolean
  chunks: AiVolcKnowledgePointVO[]
  knowledgeError?: string
}

export const AiVolcKnowledgeApi = {
  getBasePage: async (params: any) => {
    return await request.get({ url: '/ai-resource/volc-knowledge/base/page', params })
  },
  getBase: async (id: number) => {
    return await request.get<AiVolcKnowledgeBaseVO>({ url: '/ai-resource/volc-knowledge/base/get', params: { id } })
  },
  createBase: async (data: AiVolcKnowledgeBaseVO) => {
    return await request.post<number>({ url: '/ai-resource/volc-knowledge/base/create', data })
  },
  updateBase: async (data: AiVolcKnowledgeBaseVO) => {
    return await request.put<boolean>({ url: '/ai-resource/volc-knowledge/base/update', data })
  },
  deleteBase: async (id: number) => {
    return await request.delete<boolean>({ url: '/ai-resource/volc-knowledge/base/delete', params: { id } })
  },
  getTagFields: async (knowledgeBaseId: number) => {
    return await request.get<AiVolcKnowledgeTagFieldVO[]>({
      url: '/ai-resource/volc-knowledge/base/tag-fields',
      params: { knowledgeBaseId }
    })
  },
  getTagFieldDetail: async (knowledgeBaseId: number) => {
    return await request.get<AiVolcKnowledgeTagFieldDetailVO>({
      url: '/ai-resource/volc-knowledge/base/tag-fields-detail',
      params: { knowledgeBaseId }
    })
  },
  updateTagFields: async (knowledgeBaseId: number, fields: AiVolcKnowledgeTagFieldVO[]) => {
    return await request.put<AiVolcKnowledgeTagFieldVO[]>({
      url: '/ai-resource/volc-knowledge/base/tag-fields',
      data: { knowledgeBaseId, fields }
    })
  },
  uploadDocument: async (data: FormData) => {
    const res = await request.upload({ url: '/ai-resource/volc-knowledge/document/upload', data, timeout: 180000, returnErrorMsg: true })
    return res.data
  },
  getDocumentPage: async (params: any) => {
    return await request.get({ url: '/ai-resource/volc-knowledge/document/page', params })
  },
  syncDocument: async (id: number) => {
    return await request.post<AiVolcKnowledgeDocumentVO>({ url: '/ai-resource/volc-knowledge/document/sync', params: { id } })
  },
  updateDocumentTags: async (data: { id: number; tags: AiVolcKnowledgeTagVO[] }) => {
    return await request.put<AiVolcKnowledgeDocumentVO>({ url: '/ai-resource/volc-knowledge/document/tags', data })
  },
  getDocumentTagOptions: async (knowledgeBaseId: number) => {
    return await request.get<Record<string, Array<string | number | boolean>>>({
      url: '/ai-resource/volc-knowledge/document/tag-options',
      params: { knowledgeBaseId }
    })
  },
  syncDocumentsFromVolc: async (params: { knowledgeBaseId: number; syncBatchNo?: string; nextToken?: string; limit?: number }) => {
    return await request.post<AiVolcKnowledgeDocumentSyncRespVO>({
      url: '/ai-resource/volc-knowledge/document/sync-all',
      params
    })
  },
  getPointPage: async (params: any) => {
    return await request.get({ url: '/ai-resource/volc-knowledge/point/page', params })
  },
  search: async (data: AiVolcKnowledgeSearchReqVO) => {
    return await request.post({ url: '/ai-resource/volc-knowledge/search', data })
  },
  getAssistantConfig: async (assistantCode = 'APP_AI_ASSISTANT') => {
    return await request.get<AiAssistantConfigVO>({ url: '/ai-resource/volc-knowledge/assistant-config/get', params: { assistantCode } })
  },
  saveAssistantConfig: async (data: AiAssistantConfigVO) => {
    return await request.put<AiAssistantConfigVO>({ url: '/ai-resource/volc-knowledge/assistant-config/save', data })
  },
  previewAssistant: async (data: Partial<AiAssistantConfigVO> & { query: string }) => {
    return await request.post<AiAssistantPreviewRespVO>({ url: '/ai-resource/volc-knowledge/assistant-config/preview', data })
  }
}
