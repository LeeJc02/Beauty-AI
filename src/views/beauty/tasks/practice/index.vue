<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBeautyI18n } from '@/beauty/composables'
import { syncInspectionSource } from '@/beauty/lib/inspectionStore'
import { getProgressTone, getTaskStatusBadgeClass } from '@/beauty/lib/visualTones'
import { demoDate } from '@/beauty/lib/demoDates'
import type { MediaKind, PracticeCaptureConfig } from '@/beauty/types'
import BeautyBadge from '../components/BeautyBadge.vue'
import { useTaskRole } from '../useTaskRole'

/**
 * 练习任务管理：原型 `pages/PracticeTaskManage.tsx`。
 *
 * 角色/只读沿用原型 `App.tsx` 的注入规则（Regional Manager 只读），Vue 版改用 `useTaskRole()` 反查。
 * 练习达标口径（本日/本周/当前周期）由 `getPracticeRateMetric` 逐字还原。
 */
defineOptions({ name: 'BeautyTasksPractice' })

interface NamedAsset {
  id: string
  title: string
}

interface PracticeItems {
  avatars: string[]
  scripts: string[]
  quotes: string[]
}

interface PracticeCaptureStats {
  submittedCount: number
  analysisCompletedCount: number
  consentDeniedCount: number
}

interface PracticeTask {
  id: string
  title: string
  status: string
  publishTime: string
  deadline: string
  target: string
  frequency: string
  items: PracticeItems
  progress: number
  targetCount: number
  completedCount: number
  periodCompletedCount?: number
  periodTargetCount?: number
  periodProgress?: number
  scope: string
  region?: string
  capture: PracticeCaptureConfig
  captureStats: PracticeCaptureStats
}

interface PracticeRateMetric {
  completedCount: number
  completedLabel: string
  countText: string
  progress: number
  rateLabel: string
  ruleText: string
  shortText: string
  targetCount: number
}

interface PracticeCandidate {
  id: string
  name: string
  store: string
  status: string
  captureStatus: string
  analysisStatus: string
}

const { t } = useBeautyI18n()

const userRole = useTaskRole()
const isReadOnly = computed(() => userRole.value === 'Regional Manager')
const isRegionalStaff = computed(
  () => userRole.value === 'Regional Training Manager' || userRole.value === 'Regional Trainer'
)

const MOCK_AVATARS: NamedAsset[] = [
  { id: 'a1', title: 'Ibu Nisa (VIP)' },
  { id: 'a2', title: 'Rina (Ingredient Geek)' }
]

const MOCK_SCRIPTS: NamedAsset[] = [
  { id: 's1', title: '双萃精华促单话术' },
  { id: 's2', title: '敏感肌换季安抚' }
]

const MOCK_QUOTES: NamedAsset[] = [
  { id: 'q1', title: '经典王牌：水油双泵黄金比例' },
  { id: 'q2', title: '异议处理：网上比专柜便宜' }
]

const MOCK_PRACTICE_TASKS: PracticeTask[] = [
  {
    id: 'pt1',
    title: '11月每日打卡：双萃冲刺陪练',
    status: '进行中',
    publishTime: demoDate(0),
    deadline: demoDate(6),
    target: '全国直营门店BA',
    frequency: '每日完成 1 次',
    items: { avatars: ['a1'], scripts: ['s1'], quotes: ['q1'] },
    progress: 58,
    targetCount: 1428,
    completedCount: 828,
    periodCompletedCount: 828,
    periodTargetCount: 1428,
    periodProgress: 58,
    scope: '全国',
    capture: {
      enabled: true,
      mediaKind: 'video',
      fullInteractionRecording: true,
      consentRequired: true,
      limits: {
        maxDurationSec: 600,
        maxBytes: 500 * 1024 * 1024,
        acceptedMimeTypes: ['video/mp4', 'video/quicktime']
      }
    },
    captureStats: { submittedCount: 780, analysisCompletedCount: 724, consentDeniedCount: 26 }
  },
  {
    id: 'pt2',
    title: '新功能实战：场景剧本每周通关',
    status: '已结束',
    publishTime: demoDate(-7),
    deadline: demoDate(-2),
    target: '华东区BA',
    frequency: '每周完成 3 次',
    items: { avatars: ['a2'], scripts: ['s1', 's2'], quotes: [] },
    progress: 88,
    targetCount: 350,
    completedCount: 308,
    scope: '全国',
    capture: {
      enabled: false,
      fullInteractionRecording: true,
      consentRequired: true,
      limits: { maxDurationSec: 0, maxBytes: 0, acceptedMimeTypes: [] }
    },
    captureStats: { submittedCount: 0, analysisCompletedCount: 0, consentDeniedCount: 0 }
  },
  {
    id: 'pt3',
    title: '南区特定客诉处理专项',
    status: '进行中',
    publishTime: demoDate(2),
    deadline: demoDate(20),
    target: '南区所有门店BA',
    frequency: '每周完成 2 次',
    items: { avatars: ['a1'], scripts: ['s2'], quotes: [] },
    progress: 15,
    targetCount: 300,
    completedCount: 45,
    periodCompletedCount: 45,
    periodTargetCount: 300,
    periodProgress: 15,
    scope: '区域',
    region: '南区',
    capture: {
      enabled: true,
      mediaKind: 'audio',
      fullInteractionRecording: true,
      consentRequired: true,
      limits: {
        maxDurationSec: 600,
        maxBytes: 80 * 1024 * 1024,
        acceptedMimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav']
      }
    },
    captureStats: { submittedCount: 39, analysisCompletedCount: 36, consentDeniedCount: 4 }
  }
]

