<script setup lang="ts">
import { computed } from 'vue'

/**
 * 徽标：对应原型 `components/ui/badge.tsx`。
 *
 * 原型用 cva 定义变体，默认变体的 `bg-primary / text-primary-foreground` 取自原型的
 * `index.css` 主题令牌（oklch 折算为十六进制），`outline` 变体对应 `--border` / `--foreground`。
 * DOM 仍是单个 span，保留 h-5 / rounded / px-2 / text-xs 的基础样式。
 */
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'

const props = withDefaults(defineProps<{ variant?: BadgeVariant }>(), { variant: 'default' })

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: 'bg-[#C75A69] text-white',
  secondary: 'bg-[#F6E7E9] text-[#242124]',
  destructive: 'bg-[#F8E7EA] text-[#C75A69]',
  outline: 'border-[#E5DED8] text-[#242124]',
  ghost: 'text-[#242124]'
}

const badgeClass = computed(() => [
  'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all',
  VARIANT_CLASS[props.variant]
])
</script>

<template>
  <span :class="badgeClass">
    <slot ></slot>
  </span>
</template>
