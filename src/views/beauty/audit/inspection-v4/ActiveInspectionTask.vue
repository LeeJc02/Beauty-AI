<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { checkDay, summarizeCase, type InspectionCase } from './model'
import { isArchived, type AgentEvent } from './taskFlow'
import { eventNarrative } from './eventNarrative'
import { planFor, policySummary, toolLabels } from './executionPlan'

const props = defineProps<{
  item: InspectionCase
  busy?: boolean
  readOnly?: boolean
  liveEvents?: AgentEvent[]
  replaying?: boolean
}>()
defineEmits<{ advance: []; pause: []; export: []; edit: [] }>()
const archived = computed(() => isArchived(props.item))
const supervising = computed(
  () =>
    !archived.value && props.item.authorized && ['watching', 'paused'].includes(props.item.phase)
)
const plan = computed(() => planFor(props.item))
const nextDay = computed(() => checkDay(props.item, props.item.round + 1))
const expired = computed(() => nextDay.value > props.item.endsOn)
const mode = computed(() => {
  if (props.busy) return '本轮执行中'
  if (props.replaying) return '最近一轮回放'
  if (archived.value) return '执行已结束 · 保留最近一轮'
  if (props.readOnly) return '只读查看 · 仅可回放'
  if (props.item.phase === 'paused') return '监督已暂停'
  return '已展示最近一次检查记录'
})
const nextExecution = computed(() =>
  archived.value
    ? '已停止'
    : !supervising.value
      ? '未安排'
      : expired.value
        ? '周期已到期'
        : `${nextDay.value} ${props.item.cadence.includes('17:00') ? '17:00' : '09:00'}${props.item.phase === 'paused' ? ' · 暂停' : ''}`
)
function results() {
  const receipts = props.item.receipts
  let index = -1
  for (let i = receipts.length - 1; i >= 0; i--) {
    if (receipts[i].kind === 'check') {
      index = i
      break
    }
  }
  const current = index < 0 ? [] : receipts.slice(index + 1)
  return {
    ...summarizeCase(props.item),
    round: props.item.round,
    checks: receipts.filter((receipt) => receipt.kind === 'check').length,
    scenario: props.item.scenario,
    at: index < 0 ? '尚未完成核查' : receipts[index].at,
    reminders: current.filter((r) => r.kind === 'reminder').length,
    escalations: current.filter((r) => r.kind === 'escalation').length,
    reports: current.filter((r) => r.kind === 'report').length
  }
}
// 执行期间冻结上轮统计，避免把逐步到达的工具结果误当成本轮结论。
const completed = ref(results())
watch(
  () => [props.item, props.busy],
  () => {
    if (!props.busy) completed.value = results()
  },
  { deep: true }
)
const fallbackEvents = computed(() => {
  const trace = props.item.trace ?? []
  const last = trace[trace.length - 1]
  if (last?.round !== undefined) return trace.filter((event) => event.round === last.round)
  // 旧事件没有轮次时仅保留最后一段结果，不重复展示全部历史。
  return trace.slice(-6)
})
const events = computed(() => props.liveEvents ?? fallbackEvents.value)
// 用确认后的结构化条件表达任务，避免把多轮补充文本或工具名拼成超长标题。
const scope = computed(() =>
  props.item.regions.length === 6
    ? '全部地区（6 个区域）'
    : props.item.regions.join('、') || props.item.region
)
const confirmedGoal = computed(() => {
  const goal =
    props.item.scenario === 'workload'
      ? '核查培训负担及缺失的工时依据'
      : props.item.scenario === 'overview'
        ? '检查培训完成情况，汇总需要关注的问题'
        : '核查员工课程完成情况及考核是否达标'
  return `对${scope.value}的${props.item.product}，${goal}。`
})
const stageName = computed(() => {
  if (!props.busy)
    return completed.value.at === '尚未完成核查' ? '等待首次检查结果' : '最近一次检查已完成'
  const name = events.value.at(-1)?.title || ''
  const stages: Record<string, string> = {
    'training_records.query': '正在读取培训与考核记录',
    'qualification.evaluate': '正在核对达标标准',
    'employee.remind': '正在整理员工提醒预览',
    'feishu.report': '正在整理飞书汇报预览',
    'feishu.escalate': '正在整理异常升级预览',
    'scheduler.finish': '正在结束到期任务',
    'report.compose · 简报就绪': '正在汇总本轮结果',
    'followup.preview · 复查结果': '正在汇总本轮结果'
  }
  return stages[name] || '正在分析本轮核查结果'
})
const notificationReport = computed(() => {
  const actions = [
    completed.value.reminders ? `${completed.value.reminders} 批员工提醒` : '',
    completed.value.reports ? `${completed.value.reports} 批飞书汇报` : '',
    completed.value.escalations ? `${completed.value.escalations} 批异常升级` : ''
  ].filter(Boolean)
  return actions.length ? `本轮整理了${actions.join('、')}预览。` : '本轮未生成提醒或飞书通知预览。'
})
const reportNextStep = computed(() => {
  if (!completed.value.checks) return '尚未完成检查，请先查看已有执行记录。'
  if (completed.value.scenario === 'workload')
    return '下一步需补齐工时与排班依据，当前不能判断工作负担。'
  if (completed.value.missing || completed.value.unqualified)
    return '下一步建议跟进未达标人员，并核实缺失记录；此页保留已有结果供查阅。'
  return '现有记录中人员均已达标，下一步可核对人员依据并归档结果。'
})
const terminalRound = computed(() => events.value.at(-1)?.round ?? props.item.round)
const tools = computed(() =>
  [...(props.item.trace ?? [])].filter((event) => event.kind === 'tool').reverse()
)
const eventLabels = { analysis: '检查依据', tool: '执行进展', result: '检查结果', waiting: '等待' }
const stream = ref<HTMLElement>()
const follow = ref(true)
const hasUpdates = ref(false)
function onScroll() {
  const el = stream.value
  if (!el) return
  follow.value = el.scrollHeight - el.scrollTop - el.clientHeight < 32
  if (follow.value) hasUpdates.value = false
}
function showLatest() {
  follow.value = true
  hasUpdates.value = false
  if (stream.value) stream.value.scrollTop = stream.value.scrollHeight
}
watch(
  () => events.value.map((event) => event.id).join('|'),
  async () => {
    const shouldFollow = follow.value
    await nextTick()
    if (shouldFollow) showLatest()
    else hasUpdates.value = true
  },
  { immediate: true }
)
watch(
  () => props.item.id,
  async () => {
    completed.value = results()
    await nextTick()
    showLatest()
  }
)
function roundLabel(round?: number) {
  return round === undefined ? '轮次未记录' : round === 0 ? '初次核查' : `第 ${round} 轮复查`
}
</script>

