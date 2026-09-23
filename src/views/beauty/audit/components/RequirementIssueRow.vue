<script setup lang="ts">
/**
 * 自定义审计的「现在关注到的问题」行（原型 `RequirementTab.tsx` 里的 `IssueRow`）。
 */
import { computed } from 'vue'
import {
  ASPECT_LABELS,
  aspectOfRule,
  requirementIssueLabel
} from '@/beauty/lib/inspectionRequirements'
import type { RequirementAspect } from '@/beauty/lib/inspectionRequirements'
import type { InspectionRisk, InspectionState } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'

defineOptions({ name: 'BeautyRequirementIssueRow' })

const props = defineProps<{
  state: InspectionState
  risk: InspectionRisk
}>()

const emit = defineEmits<{
  (e: 'focus-task', taskId: string): void
  (e: 'open-task', taskId: string): void
}>()

const { t } = useBeautyI18n()

const ASPECT_TONE: Record<RequirementAspect, string> = {
  duplicate: 'bg-amber-50 text-amber-700 ring-amber-200',
  crowding: 'bg-sky-50 text-sky-700 ring-sky-200',
  workload: 'bg-rose-50 text-rose-700 ring-rose-200',
  category: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'data-gap': 'bg-violet-50 text-violet-700 ring-violet-200'
}

const aspect = computed(() => aspectOfRule(props.risk.ruleId))
const taskId = computed(() => props.risk.taskIds[0] ?? null)

const titles = computed(() =>
  props.risk.taskIds
    .map((id) => props.state.tasks.find((task) => task.id === id)?.title)
    .filter(Boolean)
    .slice(0, 3)
    .join('、')
)

const isSource = computed(() => {
  if (!taskId.value) return false
  return props.state.tasks.find((task) => task.id === taskId.value)?.origin === 'source'
})

const issueLabel = computed(() => requirementIssueLabel(props.state, props.risk))
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
    <span class="grid gap-1">
      <span class="flex flex-wrap items-center gap-1.5">
        <BeautyChip v-if="aspect" :tone="ASPECT_TONE[aspect]">{{
          t(ASPECT_LABELS[aspect])
        }}</BeautyChip>
        <span class="text-[12.5px] font-medium text-foreground">{{ issueLabel }}</span>
      </span>
      <span class="text-[10.5px] text-muted-foreground">
        {{ titles ? `${t('任务：')}${titles}` : t('覆盖这类问题的全部任务') }}
      </span>
    </span>
    <span class="flex items-center gap-2">
      <button
        v-if="taskId"
        type="button"
        class="inspection-link"
        @click="emit('focus-task', taskId)"
      >
        {{ t('看任务') }}
      </button>
      <button
        v-if="isSource && taskId"
        type="button"
        class="inspection-link"
        @click="emit('open-task', taskId)"
      >
        {{ t('原任务') }}
      </button>
    </span>
  </div>
</template>
