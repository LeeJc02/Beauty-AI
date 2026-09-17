<script setup lang="ts">
import { computed } from 'vue'

/** 「门店积分」公式气泡：对应原型 `components/MonthlyPointsFormulaTooltip.tsx` 的 StorePointsFormulaTooltip。 */
const props = defineProps<{ tooltipClass?: string }>()

const tooltipClass = computed(() => props.tooltipClass ?? 'left-1/2 -translate-x-1/2')
</script>

<template>
  <span
    class="store-points relative inline-flex items-center justify-center align-middle normal-case tracking-normal"
  >
    <button
      type="button"
      aria-label="门店积分计算公式"
      class="inline-flex items-center justify-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-[#B9822B]/20"
    >
      <span>门店积分</span>
      <Icon icon="lucide:info" :size="14" class="opacity-75" aria-hidden="true" />
    </button>

    <span
      role="tooltip"
      class="store-points__tip pointer-events-none absolute top-full z-[90] mt-2 hidden w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[#E5DED8] bg-white p-3 text-left text-[11px] font-medium leading-relaxed text-[#5D565A] shadow-xl"
      :class="tooltipClass"
    >
      <span class="block text-xs font-bold text-[#242124]">门店积分计算公式</span>
      <span class="mt-2 block rounded-md bg-[#F8F5F3] px-2 py-1.5 font-bold text-[#A85F4B]">
        门店积分 = 全店员工当月积分合计 / 店员人数
      </span>
      <span class="mt-2 block text-[#766F73]">
        按当前门店员工列表计算，员工积分变动后门店积分同步更新。
      </span>
    </span>
  </span>
</template>

<style lang="scss" scoped>
.store-points:hover .store-points__tip,
.store-points:focus-within .store-points__tip {
  display: block;
}
</style>
