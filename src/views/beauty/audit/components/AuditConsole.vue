<script setup lang="ts">
/**
 * 数据审计 · Agent 对话工作台（原型 `src/pages/training-inspection/AuditConsole.tsx`）。
 *
 * 极简首屏（大标题 + 输入框 + 建议问题）→ 左右分栏：左侧提问、确认与操作，右侧过程、数据与报告。
 * 这一块屏只负责「问 → 查 → 汇报」，写审计记录 / 定时 / 跳档案都通过 emit 交给页面容器，
 * 组件自己既不读 store 也不跳路由。
 */
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useBeautyI18n } from '@/beauty/composables'
import {
  AUDIT_PRESETS,
  AUDIT_STEP_NARRATION,
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
  regionFromText,
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
  artifactStageOf,
  auditContextFor,
  isNearBottom,
  reportFor,
  scopeText,
  sleep,
  stageShowsScope,
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
const pending = ref<{ question: string; ctx: AuditContext } | null>(null)
/** 当前查询批次的口径与报告 id；旧报告仍可留在对话历史，但不会污染新批次。 */
const activeRunCtx = ref<AuditContext | null>(null)
const activeReportId = ref<string | null>(null)
const activeTrailId = ref<string | null>(null)
const actionTrailIds = ref<string[]>([])
const artifactTab = ref<'report' | 'process'>('process')
/** 只在用户贴近底部时跟随新内容，阅读历史时不强行抢滚动位置。 */
const conversationRef = ref<HTMLElement | null>(null)
const conversationPinned = ref(true)

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

const latestReport = computed<ReportItem | null>(() => reportFor(items.value, activeReportId.value))

/** 正在生效的口径：补问和当前批次优先，避免显示上一轮报告的旧条件。 */
const activeCtx = computed(() =>
  auditContextFor(
    baseCtx.value,
    pending.value?.ctx ?? null,
    activeRunCtx.value,
    latestReport.value?.ctx ?? null
  )
)

const trailFor = (trailId: string) =>
  items.value.find((item): item is TrailItem => item.kind === 'trail' && item.id === trailId)

const liveClarify = computed(() =>
  pending.value
    ? items.value.find(
        (item): item is ClarifyItem => item.kind === 'clarify' && item.index < item.questions.length
      )
    : undefined
)

/**
 * 右栏只放「中间产物与数据」：当前批次的查询过程 + 汇报产物。
 * 左栏只负责交互，补问、确认、追问和操作入口都留在左边。
 */
const stageTrail = computed<TrailItem | null>(() => trailFor(activeTrailId.value ?? '') ?? null)

const stageReport = computed<ReportItem | null>(() => latestReport.value)

const artifactStage = computed(() =>
  artifactStageOf({
    entered: entered.value,
    pending: pending.value !== null,
    hasTrail: Boolean(stageTrail.value),
    hasReport: Boolean(stageReport.value)
  })
)

/** 口径块只在取数开始后出现，避免把页面默认值当成用户确认过的条件。 */
const scopeDenied = computed(() =>
  Boolean(stageTrail.value?.steps.some((step) => step.error?.kind === 'permission'))
)
const showScope = computed(() => !scopeDenied.value && stageShowsScope(artifactStage.value))

const stageKey = computed(
  () =>
    `${entered.value ? 'entered' : 'welcome'}-${stageTrail.value?.id ?? 'no-trail'}-${stageReport.value?.report.id ?? 'no-report'}`
)

const actionTrails = computed(() =>
  actionTrailIds.value.flatMap((id) => {
    const trail = trailFor(id)
    return trail ? [trail] : []
  })
)
const readyToConfirm = computed(() => Boolean(pending.value && !liveClarify.value))

/** 所有业务动作都从左侧发起，并绑定当前报告的已确认口径。 */
const runReportAction = (id: AuditToolId) => {
  if (!stageReport.value || pending.value || running.value) return
  if (id === 'save_inspection_record' && savedRecordId.value) return
  if (id === 'save_schedule' && savedScheduleId.value) return
  push({ kind: 'user', id: uid(), text: manualToolQuestion(id) })
  void runTool(id, stageReport.value.question, stageReport.value.ctx)
}

/** 进度轨道落在哪一阶段：出过汇报 → 汇报结论；有轨迹 → 取数核对；在补问 → 确认口径。 */
const stepIndex = computed(() => {
  if (latestReport.value) return 3
  if (activeTrailId.value && trails.value.some((trail) => trail.id === activeTrailId.value))
    return 2
  return pending.value ? 1 : 0
})

const stepLabel = computed(() =>
  scopeDenied.value ? '范围不可访问' : AUDIT_STEPS[stepIndex.value]
)

/** 追问只负责开启新查询；报告操作单独展示。 */
const followUps = AUDIT_PRESETS.map((preset) => preset.question)

const trackConversationScroll = () => {
  const element = conversationRef.value
  if (!element) return
  conversationPinned.value = isNearBottom(
    element.scrollHeight,
    element.scrollTop,
    element.clientHeight
  )
}

watch(items, () => {
  if (!items.value.length || !conversationPinned.value) return
  void nextTick(() => {
    const element = conversationRef.value
    if (!element || !conversationPinned.value) return
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  })
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
  activeRunCtx.value = ctx
  const token = (runToken += 1)
  busyRun = true
  running.value = true
  const current = live.value.state
  const plan = planFor(current, ctx, question)
  const trailId = uid()
  activeTrailId.value = trailId
  push({
    kind: 'agent',
    id: uid(),
    text: `好，按这个口径查：${scopeText(ctx)}。取数过程和结果会显示在右侧。`,
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
  push({
    kind: 'agent',
    id: uid(),
    text: '审查完成。请在右侧查看报告、数据出处和取数过程；需要留档或继续审查，可使用下方操作。',
    event: 'report_completed'
  })
  const reportId = uid()
  push({
    kind: 'report',
    id: reportId,
    report: buildAuditReport(current, ctx),
    ctx,
    question,
    trailId
  })
  activeReportId.value = reportId
  artifactTab.value = 'report'
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
  actionTrailIds.value = [...actionTrailIds.value, trailId]
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
      taskCount: Number.parseInt(
        report.metrics.find((metric) => metric.label === '覆盖任务')?.value ?? '0',
        10
      ),
      ruleVersion: report.ruleVersion,
      traceIds: [
        ...new Set([
          ...[...(stageTrail.value ? [stageTrail.value] : []), ...actionTrails.value].flatMap(
            (trail) =>
              trail.steps.flatMap((trailStep) =>
                trailStep.output ? [trailStep.output.traceId] : []
              )
          ),
          output.traceId
        ])
      ]
    }
    emit('save-audit-record', record)
    savedRecordId.value = record.id
    output.headline = `本地审计记录 ${record.id} 已保存：${record.findingCount} 条结论。`
    output.facts = output.facts.map((fact) =>
      fact.label === '记录编号' ? { ...fact, value: record.id } : fact
    )
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
    output.facts = output.facts.map((fact) =>
      fact.label === '订阅编号' ? { ...fact, value: schedule.id } : fact
    )
    if (output.table) {
      output.table.rows = output.table.rows.map((row) =>
        row[0] === '时间范围'
          ? [row[0], ctx.weeks.map((week) => `${week} 起 7 天`).join('、')]
          : row
      )
    }
  }

  patch({ ...step, status: 'done', output })
  busyRun = false
  running.value = false
  push({
    kind: 'agent',
    id: uid(),
    text: `${spec.title}完成。回执可在右侧「取数过程」查看；当前仅保存于本地演示环境。`,
    tone: 'confirm'
  })
  emit('toast', `${spec.title}完成：${output.headline}`)
}

const pushPermissionError = (regionName: string, visible: string[], question: string) => {
  const spec = specFor('query_scope', live.value.state, baseCtx.value)
  const trailId = uid()
  activeTrailId.value = trailId
  push(
    { kind: 'user', id: uid(), text: question },
    {
      kind: 'agent',
      id: uid(),
      text: `你问的${regionName}不在当前账号的数据范围里，本地演示的权限校验已拒绝这次查询，不会读取范围外的数据。可以问${visible.join('、')}，或者换总部账号看${regionName}。`,
      event: 'tool_call_completed',
      tone: 'error'
    },
    {
      kind: 'trail',
      id: trailId,
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
  const toolIntent = toolIntentOf(question)
  if (toolIntent) {
    const denied = outOfScopeRegion(current, currentActor, question)
    if (denied) {
      push(
        { kind: 'user', id: uid(), text: question },
        {
          kind: 'agent',
          id: uid(),
          text: `${denied.name}不在当前账号的数据范围内，未保存任何记录或定时条件。请改用当前报告的范围。`,
          tone: 'error'
        }
      )
      return
    }
    if (!latestReport.value) {
      push(
        { kind: 'user', id: uid(), text: question },
        {
          kind: 'agent',
          id: uid(),
          text: '请先完成一次审查，再保存报告或设置定时条件。',
          tone: 'note'
        }
      )
      return
    }
    const requestedRegion = regionFromText(current, currentActor, question)
    const reportCtx = latestReport.value.ctx
    if (
      (requestedRegion && !reportCtx.regionIds.includes(requestedRegion.id)) ||
      (requestedRegion && reportCtx.regionIds.length !== 1) ||
      /全国|全部区域|所有区域|本周|上周|下周|本月|品类|工时|完成率|数据完整/.test(question)
    ) {
      push(
        { kind: 'user', id: uid(), text: question },
        {
          kind: 'agent',
          id: uid(),
          text: '操作未执行。保存和定时操作只绑定当前报告；如需更改范围、周期或关注方面，请先发起新的审查。沿用当前报告请点击下方操作按钮。',
          tone: 'note'
        }
      )
      return
    }
    if (
      (toolIntent === 'save_inspection_record' && savedRecordId.value) ||
      (toolIntent === 'save_schedule' && savedScheduleId.value)
    ) {
      push({ kind: 'agent', id: uid(), text: '本次操作已保存，无需重复提交。', tone: 'note' })
      return
    }
    push({ kind: 'user', id: uid(), text: question })
    await runTool(toolIntent, question, latestReport.value.ctx)
    return
  }
  // 新批次不继承上次报告、轨迹、保存标记或操作回执。
  activeReportId.value = null
  activeTrailId.value = null
  actionTrailIds.value = []
  savedRecordId.value = null
  savedScheduleId.value = null
  artifactTab.value = 'process'
  activeRunCtx.value = initial
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
  activeRunCtx.value = ctx
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
  pending.value = { question, ctx }
}

/** 补齐问题后先展示条件确认卡，不自动取数。 */
const answerClarify = async (item: ClarifyItem, index: number, value: string, label: string) => {
  const currentPending = pending.value
  if (!currentPending) return
  const question = item.questions[index]
  const nextCtx = applyClarification(live.value.state, currentPending.ctx, question.field, value)
  activeRunCtx.value = nextCtx
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
  pending.value = { question: currentPending.question, ctx: nextCtx }
}

const confirmScope = async () => {
  if (!readyToConfirm.value || !pending.value || busyRun) return
  const { question, ctx } = pending.value
  pending.value = null
  push({ kind: 'user', id: uid(), text: '确认条件，开始审查' })
  await runPlan(question, ctx)
}

const reviseScope = () => {
  if (!pending.value) return
  input.value = pending.value.question
  items.value = items.value.filter(
    (item) => item.kind !== 'clarify' || item.index >= item.questions.length
  )
  pending.value = null
  activeRunCtx.value = null
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
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void startAudit(entryText.value)
  }
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
  activeRunCtx.value = null
  activeReportId.value = null
  activeTrailId.value = null
  actionTrailIds.value = []
  artifactTab.value = 'process'
  conversationPinned.value = true
}

/** 角色、周期或日期变化时清空会话，防止旧账号的范围与报告短暂泄露。 */
watch(
  () => [props.actor.id, props.actor.name, props.actor.roleLabel, props.week, props.today],
  () => restart(),
  { flush: 'sync' }
)

/** 导出纯文本报告：和原型一样用 Blob + 临时 a 标签，不引入额外依赖。 */
const exportReport = (report: AuditReport) => {
  const reportItem = items.value.find(
    (item): item is ReportItem => item.kind === 'report' && item.report === report
  )
  const steps = reportItem ? (trailFor(reportItem.trailId)?.steps ?? []) : []
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
    <div v-if="!entered" class="audit-entry-page cw-swap-in">
      <div class="audit-entry-card">
        <aside class="audit-entry-story">
          <div class="audit-entry-intro">
            <span class="cw-entry-badge">
              <Icon icon="lucide:shield-check" :size="14" /> {{ t('数据审计 Agent') }}
            </span>
            <h1>{{ t('想问什么，直接说。') }}</h1>
            <p>{{
              t('我会先确认查什么、哪个范围、哪段时间，再去取数，最后给你一段带数据出处的汇报。')
            }}</p>
          </div>
          <div class="audit-entry-roadmap" aria-label="审计流程">
            <div class="audit-entry-roadmap__step">
              <span class="audit-entry-roadmap__num">01</span>
              <div
                ><strong>{{ t('你说一句') }}</strong
                ><small>{{ t('直接说你想知道什么') }}</small></div
              >
            </div>
            <div class="audit-entry-roadmap__step">
              <span class="audit-entry-roadmap__num">02</span>
              <div
                ><strong>{{ t('我确认口径') }}</strong
                ><small>{{ t('范围、周期和关注方面') }}</small></div
              >
            </div>
            <div class="audit-entry-roadmap__step">
              <span class="audit-entry-roadmap__num">03</span>
              <div
                ><strong>{{ t('取数后给你汇报') }}</strong
                ><small>{{ t('每个数字都能追到出处') }}</small></div
              >
            </div>
          </div>
        </aside>
        <main class="audit-entry-editor">
          <div class="audit-entry-prompt-header">
            <label for="audit-entry-question">{{ t('这次想查什么？') }}</label>
            <span>{{ entryText.length }}/500</span>
          </div>
          <textarea
            id="audit-entry-question"
            v-model="entryText"
            class="cw-textarea"
            maxlength="500"
            :placeholder="t('例如：最近培训情况怎么样？哪个区域工时压力最大？')"
            @keydown="onEntryKeydown"
          ></textarea>
          <div class="audit-entry-examples">
            <span class="cw-entry-examples-label"
              ><Icon icon="lucide:sparkles" :size="13" /> {{ t('可以这样问:') }}</span
            >
            <button
              v-for="preset in AUDIT_PRESETS"
              :key="preset.id"
              type="button"
              class="cw-entry-example-btn"
              @click="void startAudit(preset.question)"
            >
              {{ t(preset.label) }}<Icon icon="lucide:arrow-up-right" :size="12" />
            </button>
          </div>
          <div class="audit-entry-footer">
            <div class="audit-entry-meta">
              <AuditChip
                ><Icon icon="lucide:database" :size="11" /> {{ baseCtx.scopeLabel }}</AuditChip
              >
              <AuditChip>{{ t('周期') }} {{ props.week.slice(5) }}</AuditChip>
              <AuditChip>{{ t('本地演示 · 未连接业务库') }}</AuditChip>
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
        </main>
      </div>
    </div>
    <div v-else class="studio" :class="leaving ? 'cw-swap-out' : 'cw-swap-in'">
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
          {{ t('数据与产物') }}
        </button>
      </div>

      <div class="studio__body">
        <div class="studio__conversation" :class="{ 'mobile-hidden': mobileTab !== 'chat' }">
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
            <span class="studio__round-pill">{{ t('交互区') }} · {{ stepLabel }}</span>
          </div>

          <div ref="conversationRef" class="audit-thread" @scroll.passive="trackConversationScroll">
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

                <!-- 查询过程与汇报产物都在右栏；左栏只说人话，不抢产物 -->
              </template>
            </template>
            <section v-if="readyToConfirm" class="audit-confirm-panel" aria-label="确认审查条件">
              <strong>{{ t('确认后开始审查') }}</strong>
              <p>{{ t('核对本次条件；开始后只读，修改条件将创建新一轮审查。') }}</p>
              <dl>
                <div
                  ><dt>{{ t('范围') }}</dt
                  ><dd>{{ activeCtx.scopeLabel }}</dd></div
                >
                <div
                  ><dt>{{ t('周期') }}</dt
                  ><dd>{{
                    activeCtx.weeks.map((week) => `${week.slice(5)} 起 7 天`).join('、')
                  }}</dd></div
                >
                <div
                  ><dt>{{ t('关注方面') }}</dt
                  ><dd>{{ t(FOCUS_LABELS[activeCtx.focus]) }}</dd></div
                >
                <div
                  ><dt>{{ t('品类') }}</dt
                  ><dd>{{ activeCtx.categories.join('、') || t('全部品类') }}</dd></div
                >
              </dl>
              <div class="audit-actions">
                <button type="button" class="cw-primary" @click="confirmScope">{{
                  t('确认并开始审查')
                }}</button>
                <button type="button" class="cw-ghost" @click="reviseScope">{{
                  t('修改问题')
                }}</button>
              </div>
            </section>

            <section
              v-if="stageReport && !pending"
              class="audit-report-controls"
              aria-label="报告操作"
            >
              <div class="audit-section-title">{{ t('下一步操作') }}</div>
              <div class="audit-actions">
                <button
                  type="button"
                  class="cw-primary"
                  :disabled="running || Boolean(savedRecordId)"
                  @click="runReportAction('save_inspection_record')"
                >
                  <Icon icon="lucide:archive" :size="14" />
                  {{ savedRecordId ? t('已保存本地记录') : t('保存审计记录') }}
                </button>
                <button
                  type="button"
                  class="cw-ghost"
                  :disabled="running || Boolean(savedScheduleId)"
                  @click="runReportAction('save_schedule')"
                >
                  <Icon icon="lucide:calendar-clock" :size="14" />
                  {{ savedScheduleId ? t('已保存定时条件') : t('保存每周一定时条件') }}
                </button>
                <button
                  type="button"
                  class="cw-ghost"
                  :disabled="running"
                  @click="exportReport(stageReport.report)"
                >
                  <Icon icon="lucide:download" :size="14" /> {{ t('导出报告') }}
                </button>
              </div>
              <p>{{ t('仅本地演示留档；定时条件不会启动后台调度，也不会发送飞书。') }}</p>
            </section>

            <div aria-hidden="true"></div>
          </div>

          <!-- 继续追问属于交互，留在左栏 -->
          <div
            v-if="entered && !running && !pending"
            class="audit-followups"
            :aria-label="t('可以接着问')"
          >
            <span class="audit-followups__label">
              <Icon icon="lucide:sparkles" :size="12" /> {{ t('可以接着问') }}
            </span>
            <button
              v-for="question in followUps"
              :key="question"
              type="button"
              class="audit-followup"
              @click="void ask(question)"
            >
              {{ t(question) }}
            </button>
          </div>

          <div class="audit-composer">
            <div class="audit-composer__row">
              <input
                v-model="input"
                class="audit-input"
                :disabled="running || readyToConfirm"
                aria-label="继续提问或回答确认问题"
                :placeholder="
                  readyToConfirm
                    ? t('请先确认条件，或点击「修改问题」')
                    : liveClarify
                      ? t('也可以直接打字回答这一步，例如「上周」「南区」「全部品类」')
                      : t('继续追问，例如：那南区呢？哪个区域压力最大？')
                "
                @keydown.enter="!$event.isComposing && submit(input)"
              />
              <button
                type="button"
                class="cw-primary"
                :disabled="running || readyToConfirm || !input.trim()"
                @click="submit(input)"
              >
                <Icon v-if="running" icon="lucide:loader-2" :size="14" class="cw-spin" />
                <Icon v-else icon="lucide:send" :size="14" />
                {{ running ? t('执行中') : t('发送') }}
              </button>
            </div>
          </div>
        </div>

        <aside class="studio__draft" :class="{ 'mobile-hidden': mobileTab !== 'context' }">
          <header class="studio__draft-header">
            <div class="studio__draft-title">
              <span class="studio__draft-icon">
                <Icon icon="lucide:file-text" :size="15" />
              </span>
              <h2>{{ t('数据与产物') }}</h2>
            </div>
            <span class="studio__canvas-badge">{{ t('本地演示 · 只读业务数据') }}</span>
          </header>
          <div
            v-if="stageTrail || stageReport"
            class="audit-artifact-tabs"
            role="tablist"
            aria-label="审查产物"
          >
            <button
              type="button"
              role="tab"
              :aria-selected="artifactTab === 'report'"
              :disabled="!stageReport"
              @click="artifactTab = 'report'"
            >
              <Icon icon="lucide:file-check-2" :size="14" /> {{ t('审查报告') }}
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="artifactTab === 'process'"
              @click="artifactTab = 'process'"
            >
              <Icon icon="lucide:list-checks" :size="14" /> {{ t('取数过程') }}
              <span v-if="stageTrail"
                >{{ stageTrail.steps.filter((step) => step.status === 'done').length }}/{{
                  stageTrail.steps.length
                }}</span
              >
              <span v-if="actionTrails.length">· {{ actionTrails.length }} {{ t('条回执') }}</span>
            </button>
          </div>
          <div :key="stageKey" class="studio__document audit-artifact-stage">
            <!-- 口径只在取数开始后出现，且只列用户确认过的条件 -->
            <div v-if="showScope" class="audit-rail-block">
              <span class="audit-section-title">{{ t('这次查了什么') }}</span>
              <div class="audit-rail-row">
                <span>{{ t('范围') }}</span>
                <strong>{{ activeCtx.scopeLabel }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('周期') }}</span>
                <strong>{{
                  activeCtx.weeks.map((week) => `${week.slice(5)} 起 7 天`).join('、')
                }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('关注方面') }}</span>
                <strong>{{ t(FOCUS_LABELS[activeCtx.focus]) }}</strong>
              </div>
              <div class="audit-rail-row">
                <span>{{ t('品类') }}</span>
                <strong>
                  {{
                    activeCtx.categories.length ? activeCtx.categories.join('、') : t('全部品类')
                  }}
                </strong>
              </div>
            </div>

            <!-- 中间产物：每一步取到的数据（可展开看明细表） -->
            <AuditTrailCard
              v-if="stageTrail"
              v-show="artifactTab === 'process'"
              class="audit-stage-block"
              :item="stageTrail"
              :live="running"
            />

            <!-- 产物：结论、图表与明细 -->
            <AuditBriefingCard
              v-if="stageReport"
              v-show="artifactTab === 'report'"
              :key="stageReport.id"
              class="audit-stage-block"
              :report="stageReport.report"
              :steps="trailFor(stageReport.trailId)?.steps ?? []"
              :task-title-of="taskTitleOf"
              @focus-task="emit('focus-task', $event)"
            />

            <template v-if="actionTrails.length">
              <span v-show="artifactTab === 'process'" class="audit-section-title">{{
                t('操作回执 · 本地演示')
              }}</span>
              <AuditTrailCard
                v-for="trail in actionTrails"
                v-show="artifactTab === 'process'"
                :key="trail.id"
                :item="trail"
                :live="running"
              />
            </template>

            <div v-if="scopeDenied" class="audit-stage-empty">
              <Icon icon="lucide:shield-alert" :size="18" />
              <strong>{{ t('范围不可访问，未取数') }}</strong>
              <span>{{ t('请在左侧改用当前账号可见的范围重新提问。') }}</span>
            </div>
            <div v-else-if="artifactStage === 'clarifying'" class="audit-stage-empty">
              <Icon icon="lucide:key-round" :size="18" />
              <strong>{{ t('还在确认口径') }}</strong>
              <span>
                {{
                  t(
                    '请在左侧确认范围、周期和关注方面。确认后，这里将显示取数过程、证据和审查报告。'
                  )
                }}
              </span>
            </div>
            <div v-else-if="artifactStage === 'idle'" class="audit-stage-empty">
              <Icon icon="lucide:file-text" :size="18" />
              <strong>{{ t('这里放取数结果') }}</strong>
              <span>{{ t('你说一句要查什么，我就把取数过程、关键数字和结论放在这里。') }}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style lang="scss" src="./audit-console.scss"></style>
