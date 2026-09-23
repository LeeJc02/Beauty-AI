<script setup lang="ts">
/**
 * 自定义审计需求（原型 `training-inspection/RequirementTab.tsx`）。
 *
 * 状态摘要 → 现在关注的问题 → 运行记录；删除走二次确认弹窗。
 */
import { computed, onUnmounted, ref } from 'vue'
import { addDays, inspectionDay } from '@/beauty/lib/inspectionEngine'
import {
  STATUS_LABELS,
  aspectLabelOf,
  describeRequirement,
  requirementIssues,
  requirementStatusOf,
  runRequirement,
  type InspectionRequirement,
  type RequirementStatus
} from '@/beauty/lib/inspectionRequirements'
import { deleteRequirement, updateRequirement } from '@/beauty/lib/requirementStore'
import type { InspectionActor, InspectionState } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyEmptyState from './BeautyEmptyState.vue'
import BeautyMetric from './BeautyMetric.vue'
import BeautySectionHeading from './BeautySectionHeading.vue'
import RequirementIssueRow from './RequirementIssueRow.vue'
import RequirementRunRow from './RequirementRunRow.vue'
import { jakartaStamp } from './shared'

defineOptions({ name: 'BeautyRequirementTab' })

const props = withDefaults(
  defineProps<{
    state: InspectionState
    actor: InspectionActor
    requirement: InspectionRequirement
    canManage?: boolean
    week: string
    today?: string
  }>(),
  { canManage: true }
)

const emit = defineEmits<{
  (e: 'focus-task', taskId: string): void
  (e: 'open-task', taskId: string): void
  (e: 'deleted'): void
}>()

const { t } = useBeautyI18n()

const STATUS_TONE: Record<RequirementStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  paused: 'bg-amber-50 text-amber-700 ring-amber-200',
  finished: 'bg-slate-100 text-slate-600 ring-slate-200'
}

const dayLabel = (day: string) => day.slice(5).replace('-', '/')

const today = computed(() => props.today ?? inspectionDay())

const busy = ref(false)
const message = ref('')
const confirmOpen = ref(false)
let messageTimer: ReturnType<typeof setTimeout> | null = null

const showMessage = (text: string) => {
  message.value = text
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => {
    message.value = ''
  }, 6000)
}

onUnmounted(() => {
  if (messageTimer) clearTimeout(messageTimer)
})

const status = computed(() => requirementStatusOf(props.requirement))
const issues = computed(() =>
  requirementIssues(props.state, props.requirement, props.actor, props.week, today.value)
)
const latest = computed(() => props.requirement.runs.at(-1) ?? null)
const weekLabel = computed(() => `${dayLabel(props.week)} – ${dayLabel(addDays(props.week, 6))}`)
const canResume = computed(
  () => !props.requirement.endsOn || props.requirement.endsOn >= today.value
)
const canManage = computed(() => props.canManage)

const aspectText = computed(() =>
  aspectLabelOf(props.requirement.aspects, props.requirement.categories)
)

const statusDot = computed(() =>
  status.value === 'active'
    ? 'bg-emerald-500'
    : status.value === 'paused'
      ? 'bg-amber-500'
      : 'bg-slate-400'
)

const runNow = () => {
  if (!canManage.value) return
  busy.value = true
  window.setTimeout(() => {
    const next = runRequirement(props.state, props.requirement, new Date(), 'manual', props.week)
    updateRequirement(next)
    busy.value = false
    const run = next.runs.at(-1)
    if (!run) return
    showMessage(
      run.repeatCount > 1
        ? `${t('审计完成：扫了')} ${run.taskCount} ${t('项任务，结论和上次一样。')}`
        : `${t('审计完成：扫了')} ${run.taskCount} ${t('项任务，看到')} ${run.issueCount} ${t('项问题。')}`
    )
  }, 320)
}

const toggleStatus = () => {
  if (!canManage.value) return
  const next = status.value === 'paused' && canResume.value ? 'active' : 'paused'
  updateRequirement({ ...props.requirement, status: next })
  showMessage(
    next === 'active'
      ? t('已继续，到下次周期时间自动运行。')
      : t('已暂停，不再自动运行，记录都保留着。')
  )
}

const confirmDelete = () => {
  if (!canManage.value) return
  deleteRequirement(props.requirement.id)
  confirmOpen.value = false
  emit('deleted')
}

const latestHint = computed(() => {
  const run = latest.value
  if (!run) return t('到点会自动运行，也可以手动跑')
  const head =
    run.repeatCount > 1
      ? `${t('结论没变 · 连续')} ${run.repeatCount} ${t('次')}`
      : run.added.length
        ? `${t('新增')} ${run.added.length} ${t('项 · 已解决')} ${run.resolved.length} ${t('项')}`
        : t('首次运行')
  return `${head} · ${t('扫了')} ${run.taskCount} ${t('项任务')}`
})
</script>

