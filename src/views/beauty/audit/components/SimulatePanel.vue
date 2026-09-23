<script setup lang="ts">
/**
 * 发布前模拟弹窗（原型 `training-inspection/SimulatePanel.tsx` 的 `SimulationDialog`）。
 *
 * 原型在 `simulateTask` 非空时才挂载，所以每次打开 patch 都重新初始化；
 * Vue 版由父级 `v-if` 挂载，保持同一语义。
 */
import { computed, ref, watch } from 'vue'
import { taskAudienceIds, simulateTaskChange } from '@/beauty/lib/inspectionEngine'
import type {
  InspectionActor,
  InspectionState,
  InspectionTask,
  TaskPatch
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import SimulationResultView from './SimulationResultView.vue'
import TaskPatchEditor from './TaskPatchEditor.vue'
import { formatDay } from './shared'

defineOptions({ name: 'BeautySimulatePanel' })

const props = defineProps<{
  state: InspectionState
  actor: InspectionActor
  task: InspectionTask
  week: string
  today: string
  initialPatch?: TaskPatch
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-disposition', patch: TaskPatch, summary: string): void
}>()

const { t } = useBeautyI18n()

const visible = ref(true)
const patch = ref<TaskPatch>(props.initialPatch ?? {})

watch(visible, (value) => {
  if (!value) emit('close')
})

const result = computed(() =>
  simulateTaskChange(props.state, props.task.id, patch.value, {
    weeks: [props.week],
    today: props.today
  })
)

const onOpenDisposition = () => {
  visible.value = false
  emit('open-disposition', patch.value, result.value.summary)
}
</script>

<template>
  <el-dialog v-model="visible" class="inspection-modal" width="880px" append-to-body>
    <template #header>
      <div class="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <Icon icon="lucide:sparkles" :size="16" /> {{ t('发布前模拟') }} · {{ task.title }}
      </div>
    </template>
    <div class="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
      <TaskPatchEditor
        :state="state"
        :task="task"
        :patch="patch"
        :actor="actor"
        @update:patch="patch = $event"
      />
      <SimulationResultView :result="result" />
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-t border-solid border-border pt-3"
      >
        <span class="text-[11px] text-muted-foreground">
          {{ taskAudienceIds(state, task)?.length ?? 0 }} {{ t('人') }} · {{ t('截止') }}
          {{ formatDay(task.endsOn) }} · {{ t('当前版本') }} v{{ task.version }}
        </span>
        <div class="flex gap-2">
          <el-button plain size="small" @click="patch = {}">{{ t('重置') }}</el-button>
          <el-button size="small" @click="onOpenDisposition">
            {{ t('进入处置并填写原因') }}
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>
