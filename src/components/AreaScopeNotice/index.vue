<script setup lang="ts">
import { getAccessToken } from '@/utils/auth'
import { useUserStore } from '@/store/modules/user'

defineOptions({ name: 'AreaScopeNotice' })

const route = useRoute()
const userStore = useUserStore()
const { t } = useI18n()

const closed = ref(false)
const refreshing = ref(false)

const guardedPrefixes = [
  '/task-center/study',
  '/task-center/practice',
  '/task-center/exam',
  '/task-center/audience-rule',
  '/courseware/create',
  '/assignment-exam/question-generate',
  '/assignment-exam/question-bank',
  '/assignment-exam/homework',
  '/assignment-exam/exam-paper',
  '/ai-training/customer',
  '/ai-training/scene',
  '/ai-training/quote'
]

const isGuardedRoute = computed(() => guardedPrefixes.some((prefix) => route.path.startsWith(prefix)))
const hasAreaScope = computed(() => (userStore.getUser.dataArea?.subordinateAreaIds || []).length > 0)
const visible = computed(() =>
  Boolean(getAccessToken())
  && userStore.getIsSetUser
  && !refreshing.value
  && isGuardedRoute.value
  && !hasAreaScope.value
  && !closed.value
)

const refreshUserAreaScope = async () => {
  if (!getAccessToken() || !isGuardedRoute.value) {
    return
  }
  refreshing.value = true
  try {
    await userStore.setUserInfoAction(true)
  } finally {
    refreshing.value = false
  }
}

watch(
  () => route.fullPath,
  async () => {
    closed.value = false
    await refreshUserAreaScope()
  },
  { immediate: true }
)
</script>

<template>
  <transition name="area-scope-slide">
    <el-alert
      v-if="visible"
      :title="t('areaScope.required')"
      type="error"
      show-icon
      closable
      class="area-scope-notice"
      @close="closed = true"
    />
  </transition>
</template>

<style scoped>
.area-scope-notice {
  margin-bottom: 10px;
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.area-scope-slide-enter-active,
.area-scope-slide-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.area-scope-slide-enter-from,
.area-scope-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
