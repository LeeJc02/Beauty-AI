<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { InspectionCase, Person, Receipt } from './model'
import { checkDay, summarizeCase } from './model'
import { isArchived } from './taskFlow'
import AgentTrace from './AgentTrace.vue'
import { planFor, policySummary } from './executionPlan'

const props = defineProps<{ item: InspectionCase; busy?: boolean; readOnly?: boolean }>()
const emit = defineEmits<{ back: []; advance: []; pause: []; export: [] }>()
const uid = useId()
const tabs = [
  { key: 'summary', label: '审计汇总' },
  { key: 'people', label: '人员明细' },
  { key: 'records', label: '执行记录' }
] as const
type Tab = (typeof tabs)[number]['key']
const tab = ref<Tab>('summary')
const filter = ref<'all' | 'unqualified' | 'missing'>('all')
const summary = computed(() => summarizeCase(props.item))
const archived = computed(() => isArchived(props.item))
const reportReady = computed(() =>
  ['reported', 'watching', 'paused', 'finished'].includes(props.item.phase)
)
const nextDay = computed(() => checkDay(props.item, props.item.round + 1))
const expired = computed(() => nextDay.value > props.item.endsOn)
const allQualified = computed(
  () => summary.value.total > 0 && summary.value.total === summary.value.qualified
)
const supervising = computed(
  () =>
    props.item.authorized && !archived.value && ['watching', 'paused'].includes(props.item.phase)
)
const canAdvance = computed(
  () => supervising.value && props.item.phase === 'watching' && !props.busy && !props.readOnly
)
const canPause = computed(() => supervising.value && !props.busy && !props.readOnly)
const canExport = computed(() => reportReady.value && !props.busy)
const phaseLabels: Record<InspectionCase['phase'], string> = {
  ready: '待执行',
  running: '初查进行中',
  reported: '报告已生成',
  watching: '监督中',
  paused: '已暂停',
  finished: '已结束',
  cancelled: '已取消'
}
const stateLabels: Record<Person['status'], string> = {
  qualified: '已达标',
  unqualified: '未达标',
  missing: '数据缺失'
}
const receiptLabels: Record<Receipt['kind'], string> = {
  authorization: '授权',
  check: '核查',
  reminder: '提醒预览',
  escalation: '升级预览',
  report: '汇报预览',
  paused: '暂停',
  resumed: '恢复',
  finished: '结束'
}
const stats = computed(() => [
  { label: '核查总人数', count: summary.value.total, key: 'total' },
  { label: '已达标', count: summary.value.qualified, key: 'qualified' },
  { label: '未达标', count: summary.value.unqualified, key: 'unqualified' },
  { label: '数据缺失', count: summary.value.missing, key: 'missing' }
])
const filters = computed(() => [
  { key: 'all' as const, label: '全部', count: summary.value.total },
  { key: 'unqualified' as const, label: '未达标', count: summary.value.unqualified },
  { key: 'missing' as const, label: '数据缺失', count: summary.value.missing }
])
const people = computed(() =>
  props.item.people.filter((p) => filter.value === 'all' || p.status === filter.value)
)
const reminderCount = computed(
  () => props.item.receipts.filter((r) => r.kind === 'reminder').length
)
const escalationCount = computed(
  () => props.item.receipts.filter((r) => r.kind === 'escalation').length
)
// 回执没有 round 字段：按复查回执划分连续批次，保留初查、授权以及所有状态变更。
const receiptGroups = computed(() => {
  const groups: Array<{ key: string; title: string; entries: Receipt[] }> = []
  for (const receipt of props.item.receipts) {
    if (!groups.length || receipt.kind === 'check') {
      const round = receipt.title.match(/第\s*(\d+)\s*轮/)
      groups.push({
        key: receipt.id,
        title: round ? `第 ${round[1]} 轮复查` : receipt.kind === 'check' ? '初次核查' : '任务记录',
        entries: []
      })
    }
    groups[groups.length - 1].entries.push(receipt)
  }
  return groups.reverse()
})
const nextExecution = computed(() => {
  if (archived.value || props.item.phase === 'cancelled') return '已停止，无后续执行'
  if (!props.item.authorized) return '未授权监督'
  if (expired.value) return '监督周期已到期，无后续复查'
  if (allQualified.value) return '全部达标，无需继续复查'
  if (props.item.phase === 'paused') return '已暂停，恢复后手动推进'
  if (!supervising.value) return '暂无复查安排'
  return `${nextDay.value} ${props.item.cadence.includes('17:00') ? '17:00' : '09:00'}（演示时钟）`
})
const conclusion = computed(() => {
  if (!reportReady.value)
    return props.item.phase === 'cancelled'
      ? '任务已取消，未生成审计报告。'
      : props.item.phase === 'running'
        ? '初查进行中，报告尚未生成；可查看执行记录。'
        : '等待初次核查，尚无完成结论；可查看执行记录。'
  if (!summary.value.total) return '当前没有人员记录，无法判断达标情况。'
  if (props.item.scenario === 'workload')
    return '已核对培训状态；工时与排班缺失，不能判断工作负荷。'
  if (allQualified.value) return '当前清单全部达标，无需继续提醒。'
  return `${summary.value.unqualified} 人未达标需跟进，${summary.value.missing} 人数据缺失需单独核实。`
})
async function selectTab(key: Tab, focus = false) {
  tab.value = key
  if (focus) {
    await nextTick()
    document.getElementById(`${uid}-tab-${key}`)?.focus()
  }
}
function navigateTabs(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const current = tabs.findIndex((t) => t.key === tab.value)
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  void selectTab(tabs[index].key, true)
}
watch(
  () => props.busy,
  (running) => {
    if (running) tab.value = 'records'
  }
)
watch(
  () => props.item.id,
  () => {
    tab.value = 'summary'
    filter.value = 'all'
  }
)
</script>