<template>
  <section class="iv-active-task" aria-label="任务连续执行过程" :aria-busy="busy">
    <section class="active-card overview-card" aria-label="当前执行摘要">
      <div class="card-scroll overview-scroll" tabindex="0" aria-label="任务概况，可滚动">
        <div class="task-metadata">
          <p class="section-caption">任务范围</p>
          <p class="confirmed-goal">{{ confirmedGoal }}</p>
          <dl class="task-facts">
            <div class="time-range"
              ><dt>覆盖时间</dt><dd>{{ item.startsOn }} <span>至</span> {{ item.endsOn }}</dd></div
            >
            <div
              ><dt>执行频率</dt><dd>{{ item.cadence }}</dd></div
            >
            <div
              ><dt>覆盖范围</dt><dd :title="item.regions.join('、')">{{ scope }}</dd></div
            >
            <div
              ><dt>下次审查 · Asia/Jakarta</dt><dd>{{ nextExecution }}</dd></div
            >
          </dl>
        </div>
        <div class="review-report">
          <div class="report-heading"><span class="section-caption">当前审查汇报</span></div>
          <p class="current-stage"
            ><i :class="{ running: busy || replaying }"></i>{{ stageName }}</p
          >
          <div class="stage-report">
            <p v-if="completed.checks"
              >已完成 {{ completed.checks }} 次检查，最近一次核查了
              <strong>{{ completed.total }} 人</strong>，其中 {{ completed.qualified }} 人达标、
              {{ completed.unqualified }} 人未达标，另有 {{ completed.missing }} 人记录待核实。
              {{ notificationReport }}{{ reportNextStep }}</p
            >
            <p v-else>{{ reportNextStep }}</p>
            <small class="report-updated"
              >{{ busy ? '上轮结果' : '最近完成' }} · {{ completed.at }}</small
            >
          </div>
          <details class="task-request"
            ><summary>查看交代原文与执行约定</summary><p>{{ item.question }}</p
            ><p>{{ policySummary(plan) }}</p></details
          >
        </div>
      </div>
    </section>

    <section class="active-card execution-card" aria-label="实时执行流">
      <header class="card-heading terminal-heading">
        <div class="terminal-identity"
          ><span class="terminal-symbol" aria-hidden="true">◎</span><h2>当前执行进展</h2></div
        >
        <button type="button" class="latest-button" @click="showLatest">{{
          hasUpdates ? '有新记录 · 回到最新' : '回到最新'
        }}</button>
      </header>
      <div
        ref="stream"
        class="card-scroll execution-stream"
        tabindex="0"
        aria-label="本轮执行记录，可滚动"
        @scroll="onScroll"
      >
        <div class="terminal-session"
          ><span>{{ item.product }} · {{ roundLabel(terminalRound) }}</span
          ><span>{{ replaying ? '回放最近检查' : busy ? '正在检查' : '最近检查记录' }}</span></div
        >
        <article
          v-for="(event, index) in events"
          :key="event.id"
          class="live-event"
          :class="{
            'tool-event': event.kind === 'tool',
            'analysis-event': event.kind === 'analysis',
            'result-event': event.kind === 'result'
          }"
        >
          <div class="event-meta"
            ><span>{{ String(index + 1).padStart(2, '0') }} · {{ eventLabels[event.kind] }}</span
            ><time>{{ event.at || '模拟时刻未记录' }}</time
            ><span>{{ roundLabel(event.round) }}</span></div
          >
          <h3
            ><span class="command-prefix" aria-hidden="true">{{
              event.kind === 'result' ? '✓' : '›'
            }}</span
            >{{ eventNarrative(event).title }}</h3
          >
          <p>{{ eventNarrative(event).detail }}</p>
        </article>
        <p v-if="!events.length" class="empty-state">{{
          busy || replaying ? '正在准备本轮模拟事件…' : '尚无本轮执行记录。'
        }}</p>
        <p class="stream-status" role="status"
          ><span class="terminal-prompt" aria-hidden="true">进展 · </span>{{ mode
          }}<span v-if="busy || replaying" class="terminal-cursor" aria-hidden="true"></span
        ></p>
      </div>
    </section>

    <section class="active-card history-card" aria-label="已完成事项历史">
      <header class="card-heading"
        ><h2
          >已完成事项 <span class="count">{{ tools.length }}</span></h2
        ><span class="local-label">最新在上 · 查看完成时间与结果</span></header
      >
      <div class="card-scroll history-scroll" tabindex="0" aria-label="已完成事项，可滚动">
        <details v-for="tool in tools" :key="tool.id" class="history-tool">
          <summary
            ><time>{{ tool.at || '时刻未记录' }}</time
            ><span>{{ roundLabel(tool.round) }}</span
            ><strong>{{ eventNarrative(tool).title }}</strong
            ><span class="tool-status">已完成</span></summary
          >
          <div class="history-content"
            ><p>{{ eventNarrative(tool).detail }}</p></div
          >
        </details>
        <p v-if="!tools.length" class="empty-state">尚无已完成事项。</p>
        <details class="supporting"
          ><summary>回执与人员依据</summary>
          <div class="history-content">
            <p
              >以下为固定训练样本的本地演示记录，不连接业务库或真实大模型，不与后台事件联动。通知仅为预览，未真实发送；本页只回放已有记录，不自动推进检查。</p
            >
            <p>{{ toolLabels(plan).join(' · ') }}</p
            ><p>{{ policySummary(plan) }}</p>
            <ul class="receipts"
              ><li v-for="receipt in [...item.receipts].reverse()" :key="receipt.id"
                ><time>{{ receipt.at }}</time> · {{ receipt.title }}<p>{{ receipt.detail }}</p></li
              ></ul
            >
            <p v-if="!item.receipts.length">尚无回执。</p>
            <ul class="people"
              ><li v-for="person in item.people" :key="person.id"
                >{{ person.name }} / {{ person.region }} / {{ person.store }} · 课程{{
                  person.course ? '已完成' : '未完成'
                }}
                · 成绩 {{ person.score ?? '缺失' }} ·
                {{
                  { qualified: '达标', unqualified: '未达标', missing: '数据缺失' }[person.status]
                }}
                · 提醒 {{ person.reminderCount }} 次 /
                {{ person.escalated ? '已生成升级预览' : '未升级' }}</li
              ></ul
            >
          </div>
        </details>
      </div>
    </section>
  </section>
</template>

<style scoped lang="scss" src="./active-task.scss"></style>
