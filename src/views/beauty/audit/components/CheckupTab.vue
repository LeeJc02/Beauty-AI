<script setup lang="ts">
/**
 * 区域工时审计 · 任务体检（原型 `training-inspection/CheckupTab.tsx`）。
 *
 * 左侧任务清单（按问题排序），右侧五段体检：基本信息 / 人群 / 时间与负荷 /
 * 关联任务 / 结论，最后是发布前模拟。
 *
 * 注：原型里这个 Tab 没有被页面接进来（`TrainingInspection.tsx` 的 checkup
 * 用的是 `RegionBurdenTab`），这里按原型原样移植成一个组件，行为保持一致。
 */
import { computed, ref, watch } from 'vue'
import {
  KIND_LABELS,
  RESOURCE_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  WEIGHT_LABELS,
  addDays,
  canActOnTask,
  canSeeTask,
  daysBetween,
  missingFields,
  regionAggregates,
  simulateTaskChange,
  taskAudienceIds,
  taskOccurrenceMinutes
} from '@/beauty/lib/inspectionEngine'
import type {
  DispositionAction,
  InspectionActor,
  InspectionRisk,
  InspectionState,
  RiskLevel,
  TaskKind,
  TaskPatch
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyBar from './BeautyBar.vue'
import BeautyChip from './BeautyChip.vue'
import BeautyEmptyState from './BeautyEmptyState.vue'
import BeautyField from './BeautyField.vue'
import BeautyKindBadge from './BeautyKindBadge.vue'
import BeautyLevelBadge from './BeautyLevelBadge.vue'
import BeautySectionCard from './BeautySectionCard.vue'
import BeautySectionHeading from './BeautySectionHeading.vue'
import BeautyWeightBadge from './BeautyWeightBadge.vue'
import RiskCard from './RiskCard.vue'
import SimulationResultView from './SimulationResultView.vue'
import TaskPatchEditor from './TaskPatchEditor.vue'
import { FIELD_CLASS, formatDay, riskStatusOf, weekdayOf } from './shared'

defineOptions({ name: 'BeautyCheckupTab' })

const props = defineProps<{
  state: InspectionState
  actor: InspectionActor
  week: string
  today: string
  risks: InspectionRisk[]
  selectedTaskId: string | null
}>()

const emit = defineEmits<{
  (e: 'select-task', taskId: string): void
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

const levelRank: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, insufficient: 3 }

const kindOptions = Object.keys(KIND_LABELS) as TaskKind[]

const search = ref('')
const kind = ref<TaskKind | 'all'>('all')
const patch = ref<TaskPatch>({})

const visibleTasks = computed(() =>
  props.state.tasks
    .filter((task) => canSeeTask(props.actor, task))
    .filter((task) => kind.value === 'all' || task.kind === kind.value)
    .filter((task) =>
      `${task.title} ${task.audience.label} ${task.owners.hqOwnerName} ${task.owners.regionOwnerName}`
        .toLowerCase()
        .includes(search.value.toLowerCase())
    )
)

const levelOfTask = (taskId: string) =>
  props.risks
    .filter((risk) => risk.taskIds.includes(taskId))
    .reduce<RiskLevel | null>(
      (worstLevel, risk) =>
        !worstLevel || levelRank[risk.level] < levelRank[worstLevel] ? risk.level : worstLevel,
      null
    )

const sortedTasks = computed(() =>
  [...visibleTasks.value].sort((a, b) => {
    const aLevel = levelOfTask(a.id)
    const bLevel = levelOfTask(b.id)
    const aRank = aLevel ? levelRank[aLevel] : 9
    const bRank = bLevel ? levelRank[bLevel] : 9
    return aRank - bRank || a.title.localeCompare(b.title)
  })
)

const selected = computed(
  () =>
    sortedTasks.value.find((task) => task.id === props.selectedTaskId) ??
    sortedTasks.value[0] ??
    null
)

watch(
  () => selected.value?.id,
  () => {
    patch.value = {}
  }
)

const taskRisks = computed(() =>
  props.risks
    .filter((risk) => risk.taskIds.includes(selected.value?.id ?? ''))
    .sort((a, b) => levelRank[a.level] - levelRank[b.level])
)
const worst = computed(() => taskRisks.value[0])

const audienceIds = computed(() =>
  selected.value ? taskAudienceIds(props.state, selected.value) : null
)

const regionIds = computed(() => {
  const item = selected.value
  if (!item) return []
  return item.audience.regionIds.length
    ? item.audience.regionIds
    : props.state.regions.map((r) => r.id)
})

const aggregates = computed(() =>
  regionAggregates(props.state, props.week, props.today, regionIds.value)
)

const people = computed(() => aggregates.value.flatMap((region) => region.people))

const assigned = computed(() =>
  audienceIds.value
    ? people.value.filter((person) => audienceIds.value!.includes(person.personId))
    : people.value
)

const peakPerson = computed(() => [...assigned.value].sort((a, b) => b.dailyPeak - a.dailyPeak)[0])

const weekDays = computed(() => Array.from({ length: 7 }, (_, index) => addDays(props.week, index)))

const dayTotals = computed(() =>
  weekDays.value.map((day) =>
    assigned.value.reduce(
      (sum, person) =>
        sum +
        person.items
          .filter((item) => item.day === day)
          .reduce((total, item) => total + item.minutes, 0),
      0
    )
  )
)

const maxDayTotal = computed(() => Math.max(1, ...dayTotals.value))

const distribution = computed(() => {
  const item = selected.value
  if (!item) return []
  const regions = item.audience.regionIds.length
    ? props.state.regions.filter((region) => item.audience.regionIds.includes(region.id))
    : props.state.regions
  return regions.map((region) => {
    const count = (audienceIds.value ?? []).filter(
      (id) => props.state.people.find((person) => person.id === id)?.regionId === region.id
    ).length
    const eligible = props.state.people.filter(
      (person) => person.active && person.regionId === region.id
    ).length
    return { regionId: region.id, name: region.name, count, eligible }
  })
})

const roleCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const personId of audienceIds.value ?? []) {
    const person = props.state.people.find((item) => item.id === personId)
    if (!person) continue
    const label = ROLE_LABELS[person.role]
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([role, count]) => ({ role, count }))
})

