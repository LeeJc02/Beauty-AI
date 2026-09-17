<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { DemoRoleApi, type DemoRoleVO } from '@/api/beauty/demo'
import { useUserStore } from '@/store/modules/user'
import { deleteUserCache } from '@/hooks/web/useCache'
import { resetRouter } from '@/router'
import { propTypes } from '@/utils/propTypes'
import { useDesign } from '@/hooks/web/useDesign'

/**
 * 演示角色切换器。
 *
 * Beauty-AI 原型是「一个账号切换 5 种角色」看不同菜单与数据范围；
 * 这里落到 yudao 的工程里：切换角色 = 重新取一次 get-permission-info（菜单树随角色变），
 * 因此直接清缓存 + 整页重载最稳（避免残留的动态路由）。
 */
defineOptions({ name: 'RoleSwitcher' })

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('role-switcher')

defineProps({
  color: propTypes.string.def('')
})

const router = useRouter()
const userStore = useUserStore()

const roles = ref<DemoRoleVO[]>([])
const currentRoleKey = ref('')

/** 演示角色与演示用户的对应关系：user.id = 1000 + 角色下标（由 mock 固定）。 */
const resolveCurrentRole = async () => {
  roles.value = (await DemoRoleApi.getRoles()) || []
  const index = (userStore.getUser.id || 1000) - 1000
  currentRoleKey.value = roles.value[index]?.key || roles.value[0]?.key || ''
}

const currentRoleLabel = computed(
  () => roles.value.find((role) => role.key === currentRoleKey.value)?.label || '切换角色'
)

const loading = ref(false)

const switchRole = async (key: string) => {
  if (!key || key === currentRoleKey.value || loading.value) return
  loading.value = true
  try {
    const res = await DemoRoleApi.setRole(key)
    deleteUserCache()
    resetRouter()
    userStore.resetState?.()
    ElMessage.success(`已切换为「${roles.value.find((role) => role.key === key)?.label || key}」`)
    // 整页重载：菜单、权限、数据范围都按新角色重新初始化
    window.location.replace(res?.entryPath || '/')
    // 兜底：极端情况下 replace 不生效时也要给出跳转
    void router.replace(res?.entryPath || '/')
  } finally {
    loading.value = false
  }
}

onMounted(resolveCurrentRole)
</script>

<template>
  <ElDropdown :class="[prefixCls, '!p-0']" trigger="click" @command="switchRole">
    <div class="h-full flex items-center cursor-pointer px-10px" :style="{ color }">
      <Icon class="!p-0" :color="color" :size="18" icon="ep:switch" />
      <span class="ml-4px text-13px">{{ currentRoleLabel }}</span>
    </div>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem v-for="item in roles" :key="item.key" :command="item.key">
          {{ item.label }}
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>
