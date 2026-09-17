<script setup lang="ts">
import { computed, ref } from 'vue'
import { brandTone, getScoreTone } from '@/beauty/lib/visualTones'
import { getEmployeeMonthlyPoints } from '@/beauty/lib/points'
import { useBeautyI18n } from '@/beauty/composables'
// 仅为 unocss 提供 @/beauty/lib/visualTones 等 .ts 工具函数的动态类名（见该文件注释）。
import '@/views/beauty/dashboard/components/toneSafelist'
import AppDownloadButton from '../components/AppDownloadButton.vue'
import BeautyTabNav from '../components/BeautyTabNav.vue'
import OngoingTaskCard from '../components/OngoingTaskCard.vue'
import StaffDrilldownPanel from '../components/StaffDrilldownPanel.vue'
import StoreDrilldownPanel from '../components/StoreDrilldownPanel.vue'
import MonthlyPointsFormulaTooltip from '../components/MonthlyPointsFormulaTooltip.vue'
import type { OngoingTask, StaffProfile, StoreProfile } from '../components/types'

/**
 * 区域经理（Regional Manager）看板：对应原型 `pages/Dashboard.tsx` 导出的 `RMDashboard`。
 *
 * 原型的 `getRegionalTaskProgressText` 与全国页同构，已并入 OngoingTaskCard；
 * 该页的资产卡没有「新增/查看」按钮（原样保留），高风险 BA 与员工/门店排行的下钻交互保持原样。
 */
defineOptions({ name: 'BeautyRegionalManagerView' })

const { t } = useBeautyI18n()

const REGION_ONGOING_TASKS: OngoingTask[] = [
  {
    id: 'region-task-1',
    title: '夏季新品区域通关考核',
    scope: '区域',
    type: '考试任务',
    completed: 280,
    total: 342,
    progress: 81,
    deadlineText: '本周五 23:59',
    isWarning: true,
    badgeClass: 'border-rose-200 text-rose-600 bg-rose-50'
  },
  {
    id: 'region-task-2',
    title: '新客破冰沟通场景演练',
    scope: '区域',
    type: '练习任务',
    completed: 145,
    total: 342,
    progress: 42,
    cycleLabel: '本日',
    frequency: '每日完成 1 次',
    deadlineText: '2周后',
    isWarning: false,
    badgeClass: 'border-[#E8CCA0] text-[#B9822B] bg-[#FFF7EA]'
  },
  {
    id: 'region-task-3',
    title: '『敏感肌抗老』区域专项陪练',
    scope: '区域',
    type: '练习任务',
    completed: 215,
    total: 342,
    progress: 62,
    cycleLabel: '本周',
    frequency: '每周完成 3 次',
    deadlineText: '下周三',
    isWarning: false,
    badgeClass: 'border-[#BFDCCF] text-[#3B8F72] bg-[#EEF8F4]'
  },
  {
    id: 'region-task-4',
    title: '店长基础服务抽检复训',
    scope: '区域',
    type: '学习任务',
    completed: 78,
    total: 96,
    progress: 81,
    deadlineText: '本月月底',
    isWarning: false,
    badgeClass: 'border-[#E5DED8] text-[#5D565A] bg-[#F8F5F3]'
  }
]

const VISIBLE_REGION_ONGOING_TASK_COUNT = 3

const ASSET_ROWS = [
  {
    title: '区域在线课件',
    count: '共计: 34 份',
    icon: 'lucide:book-open',
    iconClass: 'bg-rose-100 text-rose-600',
    hoverClass: 'hover:border-rose-200'
  },
  {
    title: '区域场景剧本',
    count: '共计: 12 个',
    icon: 'lucide:message-square',
    iconClass: 'bg-[#F7E6C8] text-[#B9822B]',
    hoverClass: 'hover:border-[#E8CCA0]'
  },
  {
    title: '区域题库题目',
    count: '共计: 450 题',
    icon: 'lucide:database',
    iconClass: 'bg-rose-100 text-rose-600',
    hoverClass: 'hover:border-rose-200'
  },
  {
    title: '区域试卷总数',
    count: '共计: 8 份',
    icon: 'lucide:clipboard-list',
    iconClass: 'bg-[#EEF0FF] text-[#4F5FD5]',
    hoverClass: 'hover:border-[#C8CEF8]'
  }
]

