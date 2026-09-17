import request from '@/config/axios'

export interface AiFileParseFileVO {
  id: number
  name: string
  originalFileName: string
  fileUrl: string
  fileType: string
  mimeType?: string
  fileSize?: number
  lang?: string
  purpose: string
  parseStatus: string
  imageStatus: string
  productStatus: string
  knowledgeStatus: string
  currentResultId?: number
  lastTaskId?: number
  errorMessage?: string
  pageCount?: number
  slideCount?: number
  createTime?: string
  updateTime?: string
}

export interface AiFileParseTaskVO {
  id: number
  fileId: number
  provider: string
  providerBatchId?: string
  providerDataId?: string
  providerState?: string
  status: string
  stage?: string
  submitPayload?: Record<string, any>
  rawResponse?: Record<string, any>
  resultZipUrl?: string
  errorMessage?: string
  progressExtractedPages?: number
  progressTotalPages?: number
  submittedAt?: string
  finishedAt?: string
  createTime?: string
}

export interface AiFileParseResultVO {
  id: number
  fileId: number
  taskId: number
  versionNo: number
  markdownContent?: string
  jsonContent?: string
  imageList?: Record<string, any>[]
  issueList?: Record<string, any>[]
  rawMetadata?: Record<string, any>
  resultZipUrl?: string
  markdownCharCount?: number
  imageCount?: number
  createTime?: string
}

export interface AiFileParseDetailVO {
  file: AiFileParseFileVO
  currentResult?: AiFileParseResultVO
  tasks: AiFileParseTaskVO[]
}

export interface AiFileParseUploadRespVO {
  fileId: number
  fileUrl: string
  fileType: string
  parseStatus: string
  taskId?: number
  errorMessage?: string
}

export interface AiFileParseResultUpdateReqVO {
  resultId: number
  markdownContent?: string
  jsonContent?: string
}

export type AiFileParseResultContentType = 'markdown' | 'json' | 'images' | 'issues'

export const AiFileParseApi = {
  upload: async (data: FormData) => {
    const res = await request.upload({ url: '/ai-resource/file-parse/upload', data })
    return res.data as AiFileParseUploadRespVO
  },

  submit: async (fileId: number, ocr = true) => {
    return await request.post<AiFileParseDetailVO>({
      url: '/ai-resource/file-parse/submit',
      data: { fileId, ocr }
    })
  },

  sync: async (fileId: number) => {
    return await request.post<AiFileParseDetailVO>({
      url: '/ai-resource/file-parse/sync',
      params: { fileId }
    })
  },

  getPage: async (params: any) => {
    return await request.get({ url: '/ai-resource/file-parse/page', params })
  },

  get: async (id: number) => {
    return await request.get<AiFileParseDetailVO>({ url: '/ai-resource/file-parse/get', params: { id } })
  },

  updateResult: async (data: AiFileParseResultUpdateReqVO) => {
    return await request.post<AiFileParseDetailVO>({ url: '/ai-resource/file-parse/result/update', data })
  },

  getResultContent: async (resultId: number, contentType: AiFileParseResultContentType) => {
    return await request.get<AiFileParseResultVO>({
      url: '/ai-resource/file-parse/result/content',
      params: { resultId, contentType }
    })
  },

  rebuildResult: async (fileId: number) => {
    return await request.post<AiFileParseDetailVO>({ url: '/ai-resource/file-parse/result/rebuild', params: { fileId } })
  },

  previewOriginal: async (id: number) => {
    return await request.download<Blob>({
      url: '/ai-resource/file-parse/preview-original',
      params: { id },
      timeout: 300000
    })
  },

  delete: async (id: number) => {
    return await request.delete<boolean>({ url: '/ai-resource/file-parse/delete', params: { id } })
  }
}
