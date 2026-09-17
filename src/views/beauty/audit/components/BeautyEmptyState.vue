<script setup lang="ts">
/**
 * 空状态（原型 `shared.tsx` 的 `EmptyState`）。
 */
defineOptions({ name: 'BeautyEmptyState' })

defineProps<{
  title: string
  hint?: string
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border px-4 py-10 text-center"
  >
    <div class="text-sm font-medium text-foreground">{{ title }}</div>
    <div v-if="hint" class="text-xs text-muted-foreground">{{ hint }}</div>
  </div>
</template>
