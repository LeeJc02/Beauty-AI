import type { InternalAxiosRequestConfig } from 'axios'

/** mock 请求上下文：把 axios 的请求拆成好用的形状交给 handler。 */
export interface MockCtx {
  method: string
  /** 去掉 baseURL 与 query 后的路径，例如 /ai/courseware/page */
  path: string
  /** query 参数（URL 自带的 + config.params 合并） */
  query: Record<string, any>
  body: any
  config: InternalAxiosRequestConfig
}

export interface MockRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** 精确路径或正则（对 path 做匹配） */
  path: string | RegExp
  handler: (ctx: MockCtx) => any | Promise<any>
}

/** handler 抛出的业务错误：会转换成 { code, msg } 的失败响应。 */
export class MockError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}
