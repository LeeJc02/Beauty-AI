<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type DeepReadonly } from 'vue'
import { useCoursewareInspectionRuntime } from '@/beauty/lib/coursewareInspectionRuntime'
import {
  planRequest,
  planFromTask,
  toInspectionRules,
  type InspectionRequestPlan
} from '@/beauty/lib/inspectionRequest'
import type { CoursewareInspectionTask } from '@/beauty/lib/coursewareInspection'
import InspectionPlanEditor from './InspectionPlanEditor.vue'
import {
  buildPlanDocument,
  planDocumentClauses,
  reconcilePlanDocument,
  removedDurationCondition,
  conflictingPlanCondition
} from './inspectionPlanDocument'

const props = defineProps<{
  task?: DeepReadonly<CoursewareInspectionTask>
  editing?: boolean
  readOnly?: boolean
}>()
const emit = defineEmits<{ close: []; saved: [id: string, mode: 'once' | 'continuous'] }>()
const runtime = useCoursewareInspectionRuntime()
const plan = ref<InspectionRequestPlan>()
const answer = ref('')
const busy = ref(false)
const streaming = ref(false)
const saved = ref(false)
const lastSavedId = ref('')
const sessionTaskId = ref('')
const revisionPrepared = ref(false)
const pendingRevision = ref<InspectionRequestPlan>()
const error = ref('')
const planDocument = ref('')
const generatedDocument = ref('')
const documentDirty = computed(() => planDocument.value !== generatedDocument.value)
const inputLocked = computed(() => busy.value || streaming.value || saved.value)
const messages = ref<
  Array<{ id: number; role: 'user' | 'assistant'; text: string; summary?: string }>
