<script setup lang="ts">
/**
 * 生效状态徽标（原型 components/EffectiveStatusBadge.tsx）。
 * 用于数字人顾客 / 场景剧本 / 产品金句库的「已生效 / 待生效」提示。
 */
defineOptions({ name: 'BeautyEffectiveStatusBadge' })

const props = defineProps<{ status: 'pending' | 'active' }>()

const isActive = computed(() => props.status === 'active')
</script>

<template>
  <span
    class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold"
    :class="
      isActive
        ? 'border-[#BFE3D4] bg-[#EEF8F4] text-[#2F735C]'
        : 'border-[#F1D39D] bg-[#FFF7EA] text-[#8B621F]'
    "
  >
    <span
      class="h-1.5 w-1.5 rounded-full"
      :class="isActive ? 'bg-[#3B8F72]' : 'bg-[#B9822B]'"
    ></span>
    {{ isActive ? '已生效' : '待生效' }}
  </span>
</template>
