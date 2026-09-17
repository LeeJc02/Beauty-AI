<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { brandTone, getProgressTone, getScoreTone } from '@/beauty/lib/visualTones'
import { formatPointValue, getEmployeeMonthlyPoints, getEmployeeMonthlyPointsFromRate } from '@/beauty/lib/points'
import { useBeautyI18n } from '@/beauty/composables'
// 仅为 unocss 提供 @/beauty/lib/visualTones 等 .ts 工具函数的动态类名（见该文件注释）。
import '@/views/beauty/dashboard/components/toneSafelist'
import AppDownloadButton from '../components/AppDownloadButton.vue'
import BeautyBadge from '../components/BeautyBadge.vue'
import BeautyProgress from '../components/BeautyProgress.vue'
import BeautyTabNav from '../components/BeautyTabNav.vue'
import OngoingTaskCard from '../components/OngoingTaskCard.vue'
import StaffDrilldownPanel from '../components/StaffDrilldownPanel.vue'
import StoreDrilldownPanel from '../components/StoreDrilldownPanel.vue'
import MonthlyPointsFormulaTooltip from '../components/MonthlyPointsFormulaTooltip.vue'
import StorePointsFormulaTooltip from '../components/StorePointsFormulaTooltip.vue'
import type { BAActivityFilter, BAActivityRow, OngoingTask, StaffProfile, StoreProfile } from '../components/types'

/**
 * 总部「全国数据」：对应原型 `pages/HTDashboard.tsx`（1272 行）。
 *
 * 数据与原型一致，全部是页面内演示字面量（原型这三张看板没有接 @/beauty/lib 的业务数据源），
 * 只把「任务卡 / 员工下钻 / 门店下钻 / 徽标 / 进度条 / 公式气泡 / 下载 APP」拆成了同目录子组件。
 */
defineOptions({ name: 'BeautyDashboardNational' })

const router = useRouter()
const { language, t } = useBeautyI18n()

/* ------------------------------------------------------------------ *
 * 任务监控
 * ------------------------------------------------------------------ */
const MOCK_ONGOING_TASKS: OngoingTask[] = [
  {
    id: '2',
    title: '『敏感肌抗老』场景陪练',
    scope: '全国',
    type: '练习任务',
    completed: 850,
    total: 1428,
    progress: 59,
    cycleLabel: '本周',
    frequency: '每周完成 3 次',
    deadlineText: '本周五 (剩余 3 天)',
    startTime: '2026-06-01 00:00',
    endTime: '2026-08-31 23:59',
    isWarning: true,
    badgeClass: 'border-[#BFDCCF] text-[#3B8F72] bg-[#EEF8F4]'
  },
  {
    id: '3',
    title: '全员基础服务礼仪月度测试',
    scope: '全国',
    type: '考试任务',
    completed: 900,
    total: 1428,
    progress: 63,
    deadlineText: '下周五',
    startTime: '2026-07-15 09:00',
    endTime: '2026-07-31 23:59',
    isWarning: false,
    badgeClass: 'border-rose-200 text-rose-600 bg-rose-50'
  },
  {
    id: '4',
    title: '新晋店长管理赋能 (第一期)',
    scope: '全国',
    type: '学习任务',
    completed: 45,
    total: 50,
    progress: 90,
    deadlineText: '无需截止日期 (长期有效)',
    startTime: '2026-06-15 00:00',
    endTime: '2026-09-30 23:59',
    isWarning: false,
    badgeClass: 'border-[#E5DED8] text-[#5D565A] bg-[#F8F5F3]'
  },
  {
    id: '5',
    title: '秋冬面霜系列话术演练',
    scope: '全国',
    type: '练习任务',
    completed: 1000,
    total: 1428,
    progress: 70,
    cycleLabel: '本日',
    frequency: '每日完成 1 次',
    deadlineText: '本月月底',
    startTime: '2026-07-01 00:00',
    endTime: '2026-07-31 23:59',
    isWarning: false,
    badgeClass: 'border-[#E8CCA0] text-[#B9822B] bg-[#FFF7EA]'
  }
]

const TASK_TYPE_FILTERS = [
  { type: '全部任务' as const, icon: 'lucide:clipboard-list' },
  { type: '练习任务' as const, icon: 'lucide:circle-play' },
  { type: '学习任务' as const, icon: 'lucide:book-open' },
  { type: '考试任务' as const, icon: 'lucide:calendar-check' }
]

const TASK_MONTH_OPTIONS = ['2026-06', '2026-07', '2026-08', '2026-09']

const VISIBLE_ONGOING_TASK_COUNT = 4
const HQ_ACTIVE_BA_COUNT = 1428
const HQ_INACTIVE_BA_COUNT = 12

const isTaskActiveInMonth = (task: OngoingTask, month: string) => {
  return (task.startTime ?? '').slice(0, 7) <= month && (task.endTime ?? '').slice(0, 7) >= month
}

const getDateLocale = (lang: 'zh' | 'en' | 'id') => {
  if (lang === 'id') return 'id-ID'
  if (lang === 'en') return 'en-US'
  return 'zh-CN'
}

const formatTaskMonth = (month: string, lang: 'zh' | 'en' | 'id') => {
  const date = new Date(`${month}-01T00:00:00`)
  return new Intl.DateTimeFormat(getDateLocale(lang), { year: 'numeric', month: 'long' }).format(date)
}

