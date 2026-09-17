<script setup lang="ts">
/**
 * 数据审计 · Agent 对话工作台（原型 `src/pages/training-inspection/AuditConsole.tsx`）。
 *
 * 极简首屏（大标题 + 输入框 + 建议问题）→ 左右分栏：左侧对话与查询轨迹，右侧审计依据。
 * 这一块屏只负责「问 → 查 → 汇报」，写审计记录 / 定时 / 跳档案都通过 emit 交给页面容器，
 * 组件自己既不读 store 也不跳路由。
 */
import { useBeautyI18n } from '@/beauty/composables'
import {
  AUDIT_PRESETS,
  AUDIT_STEP_NARRATION,
  AUDIT_TOOL_LIST,
  FOCUS_LABELS,
  applyClarification,
  auditContext,
  buildAuditReport,
  clarificationsFor,
  manualToolQuestion,
  outOfScopeRegion,
  planContext,
  planFor,
  runAuditTool,
  specFor,
  type AuditContext,
  type AuditReport,
  type AuditToolId
} from '@/beauty/lib/auditTools'
import { LEVEL_LABELS } from '@/beauty/lib/inspectionEngine'
import type {
  AuditRecord,
  AuditSchedule,
  InspectionActor,
  InspectionState
} from '@/beauty/lib/inspectionTypes'
import AuditBriefingCard from './audit-console/AuditBriefingCard.vue'
import AuditChip from './audit-console/AuditChip.vue'
import AuditClarifyCard from './audit-console/AuditClarifyCard.vue'
import AuditTrailCard from './audit-console/AuditTrailCard.vue'
import { jakartaStamp } from './shared'
import {
  AUDIT_STEPS,
  CLARIFY_DEFAULT,
  scopeText,
  shortHeadline,
  sleep,
  toolIntentOf,
  uid,
  type ClarifyItem,
  type ConsoleItem,
  type ReportItem,
  type TrailItem,
  type TrailStep
} from './audit-console/consoleModel'

defineOptions({ name: 'BeautyAuditConsole' })

const props = defineProps<{
  state: InspectionState
  actor: InspectionActor
  week: string
  today: string
}>()

const emit = defineEmits<{
  (e: 'focus-task', taskId: string): void
  (e: 'toast', text: string): void
  (e: 'open-archive'): void
  (e: 'save-audit-record', record: AuditRecord): void
  (e: 'save-audit-schedule', schedule: AuditSchedule): void
}>()

const { t } = useBeautyI18n()

/* ------------------------------------------------------------ 工作台状态 */

const items = ref<ConsoleItem[]>([])
const input = ref('')
const entryText = ref('')
const running = ref(false)
const savedRecordId = ref<string | null>(null)
const savedScheduleId = ref<string | null>(null)
const entered = ref(false)
/** 原型保留了换场用的 leaving 开关：进入走动画，退出是立即切换。 */
const leaving = ref(false)
const mobileTab = ref<'chat' | 'context'>('chat')
const toolsOpen = ref(false)
const pending = ref<{ question: string; ctx: AuditContext } | null>(null)
/** 新内容出现时把底部哨兵滚进视野（页面滚动容器在上层，哨兵比滚容器可靠）。 */
const endRef = ref<HTMLDivElement | null>(null)

/** 左右面板交换：和「生成课件」同一套交互，顺序记在 localStorage（键名沿用原型）。 */
const PANELS_SWAPPED_KEY = 'audit-console-panels-swapped'
const readPanelsSwapped = () => {
  try {
    return window.localStorage.getItem(PANELS_SWAPPED_KEY) === 'true'
  } catch {
    /* 隐私模式下只影响本次演示 */
    return false
  }
}
const panelsSwapped = ref(readPanelsSwapped())
const togglePanelsSwapped = () => {
  panelsSwapped.value = !panelsSwapped.value
  try {
    window.localStorage.setItem(PANELS_SWAPPED_KEY, String(panelsSwapped.value))
  } catch {
    /* 隐私模式下只影响本次演示 */
  }
}

/** 取消令牌：重新开始或新流程都会 +1，旧流程在 await 之后自行退出。 */
let runToken = 0
/** 同一时间只允许一个流程；用普通变量做同步守卫，避免多一次渲染。 */
let busyRun = false

/** 页面容器的 onOpenArchive：原型只在传了这个回调时才显示「审计档案」入口。 */
const instance = getCurrentInstance()
const canOpenArchive = computed(() => Boolean(instance?.vnode.props?.onOpenArchive))

