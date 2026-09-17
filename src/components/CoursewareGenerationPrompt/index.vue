<template>
  <div
    v-if="store.task"
    ref="promptRef"
    class="courseware-generation-prompt"
    :class="[
      store.promptClass,
      {
        'is-collapsed': isCollapsed,
        'is-dragging': isDragging,
        'is-waiting': isWaitingForUser
      }
    ]"
    :style="promptStyle"
  >
    <div
      class="courseware-generation-drag-handle"
      role="button"
      tabindex="0"
      :aria-label="promptTitle"
      @pointerdown="handleDragStart"
      @click="goReview"
      @keydown.enter="goReview"
      @keydown.space.prevent="goReview"
    >
      <div class="courseware-generation-icon">
        <Icon v-if="isWaitingForUser" icon="ep:question-filled" class="w-4 h-4" />
        <Icon v-else-if="store.isGenerating" :icon="store.promptIcon" class="w-4 h-4 animate-spin" />
        <Icon
          v-else-if="isCoursewareTaskResultReady(store.task)"
          icon="ep:circle-check"
          class="w-4 h-4"
        />
        <Icon v-else icon="ep:info-filled" class="w-4 h-4" />
      </div>
      <div v-if="!isCollapsed" class="min-w-0 flex-1 text-left">
        <div class="truncate text-xs font-bold">{{ promptTitle }}</div>
        <template v-if="store.isGenerating && !isWaitingForUser">
          <el-progress
            class="mt-1"
            :percentage="store.displayProgress"
            :show-text="false"
            :stroke-width="4"
            :aria-label="`${promptTitle} ${store.displayProgress}%`"
          />
        </template>
        <div v-else class="mt-0.5 truncate text-[11px] opacity-80">{{ promptDescription }}</div>
      </div>
      <span v-if="!isCollapsed" class="text-xs font-semibold">{{ store.displayProgress }}%</span>
    </div>
    <button
      v-if="isWaitingForUser && !isCollapsed"
      class="courseware-generation-action"
      type="button"
      :aria-label="t('menu.courseware.generationPrompt.answerAction')"
      @click.stop="goReview"
    >
      {{ t('menu.courseware.generationPrompt.answerAction') }}
    </button>
    <button class="courseware-generation-toggle" type="button" @click.stop="toggleCollapsed">
      <Icon :icon="isCollapsed ? 'ep:arrow-down' : 'ep:arrow-up'" class="w-3.5 h-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useCoursewareGenerationStore } from '@/store/modules/coursewareGeneration'
import {
  isCoursewareTaskFailed,
  isCoursewareTaskResultReady,
  resolveCoursewareTaskDisplayStatus,
  resolveCoursewareTaskStage,
  COURSEWARE_TASK_STATUS
} from '@/views/courseware/create/generationTask'
import { useRoute, useRouter } from 'vue-router'
import { hasPermission } from '@/directives/permission/hasPermi'

const route = useRoute()
const router = useRouter()
const store = useCoursewareGenerationStore()
const { t } = useI18n()

const POSITION_STORAGE_KEY = 'courseware:generation-prompt:position'
const promptRef = ref<HTMLElement>()
const isCollapsed = ref(false)
const isDragging = ref(false)
const hasDragged = ref(false)
const promptPosition = ref<{ left: number; top: number } | null>(null)
let dragStart: { pointerX: number; pointerY: number; left: number; top: number } | null = null

// 课件生成浮层只对具备生成权限的用户生效，避免无权限用户每次进页面都收到 403 提示
if (hasPermission(['ai:courseware:generate'])) {
  store.init()
}

const readyCoursewareTitle = computed(
  () => store.task?.title || t('menu.courseware.generationPrompt.defaultCoursewareTitle')
)

