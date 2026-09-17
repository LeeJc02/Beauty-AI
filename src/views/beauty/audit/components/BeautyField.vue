<script setup lang="ts">
/**
 * 「字段名 + 值」两列小排版（原型 `RiskCard.tsx` 的 `Field`、
 * `CheckupTab.tsx` / `TaskDetailDialog.tsx` 的 `Field` / `Info`）。
 *
 * - row：左侧固定 46px 的字段名（风险卡）
 * - stack：字段名在上、值在下（任务体检 / 任务详情）
 */
defineOptions({ name: 'BeautyField' })

withDefaults(defineProps<{ label: string; variant?: 'row' | 'stack' }>(), { variant: 'stack' })
</script>

<template>
  <div v-if="variant === 'row'" class="grid grid-cols-[46px_1fr] gap-2">
    <span class="text-muted-foreground">{{ label }}</span>
    <span class="text-foreground"><slot></slot></span>
  </div>
  <div v-else class="grid gap-0.5">
    <span class="text-[11px] text-muted-foreground">{{ label }}</span>
    <span class="text-[12px] font-medium text-foreground"><slot></slot></span>
  </div>
</template>
