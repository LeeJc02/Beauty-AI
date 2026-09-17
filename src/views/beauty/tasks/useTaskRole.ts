import { computed, type ComputedRef } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { DEMO_ROLES } from '@/mock/data/roles'
import type { Role } from '@/beauty/types'

/**
 * 当前演示角色（对应原型 `App.tsx` 里受控的 `role` state）。
 *
 * 原型由 `App.tsx` 把 `userRole` / `isReadOnly` 作为 props 传给周期任务页；
 * Vue 版没有这条 props 链路，改为从登录用户反查角色：
 * - mock 的 `/system/auth/get-permission-info` 把角色 key 写进 `roles`（如 `hq_trainer`）；
 * - 同时约定 `user.id = 1000 + DEMO_ROLES 下标`。
 *
 * 因此优先按角色 key 反查，取不到再按下标反查，最后兜底为原型的默认角色 `HQ Trainer`。
 * 只读取 `DEMO_ROLES`，不修改 mock 文件。
 *
 * 注：`dashboard/components/useDashboardRole.ts` 有同样语义的实现，这里是周期任务目录内的
 * 自包含副本，避免跨交付单元互相依赖。
 */
const FALLBACK_ROLE: Role = 'HQ Trainer'

export const useTaskRole = (): ComputedRef<Role> => {
  const userStore = useUserStore()

  return computed<Role>(() => {
    const roleKey = userStore.getRoles?.[0]
    const byKey = DEMO_ROLES.find((role) => role.key === roleKey)
    if (byKey) return byKey.beautyRole as Role

    const byIndex = DEMO_ROLES[(userStore.getUser?.id ?? 0) - 1000]
    return (byIndex?.beautyRole as Role) ?? FALLBACK_ROLE
  })
}