const homeworkGenerationStarted = computed(() =>
  Boolean(store.task?.resultCoursewareId || store.task?.homeworkGenerationTaskId)
)
const homeworkGenerationActive = computed(
  () =>
    store.task?.generateHomeworkSync === true &&
    homeworkGenerationStarted.value &&
    ['queued', 'running', 'succeeded'].includes(
      store.task?.homeworkGenerationStatus?.toLowerCase() || ''
    )
)
const taskDisplayStatus = computed(() => resolveCoursewareTaskDisplayStatus(store.task))
const taskStage = computed(() => resolveCoursewareTaskStage(store.task))
// 浮窗只展示整体进度：子课件进度属于工作台右侧的局部细节，
// 放进浮窗会撑大卡片、遮挡页面内容。
const stageLabels: Record<string, string> = {
  queued: 'menu.courseware.generationPrompt.stageQueued',
  reviewing_outline: 'menu.courseware.generationPrompt.stageReviewingOutline',
  splitting_outline: 'menu.courseware.generationPrompt.stageSplittingOutline',
  generating_scenes: 'menu.courseware.generationPrompt.stageGeneratingScenes',
  generating_media: 'menu.courseware.generationPrompt.stageGeneratingMedia',
  generating_tts: 'menu.courseware.generationPrompt.stageGeneratingTts',
  persisting: 'menu.courseware.generationPrompt.stagePersisting',
  finalizing: 'menu.courseware.generationPrompt.stageFinalizing',
  completed: 'menu.courseware.generationPrompt.stageCompleted',
  failed: 'menu.courseware.generationPrompt.stageFailed'
}
const stageLabel = computed(() => t(stageLabels[taskStage.value] || stageLabels.generating_scenes))
const isWaitingForUser = computed(
  () => taskDisplayStatus.value === COURSEWARE_TASK_STATUS.WAITING_FOR_USER
)
const isAwaitingUserAction = computed(
  () =>
    taskDisplayStatus.value === COURSEWARE_TASK_STATUS.WAITING_FOR_USER ||
    taskDisplayStatus.value === COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION
)

const promptTitle = computed(() => {
  const status = taskDisplayStatus.value
  // 等待用户输入与各生成阶段都属于 isCoursewareTaskActive，必须排在 isGenerating 之前，
  // 否则会被笼统的“生成中”吞掉，用户不知道任务其实卡在等他操作。
  if (status === COURSEWARE_TASK_STATUS.WAITING_FOR_USER) {
    return t('menu.courseware.generationPrompt.waitingForUserTitle')
  }
  if (status === COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION) {
    return t('menu.courseware.generationPrompt.waitingForConfirmationTitle')
  }
  if (homeworkGenerationActive.value)
    return t('menu.courseware.generationPrompt.homeworkGeneratingTitle')
  if (status === COURSEWARE_TASK_STATUS.QUEUED)
    return t('menu.courseware.generationPrompt.queuedTitle')
  if (status === COURSEWARE_TASK_STATUS.REVIEWING_OUTLINE) {
    return t('menu.courseware.generationPrompt.reviewingOutlineTitle')
  }
  if (status === COURSEWARE_TASK_STATUS.SPLITTING_OUTLINE) {
    return t('menu.courseware.generationPrompt.splittingOutlineTitle')
  }
  if (status === COURSEWARE_TASK_STATUS.GENERATING_CHILDREN) {
    return t('menu.courseware.generationPrompt.generatingChildrenTitle')
  }
  if (store.isGenerating) return t('menu.courseware.generationPrompt.generatingTitle')
  if (isCoursewareTaskResultReady(store.task))
    return t('menu.courseware.generationPrompt.successTitle')
  if (status === COURSEWARE_TASK_STATUS.FAILED)
    return t('menu.courseware.generationPrompt.failedTitle')
  if (status === COURSEWARE_TASK_STATUS.CANCELED)
    return t('menu.courseware.generationPrompt.canceledTitle')
  return t('menu.courseware.generationPrompt.endedTitle')
})

