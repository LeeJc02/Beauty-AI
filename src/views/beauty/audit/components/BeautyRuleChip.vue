<script setup lang="ts">
/**
 * 规则编号徽标（原型 `shared.tsx` 的 `RuleChip`）。
 */
import { CATEGORY_LABELS } from '@/beauty/lib/inspectionEngine'
import type { RiskCategory } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'

defineOptions({ name: 'BeautyRuleChip' })

defineProps<{
  ruleId: string
  category: RiskCategory
}>()

const { t } = useBeautyI18n()
</script>

<template>
  <BeautyChip tone="bg-slate-50 text-slate-600 ring-slate-200">
    <span class="font-mono font-semibold">{{ ruleId }}</span>
    {{ t(CATEGORY_LABELS[category]) }}
  </BeautyChip>
</template>
