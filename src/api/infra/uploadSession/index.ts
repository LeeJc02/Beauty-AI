import request from '@/config/axios'

/** 浏览器上传会话响应 VO */
export interface BrowserUploadSessionRespVO {
  uploadId: string
  configId: number
  provider: string // aliyun_oss | tencent_cos | s3_compatible
  mode: string // sts_sdk | presigned_put
  bucket?: string
  region?: string
  endpoint?: string
  objectKey: string
  // STS SDK 凭证
  accessKeyId?: string
  accessKeySecret?: string
  securityToken?: string
  expiration?: string
  // 预签名 PUT
  presignedUploadUrl?: string
  // 对象访问 URL（complete 后返回）
  objectUrl?: string
}

/** 浏览器上传会话初始化请求 VO */
export interface BrowserUploadSessionInitReqVO {
  uploadId?: string
  name: string
  size: number
  type?: string
  pathPrefix?: string
}

/** 浏览器上传会话刷新请求 VO */
export interface BrowserUploadSessionRefreshReqVO {
  uploadId: string
}

/** 浏览器上传会话完成请求 VO */
export interface BrowserUploadSessionCompleteReqVO {
  uploadId: string
  objectKey: string
  name: string
  size: number
  type?: string
}

/** 浏览器上传会话中止请求 VO */
export interface BrowserUploadSessionAbortReqVO {
  uploadId: string
}

/** 浏览器上传会话 API */
export const BrowserUploadSessionApi = {
  /** 初始化上传会话 */
  initUploadSession: async (data: BrowserUploadSessionInitReqVO): Promise<BrowserUploadSessionRespVO> => {
    return await request.post({ url: '/infra/file/upload-session/init', data })
  },

  /** 刷新上传会话凭证 */
  refreshUploadSession: async (data: BrowserUploadSessionRefreshReqVO): Promise<BrowserUploadSessionRespVO> => {
    return await request.post({ url: '/infra/file/upload-session/refresh', data })
  },

  /** 完成上传会话 */
  completeUploadSession: async (data: BrowserUploadSessionCompleteReqVO): Promise<BrowserUploadSessionRespVO> => {
    return await request.post({ url: '/infra/file/upload-session/complete', data })
  },

  /** 中止上传会话 */
  abortUploadSession: async (data: BrowserUploadSessionAbortReqVO): Promise<boolean> => {
    return await request.post({ url: '/infra/file/upload-session/abort', data })
  }
}