const promptDescription = computed(() => {
  const status = taskDisplayStatus.value
  if (isCoursewareTaskResultReady(store.task)) {
    return t('menu.courseware.generationPrompt.successDescription', {
      title: readyCoursewareTitle.value
    })
  }
  if (homeworkGenerationActive.value) {
    return `${t('menu.courseware.generationPrompt.homeworkGeneratingDescription')} · ${stageLabel.value}`
  }
  if (isCoursewareTaskFailed(store.task?.status)) {
    return (
      store.task?.homeworkGenerationMessage ||
      store.task?.errorMessage ||
      t('menu.courseware.generationPrompt.endedDescription')
    )
  }
  if (status === COURSEWARE_TASK_STATUS.WAITING_FOR_USER) {
    return t('menu.courseware.generationPrompt.waitingForUserDescription')
  }
  if (status === COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION) {
    return t('menu.courseware.generationPrompt.waitingForConfirmationDescription')
  }
  return t('menu.courseware.generationPrompt.endedDescription')
})

const promptStyle = computed(() => {
  if (!promptPosition.value) return undefined
  return {
    left: `${promptPosition.value.left}px`,
    top: `${promptPosition.value.top}px`,
    right: 'auto',
    bottom: 'auto'
  }
})

const clampPosition = (left: number, top: number) => {
  const rect = promptRef.value?.getBoundingClientRect()
  const width = rect?.width || 280
  const height = rect?.height || 54
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(top, window.innerHeight - height - 8))
  }
}

const savePromptPosition = () => {
  if (!promptPosition.value) return
  window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(promptPosition.value))
}

const handleDragMove = (event: PointerEvent) => {
  if (!dragStart) return
  const offsetX = event.clientX - dragStart.pointerX
  const offsetY = event.clientY - dragStart.pointerY
  if (Math.abs(offsetX) + Math.abs(offsetY) > 4) {
    hasDragged.value = true
  }
  promptPosition.value = clampPosition(dragStart.left + offsetX, dragStart.top + offsetY)
}

const handleDragEnd = () => {
  if (isDragging.value) savePromptPosition()
  isDragging.value = false
  dragStart = null
  window.removeEventListener('pointermove', handleDragMove)
  window.removeEventListener('pointerup', handleDragEnd)
}

const handleDragStart = (event: PointerEvent) => {
  if (event.button !== 0 || !promptRef.value) return
  const rect = promptRef.value.getBoundingClientRect()
  dragStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    left: rect.left,
    top: rect.top
  }
  promptPosition.value = { left: rect.left, top: rect.top }
  hasDragged.value = false
  isDragging.value = true
  window.addEventListener('pointermove', handleDragMove)
  window.addEventListener('pointerup', handleDragEnd)
  event.preventDefault()
  event.stopPropagation()
}

const toggleCollapsed = () => {
  isCollapsed.value = !isCollapsed.value
  nextTick(() => {
    if (!promptPosition.value) return
    promptPosition.value = clampPosition(promptPosition.value.left, promptPosition.value.top)
    savePromptPosition()
  })
}

onMounted(() => {
  const rawPosition = window.localStorage.getItem(POSITION_STORAGE_KEY)
  if (!rawPosition) return
  try {
    const position = JSON.parse(rawPosition)
    if (typeof position?.left === 'number' && typeof position?.top === 'number') {
      nextTick(() => {
        promptPosition.value = clampPosition(position.left, position.top)
      })
    }
  } catch {}
})

onBeforeUnmount(() => {
  handleDragEnd()
})

const goReview = () => {
  if (hasDragged.value) {
    hasDragged.value = false
    return
  }

  const taskId = store.task?.id
  // 必须与全局完成态门禁一致：后端已写 SUCCEEDED 但课后题尚未回填时，
  // 这里不能跳进预览页，否则会绕过严格完成态。
  const isReady = isCoursewareTaskResultReady(store.task)
  const isTerminal = isCoursewareTaskFailed(store.task?.status)
  const isCoursewareReviewPage = route.name === 'CoursewareCreate'

  if (!taskId || isCoursewareReviewPage) return
  if (isAwaitingUserAction.value) {
    router.push({ name: 'CoursewareCreate', query: { taskId } })
    return
  }
  if (isReady) {
    // 仅在真正需要跳转到课件预览页时清空 store；创建页会从 taskId 重新加载终态。
    store.clear()
    router.push({ name: 'CoursewareCreate', query: { taskId } })
    return
  }
  if (isTerminal) {
    // 失败/取消也必须能回到创建页查看真实原因，不能只显示“已结束”且点击无效。
    router.push({ name: 'CoursewareCreate', query: { taskId } })
  }
}
</script>