const MOCK_CANDIDATES: PracticeCandidate[] = [
  {
    id: 'BA001',
    name: 'Siti Aminah',
    store: 'Jakarta Grand Indonesia',
    status: '已达标',
    captureStatus: '已采集',
    analysisStatus: '已完成'
  },
  {
    id: 'BA002',
    name: 'Budi Santoso',
    store: 'Jakarta Plaza Senayan',
    status: '练习中',
    captureStatus: '已采集',
    analysisStatus: '分析中'
  },
  {
    id: 'BA003',
    name: 'Ayu Lestari',
    store: 'Surabaya Tunjungan Plaza',
    status: '未开始',
    captureStatus: '未开始',
    analysisStatus: '--'
  },
  {
    id: 'BA004',
    name: 'Rizky Pratama',
    store: 'Bali Beachwalk',
    status: '已达标',
    captureStatus: '已采集',
    analysisStatus: '已完成'
  },
  {
    id: 'BA005',
    name: 'Dewi Sartika',
    store: 'Bandung Trans Studio',
    status: '练习中',
    captureStatus: '未授权',
    analysisStatus: '--'
  },
  {
    id: 'BA006',
    name: 'Agung Setiawan',
    store: 'Medan Centre Point',
    status: '已达标',
    captureStatus: '已采集',
    analysisStatus: '待处理'
  },
  {
    id: 'BA007',
    name: 'Putri Maharani',
    store: 'Yogyakarta Hartono Mall',
    status: '练习中',
    captureStatus: '已采集',
    analysisStatus: '分析中'
  }
]

const getPracticeCycleLabel = (frequency: string) => {
  if (frequency.includes('每日')) return '本日'
  if (frequency.includes('每周')) return '本周'
  return '当前周期'
}

/** 已结束看整体达标率，进行中看当前周期达标率（与原型 `getPracticeRateMetric` 一致）。 */
const getPracticeRateMetric = (task: PracticeTask): PracticeRateMetric => {
  if (task.status === '已结束') {
    return {
      completedCount: task.completedCount,
      completedLabel: '已达标',
      countText: `${task.completedCount} / ${task.targetCount} 人已达标`,
      progress: task.progress,
      rateLabel: '整体达标率',
      ruleText: '达标 = 完成全部要求次数',
      shortText: `${task.progress}% 达标`,
      targetCount: task.targetCount
    }
  }

  const cycleLabel = getPracticeCycleLabel(task.frequency)
  const completedCount = task.periodCompletedCount ?? task.completedCount
  const targetCount = task.periodTargetCount ?? task.targetCount
  const progress = task.periodProgress ?? task.progress
  return {
    completedCount,
    completedLabel: `${cycleLabel}已达标`,
    countText: `${cycleLabel} ${completedCount} / ${targetCount} 人已达标`,
    progress,
    rateLabel: `${cycleLabel}达标率`,
    ruleText: `达标 = ${cycleLabel}完成规定次数`,
    shortText: `${cycleLabel} ${progress}% 达标`,
    targetCount
  }
}

