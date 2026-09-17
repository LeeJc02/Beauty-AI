<template>
  <Error v-if="isNoMenu" type="403" :message="message" :show-button="false">
    <template #actions>
      <ElButton type="primary" :loading="checkingPermission" @click="checkPermission(false)">
        <Icon v-if="!checkingPermission" icon="ep:refresh" />
        {{ t('error.checkPermission') }}
      </ElButton>
      <ElButton :loading="loggingOut" @click="logout">
        <Icon v-if="!loggingOut" icon="ep:switch-button" />
        {{ t('common.loginOut') }}
      </ElButton>
    </template>
  </Error>
  <Error v-else type="403" @error-click="router.push('/')" />
</template>

<script lang="ts" setup>
import { ElMessageBox } from 'element-plus'
import type { RouteRecordRaw } from 'vue-router'
import { deleteUserCache } from '@/hooks/web/useCache'
import { usePermissionStore } from '@/store/modules/permission'
import { useTagsViewStore } from '@/store/modules/tagsView'
import { useUserStore } from '@/store/modules/user'
import { removeToken } from '@/utils/auth'

defineOptions({ name: 'Error403' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const permissionStore = usePermissionStore()
const tagsViewStore = useTagsViewStore()
const userStore = useUserStore()

const checkingPermission = ref(false)
const loggingOut = ref(false)
const checkIntervalMs = 15_000
let checkTimer: number | undefined

const isNoMenu = computed(() => route.query.reason === 'no-menu')
const message = computed(() => (isNoMenu.value ? t('error.noMenuPermission') : ''))

const getDefaultEntryPath = () => {
  const homeRoute = permissionStore.getRouters.find((item) => item.path === '/')
  return typeof homeRoute?.redirect === 'string' ? homeRoute.redirect : '/'
}

const checkPermission = async (silent = true) => {
  if (checkingPermission.value || loggingOut.value || !isNoMenu.value) return
  checkingPermission.value = true
  try {
    await userStore.setUserInfoAction(true)
    await permissionStore.generateRoutes()
    permissionStore.getAddRouters.forEach((item) => {
      router.addRoute(item as unknown as RouteRecordRaw)
    })
    if (permissionStore.getHasAuthorizedRoute) {
      await router.replace(getDefaultEntryPath())
    } else if (!silent) {
      ElMessage.warning(t('error.permissionNotReady'))
    }
  } catch {
    if (!silent) ElMessage.error(t('error.permissionCheckFailed'))
  } finally {
    checkingPermission.value = false
  }
}

const handleWindowFocus = () => checkPermission(true)

const confirmLogout = async () => {
  try {
    await ElMessageBox.confirm(t('common.loginOutMessage'), t('common.reminder'), {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    return true
  } catch (action) {
    if (action === 'cancel' || action === 'close') return false
    throw action
  }
}

const logout = async () => {
  if (loggingOut.value || !(await confirmLogout())) return
  loggingOut.value = true
  try {
    await userStore.loginOut()
  } catch {
    removeToken()
    deleteUserCache()
    userStore.resetState()
  } finally {
    tagsViewStore.delAllViews()
    permissionStore.$reset()
    loggingOut.value = false
    await router.replace('/login?redirect=/index')
  }
}

onMounted(() => {
  checkTimer = window.setInterval(() => checkPermission(true), checkIntervalMs)
  window.addEventListener('focus', handleWindowFocus)
})

onBeforeUnmount(() => {
  if (checkTimer) window.clearInterval(checkTimer)
  window.removeEventListener('focus', handleWindowFocus)
})
</script>
