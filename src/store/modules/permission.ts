import { defineStore } from 'pinia'
import { store } from '@/store'
import { cloneDeep } from 'lodash-es'
import remainingRouter from '@/router/modules/remaining'
import { flatMultiLevelRoutes, generateRoute } from '@/utils/routerHelper'
import { CACHE_KEY, useCache } from '@/hooks/web/useCache'

const { wsCache } = useCache()

const DEFAULT_ENTRY_PATHS = ['/national-data', '/runtime-overview', '/regional-data']

/** redirect 允许是字符串/对象/函数；这里只需要字符串路径，其它形态回退到 route.path。 */
const toEntryPath = (redirect: unknown, fallback?: string): string | undefined =>
  typeof redirect === 'string' && redirect ? redirect : fallback

const findFirstAuthorizedPath = (routes: AppRouteRecordRaw[]): string | undefined => {
  for (const targetPath of DEFAULT_ENTRY_PATHS) {
    const matchedRoute = routes.find((route) => route.path === targetPath && !route.meta?.hidden)
    if (matchedRoute) {
      return toEntryPath(matchedRoute.redirect, targetPath)
    }
  }
  const firstVisible = routes.find((route) => !route.meta?.hidden)
  return toEntryPath(firstVisible?.redirect, firstVisible?.path)
}

export interface PermissionState {
  routers: AppRouteRecordRaw[]
  addRouters: AppRouteRecordRaw[]
  menuTabRouters: AppRouteRecordRaw[]
  hasAuthorizedRoute: boolean
}

export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    routers: [],
    addRouters: [],
    menuTabRouters: [],
    hasAuthorizedRoute: false
  }),
  getters: {
    getRouters(): AppRouteRecordRaw[] {
      return this.routers
    },
    getAddRouters(): AppRouteRecordRaw[] {
      return flatMultiLevelRoutes(cloneDeep(this.addRouters))
    },
    getMenuTabRouters(): AppRouteRecordRaw[] {
      return this.menuTabRouters
    },
    getHasAuthorizedRoute(): boolean {
      return this.hasAuthorizedRoute
    }
  },
  actions: {
    async generateRoutes(): Promise<unknown> {
      return new Promise<void>(async (resolve) => {
        // 获得菜单列表，它在登录的时候，setUserInfoAction 方法中已经进行获取
        let res: AppCustomRouteRecordRaw[] = []
        const roleRouters = wsCache.get(CACHE_KEY.ROLE_ROUTERS)
        if (roleRouters) {
          res = roleRouters as AppCustomRouteRecordRaw[]
        }
        const routerMap: AppRouteRecordRaw[] = generateRoute(res)
        this.hasAuthorizedRoute = routerMap.some((route) => !route.meta?.hidden)
        const defaultEntryPath = findFirstAuthorizedPath(routerMap)
        const remainingRoutes = cloneDeep(remainingRouter)
        const homeRoute = remainingRoutes.find((route) => route.path === '/')
        if (homeRoute && defaultEntryPath) {
          homeRoute.redirect = defaultEntryPath
        }
        // 动态路由，404一定要放到最后面
        // preschooler：vue-router@4以后已支持静态404路由，此处可不再追加
        this.addRouters = routerMap.concat([
          {
            path: '/:path(.*)*',
            // redirect: '/404',
            component: () => import('@/views/Error/404.vue'),
            name: '404Page',
            meta: {
              hidden: true,
              breadcrumb: false
            }
          }
        ])
        // 渲染菜单的所有路由
        this.routers = remainingRoutes.concat(routerMap)
        resolve()
      })
    },
    setMenuTabRouters(routers: AppRouteRecordRaw[]): void {
      this.menuTabRouters = routers
    }
  },
  persist: false
})

export const usePermissionStoreWithOut = () => {
  return usePermissionStore(store)
}