const formatTaskTime = (dateTime: string, lang: 'zh' | 'en' | 'id') => {
  const [date, time] = dateTime.split(' ')
  return new Intl.DateTimeFormat(getDateLocale(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(`${date}T${time}:00`))
}

/* ------------------------------------------------------------------ *
 * 数字资产大盘（原型通过 onNavigate 切页，这里换成等价的路由跳转）
 * ------------------------------------------------------------------ */
const NAV_ROUTE_BY_TAB: Record<string, string> = {
  courses_manage: '/courseware/manage',
  ba_avatars: '/ba/avatars',
  ba_scripts: '/ba/scripts',
  ba_quotes: '/ba/quotes',
  exam_bank: '/exam/bank',
  exam_manage: '/exam/assemble'
}

const ASSET_ROWS = [
  {
    title: '在线课件',
    count: '共计: 124 份',
    icon: 'lucide:book-open',
    iconClass: 'bg-rose-100 text-rose-600',
    hoverClass: 'hover:border-rose-200',
    buttonClass: 'text-rose-600 hover:text-white hover:bg-rose-500 border-rose-200 hover:border-rose-500',
    target: 'courses_manage'
  },
  {
    title: '数字人顾客',
    count: '共计: 8 位',
    icon: 'lucide:users',
    iconClass: 'bg-[#DCEFE7] text-[#3B8F72]',
    hoverClass: 'hover:border-[#BFDCCF]',
    buttonClass: 'text-[#3B8F72] hover:text-white hover:bg-[#3B8F72] border-[#BFDCCF] hover:border-[#3B8F72]',
    target: 'ba_avatars'
  },
  {
    title: '场景剧本',
    count: '共计: 35 个',
    icon: 'lucide:message-square',
    iconClass: 'bg-[#F7E6C8] text-[#B9822B]',
    hoverClass: 'hover:border-[#E8CCA0]',
    buttonClass: 'text-[#B9822B] hover:text-white hover:bg-[#B9822B] border-[#E8CCA0] hover:border-[#B9822B]',
    target: 'ba_scripts'
  },
  {
    title: '金句库',
    count: '共计: 850 句',
    icon: 'lucide:text-select',
    iconClass: 'bg-rose-100 text-rose-600',
    hoverClass: 'hover:border-rose-200',
    buttonClass: 'text-rose-600 hover:text-white hover:bg-rose-500 border-rose-200 hover:border-rose-500',
    target: 'ba_quotes'
  },
  {
    title: '题库题目',
    count: '共计: 3,240 题',
    icon: 'lucide:database',
    iconClass: 'bg-rose-100 text-rose-600',
    hoverClass: 'hover:border-rose-200',
    buttonClass: 'text-rose-600 hover:text-white hover:bg-rose-500 border-rose-200 hover:border-rose-500',
    target: 'exam_bank'
  },
  {
    title: '试卷总数',
    count: '共计: 42 份',
    icon: 'lucide:clipboard-list',
    iconClass: 'bg-[#EEF0FF] text-[#4F5FD5]',
    hoverClass: 'hover:border-[#C8CEF8]',
    buttonClass: 'text-[#4F5FD5] hover:text-white hover:bg-[#4F5FD5] border-[#C8CEF8] hover:border-[#4F5FD5]',
    target: 'exam_manage'
  }
]

const handleNavigate = (tab: string) => {
  const path = NAV_ROUTE_BY_TAB[tab]
  if (path) router.push(path)
}

/* ------------------------------------------------------------------ *
 * BA 实时活动
 * ------------------------------------------------------------------ */
const HQ_BA_ACTIVITY_SUMMARY = [
  { label: '在线', value: 38, filterKey: 'online' as const, icon: 'lucide:users', toneClass: 'border-[#BFDCCF] bg-[#EEF8F4] text-[#2F735C]', iconClass: 'text-[#3B8F72]' },
  { label: '离线', value: 62, filterKey: 'offline' as const, icon: 'lucide:clock', toneClass: 'border-[#E5DED8] bg-[#F8F5F3] text-[#5D565A]', iconClass: 'text-[#9A9396]' },
  { label: '正在学习', value: 21, filterKey: 'learning' as const, icon: 'lucide:book-open', toneClass: 'border-rose-200 bg-rose-50 text-rose-700', iconClass: 'text-rose-500' },
  { label: '正在参加考试', value: 8, filterKey: 'exam' as const, icon: 'lucide:calendar-check', toneClass: 'border-[#C8CEF8] bg-[#EEF0FF] text-[#4F5FD5]', iconClass: 'text-[#4F5FD5]' },
  { label: '正在完成任务', value: 9, filterKey: 'task' as const, icon: 'lucide:clipboard-list', toneClass: 'border-[#E8CCA0] bg-[#FFF7EA] text-[#8B621F]', iconClass: 'text-[#B9822B]' }
]

const HQ_BA_ACTIVITY_ROWS: BAActivityRow[] = [
  { id: 'BA001', name: 'Siti Aminah', region: '雅加达区', status: 'online', lastActivity: '刚刚', activityType: 'learning', activity: '课程：敏感肌抗老基础', progress: 72 },
  { id: 'BA041', name: 'Dewi Sartika', region: '泗水区', status: 'online', lastActivity: '1 分钟前', activityType: 'exam', activity: '考试：全员基础服务礼仪月度测试', progress: 46 },
  { id: 'BA071', name: 'Fitri Rahma', region: '雅加达区', status: 'online', lastActivity: '2 分钟前', activityType: 'task', activity: '任务：秋冬面霜系列话术演练', progress: 68 },
  { id: 'BA101', name: 'Putri Ayu', region: '巴厘岛区', status: 'online', lastActivity: '4 分钟前', activityType: 'learning', activity: '课程：新品核心成分区分体验', progress: 91 },
  { id: 'BA112', name: 'Made Laras', region: '巴厘岛区', status: 'online', lastActivity: '6 分钟前', activityType: 'task', activity: '任务：新客破冰沟通场景演练', progress: 35 },
  { id: 'BA142', name: 'Lia Kartika', region: '雅加达区', status: 'online', lastActivity: '8 分钟前', activityType: 'exam', activity: '考试：夏季新品区域通关考核', progress: 82 },
  { id: 'BA153', name: 'Dimas Pratama', region: '雅加达区', status: 'offline', lastActivity: '35 分钟前', activityType: 'idle', activity: '暂无进行中活动', progress: 0 },
  { id: 'BA018', name: 'Maya Putri', region: '雅加达区', status: 'offline', lastActivity: '1 小时前', activityType: 'idle', activity: '暂无进行中活动', progress: 0 },
  { id: 'BA052', name: 'Rani Wulandari', region: '泗水区', status: 'offline', lastActivity: '2 小时前', activityType: 'idle', activity: '暂无进行中活动', progress: 0 },
  { id: 'BA082', name: 'Ayu Permata', region: '雅加达区', status: 'offline', lastActivity: '昨天 18:40', activityType: 'idle', activity: '暂无进行中活动', progress: 0 },
  { id: 'BA123', name: 'Kadek Rina', region: '巴厘岛区', status: 'offline', lastActivity: '昨天 16:12', activityType: 'idle', activity: '暂无进行中活动', progress: 0 },
  { id: 'BA131', name: 'Rina Wijaya', region: '雅加达区', status: 'offline', lastActivity: '7 天前', activityType: 'idle', activity: '暂无进行中活动', progress: 0 }
]

const getBAActivityStatusMeta = (status: BAActivityRow['status']) => {
  if (status === 'online') {
    return {
      label: '在线',
      className: 'border-[#BFDCCF] bg-[#EEF8F4] text-[#2F735C]',
      dotClassName: 'bg-[#3B8F72]'
    }
  }

  return {
    label: '离线',
    className: 'border-[#E5DED8] bg-[#F8F5F3] text-[#5D565A]',
    dotClassName: 'bg-[#C9C1C4]'
  }
}

const getBAActivityTypeClass = (activityType: BAActivityRow['activityType']) => {
  switch (activityType) {
    case 'learning':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'exam':
      return 'border-[#C8CEF8] bg-[#EEF0FF] text-[#4F5FD5]'
    case 'task':
      return 'border-[#E8CCA0] bg-[#FFF7EA] text-[#8B621F]'
    default:
      return 'border-[#E5DED8] bg-[#F8F5F3] text-[#766F73]'
  }
}

const getBAActivityFilterLabel = (filter: BAActivityFilter) => {
  if (filter === 'all') return '所有 BA'
  return HQ_BA_ACTIVITY_SUMMARY.find((item) => item.filterKey === filter)?.label ?? '所有 BA'
}

const doesBAActivityMatchFilter = (row: BAActivityRow, filter: BAActivityFilter) => {
  if (filter === 'all') return true
  if (filter === 'online' || filter === 'offline') return row.status === filter
  return row.activityType === filter
}

/* ------------------------------------------------------------------ *
 * 员工 / 门店档案
 * ------------------------------------------------------------------ */
const HQ_STAFF_PROFILES: Record<string, StaffProfile> = {
  Siti: {
    status: '正常',
    meta: 'Toko Senayan City | 入职 6 个月 | 雅加达区',
    taskCompleted: 8,
    taskTotal: 8,
    taskRate: 100,
    examScore: 98,
    examTrend: [92, 95, 98],
    monthlyPoints: 236,
    pointBreakdown: [
      { label: '学习任务完成', detail: '8/8 已完成', value: '+80', tone: 'text-[#3B8F72]' },
      { label: '考试成绩贡献', detail: '最新均分 98', value: '+98', tone: 'text-[#3B8F72]' },
      { label: '练习任务达标', detail: '5/5 已达标', value: '+58', tone: 'text-[#3B8F72]' }
    ],
    practiceStatus: '已达标',
    practiceStatusClass: 'text-[#3B8F72]',
    scriptProgress: '5/5',
    latestPracticeTask: '敏感肌抗老场景陪练',
    evaluation: '优秀',
    evaluationClass: 'text-[#3B8F72]',
    recentTasks: [
      { name: '敏感肌抗老场景陪练', type: '练习任务', status: '已达标', progress: 100 },
      { name: '全员基础服务礼仪月度测试', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '秋冬面霜系列话术演练', type: '练习任务', status: '进行中', progress: 80 }
    ],
    isAtRisk: false
  },
  Dewi: {
    status: '正常',
    meta: 'Tunjungan Plaza | 入职 8 个月 | 泗水区',
    taskCompleted: 8,
    taskTotal: 8,
    taskRate: 98,
    examScore: 96,
    examTrend: [91, 94, 96],
    monthlyPoints: 228,
    pointBreakdown: [
      { label: '学习任务完成', detail: '8/8 已完成', value: '+78', tone: 'text-[#3B8F72]' },
      { label: '考试成绩贡献', detail: '最新均分 96', value: '+96', tone: 'text-[#3B8F72]' },
      { label: '练习任务达标', detail: '5/5 已达标', value: '+54', tone: 'text-[#3B8F72]' }
    ],
    practiceStatus: '已达标',
    practiceStatusClass: 'text-[#3B8F72]',
    scriptProgress: '5/5',
    latestPracticeTask: '全员基础服务礼仪演练',
    evaluation: '优秀',
    evaluationClass: 'text-[#3B8F72]',
    recentTasks: [
      { name: '全员基础服务礼仪月度测试', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '敏感肌抗老场景陪练', type: '练习任务', status: '已达标', progress: 100 },
      { name: '秋冬面霜系列话术演练', type: '练习任务', status: '进行中', progress: 78 }
    ],
    isAtRisk: false
  },
  Fitri: {
    status: '正常',
    meta: 'Toko Pacific Place | 入职 10 个月 | 雅加达区',
    taskCompleted: 8,
    taskTotal: 8,
    taskRate: 95,
    examScore: 95,
    examTrend: [90, 93, 95],
    monthlyPoints: 219,
    pointBreakdown: [
      { label: '学习任务完成', detail: '8/8 已完成', value: '+76', tone: 'text-[#3B8F72]' },
      { label: '考试成绩贡献', detail: '最新均分 95', value: '+95', tone: 'text-[#3B8F72]' },
      { label: '练习任务达标', detail: '4/5 已达标', value: '+48', tone: 'text-[#B9822B]' }
    ],
    practiceStatus: '已达标',
    practiceStatusClass: 'text-[#3B8F72]',
    scriptProgress: '4/5',
    latestPracticeTask: '秋冬面霜系列话术演练',
    evaluation: '良好',
    evaluationClass: 'text-[#B9822B]',
    recentTasks: [
      { name: '秋冬面霜系列话术演练', type: '练习任务', status: '进行中', progress: 80 },
      { name: '全员基础服务礼仪月度测试', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '新客破冰沟通场景演练', type: '练习任务', status: '已达标', progress: 90 }
    ],
    isAtRisk: false
  },
  Putri: {
    status: '正常',
    meta: 'Beachwalk Center | 入职 4 个月 | 巴厘岛区',
    taskCompleted: 7,
    taskTotal: 8,
    taskRate: 92,
    examScore: 92,
    examTrend: [86, 89, 92],
    monthlyPoints: 207,
    pointBreakdown: [
      { label: '学习任务完成', detail: '7/8 已完成', value: '+70', tone: 'text-[#3B8F72]' },
      { label: '考试成绩贡献', detail: '最新均分 92', value: '+92', tone: 'text-[#3B8F72]' },
      { label: '练习任务达标', detail: '4/5 已达标', value: '+45', tone: 'text-[#B9822B]' }
    ],
    practiceStatus: '已达标',
    practiceStatusClass: 'text-[#3B8F72]',
    scriptProgress: '4/5',
    latestPracticeTask: '新客破冰沟通场景演练',
    evaluation: '良好',
    evaluationClass: 'text-[#B9822B]',
    recentTasks: [
      { name: '新客破冰沟通场景演练', type: '练习任务', status: '已达标', progress: 92 },
      { name: '秋冬面霜系列话术演练', type: '练习任务', status: '进行中', progress: 72 },
      { name: '全员基础服务礼仪月度测试', type: '考试任务', status: '已交卷', progress: 100 }
    ],
    isAtRisk: false
  },
  Rina: {
    status: '高风险',
    meta: 'T. Kelapa Gading | 入职 6 个月 | 雅加达区',
    taskCompleted: 3,
    taskTotal: 8,
    taskRate: 37,
    examScore: 52,
    examTrend: [65, 58, 52],
    monthlyPoints: 58,
    pointBreakdown: [
      { label: '学习任务完成', detail: '3/8 已完成', value: '+24', tone: 'text-rose-600' },
      { label: '考试成绩贡献', detail: '最新均分 52', value: '+22', tone: 'text-rose-600' },
      { label: '练习任务达标', detail: '0/5 未达标', value: '+12', tone: 'text-rose-600' }
    ],
    practiceStatus: '未达标',
    practiceStatusClass: 'text-rose-600',
    scriptProgress: '0/5',
    latestPracticeTask: '敏感肌抗老场景陪练',
    evaluation: '需重点突破',
    evaluationClass: 'text-rose-600',
    recentTasks: [
      { name: '敏感肌抗老场景陪练', type: '练习任务', status: '未达标', progress: 20 },
      { name: '全员基础服务礼仪月度测试', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '秋冬面霜系列话术演练', type: '练习任务', status: '未开始', progress: 0 }
    ],
    isAtRisk: true
  }
}

const HQ_STORE_PROFILES: Record<string, StoreProfile> = {
  'Toko Senayan City (雅加达)': {
    manager: 'Dian',
    baCount: 6,
    avgTaskCompletion: 100,
    avgStudyCount: 28,
    avgPracticeCount: 18,
    avgExamScore: 98,
    employees: [
      { id: 'BA001', name: 'Siti Aminah', monthlyPoints: 236, completionRate: 100, lastExamScore: 98 },
      { id: 'BA018', name: 'Maya Putri', monthlyPoints: 224, completionRate: 100, lastExamScore: 96 },
      { id: 'BA029', name: 'Nadia Sari', monthlyPoints: 218, completionRate: 98, lastExamScore: 95 }
    ]
  },
  'Tunjungan Plaza (泗水)': {
    manager: 'Agus',
    baCount: 12,
    avgTaskCompletion: 100,
    avgStudyCount: 26,
    avgPracticeCount: 16,
    avgExamScore: 96,
    employees: [
      { id: 'BA041', name: 'Dewi Sartika', monthlyPoints: 228, completionRate: 98, lastExamScore: 96 },
      { id: 'BA052', name: 'Rani Wulandari', monthlyPoints: 214, completionRate: 96, lastExamScore: 94 },
      { id: 'BA063', name: 'Tara Lestari', monthlyPoints: 196, completionRate: 92, lastExamScore: 90 }
    ]
  },
  'Toko Pacific Place (雅加达)': {
    manager: 'Budi',
    baCount: 8,
    avgTaskCompletion: 95,
    avgStudyCount: 24,
    avgPracticeCount: 14,
    avgExamScore: 95,
    employees: [
      { id: 'BA071', name: 'Fitri Rahma', monthlyPoints: 219, completionRate: 95, lastExamScore: 95 },
      { id: 'BA082', name: 'Ayu Permata', monthlyPoints: 205, completionRate: 92, lastExamScore: 91 },
      { id: 'BA093', name: 'Intan Sari', monthlyPoints: 198, completionRate: 90, lastExamScore: 89 }
    ]
  },
  'Beachwalk Center (巴厘岛)': {
    manager: 'Wayan',
    baCount: 5,
    avgTaskCompletion: 90,
    avgStudyCount: 21,
    avgPracticeCount: 12,
    avgExamScore: 92,
    employees: [
      { id: 'BA101', name: 'Putri Ayu', monthlyPoints: 207, completionRate: 92, lastExamScore: 92 },
      { id: 'BA112', name: 'Made Laras', monthlyPoints: 188, completionRate: 86, lastExamScore: 84 },
      { id: 'BA123', name: 'Kadek Rina', monthlyPoints: 176, completionRate: 82, lastExamScore: 80 }
    ]
  },
  'Toko Kelapa Gading (雅加达)': {
    manager: 'Budi',
    baCount: 5,
    avgTaskCompletion: 60,
    avgStudyCount: 12,
    avgPracticeCount: 6,
    avgExamScore: 58,
    employees: [
      { id: 'BA131', name: 'Rina Wijaya', monthlyPoints: 58, completionRate: 37, lastExamScore: 52 },
      { id: 'BA142', name: 'Lia Kartika', monthlyPoints: 92, completionRate: 58, lastExamScore: 61 },
      { id: 'BA153', name: 'Dimas Pratama', monthlyPoints: 106, completionRate: 65, lastExamScore: 68 }
    ]
  }
}

const getStoreMonthlyPoints = (store: StoreProfile) => {
  const employeeCount = store.employees.length
  if (employeeCount === 0) return 0

  const totalPoints = store.employees.reduce((sum, employee) => {
    return sum + getEmployeeMonthlyPointsFromRate(employee.completionRate, employee.lastExamScore)
  }, 0)
  return totalPoints / employeeCount
}

const formatStoreMonthlyPoints = (store: StoreProfile) => formatPointValue(getStoreMonthlyPoints(store))

/** 员工排行（原型表格里逐行写死的数据与展示值；积分按原型口径实时计算）。 */
const STAFF_RANK_ROWS = [
  { name: 'Siti', region: '雅加达区 | Toko Senayan City', rank: '1', rankClass: 'text-[#B9822B]', rate: '100%', score: 98, risk: false },
  { name: 'Dewi', region: '泗水区 | Tunjungan Plaza', rank: '2', rankClass: 'text-[#9A9396]', rate: '98%', score: 96, risk: false },
  { name: 'Fitri', region: '雅加达区 | Toko Pacific Place', rank: '3', rankClass: 'text-[#8B621F]', rate: '95%', score: 95, risk: false },
  { name: 'Putri', region: '巴厘岛区 | Beachwalk Center', rank: '4', rankClass: 'text-[#9A9396]', rate: '92%', score: 92, risk: false },
  { name: 'Rina', region: '雅加达区 | T. Kelapa Gading', rank: '342', rankClass: 'text-rose-400', rate: '37%', score: 52, risk: true }
]

const staffMonthlyPoints = (name: string) =>
  getEmployeeMonthlyPoints(HQ_STAFF_PROFILES[name].taskCompleted, HQ_STAFF_PROFILES[name].examScore)

/** 门店排行（原型表格里逐行写死的数据与展示值）。 */
const STORE_RANK_ROWS = [
  { name: 'Toko Senayan City (雅加达)', rank: '1', rankClass: 'text-[#B9822B]', attendee: '6/6', rate: '100%', rateClass: 'text-[#3F3A3D]', score: 98, risk: false },
  { name: 'Tunjungan Plaza (泗水)', rank: '2', rankClass: 'text-[#9A9396]', attendee: '12/12', rate: '100%', rateClass: 'text-[#3F3A3D]', score: 96, risk: false },
  { name: 'Toko Pacific Place (雅加达)', rank: '3', rankClass: 'text-[#8B621F]', attendee: '8/8', rate: '95%', rateClass: 'text-[#3F3A3D]', score: 95, risk: false },
  { name: 'Beachwalk Center (巴厘岛)', rank: '4', rankClass: 'text-[#9A9396]', attendee: '5/5', rate: '90%', rateClass: 'text-[#3F3A3D]', score: 92, risk: false },
  { name: 'Toko Kelapa Gading (雅加达)', rank: '85', rankClass: 'text-rose-500', attendee: '3/5', rate: '60%', rateClass: 'text-rose-600', score: 58, risk: true }
]

/* ------------------------------------------------------------------ *
 * 交互状态
 * ------------------------------------------------------------------ */
const showAllTasks = ref(false)
const selectedTaskMonth = ref('2026-07')
const taskTypeFilter = ref<string>('全部任务')
const showBaActivityDialog = ref(false)
const baActivityFilter = ref<BAActivityFilter>('all')
const selectedStaff = ref<string | null>(null)
const selectedStore = ref<string | null>(null)
const activeTab = ref('staff')

const selectedStaffProfile = computed<StaffProfile>(
  () => (selectedStaff.value ? HQ_STAFF_PROFILES[selectedStaff.value] : undefined) ?? HQ_STAFF_PROFILES.Rina
)
const selectedStoreProfile = computed<StoreProfile>(
  () =>
    (selectedStore.value ? HQ_STORE_PROFILES[selectedStore.value] : undefined) ??
    HQ_STORE_PROFILES['Toko Kelapa Gading (雅加达)']
)
const filteredBAActivityRows = computed(() =>
  HQ_BA_ACTIVITY_ROWS.filter((row) => doesBAActivityMatchFilter(row, baActivityFilter.value))
)
const baActivityFilterLabel = computed(() => getBAActivityFilterLabel(baActivityFilter.value))
const tasksInSelectedMonth = computed(() =>
  MOCK_ONGOING_TASKS.filter((task) => isTaskActiveInMonth(task, selectedTaskMonth.value))
)
const filteredTasks = computed(() =>
  taskTypeFilter.value === '全部任务'
    ? tasksInSelectedMonth.value
    : tasksInSelectedMonth.value.filter((task) => task.type === taskTypeFilter.value)
)

const openBaActivityDialog = () => {
  baActivityFilter.value = 'all'
  showBaActivityDialog.value = true
}

const handleBaActivityCardKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openBaActivityDialog()
  }
}