/* ------------------------------------------------------------ 派生数据 */

const live = computed(() => ({
  state: props.state,
  week: props.week,
  today: props.today,
  actor: props.actor
}))

const baseCtx = computed(() => auditContext(props.state, props.actor, props.week, props.today))

const trails = computed(() =>
  items.value.filter((item): item is TrailItem => item.kind === 'trail')
)
const lastTrail = computed(() => trails.value.at(-1))

const latestReport = computed<ReportItem | null>(() => {
  for (let index = items.value.length - 1; index >= 0; index -= 1) {
    const item = items.value[index]
    if (item.kind === 'report') return item
  }
  return null
})

/** 正在生效的口径：已经出过汇报就用那次汇报的口径，否则用页面当前周期。 */
const activeCtx = computed(() => latestReport.value?.ctx ?? baseCtx.value)

const liveClarify = computed(() =>
  items.value.find(
    (item): item is ClarifyItem => item.kind === 'clarify' && item.index < item.questions.length
  )
)

const callCounts = computed(() => {
  const counts = new Map<AuditToolId, number>()
  for (const trail of trails.value)
    for (const step of trail.steps) counts.set(step.spec.id, (counts.get(step.spec.id) ?? 0) + 1)
  return counts
})

/** 右栏「已经拿到的数据」：按完成顺序列出每次取数的关键指标。 */
const dataPoints = computed(() =>
  trails.value.flatMap((trail) =>
    trail.steps
      .filter((step) => step.status === 'done' && step.output)
      .map((step) => ({
        id: step.id,
        title: step.spec.title,
        headline: shortHeadline(step.output!.headline),
        facts: step.output!.facts.slice(0, 2)
      }))
  )
)

/** 进度轨道落在哪一阶段：出过汇报 → 汇报结论；有轨迹 → 取数核对；在补问 → 确认口径。 */
const stepIndex = computed(() => {
  if (latestReport.value) return 3
  if (trails.value.length) return 2
  return liveClarify.value ? 1 : 0
})

const stepLabel = computed(() => AUDIT_STEPS[stepIndex.value])

/** 右栏「可以接着问」：预置问题 + 两个动作型提问（会被 toolIntentOf 识别）。 */
const followUps = [
  ...AUDIT_PRESETS.map((preset) => preset.question),
  '把结论保存成审计记录',
  '每周一早上九点自动跑这个审计'
]

