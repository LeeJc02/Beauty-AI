<script setup lang="ts">
/**
 * 区块卡片（原型 `CheckupTab.tsx` 里的 `Section`）：图标 + 标题 + extra 插槽 + 内容。
 */
defineOptions({ name: 'BeautySectionCard' })

defineProps<{ title: string }>()
</script>

<template>
  <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
    <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
        <span class="text-primary"><slot name="icon"></slot></span>
        {{ title }}
      </div>
      <slot name="extra"></slot>
    </div>
    <slot></slot>
  </div>
</template>
