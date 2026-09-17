<script setup lang="ts">
import { computed } from 'vue'

/**
 * 「当月积分」公式气泡：对应原型 `components/MonthlyPointsFormulaTooltip.tsx`
 * （档案页用的自包含副本，与 `dashboard/components/MonthlyPointsFormulaTooltip.vue` 同源）。
 *
 * 原型用 `group-hover/monthly-points:block` 控制气泡显隐，命名分组变体在 unocss 0.58 不可靠，
 * 这里用 scoped css 实现。定位类默认居中，传 `tooltipClass` 可改对齐方式。
 */
const props = defineProps<{ tooltipClass?: string }>()

const tooltipClass = computed(() => props.tooltipClass ?? 'left-1/2 -translate-x-1/2')
</script>

<template>
  <span class="monthly-points relative inline-flex items-center justify-center align-middle">
    <button
      type="button"
      aria-label="当月积分计算公式"
      class="inline-flex items-center justify-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-[#B9822B]/20"
    >
      <span>当月积分</span>
      <Icon icon="lucide:info" :size="14" class="opacity-75" aria-hidden="true" />
    </button>

    <span
      role="tooltip"
      class="monthly-points__tip pointer-events-none absolute top-full z-[90] mt-2 hidden w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[#E5DED8] bg-white p-3 text-left text-[11px] font-medium leading-relaxed text-[#5D565A] shadow-xl"
      :class="tooltipClass"
    >
      <span class="block text-xs font-bold text-[#242124]">当月积分计算公式</span>
      <span class="mt-2 block rounded-md bg-[#F8F5F3] px-2 py-1.5 font-bold text-[#A85F4B]">
        当月积分 = 已完成任务数 x 10 + 考试成绩
      </span>
      <span class="mt-2 block">
        <span class="font-bold text-[#242124]">任务完成分：</span>
        <span>每完成 1 个任务计 10 分。</span>
      </span>
      <span class="mt-1 block">
        <span class="font-bold text-[#242124]">考试成绩：</span>
        <span>按当月考试原始分直接计入，不再折算。</span>
      </span>
      <span class="mt-2 block border-t border-[#E9E4DF] pt-2 text-[10px] text-[#766F73]">
        同一统计周期内实时累计，月底冻结归档。
      </span>
    </span>
  </span>
</template>

<style lang="scss" scoped>
.monthly-points:hover .monthly-points__tip,
.monthly-points:focus-within .monthly-points__tip {
  display: block;
}
</style>
