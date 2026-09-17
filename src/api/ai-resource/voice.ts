import request from '@/config/axios'

const buildPageParams = (params: AiVoicePageReqVO) => {
  const { lang, ...rest } = params || {}
  return lang ? { ...rest, businessLang: lang } : rest
}

export interface AiVoiceVO {
  id?: number
  voiceId: string
  voiceName: string
  lang: 'cn' | 'en' | 'id' | string
  gender: 1 | 2 | number
  tag?: string[]
  describe?: string
  createTime?: string
  updateTime?: string
}

export interface AiVoicePageReqVO {
  pageNo: number
  pageSize: number
  keyword?: string
  lang?: string
  gender?: number
}

export const AiVoiceApi = {
  getPage: async (params: AiVoicePageReqVO) => {
    return await request.get({ url: '/ai-resource/voice/page', params: buildPageParams(params) })
  },

  getList: async (lang?: string) => {
    return await request.get<AiVoiceVO[]>({ url: '/ai-resource/voice/list', params: { lang } })
  },

  get: async (id: number) => {
    return await request.get<AiVoiceVO>({ url: '/ai-resource/voice/get', params: { id } })
  },

  create: async (data: AiVoiceVO) => {
    return await request.post<number>({ url: '/ai-resource/voice/create', data })
  },

  update: async (data: AiVoiceVO) => {
    return await request.put<boolean>({ url: '/ai-resource/voice/update', data })
  },

  delete: async (id: number) => {
    return await request.delete<boolean>({ url: '/ai-resource/voice/delete', params: { id } })
  }
}
