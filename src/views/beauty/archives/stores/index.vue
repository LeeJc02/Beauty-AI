<script setup lang="ts">
/**
 * 门店总档案（原型 `src/pages/StoreArchive.tsx`）。
 *
 * 左侧门店列表（可搜索）+ 右侧选中门店的培训数据看板：BA 人数、平均任务完成率、
 * 平均课件学习次数、平均练习次数四个 KPI，以及门店 BA 员工列表。
 *
 * 角色：原型由 `App.tsx` 把 `userRole` 传进来，`HQ Trainer` 看到「全国」视图，
 * 其余区域角色看到「区域」视图；Vue 版用 `useArchiveRole()` 反查。
 *
 * 与原型一致的取舍：门店与员工数据沿用原型里写死的演示数据（原型并没有从
 * `@/beauty/lib/*` 取数），「当月积分」按原型的 `getEmployeeMonthlyPointsFromRate` 实时计算，
 * 而不是用 mock 里那个未展示的 `monthlyPoints` 字段。
 */
import { getEmployeeMonthlyPointsFromRate } from '@/beauty/lib/points'
import { brandTone, getScoreTone } from '@/beauty/lib/visualTones'
import { useBeautyI18n } from '@/beauty/composables'
import { useArchiveRole } from '../useArchiveRole'
import MonthlyPointsFormulaTooltip from '../components/MonthlyPointsFormulaTooltip.vue'

defineOptions({ name: 'BeautyArchivesStores' })

interface ArchiveStore {
  id: string
  name: string
  city: string
}

interface StoreEmployee {
  id: string
  name: string
  completionRate: string
  /** 原型 mock 里的静态积分，仅作对照；页面展示的是按完成率实时算出的积分。 */
  monthlyPoints: number
  lastExamScore: number
}

interface StoreTrainingData {
  baCount: number
  avgTaskCompletion: number
  avgStudyCount: number
  avgPracticeCount: number
  employees: StoreEmployee[]
}

/** 原型 MOCK_STORES。 */
const MOCK_STORES: ArchiveStore[] = [
  { id: 's1', name: 'Jakarta Grand Indonesia', city: 'Jakarta' },
  { id: 's2', name: 'Jakarta Plaza Senayan', city: 'Jakarta' },
  { id: 's3', name: 'Surabaya Tunjungan Plaza', city: 'Surabaya' },
  { id: 's4', name: 'Bali Beachwalk', city: 'Bali' },
  { id: 's5', name: 'Bandung Trans Studio', city: 'Bandung' },
  { id: 's6', name: 'Medan Centre Point', city: 'Medan' },
  { id: 's7', name: 'Yogyakarta Hartono Mall', city: 'Yogyakarta' },
  { id: 's8', name: 'Makassar Trans Studio', city: 'Makassar' }
]

/** 原型 MOCK_STORE_DATA：只给 s1 / s2 详细数据，其余门店走 default。 */
const MOCK_STORE_DATA: Record<string, StoreTrainingData> = {
  s1: {
    baCount: 12,
    avgTaskCompletion: 92.5,
    avgStudyCount: 24,
    avgPracticeCount: 15,
    employees: [
      { id: 'BA001', name: 'Siti Aminah', completionRate: '98%', monthlyPoints: 236, lastExamScore: 95 },
      { id: 'BA012', name: 'Rini Yulianti', completionRate: '85%', monthlyPoints: 184, lastExamScore: 82 },
      { id: 'BA023', name: 'Andi Saputra', completionRate: '90%', monthlyPoints: 203, lastExamScore: 88 }
    ]
  },
  s2: {
    baCount: 8,
    avgTaskCompletion: 88.0,
    avgStudyCount: 18,
    avgPracticeCount: 12,
    employees: [
      { id: 'BA002', name: 'Budi Santoso', completionRate: '88%', monthlyPoints: 191, lastExamScore: 85 },
      { id: 'BA015', name: 'Lestari', completionRate: '100%', monthlyPoints: 248, lastExamScore: 98 }
    ]
  },
  default: {
    baCount: 10,
    avgTaskCompletion: 85.0,
    avgStudyCount: 20,
    avgPracticeCount: 10,
    employees: [
      { id: 'BA055', name: 'Dian Sastrowardoyo', completionRate: '85%', monthlyPoints: 176, lastExamScore: 80 }
    ]
  }
}

