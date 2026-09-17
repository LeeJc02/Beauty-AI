<script setup lang="ts">
/**
 * 「这一周每天最忙的人」柱状图（原型 `AuditConsole.tsx` 的 `DayChart`）。
 *
 * 找出「时间集中」到底挤在哪一天；虚线是单日承受线。
 */
import { useBeautyI18n } from '@/beauty/composables'
import type { AuditReport } from '@/beauty/lib/auditTools'
import { WEEKDAYS } from './consoleModel'

defineOptions({ name: 'BeautyAuditDayChart' })

const props = defineProps<{ report: AuditReport }>()

const { t } = useBeautyI18n()

const scale = computed(() =>
  Math.max(1, ...props.report.days.map((day) => day.peakMinutes), props.report.dailyLimitMinutes)
)

const heightOf = (peakMinutes: number) => `${(peakMinutes / scale.value) * 100}%`

const limitBottom = () => `${(props.report.dailyLimitMinutes / scale.value) * 100}%`

/** 日期标签带上星期：老板读「周三」比读「17」快。 */
const labelOf = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? day.slice(8)
    : `周${WEEKDAYS[date.getUTCDay()]} ${day.slice(8)}`
}

const titleOf = (day: string, peakMinutes: number, meanMinutes: number) =>
  `${day.slice(5)} · ${t('最忙')} ${peakMinutes} ${t('分钟')} · ${t('人均')} ${meanMinutes} ${t('分钟')}`
</script>

<template>
  <div v-if="props.report.days.length" class="audit-chart">
    <div class="audit-chart__head">
      <span class="audit-section-title">
        <Icon icon="lucide:bar-chart-3" :size="12" /> {{ t('这一周每天最忙的人') }}
      </span>
      <span class="audit-meta">
        {{ t('虚线 = 每天') }} {{ props.report.dailyLimitMinutes }} {{ t('分钟承受线') }}
      </span>
    </div>
    <div class="audit-days">
      <div
        v-for="day in props.report.days"
        :key="day.day"
        class="audit-days__col"
        :title="titleOf(day.day, day.peakMinutes, day.meanMinutes)"
      >
        <span class="audit-days__track">
          <span
            class="audit-days__bar"
            :class="{ 'is-over': day.peakMinutes > props.report.dailyLimitMinutes }"
            :style="{ height: heightOf(day.peakMinutes) }"
          ></span>
          <span class="audit-days__limit" :style="{ bottom: limitBottom() }"></span>
        </span>
        <span class="audit-days__value">{{ day.peakMinutes }}</span>
        <span class="audit-days__label">{{ labelOf(day.day) }}</span>
      </div>
    </div>
  </div>
</template>