>([])
const composer = ref<HTMLTextAreaElement>()
const thread = ref<HTMLElement>()
const mobileTab = ref<'conversation' | 'materials'>('conversation')
const swapped = ref(false)
try {
  swapped.value = localStorage.getItem('inspection-panels-swapped') === 'true'
} catch {
  /* 使用默认布局 */
}
function swapPanels() {
  swapped.value = !swapped.value
  try {
    localStorage.setItem('inspection-panels-swapped', String(swapped.value))
  } catch {
    /* 不影响当前操作 */
  }
}
const clarification = computed(() => plan.value?.needsClarification)
const focusedTask = computed(
  () =>
    runtime.tasks.value.find((task) => task.id === (lastSavedId.value || sessionTaskId.value)) ||
    (sessionTaskId.value === props.task?.id ? props.task : undefined)
)
const editingActiveTask = computed(() =>
  Boolean(
    props.editing &&
    focusedTask.value &&
    focusedTask.value.mode !== 'once' &&
    !focusedTask.value.completedAt
  )
)
const canConfirm = computed(() =>
  Boolean(
    plan.value?.ready &&
    !inputLocked.value &&
    !documentDirty.value &&
    (!editingActiveTask.value || revisionPrepared.value) &&
    (!props.readOnly || plan.value.mode === 'once')
  )
)
let streamTimer: ReturnType<typeof setInterval> | undefined
let version = 0
function stopStream() {
  if (streamTimer) clearInterval(streamTimer)
  streamTimer = undefined
  streaming.value = false
}
function addMessage(role: 'user' | 'assistant', text: string) {
  messages.value.push({ id: messages.value.length + 1, role, text })
}
function analysisSummary(current: InspectionRequestPlan) {
  const known = [
    current.subject === 'training'
      ? '人员培训'
      : current.subject === 'courseware'
        ? '课件核验'
        : '',
    current.mode === 'once' ? '一次查询' : current.mode === 'continuous' ? '持续监督' : '',
    current.region && `地区：${current.region}`,
    current.person && `人员：${current.person}`,
    current.product && `产品：${current.product}`,
    current.keyword && `课件标题包含：${current.keyword}`
  ]
    .filter(Boolean)
    .join('；')
  const time =
    current.timeMode === 'range'
      ? `${current.startsOn || '起始日期待确认'} 至 ${current.endsOn || '结束日期待确认'}`
      : current.timeMode === 'ongoing'
        ? '确认后新增记录，持续至约定结束或人工暂停'
        : current.timeMode === 'current'
          ? '当前已有记录'
          : '尚待明确，不默认扩为全部历史记录'
  const standards: string[] = []
  if (current.subject === 'training') {
    if (typeof current.requireCourseCompleted === 'boolean')
      standards.push(current.requireCourseCompleted ? '要求完成课程' : '不以完课作为必要条件')
    if (Number.isFinite(current.minScore)) standards.push(`考核成绩至少 ${current.minScore} 分`)
  } else if (current.subject === 'courseware') {
    if (current.durationInvalid) standards.push('时长数值尚未通过有效性核对')
    else {
      if (Number.isFinite(current.minDurationMinutes))
        standards.push(`产物预计学习时长不少于 ${current.minDurationMinutes} 分钟`)
      if (Number.isFinite(current.maxDurationMinutes))
        standards.push(`产物预计学习时长不超过 ${current.maxDurationMinutes} 分钟`)
    }
    if (current.metric === 'quality') standards.push('核对生成状态及产物依据')
  }
  const actions =
    current.mode === 'once'
      ? '只查询，不提醒、不升级'
      : current.mode === 'continuous' && current.actionConfirmed
        ? `${current.remind ? '未达标提醒本人，确认仅表示签收' : '不提醒本人'}；${current.reportRequested ? '同人连续第三次未达标向任务创建人汇报，缺依据中断、合规清零' : '不升级汇报'}`
        : '提醒与升级方式尚待确认，不据此执行通知'
  const question = current.needsClarification?.question
  let reason = '人工审核决定最终授权范围；计划修改后仍须重新核对，确认前不会取数或执行。'
  if (question) {
    if (/提醒|汇报|升级|处理|通知/.test(question))
      reason = '异常处理决定通知对象和升级时机；发现未达标不等于已获得提醒或汇报授权。'
    else if (/标准|分数|成绩|分钟|时长|完课|达标/.test(question))
      reason =
        '判断标准决定同一记录是否合格；需要明确数值边界和完课要求，不能用默认阈值替你下结论。'
    else if (/时间|哪段|哪天|日期|本周|当前|之后|持续|一次/.test(question))
      reason =
        '时间与执行方式决定纳入哪些记录、是否继续检查新增事项；未明确就可能把历史或未来数据混入本次核验。'
    else if (/地区|人员|员工|产品|范围|课件|谁/.test(question))
      reason = '对象与范围决定数据筛选边界；没有点明的地区、人员或产品不能自动纳入。'
    else reason = '这一条件会影响数据筛选或执行授权，需先明确，避免按未经确认的假设处理。'
  }
  return [
    `先核对这次交办的边界。${known ? `你已经明确了${known}，后续只围绕这些对象整理计划。` : '检查对象还没有明确，需要先确定要关注的人或课件，不能直接扩到全部记录。'}`,
    `时间按${time}处理，日期以雅加达时间（UTC+7）为准。${current.timeMode === 'range' ? '所选日期之外的记录不纳入本次结论。' : '没有明确授权的历史或未来记录不会自动纳入。'}`,
    standards.length
      ? `核验时采用你给出的标准：${standards.join('；')}。${current.subject === 'courseware' ? '这里看的是课件产物的预计学习时长，而不是生成时填写的目标时长。' : '完课情况和考核成绩分别保留依据，不能互相替代。'}缺少依据的对象会单独列出，不直接判为不合格。`
      : '目前还不能判断什么算合格。需要先向你确认标准，不用默认数值替你决定。',
    `处理方式也需要与交办一致：${actions}。`,
    question
      ? `${reason}因此，下一步先确认：${question}`
      : '对象、时间、标准和处理方式已经齐备。接下来把这些约定整理成右侧计划，列清核验步骤、异常处理和交付内容；你确认执行后才开始读取数据。'
  ].join('\n\n')
}
/** 每轮先逐步输出可核对的需求摘要，再逐步输出计划正文；不展示内部推理。 */
function writePlanDocument(current: InspectionRequestPlan, revisedDocument?: string) {
  stopStream()
  const retainOriginal = editingActiveTask.value && !current.ready
  if (!retainOriginal) {
    generatedDocument.value = ''
    planDocument.value = ''
  }
  const document = current.ready ? (revisedDocument ?? buildPlanDocument(current)) : ''
  const summary = analysisSummary(current)
  addMessage('assistant', '')
  const message = messages.value[messages.value.length - 1]
  message.summary = ''
  const response =
    current.needsClarification?.question ||
    '请核对任务计划。你可以直接编辑正文，或继续补充要求；核对完成后由你确认开始。'
  let summaryLength = 0
  let responseLength = 0
  if (!retainOriginal) generatedDocument.value = document
  streaming.value = true
  const token = version
  streamTimer = setInterval(() => {
    if (token !== version) {
      stopStream()
      return
    }
    if (summaryLength < summary.length) {
      summaryLength += 3
      message.summary = summary.slice(0, summaryLength)
    } else if (responseLength < response.length) {
      responseLength += 3
      message.text = response.slice(0, responseLength)
    } else if (planDocument.value.length < document.length) {
      planDocument.value = document.slice(0, planDocument.value.length + 5)
    } else stopStream()
  }, 45)
}
function reviewDocument() {
  if (inputLocked.value || !documentDirty.value || !plan.value) return
  error.value = ''
  const original = planDocumentClauses(generatedDocument.value)
  const edited = planDocumentClauses(planDocument.value)
  const changes = edited.filter((line) => !original.includes(line))
  if (JSON.stringify(original) === JSON.stringify(edited)) {
    generatedDocument.value = planDocument.value
    return
  }
  if (!changes.length) {
    error.value = '请在对话中明确要取消的条件；仅删除计划内容不会改变执行范围。'
    return
  }
  const removed = removedDurationCondition(generatedDocument.value, planDocument.value)
  if (removed) {
    error.value = removed
    return
  }
  const previous = plan.value
  const reviewed = planRequest(changes.join('；'), previous)
  addMessage('user', `核对计划修改：${changes.join('；')}`)
  if (!reviewed.ready) {
    error.value = reviewed.needsClarification?.question || '请补充明确修改内容后再确认。'
    addMessage('assistant', error.value)
    return
  }
  const document = reconcilePlanDocument(planDocument.value, previous, reviewed)
  const conflict = conflictingPlanCondition(document, reviewed)
  if (conflict) {
    error.value = conflict
    return
  }
  plan.value = reviewed
  revisionPrepared.value = true
  writePlanDocument(reviewed, document)
}
const initialSuggestions = [
  {
    label: '查询课件生成情况',
    text: '新品培训快开始了，帮我查一下新品课件的预计学习时长是否合适，把缺少时长依据的也单独列出来'
  },
  {
    label: '持续关注新课件',
    text: '以后生成新品课件时帮我持续监督预计学习时长，太短或太长都需要跟进，先和我确认标准与处理方式'
  },
  {
    label: '查询人员培训情况',
    text: '我想了解南区李欣的新品培训是否达标，课程完成情况和考核成绩都要看，缺少成绩的不要直接判不合格'
  },
  {
    label: '持续跟进培训达标',
    text: '帮我持续关注南区的新品培训，不达标时提醒本人，连续没达标是否需要汇报也请和我确认'
  }
]
function resizeComposer() {
  if (!composer.value) return
  composer.value.style.height = 'auto'
  composer.value.style.height = `${Math.min(Math.max(composer.value.scrollHeight, 56), 156)}px`
  composer.value.style.overflowY = composer.value.scrollHeight > 156 ? 'auto' : 'hidden'
}
let observer: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && composer.value) {
    let width = 0
    observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next !== undefined && next !== width) {
        width = next
        resizeComposer()
      }
    })
    observer.observe(composer.value)
  }
  resizeComposer()
})
onBeforeUnmount(() => {
  version++
  observer?.disconnect()
  stopStream()
})
watch(answer, () => nextTick(resizeComposer))
watch(planDocument, () => {
  if (!streaming.value) error.value = ''
})
function resetDraft() {
  version++
  stopStream()
  planDocument.value = ''
  generatedDocument.value = ''
  messages.value = []
  error.value = ''
  answer.value = ''
  saved.value = false
  busy.value = false
  lastSavedId.value = ''
  sessionTaskId.value = ''
  revisionPrepared.value = false
  pendingRevision.value = undefined
  plan.value = undefined
}
// 同步观察账号/角色，A→B→A 也逐次清理，不让新建草稿或在途回调跨身份复用。
watch(
  () => runtime.identityKey(),
  () => {
    resetDraft()
    addMessage('assistant', '账号或角色已切换，未确认的需求与计划已清空。请重新交办本次任务。')
  },
  { flush: 'sync' }
)
watch(
  () => [props.task?.id, props.editing],
  () => {
    resetDraft()
    if (props.task) {
      sessionTaskId.value = props.task.id
      plan.value = planFromTask(props.task)
      addMessage('user', props.task.question)
      if (plan.value.ready) {
        planDocument.value = plan.value.planMarkdown || buildPlanDocument(plan.value)
        generatedDocument.value = planDocument.value
      }
      addMessage('assistant', props.editing
        ? '你想调整这项任务的哪一部分？可以修改关注人员、检查标准、监督时间，或提醒与汇报方式。右侧先保留原计划供你对照；我会与你核对变化，重新生成完整计划，再由你确认执行。未确认前，原任务条件保持不变。'
        : '已带入当前任务条件。补充或修改后需要重新核对，由你确认后执行。')
    } else
      addMessage(
        'assistant',
        '你关心哪份课件，或哪个地区、哪位员工的产品培训？告诉我目标，我会与你明确人员、时间和标准，再确认是查一遍还是持续跟进。'
      )
  },
  { immediate: true }
)
watch(
  () => messages.value.map((message) => `${message.text}${message.summary || ''}`).join(''),
  async () => {
    const following =
      !thread.value ||
      thread.value.scrollHeight - thread.value.scrollTop - thread.value.clientHeight < 64
    await nextTick()
    if (following && thread.value) thread.value.scrollTop = thread.value.scrollHeight
  }
)
const editSuggestions = computed(() => [
  { label: '调整检查标准', text: plan.value?.subject === 'training' ? '我想调整完课要求和成绩标准' : '我想调整预计学习时长范围', question: plan.value?.subject === 'training' ? '新的成绩门槛是多少？是否必须完成课程？' : '预计学习时长的合格范围要改为多少分钟？' },
  { label: '调整关注范围', text: '我想调整关注范围', question: plan.value?.subject === 'training' ? '要关注哪个地区、哪些人员和产品？其余未修改条件将保留。' : '要改为哪些标题关键词，还是检查当前可见的全部课件？' },
  { label: '调整监督时间', text: '我想调整监督时间', question: '新的监督起止日期是什么？也可以明确从现在开始持续关注。' },
  { label: '调整提醒与汇报', text: '我想调整提醒和汇报方式', question: '未达标时是否提醒本人？同人连续第三次未达标是否向任务创建人汇报？' }
])
function chooseEdit(suggestion: { text: string; question: string }) {
  if (!plan.value || inputLocked.value) return
  revisionPrepared.value = false
  addMessage('user', suggestion.text)
  plan.value = { ...plan.value, ready: false, needsClarification: { question: suggestion.question, options: [] } }
  writePlanDocument(plan.value)
  nextTick(() => composer.value?.focus())
}
function submit(text = answer.value) {
  const value = text.trim()
  if (!value || inputLocked.value) return
  answer.value = ''
  error.value = ''
  addMessage('user', value)
  if (pendingRevision.value && value === '保留其他条件，重新生成计划') {
    plan.value = pendingRevision.value
    pendingRevision.value = undefined
    revisionPrepared.value = true
  } else {
    const previous = pendingRevision.value || plan.value
    pendingRevision.value = undefined
    plan.value = planRequest(value, previous)
    if (editingActiveTask.value) {
      revisionPrepared.value = false
      if (plan.value.ready) {
        pendingRevision.value = plan.value
        plan.value = {
          ...plan.value,
          ready: false,
          needsClarification: {
            question: `这次修改后的约定是：${plan.value.summary}。未提到的其他条件是否沿用原任务？你也可以继续补充修改。`,
            options: [{ label: '保留其他条件，重新生成计划', answer: '保留其他条件，重新生成计划' }]
          }
        }
      }
    }
  }
  writePlanDocument(plan.value)
  nextTick(resizeComposer)
}
async function confirm() {
  if (!canConfirm.value || !plan.value) return
  busy.value = true
  const token = version
  // 固定本次人工确认的快照，异步查询不读取后续变化的响应式草稿。
  const current = JSON.parse(JSON.stringify({ ...plan.value, planMarkdown: planDocument.value })) as InspectionRequestPlan
  error.value = ''
  try {
    let id: string
    if (current.mode === 'once') id = await runtime.executeQuery(current, { confirmed: true })
    else {
      if (props.readOnly) return
      const rules = { ...toInspectionRules(current), confirmed: true as const }
      if (editingActiveTask.value && focusedTask.value) {
        id = focusedTask.value.id
        if (!runtime.updateTask(id, rules)) throw new Error('任务无法修改，请返回列表重新查看。')
      } else id = runtime.createTask(rules)
    }
    if (token !== version) return
    saved.value = true
    lastSavedId.value = id
    emit('saved', id, current.mode === 'once' ? 'once' : 'continuous')
  } catch (cause) {
    if (token === version)
      error.value = cause instanceof Error ? cause.message : '本次处理未完成，请重试。'
  } finally {
    if (token === version) busy.value = false
  }
}
function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <section class="inspection-session" aria-label="智能巡检交互工作区">
    <div class="is-mobile-tabs" role="tablist" aria-label="工作区面板">
      <button
        role="tab"
        type="button"
        :aria-selected="mobileTab === 'conversation'"
        @click="mobileTab = 'conversation'"
        >对话</button
      >
      <button
        role="tab"
        type="button"
        :aria-selected="mobileTab === 'materials'"
        @click="mobileTab = 'materials'"
        >任务计划</button
      >
    </div>
    <div class="is-body" :aria-busy="busy || streaming">
      <section
        class="is-conversation is-panel"
        :class="{ 'is-swapped': swapped, 'mobile-hidden': mobileTab !== 'conversation' }"
        aria-label="需求对话"
      >
        <header class="is-coach-bar">
          <button type="button" class="is-text-button" @click="emit('close')">← 返回任务</button>
          <div class="is-coach"
            ><span class="is-avatar" aria-hidden="true">✧</span
            ><span
              ><strong>巡检助手</strong
              ><small>{{ streaming ? '正在整理你的需求' : '为你明确目标与执行条件' }}</small></span
            ></div
          >
        </header>
        <div
          ref="thread"
          class="is-thread"
          tabindex="0"
          aria-label="需求对话记录，可滚动"
          aria-live="polite"
        >
          <article
            v-for="message in messages"
            :key="message.id"
            class="is-message"
            :class="message.role"
          >
            <span class="is-message-author">{{ message.role === 'user' ? '你' : '巡检助手' }}</span>
            <details
              v-if="message.summary !== undefined"
              class="is-processing-summary"
              :class="{ 'is-analyzing': streaming && message.id === messages.length }"
              :open="message.id === messages.length"
            >
              <summary><span class="is-analysis-indicator" aria-hidden="true"></span>分析进展
                <small>{{ streaming && message.id === messages.length ? '正在核对与整理…' : '已整理' }}</small>
              </summary>
              <div class="is-analysis-content">
                <p v-for="(paragraph, index) in message.summary.split('\n\n').filter(Boolean)" :key="index">{{ paragraph }}</p>
              </div>
            </details>
            <p v-if="message.text">{{ message.text }}</p>
          </article>
          <div v-if="editingActiveTask && messages.length === 2" class="is-suggestions" aria-label="修改任务引导">
            <button v-for="suggestion in editSuggestions" :key="suggestion.label" type="button" :disabled="inputLocked" @click="chooseEdit(suggestion)">{{ suggestion.label }} <span aria-hidden="true">↗</span></button>
          </div>
          <div v-if="!plan" class="is-suggestions"
            ><button
              v-for="suggestion in initialSuggestions"
              :key="suggestion.label"
              type="button"
              @click="submit(suggestion.text)"
              >{{ suggestion.label }} <span aria-hidden="true">↗</span></button
            ></div
          >
          <div v-if="clarification && !inputLocked" class="is-choices" aria-label="需求澄清选项"
            ><button
              v-for="option in clarification.options"
              :key="option.label"
              type="button"
              @click="submit(option.answer)"
              ><span class="is-choice-dot" aria-hidden="true"></span
              ><span>{{ option.label }}</span></button
            ><p>也可以在下方直接补充你的要求。</p></div
          >
          <p v-if="busy" class="is-processing" role="status">正在执行，完成后进入任务详情…</p>
          <p v-if="error" class="is-error" role="alert">{{ error }}</p>
        </div>
        <footer class="is-composer">
          <label for="inspection-message" class="is-sr-only">输入需求或补充条件</label>
          <textarea
            id="inspection-message"
            ref="composer"
            v-model="answer"
            rows="2"
            :disabled="inputLocked"
            :placeholder="
              editingActiveTask ? (plan?.subject === 'training' ? '告诉我这次想改什么，例如：成绩改为至少90分，并要求完课…' : '告诉我这次想改什么，例如：预计学习时长改为10到15分钟…') : plan ? '补充范围、检查标准，或继续提出问题…' : '告诉我想查询什么，或需要持续关注什么…'
            "
            @keydown="onComposerKeydown"
          ></textarea>
          <div class="is-composer-actions"
            ><span>Enter 发送 · Shift + Enter 换行</span
            ><button
              class="is-primary"
              type="button"
              :disabled="inputLocked || !answer.trim()"
              @click="submit()"
              >发送 <span aria-hidden="true">↑</span></button
            ></div
          >
        </footer>
      </section>
      <button
        class="is-swap-panels"
        type="button"
        aria-label="交换左右面板"
        title="交换左右面板"
        :aria-pressed="swapped"
        @click="swapPanels"
        ><span aria-hidden="true">⇄</span></button
      >
      <section
        class="is-materials is-panel"
        :class="{ 'is-swapped': swapped, 'mobile-hidden': mobileTab !== 'materials' }"
        aria-label="任务计划"
      >
        <header class="is-materials-header"
          ><div><span aria-hidden="true">▤</span><h2>任务计划</h2></div></header
        >
        <div class="is-document" tabindex="0" aria-label="任务计划，可滚动">
          <InspectionPlanEditor
            v-if="planDocument || (streaming && plan?.ready)"
            v-model="planDocument"
            :streaming="streaming && Boolean(plan?.ready)"
            :disabled="inputLocked || (readOnly && plan?.mode === 'continuous')"
          />
          <div v-else class="is-empty-materials"
            ><h2>先明确需求，<br />再一起确认计划。</h2
            ><p>{{
              clarification?.question ||
              '在对话中告诉我需要关注的人和事。对象、范围、时间和处理方式明确后，详细计划将在这里逐步呈现。'
            }}</p></div
          >
        </div>
        <div v-if="plan && (planDocument || streaming) && !saved" class="is-plan-confirmation">
          <p v-if="error" class="is-error" role="alert">{{ error }}</p>
          <p v-if="streaming" role="status">{{
            plan.ready
              ? '正在生成计划，完成后可编辑与确认。'
              : '正在整理需求，请稍候确认需要补充的条件。'
          }}</p>
          <template v-else>
            <p>{{
              documentDirty
                ? '计划已修改，请先重新核对；核对后再次确认才会执行。'
                : editingActiveTask && !revisionPrepared
                  ? '请先在对话中说明要修改的内容，核对后将重新生成计划。'
                  : '请核对计划。确认后进入任务详情查看进展。'
            }}</p>
            <button
              v-if="documentDirty"
              class="is-primary"
              type="button"
              :disabled="inputLocked"
              @click="reviewDocument"
              >核对计划修改</button
            >
            <button
              v-else
              class="is-primary"
              type="button"
              :disabled="!canConfirm"
              @click="confirm"
              >{{ busy ? '正在执行…' : '确认执行' }}</button
            >
            <small v-if="readOnly && plan.mode === 'continuous'"
              >当前角色仅可查询，不能创建持续监督。</small
            >
            <small
              v-if="
                focusedTask &&
                focusedTask.mode !== 'once' &&
                !focusedTask.completedAt &&
                plan.mode === 'once'
              "
              >本次只新增查询结果，不会停止或修改原有监督任务。</small
            >
          </template>
        </div>
      </section>
    </div>
  </section>
</template>
<style scoped lang="scss" src="./inspection-session.scss"></style>