/** 高风险 BA 提醒（原型 3 条内联卡片）。 */
const HIGH_RISK_ALERTS = [
  {
    initial: 'R',
    name: 'Rina',
    store: 'Toko Mal Kelapa Gading',
    detail: '连续7天未登录 | 考试 52分 | 陪练 0次',
    cardClass: 'border-rose-100 bg-rose-50/50 hover:bg-rose-50',
    avatarClass: 'border-2 border-rose-200 text-rose-700',
    detailClass: 'text-rose-600',
    italic: false
  },
  {
    initial: 'D',
    name: 'Dewi',
    store: 'Toko Pondok Indah',
    detail: '参与度低：金句跟读20% | 本周仅登录1次',
    cardClass: 'border-[#F2DEC0] bg-[#FFF7EA]/50 hover:bg-[#FFF7EA]',
    avatarClass: 'border-2 border-[#E8CCA0] text-[#8B621F]',
    detailClass: 'text-[#B9822B]',
    italic: false
  },
  {
    initial: 'S',
    name: 'Sari',
    store: 'Toko Gandaria City',
    detail: '考试存疑：AI监考检测到切屏2次',
    cardClass: 'border-[#E9E4DF] bg-[#F8F5F3] hover:bg-[#F1ECE8]',
    avatarClass: 'border border-[#E5DED8] text-[#3F3A3D]',
    detailClass: 'text-[#766F73]',
    italic: true
  }
]

const REGION_STAFF_PROFILES: Record<string, StaffProfile> = {
  Siti: {
    status: '正常',
    meta: 'Toko Senayan City | 入职 6 个月 | 雅加达南区',
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
    recentTasks: [
      { name: '夏季新品区域通关考核', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '新客破冰沟通场景演练', type: '练习任务', status: '已达标', progress: 100 },
      { name: '敏感肌抗老区域专项陪练', type: '练习任务', status: '进行中', progress: 82 }
    ],
    isAtRisk: false
  },
  Fitri: {
    status: '正常',
    meta: 'Toko Pacific Place | 入职 10 个月 | 雅加达南区',
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
    recentTasks: [
      { name: '敏感肌抗老区域专项陪练', type: '练习任务', status: '进行中', progress: 80 },
      { name: '夏季新品区域通关考核', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '新客破冰沟通场景演练', type: '练习任务', status: '已达标', progress: 90 }
    ],
    isAtRisk: false
  },
  Ayu: {
    status: '正常',
    meta: 'Toko Gandaria City | 入职 8 个月 | 雅加达南区',
    taskCompleted: 7,
    taskTotal: 8,
    taskRate: 90,
    examScore: 91,
    examTrend: [86, 88, 91],
    monthlyPoints: 203,
    pointBreakdown: [
      { label: '学习任务完成', detail: '7/8 已完成', value: '+68', tone: 'text-[#3B8F72]' },
      { label: '考试成绩贡献', detail: '最新均分 91', value: '+91', tone: 'text-[#3B8F72]' },
      { label: '练习任务达标', detail: '4/5 已达标', value: '+44', tone: 'text-[#B9822B]' }
    ],
    recentTasks: [
      { name: '夏季新品区域通关考核', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '新客破冰沟通场景演练', type: '练习任务', status: '已达标', progress: 88 },
      { name: '店长基础服务抽检复训', type: '学习任务', status: '已完成', progress: 100 }
    ],
    isAtRisk: false
  },
  Maya: {
    status: '正常',
    meta: 'Toko Pondok Indah | 入职 5 个月 | 雅加达南区',
    taskCompleted: 6,
    taskTotal: 8,
    taskRate: 85,
    examScore: 86,
    examTrend: [78, 82, 86],
    monthlyPoints: 187,
    pointBreakdown: [
      { label: '学习任务完成', detail: '6/8 已完成', value: '+60', tone: 'text-[#B9822B]' },
      { label: '考试成绩贡献', detail: '最新均分 86', value: '+86', tone: 'text-[#B9822B]' },
      { label: '练习任务达标', detail: '3/5 已达标', value: '+41', tone: 'text-[#B9822B]' }
    ],
    recentTasks: [
      { name: '新客破冰沟通场景演练', type: '练习任务', status: '进行中', progress: 72 },
      { name: '夏季新品区域通关考核', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '敏感肌抗老区域专项陪练', type: '练习任务', status: '进行中', progress: 68 }
    ],
    isAtRisk: false
  },
  Rina: {
    status: '高风险',
    meta: 'T. Kelapa Gading | 入职 6 个月 | 雅加达南区',
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
    recentTasks: [
      { name: '新客破冰沟通场景演练', type: '练习任务', status: '未达标', progress: 20 },
      { name: '夏季新品区域通关考核', type: '考试任务', status: '已交卷', progress: 100 },
      { name: '敏感肌抗老区域专项陪练', type: '练习任务', status: '未开始', progress: 0 }
    ],
    isAtRisk: true
  }
}