watch(items, () => {
  if (!items.value.length) return
  void nextTick(() => endRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
})

onBeforeUnmount(() => {
  runToken += 1
  busyRun = false
})

/* ------------------------------------------------------------ 流程编排 */

const push = (...next: ConsoleItem[]) => {
  items.value = [...items.value, ...next]
}

const taskTitleOf = (taskId: string) =>
  props.state.tasks.find((task) => task.id === taskId)?.title ?? taskId

/** 按计划执行：一次「查数据 → 汇报」的完整流程。 */
const runPlan = async (question: string, ctx: AuditContext) => {
  const token = (runToken += 1)
  busyRun = true
  running.value = true
  const current = live.value.state
  const plan = planFor(current, ctx, question)
  const trailId = uid()
  push({
    kind: 'agent',
    id: uid(),
    text: `好，按这个口径查：${scopeText(ctx)}。我边查边跟你说结果。`,
    tone: 'confirm',
    event: 'run_started'
  })
  push({ kind: 'trail', id: trailId, steps: [] })
  let steps: TrailStep[] = []
  const patch = (next: TrailStep[]) => {
    items.value = items.value.map((item) =>
      item.kind === 'trail' && item.id === trailId ? { ...item, steps: next } : item
    )
  }
  for (const stepId of plan.steps) {
    if (token !== runToken) return
    const spec = specFor(stepId, current, ctx, question)
    steps = [
      ...steps,
      { id: uid(), spec, narration: AUDIT_STEP_NARRATION[stepId], status: 'running' as const }
    ]
    patch(steps)
    await sleep(220 + spec.params.length * 60)
    if (token !== runToken) return
    const output = runAuditTool(stepId, current, ctx, question)
    steps = steps.map((step, index) =>
      index === steps.length - 1 ? { ...step, status: 'done' as const, output } : step
    )
    patch(steps)
    await sleep(90)
  }
  if (token !== runToken) return
  push({ kind: 'agent', id: uid(), text: '查完了，先给结论：', event: 'report_completed' })
  push({
    kind: 'report',
    id: uid(),
    report: buildAuditReport(current, ctx),
    ctx,
    question
  })
  busyRun = false
  running.value = false
}

/** 单独跑一个工具：用于「保存审计记录 / 每周自动审计」这类动作。 */
const runTool = async (id: AuditToolId, question?: string, override?: AuditContext) => {
  if (busyRun) return
  const { state: current, week: currentWeek, today: currentToday, actor: currentActor } = live.value
  const ctx = override ?? auditContext(current, currentActor, currentWeek, currentToday)
  const spec = specFor(id, current, ctx, question)
  const token = (runToken += 1)
  busyRun = true
  running.value = true
  const trailId = uid()
  if (id !== 'save_inspection_record' && id !== 'save_schedule') {
    push(
      { kind: 'user', id: uid(), text: manualToolQuestion(id) },
      { kind: 'trail', id: trailId, steps: [] }
    )
  } else {
    push({ kind: 'trail', id: trailId, steps: [] })
  }
  const step: TrailStep = {
    id: uid(),
    spec,
    narration: AUDIT_STEP_NARRATION[id],
    status: 'running'
  }
  const patch = (nextStep: TrailStep) => {
    items.value = items.value.map((item) =>
      item.kind === 'trail' && item.id === trailId ? { ...item, steps: [nextStep] } : item
    )
  }
  patch(step)
  await sleep(300)
  if (token !== runToken) return
  const output = runAuditTool(id, current, ctx, question)
  patch({ ...step, status: 'done', output })

  // 报告卡上的动作必须真正进入审计状态；否则刷新后会出现「已保存」但记录消失的断链。
  const now = new Date().toISOString()
  if (id === 'save_inspection_record') {
    const report = latestReport.value?.report ?? buildAuditReport(current, ctx)
    const record: AuditRecord = {
      id: `audit-record-${Date.now()}`,
      question: question ?? latestReport.value?.question ?? '本次数据审计',
      createdAt: now,
      actorId: currentActor.id,
      actorName: currentActor.name,
      roleLabel: currentActor.roleLabel,
      weeks: [...ctx.weeks],
      scopeLabel: ctx.scopeLabel,
      focus: ctx.focus,
      categories: [...ctx.categories],
      reportId: report.id,
      reportTitle: report.title,
      verdict: report.verdict,
      findingCount: report.findings.length,
      taskCount: current.tasks.filter((task) => task.status !== 'disabled').length,
      ruleVersion: report.ruleVersion,
      traceIds: [
        ...new Set([
          ...trails.value.flatMap((trail) =>
            trail.steps.flatMap((trailStep) => (trailStep.output ? [trailStep.output.traceId] : []))
          ),
          output.traceId
        ])
      ]
    }
    emit('save-audit-record', record)
    savedRecordId.value = record.id
  }
  if (id === 'save_schedule') {
    const existing = (current.auditSchedules ?? []).find(
      (schedule) =>
        schedule.actorId === currentActor.id &&
        schedule.scopeLabel === ctx.scopeLabel &&
        schedule.focus === ctx.focus &&
        schedule.categories.join(',') === ctx.categories.join(',')
    )
    const schedule: AuditSchedule = {
      id: existing?.id ?? `audit-schedule-${Date.now()}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      actorId: currentActor.id,
      actorName: currentActor.name,
      roleLabel: currentActor.roleLabel,
      active: true,
      cadence: 'weekly',
      weekday: 1,
      time: '09:00',
      timezone: 'Asia/Jakarta',
      weeks: [...ctx.weeks],
      scopeLabel: ctx.scopeLabel,
      focus: ctx.focus,
      categories: [...ctx.categories],
      ruleVersion: current.policy.version.toString()
    }
    emit('save-audit-schedule', schedule)
    savedScheduleId.value = schedule.id
  }

  busyRun = false
  running.value = false
  emit('toast', `${spec.title}完成：${output.headline}`)
}

const pushPermissionError = (regionName: string, visible: string[], question: string) => {
  const spec = specFor('query_scope', live.value.state, baseCtx.value)
  push(
    { kind: 'user', id: uid(), text: question },
    {
      kind: 'agent',
      id: uid(),
      text: `你问的${regionName}不在当前账号的数据范围里，ADM 的权限校验直接拒了这次查询，我不会绕过去取数。可以问${visible.join('、')}，或者换总部账号看${regionName}。`,
      event: 'tool_call_completed',
      tone: 'error'
    },
    {
      kind: 'trail',
      id: uid(),
      steps: [
        {
          id: uid(),
          spec,
          narration: AUDIT_STEP_NARRATION.query_scope,
          status: 'error',
          error: {
            code: 'PERMISSION_DENIED',
            kind: 'permission',
            userMessage: `当前账号是${props.actor.roleLabel}，只能查看${visible.join('、')}与全国任务；${regionName}的数据不会返回。`,
            modelMessage: `scope=${visible.join('|')} requested=${regionName}`,
            retryable: false,
            needUserInput: true
          }
        }
      ]
    }
  )
}

const ask = async (raw: string) => {
  const question = raw.trim()
  if (!question || busyRun || pending.value) return
  input.value = ''
  const { state: current, week: currentWeek, today: currentToday, actor: currentActor } = live.value
  const initial = auditContext(current, currentActor, currentWeek, currentToday)
  const blocked = outOfScopeRegion(current, currentActor, question)
  if (blocked) {
    pushPermissionError(
      blocked.name,
      current.regions
        .filter((region) => initial.regionIds.includes(region.id))
        .map((region) => region.name),
      question
    )
    return
  }
  const ctx = planContext(current, initial, question)
  const toolIntent = toolIntentOf(question)
  if (toolIntent) {
    push({ kind: 'user', id: uid(), text: question })
    await runTool(toolIntent, question, ctx)
    return
  }
  const questions = clarificationsFor(current, ctx, question)
  if (questions.length) {
    push(
      { kind: 'user', id: uid(), text: question },
      {
        kind: 'agent',
        id: uid(),
        text: '明白，开始查之前先跟你对一下口径——就差这几件事：',
        tone: 'note'
      },
      { kind: 'clarify', id: uid(), questions, answers: {}, picks: [], index: 0 }
    )
    pending.value = { question, ctx }
    return
  }
  push({ kind: 'user', id: uid(), text: question })
  await runPlan(question, ctx)
}

/** 回答一道补问：答完还有下一题就继续问，否则拿最终口径开跑。 */
const answerClarify = async (item: ClarifyItem, index: number, value: string, label: string) => {
  const currentPending = pending.value
  if (!currentPending) return
  const question = item.questions[index]
  const nextCtx = applyClarification(live.value.state, currentPending.ctx, question.field, value)
  const nextIndex = index + 1
  items.value = items.value.map((entry) =>
    entry.kind === 'clarify' && entry.id === item.id
      ? {
          ...entry,
          answers: { ...entry.answers, [index]: label },
          picks: [],
          index: nextIndex
        }
      : entry
  )
  if (nextIndex < item.questions.length) {
    pending.value = { question: currentPending.question, ctx: nextCtx }
    return
  }
  pending.value = null
  await runPlan(currentPending.question, nextCtx)
}

const skipClarify = (item: ClarifyItem, index: number) => {
  const fallback = CLARIFY_DEFAULT[item.questions[index].field]
  void answerClarify(item, index, fallback.value, fallback.label)
}

const togglePick = (id: string, value: string) => {
  items.value = items.value.map((entry) =>
    entry.kind === 'clarify' && entry.id === id
      ? {
          ...entry,
          picks: entry.picks.includes(value)
            ? entry.picks.filter((item) => item !== value)
            : [...entry.picks, value]
        }
      : entry
  )
}

/** 补问期间用户直接在输入框里打字：先按选项文案匹配，再按区域名匹配。 */
const answerByText = (item: ClarifyItem, text: string) => {
  const question = item.questions[item.index]
  if (!question) return
  const hit = question.options.find(
    (option) => text.includes(option.label) || option.value === text
  )
  if (hit) {
    void answerClarify(item, item.index, hit.value, hit.label)
    return
  }
  if (question.field === 'region') {
    const region = live.value.state.regions.find(
      (entry) => text.includes(entry.name) && baseCtx.value.regionIds.includes(entry.id)
    )
    if (region) {
      void answerClarify(item, item.index, region.id, region.name)
      return
    }
  }
  push({
    kind: 'agent',
    id: uid(),
    text: `这一步我没接住。可以点上面的选项，或者按这些说法回答：${question.options
      .map((option) => option.label)
      .join('、')}。`,
    tone: 'note'
  })
}

const submit = (raw: string) => {
  const text = raw.trim()
  if (!text) return
  if (liveClarify.value) {
    input.value = ''
    answerByText(liveClarify.value, text)
    return
  }
  void ask(text)
}

const onEntryKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) void startAudit(entryText.value)
}

const startAudit = async (raw: string) => {
  const question = raw.trim()
  if (!question) return
  // 左侧交互台始终保留，只把内容从入口平滑切换为对话流；右侧产物独立换场。
  entered.value = true
  await ask(question)
}

const restart = () => {
  runToken += 1
  busyRun = false
  running.value = false
  pending.value = null
  items.value = []
  savedRecordId.value = null
  savedScheduleId.value = null
  entered.value = false
  entryText.value = ''
  input.value = ''
  mobileTab.value = 'chat'
}

/** 导出纯文本报告：和原型一样用 Blob + 临时 a 标签，不引入额外依赖。 */
const exportReport = (report: AuditReport) => {
  const steps = lastTrail.value?.steps ?? []
  const lines = [
    `${report.title}（SalesBoost AI 数据审计）`,
    `生成时间：${jakartaStamp(new Date().toISOString())} · 数据版本 v${props.state.revision} · 规则集 ${report.ruleVersion}`,
    `审计范围：${report.scope}`,
    '',
    `一、结论：${report.verdict}`,
    report.briefing,
    report.summary,
    '',
    '二、关键指标',
    ...report.metrics.map((metric) => `${metric.label}：${metric.value}`),
    '',
    '三、各区域人均排期',
    ...report.regions.map(
      (region) =>
        `${region.name}：人均 ${region.meanMinutes} 分钟 · 容量基线 ${region.capacityMinutes} 分钟 · ${region.overCapacityCount} 人超容量 · ${region.taskCount} 项任务`
    ),
    '',
    '四、这一周每天最忙的人',
    ...report.days.map(
      (day) => `${day.day}：最忙 ${day.peakMinutes} 分钟 · 人均 ${day.meanMinutes} 分钟`
    ),
    '',
    `五、需要你知道的 ${report.findings.length} 件事`,
    ...report.findings.flatMap((finding, index) => [
      `${index + 1}. [${LEVEL_LABELS[finding.level]} / ${finding.ruleId}] ${finding.title}`,
      `   原因：${finding.detail}`,
      `   证据：${finding.evidence}`,
      `   数据出处：${finding.source}`,
      `   涉及任务：${finding.taskIds
        .map((id) => props.state.tasks.find((task) => task.id === id)?.title ?? id)
        .join('、')}`
    ]),
    '',
    '六、建议怎么做（不自动改任务）',
    ...report.actions.map((action, index) => `${index + 1}. ${action}`),
    '',
    '七、汇报背后的数据',
    ...steps.flatMap((step) =>
      step.output?.table
        ? [
            `【${step.spec.title}】`,
            step.output.table.columns.join(' | '),
            ...step.output.table.rows.map((row) => row.join(' | ')),
            ''
          ]
        : []
    ),
    '八、这次怎么查的',
    ...steps.map(
      (step) =>
        `${step.spec.name}（${step.spec.owner} · ${step.spec.permission}）· ${step.spec.params
          .map((param) => `${param.label}=${param.value}`)
          .join(' · ')}${
          step.output
            ? ` · ${step.output.traceId} · ${step.output.scanned} · ${step.output.ms}ms`
            : ''
        }`
    ),
    '',
    '说明：本报告为原型演示数据；Agent 只输出结论与证据，不修改培训任务、人员、组织与成绩。'
  ]
  const url = URL.createObjectURL(
    new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  const fileName = `审计报告-${report.id}.txt`
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
  emit('toast', `报告已导出：${fileName}（浏览器默认下载目录）。`)
}
</script>

<template>
  <div class="cw-root audit-console-root" data-i18n-skip="true">
    <div class="studio" :class="leaving ? 'cw-swap-out' : 'cw-swap-in'">
      <header class="studio__header">
        <div class="studio__header-left">
          <div class="studio__identity">
            <span class="studio__identity-icon">
              <Icon icon="lucide:shield-check" :size="16" />
            </span>
            <div class="studio__identity-info">
              <strong class="studio__brand-title">{{ t('数据审计') }}</strong>
              <span class="studio__topic-pill" :title="scopeText(activeCtx)">
                {{ activeCtx.scopeLabel }} · {{ activeCtx.week.slice(5) }}
              </span>
            </div>
          </div>
        </div>
        <ol class="studio__steps" aria-label="审计进度">
          <li
            v-for="(label, index) in AUDIT_STEPS"
            :key="label"
            class="studio__step-item"
            :class="{ active: index === stepIndex, complete: index < stepIndex }"
          >
            <span class="studio__step-badge">{{ index + 1 }}</span>
            <span class="studio__step-label">{{ t(label) }}</span>
            <span
              v-if="index < AUDIT_STEPS.length - 1"
              class="studio__step-divider"
              aria-hidden="true"
            ></span>
          </li>
        </ol>
        <div class="studio__header-right">
          <span class="studio__saved" :class="{ 'is-busy': running }">
            <Icon v-if="running" icon="lucide:loader-2" :size="13" class="cw-spin" />
            <Icon v-else icon="lucide:shield-check" :size="13" />
            {{
              running
                ? t('执行中')
                : savedRecordId
                  ? t('结论已留痕')
                  : savedScheduleId
                    ? t('定时已保存')
                    : latestReport
                      ? t('待保存')
                      : t('等待提问')
            }}
          </span>
          <button
            v-if="canOpenArchive"
            type="button"
            class="cw-ghost"
            @click="emit('open-archive')"
          >
            <Icon icon="lucide:archive" :size="13" /> {{ t('审计档案') }}
          </button>
          <button type="button" class="cw-ghost" @click="restart">{{ t('重新开始') }}</button>
        </div>
      </header>

      <div class="studio__mobile-tabs" role="tablist" aria-label="审计工作区">
        <button type="button" :class="{ active: mobileTab === 'chat' }" @click="mobileTab = 'chat'">
          {{ t('与 Agent 对话') }}
        </button>
        <button
          type="button"
          :class="{ active: mobileTab === 'context' }"
          @click="mobileTab = 'context'"
        >
          {{ t('审计依据') }}
        </button>
      </div>

      <div class="studio__body">
        <div
          class="studio__conversation"
          :class="[mobileTab !== 'chat' ? 'mobile-hidden' : '', panelsSwapped ? 'is-swapped' : '']"
        >
          <div class="studio__coach-bar">
            <div class="studio__coach-profile">
              <span class="studio__coach-avatar">
                <Icon icon="lucide:bot" :size="14" />
              </span>
              <div class="studio__coach-meta">
                <span class="studio__coach-name">{{ t('审计 Agent') }}</span>
                <span class="studio__coach-status">
                  <span class="studio__pulse-dot"></span> {{ t('只读业务数据 · 不改任务') }}
                </span>
              </div>
            </div>
            <span class="studio__round-pill">{{ stepLabel }}</span>
          </div>

          <div class="audit-thread">
            <div v-if="!entered" class="audit-entry-inline">
              <span class="cw-entry-badge">
                <Icon icon="lucide:shield-check" :size="14" /> {{ t('数据审计 Agent') }}
              </span>
              <h1>{{ t('想问什么，直接说。') }}</h1>
              <p>
                {{
                  t(
                    '我会先跟你确认查什么、哪个范围、哪段时间，再去取数，最后给你一段带数据出处的汇报。'
                  )
                }}
              </p>
              <textarea
                v-model="entryText"
                class="cw-textarea"
                :placeholder="t('例如：最近培训情况怎么样？哪个区域工时压力最大？')"
                @keydown="onEntryKeydown"
              ></textarea>
              <div class="audit-entry-examples">
                <span class="cw-entry-examples-label">
                  <Icon icon="lucide:sparkles" :size="13" /> {{ t('可以这样问:') }}
                </span>
                <button
                  v-for="preset in AUDIT_PRESETS"
                  :key="preset.id"
                  type="button"
                  class="cw-entry-example-btn"
                  @click="void startAudit(preset.question)"
                >
                  {{ t(preset.label) }}<Icon icon="lucide:arrow-right" :size="12" />
                </button>
              </div>
              <div class="audit-entry-actions">
                <div class="audit-card__head">
                  <AuditChip>
                    <Icon icon="lucide:database" :size="11" /> {{ baseCtx.scopeLabel }}
                  </AuditChip>
                  <AuditChip>{{ t('周期') }} {{ props.week.slice(5) }}</AuditChip>
                </div>
                <button
                  type="button"
                  class="cw-primary"
                  :disabled="!entryText.trim() || leaving"
                  @click="void startAudit(entryText)"
                >
                  <Icon icon="lucide:sparkles" :size="15" /> {{ t('开始审计') }}
                  <Icon icon="lucide:arrow-right" :size="15" />
                </button>
              </div>
            </div>

            <template v-if="entered">
              <template v-for="item in items" :key="item.id">
                <!-- 用户提问 -->
                <div v-if="item.kind === 'user'" class="audit-user-bubble">
                  <div class="studio__user-bubble-wrap" style="width: 100%">
                    <div class="studio__user-avatar">
                      <Icon icon="lucide:user" :size="13" />
                    </div>
                    <div class="studio__user-message">{{ item.text }}</div>
                  </div>
                </div>

                <!-- Agent 旁白 -->
                <div
                  v-else-if="item.kind === 'agent'"
                  class="studio__coach-bubble-wrap"
                  :class="item.tone ? `is-${item.tone}` : ''"
                >
                  <div class="studio__bubble-avatar">
                    <Icon icon="lucide:sparkles" :size="13" />
                  </div>
                  <div class="studio__bubble-content">
                    <div class="studio__speaker">
                      <span>{{ t('审计 Agent') }}</span>
                      <AuditChip v-if="item.event" :event="item.event" />
                    </div>
                    <p class="studio__message">{{ item.text }}</p>
                  </div>
                </div>

                <!-- 补问卡 -->
                <div v-else-if="item.kind === 'clarify'" class="studio__coach-bubble-wrap">
                  <div class="studio__bubble-avatar">
                    <Icon icon="lucide:key-round" :size="13" />
                  </div>
                  <div class="studio__bubble-content">
                    <div class="studio__speaker">
                      <span>{{ t('审计 Agent') }}</span>
                      <AuditChip event="clarification_required" />
                    </div>
                    <AuditClarifyCard
                      :item="item"
                      :live="liveClarify?.id === item.id && pending !== null"
                      @answer="(index, value, label) => answerClarify(item, index, value, label)"
                      @pick="(value) => togglePick(item.id, value)"
                      @skip="(index) => skipClarify(item, index)"
                    />
                  </div>
                </div>

                <!-- 查询过程 -->
                <div v-else-if="item.kind === 'trail'" class="studio__coach-bubble-wrap">
                  <div class="studio__bubble-avatar">
                    <Icon icon="lucide:wrench" :size="13" />
                  </div>
                  <div class="studio__bubble-content">
                    <AuditTrailCard :item="item" :live="running && item.id === lastTrail?.id" />
                  </div>
                </div>

                <!-- 汇报卡 -->
                <div v-else class="studio__coach-bubble-wrap">
                  <div class="studio__bubble-avatar">
                    <Icon icon="lucide:file-text" :size="13" />
                  </div>
                  <div class="studio__bubble-content">
                    <AuditBriefingCard
                      :report="item.report"
                      :steps="lastTrail?.steps ?? []"
                      :busy="running"
                      :task-title-of="taskTitleOf"
                      @focus-task="emit('focus-task', $event)"
                      @export="exportReport"
                      @run-tool="(id) => void runTool(id, undefined, item.ctx)"
                    />
                  </div>
                </div>
              </template>
            </template>
            <div ref="endRef"></div>
          </div>

          <div class="audit-composer">
            <div class="audit-composer__row">
              <input
                v-model="input"
                class="audit-input"
                :disabled="running"
                :placeholder="
                  liveClarify
                    ? t('也可以直接打字回答这一步，例如「上周」「南区」「全部品类」')
                    : t('继续追问，例如：那南区呢？哪个区域压力最大？')
                "
                @keydown.enter="submit(input)"
              />
              <button
                type="button"
                class="cw-primary"
                :disabled="running || !input.trim()"
                @click="submit(input)"
              >
                <Icon v-if="running" icon="lucide:loader-2" :size="14" class="cw-spin" />
                <Icon v-else icon="lucide:send" :size="14" />
                {{ running ? t('执行中') : t('发送') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 中间：交换左右面板（顺序会被记住，窄屏双栏叠起来时不显示） -->
        <button
          type="button"
          class="studio__swap-panels"
          aria-label="交换左右面板"
          title="交换左右面板"
          @click="togglePanelsSwapped"
        >
          <Icon icon="lucide:arrow-left-right" :size="16" />
        </button>

        <aside
          class="studio__draft"
          :class="[
            mobileTab !== 'context' ? 'mobile-hidden' : '',
            panelsSwapped ? 'is-swapped' : ''
          ]"
        >
          <header class="studio__draft-header">
            <div class="studio__draft-title">
              <span class="studio__draft-icon">
                <Icon icon="lucide:database" :size="15" />
              </span>
              <h2>{{ t('审计依据') }}</h2>
            </div>
            <span class="studio__canvas-badge">{{ t('只读') }}</span>
          </header>
          <div
            :key="`${entered ? 'entered' : 'welcome'}-${latestReport?.report.id ?? dataPoints.length}`"
            class="studio__document audit-artifact-stage"
          >
            <div class="audit-rail-block">
              <span class="audit-section-title">{{ t('这次查了什么') }}</span>
              <div class="audit-rail-row">
                <span>{{ t('范围') }}</span>
                <strong>{{ activeCtx.scopeLabel }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('周期') }}</span>
                <strong>{{ activeCtx.week.slice(5) }} {{ t('起 7 天') }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('关注方面') }}</span>
                <strong>{{ latestReport ? t(FOCUS_LABELS[activeCtx.focus]) : t('待确认') }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('品类') }}</span>
                <strong>
                  {{
                    activeCtx.categories.length ? activeCtx.categories.join('、') : t('全部品类')
                  }}
                </strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('数据版本') }}</span>
                <strong>v{{ props.state.revision }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('规则集') }}</span>
                <strong>v{{ props.state.policy.version }}{{ t('（A–G）') }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('单日承受线') }}</span>
                <strong>{{ props.state.policy.dailyLimitMinutes }} {{ t('分钟') }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('最近审计') }}</span>
                <strong>
                  {{ props.state.lastRunAt ? jakartaStamp(props.state.lastRunAt) : t('尚未运行') }}
                </strong>
              </div>
            </div>

            <div class="audit-rail-block" style="margin-top: 12px">
              <span class="audit-section-title">{{ t('已经拿到的数据') }}</span>
              <template v-if="dataPoints.length">
                <div v-for="point in dataPoints" :key="point.id" class="audit-datapoint">
                  <span class="audit-datapoint__title">{{ point.title }}</span>
                  <span class="audit-datapoint__facts">
                    <AuditChip v-for="fact in point.facts" :key="fact.label" :title="fact.hint">
                      {{ fact.label }} {{ fact.value }}
                    </AuditChip>
                  </span>
                  <span class="audit-datapoint__headline">{{ point.headline }}</span>
                </div>
              </template>
              <span v-else class="audit-tool-row__desc">
                {{ t('还没有取数。Agent 每查完一步，关键数字会出现在这里。') }}
              </span>
            </div>

            <div class="audit-rail-block" style="margin-top: 12px">
              <span class="audit-section-title">{{ t('可以接着问') }}</span>
              <button
                v-for="question in followUps"
                :key="question"
                type="button"
                class="studio__text-button"
                style="padding-left: 0; text-align: left"
                :disabled="running || pending !== null"
                @click="void ask(question)"
              >
                <Icon icon="lucide:play-circle" :size="12" /> {{ t(question) }}
              </button>
            </div>

            <div class="audit-rail-block" style="margin-top: 12px">
              <button type="button" class="audit-rail-toggle" @click="toolsOpen = !toolsOpen">
                <span class="audit-section-title">
                  {{ t('白名单工具') }}（{{ AUDIT_TOOL_LIST.length }}）
                </span>
                <Icon
                  :icon="toolsOpen ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  :size="13"
                />
              </button>
              <template v-if="toolsOpen">
                <span class="audit-tool-row__desc">
                  {{ t('只有登记过的工具可以被调用，没有「执行任意 SQL」这类入口。') }}
                </span>
                <button
                  v-for="tool in AUDIT_TOOL_LIST"
                  :key="tool.id"
                  type="button"
                  class="audit-tool-row"
                  :disabled="running"
                  :title="`${tool.desc}｜${t('权限码')} ${tool.permission}`"
                  @click="void runTool(tool.id)"
                >
                  <span class="audit-tool-row__head">
                    <span class="audit-tool-name">{{ tool.name }}</span>
                    <AuditChip :tone="tool.owner === 'adm' ? 'audit-chip--accent' : ''">
                      {{ tool.owner === 'adm' ? 'ADM' : 'SUP' }}
                    </AuditChip>
                    <AuditChip v-if="callCounts.get(tool.id)" tone="audit-chip--accent">
                      ×{{ callCounts.get(tool.id) }}
                    </AuditChip>
                  </span>
                  <span class="audit-tool-row__desc">{{ tool.title }}</span>
                </button>
              </template>
            </div>

            <div class="audit-error audit-error--permission" style="margin-top: 12px">
              <Icon icon="lucide:alert-triangle" :size="11" />
              <span>
                {{
                  t(
                    'Agent 只读业务数据并按规则找问题，不修改培训任务、人员、组织与成绩；飞书由 ADM 在发送前再校验接收人权限。'
                  )
                }}
              </span>
            </div>
          </div>
          <div class="studio__composer">
            <div class="studio__composer-actions">
              <span class="studio__hint">
                <Icon icon="lucide:shield-check" :size="13" />
                {{ t('结论都能追到规则编号与数据出处，处置需要人工确认。') }}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style lang="scss" src="./audit-console.scss"></style>
