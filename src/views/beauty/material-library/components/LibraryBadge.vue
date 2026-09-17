<script setup lang="ts">
/**
 * 素材库徽标（原型里 shadcn Badge variant="outline" 的等价实现）。
 */
defineOptions({ name: 'BeautyLibraryBadge' })

defineProps<{ tone?: string }>()
</script>

<template>
  <span
    class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold"
    :class="tone"
  >
    <slot></slot>
  </span>
</template>
