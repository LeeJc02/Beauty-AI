import request from '@/config/axios'

export interface TagVO {
  id: number
  categoryId: number
  name: string
  sort: number
  status?: number
  contentCount?: number
}

export interface BrandVO {
  id: number
  name: string
  shortName?: string
  lang?: string
  logoUrl?: string
  sort: number
  status: number
  remark?: string
}

export interface CategoryVO {
  id: number
  brandId?: number
  parentId?: number
  level?: number
  name: string
  sort: number
  status: number
  remark?: string
  subTags: TagVO[]
  children?: TagVO[]
  contentCount?: number
  createTime?: string
}

export interface CategorySaveVO {
  id?: number
  brandId?: number
  parentId?: number
  lang?: string
  name: string
  sort: number
  status: number
  remark?: string
}

export interface TagSaveVO {
  categoryId: number
  name: string
  sort?: number
}

export const CategorySettingsApi = {
  getBrandList: async (params?: { lang?: string }) => {
    return await request.get<BrandVO[]>({ url: '/category/brand/list', params })
  },

  createBrand: async (data: Omit<BrandVO, 'id'> & { id?: number }) => {
    return await request.post<number>({ url: '/category/brand/create', data })
  },

  updateBrand: async (data: BrandVO) => {
    return await request.put<boolean>({ url: '/category/brand/update', data })
  },

  deleteBrand: async (id: number) => {
    return await request.delete<boolean>({ url: '/category/brand/delete', params: { id } })
  },

  getCategoryList: async (params?: { lang?: string }) => {
    return await request.get<CategoryVO[]>({ url: '/category/list', params })
  },

  getCategoryProductCount: async (categoryId: number) => {
    return await request.get<{
      categoryId: number
      name: string
      directCount: number
      totalCount: number
      children: Array<{ categoryId: number; name: string; directCount: number; totalCount: number }>
    }>({ url: '/category/product-count', params: { categoryId } })
  },

  createCategory: async (data: CategorySaveVO) => {
    return await request.post<number>({ url: '/category/create', data })
  },

  updateCategory: async (data: CategorySaveVO) => {
    return await request.put<boolean>({ url: '/category/update', data })
  },

  deleteCategory: async (id: number) => {
    return await request.delete<boolean>({ url: '/category/delete', params: { id } })
  },

  createTag: async (data: TagSaveVO) => {
    return await request.post<number>({ url: '/category/tag/create', data })
  },

  deleteTag: async (id: number) => {
    return await request.delete<boolean>({ url: '/category/tag/delete', params: { id } })
  }
}
