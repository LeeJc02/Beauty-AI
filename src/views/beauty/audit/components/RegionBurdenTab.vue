<script setup lang="ts">
/**
 * 区域工时审计（原型 `training-inspection/RegionBurdenTab.tsx`）。
 *
 * 区域对比 → 区域明细（任务占用 / 重复内容 / 超载的人）→ 只读任务详情弹窗。
 * 原型的 `RegionTable` / `RegionDetail` / `TaskRows` / `TaskRow` / `PersonRow`
 * 都在这一个文件里，Vue 拆成同目录的 `RegionTable.vue` / `RegionDetail.vue` /
 * `BurdenTaskRow.vue` / `BurdenPersonRow.vue`。
 */
import { computed, ref, watch } from 'vue'
import { addDays, inspectionDay } from '@/beauty/lib/inspectionEngine'
import {
  rankRegions,
  regionBurden,
  visibleRegionIds,
  type RegionBurden
} from '@/beauty/lib/inspectionBurden'
import type {
  DispositionAction,
  InspectionActor,
  InspectionState,
  TaskPatch
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import RegionDetail from './RegionDetail.vue'
import RegionTable from './RegionTable.vue'
import TaskDetailDialog from './TaskDetailDialog.vue'

defineOptions({ name: 'BeautyRegionBurdenTab' })

const props = withDefaults(
  defineProps<{
    state: InspectionState
    actor: InspectionActor
    week: string
    today?: string
    selectedTaskId?: string | null
  }>(),
  { selectedTaskId: null }
)

const emit = defineEmits<{
  (
    e: 'dispose',
    taskId: string,
    riskKey?: string,
    patch?: TaskPatch,
    action?: DispositionAction
  ): void
  (e: 'open-task', taskId: string): void
}>()

const { t } = useBeautyI18n()

const today = computed(() => props.today ?? inspectionDay())

const dayLabel = (day: string) => day.slice(5).replace('-', '/')

const burdens = computed(() =>
  regionBurden(props.state, props.week, today.value, visibleRegionIds(props.state, props.actor))
)
const ranked = computed(() => rankRegions(burdens.value))

const openRegionId = ref<string | null>(null)
const highlight = ref<string | null>(null)
const detailTaskId = ref<string | null>(null)

// 区域账号（非总部）没有对比需求，直接进自己的区域
watch(
  () => [props.actor, ranked.value] as const,
  () => {
    if (!props.actor.hq) openRegionId.value = ranked.value[0]?.regionId ?? null
  },
  { immediate: true }
)

// 从审计总览结论跳进来时定位到对应任务
watch(
  () => [props.selectedTaskId, ranked.value] as const,
  () => {
    if (!props.selectedTaskId) return
    const owner = ranked.value.find((item) =>
      item.tasks.some((task) => task.taskId === props.selectedTaskId)
    )
    if (!owner) return
    openRegionId.value = owner.regionId
    highlight.value = props.selectedTaskId
    window.setTimeout(() => {
      highlight.value = null
    }, 3200)
  },
  { immediate: true }
)

watch(
  () => [highlight.value, openRegionId.value] as const,
  () => {
    if (!highlight.value) return
    document
      .querySelector(`[data-burden-task="${highlight.value}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
)

const region = computed<RegionBurden | null>(
  () => ranked.value.find((item) => item.regionId === openRegionId.value) ?? null
)

const weekLabel = computed(() => `${dayLabel(props.week)} – ${dayLabel(addDays(props.week, 6))}`)

const capacityHint = computed(() =>
  region.value
    ? `（${region.value.capacityMinutes} ${t('分钟/人/周')}${region.value.capacityConfirmed ? '' : t('，未确认用策略默认值')}）`
    : `（${t('未确认的区域用策略')} ${props.state.policy.weeklyCapacityMinutes} ${t('分钟/人/周')}）`
)

const detailTask = computed(
  () => props.state.tasks.find((item) => item.id === detailTaskId.value) ?? null
)

/** 任务详情弹窗的开关（原型用 `open={!!detailTaskId}`）。 */
const detailTaskIdOpen = computed({
  get: () => Boolean(detailTaskId.value),
  set: (open: boolean) => {
    if (!open) detailTaskId.value = null
  }
})

const onDispose = (
  taskId: string,
  riskKey?: string,
  patch?: TaskPatch,
  action?: DispositionAction
) => emit('dispose', taskId, riskKey, patch, action)

const onOpenSource = (taskId: string) => {
  detailTaskId.value = null
  emit('open-task', taskId)
}
</script>

<template>
  <div class="grid gap-4">
    <div
      class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"
    >
      <span>
        {{ t('统计周期') }} {{ weekLabel }} · {{ t('口径：区域容量') }}{{ capacityHint }} ·
        {{ t('单日超过') }} {{ state.policy.dailyLimitMinutes }} {{ t('分钟记为单日过载') }}
      </span>
      <el-button v-if="region && actor.hq" size="small" plain @click="openRegionId = null">
        <Icon icon="lucide:arrow-left" :size="13" /> {{ t('返回区域对比') }}
      </el-button>
    </div>

    <RegionDetail
      v-if="region"
      :region="region"
      :state="state"
      :week="week"
      :today="today"
      :highlight="highlight"
      @dispose="onDispose"
      @open-task="emit('open-task', $event)"
      @open-detail="detailTaskId = $event"
    />
    <RegionTable v-else :regions="ranked" @open="openRegionId = $event" />

    <TaskDetailDialog
      v-model="detailTaskIdOpen"
      :state="state"
      :task="detailTask"
      :week="week"
      @open-source="onOpenSource"
    />
  </div>
</template>
