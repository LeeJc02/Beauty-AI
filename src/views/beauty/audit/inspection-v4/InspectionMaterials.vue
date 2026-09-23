<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { InspectionCase, MaterialTab } from './model'
import { checkDay, summarizeCase } from './model'
import AgentTrace from './AgentTrace.vue'
import { planFor, policySummary } from './executionPlan'

const props = defineProps<{
  item: InspectionCase | null
  stage: number
  tab: MaterialTab
  executing?: boolean
}>()
const emit = defineEmits<{ (event: 'update:tab', value: MaterialTab): void }>()
const uid = useId()
const filter = ref<'all' | 'unqualified' | 'missing'>('all')
const scopeOpen = ref(false)
const tabs: { key: MaterialTab; label: string }[] = [
  { key: 'report', label: '巡检简报' },
  { key: 'evidence', label: '人员明细' },
  { key: 'process', label: '核查过程' },
  { key: 'receipts', label: '执行回执' }
]
const steps = [
  { title: '理解目标', detail: '整理本次目标、范围与统计周期。' },
  { title: '读取示例', detail: '载入前端内置人员清单，不连接业务库。' },
  { title: '规则校验', detail: '按示例规则核对课程、考核与缺失信息。' },
  { title: '结论复核', detail: '核对统计分母，区分未达标与待核实。' },
  { title: '生成简报', detail: '将示例结果整理为可阅读的工作材料。' }
]
const stageIndex = computed(() => Math.max(0, Math.min(4, Math.floor(props.stage || 0))))
const finalReady = computed(() =>
  Boolean(props.item && ['reported', 'watching', 'paused', 'finished'].includes(props.item.phase))
)
const cancelled = computed(() => props.item?.phase === 'cancelled')
const evidenceReady = computed(() =>
  Boolean(
    props.item && (finalReady.value || (props.item.phase !== 'ready' && stageIndex.value >= 2))
  )
)
const rulesReady = computed(
  () => evidenceReady.value && (finalReady.value || stageIndex.value >= 3)
)
const summary = computed(() =>
  props.item ? summarizeCase(props.item) : { total: 0, qualified: 0, unqualified: 0, missing: 0 }
)
const stores = computed(() => new Set(props.item?.people.map((person) => person.store)).size)
const people = computed(() =>
  (props.item?.people ?? []).filter(
    (person) => filter.value === 'all' || person.status === filter.value
  )
)
const segments = computed(() => [
  { key: 'qualified', label: '已达标', count: summary.value.qualified },
  { key: 'unqualified', label: '未达标', count: summary.value.unqualified },
  { key: 'missing', label: '待核实', count: summary.value.missing }
])
const filters = computed(() => [
  { key: 'all' as const, label: '全部', count: summary.value.total },
  { key: 'unqualified' as const, label: '未达标', count: summary.value.unqualified },
  { key: 'missing' as const, label: '待核实', count: summary.value.missing }
])
const receipts = computed(() =>
  finalReady.value &&
  props.item &&
  (props.item.authorized || props.item.receipts.some((receipt) => receipt.kind === 'report'))
    ? [...props.item.receipts].reverse()
    : []
)
const materialCount = computed(() =>
  props.item
    ? 1 + Number(evidenceReady.value) + Number(finalReady.value) + Number(receipts.value.length > 0)
    : 0
)
const conclusion = computed(() => {
  const { total, qualified, unqualified, missing } = summary.value
  if (!total) return '当前没有人员记录，暂不能判断达标情况。'
  if (props.item?.scenario === 'workload')
    return '人员覆盖已梳理；缺少任务工时，暂不能判断工作负荷。'
  if (props.item?.scenario === 'overview')
    return `${stores.value} 家门店的人员情况已汇总，${unqualified + missing} 人需要进一步跟进。`
  return unqualified || missing
    ? `${total} 人中，${unqualified} 人未达标，${missing} 人待核实。`
    : `${qualified} 人已达标，本次示例未发现未达标或待核实人员。`
})
const narrative = computed(() => {
  const { total, qualified, unqualified, missing } = summary.value
  if (props.item?.scenario === 'workload')
    return [
      {
        title: '现状',
        text: `本次清单覆盖 ${stores.value} 家门店、${total} 人。人员培训状态为已达标 ${qualified} 人、未达标 ${unqualified} 人、待核实 ${missing} 人；这些数字不是工时或任务量。`
      },
      {
        title: '需要关注',
        text: '当前示例不含排班、任务耗时和可用工时，不能据此推断超负荷、闲置或人员缺口。培训未达标也不等于工作负荷过高。'
      },
      {
        title: '建议',
        text: '先补齐同一周期的任务、工时与排班，再按门店和岗位比较负荷。现阶段仅将人员明细作为后续核查的范围清单。'
      }
    ]
  if (props.item?.scenario === 'overview')
    return [
      {
        title: '现状',
        text: `本次综合巡检覆盖 ${stores.value} 家门店的 ${total} 人：${qualified} 人已达标，${unqualified} 人未达标，${missing} 人待核实。课程与考核使用同一份人员清单，避免重复统计。`
      },
      {
        title: '需要关注',
        text: `优先跟进 ${unqualified} 人的培训差距，并核实 ${missing} 人的缺失记录。当前示例不包含工时与排班，不能判断培训负担是否合理。`
      },
      {
        title: '建议',
        text: '先让负责人跟进培训未达标人员，并持续复查达标情况；缺失记录单独核实。不修改原任务，也不直接用培训结果给门店排名。'
      }
    ]
  return [
    {
      title: '现状',
      text: `在本次范围内，${total} 人中已有 ${qualified} 人达标。课程完成情况和考核记录按同一人员清单核查，不重复计数。`
    },
    {
      title: '需要关注',
      text: `${unqualified} 人存在明确的未达标项，另有 ${missing} 人因记录不足需要核实。数据不足不等于未达标，两类人员分别统计、分别跟进。`
    },
    {
      title: '建议',
      text: '对明确未达标人员安排针对性补学与复核；对待核实人员先确认课程或考核记录，再决定是否补学，避免把数据缺口当作能力问题。'
    }
  ]
})
const progressTitle = computed(() =>
  cancelled.value
    ? '本次巡检已取消'
    : props.item?.phase === 'ready'
      ? '目标已收好，等待开始核查'
      : `${steps[stageIndex.value].title}中`
)
const stateLabels: Record<string, string> = {
  qualified: '已达标',
  unqualified: '未达标',
  missing: '待核实'
}
const receiptLabels: Record<string, string> = {
  authorize: '授权记录',
  authorization: '授权记录',
  paused: '暂停记录',
  resumed: '恢复记录',
  check: '巡检记录',
  reminder: '提醒模拟',
  escalation: '升级模拟',
  report: '飞书汇报预览',
  finished: '结束记录'
}
function stepState(index: number) {
  if (finalReady.value) return 'done'
  if (props.item?.phase === 'ready') return 'pending'
  if (index < stageIndex.value) return 'done'
  return index === stageIndex.value ? (cancelled.value ? 'stopped' : 'active') : 'pending'
}
function stepLabel(index: number) {
  return {
    done: '已整理',
    active: '进行中',
    stopped: '已中止',
    pending: cancelled.value ? '未执行' : '待处理'
  }[stepState(index)]
}
async function selectTab(tab: MaterialTab, focus = false) {
  emit('update:tab', tab)
  if (focus) {
    await nextTick()
    document.getElementById(`${uid}-tab-${tab}`)?.focus()
  }
}
function navigateTabs(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const current = tabs.findIndex((tab) => tab.key === props.tab)
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  void selectTab(tabs[index].key, true)
}
watch(
  () => props.item?.id,
  () => {
    filter.value = 'all'
    scopeOpen.value = false
  }
)
</script>