const { t } = useBeautyI18n()
const userRole = useArchiveRole()

const selectedStoreId = ref<string>(MOCK_STORES[0].id)
const searchQuery = ref('')

/** 等价原型 isNational。 */
const isNational = computed(() => userRole.value === 'HQ Trainer')

const filteredStores = computed(() => {
  const keyword = searchQuery.value.toLowerCase()
  return MOCK_STORES.filter((store) => store.name.toLowerCase().includes(keyword))
})

const storeData = computed<StoreTrainingData>(
  () => MOCK_STORE_DATA[selectedStoreId.value] ?? MOCK_STORE_DATA.default
)

const selectedStoreName = computed(
  () => MOCK_STORES.find((store) => store.id === selectedStoreId.value)?.name ?? ''
)
</script>

<template>
  <div
    class="flex h-[calc(100vh-11.5rem)] min-h-[620px] overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F7F3F1] pt-2"
  >
    <!-- 左侧门店列表 -->
    <div class="flex w-80 shrink-0 flex-col border-r border-[#E5DED8] bg-white">
      <div class="z-10 flex flex-col gap-3 border-b border-[#E9E4DF] bg-white p-4">
        <h2 class="flex items-center font-bold tracking-tight text-[#242124]">
          <Icon icon="lucide:building" :size="20" class="mr-2 text-rose-600" />
          {{ t(isNational ? '全国门店列表' : '区域门店列表') }}
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
            placeholder="搜索门店名称..."
            class="relative z-10 w-full rounded-lg border border-[#E5DED8] bg-[#F8F5F3] py-2 pr-4 pl-9 text-sm text-[#242124] outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
      </div>

      <div class="flex-1 space-y-1 overflow-y-auto p-3">
        <div
          v-for="store in filteredStores"
          :key="store.id"
          class="cursor-pointer rounded-xl border p-3 transition-all"
          :class="
            selectedStoreId === store.id
              ? 'border-rose-200 bg-rose-50 shadow-sm'
              : 'border-transparent hover:bg-[#F8F5F3]'
          "
          @click="selectedStoreId = store.id"
        >
          <h3
            class="truncate text-sm font-bold"
            :class="selectedStoreId === store.id ? 'text-rose-800' : 'text-[#242124]'"
          >
            {{ store.name }}
          </h3>
          <p
            class="mt-1 flex items-center text-xs"
            :class="selectedStoreId === store.id ? 'text-rose-600' : 'text-[#766F73]'"
          >
            <span
              class="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
              :class="selectedStoreId === store.id ? 'bg-indigo-400' : 'bg-slate-300'"
            ></span>
            {{ store.city }}
          </p>
        </div>
      </div>
    </div>

    <!-- 右侧门店培训数据看板 -->
    <div class="flex h-full flex-1 flex-col overflow-hidden bg-[#F8F5F3]/50">
      <div class="z-10 shrink-0 border-b border-[#E5DED8] bg-white p-6 pb-4">
        <div class="mb-2 flex items-center text-sm font-medium text-[#766F73]">
          <Icon icon="lucide:building" :size="16" class="mr-1.5" />
          {{ t(isNational ? '全国门店总档案' : '区域门店总档案') }}
          <Icon icon="lucide:chevron-right" :size="16" class="mx-1" />
          <span class="font-bold text-[#242124]">{{ selectedStoreName }}</span>
        </div>
        <h1 class="text-2xl font-bold text-[#242124]">
          {{ t(`${selectedStoreName} - 门店培训数据看板`) }}
        </h1>
      </div>

      <div class="flex-1 space-y-6 overflow-y-auto p-6">
        <div class="grid grid-cols-4 gap-4">
          <div class="flex flex-col rounded-xl bg-white p-5 shadow-sm">
            <span
              class="mb-2 flex items-center text-xs font-bold tracking-wider text-[#766F73] uppercase"
            >
              <Icon icon="lucide:users" :size="14" class="mr-1.5 text-rose-500" />
              BA 人数
            </span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#242124]">{{ storeData.baCount }}</span>
              <span class="mb-1 text-sm font-medium text-[#9A9396]">人</span>
            </div>
          </div>

          <div class="flex flex-col rounded-xl bg-white p-5 shadow-sm">
            <span
              class="mb-2 flex items-center text-xs font-bold tracking-wider text-[#766F73] uppercase"
            >
              <Icon icon="lucide:calendar-check" :size="14" class="mr-1.5 text-[#3B8F72]" />
              平均任务完成率
            </span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#3B8F72]">{{ storeData.avgTaskCompletion }}%</span>
            </div>
          </div>

          <div class="flex flex-col rounded-xl bg-white p-5 shadow-sm">
            <span
              class="mb-2 flex items-center text-xs font-bold tracking-wider text-[#766F73] uppercase"
            >
              <Icon icon="lucide:book-open" :size="14" class="mr-1.5 text-blue-500" />
              平均课件学习次数
            </span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#242124]">{{ storeData.avgStudyCount }}</span>
              <span class="mb-1 text-sm font-medium text-[#9A9396]">次/人</span>
            </div>
          </div>

          <div class="flex flex-col rounded-xl bg-white p-5 shadow-sm">
            <span
              class="mb-2 flex items-center text-xs font-bold tracking-wider text-[#766F73] uppercase"
            >
              <Icon icon="lucide:presentation" :size="14" class="mr-1.5 text-[#B9822B]" />
              平均练习次数
            </span>
            <div class="flex items-end gap-2">
              <span class="text-3xl font-bold text-[#242124]">{{ storeData.avgPracticeCount }}</span>
              <span class="mb-1 text-sm font-medium text-[#9A9396]">次/人</span>
            </div>
          </div>
        </div>

        <div
          class="flex min-h-[400px] flex-1 flex-col rounded-xl border border-[#E9E4DF] bg-white shadow-sm"
        >
          <div class="rounded-t-xl border-b border-[#E9E4DF] bg-white p-5">
            <span class="text-sm font-bold text-[#242124]">门店 BA 员工列表</span>
          </div>
          <div class="overflow-auto rounded-b-xl bg-white p-0">
            <table class="w-full text-left text-sm">
              <thead class="sticky top-0 border-b border-[#E9E4DF] bg-[#F8F5F3]/80">
                <tr>
                  <th class="w-24 p-4 font-bold text-[#766F73]">工号</th>
                  <th class="w-48 p-4 font-bold text-[#766F73]">姓名</th>
                  <th class="w-32 p-4 font-bold text-[#766F73]">
                    <MonthlyPointsFormulaTooltip />
                  </th>
                  <th class="w-32 p-4 font-bold text-[#766F73]">任务完成率</th>
                  <th class="w-48 p-4 font-bold text-[#766F73]">最近一次考试分数</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr
                  v-for="emp in storeData.employees"
                  :key="emp.id"
                  class="transition-colors hover:bg-[#F8F5F3]/50"
                >
                  <td class="p-4 font-mono text-xs text-[#9A9396]">{{ emp.id }}</td>
                  <td class="flex items-center p-4 font-bold text-[#242124]">
                    <div
                      class="mr-3 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                      :class="[brandTone.bgClass, brandTone.textClass]"
                    >
                      {{ emp.name.charAt(0) }}
                    </div>
                    {{ emp.name }}
                  </td>
                  <td class="p-4">
                    <span class="font-bold" :class="brandTone.textClass">
                      {{
                        getEmployeeMonthlyPointsFromRate(
                          Number.parseFloat(emp.completionRate),
                          emp.lastExamScore
                        )
                      }}
                    </span>
                  </td>
                  <td class="p-4">
                    <span class="font-bold text-[#3B8F72]">{{ emp.completionRate }}</span>
                  </td>
                  <td class="p-4">
                    <div class="flex items-center">
                      <span class="mr-1 text-lg font-bold" :class="getScoreTone(emp.lastExamScore)">
                        {{ emp.lastExamScore }}
                      </span>
                      <span class="text-xs text-[#9A9396]">分</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
