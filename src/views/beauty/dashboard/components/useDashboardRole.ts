import { computed, type ComputedRef } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { DEMO_ROLES } from '@/mock/data/roles'
import type { Role } from '@/beauty/types'

/**
 * 当前演示角色（原型 `App.tsx` 里受控的 `role` state）。
 *
 * 数据来源与 mock 保持一致：`/system/auth/get-permission-info` 把角色 key 写进 `roles`，
 * 用户 id = 1000 + DEMO_ROLES 下标。这里优先按角色 key 反查，取不到时退化为按下标反查，
 * 保证真实登录态下也不会把页面渲染成空。
 *
 * 仅读取 `DEMO_ROLES`，不修改 mock 文件。
 */
export const useDashboardRole = (): ComputedRef<Role> => {
  const userStore = useUserStore()

  return computed<Role>(() => {
    const roleKey = userStore.getRoles?.[0]
    const byKey = DEMO_ROLES.find((role) => role.key === roleKey)
    if (byKey) return byKey.beautyRole as Role

    const byIndex = DEMO_ROLES[(userStore.getUser?.id ?? 0) - 1000]
    return (byIndex?.beautyRole ?? 'Super Admin') as Role
  })
}
