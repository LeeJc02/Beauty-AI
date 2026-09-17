import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import qs from 'qs'
import { mockRoutes } from './routes'
import { MockError, type MockCtx, type MockRoute } from './types'

/** 每个 mock 路由的匹配与执行结果缓存，避免重复线性扫描（路由表很小，收益有限但便于排查）。 */
const unmatchedWarned = new Set<string>()

const parseQuery = (config: InternalAxiosRequestConfig, fullUrl: string) => {
  const [, search] = fullUrl.split('?')
  return {
    ...(search ? (qs.parse(search) as Record<string, any>) : {}),
    ...((config.params as Record<string, any>) || {})
  }
}

const parseBody = (data: unknown) => {
  if (data == null) return undefined
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return qs.parse(data)
    }
  }
  return data as Record<string, any>
}

const findRoute = (method: string, path: string): MockRoute | undefined => {
  const normalized = path.replace(/\/+$/, '') || '/'
  return mockRoutes.find((route) =>
    route.method === method && (typeof route.path === 'string' ? route.path === normalized : route.path.test(normalized))
  )
}

const respond = (
  config: InternalAxiosRequestConfig,
  payload: { code: number; data?: any; msg?: string }
): AxiosResponse => {
  return {
    data: payload,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    // service.ts 的响应拦截器会读 response.request.responseType / response.data.type，这里给足形状。
    request: { responseType: config.responseType }
  } as unknown as AxiosResponse
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 本地 mock 适配器：拦下所有 axios 请求，按路由表在浏览器内直接返回 yudao 风格的 `{code,data,msg}`。
 *
 * 这样「复制的 vue 源码」不需要任何改动就能在离线环境下跑完整交互链路。
 */
export const mockAdapter: AxiosAdapter = async (config) => {
  const baseURL = config.baseURL || ''
  const rawUrl = config.url || ''
  const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${baseURL}${rawUrl}`
  const [pathPart] = fullUrl.split('?')
  // 去掉域名与 /admin-api 前缀，路由表里写的是接口相对路径（如 /system/auth/login）
  const withoutHost = pathPart.replace(/^https?:\/\/[^/]+/, '')
  const path = baseURL && withoutHost.startsWith(baseURL) ? withoutHost.slice(baseURL.length) : withoutHost
  const method = (config.method || 'get').toUpperCase()

  const ctx: MockCtx = {
    method,
    path,
    query: parseQuery(config, fullUrl),
    body: parseBody(config.data),
    config
  }

  const route = findRoute(method, path)
  // 轻微延迟，让页面的 loading / 轮询状态能被真实观察到。
  await delay(method === 'GET' ? 120 : 180)

  if (!route) {
    if (!unmatchedWarned.has(`${method} ${path}`)) {
      unmatchedWarned.add(`${method} ${path}`)
      console.warn(`[mock] 未实现的接口：${method} ${path}`)
    }
    return respond(config, { code: 0, data: null, msg: '' })
  }

  try {
    const data = await route.handler(ctx)
    return respond(config, { code: 0, data, msg: '' })
  } catch (error) {
    if (error instanceof MockError) {
      return respond(config, { code: error.code, data: null, msg: error.message })
    }
    console.error(`[mock] ${method} ${path} 处理失败`, error)
    return respond(config, {
      code: 500,
      data: null,
      msg: (error as Error)?.message || '本地 mock 处理失败'
    })
  }
}
