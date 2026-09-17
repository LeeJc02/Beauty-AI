<script setup lang="ts">
/**
 * 进度条：对应原型 `components/ui/progress.tsx`。
 *
 * DOM 保持三段结构（root / 透明 track / indicator），颜色与高度由调用方传 class，
 * 与原型里 `className="h-1.5 bg-slate-100"` + `indicatorClassName` 的用法一致。
 */
withDefaults(defineProps<{ value: number; indicatorClass?: string }>(), {
  indicatorClass: 'bg-rose-500'
})
</script>

<template>
  <div class="flex w-full overflow-hidden rounded-full bg-slate-100">
    <div class="relative flex h-full w-full items-center overflow-x-hidden rounded-full bg-transparent">
      <div
        class="h-full transition-all"
        :class="indicatorClass"
        :style="{ width: `${value}%` }"
      ></div>
    </div>
  </div>
</template>
