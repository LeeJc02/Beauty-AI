<script setup lang="ts">
/**
 * 单条审计批次（原型 `RunTimeline.tsx` 里的 `RunRow`）。
 */
import { computed, ref } from 'vue'
import { LEVEL_LABELS } from '@/beauty/lib/inspectionEngine'
import type {
  InspectionActor,
  InspectionRunRecord,
  InspectionRunTaskResult,
  InspectionState,
  InspectionTask,
  RiskLevel
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyKindBadge from './BeautyKindBadge.vue'
import BeautyLevelBadge from './BeautyLevelBadge.vue'

defineOptions({ name: 'BeautyRunRow' })

const props = defineProps<{
  record: InspectionRunRecord
  state: InspectionState
  actor: InspectionActor
}>()

const emit = defineEmits<{
  (e: 'focus-task', taskId: string): void
  (e: 'open-task', taskId: string): void
}>()

const { t } = useBeautyI18n()

const LEVEL_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, insufficient: 3 }

const stamp = (iso: string) => iso.slice(5, 16).replace('T', ' ')

const open = ref(false)
const dialogOpen = ref(false)

const taskTitle = (taskId: string) =>
  props.state.tasks.find((task) => task.id === taskId)?.title ?? taskId

/** 当前账号能看到的任务：停用 / 已合并的不再出现，区域账号只看本区域 */
const results = computed(() =>
  props.record.taskResults.filter((result) => {
    const task = props.state.tasks.find((item) => item.id === result.taskId)
    if (!task || task.status === 'disabled' || task.mergedIntoId) return false
    if (props.actor.hq) return true
    const regionId = props.actor.regionId ?? ''
    return task.audience.regionIds.length ? task.audience.regionIds.includes(regionId) : true
  })
)

const byName = (a: InspectionRunTaskResult, b: InspectionRunTaskResult) =>
  taskTitle(a.taskId).localeCompare(taskTitle(b.taskId), 'zh')

/** 真正的异常：命中风险规则（高 / 中 / 低）。「数据不足」只代表字段缺失、无法判定，单独归类。 */
const anomalies = computed(() =>
  results.value
    .filter((result) => result.level && result.level !== 'insufficient')
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.level as RiskLevel] - LEVEL_ORDER[b.level as RiskLevel] || byName(a, b)
    )
)

const unknown = computed(() =>
  results.value.filter((result) => result.level === 'insufficient').sort(byName)
)

interface AnomalyItem {
  result: InspectionRunTaskResult
  task: InspectionTask
  people: number
}

interface UnknownItem {
  result: InspectionRunTaskResult
  task: InspectionTask
}

const ruleNames = computed(() => {
  const map = new Map<string, string>()
  for (const risk of props.state.risks) map.set(risk.ruleId, risk.ruleName)
  for (const change of [...props.record.added, ...props.record.resolved])
    map.set(change.ruleId, change.ruleName)
  return map
})

const affectedPeople = (result: InspectionRunTaskResult) => {
  const ids = new Set<string>()
  for (const risk of props.state.risks)
    if (result.ruleIds.includes(risk.ruleId) && risk.taskIds.includes(result.taskId))
      risk.personIds.forEach((id) => ids.add(id))
  return ids.size
}

/** 弹窗里的异常任务：顺手把任务对象与影响人数解析好，模板里不用再做非空断言。 */
const anomalyRows = computed<AnomalyItem[]>(() =>
  anomalies.value.flatMap((result) => {
    const task = props.state.tasks.find((item) => item.id === result.taskId)
    if (!task) return []
    return [{ result, task, people: affectedPeople(result) }]
  })
)

const unknownRows = computed<UnknownItem[]>(() =>
  unknown.value.flatMap((result) => {
    const task = props.state.tasks.find((item) => item.id === result.taskId)
    if (!task) return []
    return [{ result, task }]
  })
)

