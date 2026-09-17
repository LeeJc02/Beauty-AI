<script setup lang="ts">
/**
 * 区块标题（原型 `shared.tsx` 的 `SectionHeading`）。
 *
 * 原型的 `extra` 是一个 ReactNode，这里用 `extra` 插槽。
 */
defineOptions({ name: 'BeautySectionHeading' })

defineProps<{
  title: string
  hint?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-2">
    <div>
      <h3 class="text-sm font-semibold text-foreground">{{ title }}</h3>
      <p v-if="hint" class="mt-0.5 text-[11px] text-muted-foreground">{{ hint }}</p>
    </div>
    <slot name="extra"></slot>
  </div>
</template>
