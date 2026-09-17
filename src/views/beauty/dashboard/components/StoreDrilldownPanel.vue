<script setup lang="ts">
import { computed } from 'vue'
import { brandTone, getProgressTone, getScoreTone } from '@/beauty/lib/visualTones'
import { getEmployeeMonthlyPointsFromRate } from '@/beauty/lib/points'
import BeautyBadge from './BeautyBadge.vue'
import MonthlyPointsFormulaTooltip from './MonthlyPointsFormulaTooltip.vue'
import type { StoreProfile } from './types'

/**
 * 门店下钻档案：对应原型 HTDashboard / Dashboard 里选中门店后的详情面板。
 *
 * 两个原型页内部逐字一致（HT 版自带 `border border-t-0 … rounded-b-xl` 外框，
 * 区域版外层 Tabs 已带边框），用 `bordered` 区分。
 */
const props = withDefaults(defineProps<{ storeName: string; profile: StoreProfile; bordered?: boolean }>(), {
  bordered: false
})

const emit = defineEmits<{ (e: 'back'): void }>()

const avgTone = computed(() => getProgressTone(props.profile.avgTaskCompletion))
</script>

<template>
  <div
    class="beauty-panel-in flex h-full flex-col bg-white p-4"
    :class="bordered ? 'rounded-b-xl rounded-t-none border border-t-0 border-[#E9E4DF] shadow-sm' : ''"
  >
    <div class="mb-4 flex flex-row items-center justify-between">
      <button
        type="button"
        class="flex items-center rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 hover:text-rose-800"
        @click="emit('back')"
      >
        <Icon icon="lucide:chevron-left" :size="12" class="mr-1" /> 返回门店排行
      </button>
    </div>
    <div class="mb-6 flex items-center space-x-4 px-2">
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50">
        <Icon icon="lucide:building" :size="24" class="text-rose-600" />
      </div>
      <div>
        <h3 class="text-lg font-bold text-[#242124]">{{ storeName }}</h3>
      </div>
    </div>

    <div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-xl border border-[#E9E4DF] bg-[#F8F5F3] p-3 text-center shadow-sm">
        <p class="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#9A9396]">
          <Icon icon="lucide:users" :size="14" class="text-rose-500" /> BA 人数
        </p>
        <p class="text-2xl font-bold text-[#242124]">
          {{ profile.baCount }}<span class="ml-1 text-xs font-medium text-[#766F73]">人</span>
        </p>
      </div>
      <div class="rounded-xl border border-[#E9E4DF] bg-[#F8F5F3] p-3 text-center shadow-sm">
        <p class="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#9A9396]">
          <Icon icon="lucide:calendar-check" :size="14" class="text-[#3B8F72]" /> 平均任务完成率
        </p>
        <p class="text-2xl font-bold" :class="avgTone.textClass">
          {{ profile.avgTaskCompletion }}<span class="ml-1 text-xs font-medium">%</span>
        </p>
      </div>
      <div class="rounded-xl border border-[#E9E4DF] bg-[#F8F5F3] p-3 text-center shadow-sm">
        <p class="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#9A9396]">
          <Icon icon="lucide:book-open" :size="14" class="text-[#4F5FD5]" /> 平均课件学习次数
        </p>
        <p class="text-2xl font-bold text-[#242124]">
          {{ profile.avgStudyCount }}<span class="ml-1 text-xs font-medium text-[#766F73]">次/人</span>
        </p>
      </div>
      <div class="rounded-xl border border-[#E9E4DF] bg-[#F8F5F3] p-3 text-center shadow-sm">
        <p class="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#9A9396]">
          <Icon icon="lucide:presentation" :size="14" class="text-[#B9822B]" /> 平均练习次数
        </p>
        <p class="text-2xl font-bold text-[#242124]">
          {{ profile.avgPracticeCount }}<span class="ml-1 text-xs font-medium text-[#766F73]">次/人</span>
        </p>
      </div>
    </div>

    <div class="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#E9E4DF] bg-white pt-0">
      <div class="flex items-center justify-between border-b border-[#E9E4DF] bg-white p-4">
        <h4 class="flex items-center text-sm font-bold text-[#242124]">
          <Icon icon="lucide:users" :size="16" class="mr-2 text-rose-500" />
          门店 BA 员工列表
        </h4>
        <BeautyBadge variant="outline" :class="['border-none text-[10px]', avgTone.softClass, avgTone.textClass]">
          最新考试平均分 {{ profile.avgExamScore }}
        </BeautyBadge>
      </div>
      <div class="overflow-auto">
        <table class="w-full text-left text-sm">
          <thead class="sticky top-0 border-b border-[#E9E4DF] bg-[#F8F5F3]/80 text-[10px] uppercase tracking-wider text-[#766F73]">
            <tr>
              <th class="w-24 p-3 font-bold">工号</th>
              <th class="min-w-40 p-3 font-bold">姓名</th>
              <th class="w-28 p-3 text-center font-bold" :class="brandTone.textClass">
                <MonthlyPointsFormulaTooltip />
              </th>
              <th class="w-28 p-3 text-center font-bold">任务完成率</th>
              <th class="w-32 p-3 text-right font-bold">最近一次考试分数</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr
              v-for="emp in profile.employees"
              :key="emp.id"
              class="transition-colors hover:bg-[#F8F5F3]/50"
            >
              <td class="p-3 font-mono text-xs text-[#9A9396]">{{ emp.id }}</td>
              <td class="p-3 font-bold text-[#242124]">
                <div class="flex min-w-0 items-center">
                  <div
                    class="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    :class="[brandTone.bgClass, brandTone.textClass]"
                  >
                    {{ emp.name.charAt(0) }}
                  </div>
                  <span class="truncate">{{ emp.name }}</span>
                </div>
              </td>
              <td class="p-3 text-center font-bold" :class="brandTone.textClass">
                {{ getEmployeeMonthlyPointsFromRate(emp.completionRate, emp.lastExamScore) }}
              </td>
              <td class="p-3 text-center font-bold" :class="getProgressTone(emp.completionRate).textClass">
                {{ emp.completionRate }}%
              </td>
              <td class="p-3 text-right text-base font-bold" :class="getScoreTone(emp.lastExamScore)">
                {{ emp.lastExamScore }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.beauty-panel-in {
  animation: beauty-panel-in 300ms ease-out;
}

@keyframes beauty-panel-in {
  from {
    opacity: 0;
    transform: translateX(1rem);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
