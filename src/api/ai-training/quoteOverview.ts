import request from '@/config/axios'

export type QuoteAudioStatus = 'READY' | 'INCOMPLETE'
export type QuoteConfigurationStatus = 'UNCONFIGURED' | 'CONFIGURED_DISABLED' | 'ENABLED'

export interface QuoteOverviewPageReqVO {
  pageNo: number
  pageSize: number
  keyword?: string
  businessLang?: string
  brandId?: number
  categoryId?: number
  areaIds?: number[]
  productStatus?: number
  quoteStatus?: number
  audioStatus?: QuoteAudioStatus
  configurationStatus?: QuoteConfigurationStatus
}

export interface QuoteOverviewStatsVO {
  productCount: number
  configuredProductCount: number
  unconfiguredProductCount: number
  quoteCount: number
  audioReadyQuoteCount: number
}

export interface QuoteOverviewVO {
  quoteId: number
  productId: number
  quoteText: string
  quoteHint?: string
  quoteStatus: number
  audioUrl?: string
  audioReady: boolean
  productName: string
  productStatus: number
  businessLang: string
  brandId?: number
  brandName?: string
  categoryId?: number
  seriesName?: string
  categoryName?: string
  areaNames?: string
  updateTime?: string
}

export interface ProductQuoteCoverageVO {
  productId: number
  productName: string
  productStatus: number
  businessLang: string
  brandId?: number
  brandName?: string
  categoryId?: number
  seriesName?: string
  categoryName?: string
  areaNames?: string
  quoteCount: number
  audioReadyQuoteCount: number
  configurationStatus: QuoteConfigurationStatus
  updateTime?: string
}

export const AiTrainingQuoteOverviewApi = {
  getStats: async (params: Partial<QuoteOverviewPageReqVO>) =>
    await request.get<QuoteOverviewStatsVO>({ url: '/ai-training/quote-overview/stats', params }),

  getQuotePage: async (params: QuoteOverviewPageReqVO) =>
    await request.get<PageResult<QuoteOverviewVO[]>>({ url: '/ai-training/quote-overview/quote-page', params }),

  getProductPage: async (params: QuoteOverviewPageReqVO) =>
    await request.get<PageResult<ProductQuoteCoverageVO[]>>({ url: '/ai-training/quote-overview/product-page', params })
}
