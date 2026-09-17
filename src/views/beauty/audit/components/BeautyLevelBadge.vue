<script setup lang="ts">
/**
 * 风险等级徽标（原型 `shared.tsx` 的 `LevelBadge`）。
 */
import { LEVEL_LABELS } from '@/beauty/lib/inspectionEngine'
import type { RiskLevel } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import { LEVEL_DOT, LEVEL_TONE } from './shared'

defineOptions({ name: 'BeautyLevelBadge' })

defineProps<{ level: RiskLevel }>()

const { t } = useBeautyI18n()
</script>

<template>
  <BeautyChip :tone="LEVEL_TONE[level]" class="font-semibold">
    <span class="h-1.5 w-1.5 rounded-full" :class="LEVEL_DOT[level]"></span>
    {{ t(LEVEL_LABELS[level]) }}
  </BeautyChip>
</template>
