<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useCoursewareInspectionRuntime } from '@/beauty/lib/coursewareInspectionRuntime'
import UnifiedInspectionSession from './UnifiedInspectionSession.vue'
import InspectionEntryTimeline from './InspectionEntryTimeline.vue'
import { useInspectionPresentation } from './useInspectionPresentation'
import { taskIntelligence, taskStageBriefing } from './taskPresentation'

const props = defineProps<{ readOnly?: boolean }>()
const runtime = useCoursewareInspectionRuntime()
const page = ref<'home' | 'request' | 'detail'>('home')
const workspace = ref<HTMLElement>()
watch(page, async () => {
  await nextTick()
  const container = workspace.value?.closest('.el-scrollbar__wrap')
  if (container) container.scrollTop = 0
})
const selectedId = ref('')
const editingId = ref('')
const tasks = computed(() => runtime.tasks.value.filter((task) => !task.demoScenario))
const current = computed(() => tasks.value.find((task) => task.id === selectedId.value))
// out-in 离场期间会话仍挂载；编辑上下文不能随详情选中项一起切换，避免触发草稿重置。
const sessionTask = computed(() => tasks.value.find((task) => task.id === editingId.value))
const confirmedTaskTitle = computed(() => {
  const task = current.value
  if (!task) return ''
  return taskTitle(task)
})
const activeEntries = computed(() =>
  [...(current.value?.entries ?? [])].filter((entry) => !entry.completedAt)
)
const completedEntries = computed(() =>
  [...(current.value?.entries ?? [])].filter((entry) => entry.completedAt).reverse()
)
const completedReports = computed(() =>
  (current.value?.escalations ?? []).filter((report) => report.status === 'simulated')
)
const pendingReports = computed(() =>
  (current.value?.escalations ?? []).filter((report) => report.status !== 'simulated')
)
const historyItems = computed(() =>
  [
    ...completedEntries.value.map((entry) => ({
      kind: 'entry' as const,
      id: entry.id,
      at: entry.completedAt!,
      entry
    })),
    ...completedReports.value.map((report) => ({
      kind: 'report' as const,
      id: report.id,
      at: report.at,
      report
    }))
  ].sort((a, b) => b.at.localeCompare(a.at))
)
type ProductTask = (typeof runtime.tasks.value)[number]
const filter = ref<'running' | 'completed'>('running')
const filterOptions = [
  { value: 'running', label: '运行中' },
  { value: 'completed', label: '已完成' }
] as const
function taskCount(kind: 'running' | 'completed') {
  return tasks.value.filter((task) =>
    kind === 'completed' ? Boolean(task.completedAt) : task.mode !== 'once' && !task.completedAt
  ).length
}
function taskTitle(task: ProductTask) {
  return (
    [task.requestPlan?.ready ? task.requestPlan.summary : '', task.question, task.name]
      .map((value) => (value || '').replace(/请确认后执行[。！]?$/, '').trim())
      .find(Boolean) || '未命名任务'
  )
}
const filteredTasks = computed(() =>
  tasks.value
    .filter((task) =>
      filter.value === 'completed'
        ? Boolean(task.completedAt)
        : task.mode !== 'once' && !task.completedAt
    )
    .sort((a, b) => {
      const priority = (task: ProductTask) => (!task.enabled ? 1 : 0)
      return priority(a) - priority(b) || b.createdAt.localeCompare(a.createdAt)
    })
)
const subjectLabel = (task: ProductTask) => (task.subject === 'training' ? '培训' : '课件')
function taskScope(task: ProductTask) {
  if (task.subject === 'training')
    return (
      [
        task.region === '全部' ? '全部地区' : task.region,
        task.person === '全部' ? '全部人员' : task.person,
        task.product === '全部' ? '全部产品' : task.product
      ]
        .filter(Boolean)
        .join(' · ') || '当前培训人员'
    )
  return task.scope === 'title_keyword'
    ? `标题包含「${task.titleFilter}」`
    : task.mode === 'once'
      ? '当前可见课件'
      : '本账号新增课件'
}
function taskProgress(task: ProductTask) {
  if (task.completedAt) return taskIntelligence(task)
  if (!task.enabled) return '任务已暂停，已有处理记录保留；恢复后继续核验新的进展。'
  const active = task.entries.filter((entry) => !entry.completedAt)
  const processing =
    [...active].reverse().find((entry) => ['checking', 'generating'].includes(entry.status)) ||
    active.at(-1)
  if (processing) return `${processing.creator} · ${processing.title}：${processing.summary}`
  return `正在监听新的${subjectLabel(task)}变化，新的进展到达后将按约定核验。`
}
const briefing = computed(() => current.value ? taskStageBriefing(current.value) : '')
function taskCriteria(task: ProductTask) {
  if (task.subject === 'training')
    return (
      [
        task.minScore != null ? `测验至少 ${task.minScore} 分` : '',
        task.requireCourseCompleted ? '完成课程学习' : ''
      ]
        .filter(Boolean)
        .join('，') || '按已确认的培训标准核验'
    )
  if (task.minDurationMinutes == null && task.maxDurationMinutes == null)
    return '未设置预计学习时长范围'
  return `预计学习 ${taskDuration(task.minDurationMinutes, task.maxDurationMinutes)}`
}
function latestTime(task: ProductTask) {
  return (
    [
      task.completedAt || task.createdAt,
      ...task.entries.flatMap((entry) => entry.events.map((event) => event.at)),
      ...task.escalations.map((report) => report.at)
    ]
      .sort()
      .at(-1) || task.createdAt
  )
}
const error = ref('')
const stream = ref<HTMLElement>()
const followLatest = ref(true)
useInspectionPresentation(
  () => {
    if (props.readOnly) return undefined
    if (page.value === 'home' && filter.value === 'running') return `home:${runtime.identityKey()}`
    return page.value === 'detail' &&
      current.value &&
      !current.value.completedAt &&
      current.value.enabled &&
      current.value.mode !== 'once'
      ? current.value.id
      : undefined
  },
  (id) => {
    if (!id.startsWith('home:')) return runtime.advancePresentation(id)
    const ids = tasks.value
      .filter((task) => task.enabled && !task.completedAt && task.mode !== 'once')
      .map((task) => task.id)
    for (const taskId of ids) runtime.advancePresentation(taskId)
    return ids.length > 0
  }
)
watch(selectedId, () => {
  followLatest.value = true
})
watch(
  () => [
    page.value,
    activeEntries.value
      .map((entry) => `${entry.id}:${entry.events.length}:${entry.status}`)
      .join('|')
  ],
  async () => {
    await nextTick()
    if (followLatest.value) scrollToLatest()
  }
)
function onStreamScroll() {
  const element = stream.value
  if (element)
    followLatest.value = element.scrollHeight - element.clientHeight - element.scrollTop < 40
}
function scrollToLatest() {
  if (stream.value) stream.value.scrollTop = stream.value.scrollHeight
}
const statusLabels = {
  generating: '正在生成',
  checking: '正在核验',
  awaiting_confirmation: '等待本人确认',
  missing_evidence: '等待补齐依据',
  completed: '已处理',
  failed: '生成未完成'
}
function startNew() {
  editingId.value = ''
  selectedId.value = ''
  error.value = ''
  page.value = 'request'
}
function openTask(id: string) {
  selectedId.value = id
  page.value = 'detail'
  error.value = ''
}
function editTask() {
  if (!current.value || props.readOnly || current.value.completedAt) return
  editingId.value = current.value.id
  page.value = 'request'
}
function handleSaved(id: string) {
  if (page.value !== 'request') return
  openTask(id)
}
function closeSession() {
  if (page.value !== 'request') return
  if (editingId.value) openTask(editingId.value)
  else {
    page.value = 'home'
    selectedId.value = ''
  }
}
function togglePause() {
  if (!current.value || props.readOnly || current.value.completedAt) return
  if (current.value.enabled) runtime.pauseTask(current.value.id)
  else runtime.resumeTask(current.value.id)
}
function stamp(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Jakarta',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date)
    : '时间未记录'
}
function taskDuration(min?: number, max?: number) {
  if (min != null && max != null) return `${min}–${max} 分钟`
  return min != null ? `至少 ${min} 分钟` : `不超过 ${max} 分钟`
}
</script>

