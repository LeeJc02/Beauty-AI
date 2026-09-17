<script setup lang="ts">
/**
 * 人员档案（原型 `src/pages/PersonnelArchive.tsx`）。
 *
 * 左侧 BA 列表（按工号/姓名/门店搜索）+ 右侧选中 BA 的档案：四个 KPI、
 * 历次考试记录、近期任务情况（含进度条）。
 *
 * 角色：原型由 `App.tsx` 传入 `userRole`，`HQ Trainer` 走「全国」视图，其余区域角色走「区域」；
 * Vue 版用 `useArchiveRole()` 反查。
 *
 * 与原型一致的取舍：人员与成绩数据沿用原型里写死的演示数据；
 * 任务状态徽标与进度条配色复用 `@/beauty/lib/visualTones` 的 `getTaskStatusBadgeClass` /
 * `getProgressTone`，与原型同一套口径。
 */
import { getProgressTone, getTaskStatusBadgeClass } from '@/beauty/lib/visualTones'
import { useBeautyI18n } from '@/beauty/composables'
import { useArchiveRole } from '../useArchiveRole'
import BeautyBadge from '../components/BeautyBadge.vue'
import BeautyProgress from '../components/BeautyProgress.vue'

defineOptions({ name: 'BeautyArchivesPersonnel' })

interface ArchiveBa {
  id: string
  name: string
  store: string
  joinedAt: string
}

interface BaExamRecord {
  name: string
  date: string
  score: number
  passed: boolean
}

interface BaTaskRecord {
  name: string
  type: string
  status: string
  /** 仅「进行中」的任务带进度 */
  progress?: number
}

interface BaArchiveData {
  taskCompletionRate: number
  lastExamScore: number
  totalCoursesStudied: number
  totalPracticeTime: string
  recentExams: BaExamRecord[]
  recentTasks: BaTaskRecord[]
}

/** 原型 MOCK_BA_LIST。 */
const MOCK_BA_LIST: ArchiveBa[] = [
  { id: 'BA001', name: 'Siti Aminah', store: 'Jakarta Grand Indonesia', joinedAt: '2022-03-15' },
  { id: 'BA002', name: 'Budi Santoso', store: 'Jakarta Plaza Senayan', joinedAt: '2023-01-10' },
  { id: 'BA003', name: 'Ayu Lestari', store: 'Surabaya Tunjungan Plaza', joinedAt: '2023-11-05' },
  { id: 'BA004', name: 'Rizky Pratama', store: 'Bali Beachwalk', joinedAt: '2021-08-20' },
  { id: 'BA005', name: 'Dewi Sartika', store: 'Bandung Trans Studio', joinedAt: '2022-12-01' }
]

/** 原型 MOCK_USER_DATA：BA003~BA005 走 default。 */
const MOCK_USER_DATA: Record<string, BaArchiveData> = {
  BA001: {
    taskCompletionRate: 98,
    lastExamScore: 95,
    totalCoursesStudied: 42,
    totalPracticeTime: '12h 30m',
    recentExams: [
      { name: '夏季新品区域通关考核', date: '2024-05-10', score: 95, passed: true },
      { name: '护肤基础知识月考', date: '2024-04-28', score: 98, passed: true },
      { name: '新客破冰沟通场景考试', date: '2024-04-15', score: 92, passed: true }
    ],
    recentTasks: [
      { name: '必修：2024夏季新品核心卖点解析', type: '学习任务', status: '已完成' },
      { name: '必修：抗老精华顾客异议处理', type: '练习任务', status: '已完成' },
      {
        name: '选修：小红书爆款商品推荐指南',
        type: '学习任务',
        status: '进行中',
        progress: 40
      }
    ]
  },
  BA002: {
    taskCompletionRate: 85,
    lastExamScore: 82,
    totalCoursesStudied: 28,
    totalPracticeTime: '6h 15m',
    recentExams: [
      { name: '夏季新品区域通关考核', date: '2024-05-10', score: 82, passed: true },
      { name: '护肤基础知识月考', date: '2024-04-28', score: 75, passed: true }
    ],
    recentTasks: [
      { name: '必修：2024夏季新品核心卖点解析', type: '学习任务', status: '已完成' },
      { name: '必修：抗老精华顾客异议处理', type: '练习任务', status: '进行中', progress: 50 }
    ]
  },
  default: {
    taskCompletionRate: 90,
    lastExamScore: 88,
    totalCoursesStudied: 30,
    totalPracticeTime: '8h 00m',
    recentExams: [{ name: '护肤基础知识月考', date: '2024-04-28', score: 88, passed: true }],
    recentTasks: [{ name: '必修：2024夏季新品核心卖点解析', type: '学习任务', status: '已完成' }]
  }
}

const { t } = useBeautyI18n()
const userRole = useArchiveRole()

const selectedUserId = ref<string>(MOCK_BA_LIST[0].id)
const searchQuery = ref('')

/** 等价原型 isNational。 */
const isNational = computed(() => userRole.value === 'HQ Trainer')

