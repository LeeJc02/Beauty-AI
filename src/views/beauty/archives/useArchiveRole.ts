import { computed, type ComputedRef } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { DEMO_ROLES } from '@/mock/data/roles'
import type { Role } from '@/beauty/types'

/**
 * 当前演示角色（对应原型 `App.tsx` 传给门店 / 人员档案页的 `userRole` prop）。
 *
 * 数据来源与 mock 保持一致：`/system/auth/get-permission-info` 把角色 key 写进 `roles`
 * （如 `hq_trainer`），同时约定 `user.id = 1000 + DEMO_ROLES 下标`。
 * 因此优先按角色 key 反查，取不到再按下标反查，最后兜底为档案页的默认角色 `HQ Trainer`
 * （该角色对应「全国门店 / 全国人员」视图）。
 *
 * 只读取 `DEMO_ROLES`，不修改 mock 文件；与 `tasks/useTaskRole.ts`、
 * `dashboard/components/useDashboardRole.ts` 同语义，这里是档案目录内的自包含副本，
 * 避免跨交付单元互相依赖。
 */
const FALLBACK_ROLE: Role = 'HQ Trainer'

export const useArchiveRole = (): ComputedRef<Role> => {
  const userStore = useUserStore()

  return computed<Role>(() => {
    const roleKey = userStore.getRoles?.[0]
    const byKey = DEMO_ROLES.find((role) => role.key === roleKey)
    if (byKey) return byKey.beautyRole as Role

    const byIndex = DEMO_ROLES[(userStore.getUser?.id ?? 0) - 1000]
    return (byIndex?.beautyRole as Role) ?? FALLBACK_ROLE
  })
}
