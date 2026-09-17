<script setup lang="ts">
/**
 * 任务覆盖清单（原型 `training-inspection/TaskCoverageList.tsx`）。
 *
 * 每个任务一行，说明最近审计时间、结论、命中规则与影响范围；展开后逐条列风险卡。
 * 原型里没有页面接进来（旧版「审计工作台」的组成部分），这里照原样移植。
 */
import { computed, ref } from 'vue'
import { KIND_LABELS, LEVEL_LABELS, canSeeTask, missingFields } from '@/beauty/lib/inspectionEngine'
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  RiskLevel
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyEmptyState from './BeautyEmptyState.vue'
import BeautyKindBadge from './BeautyKindBadge.vue'
import BeautyLevelBadge from './BeautyLevelBadge.vue'
import BeautySectionHeading from './BeautySectionHeading.vue'
import BeautyWeightBadge from './BeautyWeightBadge.vue'
import RiskCard from './RiskCard.vue'
import { FIELD_CLASS, riskStatusOf } from './shared'

defineOptions({ name: 'BeautyTaskCoverageList' })

const props = defineProps<{
  state: InspectionState
  actor: InspectionActor
  risks: InspectionRisk[]
}>()

const emit = defineEmits<{
  (e: 'simulate', risk: InspectionRisk): void
  (e: 'dispose', risk: InspectionRisk): void
  (e: 'open-task', taskId: string): void
  (e: 'focus-task', taskId: string): void
}>()

const { t } = useBeautyI18n()

const levelRank: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, insufficient: 3 }

type Conclusion = RiskLevel | 'pass'

const search = ref('')
const kind = ref<string>('all')
const conclusion = ref<Conclusion | 'all'>('all')
const region = ref('all')
const hitOnly = ref(false)
const openTaskId = ref<string | null>(null)

const latest = computed(() => props.state.inspectionRuns.at(-1))

const lastSeenOf = (taskId: string) => {
  if (!latest.value) return null
  return latest.value.taskResults.some((result) => result.taskId === taskId)
    ? latest.value.lastSeenAt
    : null
}

