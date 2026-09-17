<script setup lang="ts">
/**
 * 只读的任务详情弹窗（原型 `training-inspection/TaskDetailDialog.tsx`）。
 *
 * 「向创建者发送调整建议」只生成草稿 + 提示，不改任务数据（`buildAdjustmentSuggestion`）。
 */
import { computed, ref, watch } from 'vue'
import {
  FREQUENCY_LABELS,
  KIND_LABELS,
  RESOURCE_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  WEIGHT_LABELS,
  missingFields,
  taskAudienceIds,
  taskOccurrenceMinutes,
  taskPeriods
} from '@/beauty/lib/inspectionEngine'
import { buildAdjustmentSuggestion, type AdjustmentSuggestion } from '@/beauty/lib/adjustmentSuggestion'
import type { InspectionState, InspectionTask } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyField from './BeautyField.vue'
import BeautyKindBadge from './BeautyKindBadge.vue'
import { jakartaStamp } from './shared'

defineOptions({ name: 'BeautyTaskDetailDialog' })

const props = defineProps<{
  modelValue: boolean
  state: InspectionState
  task: InspectionTask | null
  week: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'open-source', taskId: string): void
}>()

const { t } = useBeautyI18n()

const dayLabel = (day: string) => day.slice(5).replace('-', '/')

type SendState = 'idle' | 'generating' | 'preview' | 'sent'

const sendState = ref<SendState>('idle')
const suggestion = ref<AdjustmentSuggestion | null>(null)
const sentAt = ref<string | null>(null)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

watch(
  () => [props.modelValue, props.task?.id] as const,
  () => {
    if (props.modelValue) return
    sendState.value = 'idle'
    suggestion.value = null
    sentAt.value = null
  },
  { immediate: true }
)

const generateSuggestion = () => {
  const current = props.task
  if (!current) return
  sendState.value = 'generating'
  window.setTimeout(() => {
    suggestion.value = buildAdjustmentSuggestion(props.state, current, props.week)
    sendState.value = 'preview'
  }, 650)
}

const periods = computed(() => (props.task ? taskPeriods(props.task, props.week) : []))
const audience = computed(() => (props.task ? (taskAudienceIds(props.state, props.task) ?? []) : []))
const occurrenceMinutes = computed(() =>
  props.task ? taskOccurrenceMinutes(props.task) : null
)
const gaps = computed(() => (props.task ? missingFields(props.task) : []))

const relationRows = computed(() => {
  const current = props.task
  if (!current) return []
  return [
    { label: t('同源内容'), ids: current.relations.sameSourceTaskIds },
    { label: t('前置任务'), ids: current.relations.prerequisiteTaskIds },
    { label: t('互斥任务'), ids: current.relations.exclusiveTaskIds },
    { label: t('重复任务'), ids: current.relations.duplicateTaskIds }
  ].filter((row) => row.ids.length)
})

const required = computed(() =>
  periods.value.reduce((sum, period) => sum + period.count, 0) * audience.value.length
)

const done = computed(() => {
  const current = props.task
  if (!current) return 0
  return periods.value.reduce(
    (sum, period) =>
      sum +
      audience.value.reduce(
        (inner, personId) =>
          inner + Math.min(period.count, current.results.completed[personId]?.[period.key] ?? 0),
        0
      ),
    0
  )
})

const completion = computed(() =>
  required.value ? Math.round((done.value / required.value) * 100) : null
)

const snapshotStale = computed(() =>
  props.task ? props.task.audience.snapshotVersion < props.task.version : false
)

const related = (ids: string[]) =>
  ids.map((id) => props.state.tasks.find((item) => item.id === id)?.title ?? id).join('、')

const ownerText = computed(() => {
  const current = props.task
  if (!current) return ''
  const owners = [
    current.owners.hqOwnerName ? `${t('总部')} ${current.owners.hqOwnerName}` : '',
    current.owners.regionOwnerName ? `${t('区域')} ${current.owners.regionOwnerName}` : '',
    current.owners.storeOwnerName ? `${t('门店')} ${current.owners.storeOwnerName}` : ''
  ].filter(Boolean)
  return owners.length ? owners.join(' · ') : t('未配置负责人')
})

