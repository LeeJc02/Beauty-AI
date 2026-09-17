import { store } from '@/store'
import { defineStore } from 'pinia'
import { getAccessToken, removeToken } from '@/utils/auth'
import { CACHE_KEY, useCache, deleteUserCache } from '@/hooks/web/useCache'
import { getInfo, loginOut } from '@/api/login'

const { wsCache } = useCache()

interface UserDataAreaVO {
  headquarterAreaId: number
  headquarterAreaName: string
  ownAreaId?: number
  ownAreaName?: string
  subordinateAreaIds: number[]
  subordinateAreaNames: string[]
  visibleAreaIds: number[]
  visibleAreaNames: string[]
}

interface UserVO {
  id: number
  avatar: string
  nickname: string
  deptId: number
  dataArea?: UserDataAreaVO
}

interface UserInfoVO {
  // USER 缓存
  permissions: Set<string>
  roles: string[]
  isSetUser: boolean
  user: UserVO
}

interface RawUserInfoVO {
  permissions?: string[]
  roles?: string[]
  menus?: unknown[]
  user?: UserVO
}

/** 校验通过后 `user` 一定存在，因此断言的类型把它收紧为非可选。 */
type ResolvedUserInfoVO = RawUserInfoVO & { user: UserVO }

const isValidUserInfo = (userInfo: unknown): userInfo is ResolvedUserInfoVO => {
  return !!userInfo && typeof userInfo === 'object' && !!(userInfo as RawUserInfoVO).user
}

export const useUserStore = defineStore('admin-user', {
  state: (): UserInfoVO => ({
    permissions: new Set<string>(),
    roles: [],
    isSetUser: false,
    user: {
      id: 0,
      avatar: '',
      nickname: '',
      deptId: 0,
      dataArea: {
        headquarterAreaId: 1,
        headquarterAreaName: '',
        subordinateAreaIds: [],
        subordinateAreaNames: [],
        visibleAreaIds: [],
        visibleAreaNames: []
      }
    }
  }),
  getters: {
    getPermissions(): Set<string> {
      return this.permissions
    },
    getRoles(): string[] {
      return this.roles
    },
    getIsSetUser(): boolean {
      return this.isSetUser
    },
    getUser(): UserVO {
      return this.user
    }
  },
  actions: {
    async setUserInfoAction(forceRefresh = false) {
      if (!getAccessToken()) {
        this.resetState()
        return null
      }

      const cachedUserInfo = forceRefresh ? undefined : wsCache.get(CACHE_KEY.USER)
      let userInfo = isValidUserInfo(cachedUserInfo) ? cachedUserInfo : undefined

      if (!userInfo) {
        const remoteUserInfo = await getInfo()
        if (!isValidUserInfo(remoteUserInfo)) {
          deleteUserCache()
          this.resetState()
          throw new Error('获取用户信息失败：返回数据为空或结构不正确')
        }
        userInfo = remoteUserInfo
      } else {
        // 有缓存时尝试刷新；刷新失败则继续使用当前有效缓存，避免进入系统时白屏
        try {
          const remoteUserInfo = await getInfo()
          if (isValidUserInfo(remoteUserInfo)) {
            userInfo = remoteUserInfo
          }
        } catch (error) {}
      }

      this.permissions = new Set(userInfo.permissions || [])
      this.roles = userInfo.roles || []
      this.user = userInfo.user
      this.isSetUser = true
      wsCache.set(CACHE_KEY.USER, userInfo)
      wsCache.set(CACHE_KEY.ROLE_ROUTERS, userInfo.menus || [])
    },
    async setUserAvatarAction(avatar: string) {
      const userInfo = wsCache.get(CACHE_KEY.USER)
      this.user.avatar = avatar
      if (isValidUserInfo(userInfo)) {
        userInfo.user!.avatar = avatar
        wsCache.set(CACHE_KEY.USER, userInfo)
      }
    },
    async setUserNicknameAction(nickname: string) {
      const userInfo = wsCache.get(CACHE_KEY.USER)
      this.user.nickname = nickname
      if (isValidUserInfo(userInfo)) {
        userInfo.user!.nickname = nickname
        wsCache.set(CACHE_KEY.USER, userInfo)
      }
    },
    async loginOut() {
      await loginOut()
      removeToken()
      deleteUserCache() // 删除用户缓存
      this.resetState()
    },
    resetState() {
      this.permissions = new Set<string>()
      this.roles = []
      this.isSetUser = false
      this.user = {
        id: 0,
        avatar: '',
        nickname: '',
        deptId: 0,
        dataArea: {
          headquarterAreaId: 1,
          headquarterAreaName: '',
          subordinateAreaIds: [],
          subordinateAreaNames: [],
          visibleAreaIds: [],
          visibleAreaNames: []
        }
      }
    }
  }
})

export const useUserStoreWithOut = () => {
  return useUserStore(store)
}
