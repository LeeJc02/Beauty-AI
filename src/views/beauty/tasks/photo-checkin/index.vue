<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBeautyI18n } from '@/beauty/composables'
import type { PhotoCheckinPhoto, PhotoCheckinRecord, PhotoCheckinStatus } from '@/beauty/types'
import CheckinPhotoPanel from './components/CheckinPhotoPanel.vue'
import { useTaskRole } from '../useTaskRole'

/**
 * BA 打卡记录：原型 `pages/PhotoCheckinRecords.tsx`。
 *
 * 原型由 `App.tsx` 传入 `userRole`；Vue 版用 `useTaskRole()` 反查。
 * 角色切换时清空筛选与选中记录的逻辑（原型 useEffect([userRole])）用 watch 还原。
 */
defineOptions({ name: 'BeautyTasksPhotoCheckin' })

interface BaProfile {
  id: string
  name: string
  regionId: string
  regionName: string
  storeId: string
  storeName: string
}

interface CheckinRow {
  profile: BaProfile
  record?: PhotoCheckinRecord
}

interface CheckinPhotoRequirement {
  id: string
  name: string
  description: string
  count: number
  prompt: string
}

const { t } = useBeautyI18n()

const userRole = useTaskRole()
const isNational = computed(() => userRole.value === 'Super Admin' || userRole.value === 'HQ Trainer')

const DEFAULT_PHOTO_REQUIREMENTS: CheckinPhotoRequirement[] = [
  {
    id: 'makeup',
    name: '妆容照',
    description: '正面妆容与当日形象',
    count: 1,
    prompt: '评估妆容是否完整、整洁、符合品牌形象，光线是否充足，画面是否清晰。'
  },
  {
    id: 'counter',
    name: '柜台出样照',
    description: '柜台陈列与台面状态',
    count: 1,
    prompt: '评估柜台陈列是否完整、整洁，产品是否按规范出样，画面是否能清楚呈现整体状态。'
  }
]

const fieldClass =
  'w-full rounded-lg border border-solid border-[#DED7D2] bg-white px-3 py-2 text-sm text-[#242124] outline-none transition-colors placeholder:text-[#A69EA2] focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'

const BA_ROSTER: BaProfile[] = [
  { id: 'BA001', name: 'Siti Aminah', regionId: 'jakarta-south', regionName: '雅加达南区', storeId: 'store-senayan', storeName: 'Jakarta Grand Indonesia' },
  { id: 'BA002', name: 'Budi Santoso', regionId: 'jakarta-south', regionName: '雅加达南区', storeId: 'store-pacific', storeName: 'Jakarta Plaza Senayan' },
  { id: 'BA003', name: 'Ayu Lestari', regionId: 'jakarta-south', regionName: '雅加达南区', storeId: 'store-gandaria', storeName: 'Jakarta Gandaria City' },
  { id: 'BA004', name: 'Dewi Sartika', regionId: 'surabaya', regionName: '泗水区', storeId: 'store-tunjungan', storeName: 'Surabaya Tunjungan Plaza' },
  { id: 'BA005', name: 'Putri Maharani', regionId: 'bali', regionName: '巴厘岛区', storeId: 'store-beachwalk', storeName: 'Bali Beachwalk' },
  { id: 'BA006', name: 'Maya Putri', regionId: 'jakarta-south', regionName: '雅加达南区', storeId: 'store-senayan', storeName: 'Jakarta Grand Indonesia' },
  { id: 'BA007', name: 'Rina Wijaya', regionId: 'jakarta-south', regionName: '雅加达南区', storeId: 'store-pacific', storeName: 'Jakarta Plaza Senayan' },
  { id: 'BA008', name: 'Lia Kartika', regionId: 'jakarta-north', regionName: '雅加达北区', storeId: 'store-kelapa', storeName: 'Jakarta Kelapa Gading' },
  { id: 'BA009', name: 'Nadia Sari', regionId: 'bandung', regionName: '万隆区', storeId: 'store-trans', storeName: 'Bandung Trans Studio' },
  { id: 'BA010', name: 'Dimas Pratama', regionId: 'medan', regionName: '棉兰区', storeId: 'store-sun', storeName: 'Medan Sun Plaza' }
]

