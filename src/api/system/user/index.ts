import request from '@/config/axios'
import type { DeptVO } from '@/api/system/dept'

export interface UserVO {
  id: number
  username: string
  nickname: string
  deptId: number
  deptName?: string
  trainingUserType?: 'TRAINER' | 'BA'
  trainingAreaId?: number
  trainingAreaName?: string
  trainingManagerId?: number
  trainingManagerName?: string
  trainingTrainerUserId?: number
  trainingTrainerName?: string
  postIds: string[]
  roleNames?: string[]
  email: string
  mobile: string
  sex: number
  avatar: string
  loginIp: string
  status: number
  remark: string
  loginDate: Date
  joinTime?: string | number | Date
  createTime: Date
}

export interface UserPageReqVO extends PageParam {
  username?: string
  nickname?: string
  deptName?: string
  mobile?: string
  postId?: number
  roleId?: number
  status?: number
  activated?: boolean
  deptId?: number
  joinTime?: Array<string | number | Date>
  sortField?: string
  sortOrder?: string
}

// 查询用户管理列表
export const getUserPage = (params: UserPageReqVO) => {
  return request.get({ url: '/system/user/page', params })
}

export const getUserDeptOptions = (): Promise<DeptVO[]> => {
  return request.get({ url: '/system/user/dept-options' })
}

// 查询用户详情
export const getUser = (id: number) => {
  return request.get({ url: '/system/user/get?id=' + id })
}

// 新增用户
export const createUser = (data: UserVO) => {
  return request.post({ url: '/system/user/create', data })
}

// 修改用户
export const updateUser = (data: UserVO) => {
  return request.put({ url: '/system/user/update', data })
}

// 删除用户
export const deleteUser = (id: number) => {
  return request.delete({ url: '/system/user/delete?id=' + id })
}

// 批量删除用户
export const deleteUserList = (ids: number[]) => {
  return request.delete({ url: '/system/user/delete-list', params: { ids: ids.join(',') } })
}

// 导出用户
export const exportUser = (params: any) => {
  return request.download({ url: '/system/user/export-excel', params })
}

// 下载用户导入模板
export const importUserTemplate = () => {
  return request.download({ url: '/system/user/get-import-template' })
}

// 用户密码重置
export const resetUserPassword = (id: number, password: string) => {
  const data = {
    id,
    password
  }
  return request.put({ url: '/system/user/update-password', data: data })
}

// 用户状态修改
export const updateUserStatus = (id: number, status: number) => {
  const data = {
    id,
    status
  }
  return request.put({ url: '/system/user/update-status', data: data })
}

// 获取用户精简信息列表
export const getSimpleUserList = (): Promise<UserVO[]> => {
  return request.get({ url: '/system/user/simple-list' })
}
