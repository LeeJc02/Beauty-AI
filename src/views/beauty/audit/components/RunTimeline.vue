<script setup lang="ts">
/**
 * 审计批次记录（原型 `training-inspection/RunTimeline.tsx`）。
 *
 * 只回答「这次有没有异常、异常任务是什么」，明细进弹窗。
 */
import { computed } from 'vue'
import { canSeeTask } from '@/beauty/lib/inspectionEngine'
import type {
  InspectionActor,
  InspectionRunRecord,
  InspectionState
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyEmptyState from './BeautyEmptyState.vue'
import BeautySectionHeading from './BeautySectionHeading.vue'
import RunRow from './RunRow.vue'

defineOptions({ name: 'BeautyRunTimeline' })

const props = defineProps<{
  state: InspectionState
  actor: InspectionActor
}>()

/** 区域角色只看本区域与全国任务，历史批次里的变化标题也不能越权展示。 */
const visibleRecords = computed<InspectionRunRecord[]>(() => {
  if (props.actor.hq) return props.state.inspectionRuns
  const visibleTaskIds = new Set(
    props.state.tasks.filter((task) => canSeeTask(props.actor, task)).map((task) => task.id)
  )
  return props.state.inspectionRuns
    .map((record) => {
      const taskIds = record.taskIds.filter((id) => visibleTaskIds.has(id))
      const taskResults = record.taskResults.filter((result) => visibleTaskIds.has(result.taskId))
      const changeVisible = (change: { taskIds: string[] }) =>
        change.taskIds.some((id) => visibleTaskIds.has(id))
      const levelChanged = record.levelChanged.filter((change) => {
        const risk = props.state.risks.find((item) => item.key === change.key)
        return risk ? risk.taskIds.some((id) => visibleTaskIds.has(id)) : false
      })
      return {
        ...record,
        taskIds,
        taskCount: taskIds.length,
        taskResults,
        added: record.added.filter(changeVisible),
        resolved: record.resolved.filter(changeVisible),
        levelChanged
      }
    })
    .filter((record) => record.taskIds.length)
})

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
          {{ visibleRecords.length }} {{ t('个批次') }}
        </BeautyChip>
      </template>
    </BeautySectionHeading>
    <div class="mt-3 grid gap-2">
      <template v-if="visibleRecords.length">
        <RunRow
          v-for="record in [...visibleRecords].reverse()"
          :key="record.id"
          :record="record"
          :state="state"
          :actor="actor"
          @focus-task="emit('focus-task', $event)"
          @open-task="emit('open-task', $event)"
        />
      </template>
      <BeautyEmptyState
        v-else
        :title="t('还没有审计记录')"
        :hint="t('点右上角「立即审计」开始。')"
      />
    </div>
  </div>
</template>