const relatedTasks = computed(() => {
  const item = selected.value
  if (!item) return []
  return props.state.tasks.filter(
    (task) =>
      task.id !== item.id &&
      (item.relations.sameSourceTaskIds.includes(task.id) ||
        item.relations.prerequisiteTaskIds.includes(task.id) ||
        item.relations.exclusiveTaskIds.includes(task.id) ||
        item.relations.duplicateTaskIds.includes(task.id) ||
        task.resources.some((resource) => item.resources.some((own) => own.id === resource.id)))
  )
})

const sameDayTasks = computed(() => {
  const peak = peakPerson.value
  if (!peak?.peakDay) return [] as string[]
  return [
    ...new Set(
      (peak.items ?? []).filter((item) => item.day === peak.peakDay).map((item) => item.taskId)
    )
  ]
})

const simulation = computed(() => {
  const item = selected.value
  if (!item) return null
  return simulateTaskChange(props.state, item.id, patch.value, {
    weeks: [props.week],
    today: props.today
  })
})

const gaps = computed(() => (selected.value ? missingFields(selected.value) : []))
const canAct = computed(() => (selected.value ? canActOnTask(props.actor, selected.value) : false))

const occurrenceText = computed(() => {
  const item = selected.value
  if (!item) return ''
  const minutes = taskOccurrenceMinutes(item)
  return minutes === null
    ? t('缺失')
    : `${minutes} ${t('分钟')}（${t('含附加题')} ${item.additionalMinutes} ${t('分钟')}）`
})

const timeRuleText = computed(() => {
  const item = selected.value
  if (!item) return ''
  return item.frequency
    ? `${t(KIND_LABELS[item.kind])} · ${item.frequency.unit === 'once' ? t('一次性') : item.frequency.unit === 'daily' ? t('每日') : t('每周')} ${item.frequency.count} ${t('次')}`
    : t('缺少结构化频次')
})

const statusText = (status: string) =>
  status === 'draft' ? t('草稿') : status === 'paused' ? t('已暂停') : t('执行中')

const meanMinutes = computed(() =>
  Math.round(
    assigned.value.length
      ? assigned.value.reduce((sum, person) => sum + person.plannedMinutes, 0) /
          assigned.value.length
      : 0
  )
)

const peakPersonText = computed(() =>
  peakPerson.value
    ? `${peakPerson.value.name} ${peakPerson.value.dailyPeak} ${t('分钟')}（${peakPerson.value.peakDay ?? '—'}）`
    : '—'
)

