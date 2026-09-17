<script setup lang="ts">
import { computed } from 'vue'

/**
 * 徽标：对应原型 `components/ui/badge.tsx`。
 *
 * 只保留结构样式（inline-flex / h-5 / rounded-full / border / text-xs），
 * 颜色一律由调用方通过 class 传入——原型用 `cn()`（tailwind-merge）做「调用方覆盖基础色」，
 * 而 UnoCSS 的原子类覆盖顺序由生成顺序决定，因此这里不写任何颜色类，保证结果确定。
 *
 * `borderless` 对应调用方传 `border-none` 的场景；因为 `.border-solid` 在 UnoCSS 里排在
 * `.border-none` 之后（会反过来覆盖它），这里用布尔 prop 二选一，避免同元素出现两个 border-style 类。
 */
defineOptions({ name: 'BeautyBadge' })

const props = withDefaults(defineProps<{ borderless?: boolean }>(), { borderless: false })

const badgeClass = computed(() => [
  'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all',
  props.borderless ? 'border-none' : 'border-solid'
])
</script>

<template>
  <span :class="badgeClass">
    <slot></slot>
  </span>
</template>