const tasks = ref<PracticeTask[]>(MOCK_PRACTICE_TASKS.map((task) => ({ ...task })))
const selectedTaskId = ref<string | null>(MOCK_PRACTICE_TASKS[0].id)
const createDialog = ref(false)
const detailTask = ref<PracticeTask | null>(null)
const deactivateTask = ref<PracticeTask | null>(null)
const captureMode = ref<'none' | MediaKind>('none')
const detailSearch = ref('')

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
    syncInspectionSource('practice', 'practice_task_manage', value)
  },
  { immediate: true }
)

const targets = computed(() =>
  isRegionalStaff.value
    ? ['雅加达南区所有门店 BA', '本区域店长', '本区域新入职员工']
    : ['全国所有门店 BA', '华北区区域经理', '华东区店长', '入职不满3个月的新人']
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
const selectedTaskRateMetric = computed(() =>
  selectedTask.value ? getPracticeRateMetric(selectedTask.value) : null
)
const detailTaskRateMetric = computed(() =>
  detailTask.value ? getPracticeRateMetric(detailTask.value) : null
)

const avatarOf = (id: string) => MOCK_AVATARS.find((asset) => asset.id === id)
const scriptOf = (id: string) => MOCK_SCRIPTS.find((asset) => asset.id === id)
const quoteOf = (id: string) => MOCK_QUOTES.find((asset) => asset.id === id)

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
  const mode = captureMode.value
  tasks.value = [
    {
      id: `pt${Date.now()}`,
      title: '新建测试任务',
      status: '进行中',
      publishTime: new Date().toISOString().split('T')[0],
      deadline: demoDate(14),
      target: '选中的人群',
      frequency: '每日完成 1 次',
      items: { avatars: ['a1'], scripts: [], quotes: [] },
      progress: 0,
      targetCount: 100,
      completedCount: 0,
      periodCompletedCount: 0,
      periodTargetCount: 100,
      periodProgress: 0,
      scope: isRegionalStaff.value ? '区域' : '全国',
      region: isRegionalStaff.value ? '南区' : undefined,
      capture: {
        enabled: mode !== 'none',
        mediaKind: mode === 'none' ? undefined : mode,
        fullInteractionRecording: true,
        consentRequired: true,
        limits: {
          maxDurationSec: mode === 'none' ? 0 : 600,
          maxBytes:
            mode === 'video' ? 500 * 1024 * 1024 : mode === 'audio' ? 80 * 1024 * 1024 : 0,
          acceptedMimeTypes:
            mode === 'video'
              ? ['video/mp4', 'video/quicktime']
              : mode === 'audio'
                ? ['audio/mpeg', 'audio/mp4', 'audio/wav']
                : []
        }
      },
      captureStats: { submittedCount: 0, analysisCompletedCount: 0, consentDeniedCount: 0 }
    },
    ...tasks.value
  ]
  captureMode.value = 'none'
  createDialog.value = false
}

const scopeBadgeClass = (scope: string) =>
  scope === '全国'
    ? 'bg-rose-50 text-rose-600 border-rose-200'
    : 'bg-[#EEF8F4] text-[#3B8F72] border-emerald-200'

const mediaBadgeClass = (kind?: MediaKind) =>
  kind === 'video'
    ? 'border-blue-200 bg-blue-50 text-blue-700'
    : 'border-violet-200 bg-violet-50 text-violet-700'

