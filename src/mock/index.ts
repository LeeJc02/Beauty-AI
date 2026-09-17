import { service } from '@/config/axios/service'
import { mockAdapter } from './adapter'

let installed = false

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
  console.info(
    '%c[beauty-ai]%c 本地 mock 已启用（无真实后端请求）',
    'background:#a85f4b;color:#fff;padding:1px 4px;border-radius:3px',
    'color:#a85f4b'
  )
}
