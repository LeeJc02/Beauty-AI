<script setup lang="ts">
/**
 * 区域明细（原型 `RegionBurdenTab.tsx` 里的 `RegionDetail`）。
 */
import type { RegionBurden } from '@/beauty/lib/inspectionBurden'
import type { DispositionAction, InspectionState, TaskPatch } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyEmptyState from './BeautyEmptyState.vue'
import BeautyKindBadge from './BeautyKindBadge.vue'
import BeautyMetric from './BeautyMetric.vue'
import BeautySectionHeading from './BeautySectionHeading.vue'
import BurdenPersonRow from './BurdenPersonRow.vue'
import BurdenTaskRow from './BurdenTaskRow.vue'

defineOptions({ name: 'BeautyRegionDetail' })

const props = defineProps<{
  region: RegionBurden
  state: InspectionState
  week: string
  today: string
  highlight: string | null
}>()

const emit = defineEmits<{
  (
    e: 'dispose',
    taskId: string,
    riskKey?: string,
    patch?: TaskPatch,
    action?: DispositionAction
  ): void
  (e: 'open-task', taskId: string): void
  (e: 'open-detail', taskId: string): void
}>()

const { t } = useBeautyI18n()

const dayLabel = (day: string) => day.slice(5).replace('-', '/')

const onDispose = (
  taskId: string,
  riskKey?: string,
  patch?: TaskPatch,
  action?: DispositionAction
) => emit('dispose', taskId, riskKey, patch, action)

const over = () => props.region.overCapacityCount > 0
</script>

<template>
  <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
    <BeautySectionHeading
      :title="`${region.regionName} × ${t('本周负担')}`"
      :hint="`${t('负责人')} ${region.ownerName} · ${region.knownHeadcount} ${t('人参与排期')}${region.unknownHeadcount ? `（${t('另有')} ${region.unknownHeadcount} ${t('人缺时长，未计入判定')}）` : ''}`"
    />
    <div class="mt-3 grid gap-3 sm:grid-cols-3">
      <BeautyMetric
        :label="t('人均分钟')"
        :value="region.knownHeadcount ? region.meanMinutes : '—'"
        :unit="region.knownHeadcount ? t('分钟') : ''"
        :hint="
          region.knownHeadcount
            ? `${t('容量')} ${region.capacityMinutes} ${t('分钟/人/周')}${region.capacityConfirmed ? '' : t('（默认口径）')}`
            : `${region.unknownHeadcount} ${t('人全部缺预计时长，无法判定')}`
        "
        :tone="over() ? 'text-rose-600' : 'text-emerald-700'"
      />
      <BeautyMetric
        :label="t('超载人数')"
        :value="region.overCapacityCount"
        :unit="`/ ${region.knownHeadcount} ${t('人')}`"
        :hint="`${t('单日过载')} ${region.dailyOverloadCount} ${t('人')} · ${t('单日阈值')} ${state.policy.dailyLimitMinutes} ${t('分钟')}`"
        :tone="over() ? 'text-rose-600' : ''"
      />
      <BeautyMetric
        :label="t('单日峰值')"
        :value="region.peakDayMinutes"
        unit="分钟"
        :hint="region.peakDay ? `${t('出现在')} ${dayLabel(region.peakDay)}` : t('本周没有排期')"
        :tone="region.peakDayMinutes > state.policy.dailyLimitMinutes ? 'text-amber-600' : ''"
      />
    </div>
    <div
      v-if="region.taskCount"
      class="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[12px] leading-relaxed text-foreground ring-1 ring-primary/15"
    >
      {{ t('占用最多的是') }}
      {{ region.causes.map((task) => `「${task.title}」（${t('人均')} ${task.minutesPerPerson} ${t('分钟')}）`).join('、') }}
      {{
        region.missingMinutesTaskCount
          ? `；${t('另有')} ${region.missingMinutesTaskCount} ${t('项任务缺预计时长，实际负担可能更高。')}`
          : t('。')
      }}
    </div>
  </div>

  <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
    <BeautySectionHeading
      :title="t('任务占用')"
      :hint="t('按人均分钟排序；覆盖人数 × 人均分钟 = 这个任务吃掉的时间')"
    >
      <template #extra>
        <BeautyChip tone="bg-muted text-muted-foreground ring-border">
          {{ region.taskCount }} {{ t('项') }}
        </BeautyChip>
      </template>
    </BeautySectionHeading>
    <div class="mt-3 grid max-h-[420px] gap-1.5 overflow-y-auto pr-0.5">
      <template v-if="region.tasks.length">
        <BurdenTaskRow
          v-for="task in region.tasks"
          :key="task.taskId"
          :task="task"
          :state="state"
          :highlighted="highlight === task.taskId"
          @dispose="onDispose"
          @open-task="emit('open-task', $event)"
          @open-detail="emit('open-detail', $event)"
        />
      </template>
      <BeautyEmptyState
        v-else
        :title="t('本周没有排期任务')"
        :hint="t('这个区域下周才有任务。')"
      />
    </div>
  </div>

  <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
    <BeautySectionHeading
      :title="t('重复内容')"
      :hint="t('同一批人重复做相同内容，是最容易省下来的时间')"
    >
      <template #extra>
        <BeautyChip tone="bg-muted text-muted-foreground ring-border">
          {{ region.duplicates.length }} {{ t('组') }}
        </BeautyChip>
      </template>
    </BeautySectionHeading>
    <div class="mt-3 grid gap-1.5">
      <template v-if="region.duplicates.length">
        <div
          v-for="pair in region.duplicates"
          :key="pair.key"
          class="grid gap-1 rounded-lg bg-muted/40 px-2.5 py-2"
        >
          <div class="flex flex-wrap items-center gap-1.5 text-[12px]">
            <BeautyKindBadge :kind="pair.a.kind" />
            <span class="text-foreground">{{ pair.a.title }}</span>
            <span class="text-muted-foreground">↔</span>
            <BeautyKindBadge :kind="pair.b.kind" />
            <span class="text-foreground">{{ pair.b.title }}</span>
            <BeautyChip tone="bg-amber-50 text-amber-700 ring-amber-200">{{ pair.reason }}</BeautyChip>
          </div>
          <div class="text-[11px] text-muted-foreground">
            {{ pair.overlapPeople }} {{ t('人重叠 · 合并后每人可省约') }} {{ pair.savableMinutes }}
            {{ t('分钟') }}
          </div>
        </div>
      </template>
      <BeautyEmptyState v-else :title="t('没有发现重复内容')" :hint="t('本周任务之间没有重复要求。')" />
    </div>
  </div>

  <div class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
    <BeautySectionHeading
      :title="t('超载的人')"
      :hint="`${t('只列超出容量')}（${region.capacityMinutes} ${t('分钟/人/周')}）${t('的人')}`"
    >
      <template #extra>
        <BeautyChip tone="bg-muted text-muted-foreground ring-border">
          {{ region.people.length }} {{ t('人') }}
        </BeautyChip>
      </template>
    </BeautySectionHeading>
    <div class="mt-3 grid gap-1.5">
      <template v-if="region.people.length">
        <BurdenPersonRow
          v-for="person in region.people"
          :key="person.personId"
          :person="person"
          :daily-limit="state.policy.dailyLimitMinutes"
          :week="week"
        />
      </template>
      <BeautyEmptyState
        v-else
        :title="t('没有人超出容量')"
        :hint="`${t('本周人均')} ${region.meanMinutes} ${t('分钟，低于容量')} ${region.capacityMinutes} ${t('分钟。')}`"
      />
    </div>
  </div>
</template>
