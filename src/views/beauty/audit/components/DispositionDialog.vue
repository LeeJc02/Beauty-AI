<script setup lang="ts">
/**
 * 处置弹窗（原型 `training-inspection/DispositionDialog.tsx`）。
 *
 * 原型的 `onSubmit` / `onDecideException` 会**返回**提示文案（成功）或抛错，
 * Vue 的 emit 没有返回值，所以这两个回调保留成函数 props。
 */
import { computed, ref, watch } from 'vue'
import {
  ACTION_LABELS,
  KIND_LABELS,
  LEVEL_LABELS,
  ROLE_LABELS,
  addDays,
  canActOnTask,
  canApproveException,
  canSeeTask,
  simulateTaskChange,
  taskAudienceIds
} from '@/beauty/lib/inspectionEngine'
import type {
  DispositionAction,
  DispositionInput,
  InspectionActor,
  InspectionState,
  RiskConfirmation,
  TaskPatch
} from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import SimulationResultView from './SimulationResultView.vue'
import TaskPatchEditor from './TaskPatchEditor.vue'
import { FIELD_CLASS, FIELD_LABEL_CLASS } from './shared'

defineOptions({ name: 'BeautyDispositionDialog' })

const props = defineProps<{
  modelValue: boolean
  state: InspectionState
  actor: InspectionActor
  taskId: string | null
  riskKey?: string
  initialAction?: DispositionAction
  initialPatch?: TaskPatch
  onSubmit: (input: DispositionInput) => string
  onDecideException?: (exceptionId: string, approve: boolean, note: string) => string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const { t } = useBeautyI18n()

const ACTION_ORDER: DispositionAction[] = [
  'adjust-task',
  'adjust-audience',
  'adjust-deadline',
  'reduce-frequency',
  'merge-duplicates',
  'pause-publish',
  'mark-exception',
  'handover'
]

const task = computed(() => props.state.tasks.find((item) => item.id === props.taskId) ?? null)

const action = ref<DispositionAction>(props.initialAction ?? 'adjust-task')
const patch = ref<TaskPatch>(props.initialPatch ?? {})
const reason = ref('')
const expiresOn = ref(addDays(props.state.policy.observationStartedOn, 14))
const mergeIds = ref<string[]>([])
const handover = ref<RiskConfirmation | null>(null)
const error = ref('')
const success = ref('')
const decisionNote = ref('')
const decisionMessage = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

watch(
  () => [props.modelValue, props.taskId, props.initialAction, props.initialPatch] as const,
  () => {
    if (!props.modelValue) return
    action.value = props.initialAction ?? 'adjust-task'
    patch.value = props.initialPatch ?? {}
    reason.value = ''
    error.value = ''
    success.value = ''
    decisionNote.value = ''
    decisionMessage.value = ''
    mergeIds.value = []
    handover.value = null
  },
  { immediate: true }
)

const risk = computed(() => props.state.risks.find((record) => record.key === props.riskKey))

const pendingException = computed(
  () =>
    props.state.exceptions.find(
      (item) =>
        item.status === 'pending' &&
        (item.taskId === props.taskId || (!!props.riskKey && item.riskKey === props.riskKey))
    ) ?? null
)

const canApprove = computed(() => canApproveException(props.actor))

const requestedByName = computed(() => {
  const item = pendingException.value
  if (!item) return ''
  return (
    props.state.people.find((person) => person.id === item.requestedBy)?.name ??
    props.state.regions.find((region) => region.ownerId === item.requestedBy)?.ownerName ??
    item.requestedBy
  )
})

const relatedDuplicates = computed(() =>
  props.state.tasks.filter(
    (item) =>
      item.id !== props.taskId &&
      item.resources.some((resource) =>
        (task.value?.resources ?? []).some((own) => own.id === resource.id)
      )
  )
)

const preview = computed(() => {
  if (action.value === 'mark-exception' || !task.value) return null
  return simulateTaskChange(props.state, task.value.id, patch.value, {
    weeks: [task.value.endsOn]
  })
})

const canAct = computed(() => (task.value ? canActOnTask(props.actor, task.value) : false))

const exceptionOnly = computed(
  () => action.value === 'mark-exception' || action.value === 'handover'
)

const blocked = computed(() => {
  if (!task.value) return true
  return (
    Boolean(props.actor.readOnly) ||
    (!canAct.value && !exceptionOnly.value) ||
    (exceptionOnly.value && !canSeeTask(props.actor, task.value))
  )
})

const handoverOptions = computed<RiskConfirmation[]>(() => {
  const options: RiskConfirmation[] = [
    { id: 'sarah', name: 'Sarah Lee', roleLabel: '总部培训经理' }
  ]
  const list = task.value
  if (!list) return options
  const regionId = list.audience.regionIds[0]
  const region = props.state.regions.find((item) => item.id === regionId)
  if (region)
    options.push({
      id: region.ownerId,
      name: region.ownerName,
      roleLabel: `${region.name}${t('负责人')}`
    })
  const trainer = props.state.people.find(
    (person) => person.regionId === regionId && person.role === 'trainer'
  )
  if (trainer)
    options.push({
      id: trainer.id,
      name: trainer.name,
      roleLabel: `${t(ROLE_LABELS[trainer.role])}${t('（门店级）')}`
    })
  return options
})

const selectAction = (item: DispositionAction) => {
  action.value = item
  error.value = ''
  success.value = ''
  if (!task.value) return
  if (item === 'adjust-deadline')
    patch.value = { ...patch.value, endsOn: addDays(task.value.endsOn, 7) }
  if (item === 'reduce-frequency' && task.value.frequency)
    patch.value = {
      ...patch.value,
      frequency: {
        unit: task.value.frequency.unit,
        count: Math.max(1, task.value.frequency.count - 2)
      }
    }
  if (item === 'pause-publish') patch.value = { ...patch.value, status: 'paused' }
}

const toggleMerge = (id: string) => {
  mergeIds.value = mergeIds.value.includes(id)
    ? mergeIds.value.filter((item) => item !== id)
    : [...mergeIds.value, id]
}

const decide = (approve: boolean) => {
  if (!pendingException.value) return
  const result =
    props.onDecideException?.(pendingException.value.id, approve, decisionNote.value) ?? ''
  decisionMessage.value =
    result || (approve ? t('已批准，风险状态更新为例外生效。') : t('已驳回，风险保持待处理。'))
}

const submit = () => {
  if (!task.value) return
  try {
    const message = props.onSubmit({
      action: action.value,
      taskId: task.value.id,
      reason: reason.value,
      patch: exceptionOnly.value ? {} : patch.value,
      mergeTaskIds: action.value === 'merge-duplicates' ? mergeIds.value : undefined,
      handoverTo: action.value === 'handover' ? handover.value : null,
      expectedImpact: preview.value?.summary,
      exception:
        action.value === 'mark-exception'
          ? {
              riskKey: props.riskKey ?? '',
              ruleId: risk.value?.ruleId ?? '',
              expiresOn: expiresOn.value
            }
          : undefined
    })
    success.value = message
    error.value = ''
  } catch (submitError) {
    error.value = (submitError as Error).message
    success.value = ''
  }
}

/** 表格里用到的待合并任务人数（原型直接调 taskAudienceIds）。 */
const mergePeople = (taskId: string) => {
  const item = props.state.tasks.find((task) => task.id === taskId)
  return item ? (taskAudienceIds(props.state, item)?.length ?? 0) : 0
}
</script>

<template>
  <el-dialog v-if="task" v-model="visible" class="inspection-modal" width="880px" append-to-body>
    <template #header>
      <div class="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <Icon icon="lucide:shield-check" :size="16" /> {{ t('处置') }} · {{ task.title }}
      </div>
    </template>
    <div class="grid max-h-[72vh] gap-4 overflow-y-auto pr-1">
      <div class="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px]">
        <BeautyChip tone="bg-background text-foreground ring-border">
          {{ t('版本') }} v{{ task.version }}
        </BeautyChip>
        <BeautyChip tone="bg-background text-foreground ring-border">
          {{ task.audience.label }}
        </BeautyChip>
        <BeautyChip tone="bg-background text-foreground ring-border">
          {{ t('负责人：') }}{{ task.owners.hqOwnerName || t('未配置') }} /
          {{ task.owners.regionOwnerName || t('未配置') }}
        </BeautyChip>
        <BeautyChip v-if="risk" tone="bg-secondary text-secondary-foreground ring-primary/20">
          {{ t(KIND_LABELS[task.kind]) }} · {{ t(LEVEL_LABELS[risk.level]) }}
        </BeautyChip>
      </div>

      <div
        v-if="canApprove && (pendingException || decisionMessage)"
        class="grid gap-2 rounded-lg bg-teal-50/60 p-3 ring-1 ring-teal-200"
      >
        <div class="text-[11.5px] text-teal-900">
          {{ t('待审批例外：') }}
          {{
            pendingException
              ? `${pendingException.id} · ${t('规则')} ${pendingException.ruleId} · ${t('到期')} ${pendingException.expiresOn} · ${t('提交人')} ${requestedByName}`
              : t('已处理')
          }}
        </div>
        <template v-if="pendingException">
          <input
            v-model="decisionNote"
            :class="[FIELD_CLASS, 'w-full']"
            :placeholder="t('审批备注（可选）')"
          />
          <div class="flex flex-wrap gap-1.5">
            <el-button size="small" @click="decide(true)">{{ t('批准') }}</el-button>
            <el-button size="small" plain @click="decide(false)">{{ t('驳回') }}</el-button>
          </div>
        </template>
        <div v-else class="text-[11.5px] text-teal-900">{{ decisionMessage }}</div>
      </div>

      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('处置动作') }}</div>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            v-for="item in ACTION_ORDER"
            :key="item"
            type="button"
            class="rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium ring-1 ring-inset transition"
            :class="
              action === item
                ? 'bg-primary/10 text-primary ring-primary/30'
                : 'bg-background text-muted-foreground ring-border hover:bg-muted'
            "
            @click="selectAction(item)"
          >
            {{ t(ACTION_LABELS[item]) }}
          </button>
        </div>
      </div>

      <TaskPatchEditor
        v-if="!exceptionOnly"
        :state="state"
        :task="task"
        :patch="patch"
        :actor="actor"
        @update:patch="patch = $event"
      />

      <div v-if="action === 'merge-duplicates'">
        <div :class="FIELD_LABEL_CLASS">{{ t('选择要合并并暂停的重复任务') }}</div>
        <div class="mt-1.5 grid gap-1.5">
          <template v-if="relatedDuplicates.length">
            <label
              v-for="item in relatedDuplicates"
              :key="item.id"
              class="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11.5px]"
            >
              <input
                type="checkbox"
                :checked="mergeIds.includes(item.id)"
                @change="toggleMerge(item.id)"
              />
              <span class="text-foreground">{{ item.title }}</span>
              <span class="text-muted-foreground">
                {{ item.audience.label }} · {{ t('命中') }} {{ mergePeople(item.id) }} {{ t('人') }}
              </span>
            </label>
          </template>
          <p v-else class="text-[11px] text-muted-foreground">{{
            t('未找到同源内容的其他任务。')
          }}</p>
        </div>
      </div>

      <div v-if="action === 'handover'">
        <div :class="FIELD_LABEL_CLASS">{{ t('转交给') }}</div>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            v-for="option in handoverOptions"
            :key="option.id"
            type="button"
            class="rounded-lg px-2.5 py-1.5 text-[11.5px] ring-1 ring-inset transition"
            :class="
              handover?.id === option.id
                ? 'bg-primary/10 text-primary ring-primary/30'
                : 'bg-background text-muted-foreground ring-border hover:bg-muted'
            "
            @click="handover = option"
          >
            {{ option.name }} · {{ t(option.roleLabel) }}
          </button>
        </div>
      </div>

      <div
        v-if="action === 'mark-exception'"
        class="grid gap-2 rounded-lg bg-teal-50/60 p-3 ring-1 ring-teal-200"
      >
        <div class="text-[11.5px] text-teal-900">{{
          t('例外只对这一条风险生效，到期自动恢复。')
        }}</div>
        <div class="grid gap-1.5 sm:grid-cols-2">
          <div>
            <div :class="FIELD_LABEL_CLASS">{{ t('例外到期日') }}</div>
            <input v-model="expiresOn" :class="[FIELD_CLASS, 'w-full']" type="date" />
          </div>
          <div class="text-[11px] text-teal-900">
            {{
              actor.hq
                ? t('总部提交后立即生效，保留审批人。')
                : t('区域提交后进入待总部审批，批准后生效。')
            }}
          </div>
        </div>
      </div>

      <div>
        <div :class="FIELD_LABEL_CLASS">{{ t('调整原因（必填）') }}</div>
        <textarea
          v-model="reason"
          class="mt-1.5 min-h-[70px] w-full rounded-lg border border-solid border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          :placeholder="t('写清楚为什么调整')"
        ></textarea>
      </div>

      <SimulationResultView v-if="preview" :result="preview" />

      <div
        v-if="error"
        class="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700 ring-1 ring-rose-200"
      >
        {{ error }}
      </div>
      <div
        v-if="success"
        class="rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800 ring-1 ring-emerald-200"
      >
        {{ success }}
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-2 border-t border-solid border-border pt-3"
      >
        <span class="text-[11px] text-muted-foreground">
          {{
            blocked
              ? t('没有处置权限，可转交负责人或标记例外。')
              : t('提交后保留版本、原因与复查结果。')
          }}
        </span>
        <div class="flex gap-1.5">
          <el-button plain size="small" @click="visible = false">{{ t('取消') }}</el-button>
          <el-button size="small" :disabled="blocked" @click="submit">{{
            t('提交处置')
          }}</el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>
