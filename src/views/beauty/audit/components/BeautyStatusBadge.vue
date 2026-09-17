<script setup lang="ts">
/**
 * 风险状态徽标（原型 `shared.tsx` 的 `StatusBadge`）。
 */
import type { RiskStatus } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import { STATUS_TONE } from './shared'

defineOptions({ name: 'BeautyStatusBadge' })

defineProps<{ status: RiskStatus }>()

const { t } = useBeautyI18n()
</script>

<template>
  <BeautyChip :tone="STATUS_TONE[status]">{{ t(status) }}</BeautyChip>
</template>
