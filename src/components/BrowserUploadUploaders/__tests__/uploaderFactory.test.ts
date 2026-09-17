/**
 * 前端 uploader factory 行为的静态类型/接口检查。
 *
 * 这些测试验证 createUploader 根据 provider + mode 返回正确的 uploader 实例。
 * 运行方式: pnpm vitest run src/components/BrowserUploadUploaders/__tests__/uploaderFactory.test.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { createUploader, type UploaderFactoryOptions } from '../index'
import type { BrowserUploadSessionRespVO } from '@/api/infra/uploadSession'

function makeSession(overrides: Partial<BrowserUploadSessionRespVO> = {}): BrowserUploadSessionRespVO {
  return {
    uploadId: 'test-upload-id',
    configId: 1,
    provider: 'aliyun_oss',
    mode: 'sts_sdk',
    bucket: 'test-bucket',
    region: 'cn-beijing',
    endpoint: 'https://oss-cn-beijing.aliyuncs.com',
    objectKey: 'path/to/file.pdf',
    accessKeyId: 'temp-ak',
    accessKeySecret: 'temp-sk',
    securityToken: 'temp-token',
    expiration: new Date(Date.now() + 3600000).toISOString(),
    presignedUploadUrl: undefined,
    objectUrl: undefined,
    ...overrides
  }
}

function makeOptions(session: BrowserUploadSessionRespVO): UploaderFactoryOptions {
  return {
    session,
    refreshCredentials: vi.fn(async () => session)
  }
}

describe('createUploader', () => {
  it('should create PresignedPutUploader for presigned_put mode', () => {
    const session = makeSession({ mode: 'presigned_put', presignedUploadUrl: 'https://example.com/put' })
    const uploader = createUploader(makeOptions(session))
    expect(uploader).toBeDefined()
    expect(typeof uploader.upload).toBe('function')
    expect(typeof uploader.cancel).toBe('function')
  })

  it('should throw for unsupported provider with sts_sdk', () => {
    const session = makeSession({ provider: 's3_compatible', mode: 'sts_sdk' })
    expect(() => createUploader(makeOptions(session))).toThrow('不支持的浏览器直传提供商')
  })

  it('should create uploader for aliyun_oss + sts_sdk', () => {
    const session = makeSession({ provider: 'aliyun_oss', mode: 'sts_sdk' })
    const uploader = createUploader(makeOptions(session))
    expect(uploader).toBeDefined()
    expect(typeof uploader.upload).toBe('function')
    expect(typeof uploader.cancel).toBe('function')
  })

  it('should create uploader for tencent_cos + sts_sdk', () => {
    const session = makeSession({ provider: 'tencent_cos', mode: 'sts_sdk' })
    const uploader = createUploader(makeOptions(session))
    expect(uploader).toBeDefined()
    expect(typeof uploader.upload).toBe('function')
    expect(typeof uploader.cancel).toBe('function')
  })

  it('presigned_put should work regardless of provider', () => {
    const session = makeSession({ provider: 'aliyun_oss', mode: 'presigned_put', presignedUploadUrl: 'https://example.com/put' })
    const uploader = createUploader(makeOptions(session))
    expect(uploader).toBeDefined()
  })
})