<template>
  <section class="iv-task-detail" aria-label="任务审计详情" :aria-busy="busy">
    <div class="detail-page">
      <header class="detail-header">
        <div class="heading-copy">
          <div class="eyebrow"
            >任务审计档案
            <span>{{ archived ? '已归档 · 只读' : phaseLabels[item.phase] }}</span></div
          >
          <h1>{{ item.title }}</h1>
          <p
            >建档 {{ item.createdAt }} · {{ item.round ? `已完成 ${item.round} 轮复查` : '初次核查'
            }}<template v-if="archived"> · 原状态：{{ phaseLabels[item.phase] }}</template></p
          >
        </div>
        <button
          type="button"
          class="primary-button"
          :disabled="!canExport"
          @click="canExport && emit('export')"
          >导出报告</button
        >
      </header>
      <p class="demo-notice"
        >本地演示 ·
        固定人员样本，未连接业务库、模型或后台调度；提醒与飞书升级均为预览，未发送真实消息。</p
      >
      <p v-if="!reportReady" class="status-note"
        >{{ conclusion }} 导出暂不可用，已产生的过程保留在执行记录中。</p
      >
      <dl class="metadata">
        <div
          ><dt>监督有效期</dt><dd>{{ item.startsOn }} 至 {{ item.endsOn }}</dd></div
        >
        <div
          ><dt>监督范围</dt><dd>{{ item.regions.join('、') || item.region }}</dd></div
        >
        <div
          ><dt>产品</dt><dd>{{ item.product }}</dd></div
        >
        <div
          ><dt>执行频率</dt
          ><dd>{{
            item.authorized || item.queryMode === 'scheduled' ? item.cadence : '单次查询'
          }}</dd></div
        >
        <div class="next-execution"
          ><dt>下次执行</dt><dd>{{ nextExecution }}</dd></div
        >
      </dl>
      <div class="stats" aria-label="人员审计统计">
        <div v-for="stat in stats" :key="stat.key" :class="['stat', stat.key]">
          <span>{{ stat.label }}</span
          ><strong>{{ reportReady ? stat.count : '—' }}<small v-if="reportReady">人</small></strong>
        </div>
      </div>
      <nav class="tabs" role="tablist" aria-label="审计详情分类" @keydown="navigateTabs">
        <button
          v-for="entry in tabs"
          :id="`${uid}-tab-${entry.key}`"
          :key="entry.key"
          type="button"
          role="tab"
          :aria-selected="tab === entry.key"
          :aria-controls="`${uid}-panel-${entry.key}`"
          :tabindex="tab === entry.key ? 0 : -1"
          @click="selectTab(entry.key)"
          >{{ entry.label }}</button
        >
      </nav>
      <section
        v-for="entry in tabs"
        v-show="tab === entry.key"
        :id="`${uid}-panel-${entry.key}`"
        :key="entry.key"
        class="tab-panel"
        role="tabpanel"
        :aria-labelledby="`${uid}-tab-${entry.key}`"
        tabindex="0"
      >
        <template v-if="entry.key === 'summary'">
          <article class="conclusion"
            ><span class="section-label"
              >审计结论 · {{ item.round ? `第 ${item.round} 轮` : '初查' }}</span
            ><h2>{{ conclusion }}</h2
            ><p>核查目标：{{ item.question }}</p
            ><p v-if="reportReady"
              >当前清单 {{ summary.total }} 人，已达标
              {{ summary.qualified }} 人。三类状态互斥，人员筛选不改变统计分母。</p
            ></article
          >
          <div class="summary-grid">
            <section class="summary-section"
              ><h3>判断口径与数据边界</h3
              ><p>课程完成且考试成绩 ≥ 80 分为达标；证据完整但未满足条件为未达标。</p
              ><p
                ><strong>数据缺失不等于未达标。</strong
                >成绩缺失单列，先补齐记录，不新增提醒或升级。</p
              ><p
                >所有地区和场景共用培训示例；不包含真实经营、任务工时与排班，不能据此推断经营表现、人员负荷或门店排名。</p
              ></section
            >
            <section class="summary-section"
              ><h3>监督授权与通知预览</h3
              ><div class="notification-counts"
                ><span
                  >提醒预览 <strong>{{ reminderCount }}</strong> 次</span
                ><span
                  >升级预览 <strong>{{ escalationCount }}</strong> 次</span
                ></div
              ><p class="small-note"
                >按回执批次累计，非人数或真实发送量；单人当前提醒次数见人员明细。</p
              ><dl class="rules"
                ><div
                  ><dt>授权状态</dt
                  ><dd>{{ item.authorized ? '已授权本地模拟' : '未授权，不自动跟进' }}</dd></div
                ><div
                  ><dt>提醒对象</dt><dd>{{ item.recipient }}</dd></div
                ><div
                  ><dt>升级接收人</dt
                  ><dd>{{ item.escalationRecipient || '我（计划创建人）' }}</dd></div
                ></dl
              ><p>{{ policySummary(planFor(item)) }}</p></section
            >
          </div>
          <section v-if="supervising" class="execution-control" aria-label="监督演示控制"
            ><div
              ><h3>{{
                item.phase === 'paused'
                  ? '监督已暂停'
                  : busy
                    ? '正在执行本地复查'
                    : '等待下一次复查'
              }}</h3
              ><p>{{
                readOnly
                  ? '当前只读，不允许推进或更改监督状态。'
                  : '仅手动推进演示时钟，不会自动发送提醒。'
              }}</p></div
            ><div class="control-buttons"
              ><button type="button" :disabled="!canPause" @click="canPause && emit('pause')">{{
                item.phase === 'paused' ? '恢复监督' : '暂停监督'
              }}</button
              ><button
                type="button"
                class="primary-button"
                :disabled="!canAdvance"
                @click="canAdvance && emit('advance')"
                >{{ busy ? '演示复查中…' : expired ? '结束到期监督' : '演示下一次复查' }}</button
              ></div
            ></section
          >
          <p v-else class="status-note">{{
            archived ? '归档材料仅供查看与导出，不再运行或编辑。' : nextExecution
          }}</p>
        </template>
        <template v-else-if="entry.key === 'people'">
          <div class="panel-heading"
            ><div><h2>人员明细</h2><p>培训证据与单人跟进状态 · 本地样本</p></div
            ><div v-if="reportReady" class="filters" role="group" aria-label="人员状态筛选"
              ><button
                v-for="option in filters"
                :key="option.key"
                type="button"
                :aria-pressed="filter === option.key"
                @click="filter = option.key"
                >{{ option.label }} {{ option.count }}</button
              ></div
            ></div
          >
          <template v-if="reportReady"
            ><p class="small-note" aria-live="polite"
              >显示 {{ people.length }} / {{ summary.total }} 人；缺失人员不计入未达标。</p
            ><div
              class="table-scroll"
              role="region"
              aria-label="人员明细表，可横向滚动"
              tabindex="0"
              ><table
                ><caption>当前轮次人员核查清单（示例）</caption
                ><thead
                  ><tr
                    ><th scope="col">姓名</th><th scope="col">地区</th><th scope="col">门店</th
                    ><th scope="col">课程完成</th><th scope="col">考核成绩</th
                    ><th scope="col">审计状态</th><th scope="col">当前提醒</th
                    ><th scope="col">升级状态</th></tr
                  ></thead
                ><tbody
                  ><tr v-for="person in people" :key="person.id"
                    ><th scope="row">{{ person.name }}</th
                    ><td>{{ person.region }}</td
                    ><td>{{ person.store }}</td
                    ><td>{{ person.course ? '已完成' : '未完成' }}</td
                    ><td>{{ person.score === null ? '缺失' : `${person.score} 分` }}</td
                    ><td
                      ><span :class="['person-state', person.status]">{{
                        stateLabels[person.status]
                      }}</span></td
                    ><td>{{ person.reminderCount }} / 3 次</td
                    ><td>{{ person.escalated ? '已生成预览 · 未发送' : '未升级' }}</td></tr
                  ><tr v-if="!people.length"
                    ><td colspan="8" class="empty">当前筛选下没有人员记录。</td></tr
                  ></tbody
                ></table
              ></div
            ></template
          >
          <p v-else class="empty">未生成报告，不展示最终人员判断；可查看执行记录中的已读取材料。</p>
        </template>
        <template v-else>
          <div class="panel-heading"
            ><div
              ><h2>执行记录</h2><p>保留工具输入输出、初查及全部监督回执；以下均为本地模拟。</p></div
            ><span class="section-label">共 {{ item.receipts.length }} 条回执</span></div
          >
          <AgentTrace
            v-if="item.trace?.length"
            :events="item.trace"
            :running="Boolean(busy && supervising && item.phase === 'watching' && !readOnly)"
          />
          <p v-else class="status-note">尚无 Agent 执行轨迹；已有回执完整保留如下。</p>
          <div v-if="receiptGroups.length" class="receipt-groups"
            ><details
              v-for="(group, index) in receiptGroups"
              :key="`${item.id}-${group.key}`"
              :open="index === 0"
              ><summary
                ><strong>{{ group.title }}</strong
                ><span>{{ group.entries.length }} 条回执 · {{ group.entries[0].at }}</span></summary
              ><ol
                ><li v-for="receipt in group.entries" :key="receipt.id"
                  ><div class="receipt-meta"
                    ><span>{{ receiptLabels[receipt.kind] }}</span
                    ><time>{{ receipt.at }}</time></div
                  ><h3>{{ receipt.title }}</h3
                  ><p>{{ receipt.detail }}</p></li
                ></ol
              ></details
            ></div
          ><p v-else class="empty">尚未产生执行回执。</p>
        </template>
      </section>
      <footer class="page-footer"
        >审计材料仅覆盖当前清单与所选周期 · 不作为真实人员考核或消息发送凭据</footer
      >
    </div>
  </section>