const filteredUsers = computed(() => {
  const keyword = searchQuery.value.toLowerCase()
  return MOCK_BA_LIST.filter(
    (user) =>
      user.name.toLowerCase().includes(keyword) ||
      user.id.toLowerCase().includes(keyword) ||
      user.store.toLowerCase().includes(keyword)
  )
})

const selectedUser = computed(() =>
  MOCK_BA_LIST.find((user) => user.id === selectedUserId.value)
)

const userData = computed<BaArchiveData>(
  () => MOCK_USER_DATA[selectedUserId.value] ?? MOCK_USER_DATA.default
)

/** 最新考试分数配色（等价原型里的三元表达式）。 */
const lastScoreTone = computed(() => {
  const score = userData.value.lastExamScore
  if (score >= 90) return 'text-[#3B8F72]'
  if (score >= 80) return 'text-rose-600'
  return 'text-[#B9822B]'
})
</script>

<template>
  <div
    class="flex h-[calc(100vh-11.5rem)] min-h-[620px] overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F7F3F1] pt-2"
  >
    <!-- 左侧人员列表 -->
    <div class="flex w-80 shrink-0 flex-col border-r border-[#E5DED8] bg-white">
      <div class="z-10 flex flex-col gap-3 border-b border-[#E9E4DF] bg-white p-4">
        <h2 class="flex items-center font-bold tracking-tight text-[#242124]">
          <Icon icon="lucide:users" :size="20" class="mr-2 text-rose-600" />
          {{ t(isNational ? '全国人员列表' : '区域人员列表') }}
        </h2>
        <div class="relative">
          <Icon
            icon="lucide:search"
            :size="16"
            class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索工号、姓名、门店..."
            class="relative z-10 w-full rounded-lg border border-[#E5DED8] bg-[#F8F5F3] py-2 pr-4 pl-9 text-sm text-[#242124] outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
      </div>

      <div class="flex-1 space-y-1 overflow-y-auto p-3">
        <div
          v-for="user in filteredUsers"
          :key="user.id"
          class="cursor-pointer rounded-xl border p-3 transition-all"
          :class="
            selectedUserId === user.id
              ? 'border-rose-200 bg-rose-50 shadow-sm'
              : 'border-transparent hover:bg-[#F8F5F3]'
          "
          @click="selectedUserId = user.id"
        >
          <div class="mb-1 flex items-center">
            <h3
              class="flex-1 truncate text-sm font-bold"
              :class="selectedUserId === user.id ? 'text-rose-800' : 'text-[#242124]'"
            >
              {{ user.name }}
            </h3>
            <span class="ml-2 font-mono text-[10px] text-[#9A9396]">{{ user.id }}</span>
          </div>
          <p
            class="mt-1 flex items-center text-[10px]"
            :class="selectedUserId === user.id ? 'text-rose-600' : 'text-[#766F73]'"
          >
            <Icon icon="lucide:building" :size="12" class="mr-1" />
            <span class="truncate">{{ user.store }}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- 右侧人员档案 -->
    <div class="flex h-full flex-1 flex-col overflow-hidden bg-[#F8F5F3]/50">
      <div class="z-10 shrink-0 border-b border-[#E5DED8] bg-white p-6 pb-4">
        <div class="mb-4 flex items-center text-sm font-medium text-[#766F73]">
          <Icon icon="lucide:users" :size="16" class="mr-1.5" />
          {{ t(isNational ? '全国人员档案' : '区域人员档案') }}
          <Icon icon="lucide:chevron-right" :size="16" class="mx-1" />
          <span class="font-bold text-[#242124]">
            {{ selectedUser?.name }} ({{ selectedUser?.id }})
          </span>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div
              class="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200 bg-rose-100 text-2xl font-bold text-rose-600 shadow-sm"
            >
              {{ selectedUser?.name.charAt(0) }}
            </div>
            <div class="flex flex-col">
              <h1 class="mb-1 text-2xl font-bold text-[#242124]">{{ selectedUser?.name }}</h1>
              <div class="flex items-center gap-4 text-sm text-[#766F73]">
                <span class="flex items-center">
                  <Icon icon="lucide:building" :size="16" class="mr-1" /> {{ selectedUser?.store }}
                </span>
                <span class="flex items-center">
                  <Icon icon="lucide:clock" :size="16" class="mr-1" />
                  {{ t(`入职: ${selectedUser?.joinedAt}`) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 space-y-6 overflow-y-auto p-6">
        <div class="grid grid-cols-4 gap-4">
          <div class="flex flex-col rounded-xl border border-[#E9E4DF] bg-white p-5 shadow-sm">
            <span
              class="mb-2 flex items-center text-xs font-bold tracking-wider text-[#766F73] uppercase"
            >
              <Icon icon="lucide:calendar-check" :size="14" class="mr-1.5 text-[#3B8F72]" />
              任务完成率
            </span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#3B8F72]">{{ userData.taskCompletionRate }}%</span>
            </div>
          </div>

          <div class="flex flex-col rounded-xl border border-[#E9E4DF] bg-white p-5 shadow-sm">
            <span
              class="mb-2 flex items-center text-xs font-bold tracking-wider text-[#766F73] uppercase"
            >
              <Icon icon="lucide:graduation-cap" :size="14" class="mr-1.5 text-rose-500" />
              最新考试分数
            </span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold" :class="lastScoreTone">
                {{ userData.lastExamScore }}
              </span>
              <span class="mb-1 text-sm font-medium text-[#9A9396]">分</span>
            </div>
          </div>

          <div class="flex flex-col rounded-xl border border-[#E9E4DF] bg-white p-5 shadow-sm">
            <span
              class="mb-2 flex items-center text-xs font-bold tracking-wider text-[#766F73] uppercase"
            >
              <Icon icon="lucide:book-open" :size="14" class="mr-1.5 text-blue-500" />
              总学习课件
            </span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#242124]">
                {{ userData.totalCoursesStudied }}
              </span>
              <span class="mb-1 text-sm font-medium text-[#9A9396]">门课件</span>
            </div>
          </div>

          <div class="flex flex-col rounded-xl border border-[#E9E4DF] bg-white p-5 shadow-sm">
            <span
              class="mb-2 flex items-center text-xs font-bold tracking-wider text-[#766F73] uppercase"
            >
              <Icon icon="lucide:presentation" :size="14" class="mr-1.5 text-[#B9822B]" />
              累计陪练时长
            </span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#242124]">{{ userData.totalPracticeTime }}</span>
            </div>
          </div>
        </div>

        <div class="grid h-[800px] grid-cols-2 gap-6">
          <!-- 历次考试记录 -->
          <div class="flex flex-col rounded-xl border border-[#E9E4DF] bg-white shadow-sm">
            <div class="flex items-center border-b border-slate-50 p-5">
              <Icon icon="lucide:layout-list" :size="16" class="mr-2 text-rose-500" />
              <span class="text-sm font-bold text-[#242124]">历次考试记录</span>
            </div>
            <div class="overflow-y-auto p-0">
              <ul class="divide-y divide-slate-50">
                <li
                  v-for="(exam, index) in userData.recentExams"
                  :key="index"
                  class="flex items-center justify-between p-5 transition-colors hover:bg-[#F8F5F3]/50"
                >
                  <div>
                    <h4 class="mb-1 text-sm font-bold text-[#242124]">{{ exam.name }}</h4>
                    <p class="flex items-center text-xs text-[#9A9396]">
                      <Icon icon="lucide:clock" :size="12" class="mr-1" /> {{ exam.date }}
                    </p>
                  </div>
                  <div class="text-right">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-xl font-bold"
                        :class="exam.score >= 90 ? 'text-[#3B8F72]' : 'text-rose-500'"
                      >
                        {{ exam.score }}
                      </span>
                      <span class="text-xs font-medium text-[#9A9396]">分</span>
                    </div>
                    <BeautyBadge
                      variant="outline"
                      class="mt-1 border-none text-[10px] font-normal"
                      :class="
                        exam.passed
                          ? 'border-none bg-[#EEF8F4] text-[#3B8F72]'
                          : 'border-none bg-rose-50 text-rose-600'
                      "
                    >
                      {{ exam.passed ? '达标' : '未达标' }}
                    </BeautyBadge>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- 近期任务情况 -->
          <div class="flex flex-col rounded-xl border border-[#E9E4DF] bg-white shadow-sm">
            <div class="flex items-center border-b border-slate-50 p-5">
              <Icon icon="lucide:check-circle" :size="16" class="mr-2 text-[#B9822B]" />
              <span class="text-sm font-bold text-[#242124]">近期任务情况</span>
            </div>
            <div class="overflow-y-auto p-0">
              <ul class="divide-y divide-slate-50">
                <li
                  v-for="(task, index) in userData.recentTasks"
                  :key="index"
                  class="flex flex-col justify-center p-5 transition-colors hover:bg-[#F8F5F3]/50"
                >
                  <div class="mb-2 flex items-start justify-between">
                    <div class="mr-4 flex-1">
                      <h4 class="text-sm leading-snug font-bold text-[#242124]">{{ task.name }}</h4>
                    </div>
                    <BeautyBadge
                      variant="outline"
                      class="shrink-0 border-none text-[10px] font-normal"
                      :class="getTaskStatusBadgeClass(task.status)"
                    >
                      {{ task.status }}
                    </BeautyBadge>
                  </div>
                  <div class="mt-1 flex items-center justify-between">
                    <span class="text-[10px] font-bold tracking-wider text-[#9A9396] uppercase">
                      {{ task.type }}
                    </span>
                    <div v-if="task.progress !== undefined" class="flex w-32 items-center gap-2">
                      <BeautyProgress
                        :value="task.progress"
                        :indicator-class="getProgressTone(task.progress).indicatorClass"
                        class="h-1.5 bg-slate-100"
                      />
                      <span class="text-[10px] font-bold" :class="getProgressTone(task.progress).textClass">
                        {{ task.progress }}%
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
