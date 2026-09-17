<script setup lang="ts">
/**
 * 任务权重徽标（原型 `shared.tsx` 的 `WeightBadge`）。
 */
import { computed } from 'vue'
import { WEIGHT_LABELS } from '@/beauty/lib/inspectionEngine'
import type { TaskWeight } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'

defineOptions({ name: 'BeautyWeightBadge' })

const props = defineProps<{ weight: TaskWeight | null }>()

const { t } = useBeautyI18n()

const tone = computed(() => {
  if (props.weight === 'must') return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (props.weight === 'makeup' || props.weight === 'retraining')
    return 'bg-purple-50 text-purple-700 ring-purple-200'
  return 'bg-muted text-muted-foreground ring-border'
})
</script>

<template>
  <BeautyChip v-if="weight" :tone="tone">{{ t(WEIGHT_LABELS[weight]) }}</BeautyChip>
  <BeautyChip v-else>{{ t('未标注权重') }}</BeautyChip>
</template>
