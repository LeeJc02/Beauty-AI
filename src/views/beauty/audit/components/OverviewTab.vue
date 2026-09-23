<script setup lang="ts">
/**
 * 审计工作台（原型 `training-inspection/OverviewTab.tsx`）。
 *
 * 结论区只讲任务对人的影响：哪些任务叠在同一个人身上、重复布置的点出来；
 * 风险等级计数不在这里出现，避免结论退化成「高中低 + 待补字段」的统计表。
 *
 * 注：原型的 `showConsole` 分支会在档案视图里再渲染一次 `AuditConsole`，
 * 但页面实际传的是 `showConsole={false}`（对话已上升为独立视图），Vue 版保留该
 * prop，只是不再引用 `AuditConsole.vue`，避免和对话视图的交付单元耦合。
 */
import { computed } from 'vue'
import {
  addDays,
  canSeeRegion,
  canSeeTask,
  formatCadence,
  regionAggregates,
  uniqueRisks
} from '@/beauty/lib/inspectionEngine'
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  RiskLevel
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import AgentPanel from './AgentPanel.vue'
import BeautyChip from './BeautyChip.vue'
import BeautyEmptyState from './BeautyEmptyState.vue'
import BeautyInfoTip from './BeautyInfoTip.vue'
import BeautyMetric from './BeautyMetric.vue'
import BeautySectionHeading from './BeautySectionHeading.vue'
import RunTimeline from './RunTimeline.vue'
import { formatDay, jakartaStamp, riskStatusOf, todayLabel } from './shared'

defineOptions({ name: 'BeautyOverviewTab' })

const props = withDefaults(
  defineProps<{
    state: InspectionState
    actor: InspectionActor
    week: string
    today: string
    risks: InspectionRisk[]
    /** 归档视图不重复渲染 Agent 对话（那里已是一个独立视图）。 */
    showConsole?: boolean
  }>(),
  { showConsole: true }
)

const emit = defineEmits<{
  (e: 'open-task', taskId: string): void
  (e: 'focus-task', taskId: string): void
  (e: 'created-requirement', id: string): void
  (e: 'toast', text: string): void
}>()

const { t } = useBeautyI18n()

const LEVEL_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, insufficient: 3 }

