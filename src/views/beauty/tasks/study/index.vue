<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBeautyI18n } from '@/beauty/composables'
import { syncInspectionSource } from '@/beauty/lib/inspectionStore'
import { getProgressTone, getTaskStatusBadgeClass } from '@/beauty/lib/visualTones'
import { demoDate } from '@/beauty/lib/demoDates'
import BeautyBadge from '../components/BeautyBadge.vue'
import { useTaskRole } from '../useTaskRole'

/**
 * 学习任务管理：原型 `pages/StudyTaskManage.tsx`。
 *
 * 原型由 `App.tsx` 通过 props 注入 `isReadOnly` / `userRole`；
 * Vue 版改用 `useTaskRole()` 从登录用户反查角色，其余数据与交互逐字对照原型。
 */
defineOptions({ name: 'BeautyTasksStudy' })

interface StudyCourse {
  id: string
  title: string
  duration: string
}

interface StudyTask {
  id: string
  title: string
  status: string
  publishTime: string
  deadline: string
  target: string
  courses: string[]
  progress: number
  targetCount: number
  completedCount: number
  scope: string
  region?: string
}

interface StudyCandidate {
  id: string
  name: string
  store: string
  status: string
}

const { t } = useBeautyI18n()

const userRole = useTaskRole()
const isReadOnly = computed(() => userRole.value === 'Regional Manager')
const isRegionalStaff = computed(
  () => userRole.value === 'Regional Training Manager' || userRole.value === 'Regional Trainer'
)

const MOCK_COURSES: StudyCourse[] = [
  { id: 'c1', title: '双萃系列核心卖点解析（2023版）', duration: '15 mins' },
  { id: 'c2', title: '敏感肌换季护理指南', duration: '20 mins' },
  { id: 'c3', title: 'VIP客户破冰话术实战', duration: '12 mins' },
  { id: 'c4', title: '防晒家族全系列对比', duration: '18 mins' }
]

const MOCK_STUDY_TASKS: StudyTask[] = [
  {
    id: 'st1',
    title: '新人入职必修课第一期',
    status: '进行中',
    publishTime: demoDate(0),
    deadline: demoDate(6),
    target: '全国新入职满1个月BA',
    courses: ['c1', 'c3'],
    progress: 45,
    targetCount: 1428,
    completedCount: 642,
    scope: '全国'
  },
  {
    id: 'st2',
    title: '秋冬防晒季全员冲刺培训',
    status: '已结束',
    publishTime: demoDate(-7),
    deadline: demoDate(-2),
    target: '全国直营门店BA',
    courses: ['c2', 'c4'],
    progress: 92,
    targetCount: 1428,
    completedCount: 1313,
    scope: '全国'
  },
  {
    id: 'st3',
    title: '南区敏感肌专属话术突破',
    status: '进行中',
    publishTime: demoDate(2),
    deadline: demoDate(20),
    target: '南区所有门店BA',
    courses: ['c2'],
    progress: 21,
    targetCount: 300,
    completedCount: 63,
    scope: '区域',
    region: '南区'
  }
]

const MOCK_CANDIDATES: StudyCandidate[] = [
  { id: 'BA001', name: 'Siti Aminah', store: 'Jakarta Grand Indonesia', status: '已完成' },
  { id: 'BA002', name: 'Budi Santoso', store: 'Jakarta Plaza Senayan', status: '学习中' },
  { id: 'BA003', name: 'Ayu Lestari', store: 'Surabaya Tunjungan Plaza', status: '未开始' },
  { id: 'BA004', name: 'Rizky Pratama', store: 'Bali Beachwalk', status: '已完成' },
  { id: 'BA005', name: 'Dewi Sartika', store: 'Bandung Trans Studio', status: '学习中' },
  { id: 'BA006', name: 'Agung Setiawan', store: 'Medan Centre Point', status: '已完成' },
  { id: 'BA007', name: 'Putri Maharani', store: 'Yogyakarta Hartono Mall', status: '学习中' }
]

const tasks = ref<StudyTask[]>(MOCK_STUDY_TASKS.map((task) => ({ ...task })))
const selectedTaskId = ref<string | null>(MOCK_STUDY_TASKS[0].id)
const createDialog = ref(false)
const detailTask = ref<StudyTask | null>(null)
const deactivateTask = ref<StudyTask | null>(null)
const detailSearch = ref('')

