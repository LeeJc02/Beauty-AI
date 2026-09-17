<script setup lang="ts">
/**
 * 超载的人（原型 `RegionBurdenTab.tsx` 里的 `PersonRow`）。
 */
import { computed, ref } from 'vue'
import { ROLE_LABELS } from '@/beauty/lib/inspectionEngine'
import type { BurdenPersonRow } from '@/beauty/lib/inspectionBurden'
import { useBeautyI18n } from '@/beauty/composables'

defineOptions({ name: 'BeautyBurdenPersonRow' })

const props = defineProps<{
  person: BurdenPersonRow
  dailyLimit: number
  week: string
}>()

const { t } = useBeautyI18n()

const dayLabel = (day: string) => day.slice(5).replace('-', '/')

const open = ref(false)
const peak = computed(() => Math.max(...props.person.days.map((day) => day.minutes), 1))
const activeDays = computed(() => props.person.days.filter((day) => day.tasks.length))

const barHeight = (minutes: number) => `${Math.round((minutes / peak.value) * 100)}%`
</script>

<template>
  <div class="rounded-lg bg-muted/40">
    <button
      type="button"
      class="flex w-full items-start gap-2.5 px-2.5 py-2 text-left"
      @click="open = !open"
    >
      <span class="mt-0.5 text-muted-foreground">
        <Icon :icon="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" :size="14" />
      </span>
      <span class="grid flex-1 gap-1">
        <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span class="flex items-center gap-1 font-medium text-foreground">
            <Icon icon="lucide:users" :size="12" /> {{ person.name }}
          </span>
          <span class="text-muted-foreground">
            {{ person.storeName }} · {{ t(ROLE_LABELS[person.role]) }}
          </span>
        </span>
        <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span class="text-foreground">{{ t('本周') }} {{ person.plannedMinutes }} {{ t('分钟') }}</span>
          <span class="text-muted-foreground">{{ person.taskCount }} {{ t('项任务') }}</span>
          <span class="text-rose-600">
            {{ t('超出容量') }} {{ person.excessMinutes }} {{ t('分钟') }}
          </span>
          <span v-if="person.peakDay" class="text-muted-foreground">
            {{ t('最忙') }} {{ dayLabel(person.peakDay) }}（{{ person.dailyPeak }} {{ t('分钟') }}）
          </span>
        </span>
      </span>
    </button>
    <div
      v-if="open"
      class="grid gap-3 border-t border-solid border-border/70 px-3 pt-3 pb-3"
    >
      <div class="flex items-end gap-1.5">
        <div v-for="day in person.days" :key="day.day" class="grid flex-1 justify-items-center gap-1">
          <div class="flex h-16 w-full items-end rounded bg-background">
            <div
              class="w-full rounded"
              :class="day.minutes > dailyLimit ? 'bg-rose-400' : 'bg-primary/60'"
              :style="{ height: barHeight(day.minutes) }"
            ></div>
          </div>
          <span class="text-[10px] text-muted-foreground">{{ dayLabel(day.day) }}</span>
          <span class="text-[10px] font-medium text-foreground">{{ day.minutes }}</span>
        </div>
      </div>
      <div class="grid gap-1">
        <div
          v-for="day in activeDays"
          :key="day.day"
          class="flex flex-wrap items-center gap-1.5 text-[11px]"
        >
          <span class="text-muted-foreground">{{ dayLabel(day.day) }}</span>
          <span class="font-medium text-foreground">{{ day.minutes }} {{ t('分钟') }}</span>
          <span class="text-muted-foreground">
            {{ day.tasks.map((task) => `${task.title} ${task.minutes} ${t('分钟')}`).join(' · ') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