const photo = (
  assetId: string,
  fileName: string,
  source: 'camera' | 'album',
  capturedAt: string,
  previewUrl: string,
  aiScore: number,
  mimeType = 'image/jpeg'
): PhotoCheckinPhoto => ({
  assetId,
  fileName,
  mimeType,
  source,
  capturedAt,
  previewUrl,
  aiScore
})

const CHECKIN_RECORDS: PhotoCheckinRecord[] = [
  {
    id: 'checkin-20260903-001',
    baId: 'BA001',
    baName: 'Siti Aminah',
    regionId: 'jakarta-south',
    regionName: '雅加达南区',
    storeId: 'store-senayan',
    storeName: 'Jakarta Grand Indonesia',
    checkinDate: '2026-09-03',
    submittedAt: '2026-09-03 09:42',
    status: 'completed',
    makeupPhoto: photo('asset-makeup-001', 'BA001_makeup.jpg', 'camera', '2026-09-03 09:40', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=85', 92),
    counterPhoto: photo('asset-counter-001', 'BA001_counter.jpg', 'album', '2026-09-03 09:41', 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=85', 88)
  },
  {
    id: 'checkin-20260903-002',
    baId: 'BA002',
    baName: 'Budi Santoso',
    regionId: 'jakarta-south',
    regionName: '雅加达南区',
    storeId: 'store-pacific',
    storeName: 'Jakarta Plaza Senayan',
    checkinDate: '2026-09-03',
    submittedAt: '2026-09-03 08:16',
    status: 'completed',
    makeupPhoto: photo('asset-makeup-002', 'BA002_makeup.jpg', 'album', '2026-09-03 08:11', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85', 86),
    counterPhoto: photo('asset-counter-002', 'BA002_counter.jpg', 'camera', '2026-09-03 08:15', 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=900&q=85', 91)
  },
  {
    id: 'checkin-20260903-003',
    baId: 'BA003',
    baName: 'Ayu Lestari',
    regionId: 'jakarta-south',
    regionName: '雅加达南区',
    storeId: 'store-gandaria',
    storeName: 'Jakarta Gandaria City',
    checkinDate: '2026-09-03',
    submittedAt: '2026-09-03 10:08',
    status: 'completed',
    makeupPhoto: photo('asset-makeup-003', 'BA003_makeup.jpg', 'camera', '2026-09-03 10:06', 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=85', 89),
    counterPhoto: photo('asset-counter-003', 'BA003_counter.jpg', 'camera', '2026-09-03 10:07', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85', 84)
  },
  {
    id: 'checkin-20260903-004',
    baId: 'BA004',
    baName: 'Dewi Sartika',
    regionId: 'surabaya',
    regionName: '泗水区',
    storeId: 'store-tunjungan',
    storeName: 'Surabaya Tunjungan Plaza',
    checkinDate: '2026-09-03',
    submittedAt: '2026-09-03 09:08',
    status: 'completed',
    makeupPhoto: photo('asset-makeup-004', 'BA004_makeup.jpg', 'album', '2026-09-03 09:06', 'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=900&q=85', 94),
    counterPhoto: photo('asset-counter-004', 'BA004_counter.jpg', 'camera', '2026-09-03 09:07', 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=85', 93)
  },
  {
    id: 'checkin-20260903-005',
    baId: 'BA005',
    baName: 'Putri Maharani',
    regionId: 'bali',
    regionName: '巴厘岛区',
    storeId: 'store-beachwalk',
    storeName: 'Bali Beachwalk',
    checkinDate: '2026-09-03',
    submittedAt: '2026-09-03 10:12',
    status: 'completed',
    makeupPhoto: photo('asset-makeup-005', 'BA005_makeup.jpg', 'camera', '2026-09-03 10:09', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85', 90),
    counterPhoto: photo('asset-counter-005', 'BA005_counter.jpg', 'album', '2026-09-03 10:11', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=85', 87)
  },
  {
    id: 'checkin-20260903-006',
    baId: 'BA006',
    baName: 'Maya Putri',
    regionId: 'jakarta-south',
    regionName: '雅加达南区',
    storeId: 'store-senayan',
    storeName: 'Jakarta Grand Indonesia',
    checkinDate: '2026-09-03',
    submittedAt: '2026-09-03 11:26',
    status: 'completed',
    makeupPhoto: photo('asset-makeup-006', 'BA006_makeup.jpg', 'album', '2026-09-03 11:22', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=85', 96),
    counterPhoto: photo('asset-counter-006', 'BA006_counter.jpg', 'camera', '2026-09-03 11:25', 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=900&q=85', 92)
  },
  {
    id: 'checkin-20260902-007',
    baId: 'BA007',
    baName: 'Rina Wijaya',
    regionId: 'jakarta-south',
    regionName: '雅加达南区',
    storeId: 'store-pacific',
    storeName: 'Jakarta Plaza Senayan',
    checkinDate: '2026-09-02',
    submittedAt: '2026-09-02 17:30',
    status: 'completed',
    makeupPhoto: photo('asset-makeup-007', 'BA007_makeup.jpg', 'camera', '2026-09-02 17:27', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85', 83),
    counterPhoto: photo('asset-counter-007', 'BA007_counter.jpg', 'album', '2026-09-02 17:29', 'https://images.unsplash.com/photo-1571781565036-d3f7594c2a5b?auto=format&fit=crop&w=900&q=85', 90)
  },
  {
    id: 'checkin-20260902-008',
    baId: 'BA008',
    baName: 'Lia Kartika',
    regionId: 'jakarta-north',
    regionName: '雅加达北区',
    storeId: 'store-kelapa',
    storeName: 'Jakarta Kelapa Gading',
    checkinDate: '2026-09-02',
    submittedAt: '2026-09-02 16:04',
    status: 'completed',
    makeupPhoto: photo('asset-makeup-008', 'BA008_makeup.jpg', 'album', '2026-09-02 16:00', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=85', 91),
    counterPhoto: photo('asset-counter-008', 'BA008_counter.jpg', 'camera', '2026-09-02 16:03', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85', 86)
  }
]

const STATUS_META: Record<
  PhotoCheckinStatus,
  { label: string; className: string; icon: string }
> = {
  completed: {
    label: '已打卡',
    className: 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]',
    icon: 'lucide:check-circle-2'
  },
  missing: {
    label: '未打卡',
    className: 'border-[#E5DED8] bg-[#F8F5F3] text-[#766F73]',
    icon: 'lucide:clock-3'
  }
}

const REGIONAL_SCOPE_ID = 'jakarta-south'
const TODAY = '2026-09-03'

const dateFrom = ref(TODAY)
const dateTo = ref(TODAY)
const regionFilter = ref('all')
const storeFilter = ref('all')
const statusFilter = ref<'all' | PhotoCheckinStatus>('all')
const search = ref('')
const selectedRow = ref<CheckinRow | null>(null)
const settingsOpen = ref(false)
const photoRequirements = ref<CheckinPhotoRequirement[]>(DEFAULT_PHOTO_REQUIREMENTS)
const draftRequirements = ref<CheckinPhotoRequirement[]>(DEFAULT_PHOTO_REQUIREMENTS)

const detailOpen = computed({
  get: () => Boolean(selectedRow.value),
  set: (value: boolean) => {
    if (!value) selectedRow.value = null
  }
})

const resetFilters = () => {
  dateFrom.value = TODAY
  dateTo.value = TODAY
  regionFilter.value = 'all'
  storeFilter.value = 'all'
  statusFilter.value = 'all'
  search.value = ''
}

// 原型 useEffect([userRole])：角色切换后清空筛选，避免残留上一个角色范围的记录。
watch(userRole, () => {
  selectedRow.value = null
  resetFilters()
})

const scopedRoster = computed(() =>
  BA_ROSTER.filter((ba) => isNational.value || ba.regionId === REGIONAL_SCOPE_ID)
)

const matchingRoster = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return scopedRoster.value.filter((ba) => {
    const matchesRegion = regionFilter.value === 'all' || ba.regionId === regionFilter.value
    const matchesStore = storeFilter.value === 'all' || ba.storeId === storeFilter.value
    const matchesSearch =
      !keyword || `${ba.id} ${ba.name} ${ba.storeName}`.toLowerCase().includes(keyword)
    return matchesRegion && matchesStore && matchesSearch
  })
})

const regionOptions = computed(() =>
  Array.from(new Map(scopedRoster.value.map((ba) => [ba.regionId, ba.regionName])).entries())
)

const storeOptions = computed(() =>
  Array.from(
    new Map(
      scopedRoster.value
        .filter((ba) => regionFilter.value === 'all' || ba.regionId === regionFilter.value)
        .map((ba) => [ba.storeId, ba.storeName])
    ).entries()
  )
)

const matchingBaIds = computed(() => new Set(matchingRoster.value.map((ba) => ba.id)))

const periodRecords = computed(() =>
  CHECKIN_RECORDS.filter((record) => matchingBaIds.value.has(record.baId))
    .filter(
      (record) =>
        (!dateFrom.value || record.checkinDate >= dateFrom.value) &&
        (!dateTo.value || record.checkinDate <= dateTo.value)
    )
    .sort((a, b) =>
      `${b.checkinDate} ${b.submittedAt ?? ''}`.localeCompare(`${a.checkinDate} ${a.submittedAt ?? ''}`)
    )
)

const rows = computed<CheckinRow[]>(() => {
  const recordRows = periodRecords.value
    .filter((record) => statusFilter.value === 'all' || record.status === statusFilter.value)
    .map((record) => {
      const profile = matchingRoster.value.find((ba) => ba.id === record.baId)
      return profile ? ({ profile, record } as CheckinRow) : null
    })
    .filter((row): row is CheckinRow => row !== null)
  const recordedBaIds = new Set(periodRecords.value.map((record) => record.baId))
  const missingRows: CheckinRow[] =
    statusFilter.value === 'all' || statusFilter.value === 'missing'
      ? matchingRoster.value
          .filter((ba) => !recordedBaIds.has(ba.id))
          .map((profile) => ({ profile }))
      : []
  return [...recordRows, ...missingRows]
})

const summary = computed(() => {
  const totalBa = matchingRoster.value.length
  const completedBa = new Set(
    periodRecords.value.filter((record) => record.status === 'completed').map((record) => record.baId)
  ).size
  const recordedBa = new Set(periodRecords.value.map((record) => record.baId))
  const missingBa = matchingRoster.value.filter((ba) => !recordedBa.has(ba.id)).length
  return {
    totalBa,
    completedBa,
    missingBa,
    completionRate: totalBa ? Math.round((completedBa / totalBa) * 100) : 0
  }
})

const scopeLabel = computed(() => (isNational.value ? '全国' : '雅加达南区'))
const periodLabel = computed(() =>
  dateFrom.value === dateTo.value
    ? dateFrom.value
    : `${dateFrom.value || '不限'} 至 ${dateTo.value || '不限'}`
)
const requirementLabel = computed(() =>
  photoRequirements.value.length
    ? t(photoRequirements.value.map((item) => `${item.name} ${item.count} 张`).join(' · '))
    : t('未配置照片要求')
)

const summaryCards = computed(() => [
  { label: '范围内 BA', value: summary.value.totalBa, icon: 'lucide:users', tone: 'text-[#242124]' },
  { label: '已打卡', value: summary.value.completedBa, icon: 'lucide:check-circle-2', tone: 'text-[#3B8F72]' },
  { label: '未打卡', value: summary.value.missingBa, icon: 'lucide:clock-3', tone: 'text-[#766F73]' },
  { label: '周期内打卡率', value: `${summary.value.completionRate}%`, icon: 'lucide:camera', tone: 'text-rose-600' }
])

const openSettings = () => {
  draftRequirements.value = photoRequirements.value.map((item) => ({ ...item }))
  settingsOpen.value = true
}

const addRequirement = () => {
  draftRequirements.value = [
    ...draftRequirements.value,
    { id: `custom-${Date.now()}`, name: '新照片种类', description: '', count: 1, prompt: '请填写 AI 评价标准。' }
  ]
}

const removeRequirement = (id: string) => {
  draftRequirements.value = draftRequirements.value.filter((item) => item.id !== id)
}

const updateRequirement = (id: string, patch: Partial<CheckinPhotoRequirement>) => {
  draftRequirements.value = draftRequirements.value.map((item) =>
    item.id === id ? { ...item, ...patch } : item
  )
}

const saveRequirements = () => {
  photoRequirements.value = draftRequirements.value.filter((item) => item.name.trim())
  settingsOpen.value = false
}

const statusOf = (row: CheckinRow) => row.record?.status ?? 'missing'
const scoreOf = (value?: number) => value ?? '—'
</script>

<template>
  <div class="flex min-h-full flex-col gap-5 pt-2">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-[#242124]">BA 打卡记录</h1>
        </div>
        <p class="mt-1 text-sm text-[#766F73]">
          查看 {{ t(`${scopeLabel} BA 的每日妆容照与柜台出样照提交情况`) }}
        </p>
      </div>
    </header>

    <div class="rounded-xl border border-solid border-[#E9E4DF] bg-white shadow-sm">
      <div class="border-b border-solid border-[#EFEAE7] p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-sm font-bold text-[#242124]">
            <Icon icon="lucide:search" :size="16" class="text-rose-500" />筛选记录
          </div>
          <button
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-solid border-[#E5DED8] bg-white px-3 text-xs font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
            @click="resetFilters"
          >
            <Icon icon="lucide:refresh-ccw" :size="14" />重置筛选
          </button>
        </div>
      </div>
      <div class="p-4">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label class="text-xs font-bold text-[#5D565A]">
            开始日期
            <input
              v-model="dateFrom"
              aria-label="开始日期"
              type="date"
              :max="dateTo || undefined"
              :class="[fieldClass, 'mt-1.5 h-9 py-1.5']"
            />
          </label>
          <label class="text-xs font-bold text-[#5D565A]">
            结束日期
            <input
              v-model="dateTo"
              aria-label="结束日期"
              type="date"
              :min="dateFrom || undefined"
              :class="[fieldClass, 'mt-1.5 h-9 py-1.5']"
            />
          </label>
          <label class="text-xs font-bold text-[#5D565A]">
            区域
            <select
              v-model="regionFilter"
              aria-label="区域"
              :class="[fieldClass, 'mt-1.5 h-9 py-1.5']"
              @change="storeFilter = 'all'"
            >
              <option value="all">全部区域</option>
              <option v-for="[id, name] in regionOptions" :key="id" :value="id">{{ name }}</option>
            </select>
          </label>
          <label class="text-xs font-bold text-[#5D565A]">
            门店
            <select v-model="storeFilter" aria-label="门店" :class="[fieldClass, 'mt-1.5 h-9 py-1.5']">
              <option value="all">全部门店</option>
              <option v-for="[id, name] in storeOptions" :key="id" :value="id">{{ name }}</option>
            </select>
          </label>
          <label class="text-xs font-bold text-[#5D565A]">
            状态
            <select v-model="statusFilter" aria-label="状态" :class="[fieldClass, 'mt-1.5 h-9 py-1.5']">
              <option value="all">全部状态</option>
              <option value="completed">已打卡</option>
              <option value="missing">未打卡</option>
            </select>
          </label>
          <label class="text-xs font-bold text-[#5D565A]">
            BA 搜索
            <div class="relative mt-1.5">
              <Icon
                icon="lucide:search"
                :size="16"
                class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]"
              />
              <input
                v-model="search"
                aria-label="搜索 BA"
                placeholder="姓名 / 工号 / 门店"
                :class="[fieldClass, 'h-9 py-1.5 pl-9']"
              />
            </div>
          </label>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="card in summaryCards"
        :key="card.label"
        class="rounded-xl border border-solid border-[#E9E4DF] bg-white shadow-sm"
      >
        <div class="flex items-center justify-between p-4">
          <div>
            <p class="text-[10px] font-bold tracking-widest text-[#8B8387] uppercase">
              {{ card.label }}
            </p>
            <p class="mt-1 text-2xl font-bold" :class="card.tone">{{ card.value }}</p>
          </div>
          <Icon :icon="card.icon" :size="20" :class="[card.tone, 'opacity-80']" />
        </div>
      </div>
    </div>

    <section class="min-h-0 overflow-hidden rounded-xl border border-solid border-[#E9E4DF] bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-solid border-[#E9E4DF] px-5 py-4">
        <div>
          <h2 class="text-sm font-bold text-[#242124]">打卡记录列表</h2>
          <p class="mt-1 text-xs text-[#766F73]">
            {{ t(`筛选周期：${periodLabel} · 共 ${rows.length} 条展示 · 要求：`) }}{{ requirementLabel }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-solid border-[#E5DED8] bg-white px-3 text-xs font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
          @click="openSettings"
        >
          <Icon icon="lucide:settings-2" :size="14" />打卡设置
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="beauty-table w-full min-w-[1040px] text-left text-xs">
          <thead class="bg-[#F8F5F3] text-[10px] font-bold text-[#766F73]">
            <tr>
              <th class="px-5 py-3">BA / 工号</th>
              <th class="px-4 py-3">区域</th>
              <th class="px-4 py-3">门店</th>
              <th class="px-4 py-3">打卡日期</th>
              <th class="px-4 py-3">提交时间</th>
              <th class="px-4 py-3">照片状态</th>
              <th class="px-4 py-3">AI 评分</th>
              <th class="px-5 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.record?.id ?? `missing-${row.profile.id}`" class="hover:bg-[#FCFAF8]">
              <td class="px-5 py-3">
                <div class="font-bold text-[#242124]">{{ row.profile.name }}</div>
                <div class="mt-1 font-mono text-[10px] text-[#9A9396]">{{ row.profile.id }}</div>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 text-[#5D565A]">
                  <Icon icon="lucide:map-pin" :size="14" class="text-[#9A9396]" />{{ row.profile.regionName }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 text-[#5D565A]">
                  <Icon icon="lucide:store" :size="14" class="text-[#9A9396]" />{{ row.profile.storeName }}
                </span>
              </td>
              <td class="px-4 py-3 font-medium text-[#3F3A3D]">{{ row.record?.checkinDate ?? '—' }}</td>
              <td class="px-4 py-3 text-[#766F73]">{{ row.record?.submittedAt ?? '暂无提交' }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex h-5 items-center gap-1 rounded-full border border-solid px-2 text-xs font-medium whitespace-nowrap"
                  :class="STATUS_META[statusOf(row)].className"
                >
                  <Icon :icon="STATUS_META[statusOf(row)].icon" :size="12" />
                  {{ STATUS_META[statusOf(row)].label }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div v-if="row.record" class="flex items-center gap-2 whitespace-nowrap">
                  <span class="inline-flex items-baseline gap-1">
                    <span class="text-[10px] text-[#8B8387]">妆容</span>
                    <strong class="font-mono text-xs font-bold text-[#242124] tabular-nums">{{ scoreOf(row.record.makeupPhoto?.aiScore) }}</strong>
                  </span>
                  <span class="h-3 w-px bg-[#E5DED8]"></span>
                  <span class="inline-flex items-baseline gap-1">
                    <span class="text-[10px] text-[#8B8387]">出样</span>
                    <strong class="font-mono text-xs font-bold text-[#242124] tabular-nums">{{ scoreOf(row.record.counterPhoto?.aiScore) }}</strong>
                  </span>
                </div>
                <span v-else class="text-[#B4ACB0]">—</span>
              </td>
              <td class="px-5 py-3 text-right">
                <button
                  v-if="row.record"
                  type="button"
                  class="inline-flex h-8 items-center gap-1.5 rounded-md border border-solid border-[#E5DED8] bg-white px-3 text-xs font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
                  @click="selectedRow = row"
                >
                  <Icon icon="lucide:eye" :size="14" />查看详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="rows.length === 0" class="flex flex-col items-center justify-center px-5 py-16 text-center">
          <Icon icon="lucide:search" :size="32" class="text-[#C7BFBB]" />
          <p class="mt-3 text-sm font-bold text-[#5D565A]">没有符合条件的记录</p>
          <p class="mt-1 text-xs text-[#9A9396]">调整日期、组织范围或关键词后再试</p>
        </div>
      </div>
    </section>

    <!-- 打卡详情 -->
    <el-dialog
      v-model="detailOpen"
      width="900px"
      append-to-body
      class="!p-0"
      body-class="!max-h-[80vh] !overflow-y-auto !p-6"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E9E4DF] !px-6 !pt-5 !pb-4"
    >
      <template #header>
        <div class="flex items-center gap-2 text-lg font-bold text-[#242124]">
          <Icon icon="lucide:camera" :size="20" class="text-rose-500" />BA 打卡详情
        </div>
      </template>
      <div v-if="selectedRow" class="space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <Icon icon="lucide:users" :size="20" />
            </div>
            <div>
              <h2 class="text-base font-bold text-[#242124]">{{ selectedRow.profile.name }}</h2>
              <p class="mt-1 text-xs text-[#766F73]">
                {{ selectedRow.profile.id }} · {{ selectedRow.profile.storeName }}
              </p>
            </div>
          </div>
          <span
            class="inline-flex h-5 items-center gap-1 rounded-full border border-solid px-2 text-xs font-medium whitespace-nowrap"
            :class="STATUS_META[statusOf(selectedRow)].className"
          >
            <Icon :icon="STATUS_META[statusOf(selectedRow)].icon" :size="14" />
            {{ STATUS_META[statusOf(selectedRow)].label }}
          </span>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-3">
            <div class="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]">
              <Icon icon="lucide:map-pin" :size="16" />所属区域
            </div>
            <div class="mt-1.5 text-sm font-bold text-[#242124]">{{ selectedRow.profile.regionName }}</div>
          </div>
          <div class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-3">
            <div class="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]">
              <Icon icon="lucide:calendar-days" :size="16" />打卡日期
            </div>
            <div class="mt-1.5 text-sm font-bold text-[#242124]">
              {{ selectedRow.record?.checkinDate ?? '暂无记录' }}
            </div>
          </div>
          <div class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-3">
            <div class="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]">
              <Icon icon="lucide:clock-3" :size="16" />提交时间
            </div>
            <div class="mt-1.5 text-sm font-bold text-[#242124]">
              {{ selectedRow.record?.submittedAt ?? '暂无提交' }}
            </div>
          </div>
        </div>

        <div v-if="selectedRow.record" class="grid gap-4 lg:grid-cols-2">
          <CheckinPhotoPanel title="妆容照" description="正面妆容与当日形象" :photo="selectedRow.record.makeupPhoto" />
          <CheckinPhotoPanel title="柜台出样照" description="柜台陈列与台面状态" :photo="selectedRow.record.counterPhoto" />
        </div>
        <div
          v-else
          class="rounded-lg border border-dashed border-[#D8D0CB] bg-[#FCFAF8] px-5 py-12 text-center"
        >
          <Icon icon="lucide:clock-3" :size="32" class="mx-auto text-[#C7BFBB]" />
          <p class="mt-3 text-sm font-bold text-[#5D565A]">该 BA 在筛选周期内暂无打卡记录</p>
          <p class="mt-1 text-xs text-[#9A9396]">BeautyAI 提交两张照片后，这里会显示完整记录</p>
        </div>

        <div v-if="selectedRow.record" class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-4">
          <div class="text-xs font-bold text-[#3F3A3D]">提交说明</div>
          <div class="mt-3 grid gap-2 text-xs text-[#766F73] sm:grid-cols-2">
            <span>记录 ID：<strong class="font-mono text-[#5D565A]">{{ selectedRow.record.id }}</strong></span>
            <span>
              提交校验：
              <strong :class="statusOf(selectedRow) === 'completed' ? 'text-[#3B8F72]' : 'text-[#766F73]'">
                {{ statusOf(selectedRow) === 'completed' ? '两张照片齐全' : '暂无提交' }}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 打卡设置 -->
    <el-dialog v-model="settingsOpen" width="560px" append-to-body>
      <template #header>
        <div class="flex items-center gap-2 text-lg font-bold text-[#242124]">
          <Icon icon="lucide:settings-2" :size="20" class="text-rose-500" />打卡设置
        </div>
      </template>
      <div class="space-y-4">
        <p class="text-sm text-[#766F73]">设置 BA 每次打卡需要上传的照片种类和数量。</p>
        <div class="space-y-3">
          <div
            v-for="item in draftRequirements"
            :key="item.id"
            class="space-y-3 rounded-lg border border-solid border-[#E9E4DF] bg-[#FCFAF8] p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="grid flex-1 gap-2 sm:grid-cols-2">
                <label class="text-xs font-bold text-[#5D565A]">
                  照片名称
                  <input
                    :value="item.name"
                    :aria-label="`${item.name}名称`"
                    :class="[fieldClass, 'mt-1.5 h-9 py-1.5']"
                    @input="updateRequirement(item.id, { name: ($event.target as HTMLInputElement).value })"
                  />
                </label>
                <label class="text-xs font-bold text-[#5D565A]">
                  上传数量
                  <input
                    :value="item.count"
                    :aria-label="`${item.name}数量`"
                    type="number"
                    min="1"
                    max="9"
                    :class="[fieldClass, 'mt-1.5 h-9 py-1.5']"
                    @input="updateRequirement(item.id, { count: Math.min(9, Math.max(1, Number(($event.target as HTMLInputElement).value) || 1)) })"
                  />
                </label>
              </div>
              <button
                v-if="item.id.startsWith('custom-')"
                type="button"
                class="rounded-md px-2 py-1 text-xs font-medium text-[#9B4B4B] transition-colors hover:bg-red-50 hover:text-red-700"
                @click="removeRequirement(item.id)"
              >
                移除
              </button>
            </div>
            <label class="block text-xs font-bold text-[#5D565A]">
              照片说明
              <textarea
                :value="item.description"
                :aria-label="`${item.name}说明`"
                placeholder="说明 BA 需要拍摄的内容"
                :class="[fieldClass, 'mt-1.5 min-h-16 resize-y']"
                @input="updateRequirement(item.id, { description: ($event.target as HTMLTextAreaElement).value })"
              ></textarea>
            </label>
            <label class="block text-xs font-bold text-[#5D565A]">
              AI 评价 Prompt
              <textarea
                :value="item.prompt"
                :aria-label="`${item.name}AI评价Prompt`"
                placeholder="输入 AI 评分时参考的评价标准"
                :class="[fieldClass, 'mt-1.5 min-h-20 resize-y']"
                @input="updateRequirement(item.id, { prompt: ($event.target as HTMLTextAreaElement).value })"
              ></textarea>
            </label>
          </div>
        </div>
        <button
          type="button"
          class="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-rose-300 bg-rose-50/40 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
          @click="addRequirement"
        >
          <Icon icon="lucide:plus" :size="16" />新增照片种类
        </button>
        <div class="flex justify-end gap-2 border-t border-solid border-[#EFEAE7] pt-4">
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
            @click="settingsOpen = false"
          >
            取消
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700"
            @click="saveRequirements"
          >
            保存设置
          </button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.beauty-table tbody tr + tr {
  border-top: 1px solid #efeae7;
}
</style>
