<script setup lang="ts">
/**
 * 区域负担对比（原型 `RegionBurdenTab.tsx` 里的 `RegionTable`）。
 */
import { KIND_LABELS } from '@/beauty/lib/inspectionEngine'
import type { RegionBurden } from '@/beauty/lib/inspectionBurden'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyBar from './BeautyBar.vue'
import BeautyChip from './BeautyChip.vue'
import BeautyEmptyState from './BeautyEmptyState.vue'
import BeautySectionHeading from './BeautySectionHeading.vue'

defineOptions({ name: 'BeautyRegionTable' })

defineProps<{ regions: RegionBurden[] }>()

const emit = defineEmits<{ (e: 'open', regionId: string): void }>()

const { t } = useBeautyI18n()

const dayLabel = (day: string) => day.slice(5).replace('-', '/')

const KIND_TONES: Record<string, string> = {
  study: 'bg-sky-50 text-sky-700 ring-sky-200',
  practice: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  exam: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  media: 'bg-cyan-50 text-cyan-700 ring-cyan-200'
}

const kindKeys = Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]
</script>

<template>
  <BeautyEmptyState
    v-if="!regions.length"
    :title="t('没有可见区域')"
    :hint="t('当前账号没有可查看的区域。')"
  />
  <div v-else class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
    <BeautySectionHeading
      :title="t('区域负担对比')"
      :hint="t('按超载比例排序；点一行看这个区域是哪些任务压人')"
    >
      <template #extra>
        <BeautyChip tone="bg-secondary text-secondary-foreground ring-primary/20">
          {{ regions.length }} {{ t('个区域') }}
        </BeautyChip>
      </template>
    </BeautySectionHeading>
    <div class="mt-3 overflow-x-auto">
      <div class="min-w-[820px]">
        <div class="grid grid-cols-12 gap-2 px-2.5 pb-1.5 text-[10.5px] text-muted-foreground">
          <span class="col-span-3">{{ t('区域') }}</span>
          <span class="col-span-2">{{ t('人均分钟 / 容量') }}</span>
          <span class="col-span-2">{{ t('超载人数') }}</span>
          <span class="col-span-2">{{ t('单日峰值') }}</span>
          <span class="col-span-2">{{ t('任务数') }}</span>
          <span class="col-span-1 text-right">{{ t('操作') }}</span>
        </div>
        <div class="grid gap-1.5">
          <div
            v-for="region in regions"
            :key="region.regionId"
            class="grid w-full cursor-pointer grid-cols-12 items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-left transition-colors hover:bg-secondary/70"
            @click="emit('open', region.regionId)"
          >
            <span class="col-span-3 grid gap-0.5">
              <span class="text-[12.5px] font-medium text-foreground">{{ region.regionName }}</span>
              <span class="text-[10.5px] text-muted-foreground">
                {{ t('负责人') }} {{ region.ownerName }} · {{ region.knownHeadcount }} {{ t('人') }}
                <template v-if="region.unknownHeadcount">
                  （{{ region.unknownHeadcount }} {{ t('人缺时长未计入') }}）
                </template>
              </span>
            </span>
            <span class="col-span-2 grid gap-1">
              <template v-if="region.knownHeadcount">
                <span
                  class="text-[12px] font-semibold"
                  :class="region.overCapacityCount > 0 ? 'text-rose-600' : 'text-emerald-700'"
                >
                  {{ region.meanMinutes }} {{ t('分钟') }}
                </span>
                <BeautyBar
                  :value="region.meanMinutes"
                  :max="Math.max(region.capacityMinutes, region.meanMinutes, 1)"
                  :tone="region.overCapacityCount > 0 ? 'bg-rose-400' : 'bg-emerald-400'"
                />
                <span class="text-[10px] text-muted-foreground">
                  {{ t('容量') }} {{ region.capacityMinutes }}{{ region.capacityConfirmed ? '' : t('（默认）') }}
                </span>
              </template>
              <template v-else>
                <span class="text-[12px] font-semibold text-muted-foreground">—</span>
                <span class="text-[10px] text-muted-foreground">{{ t('全员缺预计时长，无法判定') }}</span>
              </template>
            </span>
            <span class="col-span-2 grid gap-0.5">
              <template v-if="region.knownHeadcount">
                <span class="text-[12px]">
                  <span
                    :class="
                      region.overCapacityCount > 0
                        ? 'font-semibold text-rose-600'
                        : 'text-foreground'
                    "
                  >
                    {{ region.overCapacityCount }}
                  </span>
                  <span class="text-muted-foreground">
                    / {{ region.knownHeadcount }} {{ t('人') }}
                  </span>
                </span>
                <span class="text-[10px] text-muted-foreground">
                  {{ t('单日过载') }} {{ region.dailyOverloadCount }} {{ t('人') }}
                </span>
              </template>
              <template v-else>
                <span class="text-[12px] text-muted-foreground">—</span>
                <span class="text-[10px] text-muted-foreground">
                  {{ region.unknownHeadcount }} {{ t('人未计入') }}
                </span>
              </template>
            </span>
            <span class="col-span-2 grid gap-0.5">
              <span class="text-[12px] text-foreground">
                {{ region.peakDayMinutes }} {{ t('分钟') }}
              </span>
              <span class="text-[10px] text-muted-foreground">
                {{ region.peakDay ? dayLabel(region.peakDay) : '—' }}
              </span>
            </span>
            <span class="col-span-2 flex flex-wrap items-center gap-1">
              <span class="text-[12px] text-foreground">{{ region.taskCount }} {{ t('项') }}</span>
              <BeautyChip
                v-for="kind in kindKeys.filter((item) => region.taskCountByKind[item] > 0)"
                :key="kind"
                :tone="KIND_TONES[kind]"
              >
                {{ t(KIND_LABELS[kind]) }} {{ region.taskCountByKind[kind] }}
              </BeautyChip>
            </span>
            <span class="col-span-1 flex justify-end">
              <el-button size="small" plain class="!h-7 !px-2 !text-[11px]" @click.stop="emit('open', region.regionId)">
                {{ t('点击查看') }}
              </el-button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
