<script setup lang="ts">
/**
 * 「各区域人均排期」横向条（原型 `AuditConsole.tsx` 的 `RegionChart`）。
 *
 * 手写 CSS 条 + 容量基线刻度，超容量的区域标红；不换成表格或图表库。
 */
import { useBeautyI18n } from '@/beauty/composables'
import type { AuditReport } from '@/beauty/lib/auditTools'

defineOptions({ name: 'BeautyAuditRegionChart' })

const props = defineProps<{ report: AuditReport }>()

const { t } = useBeautyI18n()

/** 条长与基线共用一个刻度，保证两条线可比。 */
const scale = computed(() =>
  Math.max(
    1,
    ...props.report.regions.map((region) => Math.max(region.meanMinutes, region.capacityMinutes))
  )
)

const barWidth = (meanMinutes: number) => `${Math.max((meanMinutes / scale.value) * 100, 1.5)}%`

const baseLeft = (capacityMinutes: number) => `${(capacityMinutes / scale.value) * 100}%`
</script>

<template>
  <div v-if="props.report.regions.length" class="audit-chart">
    <div class="audit-chart__head">
      <span class="audit-section-title">
        <Icon icon="lucide:bar-chart-3" :size="12" /> {{ t('各区域人均排期') }}
      </span>
      <span class="audit-meta">{{ t('竖线 = 该区域容量基线 · 红条 = 已有人超容量') }}</span>
    </div>
    <div v-for="region in props.report.regions" :key="region.regionId" class="audit-chart__row">
      <span class="audit-chart__label" :title="region.name">{{ region.name }}</span>
      <span class="audit-chart__track">
        <span
          class="audit-chart__bar"
          :class="{ 'is-over': region.overCapacityCount > 0 }"
          :style="{ width: barWidth(region.meanMinutes) }"
        ></span>
        <span
          class="audit-chart__base"
          :style="{ left: baseLeft(region.capacityMinutes) }"
          :title="`${t('容量基线')} ${region.capacityMinutes} ${t('分钟')}`"
        ></span>
      </span>
      <span class="audit-chart__value">
        {{ region.taskCount === 0 ? t('本期无任务') : `${region.meanMinutes} 分` }}
        <em v-if="region.overCapacityCount">· {{ region.overCapacityCount }} {{ t('人超') }}</em>
      </span>
    </div>
  </div>
</template>