const REGION_STORE_PROFILES: Record<string, StoreProfile> = {
  'Toko Senayan City': {
    manager: 'Dian',
    baCount: 6,
    avgTaskCompletion: 100,
    avgStudyCount: 28,
    avgPracticeCount: 18,
    avgExamScore: 92,
    employees: [
      { id: 'BA001', name: 'Siti Aminah', monthlyPoints: 236, completionRate: 100, lastExamScore: 98 },
      { id: 'BA018', name: 'Maya Putri', monthlyPoints: 224, completionRate: 100, lastExamScore: 96 },
      { id: 'BA029', name: 'Nadia Sari', monthlyPoints: 218, completionRate: 98, lastExamScore: 92 }
    ]
  },
  'Toko Pacific Place': {
    manager: 'Budi',
    baCount: 8,
    avgTaskCompletion: 95,
    avgStudyCount: 24,
    avgPracticeCount: 14,
    avgExamScore: 87,
    employees: [
      { id: 'BA071', name: 'Fitri Rahma', monthlyPoints: 219, completionRate: 95, lastExamScore: 95 },
      { id: 'BA082', name: 'Ayu Permata', monthlyPoints: 205, completionRate: 92, lastExamScore: 88 },
      { id: 'BA093', name: 'Intan Sari', monthlyPoints: 198, completionRate: 90, lastExamScore: 87 }
    ]
  },
  'Toko Gandaria City': {
    manager: 'Rangga',
    baCount: 5,
    avgTaskCompletion: 90,
    avgStudyCount: 20,
    avgPracticeCount: 11,
    avgExamScore: 81,
    employees: [
      { id: 'BA201', name: 'Ayu Lestari', monthlyPoints: 203, completionRate: 90, lastExamScore: 91 },
      { id: 'BA212', name: 'Sari Nabila', monthlyPoints: 176, completionRate: 84, lastExamScore: 80 },
      { id: 'BA223', name: 'Dewi Laras', monthlyPoints: 158, completionRate: 78, lastExamScore: 74 }
    ]
  },
  'Toko Pondok Indah': {
    manager: 'Maya',
    baCount: 5,
    avgTaskCompletion: 80,
    avgStudyCount: 17,
    avgPracticeCount: 8,
    avgExamScore: 73,
    employees: [
      { id: 'BA301', name: 'Maya Sari', monthlyPoints: 187, completionRate: 85, lastExamScore: 86 },
      { id: 'BA312', name: 'Dewi Puspita', monthlyPoints: 141, completionRate: 70, lastExamScore: 66 },
      { id: 'BA323', name: 'Lestari Wulan', monthlyPoints: 132, completionRate: 65, lastExamScore: 62 }
    ]
  },
  'Toko Kelapa Gading': {
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

/** 区域员工排行（原型表格逐行写死；积分按原型口径实时计算）。 */
const STAFF_RANK_ROWS = [
  { name: 'Siti', store: 'Toko Senayan City', rank: '1', rankClass: 'text-[#B9822B]', rate: '100%', score: 98, risk: false },
  { name: 'Fitri', store: 'Toko Pacific Place', rank: '2', rankClass: 'text-[#9A9396]', rate: '95%', score: 95, risk: false },
  { name: 'Ayu', store: 'Toko Gandaria City', rank: '3', rankClass: 'text-[#8B621F]', rate: '90%', score: 91, risk: false },
  { name: 'Maya', store: 'Toko Pondok Indah', rank: '4', rankClass: 'text-[#9A9396]', rate: '85%', score: 86, risk: false },
  { name: 'Rina', store: 'T. Kelapa Gading', rank: '18', rankClass: 'text-rose-400', rate: '37%', score: 52, risk: true }
]

const staffMonthlyPoints = (name: string) =>
  getEmployeeMonthlyPoints(REGION_STAFF_PROFILES[name].taskCompleted, REGION_STAFF_PROFILES[name].examScore)

/** 区域门店排行（原型表格逐行写死）。 */
const STORE_RANK_ROWS = [
  { name: 'Toko Senayan City', rank: '1', rankClass: 'text-[#B9822B]', attendee: '6/6', rate: '100%', rateClass: 'text-[#3F3A3D]', score: 92, risk: false },
  { name: 'Toko Pacific Place', rank: '2', rankClass: 'text-[#9A9396]', attendee: '8/8', rate: '95%', rateClass: 'text-[#3F3A3D]', score: 87, risk: false },
  { name: 'Toko Gandaria City', rank: '3', rankClass: 'text-[#8B621F]', attendee: '5/5', rate: '90%', rateClass: 'text-[#3F3A3D]', score: 81, risk: false },
  { name: 'Toko Pondok Indah', rank: '4', rankClass: 'text-[#9A9396]', attendee: '4/5', rate: '80%', rateClass: 'text-[#3F3A3D]', score: 73, risk: false },
  { name: 'Toko Kelapa Gading', rank: '5', rankClass: 'text-rose-500', attendee: '3/5', rate: '60%', rateClass: 'text-rose-600', score: 58, risk: true }
]

const showAllTasks = ref(false)
const selectedStaff = ref<string | null>(null)
const selectedStore = ref<string | null>(null)
const activeTab = ref('staff')

const selectedStaffProfile = computed<StaffProfile>(
  () =>
    (selectedStaff.value ? REGION_STAFF_PROFILES[selectedStaff.value] : undefined) ?? REGION_STAFF_PROFILES.Rina
)
const selectedStoreProfile = computed<StoreProfile>(
  () =>
    (selectedStore.value ? REGION_STORE_PROFILES[selectedStore.value] : undefined) ??
    REGION_STORE_PROFILES['Toko Kelapa Gading']
)
const hiddenTaskCount = computed(() => REGION_ONGOING_TASKS.length - VISIBLE_REGION_ONGOING_TASK_COUNT)
</script>

<template>
  <div class="flex flex-1 flex-col space-y-6 pt-2">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-[#242124]">{{ t('区域数据') }}</h1>
      <AppDownloadButton />
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">区域注册BA总数</div>
          <Icon icon="lucide:users" :size="16" class="text-rose-400" />
        </div>
        <div class="p-4 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">342</span>
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
            <span class="text-3xl font-bold text-[#242124]">12.5<span class="ml-1 text-lg font-medium text-[#766F73]">k</span></span>
            <span class="rounded-md bg-[#F3F5FF] px-2 py-1 text-[10px] font-bold text-[#4F5FD5]">环比 ↑ 15%</span>
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
            <span class="text-3xl font-bold text-[#242124]">89.2%</span>
            <span class="rounded-md bg-[#EEF8F4] px-2 py-1 text-[10px] font-bold text-[#3B8F72]">环比 ↑ 5.1%</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">本月区域练习总次数</div>
          <Icon icon="lucide:clock" :size="16" class="text-amber-400" />
        </div>
        <div class="p-4 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">3.1<span class="ml-1 text-lg font-medium text-[#766F73]">k</span></span>
            <span class="rounded-md bg-[#FFF7EA] px-2 py-1 text-[10px] font-bold text-[#B9822B]">约 1.2 万小时</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 items-stretch gap-6 lg:min-h-[430px] lg:grid-cols-3">
      <div class="flex flex-col">
        <div class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
          <div class="border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
            <div class="flex items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:database" :size="16" class="mr-2 text-rose-500" /> 数字资产大盘 (区域通览)
            </div>
          </div>
          <div class="flex flex-1 flex-col space-y-4 overflow-y-auto p-4">
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col lg:col-span-2">
        <div class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
          <div class="flex flex-row items-center justify-between border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
            <div class="flex items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:calendar-check" :size="16" class="mr-2 text-rose-500" /> 区域任务监控 (进行中)
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
              v-for="task in REGION_ONGOING_TASKS.slice(0, VISIBLE_REGION_ONGOING_TASK_COUNT)"
              :key="task.id"
              :task="task"
            >
              <template #footer>
                <div class="mt-3 flex items-center justify-between text-[10px] text-[#9A9396]">
                  <span class="flex items-center">
                    <Icon v-if="task.isWarning" icon="lucide:triangle-alert" :size="12" class="mr-1 text-[#B9822B]" />
                    <Icon v-else icon="lucide:clock" :size="12" class="mr-1" />
                    截止: {{ task.deadlineText }}
                  </span>
                </div>
              </template>
            </OngoingTaskCard>

            <div v-if="hiddenTaskCount > 0" class="w-full pt-1 text-center text-xs font-bold text-[#9A9396]">
              其他 {{ hiddenTaskCount }} 个任务进行中
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-3">
      <div class="flex flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm lg:col-span-1">
        <div class="flex flex-row items-center justify-between border-b border-slate-50 p-5">
          <div class="flex items-center text-base font-bold">
            <span class="mr-2 h-2 w-2 rounded-full bg-rose-500"></span>
            高风险 BA <span class="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-[#9A9396]">3人需关注</span>
          </div>
        </div>
        <div class="flex-1 p-2">
          <div class="space-y-2 overflow-hidden">
            <div
              v-for="alert in HIGH_RISK_ALERTS"
              :key="alert.name"
              class="group flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors"
              :class="alert.cardClass"
            >
              <div class="flex items-center space-x-4">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold"
                  :class="alert.avatarClass"
                >
                  {{ alert.initial }}
                </div>
                <div>
                  <p class="text-sm font-bold text-[#1F1C1F]">
                    {{ alert.name }}
                    <span class="text-xs font-normal tracking-tight text-[#9A9396]">• {{ alert.store }}</span>
                  </p>
                  <p class="mt-0.5 text-[11px]" :class="[alert.detailClass, alert.italic ? 'italic' : '']">
                    {{ alert.detail }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="border-t border-slate-50 bg-white p-4 text-center">
          <p class="text-[11px] font-medium text-[#9A9396]">根据登录、任务、考试和练习记录自动识别</p>
        </div>
      </div>

      <div class="lg:col-span-2">
        <div class="flex min-h-[460px] w-full flex-1 flex-col gap-0 overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
          <BeautyTabNav
            v-model="activeTab"
            :tabs="[
              { key: 'staff', label: '区域员工排行' },
              { key: 'store', label: '门店培训排行' }
            ]"
            list-class="h-12 w-full shrink-0 justify-start overflow-hidden rounded-none border-0 border-b border-[#E9E4DF] bg-white p-0 shadow-none"
          />

          <div v-show="activeTab === 'staff'" class="mt-0 flex-1 overflow-hidden outline-none">
            <div class="flex h-full flex-col">
              <StaffDrilldownPanel
                v-if="selectedStaff"
                :staff-name="selectedStaff"
                :profile="selectedStaffProfile"
                @back="selectedStaff = null"
              />
              <div v-else class="beauty-panel-zoom flex h-full flex-col overflow-hidden bg-white">
                <div class="border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
                  <div class="flex items-center justify-between text-sm font-bold text-[#242124]">
                    <span class="flex items-center">
                      <Icon icon="lucide:user" :size="16" class="mr-2 text-rose-500" /> 区域员工学习力排名
                    </span>
                  </div>
                  <div class="mt-1 text-[10px] uppercase tracking-widest">点击员工姓名下钻个人履历</div>
                </div>
                <div class="flex-1 overflow-auto p-0">
                  <table class="responsive-data-table w-full text-sm">
                    <thead class="sticky top-0 border-y border-[#E9E4DF] bg-[#F8F5F3]/50 text-left text-[10px] uppercase tracking-wider text-[#9A9396]">
                      <tr>
                        <th class="table-rank-cell w-16 px-4 py-2.5 text-center font-bold">Rank</th>
                        <th class="min-w-32 px-4 py-2.5 font-bold">员工姓名</th>
                        <th class="hidden w-1/4 px-2 py-2.5 font-bold sm:table-cell">所属门店</th>
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
                        <td class="hidden px-2 py-3 text-[10px] text-[#766F73] sm:table-cell">{{ row.store }}</td>
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

          <div v-show="activeTab === 'store'" class="mt-0 flex-1 overflow-hidden outline-none">
            <div class="flex h-full flex-col">
              <StoreDrilldownPanel
                v-if="selectedStore"
                :store-name="selectedStore"
                :profile="selectedStoreProfile"
                @back="selectedStore = null"
              />
              <div v-else class="beauty-panel-zoom flex h-full flex-col overflow-hidden bg-white">
                <div class="border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
                  <div class="flex items-center justify-between text-sm font-bold text-[#242124]">
                    <span class="flex items-center">
                      <Icon icon="lucide:building" :size="16" class="mr-2 text-rose-500" /> 区域门店综合榜 (雅加达南区)
                    </span>
                  </div>
                  <div class="mt-1 text-[10px] uppercase tracking-widest">点击门店进入管理微档案</div>
                </div>
                <div class="flex-1 overflow-y-auto p-0">
                  <table class="w-full text-sm">
                    <thead class="sticky top-0 border-y border-[#E9E4DF] bg-[#F8F5F3]/50 text-left text-[10px] uppercase tracking-wider text-[#9A9396]">
                      <tr>
                        <th class="w-12 px-5 py-2.5 text-center font-bold">Rank</th>
                        <th class="px-4 py-2.5 font-bold">门店名称</th>
                        <th class="hidden px-2 py-2.5 text-center font-bold sm:table-cell">参训人数</th>
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
    </div>

    <el-dialog
      v-model="showAllTasks"
      :title="t('区域任务监控 (所有进行中)')"
      width="672px"
      append-to-body
      top="8vh"
      class="beauty-task-dialog"
    >
      <div class="max-h-[58vh] space-y-3 overflow-y-auto px-1 py-4">
        <OngoingTaskCard v-for="task in REGION_ONGOING_TASKS" :key="task.id" :task="task" large>
          <template #footer>
            <div class="mt-4 flex items-center text-xs font-medium text-[#766F73]">
              <Icon v-if="task.isWarning" icon="lucide:triangle-alert" :size="16" class="mr-1 text-[#B9822B]" />
              截止日期: {{ task.deadlineText }}
            </div>
          </template>
        </OngoingTaskCard>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
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

<!-- el-dialog 挂载在 body 下，scoped 样式够不到，这里做窄屏兜底。 -->
<style lang="scss">
.beauty-task-dialog {
  max-width: calc(100vw - 32px);
}
</style>
