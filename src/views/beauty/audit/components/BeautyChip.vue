<script setup lang="ts">
/**
 * 徽标（原型 `training-inspection/shared.tsx` 的 `Chip`）。
 *
 * tone 是一串原子类，调用方直接传颜色；`class` 会像原型里的 className 一样
 * 合并到根节点上（原型用 cn() 追加，Vue 用属性透传）。
 */
defineOptions({ name: 'BeautyChip' })

withDefaults(
  defineProps<{
    /** 颜色（bg / text / ring 三个原子类） */
    tone?: string
  }>(),
  { tone: 'bg-muted text-muted-foreground ring-border' }
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset"
    :class="tone"
  >
    <slot></slot>
  </span>
</template>
