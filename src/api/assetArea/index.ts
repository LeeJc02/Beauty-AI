import request from '@/config/axios'

export interface AssetAreaOptionVO {
  id: number
  name: string
}

export interface AssetAreaOptionRespVO {
  strictAreaScope?: boolean
  canSelectAllAreas?: boolean
  options?: AssetAreaOptionVO[]
  defaultAreaIds?: number[]
  defaultAreaNames?: string[]
}

export const AssetAreaApi = {
  getOptions: async () => await request.get<AssetAreaOptionRespVO>({ url: '/asset-area/options' })
}
