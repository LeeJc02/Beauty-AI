declare module 'ali-oss' {
  export interface OSSOptions {
    region?: string
    endpoint?: string
    bucket?: string
    accessKeyId: string
    accessKeySecret: string
    stsToken?: string
    secure?: boolean
    refreshSTSTokenInterval?: number
    refreshSTSToken?: () => Promise<{
      accessKeyId: string
      accessKeySecret: string
      stsToken?: string
    }>
  }

  export interface MultipartUploadOptions {
    checkpoint?: unknown
    mime?: string
    progress?: (progress: number, checkpoint?: unknown) => void
  }

  export default class OSS {
    constructor(options: OSSOptions)
    multipartUpload(name: string, file: File | Blob, options?: MultipartUploadOptions): Promise<unknown>
    cancel?: () => void
  }
}
