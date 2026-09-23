import { MockError, type MockCtx, type MockRoute } from '../types'
import { buildPermissionInfo, currentDemoRole, DEMO_ROLES, getDemoRoleKey, setDemoRoleKey } from '../session'
import { DEMO_AREAS } from '../data/areas'

/** 演示账号：任意密码都能登录，按 username 选中角色（默认 admin → 超级管理员）。 */
const resolveRoleKeyByUsername = (username?: string) => {
  if (!username) return getDemoRoleKey()
  const matched = DEMO_ROLES.find((role) => role.username === username)
  if (matched) return matched.key
  if (username === 'admin') return 'super_admin' as const
  // 其他任意账号：保持当前角色，便于随手登录
  return getDemoRoleKey()
}

const ok = (data: any = null) => data

export const systemRoutes: MockRoute[] = [
  {
    method: 'POST',
    path: '/system/auth/login',
    handler: (ctx: MockCtx) => {
      const roleKey = resolveRoleKeyByUsername(ctx.body?.username)
      setDemoRoleKey(roleKey)
      const role = currentDemoRole()
      return {
        id: 1000,
        userId: 1000,
        accessToken: `demo-token-${role.key}`,
        refreshToken: `demo-refresh-${role.key}`,
        clientId: 'beauty-ai-demo',
        userType: 1,
        expiresTime: Date.now() + 30 * 24 * 60 * 60 * 1000
      }
    }
  },
  {
    method: 'POST',
    path: '/system/auth/logout',
    handler: () => ok()
  },
  {
    method: 'GET',
    path: '/system/auth/get-permission-info',
    handler: () => buildPermissionInfo()
  },
  {
    method: 'POST',
    path: '/system/auth/refresh-token',
    handler: () => {
      const role = currentDemoRole()
      return {
        id: 1000,
        userId: 1000,
        accessToken: `demo-token-${role.key}`,
        refreshToken: `demo-refresh-${role.key}`,
        expiresTime: Date.now() + 30 * 24 * 60 * 60 * 1000
      }
    }
  },
  // 验证码：本地演示不需要，但接口留着避免 Login 页在开关打开时报错。
  {
    method: 'POST',
    path: '/system/captcha/get',
    handler: () => ({ repCode: '0000', repMsg: '', repData: {} })
  },
  {
    method: 'POST',
    path: '/system/captcha/check',
    handler: () => ({ repCode: '0000', repMsg: '', repData: { verification: 'demo' } })
  },
  {
    method: 'GET',
    path: '/system/dict-data/simple-list',
    handler: () => []
  },
  {
    method: 'GET',
    path: '/system/notify-message/get-unread-count',
    handler: () => 0
  },
  {
    method: 'GET',
    path: '/system/notify-message/get-unread-list',
    handler: () => []
  },
  {
    method: 'GET',
    path: '/system/notify-message/active-task-list',
    handler: () => []
  },
  {
    method: 'GET',
    path: '/system/notify-message/active-task-count',
    handler: () => 0
  },
  {
    method: 'GET',
    path: '/system/notify-message/my-page',
    handler: () => ({ list: [], total: 0 })
  },
  {
    method: 'PUT',
    path: '/system/notify-message/update-all-read',
    handler: () => ok()
  },
  {
    method: 'GET',
    path: '/asset-area/options',
    handler: () => {
      const role = currentDemoRole()
      const dataArea = role.dataArea()
      return {
        strictAreaScope: false,
        canSelectAllAreas: dataArea.subordinateAreaIds.length > 1,
        options: DEMO_AREAS.slice(1).map((area) => ({ id: area.id, name: area.name })),
        defaultAreaIds: dataArea.visibleAreaIds.filter((id) => id !== 1),
        defaultAreaNames: dataArea.visibleAreaNames.filter((name) => name !== '全国')
      }
    }
  },
  // 演示：切换角色（Beauty-AI 原型侧边栏的角色切换器）
  {
    method: 'POST',
    path: '/beauty/demo/role',
    handler: (ctx: MockCtx) => {
      const key = ctx.body?.role
      if (!DEMO_ROLES.some((role) => role.key === key)) {
        throw new MockError(400, `未知的演示角色：${key}`)
      }
      setDemoRoleKey(key)
      return { role: getDemoRoleKey(), entryPath: currentDemoRole().entryPath }
    }
  },
  {
    method: 'GET',
    path: '/beauty/demo/roles',
    handler: () =>
      DEMO_ROLES.map((role) => ({
        key: role.key,
        label: role.label,
        beautyRole: role.beautyRole,
        entryPath: role.entryPath
      }))
  }
]
