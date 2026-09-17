<script setup lang="ts">
/**
 * 审计批次记录（原型 `training-inspection/RunTimeline.tsx`）。
 *
 * 只回答「这次有没有异常、异常任务是什么」，明细进弹窗。
 */
import type { InspectionActor, InspectionState } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyEmptyState from './BeautyEmptyState.vue'
import BeautySectionHeading from './BeautySectionHeading.vue'
import RunRow from './RunRow.vue'

defineOptions({ name: 'BeautyRunTimeline' })

defineProps<{
  state: InspectionState
  actor: InspectionActor
}>()

const emit = defineEmits<{
  (e: 'focus-task', taskId: string): void
  (e: 'open-task', taskId: string): void
}>()

const { t } = useBeautyI18n()
</script>

<template>
  <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
    <BeautySectionHeading
      :title="t('审计工作记录')"
      :hint="t('每条只记有没有异常、异常的是哪些任务；结论没变就合并，只更新时间')"
    >
      <template #extra>
        <BeautyChip tone="bg-secondary text-secondary-foreground ring-primary/20">
          {{ state.inspectionRuns.length }} {{ t('个批次') }}
        </BeautyChip>
      </template>
    </BeautySectionHeading>
    <div class="mt-3 grid gap-2">
      <template v-if="state.inspectionRuns.length">
        <RunRow
          v-for="record in [...state.inspectionRuns].reverse()"
          :key="record.id"
          :record="record"
          :state="state"
          :actor="actor"
          @focus-task="emit('focus-task', $event)"
          @open-task="emit('open-task', $event)"
        />
      </template>
      <BeautyEmptyState v-else :title="t('还没有审计记录')" :hint="t('点右上角「立即审计」开始。')" />
    </div>
  </div>
</template>
