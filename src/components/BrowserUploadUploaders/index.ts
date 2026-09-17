import type { BrowserUploadSessionRespVO } from '@/api/infra/uploadSession'

export interface BrowserUploaderUploadOptions {
  chunkSize?: number
}

/** 上传器接口 */
export interface BrowserUploader {
  /** 执行上传 */
  upload(
    file: File,
    objectKey: string,
    onProgress: (progress: number) => void,
    options?: BrowserUploaderUploadOptions
  ): Promise<void>

  /** 取消上传 */
  cancel(): void
}

/** 上传器工厂入参 */
export interface UploaderFactoryOptions {
  session: BrowserUploadSessionRespVO
  refreshCredentials: () => Promise<BrowserUploadSessionRespVO>
}

/**
 * 根据 provider + mode 创建对应的上传器实例。
 */
export function createUploader(options: UploaderFactoryOptions): BrowserUploader {
  const { session } = options

  // 本地演示模式：不真的上传，仅模拟进度（由本地 mock 的 upload-session 返回该 mode）
  if (session.mode === 'local_demo') {
    return new LocalDemoUploader()
  }

  if (session.mode === 'presigned_put') {
    return new PresignedPutUploader(session)
  }

  // STS_SDK
  switch (session.provider) {
    case 'aliyun_oss':
      return new AliyunOssUploader(options)
    case 'tencent_cos':
      return new TencentCosUploader(options)
    default:
      throw new Error(`不支持的浏览器直传提供商: ${session.provider}`)
  }
}

// ========== 阿里云 OSS 上传器 ==========

class AliyunOssUploader implements BrowserUploader {
  private client: any = null
  private cancelled = false
  private options: UploaderFactoryOptions

  constructor(options: UploaderFactoryOptions) {
    this.options = options
  }

  async upload(file: File, objectKey: string, onProgress: (progress: number) => void, _options?: BrowserUploaderUploadOptions): Promise<void> {
    // 动态导入 ali-oss 避免 Tree Shaking 问题
    const OSS = (await import('ali-oss')).default
    const session = this.options.session

    this.client = new OSS({
      region: session.region!,
      endpoint: session.endpoint,
      bucket: session.bucket!,
      accessKeyId: session.accessKeyId!,
      accessKeySecret: session.accessKeySecret!,
      stsToken: session.securityToken!,
      secure: session.endpoint ? session.endpoint.startsWith('https://') || !session.endpoint.startsWith('http://') : true,
      refreshSTSTokenInterval: 15 * 60 * 1000,
      refreshSTSToken: async () => {
        if (this.cancelled) {
          return {
            accessKeyId: session.accessKeyId!,
            accessKeySecret: session.accessKeySecret!,
            stsToken: session.securityToken!
          }
        }
        const refreshed = await this.options.refreshCredentials()
        this.options.session = refreshed
        return {
          accessKeyId: refreshed.accessKeyId!,
          accessKeySecret: refreshed.accessKeySecret!,
          stsToken: refreshed.securityToken!
        }
      }
    })

    await this.client.multipartUpload(objectKey, file, {
      mime: file.type || 'application/octet-stream',
      progress: (progress: number) => {
        if (!this.cancelled) {
          onProgress(Math.min(99, Math.floor(progress * 100)))
        }
      }
    })

    if (this.cancelled) {
      throw new Error('上传已取消')
    }
  }

  cancel(): void {
    this.cancelled = true
    this.client?.cancel?.()
  }
}

// ========== 腾讯云 COS 上传器 ==========

class TencentCosUploader implements BrowserUploader {
  private cancelled = false
  private cosInstance: any = null
  private taskId: any = null
  private rejectUpload: ((reason?: any) => void) | null = null
  private options: UploaderFactoryOptions

  constructor(options: UploaderFactoryOptions) {
    this.options = options
  }

