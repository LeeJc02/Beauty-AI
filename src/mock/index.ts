import { service } from '@/config/axios/service'
import { mockAdapter } from './adapter'
import { getAccessToken, setToken } from '@/utils/auth'
import { deleteUserCache } from '@/hooks/web/useCache'
import { getDemoRoleKey, setDemoRoleKey } from './session'

let installed = false

/** 仅本地适配器启用时建立原型身份，不放宽真实后端的登录校验。 */
export const ensurePrototypeSession = () => {
  if (!installed || getAccessToken()) return
  setDemoRoleKey('hq_trainer')
  deleteUserCache()
  setToken({
    id: 1001,
    userId: 1001,
    accessToken: 'demo-token-hq_trainer',
    refreshToken: 'demo-refresh-hq_trainer',
    clientId: 'beauty-ai-demo',
    userType: 1,
    expiresTime: Date.now() + 30 * 24 * 60 * 60 * 1000
  })
}

export const isPrototypeInspectionEntry = () => installed && getDemoRoleKey() === 'hq_trainer'

/**
 * 安装本地 mock：把 yudao 的 axios 实例适配器整体替换掉。
 *
 * 与真实后端的差异只有「数据来自浏览器内存」这一点，请求/响应仍然是 yudao 的
 * `{ code, data, msg }` 形态，所以复制的业务页面不需要任何改动。
 */
export const setupMock = () => {
  if (installed) return
  installed = true
  service.defaults.adapter = mockAdapter
  ensurePrototypeSession()
  console.info(
    '%c[beauty-ai]%c 本地 mock 已启用（无真实后端请求）',
    'background:#a85f4b;color:#fff;padding:1px 4px;border-radius:3px',
    'color:#a85f4b'
  )
}
