import request from '@/config/axios'
import type { SbMaterialGenerateReqVO, SbMaterialQuoteVO, SbMaterialReferenceVO } from '@/api/ai-training/materialLibrary'

const AI_REQUEST_TIMEOUT = 300000

const buildPageParams = (params: any) => {
  const { lang, ...rest } = params || {}
  return lang ? { ...rest, businessLang: lang } : rest
}

export interface AiTrainingQuoteVO {
  id?: number
  text: string
  translation?: string
  hint?: string
  audioUrl?: string
  voiceId?: string
  audioText?: string
  sort?: number
  status?: number
  /** 引用素材编号：保存时登记引用关系。 */
  materialIds?: number[]
  /** 引用来源明细：编辑时展示这条金句来自哪段真实案例。 */
  materialReferences?: SbMaterialReferenceVO[]
}

export interface AiTrainingProductVO {
  id?: number
  brandId?: number
  categoryId?: number
  lang: string
  name: string
  description?: string
  imageUrl?: string
  tags?: string[]
  sort?: number
  status: number
  creatorOrgId?: number
  createTime?: number
  updateTime?: number
  areaIds?: number[]
  areaNames?: string[]
  quotes?: AiTrainingQuoteVO[]
}

export const AiTrainingProductApi = {
  getPage: async (params: any) => await request.get({ url: '/ai-training/product/page', params: buildPageParams(params) }),
  get: async (id: number | string) => await request.get<AiTrainingProductVO>({ url: '/ai-training/product/get', params: { id } }),
  create: async (data: AiTrainingProductVO) => await request.post<number>({ url: '/ai-training/product/create', data }),
  update: async (data: AiTrainingProductVO) => await request.put<boolean>({ url: '/ai-training/product/update', data }),
  delete: async (id: number) => await request.delete<boolean>({ url: '/ai-training/product/delete', params: { id } }),
  generateQuoteAudio: async (data: { quoteId?: number; lang: string; voiceId: string; text: string }) =>
    await request.post<{ audioUrl: string; voiceId: string; audioText: string }>({ url: '/ai-training/product/quote-audio/generate', data }),
  generateQuotesFromMaterials: async (data: SbMaterialGenerateReqVO) =>
    await request.post<{ quotes: SbMaterialQuoteVO[] }>({
      url: '/ai-training/product/quote/generate-from-materials',
      data,
      timeout: AI_REQUEST_TIMEOUT
    })
}
