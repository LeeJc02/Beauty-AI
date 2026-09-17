import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
  ElMessageBox: { confirm: vi.fn(() => new Promise(() => {})) },
  ElNotification: { error: vi.fn() }
}))
vi.mock('@/utils/auth', () => ({
  getAccessToken: vi.fn(),
  getTenantId: vi.fn(),
  getVisitTenantId: vi.fn(),
  removeToken: vi.fn()
}))
vi.mock('@/router', () => ({ resetRouter: vi.fn() }))
vi.mock('@/hooks/web/useCache', () => ({ deleteUserCache: vi.fn() }))
vi.mock('@/utils/encrypt', () => ({ ApiEncrypt: { getEncryptHeader: () => 'encrypted' } }))
vi.mock('@/store/modules/locale', () => ({
  useLocaleStoreWithOut: () => ({ getCurrentLocale: { lang: 'zh-CN' } })
}))

import { ElMessage, ElMessageBox } from 'element-plus'
import { service, isRelogin } from '../service'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
  isRelogin.show = false
})

async function failRequest(silentNetworkError: boolean, status?: number) {
  return service({
    url: '/ai/courseware/generation-task/get?id=1',
    ...{ silentNetworkError },
    adapter: async (config) => {
      const response = status
        ? { status, statusText: 'error', headers: {}, config, data: {} }
        : undefined
      throw new AxiosError(
        'timeout of 30000ms exceeded',
        'ECONNABORTED',
        config,
        undefined,
        response
      )
    }
  })
}

describe('background polling error notifications', () => {
  it('leaves opted-in network failures for the caller to display inline', async () => {
    await expect(failRequest(true)).rejects.toBeInstanceOf(AxiosError)
    expect(ElMessage.error).not.toHaveBeenCalled()
  })
  it('still shows timeout errors for normal user requests', async () => {
    await expect(failRequest(false)).rejects.toBeInstanceOf(AxiosError)
    expect(ElMessage.error).toHaveBeenCalledWith('sys.api.apiTimeoutMessage')
  })
  it('does not suppress HTTP server errors', async () => {
    await expect(failRequest(true, 503)).rejects.toBeInstanceOf(AxiosError)
    expect(ElMessage.error).toHaveBeenCalledOnce()
  })
  it('still handles expired authentication', async () => {
    await expect(failRequest(true, 401)).rejects.toBe('sys.api.timeoutMessage')
    expect(ElMessageBox.confirm).toHaveBeenCalledOnce()
  })
})
