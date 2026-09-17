<script setup lang="ts">
import { computed } from 'vue'

/**
 * 徽标：对应原型 `components/ui/badge.tsx`（档案页用的自包含副本，
 * 与 `dashboard/components/BeautyBadge.vue`、`tasks/components/BeautyBadge.vue` 同源）。
 *
 * 默认变体取原型主题令牌 primary / primary-foreground 折算的十六进制，
 * `outline` 变体对应 `--border` / `--foreground`；DOM 仍是单个 span。
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
  <span :class="badgeClass"><slot></slot></span>
</template>
