import request from '@/config/axios'
import qs from 'qs'

export interface NotifyMessageVO {
  id: number
  userId: number
  userType: number
  templateId: number
  templateCode: string
  templateNickname: string
  templateContent: string
  templateType: number
  templateParams: string
  notifyCategory?: string
  bizType?: string
  bizId?: string
  actionUrl?: string
  snapshot?: Record<string, any>
  readStatus: boolean
  readTime: Date
  createTime: Date
}

export interface NotifyTaskMessageVO {
  id: number
  notifyCategory: string
  bizType: string
  bizId: string
  title: string
  status?: number
  progress?: number
  actionUrl?: string
  snapshot?: Record<string, any>
  createTime: Date
  updateTime?: Date
}

// 查询站内信消息列表
export const getNotifyMessagePage = async (params: PageParam) => {
  return await request.get({ url: '/system/notify-message/page', params })
}

// 获得我的站内信分页
export const getMyNotifyMessagePage = async (params: PageParam) => {
  return await request.get({ url: '/system/notify-message/my-page', params })
}

// 批量标记已读
export const updateNotifyMessageRead = async (ids) => {
  return await request.put({
    url: '/system/notify-message/update-read?' + qs.stringify({ ids: ids }, { indices: false })
  })
}

// 标记所有站内信为已读
export const updateAllNotifyMessageRead = async () => {
  return await request.put({ url: '/system/notify-message/update-all-read' })
}

// 获取当前用户的最新站内信列表
export const getUnreadNotifyMessageList = async () => {
  return await request.get({ url: '/system/notify-message/get-unread-list' })
}

// 获取当前用户的活跃任务通知列表
export const getActiveTaskNotifyMessageList = async () => {
  return await request.get({ url: '/system/notify-message/active-task-list' })
}

// 获取当前用户的活跃任务通知数量
export const getActiveTaskNotifyMessageCount = async () => {
  return await request.get({ url: '/system/notify-message/active-task-count' })
}

// 获得当前用户的未读站内信数量
export const getUnreadNotifyMessageCount = async () => {
  return await request.get({ url: '/system/notify-message/get-unread-count' })
}
