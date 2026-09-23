<script setup lang="ts">
/**
 * 发布前模拟的编辑器（原型 `training-inspection/SimulatePanel.tsx` 的 `TaskPatchEditor`）。
 *
 * 只改 patch（草稿），不改任务本身；点「提交处置」后才由 `applyDisposition` 写入。
 */
import { computed } from 'vue'
import {
  FREQUENCY_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  WEIGHT_LABELS,
  taskOccurrenceMinutes
} from '@/beauty/lib/inspectionEngine'
import type {
  AudienceScope,
  FrequencyUnit,
  InspectionActor,
  InspectionState,
  InspectionTask,
  PersonRole,
  TaskPatch,
  TaskStatus,
  TaskWeight
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import { FIELD_CLASS, FIELD_LABEL_CLASS, resolveAudience } from './shared'

defineOptions({ name: 'BeautyTaskPatchEditor' })

const props = defineProps<{
  state: InspectionState
  task: InspectionTask
  patch: TaskPatch
  actor: InspectionActor
}>()

const emit = defineEmits<{ (e: 'update:patch', patch: TaskPatch): void }>()

const { t } = useBeautyI18n()

const allRoles: PersonRole[] = ['ba', 'new_ba', 'store_manager', 'trainer', 'regional_manager']
const scopeOptions = Object.keys(SCOPE_LABELS) as AudienceScope[]
const frequencyOptions = Object.keys(FREQUENCY_LABELS) as FrequencyUnit[]
const weightOptions = Object.keys(WEIGHT_LABELS) as TaskWeight[]

const scope = computed(() => props.patch.audience?.scope ?? props.task.audience.scope)
const regionIds = computed(() => props.patch.audience?.regionIds ?? props.task.audience.regionIds)
const roles = computed(() =>
  props.patch.audience?.roles === undefined ? props.task.audience.roles : props.patch.audience.roles
)
const expectedCount = computed(() =>
  props.patch.audience?.expectedCount === undefined
    ? props.task.audience.expectedCount
    : props.patch.audience.expectedCount
)
const resolvedCount = computed(
  () =>
    (props.patch.audience?.resolvedPersonIds ?? props.task.audience.resolvedPersonIds ?? []).length
)
const frequency = computed(() => props.patch.frequency ?? props.task.frequency)
const frequencyChanged = computed(() => props.patch.frequency !== undefined)
const visibleRegions = computed(() =>
  props.state.regions.filter((region) => props.actor.hq || region.id === props.actor.regionId)
)

const updateAudience = (next: Partial<NonNullable<TaskPatch['audience']>>) =>
  emit('update:patch', { ...props.patch, audience: { ...props.patch.audience, ...next } })

const onScope = (item: AudienceScope) => updateAudience({ scope: item })

const onRegion = (regionId: string) => {
  const next = regionIds.value.includes(regionId)
    ? regionIds.value.filter((id) => id !== regionId)
    : [...regionIds.value, regionId]
  updateAudience({ regionIds: next })
}

const onRole = (role: PersonRole) => {
  const current = roles.value ?? allRoles
  const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
  updateAudience({ roles: next.length ? next : allRoles })
}

const valueOf = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value

const onExpectedCount = (event: Event) => {
  const value = valueOf(event)
  updateAudience({ expectedCount: value === '' ? null : Number(value) })
}

const recalcPeople = () =>
  updateAudience({
    resolvedPersonIds: resolveAudience(props.state, {
      scope: scope.value,
      regionIds: regionIds.value,
      roles: roles.value
    })
  })

const onFrequencyUnit = (event: Event) =>
  emit('update:patch', {
    ...props.patch,
    frequency: { unit: valueOf(event) as FrequencyUnit, count: frequency.value?.count ?? 1 }
  })

const onFrequencyCount = (event: Event) =>
  emit('update:patch', {
    ...props.patch,
    frequency: {
      unit: frequency.value?.unit ?? 'once',
      count: Number(valueOf(event)) || 1
    }
  })

const onStartsOn = (event: Event) =>
  emit('update:patch', { ...props.patch, startsOn: valueOf(event) })

const onEndsOn = (event: Event) => emit('update:patch', { ...props.patch, endsOn: valueOf(event) })

const onMinutes = (event: Event) => {
  const value = valueOf(event)
  emit('update:patch', { ...props.patch, minutes: value === '' ? null : Number(value) })
}

const onWeight = (event: Event) =>
  emit('update:patch', { ...props.patch, weight: valueOf(event) as TaskWeight })

const onStatus = (event: Event) =>
  emit('update:patch', { ...props.patch, status: valueOf(event) as TaskStatus })

const onReminder = (event: Event) =>
  emit('update:patch', {
    ...props.patch,
    reminder:
      valueOf(event) === 'on'
        ? {
            enabled: true,
            daysBefore: props.task.reminder?.daysBefore ?? 1,
            channels: props.task.reminder?.channels ?? ['站内消息']
          }
        : null
  })
</script>

<template>
  <div class="grid gap-3.5">
    <div>
      <div class="mb-1.5 flex items-center justify-between">
        <span :class="FIELD_LABEL_CLASS">{{ t('分发范围') }}</span>
        <BeautyChip tone="bg-muted text-muted-foreground ring-border">
          {{ t('当前命中') }} {{ resolvedCount }} {{ t('人') }}
        </BeautyChip>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="item in scopeOptions"
          :key="item"
          type="button"
          class="rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition"
          :class="
            scope === item
              ? 'bg-primary/10 text-primary ring-primary/30'
              : 'bg-background text-muted-foreground ring-border hover:bg-muted'
          "
          @click="onScope(item)"
        >
          {{ t(SCOPE_LABELS[item]) }}
        </button>
      </div>
      <div v-if="scope !== 'nationwide'" class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="region in visibleRegions"
          :key="region.id"
          type="button"
          class="rounded-md px-2 py-1 text-[11px] ring-1 ring-inset transition"
          :class="
            regionIds.includes(region.id)
              ? 'bg-secondary text-secondary-foreground ring-primary/30'
              : 'bg-background text-muted-foreground ring-border hover:bg-muted'
          "
          @click="onRegion(region.id)"
        >
          {{ region.name }}
        </button>
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="role in allRoles"
          :key="role"
          type="button"
          class="rounded-md px-2 py-1 text-[11px] ring-1 ring-inset transition"
          :class="
            (roles ?? allRoles).includes(role)
              ? 'bg-secondary text-secondary-foreground ring-primary/30'
              : 'bg-background text-muted-foreground ring-border hover:bg-muted'
          "
          @click="onRole(role)"
        >
          {{ t(ROLE_LABELS[role]) }}
        </button>
      </div>
      <div class="mt-2 flex items-center gap-2">
        <input
          :class="[FIELD_CLASS, 'max-w-[120px]']"
          type="number"
          min="0"
          :value="expectedCount ?? ''"
          :placeholder="t('预期人数')"
          @input="onExpectedCount"
        />
        <el-button size="small" plain @click="recalcPeople">{{ t('按范围重算人员') }}</el-button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('频次单位') }}</div>
        <select
          :class="[FIELD_CLASS, 'w-full']"
          :value="frequency?.unit ?? 'once'"
          @change="onFrequencyUnit"
        >
          <option v-for="unit in frequencyOptions" :key="unit" :value="unit">
            {{ t(FREQUENCY_LABELS[unit]) }}
          </option>
        </select>
      </div>
      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('次数') }}</div>
        <input
          :class="[FIELD_CLASS, 'w-full']"
          type="number"
          min="1"
          max="100"
          :value="frequency?.count ?? 1"
          @input="onFrequencyCount"
        />
      </div>
      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('开始时间') }}</div>
        <input
          :class="[FIELD_CLASS, 'w-full']"
          type="date"
          :value="patch.startsOn ?? task.startsOn"
          @input="onStartsOn"
        />
      </div>
      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('截止时间') }}</div>
        <input
          :class="[FIELD_CLASS, 'w-full']"
          type="date"
          :value="patch.endsOn ?? task.endsOn"
          @input="onEndsOn"
        />
      </div>
      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('单次预计时长（分钟）') }}</div>
        <input
          :class="[FIELD_CLASS, 'w-full']"
          type="number"
          min="1"
          max="1440"
          :value="
            patch.minutes === undefined
              ? (taskOccurrenceMinutes(task) ?? '')
              : (patch.minutes ?? '')
          "
          @input="onMinutes"
        />
      </div>
      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('任务权重') }}</div>
        <select
          :class="[FIELD_CLASS, 'w-full']"
          :value="patch.weight ?? task.weight ?? 'optional'"
          @change="onWeight"
        >
          <option v-for="weight in weightOptions" :key="weight" :value="weight">
            {{ t(WEIGHT_LABELS[weight]) }}
          </option>
        </select>
      </div>
      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('任务状态') }}</div>
        <select
          :class="[FIELD_CLASS, 'w-full']"
          :value="patch.status ?? task.status"
          @change="onStatus"
        >
          <option value="active">{{ t('执行中') }}</option>
          <option value="draft">{{ t('草稿（待发布）') }}</option>
          <option value="paused">{{ t('已暂停') }}</option>
        </select>
      </div>
      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('到期提醒') }}</div>
        <select
          :class="[FIELD_CLASS, 'w-full']"
          :value="
            patch.reminder === undefined
              ? task.reminder?.enabled
                ? 'on'
                : 'off'
              : patch.reminder?.enabled
                ? 'on'
                : 'off'
          "
          @change="onReminder"
        >
          <option value="on">{{ t('启用（提前 1 天）') }}</option>
          <option value="off">{{ t('未启用') }}</option>
        </select>
      </div>
    </div>
    <p class="text-[11px] text-muted-foreground">
      {{ t('只做推演，不改任务；确认后才写入处置记录')
      }}{{ frequencyChanged ? t('（已调整频次）') : '' }}{{ t('。') }}
    </p>
  </div>
</template>