<template>
  <section ref="workspace" class="cw-inspection" aria-label="事件驱动智能巡检">
    <p v-if="runtime.storageError.value" class="ci-error" role="alert">{{
      runtime.storageError.value
    }}</p>
    <p v-if="error" class="ci-error" role="alert">{{ error }}</p>

    <Transition name="ci-page" mode="out-in">
      <section v-if="page === 'home'" key="home" class="ci-home">
        <section class="ci-entry-intro" aria-label="巡检任务引导">
          <div class="ci-entry-story">
            <div class="ci-entry-badge"><span aria-hidden="true">✧</span>智能巡检工作区</div>
            <h2>把培训的每一步，<br />都跟进到位。</h2>
          </div>
          <p class="ci-entry-description"
            >从课件质量到人员达标，查清当前情况，也持续关注变化。需要提醒谁、何时汇报，都和你确认好。</p
          >
          <div class="ci-entry-guide">
            <ol class="ci-entry-roadmap"
              ><li
                ><span>01</span
                ><div
                  ><strong>提出你的需求</strong
                  ><small>查询现状，或交办需要持续关注的事。</small></div
                ></li
              ><li
                ><span>02</span
                ><div
                  ><strong>明确条件与处理方式</strong
                  ><small>确认范围和标准，再选择合适的处理步骤。</small></div
                ></li
              ><li
                ><span>03</span
                ><div
                  ><strong>查看结果与跟进记录</strong
                  ><small>查询完成后保留结果，监督任务持续更新。</small></div
                ></li
              ></ol
            >
          </div>
          <button class="ci-primary ci-entry-start" type="button" @click="startNew"
            >新建任务 <span aria-hidden="true">↗</span></button
          >
        </section>
        <section class="ci-task-list" aria-label="我的任务">
          <header class="ci-list-heading"
            ><div class="ci-list-heading-label"
              ><h2>我的任务</h2><span>{{ tasks.length }} 项</span></div
            >
            <div class="ci-list-filters" role="group" aria-label="任务分类"
              ><button
                v-for="option in filterOptions"
                :key="option.value"
                type="button"
                :class="{ selected: filter === option.value }"
                :aria-pressed="filter === option.value"
                @click="filter = option.value"
                >{{ option.label }} <span>{{ taskCount(option.value) }}</span></button
              ></div
            ></header
          >
          <div class="ci-task-rows" tabindex="0" aria-label="任务列表，可滚动">
            <button
              v-for="task in filteredTasks"
              :key="task.id"
              type="button"
              class="ci-task-row"
              @click="openTask(task.id)"
            >
              <span class="ci-task-description"
                ><strong>{{ taskTitle(task) }}</strong
                ><small
                  >{{ subjectLabel(task) }} · {{ task.mode === 'once' ? '查询分析' : '持续监督' }} ·
                  {{ taskScope(task) }}</small
                ></span
              >
              <span
                class="ci-task-state"
                :class="{
                  paused: !task.enabled && !task.completedAt && !task.queryPending
                }"
                ><span class="ci-task-state-summary">{{ taskProgress(task) }}</span>
                <span class="ci-row-arrow" aria-hidden="true">↗</span></span
              >
              <span class="ci-task-footer"
                ><time>{{ stamp(latestTime(task)) }}</time></span
              >
            </button>
            <p v-if="!filteredTasks.length" class="ci-empty">{{
              filter === 'completed'
                ? '暂无已完成任务。查询结果与已结束的监督记录会保留在这里。'
                : '暂无运行中的任务。提出需求后，助手会与你确认处理方式。'
            }}</p>
          </div>
        </section>
      </section>

      <UnifiedInspectionSession
        v-else-if="page === 'request'"
        key="request"
        :task="sessionTask || undefined"
        :editing="Boolean(editingId)"
        :read-only="readOnly"
        @close="closeSession"
        @saved="handleSaved"
      />

      <section
        v-else-if="current"
        :key="`detail:${current.id}`"
        class="ci-detail"
        aria-label="任务连续执行过程"
      >
        <section class="ci-card ci-overview" aria-label="任务与阶段汇报">
          <div class="ci-overview-scroll">
            <div class="ci-metadata"
              ><div class="ci-metadata-content" tabindex="0" aria-label="任务范围，可滚动">
                <h1 class="ci-task-title">{{ confirmedTaskTitle }}</h1>
                <dl class="ci-facts"
                  ><div
                    ><dt>关注对象</dt><dd>{{ taskScope(current) }}</dd></div
                  ><div
                    ><dt>合格口径</dt><dd>{{ taskCriteria(current) }}</dd></div
                  ><div
                    ><dt>触发方式</dt
                    ><dd>{{
                      current.mode === 'once'
                        ? '人工确认后查询一次'
                        : current.subject === 'training'
                          ? '学习或测验进展更新时处理'
                          : '课件生成事件到达时处理'
                    }}</dd></div
                  ><div
                    ><dt>监督状态</dt
                    ><dd>{{
                      current.completedAt
                        ? current.mode === 'once'
                          ? '查询已归档'
                          : '监督已结束'
                        : current.enabled
                          ? `持续关注${subjectLabel(current)}变化`
                          : '已暂停，不处理新变化'
                    }}</dd></div
                  ><div v-if="current.startsOn || current.endsOn"
                    ><dt>监督周期</dt
                    ><dd
                      >{{ current.startsOn || '即日起' }} 至 {{ current.endsOn || '持续关注' }}</dd
                    ></div
                  ></dl
                ></div
              >
              <nav class="ci-task-actions" aria-label="任务导航">
                <button type="button" @click="page = 'home'">← 返回任务</button>
                <button class="ci-primary" type="button" @click="startNew">＋ 新建任务</button>
                <template v-if="!readOnly && !current.completedAt">
                  <button type="button" @click="togglePause">{{
                    current.enabled ? '暂停任务' : '恢复任务'
                  }}</button>
                  <button type="button" @click="editTask">编辑任务</button>
                </template>
              </nav>
            </div>
            <div class="ci-briefing"
              ><span class="ci-eyebrow">当前阶段汇报</span
              ><p class="ci-narrative" aria-live="polite">{{ briefing }}</p
              ><details
                ><summary>执行约定与信息来源</summary
                ><template v-if="current.mode === 'once'">
                  <p v-for="(item, index) in current.queryResult?.evidence" :key="index">{{
                    item
                  }}</p>
                  <p>按已确认范围查询一次，不订阅、不提醒；缺少依据不作达标判断。</p>
                </template>
                <template v-else-if="current.subject === 'training'"
                  ><p>按已确认的人员范围、课程完成情况和测验成绩核验，未达标时按约定提醒并汇报。</p
                  ><p
                    >缺少学习或测验依据时暂不作结论；本人确认只表示知晓，不代表已经达标。</p
                  ></template
                >
                <template v-else
                  ><p
                    >预计学习时长取自课件产物。按同一培训师连续不合规计数，合规清零，第三次不合规时升级。确认只表示本人知晓。</p
                  ><p
                    >课件生成后按上述规则核验；缺少时长或创建人依据时暂不作结论，等待补齐后再处理。</p
                  ></template
                ></details
              ></div
            >
          </div>
        </section>
        <section class="ci-card ci-progress" aria-label="正在处理的事项">
          <header
            ><div
              ><span class="ci-dot" :class="{ paused: !current.enabled }" aria-hidden="true"></span
              ><h2>{{
                current.mode === 'once' && current.completedAt ? '执行记录' : '当前执行进展'
              }}</h2></div
            ></header
          >
          <div
            ref="stream"
            class="ci-card-scroll"
            tabindex="0"
            aria-label="当前执行进展，可滚动"
            @scroll.passive="onStreamScroll"
          >
            <article
              v-for="run in current.queryResult?.toolRuns"
              :key="run.id"
              class="ci-entry ci-query-run"
            >
              <div class="ci-entry-heading"
                ><h3>{{ run.label }}</h3
                ><span class="ci-entry-status">{{
                  run.status === 'failed' ? '未完成' : '已完成'
                }}</span></div
              >
              <p class="ci-entry-summary">{{ run.output }}</p>
              <details
                ><summary>查看处理依据</summary><p>{{ run.input }}</p
                ><time>{{ stamp(run.at) }}</time></details
              >
            </article>
            <article v-for="entry in activeEntries" :key="entry.id" class="ci-entry">
              <div class="ci-entry-heading"
                ><h3>{{ entry.creator }} · {{ entry.title }}</h3
                ><span class="ci-entry-status">{{
                  current.subject === 'training' && entry.status === 'generating'
                    ? '正在接收进展'
                    : current.subject === 'training' && entry.status === 'failed'
                      ? '检查未完成'
                      : statusLabels[entry.status]
                }}</span></div
              ><p class="ci-entry-summary">{{ entry.summary }}</p>
              <InspectionEntryTimeline :entry="entry" />
              <p v-if="entry.status === 'awaiting_confirmation'" class="ci-awaiting"
                >提醒已进入本人待确认列表，{{
                  current.subject === 'training' ? '等待学员确认' : '等待培训师确认'
                }}；查看此页不算确认。</p
              >
              <button
                v-if="
                  entry.status === 'awaiting_confirmation' &&
                  entry.source !== 'presentation' &&
                  current.enabled &&
                  !current.completedAt &&
                  !readOnly &&
                  entry.creatorId === String(runtime.actor()?.userId)
                "
                class="ci-acknowledge"
                type="button"
                @click="runtime.acknowledge(current.id, entry.id)"
                >本人确认已知晓</button
              >
            </article>
            <article
              v-for="report in pendingReports"
              :key="report.id"
              class="ci-entry ci-report-pending"
            >
              <div class="ci-entry-heading"
                ><h3>连续不合规升级汇报</h3><span class="ci-entry-status">历史汇报记录</span></div
              >
              <p class="ci-entry-summary"
                >{{ current.subject === 'training' ? '学员' : '培训师' }}
                {{
                  current.entries.find((entry) => entry.creatorId === report.creatorId)?.creator ||
                  report.creatorId
                }}
                已连续 {{ report.consecutiveFailures }} 次不合规，需要向任务创建人汇报。</p
              >
              <p class="ci-muted">{{ stamp(report.at) }} · {{ report.reason }} · 未发送</p>
            </article>
            <div
              v-if="
                !activeEntries.length &&
                !pendingReports.length &&
                !current.queryResult?.toolRuns?.length
              "
              class="ci-waiting"
              ><span aria-hidden="true">◎</span
              ><h3>{{
                current.completedAt
                  ? current.mode === 'once'
                    ? '本次查询已结束'
                    : '本次监督已结束'
                  : current.enabled
                    ? `正在监听新的${subjectLabel(current)}变化`
                    : '监督已暂停'
              }}</h3
              ><p>{{
                current.completedAt
                  ? '所有处理记录保留在下方，可随时展开查看。'
                  : current.enabled
                    ? `暂无待处理事项。新的${subjectLabel(current)}进展到达后将按约定核验，完成后归入下方记录。`
                    : '暂停期间不处理新变化，已有处理记录保留。'
              }}</p></div
            >
          </div>
        </section>
        <section class="ci-card ci-history" aria-label="已完成事项">
          <header
            ><h2
              >{{ current.mode === 'once' ? '查询结果与数据明细' : '已完成事项' }}
              <span>{{
                current.mode === 'once'
                  ? current.queryResult?.rows.length || 0
                  : historyItems.length
              }}</span></h2
            ><span class="ci-muted">最新在上 · 保留处理结果</span></header
          >
          <div class="ci-card-scroll" tabindex="0" aria-label="已完成事项，可滚动">
            <template v-if="current.queryResult">
              <p class="ci-query-conclusion">{{ briefing }}</p>
              <table v-if="current.queryResult.rows.length" class="ci-query-table">
                <thead
                  ><tr
                    ><th
                      v-for="column in current.queryResult.columns"
                      :key="column.key"
                      scope="col"
                      >{{ column.label }}</th
                    ></tr
                  ></thead
                >
                <tbody
                  ><tr v-for="(row, index) in current.queryResult.rows" :key="index"
                    ><td v-for="column in current.queryResult.columns" :key="column.key">{{
                      row[column.key] ?? '未记录'
                    }}</td></tr
                  ></tbody
                >
              </table>
              <p
                v-for="(item, index) in current.queryResult.evidence"
                :key="index"
                class="ci-query-evidence"
                >{{ item }}</p
              >
            </template>
            <details
              v-for="record in historyItems"
              :key="record.id"
              class="ci-completed-entry"
              :class="{ 'ci-report-receipt': record.kind === 'report' }"
            >
              <summary
                ><time>{{ stamp(record.at) }}</time
                ><template v-if="record.kind === 'entry'"
                  ><strong>{{ record.entry.creator }} · {{ record.entry.title }}</strong
                  ><span>{{
                    record.entry.outcome === 'passed'
                      ? '核验合规'
                      : record.entry.outcome === 'acknowledged'
                        ? '本人已确认'
                        : record.entry.outcome === 'stopped'
                          ? '已停止跟进'
                          : record.entry.status === 'failed'
                            ? current.subject === 'training'
                              ? '检查未完成'
                              : '生成未完成'
                            : '已记录'
                  }}</span></template
                ><template v-else
                  ><strong>连续三次不合规 · 飞书汇报</strong><span>汇报已完成</span></template
                ></summary
              >
              <template v-if="record.kind === 'entry'"
                ><p>{{ record.entry.summary }}</p
                ><InspectionEntryTimeline :entry="record.entry"
              /></template>
              <template v-else
                ><p class="ci-report-content">{{ record.report.reason }}</p></template
              >
            </details>
            <p v-if="!historyItems.length && !current.queryResult" class="ci-empty"
              >尚无处理完成的事项。等待确认或缺少依据的事项仍留在上方。</p
            >
          </div>
        </section>
      </section>
    </Transition>
  </section>
</template>

<style scoped lang="scss" src="./courseware-inspection.scss"></style>