<template>
  <section class="iv-materials" aria-label="工作材料">
    <header class="iv-materials-header">
      <div class="iv-materials-heading"><h2>工作材料</h2><span>随工作自动整理</span></div>
      <span class="iv-materials-count">{{ materialCount }} 份材料</span>
    </header>

    <div v-if="!item" class="iv-materials-empty">
      <div class="iv-paper-stack" aria-hidden="true"
        ><div class="iv-paper-back"></div
        ><div class="iv-paper-front"
          ><span class="iv-paper-tag">巡检材料</span><i></i><i></i><i></i
          ><div class="iv-paper-seal">核</div></div
        ></div
      >
      <h3>你交代目标，我把依据备齐</h3>
      <p class="iv-empty-intro">每个判断有来处，每次跟进有记录。</p>
      <dl class="iv-empty-list">
        <div><dt>巡检简报</dt><dd>先说结论，再讲关注点与建议</dd></div>
        <div><dt>原始清单</dt><dd>保留人员明细，随时核对依据</dd></div>
        <div><dt>执行记录</dt><dd>逐次留存过程与本地模拟回执</dd></div>
      </dl>
    </div>

    <template v-else>
      <nav class="iv-materials-tabs" role="tablist" aria-label="材料分类" @keydown="navigateTabs">
        <button
          v-for="entry in tabs"
          :id="`${uid}-tab-${entry.key}`"
          :key="entry.key"
          type="button"
          role="tab"
          :aria-selected="tab === entry.key"
          :aria-controls="`${uid}-panel-${entry.key}`"
          :tabindex="tab === entry.key ? 0 : -1"
          :class="{ 'iv-is-selected': tab === entry.key }"
          @click="selectTab(entry.key)"
          >{{ entry.label
          }}<span v-if="entry.key === 'receipts' && receipts.length" class="iv-tab-count">{{
            receipts.length
          }}</span></button
        >
      </nav>
      <div class="iv-materials-body">
        <section
          v-for="entry in tabs"
          v-show="tab === entry.key"
          :id="`${uid}-panel-${entry.key}`"
          :key="entry.key"
          role="tabpanel"
          :aria-labelledby="`${uid}-tab-${entry.key}`"
          tabindex="0"
          class="iv-material-panel"
        >
          <template v-if="entry.key === 'report'">
            <article v-if="finalReady" class="iv-report-paper">
              <div class="iv-report-kicker"
                ><span>巡检简报 · 第 {{ item.round }} 轮</span
                ><span class="iv-demo-label">示例数据</span></div
              >
              <h3 class="iv-report-title">{{ conclusion }}</h3>
              <div class="iv-report-meta"
                ><span>{{ item.region }} · {{ item.product }}</span
                ><span>{{ item.period }}</span
                ><span>建档 {{ item.createdAt }}</span></div
              >
              <div class="iv-report-summary" aria-label="人员状态统计">
                <div class="iv-summary-caption"
                  ><span>人员核查结果</span><strong>共 {{ summary.total }} 人</strong></div
                >
                <div class="iv-summary-bar" aria-hidden="true"
                  ><span
                    v-for="segment in segments"
                    :key="segment.key"
                    :class="`iv-segment-${segment.key}`"
                    :style="{
                      width: `${summary.total ? (segment.count / summary.total) * 100 : 0}%`
                    }"
                  ></span
                ></div>
                <div class="iv-summary-legend"
                  ><span v-for="segment in segments" :key="segment.key"
                    ><i :class="`iv-segment-${segment.key}`"></i>{{ segment.label }}
                    <strong>{{ segment.count }}</strong></span
                  ></div
                >
              </div>
              <div class="iv-report-paragraphs"
                ><section v-for="section in narrative" :key="section.title"
                  ><h4>{{ section.title }}</h4
                  ><p>{{ section.text }}</p></section
                ></div
              >
              <button type="button" class="iv-evidence-link" @click="selectTab('evidence', true)"
                ><span>依据 · 人员原始清单</span
                ><span>{{ summary.total }} 人 <span aria-hidden="true">↗</span></span></button
              >
              <div class="iv-scope"
                ><button
                  type="button"
                  :aria-expanded="scopeOpen"
                  :aria-controls="`${uid}-scope`"
                  @click="scopeOpen = !scopeOpen"
                  ><span>统计口径与材料边界</span
                  ><span aria-hidden="true">{{ scopeOpen ? '−' : '+' }}</span></button
                ><div v-if="scopeOpen" :id="`${uid}-scope`" class="iv-scope-content"
                  ><p
                    >分母为本次人员清单的
                    {{ summary.total }}
                    人。已达标、未达标、待核实互斥，以示例清单的状态字段为准；筛选不改变统计分母。</p
                  ><p
                    >示例规则：课程完成且考核成绩 ≥ 80
                    分为达标；证据完整但未满足条件为未达标；成绩缺失单列为待核实，不触发提醒或升级。数据不足不等于未达标，不从缺失值推断培训效果、经营表现或实际工时。</p
                  ><p>本页为前端演示材料，未调用真实模型/业务库，不作为实际考核依据。</p></div
                ></div
              >
              <footer class="iv-report-footnote">本地示例 · 结论仅覆盖当前清单与周期</footer>
            </article>
            <div v-else class="iv-material-progress" aria-live="polite">
              <span class="iv-document-mark" aria-hidden="true">简报</span
              ><h3>{{ progressTitle }}</h3>
              <p>{{
                cancelled
                  ? '保留已经产生的过程材料，不生成完成结论。'
                  : '先核对依据，再形成判断。核查结束前不展示最终结论。'
              }}</p>
              <ol class="iv-progress-list"
                ><li
                  v-for="(step, index) in steps"
                  :key="step.title"
                  :class="`iv-step-${stepState(index)}`"
                  ><span>{{ step.title }}</span
                  ><span>{{ stepLabel(index) }}</span></li
                ></ol
              >
              <button type="button" class="iv-text-button" @click="selectTab('process', true)"
                >查看当前核查过程 <span aria-hidden="true">→</span></button
              >
            </div>
          </template>

          <template v-else-if="entry.key === 'evidence'">
            <div class="iv-panel-heading"
              ><div
                ><h3>人员原始清单</h3
                ><p
                  >{{ item.region }} · {{ item.product }} ·
                  {{ item.period }}；同一份清单，同一个统计分母。</p
                ></div
              ><span class="iv-demo-label">前端示例</span></div
            >
            <template v-if="evidenceReady">
              <div class="iv-evidence-filters" role="group" aria-label="按人员状态筛选"
                ><button
                  v-for="option in filters"
                  :key="option.key"
                  type="button"
                  :aria-pressed="filter === option.key"
                  :class="{ 'iv-is-selected': filter === option.key }"
                  @click="filter = option.key"
                  >{{ option.label }} <span>{{ option.count }}</span></button
                ></div
              >
              <p class="iv-table-note" aria-live="polite"
                >显示 {{ people.length }} / {{ summary.total }} 人<span v-if="!finalReady">
                  ·
                  {{
                    cancelled ? '已取消，保留已读取的示例' : '已读取示例，最终结论尚未生成'
                  }}</span
                ></p
              >
              <div
                class="iv-table-scroll"
                role="region"
                aria-label="人员明细表，可横向滚动"
                tabindex="0"
                ><table class="iv-evidence-table"
                  ><caption class="iv-sr-only"
                    >{{ item.region }}，{{ item.period }}，人员清单；共
                    {{ summary.total }} 人，当前显示 {{ people.length }} 人</caption
                  ><thead
                    ><tr
                      ><th scope="col">姓名</th><th scope="col">地区</th><th scope="col">门店</th
                      ><th scope="col">课程</th><th scope="col">考核</th><th scope="col">状态</th
                      ><th scope="col">提醒 / 升级</th></tr
                    ></thead
                  ><tbody
                    ><tr v-for="person in people" :key="person.id"
                      ><th scope="row">{{ person.name }}</th
                      ><td>{{ person.store }}</td
                      ><td>{{ person.course ? '已完成' : '未完成' }}</td
                      ><td>{{ person.score === null ? '暂无记录' : `${person.score} 分` }}</td
                      ><td
                        ><span class="iv-person-status" :class="`iv-status-${person.status}`">{{
                          stateLabels[person.status]
                        }}</span></td
                      ><td
                        >{{ person.reminderCount ?? 0 }}/3 ·
                        {{ person.escalated ? '已生成飞书预览' : '未升级' }}</td
                      ></tr
                    ><tr v-if="!people.length"
                      ><td colspan="7" class="iv-table-empty">当前筛选下没有人员记录</td></tr
                    ></tbody
                  ></table
                ></div
              >
              <p class="iv-material-note"
                >待核实表示数据不足，不等于未达标。此处为内置示例清单，未读取真实人员信息。</p
              >
            </template>
            <div v-else class="iv-inline-empty"
              ><h4>{{ cancelled ? '取消前尚未读取人员清单' : '人员清单尚未产生' }}</h4
              ><p>{{
                cancelled ? '本次不再继续读取。' : '完成“读取示例”后，完整人员明细会出现在这里。'
              }}</p></div
            >
          </template>

          <template v-else-if="entry.key === 'process'">
            <div class="iv-panel-heading"
              ><div
                ><h3>本次是怎样核查的</h3><p>展示本地演示的实际阶段，不虚构模型思考。</p></div
              ></div
            >
            <div class="iv-demo-notice">本地演示 · 未调用真实模型/业务库</div>
            <AgentTrace
              v-if="item.trace?.length"
              :events="item.trace"
              :running="executing"
              :waiting="
                item.phase === 'watching' && !executing
                  ? `下一次复查：${checkDay(item, item.round + 1)} · ${item.cadence}（演示时钟），等待手动推进。`
                  : undefined
              "
            />
            <ol v-else class="iv-process-timeline"
              ><li
                v-for="(step, index) in steps"
                :key="step.title"
                :class="`iv-step-${stepState(index)}`"
                ><span class="iv-step-number" aria-hidden="true">{{ index + 1 }}</span
                ><div class="iv-step-copy"
                  ><div class="iv-step-heading"
                    ><h4>{{ step.title }}</h4
                    ><span>{{ stepLabel(index) }}</span></div
                  ><p>{{ step.detail }}</p
                  ><div v-if="stepState(index) === 'done'" class="iv-step-artifact"
                    ><template v-if="index === 0"
                      >目标：{{ item.question }}<br />范围：{{ item.region }} ·
                      {{ item.period }}</template
                    ><template v-else-if="index === 1"
                      >已读取 {{ summary.total }} 条人员示例，覆盖 {{ stores }} 家门店。</template
                    ><template v-else-if="index === 2"
                      >中间校验清单：已达标 {{ summary.qualified }} 人 / 未达标
                      {{ summary.unqualified }} 人 / 待核实 {{ summary.missing }} 人。{{
                        !finalReady ? '仅为阶段材料，尚非最终结论。' : ''
                      }}</template
                    ><template v-else-if="index === 3"
                      >已复核 {{ summary.total }} 人的统计分母；缺失数据不并入未达标。{{
                        !finalReady ? '简报尚未生成。' : ''
                      }}</template
                    ><template v-else>简报已整理，可在“巡检简报”中核对。</template></div
                  ></div
                ></li
              ></ol
            >
            <div v-if="rulesReady" class="iv-material-note"
              >中间清单保留三类状态，不以“未完成核查”替代“未达标”。</div
            >
            <p v-if="cancelled" class="iv-cancelled-note"
              >本次已取消。以上仅保留停止前的材料，后续步骤未执行。</p
            >
          </template>

          <template v-else>
            <div class="iv-panel-heading"
              ><div
                ><h3>执行回执</h3
                ><p>{{ item.region }} · {{ item.product }} · 记录授权后的每一轮本地模拟。</p></div
              ><span class="iv-demo-label">未外发</span></div
            >
            <dl v-if="item.authorized" class="iv-supervision-summary">
              <div
                ><dt>监督对象</dt><dd>{{ item.region }} · {{ item.product }}</dd></div
              >
              <div
                ><dt>有效期</dt><dd>{{ item.period }} · {{ item.cadence }}</dd></div
              >
              <div
                ><dt>提醒对象</dt><dd>{{ item.recipient }}</dd></div
              >
              <div
                ><dt>飞书接收人</dt
                ><dd>{{ item.escalationRecipient || '我（计划创建人）' }}</dd></div
              >
              <div
                ><dt>跟进规则</dt><dd>{{ policySummary(planFor(item)) }}</dd></div
              >
            </dl>
            <div class="iv-demo-notice"
              >提醒与升级仅在本页模拟，未发送消息，也未创建真实业务任务。</div
            >
            <ol v-if="receipts.length" class="iv-receipt-timeline"
              ><li v-for="receipt in receipts" :key="receipt.id"
                ><div class="iv-receipt-meta"
                  ><span>{{ receiptLabels[receipt.kind] ?? '执行记录' }}</span
                  ><time>{{ receipt.at }}</time></div
                ><h4>{{ receipt.title }}</h4
                ><p>{{ receipt.detail }}</p
                ><span class="iv-receipt-local">本地模拟 · 未外发</span></li
              ></ol
            >
            <div v-else class="iv-inline-empty"
              ><div class="iv-receipt-empty-mark" aria-hidden="true">回执</div
              ><h4>{{ item.authorized ? '暂时还没有执行回执' : '尚未授权，不会自动跟进' }}</h4
              ><p>{{
                item.authorized
                  ? '授权已记录；产生模拟执行记录后，会按时间留存在这里。'
                  : '如果需要持续跟进，请在左侧确认地区、产品、周期与提醒安排。这里仅展示执行记录。'
              }}</p></div
            >
          </template>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss" src="./materials.scss"></style>