const IMPACT_GROUPS: { label: string; tone: string; rules: string[] }[] = [
  {
    label: '负荷叠加',
    tone: 'bg-rose-50 text-rose-700 ring-rose-200',
    rules: ['A3', 'A1', 'A2', 'A4']
  },
  { label: '时间集中', tone: 'bg-sky-50 text-sky-700 ring-sky-200', rules: ['A5', 'B3'] },
  {
    label: '重复布置',
    tone: 'bg-amber-50 text-amber-700 ring-amber-200',
    rules: ['C3', 'C5', 'D2']
  },
  { label: '品类覆盖', tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200', rules: ['G1'] }
]

/** 区域多时只列前两个，避免一行里堆满区域名。 */
const regionSummary = (state: InspectionState, regionIds: string[]) => {
  const names = regionIds.map((id) => state.regions.find((item) => item.id === id)?.name ?? id)
  if (!names.length) return t('全局')
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} ${t('等')} ${names.length} ${t('个区域')}`
}

const latest = computed(() => {
  const record = props.state.inspectionRuns.at(-1)
  if (!record || props.actor.hq) return record
  const visibleTaskIds = new Set(
    props.state.tasks.filter((task) => canSeeTask(props.actor, task)).map((task) => task.id)
  )
  const taskIds = record.taskIds.filter((id) => visibleTaskIds.has(id))
  if (!taskIds.length) return undefined
  return {
    ...record,
    taskIds,
    taskCount: taskIds.length,
    taskResults: record.taskResults.filter((result) => visibleTaskIds.has(result.taskId))
  }
})

const savedSchedules = computed(() =>
  (props.state.auditSchedules ?? []).filter(
    (schedule) => props.actor.hq || schedule.actorId === props.actor.id
  )
)

const savedRecords = computed(() =>
  (props.state.auditRecords ?? [])
    .filter((record) => props.actor.hq || record.actorId === props.actor.id)
    .slice(0, 4)
)

const openRisks = computed(() =>
  uniqueRisks(props.risks.filter((risk) => riskStatusOf(props.state, risk) !== '已解决'))
)

const groupOf = (ruleId: string) => IMPACT_GROUPS.find((group) => group.rules.includes(ruleId))

const sortedByImpact = (rules: string[]) =>
  openRisks.value
    .filter((risk) => rules.includes(risk.ruleId))
    .sort(
      (a, b) =>
        LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
        b.impact.affectedPeople - a.impact.affectedPeople
    )

// 每个分组先各留一条，保证「叠加」和「重复」都出现在结论里，再用剩余名额补影响面最大的。
const impactPicks = computed(
  () =>
    IMPACT_GROUPS.map((group) => sortedByImpact(group.rules)[0]).filter(Boolean) as InspectionRisk[]
)

const impactRisks = computed(() => {
  const picks = impactPicks.value
  return [
    ...picks,
    ...sortedByImpact(IMPACT_GROUPS.flatMap((group) => group.rules)).filter(
      (risk) => !picks.includes(risk)
    )
  ].slice(0, 4)
})

const overloadedPeople = computed(
  () =>
    new Set(
      openRisks.value
        .filter((risk) => IMPACT_GROUPS[0].rules.includes(risk.ruleId))
        .flatMap((risk) => risk.personIds)
    )
)

/* 业务口径：对外只讲「哪几项任务有问题、压了多少人、要花多少时间」 */
const hoursText = (minutes: number, digits = 1) => {
  const hours = minutes / 60
  return (digits === 0 ? String(Math.round(hours)) : hours.toFixed(digits)).replace(/\.0$/, '')
}

const problemTaskIds = computed(() => new Set(openRisks.value.flatMap((risk) => risk.taskIds)))
const problemPeopleIds = computed(() => new Set(openRisks.value.flatMap((risk) => risk.personIds)))
const problemRegionIds = computed(() => new Set(openRisks.value.flatMap((risk) => risk.regionIds)))
const problemStoreIds = computed(
  () =>
    new Set(
      [...problemPeopleIds.value]
        .map((id) => props.state.people.find((person) => person.id === id)?.storeId)
        .filter(Boolean) as string[]
    )
)

const problemGroups = computed(() =>
  IMPACT_GROUPS.map((group) => ({
    label: group.label,
    count: new Set(
      openRisks.value
        .filter((risk) => group.rules.includes(risk.ruleId))
        .flatMap((risk) => risk.taskIds)
    ).size
  }))
)

const scopeRegionIds = computed(() =>
  props.actor.hq
    ? undefined
    : props.state.regions
        .filter((region) => canSeeRegion(props.actor, region.id))
        .map((region) => region.id)
)

const scopedPeople = computed(() =>
  regionAggregates(props.state, props.week, props.today, scopeRegionIds.value)
    .flatMap((region) => region.people)
    .filter((person) => person.unknownTaskCount === 0)
)

const scopedActivePeople = computed(() =>
  props.state.people.filter(
    (person) =>
      person.active && (!scopeRegionIds.value || scopeRegionIds.value.includes(person.regionId))
  )
)

const scopedTotalMinutes = computed(() =>
  scopedPeople.value.reduce((sum, person) => sum + person.plannedMinutes, 0)
)

const scopedMeanMinutes = computed(() =>
  scopedPeople.value.length ? Math.round(scopedTotalMinutes.value / scopedPeople.value.length) : 0
)

const peakPerson = computed(
  () => [...scopedPeople.value].sort((a, b) => b.dailyPeak - a.dailyPeak)[0]
)

const conflictRules = ['B3', 'D2', 'C3', 'A4']

const crowdedTasks = computed(
  () => openRisks.value.filter((risk) => conflictRules.includes(risk.ruleId)).length
)

const behindTasks = computed(() => openRisks.value.filter((risk) => risk.ruleId === 'E1'))
const behindPeople = computed(() => new Set(behindTasks.value.flatMap((risk) => risk.personIds)))

const duplicatedTaskIds = computed(
  () =>
    new Set(
      openRisks.value
        .filter((risk) => IMPACT_GROUPS[2].rules.includes(risk.ruleId))
        .flatMap((risk) => risk.taskIds)
    )
)

const taskTitleOf = (taskId: string) =>
  props.state.tasks.find((task) => task.id === taskId)?.title ?? taskId

const weekLabel = computed(
  () =>
    `${props.week.slice(5).replace('-', '/')} ~ ${addDays(props.week, 6).slice(5).replace('-', '/')}`
)

const meanText = computed(() => hoursText(scopedMeanMinutes.value))
const peakText = computed(() => hoursText(peakPerson.value?.dailyPeak ?? 0))
const totalHoursText = computed(() => hoursText(scopedTotalMinutes.value, 0))

/** 主要结论那一段（原型把相邻文本节点直接拼在一起，这里先拼好）。 */
const conclusionText = computed(() => {
  const parts = [
    `${latest.value?.taskCount ?? 0} ${t('项任务压在')} ${problemPeopleIds.value.size} ${t('名 BA 身上，人均约')} ${meanText.value} ${t('小时、最忙一天')} ${peakText.value} ${t('小时')}`
  ]
  if (overloadedPeople.value.size)
    parts.push(
      `；${t('其中')} ${overloadedPeople.value.size} ${t('人的任务已经叠加到超出可用容量')}`
    )
  if (duplicatedTaskIds.value.size)
    parts.push(
      `${t('，')}${duplicatedTaskIds.value.size} ${t('项任务把相同内容重复布置给同一批人')}`
    )
  return `${parts.join('')}${t('。')}`
})

const peakHint = computed(() =>
  peakPerson.value?.peakDay ? `${t('（')}${formatDay(peakPerson.value.peakDay)}${t('）')}` : ''
)

const crowdedHint = computed(() => {
  if (crowdedTasks.value && behindTasks.value.length)
    return `${t('同几天到期或内容重复 · 另有')} ${behindTasks.value.length} ${t('项进度落后')}（${behindPeople.value.size} ${t('人')}）`
  if (crowdedTasks.value) return t('集中在同几天到期，或被重复要求')
  if (behindTasks.value.length)
    return `${t('没有挤在一起的任务 · 但有')} ${behindTasks.value.length} ${t('项进度落后')}（${behindPeople.value.size} ${t('人')}）`
  return t('没有任务挤在同几天，也没有进度落后')
})

const timeHint = computed(() => {
  const extra = scopedActivePeople.value.length - scopedPeople.value.length
  return (
    t(
      '本周要花的时间 = 任务资源的预计时长 × 本周应完成次数，按「时长字段完整」的 BA 累加，是计划排期时长而非实际耗时；缺预计时长的人和任务不计入'
    ) +
    (extra ? `${t('（本期有')} ${extra} ${t('人因此未计入）')}` : '') +
    t('。受影响的 BA 按「任务命中问题」的人数统计，与排期口径不同。')
  )
})

const busyText = computed(() => {
  if (!scopedPeople.value.length) return ''
  return `${scopedPeople.value.length} ${t('名 BA 的排期合计 · 人均约')} ${meanText.value} ${t('小时 · 最忙一天约')} ${peakText.value} ${t('小时')}${peakHint.value}`
})

const problemGroupHint = computed(() =>
  problemGroups.value.map((group) => `${t(group.label)} ${group.count}`).join(' · ')
)

const triggerTone = computed(() =>
  latest.value?.trigger === 'manual'
    ? 'bg-primary/10 text-primary ring-primary/25'
    : 'bg-muted text-muted-foreground ring-border'
)
</script>

<template>
  <div class="grid gap-4">
    <!-- 原型在 showConsole 时会在这里再渲染一次 AuditConsole；页面实际未启用该分支 -->
    <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <BeautySectionHeading
        :title="t('最近一次审计')"
        :hint="`${t('周期')} ${weekLabel} · ${todayLabel(today)}`"
      >
        <template #extra>
          <div class="grid justify-items-end gap-1 text-[11px] text-muted-foreground">
            <span class="inline-flex flex-wrap items-center justify-end gap-1.5">
              <template v-if="latest">
                <BeautyChip :tone="triggerTone">
                  {{ latest.trigger === 'manual' ? t('手动审计') : t('自动审计') }}
                </BeautyChip>
                <span class="font-semibold text-foreground">{{ jakartaStamp(latest.at) }}</span>
                <span>
                  {{ latest.taskCount }} {{ t('项任务 · ') }}{{ latest.actorName }}
                  {{
                    latest.repeatCount > 1
                      ? ` · ${t('结论没变，已连续')} ${latest.repeatCount} ${t('次')}`
                      : ` · ${t('有变化，已记新批次')}`
                  }}
                </span>
              </template>
              <span v-else>{{ t('还没有审计记录') }}</span>
            </span>
            <span class="inline-flex flex-wrap items-center justify-end gap-1">
              <Icon icon="lucide:refresh-cw" :size="11" /> {{ t('每') }}
              {{ formatCadence(state.policy.autoRunMinutes)
              }}{{ t('自动审计一次，有变化才记新批次') }}
              <span class="text-muted-foreground/70">
                {{ t('（想改对 Agent 说「改成每 2 小时一次」）') }}
              </span>
            </span>
          </div>
        </template>
      </BeautySectionHeading>
      <div v-if="latest" class="mt-3 grid gap-2.5">
        <div
          class="rounded-lg bg-secondary/60 px-3 py-2.5 text-[12px] leading-relaxed ring-1 ring-primary/15"
        >
          <span class="font-semibold text-foreground">{{ t('主要结论：') }}</span
          >{{ conclusionText }}
        </div>
        <template v-if="impactRisks.length">
          <div
            v-for="risk in impactRisks"
            :key="risk.key"
            class="grid gap-1.5 rounded-lg bg-gradient-to-br from-secondary/80 to-card px-3 py-2.5 ring-1 ring-primary/15"
          >
            <div class="flex flex-wrap items-center gap-2">
              <BeautyChip :tone="groupOf(risk.ruleId)!.tone">
                {{ t(groupOf(risk.ruleId)!.label) }}
              </BeautyChip>
              <span class="text-[12px] font-medium text-foreground">{{ risk.title }}</span>
              <span class="text-[11px] text-muted-foreground">
                {{ t('影响') }} {{ risk.impact.affectedPeople }} {{ t('人') }} ·
                {{ regionSummary(state, risk.regionIds) }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {{ t('涉及任务：') }}
              <button
                v-for="taskId in [...new Set(risk.taskIds)].slice(0, 2)"
                :key="taskId"
                type="button"
                class="inspection-link"
                @click="emit('focus-task', taskId)"
              >
                {{ taskTitleOf(taskId) }}
              </button>
              <span v-if="[...new Set(risk.taskIds)].length > 2">
                {{ t('等') }} {{ [...new Set(risk.taskIds)].length }} {{ t('项') }}
              </span>
            </div>
            <div class="text-[11px] text-muted-foreground"
              >{{ t('建议：') }}{{ risk.suggestion }}</div
            >
          </div>
        </template>
        <div
          v-else
          class="rounded-lg bg-emerald-50/70 px-3 py-2 text-[11.5px] text-emerald-800 ring-1 ring-emerald-200"
        >
          {{ t('本周期没有发现任务叠加或重复布置，BA 的任务量在可承受范围内。') }}
        </div>
      </div>
      <BeautyEmptyState
        v-else
        :title="t('还没有审计记录')"
        :hint="t('点右上角「立即审计」开始。')"
      />
    </div>

    <div
      v-if="savedSchedules.length || savedRecords.length"
      class="grid gap-3 rounded-xl bg-card px-3.5 py-3 ring-1 ring-foreground/10"
    >
      <div v-if="savedRecords.length">
        <div class="flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <span class="font-semibold text-foreground">{{ t('已留痕的审计报告') }}</span>
          <span class="text-muted-foreground">{{ t('结论与追踪 ID 已保存') }}</span>
        </div>
        <div class="mt-2 grid gap-1.5">
          <div
            v-for="record in savedRecords"
            :key="record.id"
            class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"
          >
            <BeautyChip
              :tone="
                record.verdict === '阻断'
                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                  : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              "
            >
              {{ record.verdict }}
            </BeautyChip>
            <strong class="text-foreground">{{ record.reportTitle }}</strong>
            <span>
              {{ jakartaStamp(record.createdAt) }} · {{ record.findingCount }} {{ t('条结论 ·') }}
              {{ record.actorName }}
            </span>
          </div>
        </div>
      </div>
      <div
        v-if="savedSchedules.length"
        :class="savedRecords.length ? 'border-t border-solid border-border pt-3' : ''"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <span class="font-semibold text-foreground">{{ t('已保存的定时审计') }}</span>
          <span class="text-muted-foreground">{{ t('由 ADM 调度 · Asia/Jakarta') }}</span>
        </div>
        <div class="mt-2 grid gap-1.5">
          <div
            v-for="schedule in savedSchedules"
            :key="schedule.id"
            class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"
          >
            <BeautyChip tone="bg-primary/10 text-primary ring-primary/25">{{
              t('启用')
            }}</BeautyChip>
            <strong class="text-foreground">{{ t('每周一 09:00') }}</strong>
            <span>
              {{ schedule.scopeLabel }} · {{ schedule.focus }} · {{ t('规则') }}
              {{ schedule.ruleVersion }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <BeautyMetric
        :label="t('有问题的任务')"
        :value="problemTaskIds.size"
        :unit="t('项')"
        :hint="problemGroupHint"
        :tone="problemTaskIds.size ? 'text-rose-600' : ''"
      />
      <BeautyMetric
        :label="t('受影响的 BA')"
        :value="problemPeopleIds.size"
        :unit="t('人')"
        :hint="`${t('本周任务命中问题的 BA · 分布在')} ${problemRegionIds.size} ${t('个区域、')} ${problemStoreIds.size} ${t('家门店')}`"
      />
      <BeautyMetric :value="totalHoursText" :unit="t('小时')" :hint="busyText" tone="text-primary">
        <template #label>
          {{ t('本周要花的时间') }}
          <BeautyInfoTip>{{ timeHint }}</BeautyInfoTip>
        </template>
      </BeautyMetric>
      <BeautyMetric
        :label="t('任务挤在一起')"
        :value="crowdedTasks"
        :unit="t('项')"
        :hint="crowdedHint"
        :tone="crowdedTasks ? 'text-amber-600' : ''"
      />
    </div>

    <div class="grid gap-3 xl:grid-cols-2">
      <RunTimeline
        :state="state"
        :actor="actor"
        @focus-task="emit('focus-task', $event)"
        @open-task="emit('open-task', $event)"
      />
      <AgentPanel
        :state="state"
        :actor="actor"
        @focus-task="emit('focus-task', $event)"
        @created-requirement="emit('created-requirement', $event)"
      />
    </div>
  </div>
</template>
