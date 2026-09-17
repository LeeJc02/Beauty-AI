<script setup lang="ts">
/**
 * 细进度条（原型 `shared.tsx` 的 `Bar`）。
 */
import { computed } from 'vue'

defineOptions({ name: 'BeautyBar' })

const props = withDefaults(
  defineProps<{
    value: number
    max: number
    /** 颜色（原子类） */
    tone?: string
  }>(),
  { tone: 'bg-primary' }
)

const width = computed(() => (props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0))
</script>

<template>
  <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
    <div class="h-full rounded-full" :class="tone" :style="{ width: `${width}%` }"></div>
  </div>
</template>
