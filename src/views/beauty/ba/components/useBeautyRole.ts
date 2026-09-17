import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { DEMO_ROLES } from '@/mock/data/roles'
import type { Role } from '@/beauty/types'

/**
 * 读取当前演示角色，语义等价于原型 `App.tsx` 里传入页面的 `role`。
 *
 * mock 里 `user.id = 1000 + DEMO_ROLES 下标`，因此用 user.id 反查角色表得到
 * 原型角色名（Role）；取不到时回退超级管理员，避免页面因角色为空而白屏。
 */
export const useBeautyRole = (): ComputedRef<Role> => {
  const userStore = useUserStore()

  return computed<Role>(() => {
    const index = (userStore.getUser.id || 1000) - 1000
    return (DEMO_ROLES[index]?.beautyRole ?? 'Super Admin') as Role
  })
}