const rows = computed(() =>
  props.state.tasks
    .filter((task) => task.status !== 'disabled' && !task.mergedIntoId)
    .filter((task) => canSeeTask(props.actor, task))
    .map((task) => {
      const taskRisks = props.risks
        .filter((risk) => risk.taskIds.includes(task.id))
        .sort((a, b) => levelRank[a.level] - levelRank[b.level])
      const worst = taskRisks[0]
      const regionIds = task.audience.regionIds.length
        ? task.audience.regionIds
        : props.state.regions.map((item) => item.id)
      return {
        task,
        taskRisks,
        worst,
        state: worst ? (worst.level as Conclusion) : ('pass' as Conclusion),
        regionIds,
        lastSeen: lastSeenOf(task.id),
        people: new Set(taskRisks.flatMap((risk) => risk.personIds))
      }
    })
    .filter((row) => (hitOnly.value ? row.taskRisks.length > 0 : true))
    .filter((row) => kind.value === 'all' || row.task.kind === kind.value)
    .filter((row) => conclusion.value === 'all' || row.state === conclusion.value)
    .filter((row) => region.value === 'all' || row.regionIds.includes(region.value))
    .filter((row) => {
      if (!search.value) return true
      const haystack = [
        row.task.title,
        row.task.audience.label,
        row.task.owners.hqOwnerName,
        row.task.owners.regionOwnerName,
        ...row.taskRisks.map((risk) => `${risk.ruleId} ${risk.ruleName} ${risk.reason}`)
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(search.value.toLowerCase())
    })
    .sort((a, b) => {
      const aRank = a.worst ? levelRank[a.worst.level] : 9
      const bRank = b.worst ? levelRank[b.worst.level] : 9
      return aRank - bRank || a.task.title.localeCompare(b.task.title)
    })
)

const counts = computed(() => {
  const all = props.state.tasks.filter(
    (task) => task.status !== 'disabled' && !task.mergedIntoId && canSeeTask(props.actor, task)
  )
  const hit = all.filter((task) => props.risks.some((risk) => risk.taskIds.includes(task.id)))
  const gaps = all.filter((task) => missingFields(task).length > 0)
  return { all: all.length, hit: hit.length, gaps: gaps.length }
})

const visibleRegions = computed(() =>
  props.state.regions.filter((item) => props.actor.hq || item.id === props.actor.regionId)
)

const regionNameOf = (id: string) =>
  props.state.regions.find((item) => item.id === id)?.name ?? id
</script>

<template>
  <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
    <BeautySectionHeading
      :title="t('审计过的任务')"
      :hint="`${counts.all} ${t('项任务')} · ${counts.gaps} ${t('项待补字段')}`"
    >
      <template #extra>
        <label class="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <input v-model="hitOnly" type="checkbox" />
          {{ t('只看有问题的') }}
        </label>
      </template>
    </BeautySectionHeading>
    <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
      <div class="relative">
        <Icon
          icon="lucide:search"
          :size="13"
          class="absolute top-2.5 left-2 text-muted-foreground"
        />
        <input v-model="search" :class="[FIELD_CLASS, 'w-48 pl-6']" :placeholder="t('搜索任务或规则')" />
      </div>
      <select v-model="kind" :class="[FIELD_CLASS, 'w-24']">
        <option value="all">{{ t('全部类型') }}</option>
        <option v-for="(label, key) in KIND_LABELS" :key="key" :value="key">
          {{ t(label) }}
        </option>
      </select>
      <select v-model="conclusion" :class="[FIELD_CLASS, 'w-28']">
        <option value="all">{{ t('全部结论') }}</option>
        <option v-for="(label, key) in LEVEL_LABELS" :key="key" :value="key">
          {{ t(label) }}
        </option>
        <option value="pass">{{ t('未命中规则') }}</option>
      </select>
      <select v-if="actor.hq" v-model="region" :class="[FIELD_CLASS, 'w-32']">
        <option value="all">{{ t('全部区域') }}</option>
        <option v-for="item in visibleRegions" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
      </select>
      <BeautyChip v-else tone="bg-muted text-muted-foreground ring-border">
        {{ t(actor.roleLabel) }}
      </BeautyChip>
      <span class="text-[11px] text-muted-foreground">
        {{ t('高') }} {{ risks.filter((risk) => risk.level === 'high').length }} · {{ t('中') }}
        {{ risks.filter((risk) => risk.level === 'medium').length }} · {{ t('低') }}
        {{ risks.filter((risk) => risk.level === 'low').length }} · {{ t('数据不足') }}
        {{ risks.filter((risk) => risk.level === 'insufficient').length }}
      </span>
    </div>

    <div class="mt-2.5 grid gap-1.5">
      <template v-if="rows.length">
        <div
          v-for="row in rows"
          :key="row.task.id"
          class="rounded-xl bg-background ring-1 ring-foreground/10"
        >
          <button
            type="button"
            class="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
            @click="openTaskId = openTaskId === row.task.id ? null : row.task.id"
          >
            <span class="mt-0.5 text-muted-foreground">
              <Icon
                :icon="openTaskId === row.task.id ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                :size="15"
              />
            </span>
            <span class="grid flex-1 gap-1">
              <span class="flex flex-wrap items-center gap-1.5">
                <BeautyKindBadge :kind="row.task.kind" />
                <BeautyWeightBadge :weight="row.task.weight" />
                <span class="text-[12.5px] font-semibold text-foreground">{{ row.task.title }}</span>
                <BeautyLevelBadge v-if="row.worst" :level="row.worst.level" />
                <BeautyChip
                  v-else-if="missingFields(row.task).length"
                  tone="bg-violet-50 text-violet-700 ring-violet-200"
                >
                  {{ t('数据不足') }}
                </BeautyChip>
                <BeautyChip v-else tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  {{ t('没问题') }}
                </BeautyChip>
                <BeautyChip tone="bg-muted text-muted-foreground ring-border">
                  v{{ row.task.version }}
                </BeautyChip>
              </span>
              <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-muted-foreground">
                <span>
                  {{ t('审计') }}
                  {{ row.lastSeen ? row.lastSeen.slice(5, 16).replace('T', ' ') : '—' }}
                </span>
                <span>
                  {{ row.task.owners.regionOwnerName || row.task.owners.hqOwnerName || t('未配置') }}
                </span>
                <span>
                  {{ row.people.size }} {{ t('人') }} ·
                  {{
                    row.regionIds.map((id) => regionNameOf(id)).join('、') || t('全局')
                  }}
                </span>
                <span v-if="missingFields(row.task).length">
                  {{ t('缺少') }}{{ missingFields(row.task).map((gap) => gap.field).join('、') }}
                </span>
              </span>
              <span v-if="row.worst" class="flex flex-wrap items-center gap-1">
                <BeautyChip
                  v-for="ruleId in [...new Set(row.taskRisks.map((risk) => risk.ruleId))]"
                  :key="ruleId"
                  tone="bg-muted text-muted-foreground ring-border"
                >
                  {{ ruleId }}
                </BeautyChip>
                <span class="text-[10.5px] text-muted-foreground">
                  {{ row.worst.conclusion }} · {{ row.worst.ruleName }}
                </span>
              </span>
            </span>
          </button>
          <div
            v-if="openTaskId === row.task.id"
            class="grid gap-2 border-t border-solid border-border/70 px-3.5 py-3"
          >
            <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Icon icon="lucide:clipboard-check" :size="12" />
              <button type="button" class="inspection-link" @click="emit('focus-task', row.task.id)">
                {{ t('任务体检') }}
              </button>
              <button
                v-if="row.task.origin === 'source'"
                type="button"
                class="inspection-link"
                @click="emit('open-task', row.task.id)"
              >
                {{ t('原任务') }}
              </button>
            </div>
            <template v-if="row.taskRisks.length">
              <RiskCard
                v-for="risk in row.taskRisks"
                :key="risk.key"
                :state="state"
                :actor="actor"
                :risk="risk"
                :status="riskStatusOf(state, risk)"
                @simulate="emit('simulate', $event)"
                @dispose="emit('dispose', $event)"
                @open-task="emit('open-task', $event)"
              />
            </template>
            <div
              v-else
              class="rounded-lg bg-emerald-50/70 px-3 py-2 text-[11.5px] text-emerald-800 ring-1 ring-emerald-200"
            >
              {{ t('这项没发现问题') }}
              {{
                missingFields(row.task).length
                  ? `；${t('缺')}${missingFields(row.task)
                      .map((gap) => gap.field)
                      .join('、')}，${t('补齐后再看。')}`
                  : t('。')
              }}
            </div>
          </div>
        </div>
      </template>
      <BeautyEmptyState v-else :title="t('没有符合条件的任务')" :hint="t('换个筛选条件试试。')" />
    </div>
  </div>
</template>
