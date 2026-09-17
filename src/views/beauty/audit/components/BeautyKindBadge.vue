<script setup lang="ts">
/**
 * 任务类型徽标（原型 `shared.tsx` 的 `KindBadge`）。
 */
import { computed } from 'vue'
import { KIND_LABELS } from '@/beauty/lib/inspectionEngine'
import type { TaskKind } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'

defineOptions({ name: 'BeautyKindBadge' })

const props = defineProps<{ kind: TaskKind }>()

const { t } = useBeautyI18n()

const tone = computed(() =>
  props.kind === 'exam'
    ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
    : props.kind === 'practice'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : props.kind === 'media'
        ? 'bg-cyan-50 text-cyan-700 ring-cyan-200'
        : 'bg-sky-50 text-sky-700 ring-sky-200'
)
</script>

<template>
  <BeautyChip :tone="tone">{{ t(KIND_LABELS[kind]) }}</BeautyChip>
</template>
