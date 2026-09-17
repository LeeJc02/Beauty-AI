<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { useBeautyI18n } from '@/beauty/composables'
import { syncInspectionSource } from '@/beauty/lib/inspectionStore'
import { getProgressTone, getTaskStatusBadgeClass } from '@/beauty/lib/visualTones'
import { DEFAULT_EXAM_PASS_RULES } from '@/beauty/lib/examPublishSettings'
import { examTasks, withdrawExamTask, type ExamTask, type ExamTaskStatus } from '@/views/beauty/exam/useExamTasks'
import BeautyBadge from '../components/BeautyBadge.vue'
import BeautyProgress from '../components/BeautyProgress.vue'
import { useTaskRole } from '../useTaskRole'

/**
 * 考试任务管理：原型 `pages/ExamTaskManage.tsx`。
 *
 * 任务列表来自 `App.tsx` 的 `examTasks` state，Vue 版直接复用「题目与考试」交付单元建立的
 * 模块级 store `@/views/beauty/exam/useExamTasks`（组卷页发布考试时写入同一份状态），
 * 这里只读取与撤回，不再另建一份。撤回等价于原型 `onWithdrawTask(taskId)`。
 */
defineOptions({ name: 'BeautyTasksExam' })

interface ReviewCandidate {
  id: string
  name: string
  region: string
  positionName: string
  store: string
  storeChannel: string
  aiScore: number
  reviewStatus: string
}

interface PositionPassSummary {
  positionName: string
  passScore: number
  total: number
  passed: number
  passRate: number
}

const { t } = useBeautyI18n()

const userRole = useTaskRole()
const isReadOnly = computed(
  () =>
    userRole.value === 'Regional Manager' ||
    userRole.value === 'Regional Training Manager' ||
    userRole.value === 'Regional Trainer'
)
const tasks = examTasks

const MOCK_CANDIDATES = [
  { id: 'BA001', name: 'Siti Aminah', store: 'Jakarta Grand Indonesia', status: '已交卷', submitTime: '10:45' },
  { id: 'BA002', name: 'Budi Santoso', store: 'Jakarta Plaza Senayan', status: '考试中', submitTime: '-' },
  { id: 'BA003', name: 'Ayu Lestari', store: 'Surabaya Tunjungan Plaza', status: '未开始', submitTime: '-' },
  { id: 'BA004', name: 'Rizky Pratama', store: 'Bali Beachwalk', status: '已交卷', submitTime: '10:52' },
  { id: 'BA005', name: 'Dewi Sartika', store: 'Bandung Trans Studio', status: '考试中', submitTime: '-' },
  { id: 'BA006', name: 'Agung Setiawan', store: 'Medan Centre Point', status: '已交卷', submitTime: '11:05' },
  { id: 'BA007', name: 'Putri Maharani', store: 'Yogyakarta Hartono Mall', status: '考试中', submitTime: '-' }
]

const MOCK_REVIEW_CANDIDATES: ReviewCandidate[] = [
  { id: 'BA001', name: 'Siti Aminah', region: '雅加达区', positionName: '初级 BA', store: 'Jakarta Grand Indonesia', storeChannel: '百货', aiScore: 85, reviewStatus: '待复核' },
  { id: 'BA004', name: 'Rizky Pratama', region: '巴厘岛区', positionName: '店长', store: 'Bali Beachwalk', storeChannel: '购物中心', aiScore: 92, reviewStatus: '已复核' },
  { id: 'BA006', name: 'Reza Rahadian', region: '棉兰区', positionName: '高级 BA', store: 'Medan Centre Point', storeChannel: '商超', aiScore: 78, reviewStatus: '待复核' },
  { id: 'BA007', name: 'Dian Sastrowardoyo', region: '望加锡区', positionName: '初级 BA', store: 'Makassar Trans Studio', storeChannel: 'CS', aiScore: 88, reviewStatus: '待复核' },
  { id: 'BA008', name: 'Maya Sari', region: '日惹区', positionName: '区域培训师', store: 'Yogyakarta Hartono Mall', storeChannel: '线上渠道', aiScore: 95, reviewStatus: '已复核' }
]

const MOCK_INSIGHT_DATA = {
  total: 1000,
  submitted: 980,
  passRate: 92,
  avgScore: 88.5,
  highestScore: 100,
  lowestScore: 56,
  knowledgeGaps: [
    { title: '敏感肌换季护肤步骤', errorRate: 35 },
    { title: '顾客异议处理：大促价格对比', errorRate: 28 },
    { title: '双萃精华核心成分原理解析', errorRate: 22 }
  ],
  scoreHistogram: [
    { range: '0-59', count: 18 },
    { range: '60-69', count: 42 },
    { range: '70-79', count: 118 },
    { range: '80-89', count: 422 },
    { range: '90-100', count: 380 }
  ],
  topPerformers: [
    { name: 'Siti Aminah', store: 'Jakarta Grand Indonesia', score: 100 },
    { name: 'Rizky Pratama', store: 'Bali Beachwalk', score: 98 },
    { name: 'Putri Maharani', store: 'Yogyakarta Hartono Mall', score: 97 }
  ]
}

const normalizePositionName = (value: string) => value.replace(/\s+/g, '').toLowerCase()

const getCandidatePassScore = (task: ExamTask | null, candidate: ReviewCandidate) => {
  const rules = task?.passRules && task.passRules.length > 0 ? task.passRules : DEFAULT_EXAM_PASS_RULES
  const matchedRule = rules.find(
    (rule) => normalizePositionName(rule.roleName) === normalizePositionName(candidate.positionName)
  )
  return matchedRule?.score ?? rules[0]?.score ?? 80
}