</template>

<style scoped lang="scss">
.iv-task-detail {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  color: var(--iv-ink);
  background: var(--iv-surface);
  font-size: 13px;
  line-height: 1.7;
}
.detail-page {
  max-width: 1440px;
  min-width: 0;
  margin: 0 auto;
  padding: 32px 40px 24px;
}
.detail-page * {
  box-sizing: border-box;
}
h1,
h2,
h3,
p,
dl,
dd {
  margin: 0;
}
h1 {
  font-size: clamp(22px, 2.3vw, 30px);
  line-height: 1.4;
  font-weight: 650;
  margin: 10px 0 8px;
}
h2 {
  font-size: 21px;
  line-height: 1.6;
}
h3 {
  font-size: 14px;
  font-weight: 650;
}
p {
  color: var(--iv-muted);
  overflow-wrap: anywhere;
}
strong {
  color: var(--iv-ink);
}
button {
  border: 1px solid var(--iv-line);
  background: var(--iv-surface);
  color: var(--iv-ink);
  border-radius: 7px;
  padding: 9px 14px;
  font: inherit;
  cursor: pointer;
  min-height: 40px;
}
button:hover:not(:disabled) {
  background: var(--iv-soft);
  border-color: var(--iv-accent);
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
button.primary-button {
  background: var(--iv-accent);
  color: var(--iv-on-accent);
  border-color: var(--iv-accent);
}
button.primary-button:hover:not(:disabled) {
  background: var(--iv-accent);
  filter: brightness(0.94);
}
:where(button, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--iv-accent);
  outline-offset: 3px;
}
.detail-header,
.panel-heading,
.execution-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.heading-copy {
  min-width: 0;
  overflow-wrap: anywhere;
}
.detail-header > button {
  flex-shrink: 0;
}
.eyebrow,
.section-label {
  font-size: 12px;
  color: var(--iv-accent);
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.eyebrow span {
  color: var(--iv-muted);
  padding-left: 12px;
  border-left: 1px solid var(--iv-line);
}
.demo-notice {
  background: var(--iv-soft);
  border-left: 3px solid var(--iv-accent);
  padding: 10px 14px;
  margin-top: 22px;
  font-size: 12px;
}
.metadata {
  display: grid;
  grid-template-columns: 1.4fr 1fr 0.65fr 0.8fr 1.4fr;
  gap: 18px;
  padding: 23px 0;
}
.metadata > div {
  min-width: 0;
}
dt {
  font-size: 12px;
  color: var(--iv-muted);
}
dd {
  margin-top: 5px;
  overflow-wrap: anywhere;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-block: 1px solid var(--iv-line);
  padding: 22px 0;
}
.stat {
  padding: 0 24px;
  border-left: 1px solid var(--iv-line);
}
.stat:first-child {
  padding-left: 0;
  border-left: 0;
}
.stat > span {
  color: var(--iv-muted);
  font-size: 12px;
}
.stat > strong {
  display: block;
  font-size: 34px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  margin-top: 8px;
  font-weight: 550;
}
.stat small {
  font-size: 12px;
  color: var(--iv-muted);
  margin-left: 8px;
  font-weight: 400;
}
.unqualified > strong {
  color: var(--iv-accent);
}
.tabs {
  display: flex;
  gap: 28px;
  border-bottom: 1px solid var(--iv-line);
  margin-top: 18px;
}
.tabs button {
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  padding: 15px 0;
}
.tabs button[aria-selected='true'] {
  border-bottom-color: var(--iv-accent);
  color: var(--iv-accent);
  font-weight: 650;
}
.tab-panel {
  min-width: 0;
  padding: 26px 0;
}
.conclusion {
  max-width: 960px;
}
.conclusion h2 {
  margin: 9px 0 12px;
}
.conclusion p + p {
  margin-top: 6px;
}
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 40px;
  margin-top: 28px;
}
.summary-section {
  min-width: 0;
  border-top: 1px solid var(--iv-line);
  padding-top: 20px;
}
.summary-section p {
  margin-top: 10px;
}
.notification-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 12px;
}
.notification-counts strong {
  color: var(--iv-accent);
  font-size: 22px;
  padding: 0 5px;
}
.small-note {
  font-size: 12px;
  margin: 12px 0;
}
.rules {
  display: grid;
  gap: 8px;
  margin: 15px 0;
}
.rules > div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
}
.rules dd {
  margin: 0;
}
.execution-control {
  padding: 20px;
  background: var(--iv-soft);
  border: 1px solid var(--iv-line);
  border-radius: 9px;
  margin-top: 26px;
}
.control-buttons {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
.status-note {
  padding: 12px 0;
  font-size: 12px;
}
.panel-heading {
  margin-bottom: 20px;
}
.panel-heading h2 {
  font-size: 18px;
}
.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.filters button {
  font-size: 12px;
}
.filters button[aria-pressed='true'] {
  color: var(--iv-accent);
  border-color: var(--iv-accent);
  background: var(--iv-soft);
}
.table-scroll {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--iv-line);
  border-radius: 8px;
}
table {
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;
  text-align: left;
  font-size: 12px;
}
caption {
  text-align: left;
  padding: 10px 14px;
  color: var(--iv-muted);
}
th,
td {
  padding: 13px 14px;
  border-top: 1px solid var(--iv-line);
}
thead th {
  background: var(--iv-soft);
  color: var(--iv-muted);
  font-weight: 500;
}
tbody th {
  font-weight: 600;
}
tbody tr:hover {
  background: var(--iv-soft);
}
.person-state {
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--iv-soft);
  white-space: nowrap;
}
.person-state.unqualified {
  color: var(--iv-accent);
  font-weight: 600;
}
.person-state.missing {
  color: var(--iv-muted);
  border: 1px dashed var(--iv-line);
}
.empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--iv-muted);
}
.receipt-groups {
  display: grid;
  gap: 12px;
}
.receipt-groups details {
  border: 1px solid var(--iv-line);
  border-radius: 8px;
  overflow: hidden;
}
.receipt-groups summary {
  cursor: pointer;
  padding: 15px 18px;
  background: var(--iv-soft);
  overflow-wrap: anywhere;
}
.receipt-groups summary > span {
  color: var(--iv-muted);
  font-size: 12px;
  margin-left: 18px;
}
.receipt-groups ol {
  margin: 0;
  padding: 0 22px;
  list-style: none;
}
.receipt-groups li {
  padding: 18px 0;
}
.receipt-groups li + li {
  border-top: 1px solid var(--iv-line);
}
.receipt-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: var(--iv-muted);
  font-size: 11px;
  margin-bottom: 5px;
}
.receipt-meta > span {
  color: var(--iv-accent);
}
.receipt-groups li p {
  white-space: pre-wrap;
  margin-top: 7px;
}
.page-footer {
  border-top: 1px solid var(--iv-line);
  color: var(--iv-muted);
  font-size: 11px;
  padding-top: 16px;
}
@media (max-width: 1000px) {
  .detail-page {
    padding: 24px;
  }
  .metadata {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .next-execution {
    grid-column: span 2;
  }
  .summary-grid {
    gap: 24px;
  }
  .execution-control,
  .panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 600px) {
  .detail-page {
    padding: 18px 16px;
  }
  .detail-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .metadata {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 0;
  }
  .stat {
    padding: 0 16px;
  }
  .stat:nth-child(3) {
    border: 0;
    padding-left: 0;
  }
  .stat > strong {
    font-size: 29px;
  }
  .tabs {
    gap: 22px;
  }
  .summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .control-buttons {
    flex-wrap: wrap;
    flex-shrink: 1;
  }
  .receipt-groups summary > span {
    display: block;
    margin-left: 0;
    margin-top: 4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
</style>