const peakDayItems = computed(() =>
  (peakPerson.value?.items ?? [])
    .filter((item) => item.day === peakPerson.value?.peakDay)
    .map((item) => `${item.taskTitle} ${Math.round(item.minutes)} ${t('分钟')}`)
    .join('、')
)

const onDispose = (
  taskId: string,
  riskKey?: string,
  nextPatch?: TaskPatch,
  action?: DispositionAction
) => emit('dispose', taskId, riskKey, nextPatch, action)

const submitDisposal = () => {
  const item = selected.value
  if (!item) return
  onDispose(
    item.id,
    worst.value?.key,
    patch.value,
    Object.keys(patch.value).length ? 'adjust-task' : 'mark-exception'
  )
}
</script>

<template>
  <div v-if="!selected" class="grid gap-4">
    <BeautyEmptyState :title="t('没有可查看的任务')" :hint="t('换个筛选条件。')" />
  </div>
  <div v-else class="grid gap-4 lg:grid-cols-[300px_1fr]">
    <div class="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <BeautySectionHeading
        :title="t('任务清单')"
        :hint="`${visibleTasks.length} ${t('项 · 按问题排序')}`"
      />
      <div class="mt-2.5 grid gap-2">
        <div class="relative">
          <Icon
            icon="lucide:search"
            :size="13"
            class="absolute top-2.5 left-2 text-muted-foreground"
          />
          <input
            v-model="search"
            :class="[FIELD_CLASS, 'w-full pl-6']"
            :placeholder="t('搜索任务')"
          />
        </div>
        <div class="flex flex-wrap gap-1">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-[11px] ring-1 ring-inset"
            :class="
              kind === 'all'
                ? 'bg-primary/10 text-primary ring-primary/30'
                : 'text-muted-foreground ring-border'
            "
            @click="kind = 'all'"
          >
            {{ t('全部') }}
          </button>
          <button
            v-for="item in kindOptions"
            :key="item"
            type="button"
            class="rounded-md px-2 py-1 text-[11px] ring-1 ring-inset"
            :class="
              kind === item
                ? 'bg-primary/10 text-primary ring-primary/30'
                : 'text-muted-foreground ring-border'
            "
            @click="kind = item"
          >
            {{ t(KIND_LABELS[item]) }}
          </button>
        </div>
      </div>
      <div class="mt-3 grid max-h-[620px] gap-1.5 overflow-y-auto pr-0.5">
        <button
          v-for="task in sortedTasks"
          :key="task.id"
          type="button"
          class="grid gap-1 rounded-lg px-2.5 py-2 text-left ring-1 ring-inset transition"
          :class="
            task.id === selected.id
              ? 'bg-secondary/70 ring-primary/30'
              : 'bg-background ring-border hover:bg-muted/60'
          "
          @click="emit('select-task', task.id)"
        >
          <span class="flex items-center justify-between gap-1.5">
            <span class="flex items-center gap-1">
              <BeautyKindBadge :kind="task.kind" />
              <BeautyChip
                v-if="task.origin === 'source'"
                tone="bg-violet-50 text-violet-700 ring-violet-200"
              >
                {{ t('外部接入') }}
              </BeautyChip>
            </span>
            <BeautyLevelBadge v-if="levelOfTask(task.id)" :level="levelOfTask(task.id)!" />
            <BeautyChip v-else tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
              {{ t('无风险') }}
            </BeautyChip>
          </span>
          <span class="text-[12px] font-medium text-foreground">{{ task.title }}</span>
          <span class="text-[10.5px] text-muted-foreground">
            {{ statusText(task.status) }} · v{{ task.version }} · {{ t('命中') }}
            {{ task.audience.resolvedPersonIds?.length ?? 0 }} {{ t('人') }}
            {{
              risks.filter((risk) => risk.taskIds.includes(task.id)).length
                ? ` · ${risks.filter((risk) => risk.taskIds.includes(task.id)).length} ${t('项风险')}`
                : ''
            }}
          </span>
        </button>
      </div>
    </div>

    <div class="grid gap-3">
      <div
        class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-3.5 py-3 ring-1 ring-foreground/10"
      >
        <div class="grid gap-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <BeautyKindBadge :kind="selected.kind" />
            <BeautyWeightBadge :weight="selected.weight" />
            <BeautyChip tone="bg-muted text-muted-foreground ring-border">
              {{ t(SCOPE_LABELS[selected.audience.scope]) }}
            </BeautyChip>
            <BeautyChip tone="bg-muted text-muted-foreground ring-border">
              v{{ selected.version }}
            </BeautyChip>
            <BeautyChip v-if="gaps.length" tone="bg-violet-50 text-violet-700 ring-violet-200">
              {{ t('缺') }} {{ gaps.length }} {{ t('项字段') }}
            </BeautyChip>
            <BeautyChip v-else tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
              {{ t('字段齐全') }}
            </BeautyChip>
          </div>
          <h2 class="text-[15px] font-semibold text-foreground">{{ selected.title }}</h2>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <el-button size="small" plain @click="emit('open-task', selected.id)">
            {{ t('原任务') }}
          </el-button>
          <el-button
            size="small"
            :disabled="!canAct"
            @click="onDispose(selected.id, worst?.key, patch, 'adjust-task')"
          >
            <Icon icon="lucide:sparkles" :size="13" /> {{ t('提交处置') }}
          </el-button>
        </div>
      </div>

      <div class="grid gap-3 xl:grid-cols-2">
        <BeautySectionCard :title="t('1 · 基本信息')">
          <template #icon><Icon icon="lucide:info" :size="13" /></template>
          <div class="grid gap-2.5 sm:grid-cols-2">
            <BeautyField :label="t('任务类型')">{{ t(KIND_LABELS[selected.kind]) }}</BeautyField>
            <BeautyField :label="t('任务权重')">
              {{ selected.weight ? t(WEIGHT_LABELS[selected.weight]) : t('未标注') }}
            </BeautyField>
            <BeautyField :label="t('内容资源')">
              {{
                selected.resources.length
                  ? selected.resources
                      .map(
                        (resource) =>
                          `${resource.name}（${t(RESOURCE_LABELS[resource.type])}${resource.minutes === null ? t('，时长缺失') : ` ${resource.minutes} ${t('分钟')}`}）`
                      )
                      .join('；')
                  : t('未关联内容')
              }}
            </BeautyField>
            <BeautyField :label="t('单次预计时长')">{{ occurrenceText }}</BeautyField>
            <BeautyField :label="t('负责人')">
              {{ t('总部') }} {{ selected.owners.hqOwnerName || t('未配置') }} · {{ t('区域') }}
              {{ selected.owners.regionOwnerName || t('未配置') }}
            </BeautyField>
            <BeautyField :label="t('有效周期')">
              {{ selected.startsOn }} ~ {{ selected.endsOn }}（{{
                daysBetween(selected.startsOn, selected.endsOn) + 1
              }}
              {{ t('天') }}）
            </BeautyField>
            <BeautyField :label="t('时间规则')">{{ timeRuleText }}</BeautyField>
            <BeautyField :label="t('发布与提醒')">
              {{ selected.publishedAt ?? t('未发布') }} ·
              {{
                selected.reminder?.enabled
                  ? `${t('提前')} ${selected.reminder.daysBefore} ${t('天提醒')}`
                  : t('未启用提醒')
              }}
            </BeautyField>
          </div>
        </BeautySectionCard>

        <BeautySectionCard :title="t('2 · 人群')">
          <template #icon><Icon icon="lucide:users" :size="13" /></template>
          <div class="grid gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <BeautyChip tone="bg-muted text-muted-foreground ring-border">
                {{ t('策略：') }}{{ selected.audience.label }}
              </BeautyChip>
              <BeautyChip tone="bg-muted text-muted-foreground ring-border">
                {{ t('预期') }} {{ selected.audience.expectedCount ?? t('未配置') }} {{ t('人') }}
              </BeautyChip>
              <BeautyChip tone="bg-muted text-muted-foreground ring-border">
                {{ t('命中') }} {{ audienceIds?.length ?? 0 }} {{ t('人') }}
              </BeautyChip>
              <BeautyChip tone="bg-muted text-muted-foreground ring-border">
                {{ t('名单') }} v{{ selected.audience.snapshotVersion }}
              </BeautyChip>
            </div>
            <div v-for="row in distribution" :key="row.regionId" class="grid gap-1">
              <div class="flex items-center justify-between text-[11px]">
                <span>{{ row.name }}</span>
                <span class="text-muted-foreground"
                  >{{ row.count }} / {{ row.eligible }} {{ t('人') }}</span
                >
              </div>
              <BeautyBar :value="row.count" :max="Math.max(1, row.eligible)" />
            </div>
            <div class="flex flex-wrap gap-1">
              <BeautyChip
                v-for="item in roleCounts"
                :key="item.role"
                tone="bg-muted text-muted-foreground ring-border"
              >
                {{ t(item.role) }} {{ item.count }} {{ t('人') }}
              </BeautyChip>
            </div>
            <p
              v-if="selected.audience.snapshotVersion < selected.version"
              class="text-[11px] text-amber-700"
            >
              {{ t('员工名单由') }} v{{ selected.audience.snapshotVersion }}
              {{ t('生成，任务已更新到') }} v{{ selected.version
              }}{{ t('，需要按最新人群策略重新生成名单。') }}
            </p>
          </div>
        </BeautySectionCard>

        <BeautySectionCard :title="t('3 · 时间与负荷')">
          <template #icon><Icon icon="lucide:clock" :size="13" /></template>
          <div class="grid gap-2.5">
            <div class="grid gap-1">
              <div class="flex items-center justify-between text-[11px]">
                <span>{{ t('本周每日累计分钟（命中人群合计）') }}</span>
                <span class="text-muted-foreground">
                  {{ t('峰值') }} {{ Math.max(...dayTotals) }} {{ t('分钟') }}
                </span>
              </div>
              <div class="grid grid-cols-7 gap-1">
                <div v-for="(day, index) in weekDays" :key="day" class="grid gap-1">
                  <div class="flex h-16 items-end rounded-md bg-muted/60">
                    <div
                      class="w-full rounded-md"
                      :class="dayTotals[index] > 0 ? 'bg-primary/70' : ''"
                      :style="{ height: `${Math.max(2, (dayTotals[index] / maxDayTotal) * 100)}%` }"
                      :title="`${day}: ${dayTotals[index]} ${t('分钟')}`"
                    ></div>
                  </div>
                  <div class="text-center text-[10px] text-muted-foreground">
                    {{ formatDay(day) }}
                    <div>{{ t('周') }}{{ weekdayOf(day) }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="grid gap-2 sm:grid-cols-3">
              <BeautyField :label="t('区域人均预计分钟')"
                >{{ meanMinutes }} {{ t('分钟') }}</BeautyField
              >
              <BeautyField :label="t('最高单人峰值')">{{ peakPersonText }}</BeautyField>
              <BeautyField :label="t('本周命中人数')">
                {{ assigned.length }} {{ t('人 · 名单') }}
                {{ selected.audience.resolvedPersonIds?.length ?? 0 }} {{ t('人') }}
              </BeautyField>
            </div>
            <div
              v-if="peakPerson"
              class="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground"
            >
              {{ t('峰值日构成：') }}{{ peakDayItems }}
            </div>
          </div>
        </BeautySectionCard>

        <BeautySectionCard :title="t('4 · 关联任务')">
          <template #icon><Icon icon="lucide:git-branch" :size="13" /></template>
          <div class="grid gap-2 text-[11.5px]">
            <template v-if="relatedTasks.length">
              <div
                v-for="task in relatedTasks"
                :key="task.id"
                class="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-muted/50 px-2.5 py-1.5"
              >
                <span class="flex items-center gap-1.5">
                  <BeautyKindBadge :kind="task.kind" />
                  <span class="text-foreground">{{ task.title }}</span>
                </span>
                <span class="flex flex-wrap items-center gap-1">
                  <BeautyChip
                    v-if="selected.relations.sameSourceTaskIds.includes(task.id)"
                    tone="bg-indigo-50 text-indigo-700 ring-indigo-200"
                  >
                    {{ t('同源内容') }}
                  </BeautyChip>
                  <BeautyChip
                    v-if="selected.relations.prerequisiteTaskIds.includes(task.id)"
                    tone="bg-sky-50 text-sky-700 ring-sky-200"
                  >
                    {{ t('前置任务') }}
                  </BeautyChip>
                  <BeautyChip
                    v-if="selected.relations.exclusiveTaskIds.includes(task.id)"
                    tone="bg-rose-50 text-rose-700 ring-rose-200"
                  >
                    {{ t('互斥任务') }}
                  </BeautyChip>
                  <BeautyChip
                    v-if="
                      task.resources.some((resource) =>
                        selected.resources.some((own) => own.id === resource.id)
                      )
                    "
                    tone="bg-amber-50 text-amber-700 ring-amber-200"
                  >
                    {{ t('内容重复') }}
                  </BeautyChip>
                </span>
              </div>
            </template>
            <p v-else class="text-muted-foreground">{{ t('未发现同源、前置或重复任务。') }}</p>
            <div
              v-if="sameDayTasks.length > 1"
              class="rounded-lg bg-amber-50/70 p-2.5 text-amber-900 ring-1 ring-amber-200"
            >
              {{ peakPerson?.name }} {{ t('在') }} {{ peakPerson?.peakDay }} {{ t('同时有') }}
              {{ sameDayTasks.length }} {{ t('项任务：') }}
              {{
                sameDayTasks
                  .map((id) => state.tasks.find((task) => task.id === id)?.title ?? id)
                  .join('、')
              }}
            </div>
          </div>
        </BeautySectionCard>
      </div>

      <BeautySectionCard :title="t('5 · 结论')">
        <template #icon><Icon icon="lucide:circle-check-big" :size="13" /></template>
        <template #extra>
          <div class="flex flex-wrap items-center gap-1.5">
            <template v-if="worst">
              <BeautyLevelBadge :level="worst.level" />
              <BeautyChip tone="bg-muted text-muted-foreground ring-border">
                {{ taskRisks.length }} {{ t('项规则命中') }}
              </BeautyChip>
            </template>
            <BeautyChip v-else tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
              {{ t('通过') }}
            </BeautyChip>
          </div>
        </template>
        <div v-if="taskRisks.length" class="grid gap-2">
          <RiskCard
            v-for="risk in taskRisks"
            :key="risk.key"
            :state="state"
            :actor="actor"
            :risk="risk"
            :status="riskStatusOf(state, risk)"
            variant="row"
            @simulate="onDispose(risk.taskIds[0] ?? selected.id, risk.key, {}, undefined)"
            @dispose="onDispose(risk.taskIds[0] ?? selected.id, risk.key, {}, undefined)"
            @open-task="emit('open-task', $event)"
          />
        </div>
        <div
          v-else
          class="flex items-center gap-2 rounded-lg bg-emerald-50/70 px-3 py-2.5 text-[12px] text-emerald-800 ring-1 ring-emerald-200"
        >
          <Icon icon="lucide:circle-check-big" :size="14" /> {{ t('没发现问题。') }}
        </div>
        <div
          v-if="gaps.length"
          class="mt-2 flex items-start gap-2 rounded-lg bg-violet-50/70 px-3 py-2.5 text-[11.5px] text-violet-800 ring-1 ring-violet-200"
        >
          <Icon icon="lucide:alert-triangle" :size="14" class="mt-0.5" />
          <div>
            {{ t('数据不足，暂不下结论：') }}{{ gaps.map((gap) => gap.field).join('、') }}
            <div class="mt-0.5 text-violet-700/80">
              {{ t('来源：') }}{{ gaps.map((gap) => gap.ref).join('；') }}
            </div>
          </div>
        </div>
      </BeautySectionCard>

      <BeautySectionCard :title="t('发布前模拟')">
        <template #icon><Icon icon="lucide:sparkles" :size="13" /></template>
        <template #extra>
          <BeautyChip tone="bg-secondary text-secondary-foreground ring-primary/20">
            {{ t('修改人群 / 频次 / 截止 / 时长，立即重算') }}
          </BeautyChip>
        </template>
        <div class="grid gap-4">
          <TaskPatchEditor
            :state="state"
            :task="selected"
            :patch="patch"
            :actor="actor"
            @update:patch="patch = $event"
          />
          <SimulationResultView v-if="simulation" :result="simulation" />
          <div
            class="flex flex-wrap items-center justify-between gap-2 border-t border-solid border-border pt-3"
          >
            <span class="text-[11px] text-muted-foreground">
              {{
                canAct
                  ? t('Agent 不改任务；确认处置后才写入新版本。')
                  : t('你只能查看，调整需负责人确认。')
              }}
            </span>
            <div class="flex gap-1.5">
              <el-button plain size="small" @click="patch = {}">{{ t('重置') }}</el-button>
              <el-button size="small" :disabled="!canAct" @click="submitDisposal">
                {{ t('提交处置') }}
              </el-button>
            </div>
          </div>
        </div>
      </BeautySectionCard>
    </div>
  </div>
</template>