const statusText = computed(() => {
  const status = props.task?.status
  if (status === 'active') return t('进行中')
  if (status === 'draft') return t('草稿')
  if (status === 'paused') return t('已暂停')
  return t('已停用')
})

const personNameOf = (personId: string) => {
  const person = props.state.people.find((item) => item.id === personId)
  if (!person) return personId
  const store = props.state.stores.find((item) => item.id === person.storeId)?.name
  return `${person.name}（${t(ROLE_LABELS[person.role])}${store ? ` · ${store}` : ''}）`
}

const onSend = () => {
  sentAt.value = new Date().toISOString()
  sendState.value = 'sent'
}

const onDiscard = () => {
  suggestion.value = null
  sendState.value = 'idle'
}
</script>

<template>
  <el-dialog v-if="task" v-model="visible" class="inspection-modal" width="880px" append-to-body>
    <template #header>
      <div class="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-foreground">
        <BeautyKindBadge :kind="task.kind" />
        <span>{{ task.title }}</span>
        <BeautyChip tone="bg-muted text-muted-foreground ring-border">v{{ task.version }}</BeautyChip>
        <BeautyChip v-if="task.weight" tone="bg-secondary text-secondary-foreground ring-primary/20">
          {{ t(WEIGHT_LABELS[task.weight]) }}
        </BeautyChip>
        <BeautyChip tone="bg-muted text-muted-foreground ring-border">{{ statusText }}</BeautyChip>
        <BeautyChip v-if="task.origin === 'source'" tone="bg-sky-50 text-sky-700 ring-sky-200">
          {{ t('外部接入') }}
        </BeautyChip>
      </div>
    </template>

    <div class="grid max-h-[68vh] gap-3 overflow-y-auto pr-1 text-[12px]">
      <div v-if="task.categories?.length" class="flex flex-wrap items-center gap-1.5">
        <span class="text-muted-foreground">{{ t('品类') }}</span>
        <BeautyChip
          v-for="category in task.categories"
          :key="category"
          tone="bg-indigo-50 text-indigo-700 ring-indigo-200"
        >
          {{ category }}
        </BeautyChip>
      </div>

      <div
        v-if="gaps.length"
        class="flex flex-wrap items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-2 text-violet-800 ring-1 ring-violet-200"
      >
        <span class="font-medium">{{ t('这条任务缺信息：') }}</span>
        <BeautyChip
          v-for="gap in gaps"
          :key="gap.field"
          tone="bg-white text-violet-700 ring-violet-200"
        >
          {{ gap.field }}
        </BeautyChip>
        <span>{{ t('缺字段的部分只标「数据不足」，不参与负荷判定。') }}</span>
      </div>

      <div class="grid gap-2 rounded-lg bg-muted/40 px-3 py-2.5 sm:grid-cols-2">
        <BeautyField :label="t('任务类型')">{{ t(KIND_LABELS[task.kind]) }}</BeautyField>
        <BeautyField :label="t('负责人')">{{ ownerText }}</BeautyField>
        <BeautyField :label="t('开始 / 截止')">
          {{ task.startsOn || t('未设置') }} → {{ task.endsOn || t('未设置') }}
        </BeautyField>
        <BeautyField :label="t('频次')">
          {{ task.frequency ? `${t(FREQUENCY_LABELS[task.frequency.unit])} ${task.frequency.count} ${t('次')}` : t('未配置') }}
        </BeautyField>
        <BeautyField :label="t('单次时长')">
          {{
            occurrenceMinutes === null
              ? t('缺预计时长')
              : `${occurrenceMinutes} ${t('分钟')}${task.additionalMinutes ? `（${t('含附加')} ${task.additionalMinutes} ${t('分钟')}）` : ''}`
          }}
        </BeautyField>
        <BeautyField :label="t('创建 / 发布')">
          {{ task.createdAt ? jakartaStamp(task.createdAt) : '—' }} /
          {{ task.publishedAt ? jakartaStamp(task.publishedAt) : t('未发布') }}
        </BeautyField>
        <BeautyField :label="t('下发范围')">
          {{ t(SCOPE_LABELS[task.audience.scope]) }} · {{ task.audience.label }}
        </BeautyField>
        <BeautyField :label="t('命中人数')">
          {{ audience.length }} {{ t('人') }}{{ task.audience.expectedCount !== null ? `（${t('预期')} ${task.audience.expectedCount} ${t('人')}）` : '' }}
        </BeautyField>
      </div>

      <section class="grid gap-1.5">
        <div class="text-[11.5px] font-semibold text-foreground">{{ t('本周排期') }}</div>
        <div v-if="periods.length" class="flex flex-wrap gap-1.5">
          <BeautyChip
            v-for="period in periods"
            :key="`${period.key}-${period.day}`"
            tone="bg-muted text-muted-foreground ring-border"
          >
            {{ dayLabel(period.day) }} · {{ period.count }} {{ t('次') }} ·
            {{
              occurrenceMinutes === null
                ? t('缺时长')
                : `${occurrenceMinutes * period.count} ${t('分钟')}`
            }}
          </BeautyChip>
        </div>
        <span v-else class="text-muted-foreground">{{ t('这一周没有排期。') }}</span>
      </section>

      <section class="grid gap-1.5">
        <div class="text-[11.5px] font-semibold text-foreground">{{ t('内容资源') }}</div>
        <div v-if="task.resources.length" class="grid gap-1">
          <div
            v-for="resource in task.resources"
            :key="resource.id"
            class="flex flex-wrap items-center gap-1.5"
          >
            <BeautyChip tone="bg-muted text-muted-foreground ring-border">
              {{ t(RESOURCE_LABELS[resource.type]) }}
            </BeautyChip>
            <span>{{ resource.name }}</span>
            <span class="text-muted-foreground">
              {{ resource.minutes === null ? t('缺预计时长') : `${resource.minutes} ${t('分钟')}` }}
            </span>
          </div>
        </div>
        <span v-else class="text-muted-foreground">{{ t('没有关联内容资源。') }}</span>
      </section>

      <section class="grid gap-1.5">
        <div class="text-[11.5px] font-semibold text-foreground">{{ t('关联任务') }}</div>
        <div v-if="relationRows.length" class="grid gap-1">
          <div v-for="row in relationRows" :key="row.label" class="flex flex-wrap items-center gap-1.5">
            <BeautyChip tone="bg-muted text-muted-foreground ring-border">{{ row.label }}</BeautyChip>
            <span>{{ related(row.ids) }}</span>
          </div>
          <span v-if="!task.relations.sequenceDefined" class="text-muted-foreground">
            {{ t('没有声明完成顺序。') }}
          </span>
          <span v-else class="text-muted-foreground">{{ t('已声明完成顺序。') }}</span>
        </div>
        <span v-else class="text-muted-foreground">{{ t('没有关联任务。') }}</span>
      </section>

      <section class="grid gap-1.5">
        <div class="text-[11.5px] font-semibold text-foreground">{{ t('执行情况') }}</div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <span>
            {{ t('本周应完成') }} {{ required }} {{ t('次') }} · {{ t('已完成') }} {{ done }}
            {{ t('次') }}{{ completion !== null ? `（${completion}%）` : '' }}
          </span>
          <span>
            {{ t('完成回传：') }}{{ task.results.returnedAt ? jakartaStamp(task.results.returnedAt) : t('没有回传') }}
          </span>
          <span>
            {{ t('推送记录：') }}{{ task.results.pushedAt ? jakartaStamp(task.results.pushedAt) : t('没有推送') }}
          </span>
          <span v-if="task.kind === 'exam'">
            {{ t('成绩：') }}{{ Object.keys(task.results.scores).length ? `${Object.keys(task.results.scores).length} ${t('人有成绩')}` : t('暂无成绩') }}
          </span>
        </div>
      </section>

      <section class="grid gap-1.5">
        <div class="text-[11.5px] font-semibold text-foreground">{{ t('人员名单') }}</div>
        <span v-if="audience.length" class="text-muted-foreground">
          {{ audience.slice(0, 8).map((id) => personNameOf(id)).join('、') }}
          {{ audience.length > 8 ? `${t('等')} ${audience.length} ${t('人')}` : '' }}
          {{
            snapshotStale
              ? ` · ${t('名单是')} v${task.audience.snapshotVersion} ${t('生成的，任务已经是')} v${task.version}`
              : ''
          }}
        </span>
        <span v-else class="text-muted-foreground">{{ t('没有逐人分配，只按人群策略下发。') }}</span>
      </section>

      <section
        v-if="sendState === 'generating'"
        class="grid gap-1.5 rounded-lg bg-secondary/60 px-3 py-2.5 ring-1 ring-primary/15"
      >
        <span class="flex items-center gap-1.5 font-medium text-foreground">
          <Icon icon="lucide:loader-2" :size="13" class="animate-spin" />
          {{ t('Agent 正在根据审计结论生成调整建议…') }}
        </span>
        <span class="text-[11px] text-muted-foreground">
          {{ t('会带上这项任务当前的问题、建议动作和影响范围。') }}
        </span>
      </section>

      <section
        v-if="sendState === 'preview' && suggestion"
        class="grid gap-2 rounded-lg bg-secondary/60 px-3 py-2.5 ring-1 ring-primary/15"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground">
            <Icon icon="lucide:sparkles" :size="13" />
            {{ t('站内信草稿（点发送后走「消息中心 › 我的消息」）') }}
          </span>
          <BeautyChip tone="bg-white text-secondary-foreground ring-primary/20">
            {{ t('收件人') }} {{ suggestion.recipient.name }}（{{ suggestion.recipient.roleLabel }}）
          </BeautyChip>
        </div>
        <span class="text-[12px] font-medium text-foreground">{{ suggestion.title }}</span>
        <span class="text-[11.5px] text-muted-foreground">{{ suggestion.intro }}</span>
        <ul class="grid gap-1 text-[11.5px]">
          <li v-for="line in suggestion.problems" :key="line" class="flex gap-1.5">
            <span class="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400"></span>
            <span>{{ line }}</span>
          </li>
        </ul>
        <span class="text-[11.5px] font-medium text-foreground">{{ t('建议动作') }}</span>
        <ul class="grid gap-1 text-[11.5px]">
          <li v-for="line in suggestion.actions" :key="line" class="flex gap-1.5">
            <span class="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60"></span>
            <span>{{ line }}</span>
          </li>
        </ul>
        <span class="text-[11px] text-muted-foreground">
          {{ suggestion.impact }} · {{ suggestion.note }}
        </span>
        <span class="flex flex-wrap items-center gap-1.5 pt-0.5">
          <el-button size="small" @click="onSend">
            <Icon icon="lucide:send" :size="13" /> {{ t('发送站内信') }}
          </el-button>
          <el-button size="small" plain @click="onDiscard">{{ t('先不发') }}</el-button>
        </span>
      </section>

      <section
        v-if="sendState === 'sent' && suggestion && sentAt"
        class="grid gap-1.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-emerald-900 ring-1 ring-emerald-200"
      >
        <span class="flex items-center gap-1.5 text-[12px] font-semibold">
          <Icon icon="lucide:mail" :size="13" /> {{ t('已发送站内信给') }} {{ suggestion.recipient.name }}（{{
            suggestion.recipient.roleLabel
          }}）· {{ jakartaStamp(sentAt) }}
        </span>
        <span class="text-[11.5px]">
          「{{ suggestion.title }}」{{ t('已进入「消息中心 › 我的消息」（原型演示，不真的发送）。') }}
        </span>
        <span class="flex items-center gap-1.5 pt-0.5">
          <el-button size="small" plain @click="sendState = 'idle'">{{ t('知道了') }}</el-button>
        </span>
      </section>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-solid border-border pt-2.5">
        <span class="text-[11px] text-muted-foreground">
          {{ task.origin === 'source' ? `${t('来源：')}${task.sourceId}` : t('来源：演示任务') }}
        </span>
        <span class="flex items-center gap-1.5">
          <el-button
            v-if="task.origin === 'source'"
            size="small"
            plain
            @click="emit('open-source', task.id)"
          >
            <Icon icon="lucide:external-link" :size="13" /> {{ t('打开原任务') }}
          </el-button>
          <el-button v-if="sendState === 'idle'" size="small" @click="generateSuggestion">
            <Icon icon="lucide:send" :size="13" /> {{ t('向创建者发送调整建议') }}
          </el-button>
        </span>
      </div>
    </div>
  </el-dialog>
</template>
