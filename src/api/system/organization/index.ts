import request from '@/config/axios'
import type { DeptVO } from '@/api/system/dept'

export interface SbJurisdictionVO {
  userId?: number
  username?: string
  nickname?: string
  deptId?: number
  deptName?: string
  roleNames?: string[]
  status: number
  areaIds: number[]
  areaNames?: string[]
}

export interface SbJurisdictionPageReqVO {
  pageNo: number
  pageSize: number
  keyword?: string
  status?: number
  deptId?: number
  postId?: number
}

export interface SbJurisdictionUserPageReqVO {
  pageNo: number
  pageSize: number
  keyword?: string
  status?: number
  deptId?: number
}

export interface FeishuDepartmentTreeVO {
  openDepartmentId: string
  parentOpenDepartmentId?: string
  name: string
  memberCount?: number
  children?: FeishuDepartmentTreeVO[]
}

export interface FeishuDepartmentVO {
  openDepartmentId: string
  parentOpenDepartmentId?: string
  name: string
  i18nNameZhCn?: string
  i18nNameEnUs?: string
  leaderOpenId?: string
  leaderName?: string
  leaderEmployeeNo?: string
  memberCount?: number
  primaryMemberCount?: number
  deletedInFeishu?: boolean
}

export interface FeishuEmployeeVO {
  id: number
  adminUserId?: number
  openId: string
  employeeNo?: string
  name: string
  enName?: string
  nickname?: string
  email?: string
  enterpriseEmail?: string
  mobile?: string
  jobTitle?: string
  jobLevelId?: string
  employeeType?: number
  employeeTypeName?: string
  employeeTypeEnumType?: number
  employeeTypeEnumStatus?: number
  primaryOpenDepartmentId?: string
  country?: string
  city?: string
  geo?: string
  workStation?: string
  avatar72?: string
  avatar240?: string
  avatar640?: string
  avatarOrigin?: string
  description?: string
  joinTime?: string
  isActivated?: boolean
  isExited?: boolean
  isFrozen?: boolean
  isResigned?: boolean
  isUnjoin?: boolean
}

export interface FeishuEmployeePageReqVO extends PageParam {
  name?: string
  employeeNo?: string
  email?: string
  openDepartmentId?: string
}

export interface FeishuSyncRespVO {
  syncLogId: number
  rootDepartmentCount: number
  departmentCount: number
  employeeCount: number
  message?: string
  status?: number
  startTime?: string
  endTime?: string
}

export const FeishuOrganizationApi = {
  sync: async (): Promise<FeishuSyncRespVO> => {
    return await request.post({ url: '/system/feishu-organization/sync' })
  },

  getDepartmentTree: async (): Promise<FeishuDepartmentTreeVO[]> => {
    return await request.get({ url: '/system/feishu-organization/department-tree' })
  },

  getRunningSync: async (): Promise<FeishuSyncRespVO | null> => {
    return await request.get({ url: '/system/feishu-organization/sync-running' })
  },

  getDepartment: async (openDepartmentId: string): Promise<FeishuDepartmentVO> => {
    return await request.get({
      url: '/system/feishu-organization/department',
      params: { openDepartmentId }
    })
  },

  getEmployeePage: async (params: FeishuEmployeePageReqVO) => {
    return await request.get({ url: '/system/feishu-organization/employee-page', params })
  }
}

export const SbJurisdictionApi = {
  getAreaOptions: async () => {
    return await request.get<DeptVO[]>({
      url: '/system/jurisdiction/area-options'
    })
  },

  getPage: async (params: SbJurisdictionPageReqVO) => {
    return await request.get<PageResult<SbJurisdictionVO[]>>({
      url: '/system/jurisdiction/page',
      params
    })
  },

  getUserPage: async (params: SbJurisdictionUserPageReqVO) => {
    return await request.get<PageResult<SbJurisdictionVO[]>>({
      url: '/system/jurisdiction/user-page',
      params
    })
  },

  get: async (userId: number) => {
    return await request.get<SbJurisdictionVO>({
      url: '/system/jurisdiction/get',
      params: { id: userId }
    })
  },

  create: async (data: SbJurisdictionVO) => {
    return await request.post<number>({ url: '/system/jurisdiction/create', data })
  },

  update: async (data: SbJurisdictionVO) => {
    return await request.put<boolean>({ url: '/system/jurisdiction/update', data })
  },

  delete: async (userId: number) => {
    return await request.delete<boolean>({ url: '/system/jurisdiction/delete', params: { id: userId } })
  }
}