const toggleBaActivityFilter = (filterKey: BAActivityFilter) => {
  baActivityFilter.value = baActivityFilter.value === filterKey ? 'all' : filterKey
}
</script>

<template>
  <div class="flex flex-1 flex-col space-y-6 pt-2">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-wider text-[#9A9396]">Dashboard</p>
        <h2 class="text-xl font-bold text-[#242124]">{{ t('全国培训概览') }}</h2>
      </div>
      <AppDownloadButton />
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        role="button"
        tabindex="0"
        class="cursor-pointer overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-500/25"
        @click="openBaActivityDialog"
        @keydown="handleBaActivityCardKeyDown"
      >
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">全国当前已激活BA数</div>
          <Icon icon="lucide:users" :size="16" class="text-rose-400" />
        </div>
        <div class="p-4 pt-2">
          <div class="flex items-end justify-between leading-none">
            <div>
              <span class="text-3xl font-bold text-[#242124]">{{ HQ_ACTIVE_BA_COUNT.toLocaleString('en-US') }}</span>
              <p class="mt-1 text-[10px] font-medium text-[#9A9396]">（{{ HQ_INACTIVE_BA_COUNT }} 人未激活）</p>
            </div>
            <span class="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">实时</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">本月课件学习次数</div>
          <Icon icon="lucide:book-open" :size="16" class="text-rose-400" />
        </div>
        <div class="p-4 pt-2">
          <div class="mb-2 flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">45.2<span class="ml-1 text-lg font-medium text-[#766F73]">k</span></span>
            <span class="rounded-md bg-[#F3F5FF] px-2 py-1 text-[10px] font-bold text-[#4F5FD5]">环比 ↑ 12%</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">本月平均任务完成率</div>
          <Icon icon="lucide:calendar-check" :size="16" class="text-[#3B8F72]" />
        </div>
        <div class="p-4 pt-2">
          <div class="mb-2 flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">88.5%</span>
            <span class="rounded-md bg-[#EEF8F4] px-2 py-1 text-[10px] font-bold text-[#3B8F72]">环比 ↑ 4.2%</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">本月全国练习总次数</div>
          <Icon icon="lucide:clock" :size="16" class="text-amber-400" />
        </div>
        <div class="p-4 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">12.4<span class="ml-1 text-lg font-medium text-[#766F73]">k</span></span>
            <span class="rounded-md bg-[#FFF7EA] px-2 py-1 text-[10px] font-bold text-[#B9822B]">约 3.2 万小时</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid h-full min-h-[460px] flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="flex flex-col">
        <div class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
          <div class="border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
            <div class="flex items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:database" :size="16" class="mr-2 text-rose-500" /> 数字资产大盘 (全局通览)
            </div>
          </div>
          <div class="flex flex-1 flex-col space-y-4 p-4">
            <div class="flex flex-1 flex-col content-start gap-3">
              <div
                v-for="asset in ASSET_ROWS"
                :key="asset.title"
                class="group flex cursor-pointer items-center justify-between rounded-xl border border-[#E9E4DF] bg-[#F8F5F3] p-3 transition-colors"
                :class="asset.hoverClass"
              >
                <div class="flex items-center space-x-3">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                    :class="asset.iconClass"
                  >
                    <Icon :icon="asset.icon" :size="20" />
                  </div>
                  <div>
                    <div class="text-sm font-bold text-[#242124]">{{ asset.title }}</div>
                    <div class="mt-0.5 text-[10px] font-medium text-[#766F73]">{{ asset.count }}</div>
                  </div>
                </div>
                <button
                  type="button"
                  class="flex shrink-0 items-center rounded-md border bg-white px-2.5 py-1 text-[11px] font-bold shadow-sm transition-colors"
                  :class="asset.buttonClass"
                  @click="handleNavigate(asset.target)"
                >
                  查看
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col">
        <div class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
          <div class="flex flex-row items-center justify-between border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
            <div class="flex items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:calendar-check" :size="16" class="mr-2 text-rose-500" /> 全国任务监控 (进行中)
            </div>
            <button
              type="button"
              class="flex items-center text-[10px] font-bold text-rose-600 hover:underline"
              @click="showAllTasks = true"
            >
              查看全部任务 <Icon icon="lucide:arrow-right" :size="12" class="ml-1" />
            </button>
          </div>
          <div class="flex flex-1 flex-col space-y-4 overflow-y-auto p-4">
            <OngoingTaskCard
              v-for="task in MOCK_ONGOING_TASKS.slice(0, VISIBLE_ONGOING_TASK_COUNT)"
              :key="task.id"
              :task="task"
            >
              <template #footer>
                <div class="mt-3 flex items-center text-[10px] text-[#9A9396]">
                  <Icon v-if="task.isWarning" icon="lucide:triangle-alert" :size="12" class="mr-1 text-[#B9822B]" />
                  {{ task.deadlineText !== '无需截止日期 (长期有效)' ? `截止日期: ${task.deadlineText}` : task.deadlineText }}
                </div>
              </template>
            </OngoingTaskCard>

            <div
              v-if="MOCK_ONGOING_TASKS.length > VISIBLE_ONGOING_TASK_COUNT"
              class="mt-auto w-full py-2 text-center text-xs font-bold text-[#9A9396]"
            >
              其他 {{ MOCK_ONGOING_TASKS.length - VISIBLE_ONGOING_TASK_COUNT }} 个任务进行中
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col">
        <div class="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-slate-800 text-white shadow-sm">
          <div class="absolute right-0 top-0 p-4 opacity-10">
            <Icon icon="lucide:brain-circuit" :size="96" />
          </div>
          <div class="insight-note relative z-30 border-b border-slate-700 bg-slate-900/50 p-4">
            <span
              class="absolute right-3 top-3 z-20 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-center text-[9px] font-bold leading-4 text-white shadow-sm backdrop-blur-sm"
            >注</span>
            <div class="flex items-center text-sm font-bold text-white">
              <Icon icon="lucide:brain-circuit" :size="16" class="mr-2 text-rose-400" /> AI 自动洞察: 全国核心薄弱点
            </div>
            <div class="mt-1 text-[10px] text-[#9A9396]">该洞察基于近期数据生成，每周刷新</div>
            <div
              class="insight-note__tip absolute right-3 top-full z-[80] mt-2 w-96 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm"
            >
              给研发：每周离线跑一次，只扫近 7-14 天聚合数据：任务完成率、考试题目错误率、陪练场景卡点率、语音转写标签统计、门店/区域 Top N。为降低 token，先用 SQL/规则聚合出 Top 20 候选，每个候选只传指标、趋势和 2-3 条短样例，不传全量原文/录音；结果缓存为周报，低置信度再二次调用模型。
            </div>
          </div>
          <div class="relative z-10 flex-1 space-y-4 overflow-y-auto p-4">
            <div class="flex flex-col space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 backdrop-blur-sm">
              <div class="flex items-start justify-between">
                <span class="text-xs font-bold text-rose-100">TOP 1: 新品核心成分区分体验</span>
                <BeautyBadge variant="destructive" class="border-none bg-rose-500 px-1.5 py-0 text-[9px] text-white">
                  68% 高频卡点
                </BeautyBadge>
              </div>
              <p class="text-[10px] leading-relaxed text-[#C9C1C4]">
                <span class="font-bold tracking-wide text-rose-400">💡 AI 结论：</span> 大量 BA 无法通过情景演练清晰表述双萃系列 "亲水亲油" 的黄金比例，当面对敏感肌顾客时极易背错浓度配比。
              </p>
            </div>

            <div class="flex flex-col space-y-2 rounded-xl border border-[#B9822B]/30 bg-[#B9822B]/10 p-3 backdrop-blur-sm">
              <div class="flex items-start justify-between">
                <span class="text-xs font-bold text-amber-100">TOP 2: 竞对异议处理 (价格向)</span>
                <BeautyBadge variant="outline" class="border-[#B9822B]/50 px-1.5 py-0 text-[9px] font-bold text-amber-300">
                  42% 卡顿超5s
                </BeautyBadge>
              </div>
              <p class="text-[10px] leading-relaxed text-[#C9C1C4]">
                <span class="font-bold tracking-wide text-amber-400">💡 AI 结论：</span> 语音识别显示，员工在被质问 "XX牌更便宜为什么要买你们的" 时，卡顿显著，缺少差异化卖点和情绪价值支撑。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-6 pt-6">
      <div class="flex min-h-[460px] w-full flex-1 flex-col gap-0">
        <BeautyTabNav
          v-model="activeTab"
          :tabs="[
            { key: 'staff', label: '全国员工排行' },
            { key: 'store', label: '全国门店培训排行' }
          ]"
          list-class="h-12 w-full justify-start overflow-hidden rounded-t-xl rounded-b-none border border-b-0 border-[#E9E4DF] bg-white p-0 shadow-sm"
        />

        <div v-show="activeTab === 'staff'" class="mt-0 flex-1 outline-none">
          <div class="flex h-full flex-col">
            <StaffDrilldownPanel
              v-if="selectedStaff"
              :staff-name="selectedStaff"
              :profile="selectedStaffProfile"
              bordered
              @back="selectedStaff = null"
            />
            <div
              v-else
              class="beauty-panel-zoom flex h-full flex-col overflow-hidden rounded-b-xl rounded-t-none border border-t-0 border-[#E9E4DF] bg-white shadow-sm"
            >
              <div class="border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
                <div class="flex items-center justify-between text-sm font-bold text-[#242124]">
                  <span class="flex items-center">
                    <Icon icon="lucide:user" :size="16" class="mr-2 text-rose-500" /> 全国员工学习力排名
                  </span>
                </div>
                <div class="mt-1 text-[10px] uppercase tracking-widest">点击员工姓名下钻个人履历</div>
              </div>
              <div class="h-[400px] flex-1 overflow-auto p-0">
                <table class="responsive-data-table w-full text-sm">
                  <thead class="sticky top-0 border-y border-[#E9E4DF] bg-[#F8F5F3]/50 text-left text-[10px] uppercase tracking-wider text-[#9A9396]">
                    <tr>
                      <th class="table-rank-cell w-16 px-4 py-2.5 text-center font-bold">Rank</th>
                      <th class="min-w-32 px-4 py-2.5 font-bold">员工姓名</th>
                      <th class="hidden w-1/4 px-2 py-2.5 font-bold sm:table-cell">所属区域/门店</th>
                      <th class="table-compact-cell px-3 py-2.5 text-center font-bold" :class="brandTone.textClass">
                        <MonthlyPointsFormulaTooltip />
                      </th>
                      <th class="table-compact-cell px-3 py-2.5 text-center font-bold">任务完成率</th>
                      <th class="table-compact-cell px-5 py-2.5 text-right font-bold text-[#766F73]">最新考试平均分</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                    <tr
                      v-for="row in STAFF_RANK_ROWS"
                      :key="row.name"
                      class="group cursor-pointer transition-colors hover:bg-[#F8F5F3]"
                      :class="row.risk ? 'bg-rose-50/20 hover:bg-rose-50/50' : ''"
                      @click="selectedStaff = row.name"
                    >
                      <td class="table-rank-cell px-4 py-3 text-center font-bold" :class="row.rankClass">{{ row.rank }}</td>
                      <td
                        class="flex items-center px-4 py-3 font-bold transition-colors"
                        :class="row.risk ? 'text-rose-600 group-hover:text-rose-800' : 'text-[#242124] group-hover:text-rose-600'"
                      >
                        {{ row.name }}
                      </td>
                      <td class="hidden px-2 py-3 text-[10px] text-[#766F73] sm:table-cell">{{ row.region }}</td>
                      <td class="px-3 py-3 text-center font-bold" :class="brandTone.textClass">{{ staffMonthlyPoints(row.name) }}</td>
                      <td class="px-3 py-3 text-center font-medium" :class="row.risk ? 'text-rose-600' : 'text-[#3F3A3D]'">{{ row.rate }}</td>
                      <td class="px-5 py-3 text-right text-base font-bold" :class="getScoreTone(row.score)">{{ row.score }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'store'" class="mt-0 flex-1 outline-none">
          <div class="flex h-full flex-col">
            <StoreDrilldownPanel
              v-if="selectedStore"
              :store-name="selectedStore"
              :profile="selectedStoreProfile"
              bordered
              @back="selectedStore = null"
            />
            <div
              v-else
              class="beauty-panel-zoom flex h-full flex-col overflow-hidden rounded-b-xl rounded-t-none border border-t-0 border-[#E9E4DF] bg-white shadow-sm"
            >
              <div class="border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
                <div class="flex items-center justify-between text-sm font-bold text-[#242124]">
                  <span class="flex items-center">
                    <Icon icon="lucide:building" :size="16" class="mr-2 text-rose-500" /> 全国门店综合榜
                  </span>
                </div>
                <div class="mt-1 text-[10px] uppercase tracking-widest">点击门店进入管理微档案</div>
              </div>
              <div class="h-[400px] flex-1 overflow-y-auto p-0">
                <table class="w-full text-sm">
                  <thead class="sticky top-0 border-y border-[#E9E4DF] bg-[#F8F5F3]/50 text-left text-[10px] uppercase tracking-wider text-[#9A9396]">
                    <tr>
                      <th class="w-12 px-5 py-2.5 text-center font-bold">Rank</th>
                      <th class="px-4 py-2.5 font-bold">门店名称</th>
                      <th class="hidden px-2 py-2.5 text-center font-bold sm:table-cell">参训人数</th>
                      <th class="px-3 py-2.5 text-center font-bold" :class="brandTone.textClass">
                        <StorePointsFormulaTooltip />
                      </th>
                      <th class="px-3 py-2.5 text-center font-bold">任务完成率</th>
                      <th class="px-5 py-2.5 text-right font-bold text-[#766F73]">最新考试平均分</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                    <tr
                      v-for="row in STORE_RANK_ROWS"
                      :key="row.name"
                      class="group cursor-pointer transition-colors hover:bg-[#F8F5F3]"
                      :class="row.risk ? 'bg-rose-50/20 hover:bg-rose-50/50' : ''"
                      @click="selectedStore = row.name"
                    >
                      <td class="px-5 py-3 text-center font-bold" :class="row.rankClass">{{ row.rank }}</td>
                      <td
                        class="px-4 py-3 font-bold transition-colors"
                        :class="row.risk ? 'text-rose-600 group-hover:text-rose-800' : 'text-[#242124] group-hover:text-rose-600'"
                      >
                        {{ row.name }}
                      </td>
                      <td
                        class="hidden px-2 py-3 text-center font-mono text-[10px] sm:table-cell"
                        :class="row.risk ? 'text-rose-500' : 'text-[#766F73]'"
                      >
                        {{ row.attendee }}
                      </td>
                      <td class="px-3 py-3 text-center font-bold" :class="brandTone.textClass">
                        {{ formatStoreMonthlyPoints(HQ_STORE_PROFILES[row.name]) }}
                      </td>
                      <td class="px-3 py-3 text-center font-medium" :class="row.rateClass">{{ row.rate }}</td>
                      <td class="px-5 py-3 text-right text-base font-bold" :class="getScoreTone(row.score)">{{ row.score }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showBaActivityDialog" width="1152px" top="7vh" append-to-body class="beauty-ba-activity-dialog">
      <template #header>
        <div class="flex flex-col gap-1 text-[#242124]">
          <span class="flex items-center text-lg font-bold">
            <Icon icon="lucide:users" :size="20" class="mr-2 text-rose-500" />
            今日 BA 活动情况
          </span>
          <span class="text-xs font-medium text-[#766F73]">
            全国已激活 BA {{ HQ_ACTIVE_BA_COUNT.toLocaleString('en-US') }} 人，可按活动状态筛选查看
          </span>
        </div>
      </template>

      <div class="flex h-[68vh] flex-col gap-4 overflow-hidden">
        <div class="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
          <button
            v-for="item in HQ_BA_ACTIVITY_SUMMARY"
            :key="item.label"
            type="button"
            class="rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            :class="[item.toneClass, baActivityFilter === item.filterKey ? 'shadow-md ring-2 ring-[#242124]/15 ring-offset-2' : '']"
            :aria-pressed="baActivityFilter === item.filterKey"
            @click="toggleBaActivityFilter(item.filterKey)"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-bold">{{ item.label }}</p>
                <p class="mt-1 text-2xl font-black leading-none">{{ item.value }}</p>
              </div>
              <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                <Icon :icon="item.icon" :size="16" :class="item.iconClass" />
              </div>
            </div>
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#E9E4DF] bg-white shadow-sm">
          <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E9E4DF] bg-[#F8F5F3]/60 px-4 py-3">
            <div>
              <h3 class="text-sm font-bold text-[#242124]">{{ baActivityFilterLabel }}列表</h3>
              <p class="mt-0.5 text-[11px] text-[#766F73]">
                当前显示 {{ filteredBAActivityRows.length }} 人，支持按区域、在线状态、最后活动时间、当前活动与进度查看
              </p>
            </div>
            <div class="flex items-center gap-3">
              <button
                v-if="baActivityFilter !== 'all'"
                type="button"
                class="rounded-md border border-[#E5DED8] bg-white px-2.5 py-1 text-[11px] font-bold text-[#5D565A] transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                @click="baActivityFilter = 'all'"
              >
                全部 BA
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            <table class="responsive-data-table w-full min-w-[960px] text-left text-sm">
              <thead class="sticky top-0 z-10 border-b border-[#E9E4DF] bg-white text-[10px] font-bold text-[#9A9396]">
                <tr>
                  <th class="px-4 py-3">BA</th>
                  <th class="px-3 py-3">区域</th>
                  <th class="px-3 py-3">在线 / 离线状态</th>
                  <th class="px-3 py-3">Last Activity</th>
                  <th class="px-3 py-3">正在进行的活动</th>
                  <th class="px-3 py-3">当前进度</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#F0ECE8]">
                <tr v-for="row in filteredBAActivityRows" :key="row.id" class="transition-colors hover:bg-[#F8F5F3]/70">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-black text-rose-600 ring-1 ring-rose-100">
                        {{ row.name.slice(0, 1) }}
                      </div>
                      <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-[#242124]">{{ row.name }}</p>
                        <p class="text-[10px] font-medium text-[#9A9396]">{{ row.id }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-xs font-medium text-[#5D565A]">{{ row.region }}</td>
                  <td class="px-3 py-3">
                    <BeautyBadge
                      variant="outline"
                      :class="['gap-1.5 border text-[10px] font-bold', getBAActivityStatusMeta(row.status).className]"
                    >
                      <span class="h-1.5 w-1.5 rounded-full" :class="getBAActivityStatusMeta(row.status).dotClassName" ></span>
                      {{ getBAActivityStatusMeta(row.status).label }}
                    </BeautyBadge>
                  </td>
                  <td class="px-3 py-3 text-xs font-medium text-[#766F73]">{{ row.lastActivity }}</td>
                  <td class="px-3 py-3">
                    <BeautyBadge
                      variant="outline"
                      :class="['max-w-[260px] justify-start truncate border text-[10px] font-medium', getBAActivityTypeClass(row.activityType)]"
                    >
                      {{ row.activity }}
                    </BeautyBadge>
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex min-w-[140px] items-center gap-2">
                      <BeautyProgress
                        :value="row.progress"
                        class="h-1.5 bg-slate-100"
                        :indicator-class="row.activityType === 'idle' ? 'bg-[#C9C1C4]' : getProgressTone(row.progress).indicatorClass"
                      />
                      <span
                        class="w-9 text-right text-[10px] font-bold"
                        :class="row.activityType === 'idle' ? 'text-[#9A9396]' : getProgressTone(row.progress).textClass"
                      >
                        {{ row.activityType === 'idle' ? '-' : `${row.progress}%` }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="filteredBAActivityRows.length === 0"
              class="flex h-32 items-center justify-center text-xs font-medium text-[#9A9396]"
            >
              当前筛选下暂无 BA
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="showAllTasks"
      :title="t('全国任务监控 (所有进行中)')"
      width="672px"
      append-to-body
      top="8vh"
      class="national-all-tasks-dialog"
    >
      <div class="shrink-0 space-y-2.5 border-b border-[#E9E4DF] pb-4">
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <div
            class="inline-flex max-w-full flex-wrap items-center rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-1"
            role="radiogroup"
            aria-label="任务类型筛选"
          >
            <button
              v-for="filter in TASK_TYPE_FILTERS"
              :key="filter.type"
              type="button"
              role="radio"
              :aria-checked="taskTypeFilter === filter.type"
              class="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              :class="taskTypeFilter === filter.type
                ? 'bg-white text-rose-600 shadow-sm ring-1 ring-[#F1D8DC]'
                : 'text-[#766F73] hover:bg-white/70 hover:text-[#242124]'"
              @click="taskTypeFilter = filter.type"
            >
              <Icon :icon="filter.icon" :size="14" class="shrink-0" />
              <span>{{ filter.type }}</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="shrink-0 text-xs font-medium text-[#766F73]">开始时间</span>
            <el-select v-model="selectedTaskMonth" class="beauty-task-month-select" style="width: 9rem">
              <template #prefix>
                <Icon icon="lucide:calendar-range" :size="14" class="text-[#9A9396]" />
              </template>
              <el-option
                v-for="month in TASK_MONTH_OPTIONS"
                :key="month"
                :label="formatTaskMonth(month, language)"
                :value="month"
              />
            </el-select>
          </div>
        </div>
        <p class="text-[11px] font-medium text-[#9A9396]">
          <span>已显示</span> <span>{{ filteredTasks.length }}</span> <span>条任务</span>
        </p>
      </div>
      <div class="max-h-[58vh] space-y-3 overflow-y-auto px-1 py-4">
        <OngoingTaskCard v-for="task in filteredTasks" :key="task.id" :task="task" large>
          <template #footer>
            <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#F1EDE9] pt-3 text-xs font-medium text-[#766F73]">
              <Icon
                v-if="task.isWarning"
                icon="lucide:triangle-alert"
                :size="16"
                class="shrink-0 text-[#B9822B]"
              />
              <Icon v-else icon="lucide:calendar-range" :size="16" class="shrink-0 text-[#9A9396]" />
              <span class="whitespace-nowrap">
                <span class="text-[#9A9396]">开始时间: </span>{{ formatTaskTime(task.startTime ?? '', language) }}
              </span>
              <span class="hidden h-3 w-px bg-[#E5DED8] sm:block" ></span>
              <span class="whitespace-nowrap">
                <span class="text-[#9A9396]">结束时间: </span>{{ formatTaskTime(task.endTime ?? '', language) }}
              </span>
            </div>
          </template>
        </OngoingTaskCard>
        <div
          v-if="filteredTasks.length === 0"
          class="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E5DED8] bg-[#F8F5F3]/60 text-[#9A9396]"
        >
          <Icon icon="lucide:clipboard-list" :size="28" />
          <p class="text-xs font-medium">当前筛选下暂无任务</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.insight-note:hover .insight-note__tip {
  display: block;
}

.beauty-panel-zoom {
  animation: beauty-panel-zoom-in 200ms ease-out;
}

@keyframes beauty-panel-zoom-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

<!-- el-dialog / el-select 的挂载点在 body 下，scoped 样式够不到，这里用唯一类名做局部覆盖。 -->
<style lang="scss">
.beauty-ba-activity-dialog {
  padding: 0;
  background-color: #fcfaf8;
}

.beauty-ba-activity-dialog .el-dialog__header {
  margin: 0;
  padding: 20px 24px;
  background-color: #fff;
  border-bottom: 1px solid #e9e4df;
}

.beauty-ba-activity-dialog .el-dialog__body {
  padding: 16px 24px 24px;
}

.beauty-task-month-select .el-select__wrapper {
  border: 1px solid #e5ded8;
  background-color: #fff;
  box-shadow: none;
}

.beauty-task-month-select .el-select__selected-item {
  font-size: 12px;
  font-weight: 700;
  color: #5d565a;
}
</style>
