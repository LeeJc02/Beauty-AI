import type { MockRoute } from './types'
import { systemRoutes } from './handlers/system'
import { coursewareRoutes } from './handlers/courseware'

/**
 * 全部本地 mock 路由。
 *
 * 说明：本工程是「前端演示原型 + 本地 mock」，除「课件」模块原样复用 SalesBoost-vue 的页面
 * （因此必须提供 http 形态的假后端）之外，其它页面直接复用移植过来的演示数据模块，
 * 不走接口层。
 */
export const mockRoutes: MockRoute[] = [...systemRoutes, ...coursewareRoutes]