  async upload(file: File, objectKey: string, onProgress: (progress: number) => void, options?: BrowserUploaderUploadOptions): Promise<void> {
    // 动态导入 cos-js-sdk-v5
    const COS = (await import('cos-js-sdk-v5')).default
    const session = this.options.session

    // 根据 session.endpoint 动态设置 Domain（例如加速域名 cos.accelerate.myqcloud.com）
    const cosOptions: any = {
      getAuthorization: async (_options: any, callback: (credentials: any) => void) => {
        if (this.cancelled) return
        try {
          const refreshed = await this.options.refreshCredentials()
          this.options.session = refreshed
          callback({
            TmpSecretId: refreshed.accessKeyId!,
            TmpSecretKey: refreshed.accessKeySecret!,
            SecurityToken: refreshed.securityToken!,
            StartTime: Math.floor(Date.now() / 1000) - 60,
            ExpiredTime: refreshed.expiration
              ? Math.floor(new Date(refreshed.expiration).getTime() / 1000)
              : Math.floor(Date.now() / 1000) + 1800
          })
        } catch (e) {
          callback(e as Error)
        }
      }
    }
    if (session.endpoint) {
      try {
        const ep = new URL(session.endpoint)
        const defaultDomain = `cos.${session.region}.myqcloud.com`
        if (ep.host !== defaultDomain) {
          cosOptions.Domain = `{Bucket}.${ep.host}`
        }
      } catch { /* endpoint 不是合法 URL 时忽略 */ }
    }

    this.cosInstance = new COS(cosOptions)

    await new Promise<void>((resolve, reject) => {
      this.rejectUpload = reject
      this.cosInstance.sliceUploadFile(
        {
          Bucket: session.bucket!,
          Region: session.region!,
          Key: objectKey,
          Body: file,
          ChunkSize: options?.chunkSize,
          onTaskReady: (taskId: any) => {
            this.taskId = taskId
            if (this.cancelled) {
              this.cosInstance.cancelTask(taskId)
            }
          },
          onProgress: (progressData: any) => {
            if (!this.cancelled) {
              onProgress(Math.min(99, Math.floor(progressData.percent * 100)))
            }
          }
        },
        (err: any) => {
          this.rejectUpload = null
          this.taskId = null
          if (this.cancelled) {
            reject(new Error('上传已取消'))
          } else if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  }

  cancel(): void {
    this.cancelled = true
    if (this.taskId) {
      this.cosInstance?.cancelTask(this.taskId)
    }
    this.rejectUpload?.(new Error('上传已取消'))
    this.rejectUpload = null
  }
}

// ========== 预签名 PUT 上传器 ==========
class PresignedPutUploader implements BrowserUploader {
  private abortController: AbortController | null = null
  private session: BrowserUploadSessionRespVO

  constructor(session: BrowserUploadSessionRespVO) {
    this.session = session
  }

  async upload(file: File, _objectKey: string, onProgress: (progress: number) => void, _options?: BrowserUploaderUploadOptions): Promise<void> {
    this.abortController = new AbortController()

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', this.session.presignedUploadUrl!, true)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.min(99, Math.floor((event.loaded / event.total) * 100)))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`PUT upload failed: ${xhr.status} ${xhr.statusText}`))
        }
      }

      xhr.onerror = () => reject(new Error('PUT upload network error'))
      xhr.onabort = () => reject(new Error('上传已取消'))

      // 绑定 AbortController
      this.abortController!.signal.addEventListener('abort', () => xhr.abort())

      xhr.send(file)
    })
  }

  cancel(): void {
    this.abortController?.abort()
  }
}

// ========== 本地演示上传器 ==========

/**
 * 本地演示上传器：不产生任何网络请求，只按固定节奏推进进度。
 *
 * 用途：Beauty-AI 是纯前端演示工程，本地 mock 的 upload-session 会返回 `mode: 'local_demo'`，
 * 让「上传素材 → 生成课件」的完整交互离线也能演示。
 */
class LocalDemoUploader implements BrowserUploader {
  private cancelled = false
  private timer: ReturnType<typeof setInterval> | null = null

  async upload(
    _file: File,
    _objectKey: string,
    onProgress: (progress: number) => void,
    _options?: BrowserUploaderUploadOptions
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let progress = 0
      this.timer = setInterval(() => {
        if (this.cancelled) {
          if (this.timer) clearInterval(this.timer)
          this.timer = null
          reject(new Error('上传已取消'))
          return
        }
        progress = Math.min(100, progress + 12 + Math.round(Math.random() * 8))
        if (progress >= 99) {
          onProgress(99)
          if (this.timer) clearInterval(this.timer)
          this.timer = null
          resolve()
          return
        }
        onProgress(progress)
      }, 90)
    })
  }

  cancel(): void {
    this.cancelled = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