/** 弹窗显隐与原型 `open={!!task}` 等价：关闭时清空当前对象。 */
const deactivateOpen = computed({
  get: () => Boolean(deactivateTask.value),
  set: (value: boolean) => {
    if (!value) deactivateTask.value = null
  }
})
const detailOpen = computed({
  get: () => Boolean(detailTask.value),
  set: (value: boolean) => {
    if (!value) detailTask.value = null
  }
})

// 与原型一致：任务列表变化即同步到培训审计数据源（幂等）。
watch(
  tasks,
  (value) => {
    syncInspectionSource('study', 'study_task_manage', value)
  },
  { immediate: true }
)

const targets = computed(() =>
  isRegionalStaff.value
    ? ['雅加达南区所有门店 BA', '本区域店长', '本区域新入职员工']
    : ['全国所有门店 BA', '所有区域经理', '全国店长', '入职不满3个月的新人']
)

const selectedTask = computed(() => tasks.value.find((task) => task.id === selectedTaskId.value) ?? null)

const isRegionalReadOnlyTask = computed(
  () =>
    Boolean(selectedTask.value) && isRegionalStaff.value && selectedTask.value?.scope === '全国'
)

const canDeactivateSelectedTask = computed(
  () =>
    Boolean(selectedTask.value) &&
    !isReadOnly.value &&
    !isRegionalReadOnlyTask.value &&
    selectedTask.value?.status === '进行中'
)

const courseOf = (courseId: string) => MOCK_COURSES.find((course) => course.id === courseId)

const handleDeactivateTask = () => {
  const target = deactivateTask.value
  if (!target) return
  tasks.value = tasks.value.map((task) =>
    task.id === target.id ? { ...task, status: '已停用' } : task
  )
  if (detailTask.value?.id === target.id) {
    detailTask.value = { ...detailTask.value, status: '已停用' }
  }
  deactivateTask.value = null
}

const handleCreateTask = () => {
  tasks.value = [
    {
      id: `st${Date.now()}`,
      title: '新建测试任务',
      status: '进行中',
      publishTime: new Date().toISOString().split('T')[0],
      deadline: demoDate(14),
      target: '选中的人群',
      courses: ['c1'],
      progress: 0,
      targetCount: 100,
      completedCount: 0,
      scope: isRegionalStaff.value ? '区域' : '全国',
      region: isRegionalStaff.value ? '南区' : undefined
    },
    ...tasks.value
  ]
  createDialog.value = false
}

/** 任务卡与详情页共用的「全国 / 区域」徽标颜色。 */
const scopeBadgeClass = (scope: string) =>
  scope === '全国'
    ? 'bg-rose-50 text-rose-600 border-rose-200'
    : 'bg-[#EEF8F4] text-[#3B8F72] border-emerald-200'
</script>

