<script setup lang="ts">
/**
 * 进度条：对应原型 `components/ui/progress.tsx`。
 *
 * DOM 保持三段结构（root / 透明 track / indicator）；轨道高度与颜色、指示条颜色都由调用方给定，
 * 与原型 `className="h-1.5 bg-[#F1ECE8]"` + `indicatorClassName` 的用法一致。
 * 这里同样不写颜色类，避免与调用方冲突（UnoCSS 原子类覆盖顺序不稳定）。
 */
const props = withDefaults(
  defineProps<{ value: number; trackClass?: string; indicatorClass?: string }>(),
  {
    trackClass: 'h-1.5 bg-[#F1ECE8]',
    indicatorClass: 'bg-rose-500'
  }
)

const width = computed(() => `${Math.min(100, Math.max(0, props.value))}%`)
</script>

<template>
  <div class="flex w-full overflow-hidden rounded-full" :class="trackClass">
    <div class="h-full w-full rounded-full bg-transparent">
      <div class="h-full transition-all" :class="indicatorClass" :style="{ width }"></div>
    </div>
  </div>
</template>
