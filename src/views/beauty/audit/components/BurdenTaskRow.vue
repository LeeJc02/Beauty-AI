<script setup lang="ts">
/**
 * 区域明细里的任务行（原型 `RegionBurdenTab.tsx` 里的 `TaskRow`）。
 *
 * 原型这里也接了 `onDispose`，但函数体里没用到（历史遗留）；Vue 版保留同样的
 * 事件声明，保证父层的接线与原型一一对应。
 */
import { computed } from 'vue'
import type { BurdenTaskRow } from '@/beauty/lib/inspectionBurden'
import type { DispositionAction, InspectionState, TaskPatch } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyKindBadge from './BeautyKindBadge.vue'
import BeautyWeightBadge from './BeautyWeightBadge.vue'

defineOptions({ name: 'BeautyBurdenTaskRow' })

const props = defineProps<{
  task: BurdenTaskRow
  state: InspectionState
  highlighted: boolean
}>()

const emit = defineEmits<{
  (
    e: 'dispose',
    taskId: string,
    riskKey?: string,
    patch?: TaskPatch,
    action?: DispositionAction
  ): void
  (e: 'open-task', taskId: string): void
  (e: 'open-detail', taskId: string): void
}>()

const { t } = useBeautyI18n()

const dayLabel = (day: string) => day.slice(5).replace('-', '/')

const source = computed(() => props.state.tasks.find((item) => item.id === props.task.taskId))

const busiestText = computed(() =>
  props.task.busiestDay
    ? `${t('最挤')} ${dayLabel(props.task.busiestDay)}（${t('人均')} ${props.task.busiestMinutes} ${t('分钟')}）`
    : t('本周没有排期')
)
</script>

<template>
  <div
    :data-burden-task="task.taskId"
    class="grid gap-1.5 rounded-lg px-2.5 py-2 ring-1 transition-colors"
    :class="highlighted ? 'bg-primary/10 ring-primary/40' : 'bg-muted/40 ring-transparent'"
  >
    <div class="flex flex-wrap items-center gap-1.5">
      <BeautyKindBadge :kind="task.kind" />
      <span class="text-[12.5px] font-medium text-foreground">{{ task.title }}</span>
      <BeautyWeightBadge v-if="task.weight" :weight="task.weight" />
      <BeautyChip v-if="task.missingMinutes" tone="bg-violet-50 text-violet-700 ring-violet-200">
        {{ t('缺时长') }}
      </BeautyChip>
      <BeautyChip v-if="task.duplicateWith.length" tone="bg-amber-50 text-amber-700 ring-amber-200">
        <Icon icon="lucide:alert-triangle" :size="11" /> {{ t('内容重复') }}
        {{ task.duplicateWith.length }}
      </BeautyChip>
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span>{{ t('覆盖') }} {{ task.peopleCount }} {{ t('人') }}</span>
      <span class="text-foreground"
        >{{ t('人均') }} {{ task.minutesPerPerson }} {{ t('分钟') }}</span
      >
      <span>{{ t('本周') }} {{ task.occurrences }} {{ t('次') }}</span>
      <span>{{ busiestText }}</span>
      <span class="flex items-center gap-2">
        <button type="button" class="inspection-link" @click="emit('open-detail', task.taskId)">
          {{ t('查看详情') }}
        </button>
        <button
          v-if="source?.origin === 'source'"
          type="button"
          class="inspection-link"
          @click="emit('open-task', task.taskId)"
        >
          {{ t('原任务') }}
        </button>
      </span>
    </div>
  </div>
</template>