<template>
  <div
    class="flex overflow-hidden rounded-xl border border-solid border-[#E5DED8] bg-[#F7F3F1] pt-2"
    style="
      height: calc(
        100vh - var(--top-tool-height) - var(--tags-view-height) - 2 * var(--app-content-padding)
      );
      min-height: 520px;
    "
  >
    <!-- 左侧任务列表 -->
    <div class="flex w-80 shrink-0 flex-col border-r border-solid border-[#E5DED8] bg-white">
      <div
        class="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-solid border-[#E9E4DF] bg-white p-4"
      >
        <h2 class="min-w-0 font-bold tracking-tight text-[#242124]">学习任务列表</h2>
        <button
          v-if="!isReadOnly"
          type="button"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
          @click="createDialog = true"
        >
          <Icon icon="lucide:plus" :size="16" />
          {{ t('新建') }}
        </button>
      </div>

      <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="cursor-pointer rounded-xl border border-solid p-4 transition-all"
          :class="
            selectedTaskId === task.id
              ? 'border-rose-200 bg-rose-50/50 shadow-sm'
              : 'border-[#E9E4DF] bg-white hover:border-rose-100 hover:bg-[#F8F5F3]'
          "
          @click="selectedTaskId = task.id"
        >
          <div class="mb-2 flex items-center justify-between">
            <div class="flex flex-wrap items-center gap-2">
              <BeautyBadge :class="['py-0 text-[10px]', getTaskStatusBadgeClass(task.status)]">
                {{ task.status }}
              </BeautyBadge>
              <BeautyBadge :class="['py-0 text-[10px]', scopeBadgeClass(task.scope)]">
                {{ task.scope === '区域' && task.region ? task.region : '全国' }}
              </BeautyBadge>
            </div>
          </div>
          <h3
            data-i18n-skip="true"
            class="mb-2 line-clamp-2 text-sm leading-snug font-bold"
            :class="selectedTaskId === task.id ? 'text-rose-950' : 'text-[#242124]'"
          >
            {{ task.title }}
          </h3>
          <div
            class="mt-3 flex items-center justify-between text-[10px] font-medium text-[#9A9396]"
          >
            <span class="flex min-w-0 items-start leading-snug">
              <Icon icon="lucide:book-open" :size="12" class="mr-1 mt-0.5 shrink-0" />
              {{ t(`${task.courses.length} 门课件`) }}
            </span>
            <span class="font-bold leading-snug" :class="getProgressTone(task.progress).textClass">
              {{ t(`${task.progress}% 完成`) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧任务详情 -->
    <div class="flex flex-1 flex-col flex-wrap bg-[#F8F5F3]/50">
      <div v-if="selectedTask" class="mx-auto flex h-full w-full max-w-4xl flex-col">
        <div class="shrink-0 border-b border-solid border-[#E5DED8] bg-white p-8">
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <BeautyBadge :class="getTaskStatusBadgeClass(selectedTask.status)">
                {{ selectedTask.status }}
              </BeautyBadge>
              <BeautyBadge :class="scopeBadgeClass(selectedTask.scope)">
                {{ selectedTask.scope === '区域' && selectedTask.region ? selectedTask.region : '全国' }}
              </BeautyBadge>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-md border border-solid border-red-200 bg-red-50 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canDeactivateSelectedTask"
                @click="deactivateTask = selectedTask"
              >
                {{ selectedTask.status === '已停用' ? t('已停用') : t('停用任务') }}
              </button>
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-sm font-bold text-white shadow-none transition-colors hover:bg-rose-700"
                @click="detailTask = selectedTask"
              >
                {{ t('查看完成明细') }}
              </button>
            </div>
          </div>
          <h1 data-i18n-skip="true" class="mb-2 text-2xl font-bold text-[#242124]">
            {{ selectedTask.title }}
          </h1>

          <div class="mt-6 grid grid-cols-3 gap-6">
            <div class="flex flex-col">
              <span
                class="mb-1 flex items-center text-[10px] font-bold tracking-wider text-[#766F73] uppercase"
              >
                <Icon icon="lucide:target" :size="12" class="mr-1" /> {{ t('分发对象') }}
              </span>
              <span class="text-sm font-medium text-[#242124]">{{ selectedTask.target }}</span>
            </div>
            <div class="flex flex-col">
              <span
                class="mb-1 flex items-center text-[10px] font-bold tracking-wider text-[#766F73] uppercase"
              >
                <Icon icon="lucide:calendar" :size="12" class="mr-1" /> {{ t('任务周期') }}
              </span>
              <span class="text-sm font-medium text-[#242124]">
                {{ selectedTask.publishTime }} 至 {{ selectedTask.deadline }}
              </span>
            </div>
            <div class="flex flex-col">
              <span
                class="mb-1 flex items-center text-[10px] font-bold tracking-wider text-[#766F73] uppercase"
              >
                <Icon icon="lucide:check-circle-2" :size="12" class="mr-1" /> {{ t('当前进度') }}
              </span>
              <span
                class="text-sm font-bold"
                :class="getProgressTone(selectedTask.progress).textClass"
              >
                {{ t(`${selectedTask.progress}% (整体完成率)`) }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-8">
          <h3 class="mb-4 flex items-center text-sm font-bold text-[#242124]">
            <Icon icon="lucide:book-open" :size="16" class="mr-2 text-rose-500" />
            {{ t(`包含的课件内容 (${selectedTask.courses.length})`) }}
          </h3>
          <div class="flex flex-col gap-3">
            <div
              v-for="(courseId, idx) in selectedTask.courses"
              :key="courseId"
              class="rounded-xl border border-solid border-[#E5DED8] bg-white shadow-sm transition-shadow hover:shadow"
            >
              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-4">
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#9A9396]"
                  >
                    {{ idx + 1 }}
                  </div>
                  <div>
                    <h4 data-i18n-skip="true" class="text-sm font-bold text-[#242124]">
                      {{ courseOf(courseId)?.title }}
                    </h4>
                    <p class="mt-1 flex items-center text-[10px] text-[#766F73]">
                      <Icon icon="lucide:clock" :size="12" class="mr-1" />
                      {{ t(`预计 ${courseOf(courseId)?.duration}`) }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                >
                  {{ t('预览') }}
                  <Icon icon="lucide:chevron-right" :size="16" class="ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-1 flex-col items-center justify-center text-[#9A9396]">
        <Icon icon="lucide:file-text" :size="64" class="mb-4 opacity-20" />
        <p class="font-medium text-[#766F73]">在左侧选择一个学习任务查看明细</p>
      </div>
    </div>

    <!-- 新建任务 -->
    <el-dialog
      v-model="createDialog"
      width="1100px"
      append-to-body
      destroy-on-close
      class="!p-0"
      body-class="!p-0"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E9E4DF] !px-6 !pt-5 !pb-4"
    >
      <template #header>
        <h3 class="text-base font-semibold text-[#242124]">新建周期学习任务</h3>
      </template>
      <div class="flex h-[80vh] flex-col">
        <div class="my-4 flex flex-1 gap-6 overflow-y-auto px-6">
          <div class="w-1/3 shrink-0 space-y-5 border-r border-solid border-[#E9E4DF] pr-6">
            <div>
              <label class="mb-1.5 block text-sm font-bold text-[#3F3A3D]">任务名称</label>
              <input
                type="text"
                placeholder="例如：2023年终大促全员冲刺课"
                class="w-full rounded-lg border border-solid border-slate-300 px-3 py-2 text-sm transition-all outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-bold text-[#3F3A3D]">分发对象 (多选)</label>
              <div
                class="h-32 space-y-2 overflow-y-auto rounded-lg border border-solid border-[#E5DED8] bg-[#F8F5F3] p-3"
              >
                <label
                  v-for="target in targets"
                  :key="target"
                  class="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="checkbox"
                    class="rounded border-slate-300 text-rose-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-[#3F3A3D]">{{ target }}</span>
                </label>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-bold text-[#3F3A3D]">截止时间</label>
              <input
                type="date"
                class="w-full rounded-lg border border-solid border-slate-300 px-3 py-2 text-sm transition-all outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          </div>

          <div class="flex min-h-0 flex-1 flex-col">
            <label class="mb-2 block text-sm font-bold text-[#3F3A3D]">选择课件 (按勾选顺序组合)</label>
            <div
              class="flex-1 overflow-y-auto rounded-lg border border-solid border-[#E5DED8] bg-[#F8F5F3]/50 p-4"
            >
              <div class="grid grid-cols-2 gap-4">
                <label
                  v-for="course in MOCK_COURSES"
                  :key="course.id"
                  class="group relative flex cursor-pointer flex-row items-center rounded-xl border border-solid border-[#E5DED8] bg-white p-3 transition-all hover:border-rose-300 hover:shadow-sm"
                >
                  <div class="absolute top-3 right-3 z-10">
                    <input
                      type="checkbox"
                      class="h-5 w-5 rounded border-slate-300 text-rose-600 shadow-sm focus:ring-indigo-500"
                    />
                  </div>
                  <div
                    class="mr-4 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-solid border-[#E9E4DF] bg-slate-100"
                  >
                    <Icon
                      icon="lucide:book-open"
                      :size="32"
                      class="text-[#C9C1C4] transition-colors group-hover:text-rose-400"
                    />
                  </div>
                  <div class="flex-1 pr-6">
                    <p
                      data-i18n-skip="true"
                      class="line-clamp-2 text-sm leading-snug font-bold text-[#242124] transition-colors group-hover:text-rose-700"
                    >
                      {{ course.title }}
                    </p>
                    <p class="mt-2 flex items-center text-[10px] text-[#766F73]">
                      <Icon icon="lucide:clock" :size="12" class="mr-1" /> {{ course.duration }}
                    </p>
                  </div>
                </label>
              </div>
            </div>
            <p class="mt-3 flex shrink-0 items-center text-xs text-[#766F73]">
              <Icon icon="lucide:check-circle-2" :size="14" class="mr-1 text-[#9A9396]" />
              提示：选择的课件将按拼装顺序展示给学员，建议优先选择新发布的资产。
            </p>
          </div>
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t border-solid border-[#E9E4DF] px-6 py-4">
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
            @click="createDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700"
            @click="handleCreateTask"
          >
            确认发布任务
          </button>
        </div>
      </div>
    </el-dialog>

    <!-- 停用任务 -->
    <el-dialog v-model="deactivateOpen" width="460px" append-to-body>
      <template #header>
        <div class="flex items-center text-red-600">
          <Icon icon="lucide:alert-triangle" :size="20" class="mr-2" />
          <span class="text-base font-semibold">停用任务</span>
        </div>
      </template>
      <div class="space-y-3">
        <p class="text-sm font-bold text-[#242124]">该任务将停用，是否确定？</p>
        <p class="text-xs leading-relaxed text-[#766F73]">
          停用后学员将不再收到或继续完成该任务，任务记录会保留在管理列表中。
        </p>
        <div v-if="deactivateTask" class="rounded-lg border border-solid border-red-100 bg-red-50 px-3 py-2">
          <p data-i18n-skip="true" class="line-clamp-1 text-xs font-bold text-red-700">
            {{ deactivateTask.title }}
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
            @click="deactivateTask = null"
          >
            取消
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-700"
            @click="handleDeactivateTask"
          >
            确认停用
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- 完成明细 -->
    <el-dialog
      v-model="detailOpen"
      width="1100px"
      append-to-body
      class="!p-0"
      body-class="!p-0"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E9E4DF] !px-6 !pt-5 !pb-4"
    >
      <template #header>
        <div class="flex items-center text-[#242124]">
          <Icon icon="lucide:users" :size="20" class="mr-2 text-rose-600" />
          <span class="text-base font-semibold">
            <span data-i18n-skip="true">{{ detailTask?.title }}</span>
            <span> - 完成明细</span>
          </span>
        </div>
      </template>
      <div class="flex max-h-[78vh] flex-col px-6 py-4">
        <div class="mb-6 grid shrink-0 grid-cols-3 gap-4">
          <div class="flex items-center justify-between rounded-xl border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
            <div>
              <p class="mb-1 text-xs font-medium text-[#766F73]">目标人数</p>
              <p class="text-xl font-bold text-[#242124]">{{ detailTask?.targetCount }}</p>
            </div>
            <Icon icon="lucide:users" :size="32" class="text-indigo-200" />
          </div>
          <div class="flex items-center justify-between rounded-xl border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
            <div>
              <p class="mb-1 text-xs font-medium text-[#766F73]">已完成</p>
              <p class="text-xl font-bold text-rose-600">{{ detailTask?.completedCount }}</p>
            </div>
            <Icon icon="lucide:check-circle" :size="32" class="text-indigo-200" />
          </div>
          <div class="flex items-center justify-between rounded-xl border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
            <div>
              <p class="mb-1 text-xs font-medium text-[#766F73]">当前进度</p>
              <p
                class="text-xl font-bold"
                :class="getProgressTone(detailTask?.progress ?? 0).textClass"
              >
                {{ detailTask?.progress }}%
              </p>
            </div>
            <Icon icon="lucide:target" :size="32" class="text-indigo-200" />
          </div>
        </div>

        <div class="mb-4 flex shrink-0 items-center justify-between">
          <h3 class="text-sm font-bold text-[#242124]">学员明细</h3>
          <div class="relative">
            <Icon
              icon="lucide:search"
              :size="16"
              class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]"
            />
            <input
              v-model="detailSearch"
              type="text"
              placeholder="搜索工号、姓名、门店..."
              class="w-64 rounded-lg border border-solid border-[#E5DED8] py-1.5 pr-4 pl-9 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
          </div>
        </div>

        <div class="flex-1 overflow-auto rounded-xl border border-solid border-[#E5DED8]">
          <table class="beauty-table w-full text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-solid border-[#E5DED8] bg-[#F8F5F3]">
              <tr>
                <th class="w-24 p-3 font-medium text-[#766F73]">工号</th>
                <th class="w-32 p-3 font-medium text-[#766F73]">姓名</th>
                <th class="p-3 font-medium text-[#766F73]">门店</th>
                <th class="w-32 p-3 font-medium text-[#766F73]">状态</th>
              </tr>
            </thead>
            <tbody class="bg-white">
              <tr
                v-for="candidate in MOCK_CANDIDATES"
                :key="candidate.id"
                class="transition-colors hover:bg-[#F8F5F3]"
              >
                <td class="p-3 font-mono text-xs text-[#766F73]">{{ candidate.id }}</td>
                <td class="p-3 font-medium text-[#242124]">{{ candidate.name }}</td>
                <td class="p-3 text-[#5D565A]">{{ candidate.store }}</td>
                <td class="p-3">
                  <BeautyBadge
                    borderless
                    :class="[getTaskStatusBadgeClass(candidate.status), 'font-normal']"
                  >
                    {{ candidate.status }}
                  </BeautyBadge>
                </td>
              </tr>
            </tbody>
          </table>
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