const captureModeOptions = [
  { id: 'none' as const, label: '不采集', icon: 'lucide:check-circle-2' },
  { id: 'audio' as const, label: '采集音频', icon: 'lucide:file-audio' },
  { id: 'video' as const, label: '采集视频', icon: 'lucide:file-video' }
]
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
        <h2 class="min-w-0 font-bold tracking-tight text-[#242124]">练习任务列表</h2>
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
          <div class="mt-3 flex items-center justify-between text-[10px] font-medium text-[#9A9396]">
            <span class="flex min-w-0 items-start leading-snug">
              <Icon icon="lucide:clock" :size="12" class="mr-1 mt-0.5 shrink-0" />
              {{ task.frequency }}
            </span>
            <span class="font-bold leading-snug" :class="getProgressTone(task.progress).textClass">
              {{ t(getPracticeRateMetric(task).shortText) }}
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
              <BeautyBadge v-if="selectedTask.capture.enabled" :class="['gap-1', mediaBadgeClass(selectedTask.capture.mediaKind)]">
                <Icon
                  :icon="selectedTask.capture.mediaKind === 'video' ? 'lucide:file-video' : 'lucide:file-audio'"
                  :size="14"
                />
                {{ selectedTask.capture.mediaKind === 'video' ? '完整视频采集' : '完整音频采集' }}
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

          <div class="mt-6 grid grid-cols-4 gap-6">
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
                <Icon icon="lucide:clock" :size="12" class="mr-1" /> {{ t('练习频次') }}
              </span>
              <span class="text-sm font-medium text-[#242124]">{{ selectedTask.frequency }}</span>
            </div>
            <div class="flex flex-col">
              <span
                class="mb-1 flex items-center text-[10px] font-bold tracking-wider text-[#766F73] uppercase"
              >
                <Icon icon="lucide:calendar" :size="12" class="mr-1" /> {{ t('任务周期') }}
              </span>
              <span class="text-xs font-medium text-[#242124]">
                {{ selectedTask.publishTime }} 至 {{ selectedTask.deadline }}
              </span>
            </div>
            <div v-if="selectedTaskRateMetric" class="flex flex-col">
              <span
                class="mb-1 flex items-center text-[10px] font-bold tracking-wider text-[#766F73] uppercase"
              >
                <Icon icon="lucide:check-circle-2" :size="12" class="mr-1" />
                {{ t(selectedTaskRateMetric.rateLabel) }}
              </span>
              <span
                class="text-sm font-bold"
                :class="getProgressTone(selectedTaskRateMetric.progress).textClass"
              >
                {{ selectedTaskRateMetric.progress }}%
              </span>
              <span class="mt-1 text-[10px] leading-snug text-[#766F73]">
                {{ t(selectedTaskRateMetric.countText) }}
              </span>
              <span class="mt-0.5 text-[10px] leading-snug text-[#9A9396]">
                {{ t(selectedTaskRateMetric.ruleText) }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-8">
          <section
            v-if="selectedTask.capture.enabled"
            class="mb-6 overflow-hidden rounded-lg border border-solid border-[#D8DEFF] bg-white"
          >
            <div
              class="flex flex-wrap items-start justify-between gap-3 border-b border-solid border-[#E5E8FF] bg-[#F3F5FF] px-4 py-3"
            >
              <div>
                <h3 class="flex items-center gap-2 text-sm font-bold text-[#3F48B4]">
                  <Icon
                    :icon="selectedTask.capture.mediaKind === 'video' ? 'lucide:file-video' : 'lucide:file-audio'"
                    :size="16"
                  />
                  音视频采集情况
                </h3>
                <p class="mt-1 text-xs text-[#5962B9]">
                  取得 BA 许可后，每次互动从开始到结束完整录制
                </p>
              </div>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-[#3B8F72]">
                <Icon icon="lucide:shield-check" :size="14" />许可确认已开启
              </span>
            </div>
            <div class="grid grid-cols-2 gap-px bg-[#E9E4DF] sm:grid-cols-4">
              <div class="bg-white px-4 py-3">
                <div class="text-[10px] font-bold text-[#9A9396]">采集类型</div>
                <div class="mt-1 text-sm font-bold text-[#242124]">
                  {{ selectedTask.capture.mediaKind === 'video' ? '视频' : '音频' }}
                </div>
              </div>
              <div class="bg-white px-4 py-3">
                <div class="text-[10px] font-bold text-[#9A9396]">已采集</div>
                <div class="mt-1 text-sm font-bold text-[#242124]">
                  {{ t(`${selectedTask.captureStats.submittedCount} 人`) }}
                </div>
              </div>
              <div class="bg-white px-4 py-3">
                <div class="text-[10px] font-bold text-[#9A9396]">AI 已分析</div>
                <div class="mt-1 flex items-center gap-1 text-sm font-bold text-[#515BCB]">
                  <Icon icon="lucide:sparkles" :size="14" />
                  {{ t(`${selectedTask.captureStats.analysisCompletedCount} 份分析`) }}
                </div>
              </div>
              <div class="bg-white px-4 py-3">
                <div class="text-[10px] font-bold text-[#9A9396]">未授权</div>
                <div class="mt-1 text-sm font-bold text-[#B9822B]">
                  {{ t(`${selectedTask.captureStats.consentDeniedCount} 次`) }}
                </div>
              </div>
            </div>
          </section>

          <h3 class="mb-4 flex items-center text-sm font-bold text-[#242124]">包含的训练资产</h3>
          <div class="grid grid-cols-2 gap-4">
            <div v-if="selectedTask.items.avatars.length > 0" class="rounded-xl border border-solid border-[#E5DED8] bg-white">
              <div class="p-4">
                <div class="mb-3 flex items-center text-xs font-bold text-[#3B8F72]">
                  <Icon icon="lucide:bot" :size="16" class="mr-1.5" />
                  {{ t(`指定数字人顾客 (${selectedTask.items.avatars.length})`) }}
                </div>
                <ul class="flex flex-col gap-2">
                  <li
                    v-for="id in selectedTask.items.avatars"
                    :key="id"
                    data-i18n-skip="true"
                    class="rounded-md bg-[#F8F5F3] p-2 text-sm font-medium text-[#3F3A3D]"
                  >
                    {{ avatarOf(id)?.title }}
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="selectedTask.items.scripts.length > 0" class="rounded-xl border border-solid border-[#E5DED8] bg-white">
              <div class="p-4">
                <div class="mb-3 flex items-center text-xs font-bold text-blue-600">
                  <Icon icon="lucide:message-square-text" :size="16" class="mr-1.5" />
                  {{ t(`指定场景剧本 (${selectedTask.items.scripts.length})`) }}
                </div>
                <ul class="flex flex-col gap-2">
                  <li
                    v-for="id in selectedTask.items.scripts"
                    :key="id"
                    data-i18n-skip="true"
                    class="rounded-md bg-[#F8F5F3] p-2 text-sm font-medium text-[#3F3A3D]"
                  >
                    {{ scriptOf(id)?.title }}
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="selectedTask.items.quotes.length > 0" class="rounded-xl border border-solid border-[#E5DED8] bg-white">
              <div class="p-4">
                <div class="mb-3 flex items-center text-xs font-bold text-rose-600">
                  <Icon icon="lucide:text-select" :size="16" class="mr-1.5" />
                  {{ t(`指定金句跟读 (${selectedTask.items.quotes.length})`) }}
                </div>
                <ul class="flex flex-col gap-2">
                  <li
                    v-for="id in selectedTask.items.quotes"
                    :key="id"
                    data-i18n-skip="true"
                    class="rounded-md bg-[#F8F5F3] p-2 text-sm font-medium text-[#3F3A3D]"
                  >
                    {{ quoteOf(id)?.title }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-1 flex-col items-center justify-center text-[#9A9396]">
        <Icon icon="lucide:file-text" :size="64" class="mb-4 opacity-20" />
        <p class="font-medium text-[#766F73]">在左侧选择一个练习任务查看明细</p>
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
        <h3 class="text-base font-semibold text-[#242124]">新建周期练习任务</h3>
      </template>
      <div class="flex h-[80vh] flex-col">
        <div class="my-4 flex flex-1 gap-6 overflow-y-auto px-6">
          <div class="w-1/3 shrink-0 space-y-5 border-r border-solid border-[#E9E4DF] pr-6">
            <div>
              <label class="mb-1.5 block text-sm font-bold text-[#3F3A3D]">任务名称</label>
              <input
                type="text"
                placeholder="例如：11月每日开口练习计划"
                class="w-full rounded-lg border border-solid border-slate-300 px-3 py-2 text-sm transition-all outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-bold text-[#3F3A3D]">分发对象 (多选)</label>
              <div class="h-32 space-y-2 overflow-y-auto rounded-lg border border-solid border-[#E5DED8] bg-[#F8F5F3] p-3">
                <label v-for="target in targets" :key="target" class="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" class="rounded border-slate-300 text-rose-600 focus:ring-indigo-500" />
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
            <div>
              <label class="mb-1.5 block text-sm font-bold text-[#3F3A3D]">练习频次要求</label>
              <select
                class="w-full rounded-lg border border-solid border-slate-300 px-3 py-2 text-sm transition-all outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              >
                <option>每日完成 1 次</option>
                <option>每周完成 3 次</option>
                <option>周期内一次性通关</option>
              </select>
            </div>
          </div>

          <div class="flex min-h-0 flex-1 flex-col">
            <label class="mb-2 block text-sm font-bold text-[#3F3A3D]">配置练习素材 (可选多项组合)</label>

            <div class="flex-1 space-y-6 overflow-y-auto rounded-lg border border-solid border-[#E5DED8] bg-[#F8F5F3]/50 p-4">
              <div class="space-y-3">
                <div class="flex items-center border-b border-solid border-emerald-100 pb-2 text-sm font-bold text-[#3B8F72]">
                  <Icon icon="lucide:bot" :size="20" class="mr-2" /> 数字人顾客自由练
                </div>
                <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <label
                    v-for="item in MOCK_AVATARS"
                    :key="item.id"
                    class="group relative flex cursor-pointer flex-col rounded-xl border border-solid border-[#E5DED8] bg-white p-3 transition-all hover:border-emerald-300 hover:shadow-sm"
                  >
                    <div class="absolute top-2 right-2 z-10">
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-slate-300 text-[#3B8F72] shadow-sm focus:ring-emerald-500"
                      />
                    </div>
                    <div
                      class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-solid border-emerald-100 bg-[#EEF8F4]"
                    >
                      <span class="text-sm font-bold text-[#3B8F72]">3D</span>
                    </div>
                    <span
                      data-i18n-skip="true"
                      class="text-center text-xs font-bold text-[#3F3A3D] group-hover:text-[#2F735C]"
                    >
                      {{ item.title }}
                    </span>
                  </label>
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-center border-b border-solid border-blue-100 pb-2 text-sm font-bold text-blue-600">
                  <Icon icon="lucide:message-square-text" :size="20" class="mr-2" /> 场景剧本通关
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <label
                    v-for="item in MOCK_SCRIPTS"
                    :key="item.id"
                    class="group relative flex cursor-pointer items-center rounded-xl border border-solid border-[#E5DED8] bg-white p-3 transition-all hover:border-blue-300 hover:shadow-sm"
                  >
                    <div
                      class="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500"
                    >
                      <Icon icon="lucide:message-square-text" :size="16" />
                    </div>
                    <span
                      data-i18n-skip="true"
                      class="line-clamp-1 flex-1 text-xs font-bold text-[#3F3A3D] group-hover:text-blue-700"
                    >
                      {{ item.title }}
                    </span>
                    <input
                      type="checkbox"
                      class="ml-2 h-4 w-4 rounded border-slate-300 text-blue-600 shadow-sm focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-center border-b border-solid border-rose-100 pb-2 text-sm font-bold text-rose-600">
                  <Icon icon="lucide:text-select" :size="20" class="mr-2" /> 金句跟读打分
                </div>
                <div class="grid grid-cols-1 gap-2">
                  <label
                    v-for="item in MOCK_QUOTES"
                    :key="item.id"
                    class="group relative flex cursor-pointer items-center justify-between rounded-xl border border-solid border-[#E5DED8] bg-white p-3 transition-all hover:border-rose-300 hover:shadow-sm"
                  >
                    <div class="flex flex-col">
                      <span class="mb-0.5 text-[10px] font-medium text-[#9A9396] uppercase">QUOTE</span>
                      <span
                        data-i18n-skip="true"
                        class="text-xs font-bold text-[#3F3A3D] group-hover:text-rose-700"
                      >
                        {{ item.title }}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      class="ml-2 h-4 w-4 shrink-0 rounded border-slate-300 text-rose-600 shadow-sm focus:ring-rose-500"
                    />
                  </label>
                </div>
              </div>
            </div>

            <p class="mt-3 flex shrink-0 items-center text-xs text-[#766F73]">
              <Icon icon="lucide:check-circle-2" :size="14" class="mr-1 text-[#9A9396]" />
              提示：选择不同的素材模块将组合成一个多维度的陪练任务。
            </p>

            <section class="mt-5 rounded-lg border border-solid border-[#D8DEFF] bg-white p-4">
              <div class="flex items-center gap-2 text-sm font-bold text-[#3F3A3D]">
                <Icon icon="lucide:shield-check" :size="16" class="text-[#515BCB]" />音视频采集要求
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2">
                <button
                  v-for="option in captureModeOptions"
                  :key="option.id"
                  type="button"
                  class="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-solid px-3 text-xs font-bold transition-colors"
                  :class="
                    captureMode === option.id
                      ? 'border-[#AAB4FF] bg-[#F3F5FF] text-[#3F48B4]'
                      : 'border-[#E9E4DF] text-[#766F73] hover:border-[#D8DEFF]'
                  "
                  @click="captureMode = option.id"
                >
                  <Icon :icon="option.icon" :size="16" />{{ option.label }}
                </button>
              </div>
              <div v-if="captureMode !== 'none'" class="mt-3 grid gap-2 sm:grid-cols-2">
                <div class="rounded-lg border border-solid border-[#BFDCCF] bg-[#EEF8F4] px-3 py-2 text-xs leading-relaxed text-[#2F735C]">
                  开始互动前由 APP 向 BA 征得许可，拒绝不阻塞练习。
                </div>
                <div class="rounded-lg border border-solid border-[#E9E4DF] bg-[#F8F5F3] px-3 py-2 text-xs leading-relaxed text-[#5D565A]">
                  完整录制每次互动，最长 10 分钟；{{
                    captureMode === 'video' ? 'MP4 / MOV，500 MB' : 'MP3 / M4A / WAV，80 MB'
                  }}。
                </div>
              </div>
            </section>
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
              <p class="mb-1 text-xs font-medium text-[#766F73]">
                {{ detailTaskRateMetric?.completedLabel ?? '已达标' }}
              </p>
              <p class="text-xl font-bold text-rose-600">
                {{ detailTaskRateMetric?.completedCount ?? detailTask?.completedCount }}
              </p>
            </div>
            <Icon icon="lucide:check-circle" :size="32" class="text-indigo-200" />
          </div>
          <div
            v-if="detailTaskRateMetric"
            class="flex items-center justify-between rounded-xl border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4"
          >
            <div>
              <p class="mb-1 text-xs font-medium text-[#766F73]">
                {{ t(detailTaskRateMetric.rateLabel) }}
              </p>
              <p
                class="text-xl font-bold"
                :class="getProgressTone(detailTaskRateMetric.progress).textClass"
              >
                {{ detailTaskRateMetric.progress }}%
              </p>
              <p class="mt-1 text-[10px] leading-snug text-[#766F73]">
                {{ t(detailTaskRateMetric.countText) }}
              </p>
              <p class="mt-0.5 text-[10px] leading-snug text-[#9A9396]">
                {{ t(detailTaskRateMetric.ruleText) }}
              </p>
            </div>
            <Icon icon="lucide:target" :size="32" class="text-indigo-200" />
          </div>
        </div>

        <div
          v-if="detailTask?.capture?.enabled"
          class="mb-5 grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-lg border border-solid border-[#D8DEFF] bg-[#D8DEFF]"
        >
          <div class="bg-[#F3F5FF] px-4 py-3">
            <div class="text-[10px] font-bold text-[#5962B9]">已采集</div>
            <div class="mt-1 text-lg font-bold text-[#3F48B4]">
              {{ t(`${detailTask.captureStats.submittedCount} 人`) }}
            </div>
          </div>
          <div class="bg-[#F3F5FF] px-4 py-3">
            <div class="text-[10px] font-bold text-[#5962B9]">AI 已分析</div>
            <div class="mt-1 text-lg font-bold text-[#3F48B4]">
              {{ t(`${detailTask.captureStats.analysisCompletedCount} 份分析`) }}
            </div>
          </div>
          <div class="bg-[#F3F5FF] px-4 py-3">
            <div class="text-[10px] font-bold text-[#5962B9]">未授权</div>
            <div class="mt-1 text-lg font-bold text-[#B9822B]">
              {{ t(`${detailTask.captureStats.consentDeniedCount} 次`) }}
            </div>
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
                <th v-if="detailTask?.capture?.enabled" class="w-36 p-3 font-medium text-[#766F73]">
                  采集 / AI
                </th>
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
                <td v-if="detailTask?.capture?.enabled" class="p-3">
                  <div class="text-xs font-medium text-[#3F3A3D]">{{ candidate.captureStatus }}</div>
                  <div
                    class="mt-1 text-[10px]"
                    :class="
                      candidate.analysisStatus === '已完成'
                        ? 'text-[#3B8F72]'
                        : candidate.analysisStatus === '待处理'
                          ? 'text-[#B9822B]'
                          : 'text-[#9A9396]'
                    "
                  >
                    {{ candidate.analysisStatus }}
                  </div>
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
