<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue'
import InspectionMaterials from './InspectionMaterials.vue'
import InspectionHome from './InspectionHome.vue'
import InspectionTaskDetail from './InspectionTaskDetail.vue'
import ActiveInspectionTask from './ActiveInspectionTask.vue'
import QueryClarification from './QueryClarification.vue'
import AgentTrace from './AgentTrace.vue'
import { planFor, policySummary } from './executionPlan'
import { DEMO_STEP_MS, latestRoundEvents } from './liveDemo'
import {
  ensureDemoExamples,
  executionEvents,
  roundSummary,
  supervisionEvent,
  isActiveTask,
  queryCase,
  seedTasks,
  type AgentEvent,
  type QueryConfig
} from './taskFlow'
import {
  advanceCase,
  completeInitialCase,
  checkDay,
  authorizeCase,
  detectScenario,
  exportReport,
  pauseCase,
  resumeCase,
  summarizeCase,
  type InspectionCase,
  type MaterialTab,
  type Scenario
} from './model'

const props = withDefaults(defineProps<{ storageScope?: string; readOnly?: boolean }>(), {
  storageScope: 'demo',
  readOnly: false
})
const STORAGE = `beauty-ai:inspection-v4:${props.storageScope}`
const cases = ref<InspectionCase[]>([])
const page = ref<'home' | 'workspace' | 'detail' | 'active-detail'>('home')
const selectedId = ref('')
const storageError = ref('')
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null')
  if (saved?.version === 1 && Array.isArray(saved.cases)) {
    // 兼容 v4 早期本地记录：升级字段，不让历史演示卡在复查时报错。
    cases.value = saved.cases
      .filter(
        (item: InspectionCase) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.question === 'string' &&
          Array.isArray(item.people) &&
          item.people.every(
            (p) =>
              p &&
              typeof p.name === 'string' &&
              ['qualified', 'unqualified', 'missing'].includes(p.status)
          ) &&
          Array.isArray(item.receipts) &&
          Array.isArray(item.messages) &&
          ['ready', 'running', 'reported', 'watching', 'paused', 'finished', 'cancelled'].includes(
            item.phase
          )
      )
      .map((item: InspectionCase) => {
        const regions =
          Array.isArray(item.regions) && item.regions.length
            ? item.regions
            : [item.region || '南区']
        const product = item.product || '新品'
        const startsOn = item.startsOn || '2026-09-14'
        const endsOn = item.endsOn || '2026-09-18'
        return {
          ...item,
          region: item.region || regions.join('、'),
          regions,
          product,
          startsOn,
          endsOn,
          period: item.period || `${startsOn} 至 ${endsOn}`,
          recipient: item.recipient || '未达标员工本人',
          escalationRecipient: item.escalationRecipient || '我（计划创建人）',
          people: item.people.map((person) => ({
            ...person,
            region: person.region || regions[0],
            reminderCount: person.reminderCount ?? 0,
            escalated: person.escalated ?? false
          })),
          trace: Array.isArray(item.trace) ? item.trace : executionEvents(item),
          phase: item.phase === 'running' ? 'cancelled' : item.phase
        }
      })
    if (saved.demoVersion !== 4) cases.value = ensureDemoExamples(cases.value)
    // 每次进入先展示任务首页，不自动跳回历史工作区。
  } else {
    cases.value = seedTasks()
  }
} catch {
  storageError.value = '本地记录未能读取。你仍可开始新的演示。'
}
const current = computed(() => cases.value.find((item) => item.id === selectedId.value) ?? null)
const compatible = (item: InspectionCase): InspectionCase => ({
  ...item,
  regions:
    Array.isArray(item.regions) && item.regions.length ? item.regions : [item.region || '南区'],
  product: item.product || '新品',
  startsOn: item.startsOn || '2026-09-14',
  endsOn: item.endsOn || '2026-09-18',
  period: item.period || '2026-09-14 至 2026-09-18',
  recipient: item.recipient || '未达标员工本人',
  escalationRecipient: item.escalationRecipient || '我（计划创建人）',
  people: item.people.map((person) => ({
    ...person,
    region: person.region || item.region || '南区',
    reminderCount: person.reminderCount ?? 0,
    escalated: person.escalated ?? false
  }))
})
const isLocked = (item: InspectionCase) => Boolean(item.archivedAt || item.phase === 'finished')
const stats = computed(() => (current.value ? summarizeCase(current.value) : null))
const text = ref('')
const stage = computed(() =>
  Math.min(4, current.value?.executionStage ?? (current.value?.phase === 'cancelled' ? 0 : 4))
)
const executing = ref<string[]>([])
const busy = computed(() => Boolean(current.value && executing.value.includes(current.value.id)))
const liveEvents = ref<AgentEvent[]>([])
const replaying = ref(false)
const pageVisible = ref(document.visibilityState !== 'hidden')
const workspaceActive = ref(true)
let playbackTimer: ReturnType<typeof setTimeout> | undefined
const showTaskActions = computed(
  () =>
    page.value === 'active-detail' &&
    current.value?.authorized &&
    !isLocked(current.value) &&
    ['watching', 'paused'].includes(current.value.phase) &&
    !props.readOnly
)
const canOperateTask = computed(() => showTaskActions.value && !busy.value && !replaying.value)
const tab = ref<MaterialTab>('report')
const mobileTab = ref<'chat' | 'materials'>('chat')
const editingId = ref('')
const initialConfig = ref<QueryConfig>()
const headerTitle = computed(() => {
  if (page.value !== 'active-detail' || !current.value) return '智能巡检'
  const item = current.value
  const plan = planFor(item)
  const subject =
    item.scenario === 'workload'
      ? '培训负担巡检'
      : item.scenario === 'overview'
        ? '培训综合巡检'
        : plan.remindEmployees || plan.escalateToCreator
          ? '培训达标监督'
          : '培训进度巡检'
  return `${item.product} · ${subject}`
})
const clarify = ref('')
const clarifyScenario = ref<Scenario>()
const clarificationEvents = computed(() =>
  clarify.value
    ? [
        {
          id: 'clarify',
          kind: 'analysis' as const,
          title: '澄清 Agent · 等待参数确认',
          detail:
            '已接收目标。需要确认查询对象、产品、地区、时间范围和执行方式；确认前不调用查询工具。'
        }
      ]
    : []
)
const feedback = ref('')
const conversation = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let toastTimer: ReturnType<typeof setTimeout> | undefined
const stages = [
  '理解交办目标',
  '读取培训与考核示例',
  '核对完成标准与缺失项',
  '复核结论与数据引用',
  '整理巡检简报'
]
const phaseLabels: Record<InspectionCase['phase'], string> = {
  ready: '待开始',
  running: '正在核查',
  reported: '已汇报',
  watching: '持续跟进中',
  paused: '已暂停',
  finished: '已完成',
  cancelled: '已停止'
}
const examples: Array<{
  title: string
  detail: string
  question: string
  scenario: Scenario
  icon: string
}> = [
  {
    title: '盯住新品培训',
    detail: '各地区 · 未来一个月 · 提醒与飞书升级',
    question:
      '帮我监督各个地区未来一个月的新品培训，未达标就提醒，提醒三次后仍未完成再发飞书给我。',
    scenario: 'training',
    icon: '◎'
  },
  {
    title: '看看本周有什么问题',
    detail: '先给我重点，再看具体依据',
    question: '帮我做一次本周南区综合巡检，看看有什么需要我处理。',
    scenario: 'overview',
    icon: '◈'
  },
  {
    title: '检查培训负担',
    detail: '看看任务是否过多、排期是否冲突',
    question: '看看本周南区的培训负担和排期，有没有需要调整的地方。',
    scenario: 'workload',
    icon: '▤'
  }
]
watch(
  [cases, selectedId],
  () => {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          version: 1,
          demoVersion: 4,
          cases: cases.value,
          selectedId: selectedId.value
        })
      )
      storageError.value = ''
    } catch {
      storageError.value = '浏览器未能保存本次记录，刷新后可能丢失。当前仍可演示或导出。'
    }
  },
  { deep: true, immediate: true }
)
watch(
  [() => current.value?.id, () => current.value?.messages.length],
  async ([id], [previousId]) => {
    const panel = conversation.value
    const nearBottom = !panel || panel.scrollHeight - panel.scrollTop - panel.clientHeight < 80
    await nextTick()
    if (!conversation.value) return
    if (id !== previousId) conversation.value.scrollTop = 0
    else if (nearBottom) conversation.value.scrollTop = conversation.value.scrollHeight
  }
)
onUnmounted(() => {
  timers.forEach(clearTimeout)
  clearTimeout(toastTimer)
  clearTimeout(playbackTimer)
  document.removeEventListener('visibilitychange', syncVisibility)
})
const notify = (message: string) => {
  feedback.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    feedback.value = ''
  }, 4000)
}
const replace = (item: InspectionCase) => {
  const index = cases.value.findIndex((value) => value.id === item.id)
  if (index >= 0) cases.value[index] = item
}
const say = (message: string, role: 'assistant' | 'user' = 'assistant') => {
  if (!current.value) return
  current.value.messages.push({
    id: `${Date.now()}-${current.value.messages.length}`,
    role,
    text: message
  })
}
const reveal = (next: MaterialTab) => {
  tab.value = next
  mobileTab.value = 'materials'
}
const reportSummary = (item: InspectionCase) => {
  const s = summarizeCase(item)
  if (item.scenario === 'workload')
    return (
      '已整理培训涉及的 5 家门店、30 人。当前示例没有任务工时和排班，暂不能判断是否超负荷；不会把培训未达标误判成工作太多。\n配套人员清单中还有 ' +
      s.unqualified +
      ' 人未达标、' +
      s.missing +
      ' 人待核实。可以先跟进培训达标情况，负担分析需要补齐工时数据。'
    )
  return `已核对${item.region}${item.product}培训的 ${s.total} 人（${item.startsOn} 至 ${item.endsOn}）：${s.qualified} 人达标，${s.unqualified} 人未达标，另有 ${s.missing} 人记录待核实。\n建议先提醒培训负责人跟进未达标人员，同时核实缺失记录。我可以继续帮你盯到周期结束。`
}
const finishQuery = (id: string) => {
  const item = cases.value.find((value) => value.id === id)
  if (!item || item.phase !== 'running') return
  const events = executionEvents(item)
  if ((item.executionStage ?? 0) < events.length - 1) {
    item.executionStage = (item.executionStage ?? 0) + 1
    item.trace?.push(events[item.executionStage])
    timers.set(
      id,
      setTimeout(() => finishQuery(id), DEMO_STEP_MS)
    )
    return
  }
  Object.assign(item, completeInitialCase(item))
  executing.value = executing.value.filter((value) => value !== id)
  timers.delete(id)
  item.messages.push({ id: `${id}-report`, role: 'assistant', text: reportSummary(item) })
  if (item.queryMode === 'scheduled') {
    const watching = authorizeCase(item, item.cadence, item.recipient)
    watching.trace = [...(item.trace ?? []), supervisionEvent(watching)]
    watching.messages.push({
      id: `${id}-created`,
      role: 'assistant',
      text: `已按确认的需求创建监督计划：${watching.period}，${watching.cadence}复查。${policySummary(planFor(watching))}进入执行详情可查看加速演示。`
    })
    replace(watching)
  }
  if (selectedId.value === id) tab.value = 'report'
}
const clearEdit = () => {
  editingId.value = ''
  initialConfig.value = undefined
}
const requestQuery = (question: string, scenario?: Scenario) => {
  clearEdit()
  page.value = 'workspace'
  selectedId.value = ''
  clarify.value = question
  clarifyScenario.value = scenario
  text.value = ''
  mobileTab.value = 'chat'
}
const editTask = () => {
  const item = current.value
  if (!item || !canOperateTask.value || !isActiveTask(item)) return
  stopPlayback()
  liveEvents.value = []
  editingId.value = item.id
  const plan = planFor(item)
  initialConfig.value = {
    scenario: item.scenario,
    product: item.product,
    regions: [...item.regions],
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    mode: plan.scheduled ? 'scheduled' : 'once',
    cadence: item.cadence,
    escalationRecipient: item.escalationRecipient,
    toolPlan: plan
  }
  page.value = 'workspace'
  selectedId.value = ''
  clarify.value = item.question
  clarifyScenario.value = item.scenario
  text.value = ''
  mobileTab.value = 'chat'
}
const cancelClarification = () => {
  const original = cases.value.find((item) => item.id === editingId.value)
  clearEdit()
  clarify.value = ''
  if (original) openCase(original)
}
const confirmQuery = (config: QueryConfig) => {
  if (editingId.value && props.readOnly) return
  if (
    props.readOnly &&
    (config.mode === 'scheduled' ||
      config.toolPlan?.reportToCreator ||
      config.toolPlan?.remindEmployees ||
      config.toolPlan?.escalateToCreator)
  ) {
    notify('当前只读角色不能创建定时任务或生成通知预览。')
    return
  }
  launch(config.clarificationSummary || clarify.value, config.scenario, config)
}
const launch = (question: string, scenario?: Scenario, config?: QueryConfig) => {
  if (!config) {
    requestQuery(question, scenario)
    return
  }
  const original = editingId.value
    ? cases.value.find((value) => value.id === editingId.value)
    : undefined
  if (editingId.value && (!original || executing.value.includes(editingId.value))) return
  const item = queryCase(question, config)
  if (original) {
    // 确认前仅编辑独立草稿；确认后保留任务身份，重建本轮样本与执行记录。
    item.id = original.id
    item.createdAt = original.createdAt
    item.demoKey = original.demoKey
  }
  item.phase = 'running'
  item.receipts = []
  item.messages = [
    { id: `${item.id}-question`, role: 'user', text: question },
    {
      id: `${item.id}-accepted`,
      role: 'assistant',
      text: `已确认查询参数：${config.mode === 'scheduled' ? `定时跟进（${config.cadence}），已确认本地工具计划` : '单次查询'}；${policySummary(planFor(item))}\n我先核对${item.region}的${item.product}培训完成记录和考核结果。按 ${item.period} 展示固定示例（不是未来的真实数据）；不会修改业务数据，也不会向任何人发送消息。`
    }
  ]
  if (original) replace(item)
  else cases.value.unshift(item)
  clearEdit()
  selectedId.value = item.id
  item.executionStage = 0
  item.trace = executionEvents(item).slice(0, 1)
  executing.value.push(item.id)
  page.value = 'workspace'
  tab.value = 'process'
  text.value = ''
  clarify.value = ''
  mobileTab.value = 'chat'
  timers.set(
    item.id,
    setTimeout(() => finishQuery(item.id), DEMO_STEP_MS)
  )
}
const stop = () => {
  if (current.value?.phase !== 'running') return
  clearTimeout(timers.get(current.value.id))
  timers.delete(current.value.id)
  executing.value = executing.value.filter((id) => id !== current.value?.id)
  current.value.phase = 'cancelled'
  say('已停止本次核查，未生成最终结论，也未执行任何提醒。你可以重新查询。')
}
const fillExample = (question: string) => {
  text.value = question
  input.value?.focus()
}
const startNew = () => {
  clearEdit()
  page.value = 'workspace'
  selectedId.value = ''
  text.value = ''
  clarify.value = ''
  mobileTab.value = 'chat'
  nextTick(() => input.value?.focus())
}
const openCase = (item: InspectionCase) => {
  clearEdit()
  page.value = isActiveTask(item) ? 'active-detail' : 'detail'
  selectedId.value = item.id
  clarify.value = ''
  text.value = ''
  mobileTab.value = 'chat'
  tab.value = ['watching', 'running', 'paused', 'cancelled'].includes(item.phase)
    ? 'process'
    : 'report'
}
const requestFollowup = () => {
  if (!current.value || props.readOnly) return
  const item = current.value
  requestQuery(
    `请持续监督${item.region}的${item.product}培训，周期 ${item.startsOn} 至 ${item.endsOn}，未达标提醒本人。`,
    item.scenario
  )
}
const advance = () => {
  if (!current.value || props.readOnly || current.value.phase !== 'watching' || busy.value) return
  stopPlayback()
  const id = current.value.id
  liveEvents.value = []
  const result = advanceCase(current.value)
  const events = executionEvents(result, true)
  // 刷新可能保留尚未提交轮次的部分工具事件；重试按事件ID替换，不能重复累计调用。
  const runEventIds = new Set(events.map((event) => event.id))
  const existing = (current.value.trace ?? []).filter((event) => !runEventIds.has(event.id))
  let index = 0
  executing.value.push(id)
  tab.value = 'process'
  const tick = () => {
    const item = cases.value.find((value) => value.id === id)
    if (!item) return
    item.trace = [...existing, ...events.slice(0, ++index)]
    if (selectedId.value === id) liveEvents.value = events.slice(0, index)
    if (index < events.length) {
      timers.set(id, setTimeout(tick, DEMO_STEP_MS))
      return
    }
    result.trace = [...item.trace]
    replace(result)
    timers.delete(id)
    executing.value = executing.value.filter((value) => value !== id)
    completeAdvance(id)
  }
  tick()
}
const completeAdvance = (id: string) => {
  const source = cases.value.find((value) => value.id === id)
  if (!source) return
  const item = compatible(source)
  replace(item)
  const message = roundSummary(item)
  item.messages.push({ id: `${id}-round-${item.round}-summary`, role: 'assistant', text: message })
  if (selectedId.value === id) tab.value = 'process'
}
const archive = () => {
  if (
    !current.value ||
    busy.value ||
    !['reported', 'cancelled', 'finished'].includes(current.value.phase)
  )
    return
  current.value.archivedAt = new Date().toISOString()
  page.value = 'home'
  notify('任务已归档，材料与执行记录保留在本机。')
}
const goHome = () => {
  clearEdit()
  clarify.value = ''
  page.value = 'home'
}
const togglePause = () => {
  if (!current.value || props.readOnly || busy.value || replaying.value) return
  const paused = current.value.phase === 'watching'
  replace(paused ? pauseCase(current.value) : resumeCase(current.value))
  say(
    paused
      ? '已暂停跟进，保留现有材料。恢复后可继续演示复查。'
      : '已恢复原有跟进授权，可继续演示下一次复查。'
  )
}
// 旧任务仅逐条回放已有记录，不安排自动复查，也不订阅后台业务事件。
const stopPlayback = () => {
  clearTimeout(playbackTimer)
  playbackTimer = undefined
  replaying.value = false
}
const replayLatest = () => {
  stopPlayback()
  liveEvents.value = []
  if (
    !current.value ||
    page.value !== 'active-detail' ||
    busy.value ||
    !pageVisible.value ||
    !workspaceActive.value
  )
    return
  const id = current.value.id
  const events = latestRoundEvents(current.value.trace ?? [], current.value.round)
  if (!events.length) return
  replaying.value = true
  let index = 0
  const revealEvent = () => {
    if (selectedId.value !== id || page.value !== 'active-detail' || !pageVisible.value) {
      stopPlayback()
      return
    }
    liveEvents.value = events.slice(0, ++index)
    if (index < events.length) playbackTimer = setTimeout(revealEvent, DEMO_STEP_MS)
    else replaying.value = false
  }
  revealEvent()
}
const syncVisibility = () => {
  pageVisible.value = document.visibilityState !== 'hidden'
}
onMounted(() => document.addEventListener('visibilitychange', syncVisibility))
onActivated(() => {
  workspaceActive.value = true
})
onDeactivated(() => {
  workspaceActive.value = false
  stopPlayback()
})
watch([page, selectedId], () => {
  stopPlayback()
  if (page.value === 'active-detail') replayLatest()
  else liveEvents.value = []
})
watch(pageVisible, (visible) => {
  if (!visible) stopPlayback()
  else if (page.value === 'active-detail' && !busy.value) replayLatest()
})
const submit = () => {
  const question = text.value.trim()
  if (!question || busy.value) return
  text.value = ''
  if (!current.value) {
    requestQuery(question, detectScenario(question))
    return
  }
  if (isLocked(current.value)) {
    notify('已归档任务只读；请新建任务进行查询。')
    return
  }
  say(question, 'user')
  if (/暂停|先停/.test(question) && current.value.phase === 'watching') {
    togglePause()
    return
  }
  if (/恢复|继续跟进/.test(question) && current.value.phase === 'paused') {
    togglePause()
    return
  }
  if (/复查|再查一次/.test(question) && current.value.phase === 'watching') {
    advance()
    return
  }
  if (/导出|下载/.test(question)) {
    download()
    return
  }
  if (/提醒|盯|跟进|定时|每天/.test(question)) {
    if (props.readOnly) say('当前是只读角色，可以查阅与导出材料；跟进授权需要培训负责人操作。')
    else if (current.value.authorized)
      say('这件事已有跟进授权，可使用下方操作演示复查或暂停。若要更换跟进对象，请新交办一件事。')
    else {
      say('我已拟好跟进方式，请确认下面的范围和提醒规则。')
      requestFollowup()
    }
    return
  }
  if (/谁|哪些人|名单|明细|依据|为什么|原因/.test(question)) {
    const pending = current.value.people.filter((p) => p.status === 'unqualified')
    say(
      pending.length
        ? `目前未达标的是${pending.map((p) => p.name).join('、')}。判定依据是课程是否完成、考核是否达到 80 分；缺少记录的人单独列为待核实。这些数据只能说明完成状态，不能据此认定个人原因。人员明细已放在右侧。`
        : '目前所有人员均已达标，可以在人员明细中核对课程和考核记录。'
    )
    reveal('evidence')
    return
  }
  if (/南区|北区|东区|西区|全国|负担|排期|综合/.test(question)) {
    const inherited = /南区|北区|东区|西区|全国/.test(question)
      ? question
      : `${current.value.region}，${question}`
    launch(inherited, detectScenario(question))
    return
  }
  say(
    '这个原型支持查看未达标名单、解释判定依据、持续跟进和导出报告。你可以说「都有谁没达标」或「帮我继续盯着」。其他问题暂未接入真实 AI，不会为你编造结果。'
  )
}
const download = () => {
  if (!current.value || ['running', 'cancelled'].includes(current.value.phase)) return
  const url = URL.createObjectURL(
    new Blob([exportReport(current.value)], { type: 'text/plain;charset=utf-8' })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `智能巡检-${current.value.region}-${current.value.id}.txt`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  notify('已生成报告文件，包含示例证据与模拟回执。')
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="iv-workspace" data-i18n-skip="true">
    <header class="iv-header">
      <div class="iv-brand"
        ><span class="iv-brand-mark" aria-hidden="true">◎</span
        ><div
          ><h1>{{ headerTitle }}</h1
          ><span v-if="page !== 'active-detail'">交代目标，其余交给我</span></div
        ></div
      >
      <nav v-if="page !== 'home'" class="iv-header-actions" aria-label="任务导航"
        ><button class="iv-new iv-back" @click="goHome"
          ><span aria-hidden="true">←</span> 返回初始页</button
        ><button class="iv-new" @click="startNew"
          ><span aria-hidden="true">＋</span> 新建任务</button
        >
        <template v-if="showTaskActions">
          <button
            class="iv-new iv-task-action"
            :disabled="!canOperateTask"
            @click="canOperateTask && togglePause()"
            >{{ current?.phase === 'paused' ? '恢复任务' : '暂停任务' }}</button
          >
          <button
            class="iv-new iv-task-action"
            :disabled="!canOperateTask"
            @click="canOperateTask && editTask()"
            >修改任务</button
          >
        </template>
      </nav>
    </header>
    <div v-if="storageError" class="iv-storage-warning" role="alert">{{ storageError }}</div>
    <div v-if="feedback" class="iv-feedback" role="status">{{ feedback }}</div>
    <Transition name="iv-page" mode="out-in">
      <InspectionHome
        key="home"
        v-if="page === 'home'"
        :cases="cases"
        @new="startNew"
        @open="openCase"
      />
      <ActiveInspectionTask
        v-else-if="page === 'active-detail' && current"
        :key="current.id"
        :item="current"
        :busy="busy"
        :live-events="liveEvents"
        :replaying="replaying"
        :read-only="readOnly"
        @edit="editTask"
        @advance="advance"
        @pause="togglePause"
        @export="download"
      />
      <InspectionTaskDetail
        v-else-if="page === 'detail' && current"
        :key="current.id"
        :item="current"
        :busy="busy"
        :read-only="readOnly"
        @back="goHome"
        @advance="advance"
        @pause="togglePause"
        @export="download"
      />
      <div v-else key="workspace" class="iv-editor-page">
        <nav class="iv-mobile-nav" aria-label="工作区切换"
          ><button :class="{ active: mobileTab === 'chat' }" @click="mobileTab = 'chat'"
            >交办与汇报</button
          ><button :class="{ active: mobileTab === 'materials' }" @click="mobileTab = 'materials'"
            >工作材料 <span v-if="current">●</span></button
          ></nav
        >
        <main class="iv-panels">
          <section
            class="iv-conversation"
            :class="{ 'iv-mobile-hidden': mobileTab !== 'chat' }"
            aria-label="交办与汇报"
          >
            <div class="iv-conversation-heading"
              ><span class="iv-assistant-dot"></span><strong>巡检助手</strong
              ><span>{{ current ? phaseLabels[current.phase] : '准备好接手你的工作' }}</span></div
            >
            <div
              ref="conversation"
              class="iv-conversation-body"
              aria-live="polite"
              :aria-busy="current?.phase === 'running'"
            >
              <template v-if="!current">
                <div v-if="!clarify" class="iv-welcome"
                  ><div class="iv-eyebrow">少一点来回，多一点放心</div
                  ><h2>你想查什么，<br />或交给我做什么？</h2
                  ><p
                    >直接描述目标，我会先反问确认需求。<br />再选择查询工具或执行工具，行动前先请你确认。</p
                  ></div
                >
                <QueryClarification
                  v-if="clarify"
                  :key="clarify"
                  :question="clarify"
                  :scenario="clarifyScenario"
                  :initial-config="initialConfig"
                  :confirm-label="editingId ? '确认，保存修改' : undefined"
                  :read-only="readOnly"
                  @confirm="confirmQuery"
                  @cancel="cancelClarification"
                />
                <div v-if="!clarify" class="iv-examples"
                  ><button
                    v-for="example in examples"
                    :key="example.scenario"
                    @click="fillExample(example.question)"
                    ><span class="iv-example-icon" aria-hidden="true">{{ example.icon }}</span
                    ><span
                      ><strong>{{ example.title }}</strong
                      ><small>{{ example.detail }}</small></span
                    ><span class="iv-example-arrow" aria-hidden="true">↗</span></button
                  ></div
                >
                <p v-if="!clarify" class="iv-entry-note"
                  >直接输入你想查或想做的事。示例只填入文本，由你发送。</p
                >
              </template>
              <template v-else>
                <div class="iv-task-label"
                  ><span>正在处理</span><strong>{{ current.title }}</strong
                  ><small>{{ current.region }} · {{ current.period }}</small></div
                >
                <article
                  v-for="message in current.messages"
                  :key="message.id"
                  class="iv-message"
                  :class="`iv-message--${message.role}`"
                  ><span class="iv-message-author">{{
                    message.role === 'user' ? '你' : '巡检助手'
                  }}</span
                  ><p>{{ message.text }}</p></article
                >
                <AgentTrace
                  :events="current.trace ?? []"
                  :running="busy"
                  :waiting="
                    current.phase === 'watching' && !busy
                      ? `下一次复查：${checkDay(current, current.round + 1)} · ${current.cadence}（演示时钟）；点击下方按钮推进，不会后台运行。`
                      : undefined
                  "
                />
                <div v-if="current.phase === 'running'" class="iv-working" role="status"
                  ><span class="iv-pulse"></span
                  ><div
                    ><strong>{{ current.trace?.at(-1)?.title || stages[stage] }}</strong
                    ><small>材料正在同步整理，不必等在这里读过程</small></div
                  ><button class="iv-subtle" @click="stop">停止</button></div
                >
                <div v-if="current.phase === 'cancelled'" class="iv-action-card"
                  ><strong>核查已停止</strong><p>现有过程保留，未生成最终结论。</p
                  ><button class="iv-primary" @click="launch(current.question, current.scenario)"
                    >重新查询</button
                  ></div
                >
                <template v-if="!['running', 'cancelled'].includes(current.phase)">
                  <div class="iv-evidence-links"
                    ><button @click="reveal('evidence')"
                      >查看 {{ stats?.total }} 人的依据 <span>↗</span></button
                    ><button @click="reveal('process')">核查过程</button></div
                  >
                  <section
                    v-if="current.phase === 'reported' && !isLocked(current)"
                    class="iv-action-card"
                    ><span class="iv-eyebrow">建议下一步</span><h3>我继续盯，你只看重要变化。</h3
                    ><p>选择监督产品、地区和周期；未达标提醒本人，三次后仍未完成则飞书通知你。</p
                    ><button v-if="!readOnly" class="iv-primary" @click="requestFollowup"
                      >让助手持续跟进 <span>→</span></button
                    ><p v-else class="iv-readonly"
                      >当前为只读角色。跟进授权需要培训负责人操作。</p
                    ></section
                  >
                  <section
                    v-else-if="current.phase === 'watching' || current.phase === 'paused'"
                    class="iv-watch-card"
                    ><div class="iv-section-heading"
                      ><strong
                        ><i :class="{ paused: current.phase === 'paused' }"></i
                        >{{
                          current.phase === 'paused' ? '跟进已暂停' : '正在替你盯这件事'
                        }}</strong
                      ><button
                        class="iv-subtle"
                        :disabled="readOnly || busy"
                        @click="togglePause"
                        >{{ current.phase === 'paused' ? '恢复跟进' : '暂停' }}</button
                      ></div
                    ><p
                      >{{ current.cadence }} · {{ current.recipient }}<br />{{
                        current.round
                      }}
                      次复查 · 全部达标后结束</p
                    ><div class="iv-demo-control"
                      ><span>演示时间推进</span><p>不用真的等到明天，看看下一次会发生什么。</p
                      ><button
                        class="iv-primary"
                        :disabled="current.phase === 'paused' || readOnly || busy"
                        @click="advance"
                        >演示下一次复查 <span>→</span></button
                      ><small>{{ policySummary(planFor(current)) }}</small></div
                    ></section
                  >
                  <section v-else-if="current.phase === 'finished'" class="iv-finished"
                    ><span>✓</span
                    ><div
                      ><strong>这件事，办完了。</strong
                      ><p
                        >{{
                          stats?.qualified === stats?.total ? '全部达标' : '监督到期，未达标仍保留'
                        }}
                        · 跟进已结束 · 材料已整理</p
                      ></div
                    ></section
                  >
                  <div class="iv-secondary-actions"
                    ><span>{{ storageError ? '未保存' : '材料已保存在本机' }}</span
                    ><button class="iv-subtle" @click="download">导出报告 ↗</button
                    ><button
                      v-if="current.receipts.length"
                      class="iv-subtle"
                      @click="reveal('receipts')"
                      >查看回执</button
                    ></div
                  >
                </template>
                <div
                  v-if="!isLocked(current) && ['reported', 'cancelled'].includes(current.phase)"
                  class="iv-secondary-actions"
                  ><button class="iv-subtle" @click="archive">完成并归档任务</button></div
                >
                <p v-if="isLocked(current)" class="iv-entry-note"
                  >任务已归档，保留查询参数、报告和执行记录；如需重新查询，请新建任务。</p
                >
              </template>
            </div>
            <form
              v-if="!clarify && !(current && isLocked(current))"
              class="iv-composer"
              @submit.prevent="submit"
              ><label class="iv-sr-only" for="iv-message-input">交代巡检目标或继续追问</label
              ><textarea
                id="iv-message-input"
                ref="input"
                v-model="text"
                maxlength="500"
                rows="2"
                :disabled="busy"
                :placeholder="
                  current
                    ? '继续追问，或告诉我接下来怎么做…'
                    : '例如：盯住南区新品培训，没达标的提醒负责人…'
                "
                @keydown="onKeydown"
              ></textarea
              ><div class="iv-composer-bottom"
                ><span>{{
                  current?.phase === 'running'
                    ? '核查中，可点击上方停止'
                    : 'Enter 发送 · Shift + Enter 换行'
                }}</span
                ><button
                  type="submit"
                  :disabled="!text.trim() || busy"
                  :aria-label="current ? '发送追问' : '交给我'"
                  >{{ current ? '发送' : '交给我' }} <span aria-hidden="true">↑</span></button
                ></div
              ></form
            >
            <div class="iv-boundary">固定示例数据 · 不修改业务数据 · 不实际发送消息</div>
          </section>
          <section
            v-if="clarify"
            class="iv-conversation iv-query-materials"
            :class="{ 'iv-mobile-hidden': mobileTab !== 'materials' }"
            aria-label="工作材料"
            ><header class="iv-conversation-heading"
              ><strong>工作材料</strong><span>先确认，再执行</span></header
            ><div class="iv-conversation-body"
              ><AgentTrace :events="clarificationEvents" /><p class="iv-entry-note"
                >需求澄清后，我会选择查询或执行链路；工具调用、结果和监督计划会在这里逐步呈现。</p
              ></div
            ></section
          >
          <InspectionMaterials
            v-else
            :item="current"
            :stage="stage"
            :executing="busy"
            v-model:tab="tab"
            :class="{ 'iv-mobile-hidden': mobileTab !== 'materials' }"
          />
        </main>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" src="./workspace.scss"></style>