<template>
  <div class="grid gap-4">
    <div
      class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"
    >
      <span>
        {{ t('统计周期') }} {{ weekLabel }} · {{ describeRequirement(state, requirement) }}
        {{
          requirement.nextRunAt && status === 'active'
            ? ` · ${t('下次运行')} ${jakartaStamp(requirement.nextRunAt)}`
            : ''
        }}
      </span>
      <span>{{ t('口径：任务「预计时长 × 本周次数」，缺预计时长的人不计入') }}</span>
    </div>

    <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-semibold text-foreground">{{ requirement.name }}</h3>
            <BeautyChip :tone="STATUS_TONE[status]">
              <span class="h-1.5 w-1.5 rounded-full" :class="statusDot"></span>
              {{ t(STATUS_LABELS[status]) }}
            </BeautyChip>
            <BeautyChip tone="bg-secondary text-secondary-foreground ring-primary/20">
              {{ t('Agent 创建') }}
            </BeautyChip>
          </div>
          <p class="mt-1 text-[11px] text-muted-foreground">
            {{ t('关注：') }}{{ aspectText }} · {{ t('创建于') }}
            {{ jakartaStamp(requirement.createdAt) }} · {{ t('创建人') }}
            {{ requirement.createdBy }}
          </p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <el-button
            size="small"
            plain
            :disabled="busy || !canManage"
            :title="!canManage ? t('当前账号只能查看这条全国审计') : undefined"
            @click="runNow"
          >
            <Icon
              :icon="busy ? 'lucide:loader-2' : 'lucide:refresh-cw'"
              :size="13"
              :class="busy ? 'animate-spin' : ''"
            />
            {{ busy ? t('审计中') : t('立即审计') }}
          </el-button>
          <el-button
            v-if="status === 'active'"
            size="small"
            plain
            :disabled="!canManage"
            @click="toggleStatus"
          >
            <Icon icon="lucide:pause" :size="13" /> {{ t('暂停') }}
          </el-button>
          <el-button
            v-if="status === 'paused' && canResume"
            size="small"
            plain
            :disabled="!canManage"
            @click="toggleStatus"
          >
            <Icon icon="lucide:play" :size="13" /> {{ t('继续') }}
          </el-button>
          <el-button size="small" plain :disabled="!canManage" @click="confirmOpen = true">
            <Icon icon="lucide:trash-2" :size="13" /> {{ t('删除') }}
          </el-button>
        </div>
      </div>
      <div
        v-if="message"
        class="mt-2 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] text-secondary-foreground"
      >
        {{ message }}
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <BeautyMetric
        :label="t('发现的问题')"
        :value="issues.length"
        :unit="t('项')"
        :hint="`${t('只看')}${aspectText} · ${t('已解决的自动去掉')}`"
        :tone="issues.length ? 'text-rose-600' : 'text-emerald-700'"
      />
      <BeautyMetric
        :label="t('受影响的 BA')"
        :value="latest ? latest.peopleCount : '—'"
        :unit="latest ? t('人') : ''"
        :hint="
          latest
            ? latest.unknownPeople
              ? `${t('另有')} ${latest.unknownPeople} ${t('人缺预计时长，不计入')}`
              : t('按问题命中的人去重')
            : t('还没跑过，点「立即审计」看看')
        "
      />
      <BeautyMetric
        :label="t('人均分钟')"
        :value="latest ? latest.meanMinutes : '—'"
        :unit="latest ? t('分钟') : ''"
        :hint="t('关注任务里，这些 BA 本周人均要花的计划时间')"
      />
      <BeautyMetric
        :label="t('最近一次运行')"
        :value="latest ? jakartaStamp(latest.lastSeenAt) : '—'"
        :hint="latestHint"
      />
    </div>

    <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <BeautySectionHeading
        :title="t('现在关注到的问题')"
        :hint="t('只讲这些任务对人的影响；点「看任务」跳到区域负担定位')"
      >
        <template #extra>
          <BeautyChip tone="bg-muted text-muted-foreground ring-border">
            {{ issues.length }} {{ t('项') }}
          </BeautyChip>
        </template>
      </BeautySectionHeading>
      <div class="mt-3 grid gap-1.5">
        <template v-if="issues.length">
          <RequirementIssueRow
            v-for="risk in issues"
            :key="risk.key"
            :state="state"
            :risk="risk"
            @focus-task="emit('focus-task', $event)"
            @open-task="emit('open-task', $event)"
          />
        </template>
        <BeautyEmptyState
          v-else
          :title="t('这个审计目前没有问题')"
          :hint="`${aspectText}${t('这一类，当前周期都没命中。')}`"
        />
      </div>
    </div>

    <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <BeautySectionHeading
        :title="t('运行记录')"
        :hint="t('每次只记扫了多少任务、看到几项问题；结论没变就合并成一条')"
      >
        <template #extra>
          <BeautyChip tone="bg-muted text-muted-foreground ring-border">
            {{ requirement.runs.length }} {{ t('个批次') }}
          </BeautyChip>
        </template>
      </BeautySectionHeading>
      <div class="mt-3 grid max-h-[460px] gap-1.5 overflow-y-auto pr-0.5">
        <template v-if="requirement.runs.length">
          <RequirementRunRow
            v-for="run in [...requirement.runs].reverse()"
            :key="run.id"
            :run="run"
          />
        </template>
        <BeautyEmptyState
          v-else
          :title="t('还没有运行记录')"
          :hint="t('到下次周期时间会自动跑，也可以现在点「立即审计」。')"
        />
      </div>
    </div>

    <el-dialog v-model="confirmOpen" class="inspection-modal" width="448px" append-to-body>
      <template #header>
        <div class="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <Icon icon="lucide:alert-triangle" :size="16" /> {{ t('关掉这个审计？') }}
        </div>
      </template>
      <p class="text-[12px] leading-relaxed text-muted-foreground">
        {{ t('关闭后') }}「{{ requirement.name }}」{{ t('的标签页会消失，运行记录一起删掉。') }}
        {{ t('如果只是想让它先别跑，点「暂停」更合适。') }}
      </p>
      <div class="mt-3 flex justify-end gap-2">
        <el-button plain size="small" @click="confirmOpen = false">{{ t('先留着') }}</el-button>
        <el-button size="small" @click="confirmDelete">{{ t('删除这个审计') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>