const changes = computed(() => [
  ...props.record.added.map((change) => ({
    key: `+${change.key}`,
    tone: 'bg-rose-50 text-rose-700 ring-rose-200',
    text: `${t('新增异常')} ${change.ruleName} · ${change.title}`
  })),
  ...props.record.resolved.map((change) => ({
    key: `-${change.key}`,
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    text: `${t('异常解除')} ${change.ruleName} · ${change.title}`
  })),
  ...props.record.levelChanged.map((change) => ({
    key: `~${change.key}-${change.to}`,
    tone: 'bg-amber-50 text-amber-700 ring-amber-200',
    text: `${t('等级变化：')}${t(LEVEL_LABELS[change.from])} → ${t(LEVEL_LABELS[change.to])} · ${change.title}`
  }))
])

const preview = computed(() =>
  anomalies.value.slice(0, 3).map((result) => taskTitle(result.taskId))
)

const anomalySummary = computed(() =>
  anomalies.value.length
    ? `${t('异常任务：')}${preview.value.join('、')}${
        anomalies.value.length > preview.value.length
          ? ` ${t('等')} ${anomalies.value.length} ${t('项')}`
          : ''
      }`
    : t('本次审计未发现异常任务。')
)

const periodText = computed(() => {
  const weeks = props.record.weeks
  return weeks.length > 1
    ? `${t('本周')} ${weeks[0].slice(5)} · ${t('下周')} ${weeks[1].slice(5)}`
    : (weeks[0]?.slice(5) ?? '')
})

const focusFromDialog = (taskId: string) => {
  dialogOpen.value = false
  emit('focus-task', taskId)
}

const openFromDialog = (taskId: string) => {
  dialogOpen.value = false
  emit('open-task', taskId)
}
</script>