const isCandidatePassed = (task: ExamTask | null, candidate: ReviewCandidate) =>
  candidate.aiScore >= getCandidatePassScore(task, candidate)

const getPositionPassSummaries = (
  task: ExamTask | null,
  candidates: ReviewCandidate[]
): PositionPassSummary[] => {
  const summaryMap = new Map<
    string,
    { positionName: string; passScore: number; total: number; passed: number }
  >()

  candidates.forEach((candidate) => {
    const passScore = getCandidatePassScore(task, candidate)
    const key = `${candidate.positionName}-${passScore}`
    const current = summaryMap.get(key) || {
      positionName: candidate.positionName,
      passScore,
      total: 0,
      passed: 0
    }
    current.total += 1
    if (candidate.aiScore >= passScore) current.passed += 1
    summaryMap.set(key, current)
  })

  return Array.from(summaryMap.values()).map((summary) => ({
    ...summary,
    passRate: summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0
  }))
}

const escapeExcelCell = (value: string | number) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const createBarText = (value: number, maxValue: number) => {
  if (maxValue <= 0 || value <= 0) return ''
  const blocks = Math.max(1, Math.round((value / maxValue) * 24))
  return '█'.repeat(blocks)
}

const buildScoreSheetHtml = (task: ExamTask, candidates: ReviewCandidate[]) => {
  const headers = ['工号', '姓名', '地区', '职位', '门店', '门店渠道', '最终得分', '及格分数', '是否及格', '状态']
  const rows = candidates.map((candidate) => {
    const passScore = getCandidatePassScore(task, candidate)
    return [
      candidate.id,
      candidate.name,
      candidate.region,
      candidate.positionName,
      candidate.store,
      candidate.storeChannel,
      `${candidate.aiScore} 分`,
      `${passScore} 分`,
      candidate.aiScore >= passScore ? '及格' : '未及格',
      '已评分'
    ]
  })
  const histogramMaxCount = Math.max(...MOCK_INSIGHT_DATA.scoreHistogram.map((item) => item.count), 1)
  const histogramRows = MOCK_INSIGHT_DATA.scoreHistogram.map((item) => [
    item.range,
    item.count,
    `${Math.round((item.count / MOCK_INSIGHT_DATA.submitted) * 100)}%`,
    createBarText(item.count, histogramMaxCount)
  ])
  const positionRows = getPositionPassSummaries(task, candidates).map((summary) => [
    summary.positionName,
    `${summary.passScore} 分`,
    summary.total,
    summary.passed,
    `${summary.passRate}%`,
    createBarText(summary.passRate, 100)
  ])

  const renderTable = (tableHeaders: string[], tableRows: Array<Array<string | number>>) =>
    [
      `<tr>${tableHeaders.map((header) => `<th>${escapeExcelCell(header)}</th>`).join('')}</tr>`,
      ...tableRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeExcelCell(cell)}</td>`).join('')}</tr>`)
    ].join('')

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #d9d2cc; padding: 8px 10px; text-align: left; }
          th { background: #f8f5f3; font-weight: 700; }
        </style>
      </head>
      <body>
        <h3>${escapeExcelCell(task.title)} - 成绩单</h3>
        <table>${renderTable(headers, rows)}</table>
        <h3>成绩分布直方图</h3>
        <table>${renderTable(['分数段', '人数', '占比', '直方图'], histogramRows)}</table>
        <h3>不同职位通过率</h3>
        <table>${renderTable(['职位', '及格分数', '参考人数', '及格人数', '通过率', '直方图'], positionRows)}</table>
      </body>
    </html>
  `
}

const activeTab = ref<'全部' | ExamTaskStatus>('全部')
const monitoringTask = ref<ExamTask | null>(null)
const reviewingTask = ref<ExamTask | null>(null)
const insightTask = ref<ExamTask | null>(null)
const withdrawTask = ref<ExamTask | null>(null)
const scoreSearch = ref('')

const TABS = ['全部', '待开始', '考试中', '考试结束待复核', '复核结束'] as const

const monitoringOpen = computed({
  get: () => Boolean(monitoringTask.value),
  set: (value: boolean) => {
    if (!value) monitoringTask.value = null
  }
})
const reviewingOpen = computed({
  get: () => Boolean(reviewingTask.value),
  set: (value: boolean) => {
    if (!value) reviewingTask.value = null
  }
})
const insightOpen = computed({
  get: () => Boolean(insightTask.value),
  set: (value: boolean) => {
    if (!value) insightTask.value = null
  }
})
const withdrawOpen = computed({
  get: () => Boolean(withdrawTask.value),
  set: (value: boolean) => {
    if (!value) withdrawTask.value = null
  }
})

// 与原型 `App.tsx` 一致：考试任务列表变化即同步到培训审计数据源（幂等）。
watch(
  tasks,
  (value) => {
    syncInspectionSource('exam', 'exam_task_manage', value)
  },
  { immediate: true }
)

const statusMeta = (status: ExamTaskStatus) => {
  switch (status) {
    case '待开始':
      return { label: '待开始', className: `${getTaskStatusBadgeClass(status)} whitespace-nowrap` }
    case '考试中':
      return { label: '考试中', className: `${getTaskStatusBadgeClass(status)} whitespace-nowrap` }
    case '考试结束待复核':
      return { label: '待复核', className: `${getTaskStatusBadgeClass(status)} whitespace-nowrap` }
    case '复核结束':
      return { label: '已结束', className: `${getTaskStatusBadgeClass(status)} whitespace-nowrap` }
  }
}

const filteredTasks = computed(() =>
  tasks.value.filter((task) => activeTab.value === '全部' || task.status === activeTab.value)
)

const filteredReviewCandidates = computed(() => {
  const keyword = scoreSearch.value.trim().toLowerCase()
  if (!keyword) return MOCK_REVIEW_CANDIDATES
  return MOCK_REVIEW_CANDIDATES.filter((candidate) =>
    [candidate.id, candidate.name, candidate.region, candidate.positionName, candidate.store, candidate.storeChannel].some(
      (value) => value.toLowerCase().includes(keyword)
    )
  )
})

const insightPositionPassSummaries = computed(() =>
  getPositionPassSummaries(insightTask.value, MOCK_REVIEW_CANDIDATES)
)

const histogramOption = computed<EChartsOption>(() => ({
  grid: { top: 8, right: 20, bottom: 0, left: -8 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: MOCK_INSIGHT_DATA.scoreHistogram.map((item) => item.range),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#E5DED8' } },
    axisLabel: { color: '#766F73', fontSize: 12 }
  },
  yAxis: {
    type: 'value',
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { color: '#766F73', fontSize: 12 }
  },
  series: [
    {
      type: 'bar',
      name: t('人数'),
      data: MOCK_INSIGHT_DATA.scoreHistogram.map((item) => item.count),
      itemStyle: { color: '#3B8F72', borderRadius: [6, 6, 0, 0] },
      barWidth: 54
    }
  ]
}))

const handleWithdrawTask = () => {
  const task = withdrawTask.value
  if (!task) return
  withdrawExamTask(task.id)
  if (monitoringTask.value?.id === task.id) {
    monitoringTask.value = null
  }
  withdrawTask.value = null
}

const handleExportFinishedScores = () => {
  const task = reviewingTask.value
  if (!task || task.status !== '复核结束') return
  const html = buildScoreSheetHtml(task, MOCK_REVIEW_CANDIDATES)
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const safeTitle = task.title.replace(/[\\/:*?"<>|]/g, '_')
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeTitle}_成绩单.xls`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const monitoringRate = computed(() =>
  monitoringTask.value
    ? Math.round((monitoringTask.value.submittedCount / monitoringTask.value.targetCount) * 100)
    : 0
)

const passRateTone = (rate: number) =>
  rate >= 90 ? 'bg-[#EEF8F4] text-[#2F735C]' : rate >= 70 ? 'bg-[#FFF7EA] text-[#8B621F]' : 'bg-red-50 text-red-600'

const passRateBar = (rate: number) =>
  rate >= 90 ? 'bg-[#3B8F72]' : rate >= 70 ? 'bg-[#B9822B]' : 'bg-red-500'
</script>

<template>
  <div class="flex h-full flex-1 flex-col pt-2">
    <div class="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-[#242124]">考试任务管理</h1>
        <p class="mt-1 text-xs text-[#766F73]">查看和追踪所有已发布的考试任务状态</p>
      </div>

      <div class="flex shrink-0 overflow-x-auto rounded-xl bg-slate-100/50 p-1">
        <button
          v-for="tab in TABS"
          :key="tab"
          type="button"
          class="rounded-lg px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all"
          :class="
            activeTab === tab
              ? 'bg-white text-rose-600 shadow-sm'
              : 'text-[#766F73] hover:bg-slate-200/50 hover:text-[#3F3A3D]'
          "
          @click="activeTab = tab"
        >
          {{ tab === '考试结束待复核' ? '待复核' : tab }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="rounded-2xl border border-solid border-[#E9E4DF] bg-white shadow-sm transition-shadow hover:shadow-md"
      >
        <div class="flex flex-col items-start gap-6 p-5 md:flex-row md:items-center">
          <div class="min-w-0 flex-1">
            <div class="mb-2 flex items-center gap-3">
              <BeautyBadge :class="statusMeta(task.status).className">{{ statusMeta(task.status).label }}</BeautyBadge>
              <div class="flex items-center font-mono text-[10px] font-medium text-[#9A9396]">
                <Icon icon="lucide:calendar" :size="12" class="mr-1" />
                {{ t(`${task.publishTime} 发布`) }}
              </div>
            </div>
            <div data-i18n-skip="true" class="line-clamp-1 text-base font-bold text-[#242124]">{{ task.title }}</div>
            <div
              v-if="(task.passRules && task.passRules.length > 0) || (task.profileQuestions && task.profileQuestions.length > 0)"
              class="mt-2 flex flex-wrap gap-1.5"
            >
              <span
                v-if="task.questionCount"
                class="rounded-full bg-[#F8F5F3] px-2 py-0.5 text-[10px] font-bold text-[#766F73] ring-1 ring-[#E5DED8]"
              >
                试卷 {{ task.questionCount }} 题
              </span>
              <span
                v-if="task.profileQuestions && task.profileQuestions.length > 0"
                class="rounded-full bg-[#EEF8F4] px-2 py-0.5 text-[10px] font-bold text-[#2F735C] ring-1 ring-[#BFDCCF]"
              >
                固定信息题 {{ task.profileQuestions.length }} 道
              </span>
              <span
                v-for="rule in (task.passRules || []).slice(0, 3)"
                :key="rule.id"
                data-i18n-skip="true"
                class="rounded-full bg-[#EEF8F4] px-2 py-0.5 text-[10px] font-bold text-[#2F735C] ring-1 ring-[#BFDCCF]"
              >
                {{ rule.roleName }} {{ rule.score }}分
              </span>
              <span
                v-if="(task.passRules || []).length > 3"
                class="rounded-full bg-[#F8F5F3] px-2 py-0.5 text-[10px] font-bold text-[#766F73] ring-1 ring-[#E5DED8]"
              >
                +{{ (task.passRules || []).length - 3 }}
              </span>
            </div>
          </div>

          <div class="w-full shrink-0 md:w-64">
            <div
              v-if="task.status === '待开始'"
              class="flex items-center gap-3 rounded-xl border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-3"
            >
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200/50">
                <Icon icon="lucide:clock" :size="16" class="text-[#9A9396]" />
              </div>
              <div>
                <p class="text-xs font-bold text-[#3F3A3D]">尚未开始</p>
                <p class="mt-0.5 text-[10px] text-[#766F73]">{{ t(`预计推送给 ${task.targetCount} 名考生`) }}</p>
              </div>
            </div>

            <div v-else-if="task.status === '考试中'" class="flex flex-col gap-2">
              <div class="flex items-end justify-between">
                <div class="text-[11px] font-medium text-[#766F73]">
                  {{ t(`答题进度 (${task.submittedCount}/${task.targetCount})`) }}
                </div>
                <div class="text-sm font-bold" :class="getProgressTone((task.submittedCount / task.targetCount) * 100).textClass">
                  {{ Math.round((task.submittedCount / task.targetCount) * 100) }}%
                </div>
              </div>
              <BeautyProgress
                :value="(task.submittedCount / task.targetCount) * 100"
                track-class="h-1.5 bg-slate-100"
                :indicator-class="getProgressTone((task.submittedCount / task.targetCount) * 100).indicatorClass"
              />
            </div>

            <div
              v-else-if="task.status === '考试结束待复核'"
              class="flex items-center gap-3 rounded-xl border border-solid border-[#F2DEC0] bg-[#FFF7EA]/50 p-3"
            >
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F7E6C8]">
                <Icon icon="lucide:alert-circle" :size="16" class="text-[#B9822B]" />
              </div>
              <div>
                <p class="text-xs font-bold text-amber-800">AI阅卷完毕</p>
                <p class="mt-0.5 text-[10px] text-[#B9822B]">{{ t(`已有 ${task.submittedCount} 份答卷等待人工复核`) }}</p>
              </div>
            </div>

            <div v-else class="flex items-center justify-between gap-4 rounded-xl bg-[#F8F5F3] p-3">
              <div class="flex flex-col">
                <span class="text-[10px] font-medium text-[#766F73]">参考</span>
                <span class="text-sm font-bold text-[#3F3A3D]">{{ t(`${task.submittedCount} 人`) }}</span>
              </div>
              <div class="h-6 w-px bg-slate-200"></div>
              <div class="flex flex-col">
                <span class="text-[10px] font-medium text-[#3B8F72]">平均分</span>
                <span class="text-sm font-bold text-[#2F735C]">{{ task.avgScore }} 分</span>
              </div>
            </div>
          </div>

          <div class="flex w-full shrink-0 justify-end md:w-44 md:border-l border-solid md:border-[#E9E4DF] md:pl-6">
            <div v-if="task.status === '待开始'" class="flex w-full flex-col gap-2">
              <button
                type="button"
                class="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-solid border-[#E5DED8] bg-white text-xs font-bold text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
              >
                <Icon icon="lucide:file-text" :size="14" /> 详情
              </button>
              <button
                v-if="!isReadOnly"
                type="button"
                class="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-solid border-red-200 bg-red-50 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                @click="withdrawTask = task"
              >
                <Icon icon="lucide:alert-triangle" :size="14" /> 撤回考试
              </button>
            </div>

            <div v-else-if="task.status === '考试中'" class="flex w-full flex-col gap-2">
              <button
                type="button"
                class="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border-none bg-blue-50 text-xs font-bold text-blue-600 shadow-none transition-colors hover:bg-blue-100"
                @click="monitoringTask = task"
              >
                <Icon icon="lucide:users" :size="14" /> 监控
              </button>
              <button
                v-if="!isReadOnly"
                type="button"
                class="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-solid border-red-200 bg-red-50 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                @click="withdrawTask = task"
              >
                <Icon icon="lucide:alert-triangle" :size="14" /> 撤回考试
              </button>
            </div>

            <div v-else-if="task.status === '考试结束待复核'" class="w-full">
              <button
                v-if="isReadOnly"
                type="button"
                class="pointer-events-none inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-solid border-[#E8CCA0] bg-[#FFF7EA]/50 text-xs font-bold text-[#B9822B]"
              >
                <Icon icon="lucide:clock" :size="14" /> 复核中
              </button>
              <button
                v-else
                type="button"
                class="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-solid border-[#E8CCA0] bg-[#FFF7EA] text-xs font-bold text-[#B9822B] shadow-none transition-colors hover:bg-[#F7E6C8]"
                @click="reviewingTask = task"
              >
                <Icon icon="lucide:edit" :size="14" /> 复核
              </button>
            </div>

            <div v-else class="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                class="inline-flex min-w-0 items-center justify-center gap-1 rounded-md border-none bg-[#F8F5F3] px-2 text-xs font-bold whitespace-nowrap text-[#5D565A] shadow-none transition-colors hover:bg-[#F1ECE8]"
                @click="reviewingTask = task"
              >
                <Icon icon="lucide:file-text" :size="14" /> 成绩
              </button>
              <button
                type="button"
                class="inline-flex min-w-0 items-center justify-center gap-1 rounded-md border-none bg-[#EEF8F4] px-2 text-xs font-bold whitespace-nowrap text-[#3B8F72] shadow-none transition-colors hover:bg-[#DCEFE7]"
                @click="insightTask = task"
              >
                <Icon icon="lucide:bar-chart-3" :size="14" /> 洞察
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredTasks.length === 0" class="py-12 text-center text-[#9A9396]">
        <Icon icon="lucide:alert-circle" :size="32" class="mx-auto mb-3 opacity-20" />
        <p class="text-sm font-medium">当前状态下暂无考试任务</p>
      </div>
    </div>

    <!-- 实时监控 -->
    <el-dialog
      v-model="monitoringOpen"
      width="1000px"
      append-to-body
      class="!p-0"
      body-class="!max-h-[78vh] !overflow-y-auto !p-6"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E9E4DF] !px-6 !pt-5 !pb-4"
    >
      <template #header>
        <div class="flex items-center text-base font-semibold text-[#242124]">
          <Icon icon="lucide:users" :size="20" class="mr-2 text-blue-600" />
          <span data-i18n-skip="true">{{ monitoringTask?.title }}</span>
          <span> - 实时监控</span>
        </div>
      </template>
      <div class="flex flex-col">
        <div class="mb-6 grid shrink-0 grid-cols-3 gap-4">
          <div class="flex items-center justify-between rounded-xl border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
            <div>
              <p class="mb-1 text-xs font-medium text-[#766F73]">目标人数</p>
              <p class="text-xl font-bold text-[#242124]">{{ monitoringTask?.targetCount }}</p>
            </div>
            <Icon icon="lucide:users" :size="32" class="text-blue-200" />
          </div>
          <div class="flex items-center justify-between rounded-xl border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
            <div>
              <p class="mb-1 text-xs font-medium text-[#766F73]">已交卷</p>
              <p class="text-xl font-bold text-blue-600">{{ monitoringTask?.submittedCount }}</p>
            </div>
            <Icon icon="lucide:check-circle" :size="32" class="text-blue-200" />
          </div>
          <div class="flex items-center justify-between rounded-xl border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
            <div>
              <p class="mb-1 text-xs font-medium text-[#766F73]">交卷率</p>
              <p class="text-xl font-bold text-[#242124]">{{ monitoringRate }}%</p>
            </div>
            <Icon icon="lucide:bar-chart-3" :size="32" class="text-blue-200" />
          </div>
        </div>

        <div class="mb-4 flex shrink-0 items-center justify-between">
          <h3 class="text-sm font-bold text-[#242124]">考生明细 (正在实时刷新)</h3>
          <div class="relative">
            <Icon icon="lucide:search" :size="16" class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]" />
            <input
              type="text"
              placeholder="搜索免考工号、姓名、门店..."
              class="w-64 rounded-lg border border-solid border-[#E5DED8] py-1.5 pr-4 pl-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>
        </div>

        <div class="overflow-auto rounded-xl border border-solid border-[#E5DED8]">
          <table class="beauty-table w-full text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-solid border-[#E5DED8] bg-[#F8F5F3]">
              <tr>
                <th class="w-24 p-3 font-medium text-[#766F73]">工号</th>
                <th class="w-32 p-3 font-medium text-[#766F73]">姓名</th>
                <th class="p-3 font-medium text-[#766F73]">门店</th>
                <th class="w-32 p-3 font-medium text-[#766F73]">状态</th>
                <th class="w-32 p-3 font-medium text-[#766F73]">交卷时间</th>
              </tr>
            </thead>
            <tbody class="bg-white">
              <tr v-for="candidate in MOCK_CANDIDATES" :key="candidate.id" class="transition-colors hover:bg-[#F8F5F3]">
                <td class="p-3 font-mono text-xs text-[#766F73]">{{ candidate.id }}</td>
                <td class="p-3 font-medium text-[#242124]">{{ candidate.name }}</td>
                <td class="p-3 text-[#5D565A]">{{ candidate.store }}</td>
                <td class="p-3">
                  <BeautyBadge
                    v-if="candidate.status === '已交卷'"
                    borderless
                    class="bg-[#EEF8F4] font-normal text-[#3B8F72]"
                  >
                    已交卷
                  </BeautyBadge>
                  <BeautyBadge
                    v-else-if="candidate.status === '考试中'"
                    borderless
                    :class="[getTaskStatusBadgeClass(candidate.status), 'font-normal']"
                  >
                    正在答题
                  </BeautyBadge>
                  <BeautyBadge v-else borderless class="bg-slate-100 font-normal text-[#766F73]">尚未进入</BeautyBadge>
                </td>
                <td class="p-3 font-mono text-xs text-[#766F73]">{{ candidate.submitTime }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </el-dialog>

    <!-- 撤回考试 -->
    <el-dialog v-model="withdrawOpen" width="460px" append-to-body>
      <template #header>
        <div class="flex items-center text-base font-semibold text-red-600">
          <Icon icon="lucide:alert-triangle" :size="20" class="mr-2" />撤回考试
        </div>
      </template>
      <div class="space-y-3">
        <p class="text-sm font-bold text-[#242124]">该考试任务将撤回，是否确定？</p>
        <p class="text-xs leading-relaxed text-[#766F73]">撤回后该任务将从考试任务管理中消失，已分发的考生将不再看到该考试。</p>
        <div v-if="withdrawTask" class="rounded-lg border border-solid border-red-100 bg-red-50 px-3 py-2">
          <p data-i18n-skip="true" class="line-clamp-1 text-xs font-bold text-red-700">{{ withdrawTask.title }}</p>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
            @click="withdrawTask = null"
          >
            取消
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-700"
            @click="handleWithdrawTask"
          >
            确认撤回
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- 复核 / 成绩单 -->
    <el-dialog
      v-model="reviewingOpen"
      width="1280px"
      append-to-body
      class="!p-0"
      body-class="!max-h-[78vh] !overflow-y-auto !p-6"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E9E4DF] !px-6 !pt-5 !pb-4"
    >
      <template #header>
        <div class="flex items-center text-base font-semibold text-[#242124]">
          <Icon
            :icon="reviewingTask?.status === '复核结束' ? 'lucide:file-text' : 'lucide:alert-circle'"
            :size="20"
            class="mr-2"
            :class="reviewingTask?.status === '复核结束' ? 'text-blue-600' : 'text-[#B9822B]'"
          />
          <span data-i18n-skip="true">{{ reviewingTask?.title }}</span>
          <span>{{ reviewingTask?.status === '复核结束' ? ' - 完整考卷与成绩单' : ' - 待人工复核' }}</span>
        </div>
      </template>
      <div class="flex flex-col">
        <div
          v-if="reviewingTask?.status !== '复核结束'"
          class="mb-6 flex shrink-0 items-start gap-4 rounded-xl border border-solid border-[#F2DEC0] bg-[#FFF7EA]/50 p-4"
        >
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F7E6C8]">
            <Icon icon="lucide:bar-chart-3" :size="20" class="text-[#B9822B]" />
          </div>
          <div class="flex-1">
            <h3 class="mb-1 text-sm font-bold text-amber-800">主观题/实操题AI阅卷完成</h3>
            <p class="mb-3 text-xs leading-relaxed text-[#8B621F]/80">
              本次考试包含 <span class="font-bold">2个AI对话实操题</span> 和 <span class="font-bold">1个简答题</span>。系统已经完成全部 480 份试卷的初步打分。请总部培训师对低分卷、可疑卷进行重点抽查，并可以通过录音核听纠正AI的评分，确认无误后结束复核发布最终成绩。
            </p>
            <div class="flex gap-4">
              <div class="flex items-center rounded-md border border-solid border-[#E8CCA0] bg-white px-3 py-1.5">
                <span class="mr-2 text-[10px] font-bold text-[#B9822B]">待复核数量</span>
                <span class="text-sm font-bold text-[#242124]">12 份</span>
              </div>
              <div class="flex items-center rounded-md border border-solid border-[#E8CCA0] bg-white px-3 py-1.5">
                <span class="mr-2 text-[10px] font-bold text-[#B9822B]">当前AI均分</span>
                <span class="text-sm font-bold text-[#242124]">88.5 分</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mb-4 flex shrink-0 items-center justify-between">
          <h3 class="text-sm font-bold text-[#242124]">考生考卷列表</h3>
          <div class="flex gap-2">
            <button
              v-if="reviewingTask?.status === '复核结束'"
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border border-solid border-[#DCEFE7] bg-[#EEF8F4] px-3 text-xs font-bold text-[#2F735C] transition-colors hover:bg-[#DCEFE7]"
              @click="handleExportFinishedScores"
            >
              <Icon icon="lucide:download" :size="14" />导出Excel
            </button>
            <div class="relative">
              <Icon icon="lucide:search" :size="16" class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]" />
              <input
                v-model="scoreSearch"
                type="text"
                placeholder="搜索姓名、工号、地区、职位或门店..."
                class="w-60 rounded-lg border border-solid border-[#E5DED8] py-1.5 pr-4 pl-9 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
              />
            </div>
            <select
              v-if="reviewingTask?.status !== '复核结束'"
              class="w-40 rounded-lg border border-solid border-[#E5DED8] px-3 py-1.5 text-sm focus:border-[#B9822B] focus:ring-2 focus:ring-[#B9822B]/20 focus:outline-none"
            >
              <option>所有试卷</option>
              <option>低于 80 分</option>
              <option>分数异常差异重点</option>
            </select>
          </div>
        </div>

        <div class="overflow-auto rounded-xl border border-solid border-[#E5DED8]">
          <table class="beauty-table w-full text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-solid border-[#E5DED8] bg-[#F8F5F3]">
              <tr>
                <th class="w-24 p-3 font-medium text-[#766F73]">工号</th>
                <th class="w-32 p-3 font-medium text-[#766F73]">姓名</th>
                <th v-if="reviewingTask?.status === '复核结束'" class="w-28 p-3 font-medium text-[#766F73]">地区</th>
                <th v-if="reviewingTask?.status === '复核结束'" class="w-28 p-3 font-medium text-[#766F73]">职位</th>
                <th class="min-w-48 p-3 font-medium text-[#766F73]">门店</th>
                <th v-if="reviewingTask?.status === '复核结束'" class="w-28 p-3 font-medium text-[#766F73]">门店渠道</th>
                <th class="w-24 p-3 font-medium text-[#766F73]">
                  {{ reviewingTask?.status === '复核结束' ? '最终得分' : 'AI打分' }}
                </th>
                <th v-if="reviewingTask?.status === '复核结束'" class="w-24 p-3 font-medium text-[#766F73]">及格分</th>
                <th class="w-24 p-3 font-medium text-[#766F73]">
                  {{ reviewingTask?.status === '复核结束' ? '是否及格' : '状态' }}
                </th>
                <th class="w-32 p-3 text-right font-medium text-[#766F73]">操作</th>
              </tr>
            </thead>
            <tbody class="bg-white">
              <tr v-for="candidate in filteredReviewCandidates" :key="candidate.id" class="transition-colors hover:bg-[#F8F5F3]">
                <td class="p-3 font-mono text-xs text-[#766F73]">{{ candidate.id }}</td>
                <td class="p-3 font-medium text-[#242124]">{{ candidate.name }}</td>
                <td v-if="reviewingTask?.status === '复核结束'" class="p-3 text-[#5D565A]">{{ candidate.region }}</td>
                <td v-if="reviewingTask?.status === '复核结束'" class="p-3 text-[#5D565A]">{{ candidate.positionName }}</td>
                <td class="p-3 text-[#5D565A]">{{ candidate.store }}</td>
                <td v-if="reviewingTask?.status === '复核结束'" class="p-3 text-[#5D565A]">{{ candidate.storeChannel }}</td>
                <td class="p-3">
                  <span class="font-bold" :class="isCandidatePassed(reviewingTask, candidate) ? 'text-[#242124]' : 'text-red-500'">
                    {{ candidate.aiScore }} 分
                  </span>
                </td>
                <td v-if="reviewingTask?.status === '复核结束'" class="p-3 text-[#766F73]">
                  {{ getCandidatePassScore(reviewingTask, candidate) }} 分
                </td>
                <td class="p-3">
                  <BeautyBadge
                    v-if="reviewingTask?.status === '复核结束'"
                    :class="
                      isCandidatePassed(reviewingTask, candidate)
                        ? 'border-[#BFDCCF] bg-[#EEF8F4] font-bold text-[#3B8F72]'
                        : 'border-red-100 bg-red-50 font-bold text-red-600'
                    "
                  >
                    {{ isCandidatePassed(reviewingTask, candidate) ? '及格' : '未及格' }}
                  </BeautyBadge>
                  <BeautyBadge
                    v-else-if="candidate.reviewStatus === '已复核'"
                    class="border-transparent bg-slate-100 font-normal text-[#766F73]"
                  >
                    已复核
                  </BeautyBadge>
                  <BeautyBadge v-else class="border-[#E8CCA0] bg-[#FFF7EA] font-bold text-[#B9822B]">待复核</BeautyBadge>
                </td>
                <td class="p-3 text-right">
                  <button
                    type="button"
                    class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Icon icon="lucide:eye" :size="16" /> 查阅原卷
                  </button>
                </td>
              </tr>
              <tr v-if="filteredReviewCandidates.length === 0">
                <td :colspan="reviewingTask?.status === '复核结束' ? 10 : 6" class="p-8 text-center text-sm text-[#9A9396]">
                  暂无符合条件的考生成绩
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <template v-if="reviewingTask?.status === '复核结束'">
            <button
              type="button"
              class="inline-flex h-9 items-center rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
              @click="reviewingTask = null"
            >
              关闭
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="inline-flex h-9 items-center rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
              @click="reviewingTask = null"
            >
              稍后再复核
            </button>
            <button
              type="button"
              class="inline-flex h-9 items-center rounded-md bg-[#B9822B] px-4 text-sm font-medium text-white shadow-none transition-colors hover:bg-[#A67327]"
              @click="reviewingTask = null"
            >
              一键确认无误结出成绩
            </button>
          </template>
        </div>
      </template>
    </el-dialog>

    <!-- 考试结果与洞察 -->
    <el-dialog
      v-model="insightOpen"
      width="1100px"
      append-to-body
      class="!p-0"
      body-class="!max-h-[80vh] !overflow-y-auto !bg-[#F8F5F3] !p-6"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E5DED8] !bg-white !px-6 !pt-5 !pb-4"
    >
      <template #header>
        <div class="flex flex-col text-[#242124]">
          <span class="flex items-center text-lg">
            <Icon icon="lucide:trending-up" :size="20" class="mr-2 text-[#3B8F72]" />
            考试结果与洞察
          </span>
          <span data-i18n-skip="true" class="mt-1 text-xs font-normal text-[#766F73]">{{ insightTask?.title }}</span>
        </div>
      </template>
      <div class="flex flex-col gap-6">
        <div class="grid shrink-0 grid-cols-4 gap-4">
          <div class="rounded-xl border-none bg-white p-4 shadow-sm">
            <span class="mb-2 text-xs font-bold tracking-wider text-[#766F73] uppercase">平均得分</span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#242124]">{{ MOCK_INSIGHT_DATA.avgScore }}</span>
              <span class="mb-1 text-sm font-medium text-[#9A9396]">/ 100</span>
            </div>
          </div>
          <div class="rounded-xl border-none bg-white p-4 shadow-sm">
            <span class="mb-2 text-xs font-bold tracking-wider text-[#766F73] uppercase">整体通过率</span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#3B8F72]">{{ MOCK_INSIGHT_DATA.passRate }}%</span>
              <span class="mb-1.5 line-clamp-1 text-xs font-medium text-[#9A9396]">≥ 80分合格</span>
            </div>
          </div>
          <div class="rounded-xl border-none bg-white p-4 shadow-sm">
            <span class="mb-2 text-xs font-bold tracking-wider text-[#766F73] uppercase">最高分</span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#242124]">{{ MOCK_INSIGHT_DATA.highestScore }}</span>
              <span class="mb-1 text-sm font-medium text-[#9A9396]">/ 100</span>
            </div>
          </div>
          <div class="rounded-xl border-none bg-white p-4 shadow-sm">
            <span class="mb-2 text-xs font-bold tracking-wider text-[#766F73] uppercase">最低分</span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#242124]">{{ MOCK_INSIGHT_DATA.lowestScore }}</span>
              <span class="mb-1 text-sm font-medium text-[#9A9396]">/ 100</span>
            </div>
          </div>
        </div>

        <div class="shrink-0 rounded-xl border-none bg-white shadow-sm">
          <div class="border-b border-solid border-slate-50 p-5 pb-3">
            <div class="flex items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:bar-chart-3" :size="16" class="mr-2 text-[#3B8F72]" />成绩分布直方图
            </div>
            <p class="mt-1 text-xs text-[#766F73]">按本次考试最终得分区间统计人数</p>
          </div>
          <div class="p-5">
            <Echart :options="histogramOption" height="260px" />
          </div>
        </div>

        <div class="shrink-0 rounded-xl border-none bg-white shadow-sm">
          <div class="border-b border-solid border-slate-50 p-5 pb-3">
            <div class="flex items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:users" :size="16" class="mr-2 text-[#3B8F72]" />不同职位通过率
            </div>
            <p class="mt-1 text-xs text-[#766F73]">按考生职位匹配对应及格分数线后统计</p>
          </div>
          <div class="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="summary in insightPositionPassSummaries"
              :key="`${summary.positionName}-${summary.passScore}`"
              class="rounded-xl border border-solid border-[#E9E4DF] bg-[#FCFAF8] p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-bold text-[#242124]">{{ summary.positionName }}</p>
                  <p class="mt-1 text-xs text-[#766F73]">及格线 {{ summary.passScore }} 分</p>
                </div>
                <span class="rounded-full px-2 py-0.5 text-xs font-bold" :class="passRateTone(summary.passRate)">
                  {{ summary.passRate }}%
                </span>
              </div>
              <BeautyProgress
                :value="summary.passRate"
                track-class="mt-3 h-2 bg-[#F1ECE8]"
                :indicator-class="passRateBar(summary.passRate)"
              />
              <div class="mt-2 flex justify-between text-[11px] text-[#766F73]">
                <span>及格 {{ summary.passed }} 人</span>
                <span>参考 {{ summary.total }} 人</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid flex-1 grid-cols-2 gap-6">
          <div class="flex flex-col rounded-xl border-none bg-white shadow-sm">
            <div class="shrink-0 border-b border-solid border-slate-50 p-5 pb-3">
              <div class="flex items-center text-sm font-bold text-[#242124]">
                <Icon icon="lucide:help-circle" :size="16" class="mr-2 text-rose-500" /> 高频错题 / 知识薄弱点
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-5">
              <div class="space-y-4">
                <div v-for="(gap, i) in MOCK_INSIGHT_DATA.knowledgeGaps" :key="i">
                  <div class="mb-1 flex justify-between text-xs">
                    <span class="font-medium text-[#3F3A3D]">{{ gap.title }}</span>
                    <span class="font-bold text-rose-600">{{ t(`错误率 ${gap.errorRate}%`) }}</span>
                  </div>
                  <BeautyProgress :value="gap.errorRate" track-class="h-2 bg-slate-100" indicator-class="bg-rose-400" />
                </div>
              </div>
              <div class="mt-6 rounded-xl border border-solid border-blue-100 bg-blue-50/50 p-4 text-xs leading-relaxed font-medium text-blue-800">
                💡 <span class="font-bold">AI 建议：</span> 发现大部分 BA 在“敏感肌换季护肤步骤”和对大促价格异议处理上存在短板，建议后续指派该两门专题课件进行复补。
              </div>
            </div>
          </div>

          <div class="flex flex-col rounded-xl border-none bg-white shadow-sm">
            <div class="shrink-0 border-b border-solid border-slate-50 p-5 pb-3">
              <div class="group relative flex w-fit max-w-full items-center pr-5 text-sm font-bold text-[#242124]">
                <span
                  class="absolute -top-2 -right-1 z-10 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-center text-[9px] leading-4 font-bold text-white shadow-sm backdrop-blur-sm"
                >
                  注
                </span>
                <Icon icon="lucide:trophy" :size="16" class="mr-2 text-[#B9822B]" /> 优秀标杆 (TOP 3)
                <div
                  class="absolute bottom-full left-0 z-80 mb-2 hidden w-72 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm group-hover:block"
                >
                  给研发：同分就按谁早交卷排。
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto">
              <ul>
                <li
                  v-for="(performer, i) in MOCK_INSIGHT_DATA.topPerformers"
                  :key="i"
                  class="flex items-center justify-between border-b border-solid border-slate-50 p-4 transition-colors last:border-b-0 hover:bg-[#F8F5F3]"
                >
                  <div class="flex items-center gap-4">
                    <div
                      class="flex h-8 w-8 items-center justify-center rounded-full font-black"
                      :class="
                        i === 0
                          ? 'bg-[#F7E6C8] text-[#B9822B]'
                          : i === 1
                            ? 'bg-slate-200 text-[#766F73]'
                            : 'bg-orange-100 text-orange-700'
                      "
                    >
                      {{ i + 1 }}
                    </div>
                    <div>
                      <p class="text-sm font-bold text-[#242124]">{{ performer.name }}</p>
                      <p class="text-xs text-[#766F73]">{{ performer.store }}</p>
                    </div>
                  </div>
                  <div class="text-xl font-black text-[#242124]">
                    {{ performer.score }} <span class="text-[10px] font-bold text-[#9A9396]">分</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.beauty-table tbody tr + tr {
  border-top: 1px solid #f1ece8;
}
</style>