<style scoped>
.courseware-generation-prompt {
  position: fixed;
  top: 72px;
  right: 20px;
  z-index: 3000;
  display: flex;
  width: min(300px, calc(100vw - 40px));
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  color: var(--el-text-color-primary);
  cursor: pointer;
  user-select: none;
  background: rgb(255 255 255 / 96%);
  border: 1px solid rgb(226 232 240);
  border-radius: 16px;
  box-shadow: 0 10px 28px rgb(15 23 42 / 12%);
  backdrop-filter: blur(8px);
}

.courseware-generation-prompt.is-collapsed {
  width: auto;
  min-width: 72px;
  border-radius: 999px;
}

.courseware-generation-prompt.is-dragging {
  cursor: grabbing;
}

.courseware-generation-drag-handle {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
  cursor: grab;
}

.courseware-generation-prompt.is-dragging .courseware-generation-drag-handle {
  cursor: grabbing;
}

.courseware-generation-toggle {
  display: flex;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: inherit;
  cursor: pointer;
  background: rgb(255 255 255 / 16%);
  border: 0;
  border-radius: 999px;
}

.courseware-generation-icon {
  display: flex;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
}

.courseware-generation-prompt.is-generating {
  color: #fff;
  background: #171518;
  border-color: rgb(255 255 255 / 10%);
  box-shadow: 0 12px 30px rgb(23 21 24 / 18%);
}

.courseware-generation-prompt.is-generating :deep(.el-progress-bar__outer) {
  background-color: rgb(255 255 255 / 12%);
}

.courseware-generation-prompt.is-generating :deep(.el-progress-bar__inner) {
  background-color: #8f98ff;
}

.courseware-generation-prompt.is-generating .text-slate-900,
.courseware-generation-prompt.is-generating .text-slate-500 {
  color: #fff !important;
}

.courseware-generation-prompt.is-generating .text-slate-500 {
  opacity: 0.5;
}

.courseware-generation-prompt.is-generating .courseware-generation-icon {
  color: #8f98ff;
  background: transparent;
}

.courseware-generation-prompt.is-success {
  color: #fff;
  background: #3b8f72;
  border-color: #78b29f;
  box-shadow: 0 12px 30px rgb(59 143 114 / 18%);
}

.courseware-generation-prompt.is-success .courseware-generation-icon {
  color: #fff;
  background: transparent;
}

.courseware-generation-prompt.is-waiting {
  color: #7c2d12;
  background: #fff7ed;
  border-color: #fed7aa;
  box-shadow: 0 12px 30px rgb(154 52 18 / 14%);
}

.courseware-generation-prompt.is-waiting .courseware-generation-icon {
  color: #9a3412;
  background: #ffedd5;
}

.courseware-generation-action {
  flex-shrink: 0;
  min-height: 28px;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
  cursor: pointer;
  background: #9a3412;
  border: 0;
  border-radius: 8px;
  transition: background-color 0.2s, transform 0.2s;
}

.courseware-generation-action:hover {
  background: #7c2d12;
}

.courseware-generation-action:active {
  transform: translateY(1px);
}

.courseware-generation-action:focus-visible {
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}

.review-button {
  flex-shrink: 0;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: rgb(255 255 255 / 20%);
  border: 0;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.review-button:hover {
  background: rgb(255 255 255 / 30%);
}

.courseware-generation-prompt.is-error .courseware-generation-icon {
  color: rgb(220 38 38);
  background: rgb(254 242 242);
}
</style>
