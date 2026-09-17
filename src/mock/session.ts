import { MENUS_BY_ROLE, buildMenus } from './data/menus'
import { DEMO_ROLES, roleByKey, type DemoRole, type DemoRoleKey } from './data/roles'

const ROLE_STORAGE_KEY = 'beauty-ai:demo-role'

export { DEMO_ROLES, type DemoRole, type DemoRoleKey }

export const getDemoRoleKey = (): DemoRoleKey => {
  if (typeof localStorage === 'undefined') return DEMO_ROLES[0].key
  const stored = localStorage.getItem(ROLE_STORAGE_KEY)
  return (DEMO_ROLES.find((role) => role.key === stored)?.key || DEMO_ROLES[0].key) as DemoRoleKey
}

export const setDemoRoleKey = (key: string) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ROLE_STORAGE_KEY, key)
}

export const currentDemoRole = (): DemoRole => roleByKey(getDemoRoleKey())

/** 构造 /system/auth/get-permission-info 的返回：权限、角色、菜单树、用户（含数据范围）。 */
export const buildPermissionInfo = () => {
  const role = currentDemoRole()
  return {
    permissions: role.permissions,
    roles: [role.key],
    menus: buildMenus(MENUS_BY_ROLE[role.key]),
    user: {
      id: 1000 + DEMO_ROLES.findIndex((item) => item.key === role.key),
      avatar: '',
      nickname: role.nickname,
      deptId: role.deptId,
      dataArea: role.dataArea()
    }
  }
}

/** 角色切换后需要重置的本地缓存键（与 useUserStore / permission store 使用的键一致）。 */
export const DEMO_ROLE_CACHE_KEYS = ['USER', 'ROLE_ROUTERS', 'DICT_CACHE']
