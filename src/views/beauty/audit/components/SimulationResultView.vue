<script setup lang="ts">
/**
 * 模拟结果视图（原型 `training-inspection/SimulatePanel.tsx` 的 `SimulationResultView`）。
 */
import { computed } from 'vue'
import { LEVEL_LABELS } from '@/beauty/lib/inspectionEngine'
import type { SimulationResult } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyLevelBadge from './BeautyLevelBadge.vue'

defineOptions({ name: 'BeautySimulationResultView' })

const props = defineProps<{ result: SimulationResult }>()

const { t } = useBeautyI18n()

const metrics = computed(() => [
  {
    label: t('受影响人数'),
    before: props.result.peopleBefore,
    after: props.result.peopleAfter,
    unit: t('人')
  },
  {
    label: t('人均分钟'),
    before: props.result.meanBefore,
    after: props.result.meanAfter,
    unit: t('分钟')
  },
  {
    label: t('最高单人'),
    before: props.result.maxBefore,
    after: props.result.maxAfter,
    unit: t('分钟')
  },
  {
    label: t('单日峰值'),
    before: props.result.peakBefore,
    after: props.result.peakAfter,
    unit: t('分钟')
  }
])

const deltaTone = (before: number, after: number) =>
  after < before ? 'text-emerald-600' : after > before ? 'text-rose-600' : 'text-foreground'
</script>

<template>
  <div class="grid gap-3">
    <div class="rounded-xl bg-secondary/60 p-3 ring-1 ring-primary/15">
      <div class="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
        <Icon icon="lucide:sparkles" :size="13" /> {{ t('模拟结果') }}
      </div>
      <div class="mt-1.5 text-sm font-medium text-foreground">{{ result.summary }}</div>
      <ul class="mt-1.5 grid gap-0.5 text-[11px] text-muted-foreground">
        <li v-for="reason in result.reasons" :key="reason">· {{ reason }}</li>
      </ul>
    </div>
    <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
      <div
        v-for="item in metrics"
        :key="item.label"
        class="rounded-lg bg-card p-2.5 ring-1 ring-foreground/10"
      >
        <div class="text-[11px] text-muted-foreground">{{ item.label }}</div>
        <div class="mt-1 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
          <span class="text-muted-foreground">{{ item.before }}</span>
          <Icon icon="lucide:arrow-right" :size="12" class="text-muted-foreground" />
          <span :class="deltaTone(item.before, item.after)">{{ item.after }}</span>
          <span class="text-[11px] font-normal text-muted-foreground">{{ item.unit }}</span>
        </div>
      </div>
    </div>
    <div class="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <table class="w-full text-[11px]">
        <thead class="bg-muted/60 text-muted-foreground">
          <tr>
            <th class="px-2.5 py-1.5 text-left font-medium">{{ t('区域') }}</th>
            <th class="px-2.5 py-1.5 text-right font-medium">{{ t('命中人数') }}</th>
            <th class="px-2.5 py-1.5 text-right font-medium">{{ t('人均分钟') }}</th>
            <th class="px-2.5 py-1.5 text-right font-medium">{{ t('超容量人数') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in result.rows"
            :key="row.regionId"
            class="border-t border-solid border-border/60"
          >
            <td class="px-2.5 py-1.5">{{ row.name }}</td>
            <td class="px-2.5 py-1.5 text-right tabular-nums">
              {{ row.peopleBefore }} → {{ row.peopleAfter }}
            </td>
            <td class="px-2.5 py-1.5 text-right tabular-nums">
              {{ row.meanBefore }} → {{ row.meanAfter }}
            </td>
            <td class="px-2.5 py-1.5 text-right tabular-nums">
              {{ row.overBefore }} → {{ row.overAfter }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="grid gap-2 md:grid-cols-3">
      <div class="rounded-lg bg-emerald-50/70 p-2.5 ring-1 ring-emerald-200">
        <div class="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
          <Icon icon="lucide:circle-check-big" :size="12" /> {{ t('解除') }} {{ result.resolved.length }}
        </div>
        <ul class="mt-1 grid gap-0.5 text-[11px] text-emerald-900/80">
          <li v-for="risk in result.resolved" :key="risk.key">{{ risk.ruleId }} · {{ risk.title }}</li>
          <li v-if="!result.resolved.length">{{ t('无') }}</li>
        </ul>
      </div>
      <div class="rounded-lg bg-amber-50/70 p-2.5 ring-1 ring-amber-200">
        <div class="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
          <Icon icon="lucide:alert-triangle" :size="12" /> {{ t('仍命中') }}
          {{ result.levelChanged.length }}
        </div>
        <ul class="mt-1 grid gap-0.5 text-[11px] text-amber-900/80">
          <li v-for="change in result.levelChanged" :key="change.key">
            {{ change.title }}：{{ t(LEVEL_LABELS[change.from]) }} →
            {{ t(LEVEL_LABELS[change.to]) }}
          </li>
          <li v-if="!result.levelChanged.length">{{ t('无') }}</li>
        </ul>
      </div>
      <div class="rounded-lg bg-rose-50/70 p-2.5 ring-1 ring-rose-200">
        <div class="flex items-center gap-1 text-[11px] font-semibold text-rose-700">
          <Icon icon="lucide:alert-triangle" :size="12" /> {{ t('新增') }} {{ result.added.length }}
        </div>
        <ul class="mt-1 grid gap-0.5 text-[11px] text-rose-900/80">
          <li v-for="risk in result.added" :key="risk.key">
            <BeautyLevelBadge :level="risk.level" /> {{ risk.ruleId }} · {{ risk.title }}
          </li>
          <li v-if="!result.added.length">{{ t('无') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>