<template>
  <div class="rounded-xl bg-background ring-1 ring-foreground/10">
    <div class="flex items-start gap-2.5 px-3 py-2.5">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        @click="open = !open"
      >
        <span class="mt-0.5 text-muted-foreground">
          <Icon :icon="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" :size="15" />
        </span>
        <span class="grid flex-1 gap-1.5">
          <span class="flex flex-wrap items-center gap-1.5">
            <span class="text-[12.5px] font-semibold text-foreground">{{ stamp(record.at) }}</span>
            <BeautyChip
              :tone="
                record.trigger === 'manual'
                  ? 'bg-primary/10 text-primary ring-primary/25'
                  : 'bg-muted text-muted-foreground ring-border'
              "
            >
              {{ record.trigger === 'manual' ? t('手动审计') : t('自动审计') }}
            </BeautyChip>
            <BeautyChip tone="bg-muted text-muted-foreground ring-border">
              {{ t('覆盖') }} {{ results.length }} {{ t('项任务') }}
            </BeautyChip>
            <BeautyChip
              v-if="anomalies.length"
              tone="bg-rose-50 text-rose-700 ring-rose-200"
              class="font-semibold"
            >
              <Icon icon="lucide:alert-triangle" :size="11" /> {{ anomalies.length }}
              {{ t('项任务异常') }}
            </BeautyChip>
            <BeautyChip
              v-else
              tone="bg-emerald-50 text-emerald-700 ring-emerald-200"
              class="font-semibold"
            >
              <Icon icon="lucide:shield-check" :size="11" /> {{ t('本次无异常') }}
            </BeautyChip>
            <BeautyChip
              v-if="record.repeatCount > 1"
              tone="bg-muted text-muted-foreground ring-border"
            >
              {{ t('结论没变 · 连续') }} {{ record.repeatCount }} {{ t('次') }}
            </BeautyChip>
            <span v-if="changes.length" class="text-[10.5px] text-muted-foreground">
              {{ t('较上次') }} {{ changes.length }} {{ t('处变化') }}
            </span>
          </span>
          <span class="text-[11px] text-muted-foreground">{{ anomalySummary }}</span>
        </span>
      </button>
      <el-button
        v-if="anomalies.length"
        size="small"
        plain
        class="shrink-0"
        @click="dialogOpen = true"
      >
        <Icon icon="lucide:alert-triangle" :size="13" /> {{ t('查看异常任务') }}
      </el-button>
    </div>

    <div
      v-if="open"
      class="grid gap-3 border-t border-solid border-border/70 px-3.5 py-3 text-[11.5px]"
    >
      <div class="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        <span class="inline-flex items-center gap-1">
          <Icon icon="lucide:user-check" :size="12" /> {{ record.actorName }}（{{
            t(record.roleLabel)
          }}）
        </span>
        <span class="inline-flex items-center gap-1">
          <Icon icon="lucide:refresh-cw" :size="12" /> {{ t('最近') }}
          {{ stamp(record.lastSeenAt) }} · {{ t('共') }} {{ record.repeatCount }} {{ t('次') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <Icon icon="lucide:clipboard-list" :size="12" /> {{ t('周期：') }}{{ periodText }}
        </span>
      </div>

      <div v-if="changes.length" class="grid gap-1.5">
        <div class="text-[11.5px] font-semibold text-foreground">{{ t('较上次的变化') }}</div>
        <div
          v-for="change in changes"
          :key="change.key"
          class="flex flex-wrap items-center gap-1.5"
        >
          <BeautyChip :tone="change.tone">{{ change.text }}</BeautyChip>
        </div>
      </div>
      <div v-else class="text-[11px] text-muted-foreground">
        {{ t('较上次没有新增、解除或等级变化。') }}
      </div>
    </div>

    <el-dialog v-model="dialogOpen" class="inspection-modal" width="672px" append-to-body>
      <template #header>
        <div>
          <div class="text-[15px] font-semibold text-foreground">
            {{ t('异常任务') }}（{{ anomalies.length }} {{ t('项') }}）
          </div>
          <p class="mt-1 text-[11.5px] text-muted-foreground">
            {{ t('批次') }} {{ stamp(record.at) }} · {{ t('覆盖') }} {{ results.length }}
            {{ t('项任务') }} · {{ t('点任务名进入任务体检') }}
          </p>
        </div>
      </template>
      <div class="grid max-h-[420px] gap-2 overflow-y-auto pr-0.5">
        <div
          v-for="row in anomalyRows"
          :key="row.result.taskId"
          class="grid gap-1.5 rounded-lg bg-muted/40 px-3 py-2.5"
        >
          <div class="flex flex-wrap items-center gap-1.5">
            <BeautyKindBadge :kind="row.task.kind" />
            <span class="text-[12.5px] font-medium text-foreground">{{ row.task.title }}</span>
            <BeautyLevelBadge v-if="row.result.level" :level="row.result.level" />
            <span v-if="row.people" class="text-[11px] text-muted-foreground">
              {{ t('影响') }} {{ row.people }} {{ t('人') }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {{ t('命中规则：') }}
            <template v-if="row.result.ruleIds.length">
              <BeautyChip
                v-for="ruleId in row.result.ruleIds"
                :key="ruleId"
                tone="bg-background text-muted-foreground ring-border"
              >
                <span class="font-mono font-semibold">{{ ruleId }}</span>
                {{ ruleNames.get(ruleId) ?? '' }}
              </BeautyChip>
            </template>
            <span v-else>{{ t('规则已不再命中') }}</span>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" class="inspection-link" @click="focusFromDialog(row.task.id)">
              {{ t('任务体检') }}
            </button>
            <button
              v-if="row.task.origin === 'source'"
              type="button"
              class="inspection-link"
              @click="openFromDialog(row.task.id)"
            >
              {{ t('原任务') }}
            </button>
          </div>
        </div>

        <div v-if="unknownRows.length" class="grid gap-1.5 rounded-lg bg-muted/30 px-3 py-2.5">
          <div class="text-[11.5px] font-semibold text-muted-foreground">
            {{ t('数据不足，本次无法判定') }}（{{ unknownRows.length }} {{ t('项') }}）
          </div>
          <div
            v-for="row in unknownRows"
            :key="row.result.taskId"
            class="flex flex-wrap items-center gap-1.5 text-[11.5px]"
          >
            <BeautyKindBadge :kind="row.task.kind" />
            <span class="text-muted-foreground">{{ row.task.title }}</span>
            <button type="button" class="inspection-link" @click="focusFromDialog(row.task.id)">
              {{ t('任务体检') }}
            </button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>
