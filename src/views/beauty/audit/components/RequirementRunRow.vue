<script setup lang="ts">
/**
 * 自定义审计的运行记录行（原型 `RequirementTab.tsx` 里的 `RunRow`）。
 */
import { computed, ref } from 'vue'
import type { RequirementRun } from '@/beauty/lib/inspectionRequirements'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import { jakartaStamp } from './shared'

defineOptions({ name: 'BeautyRequirementRunRow' })

const props = defineProps<{ run: RequirementRun }>()

const { t } = useBeautyI18n()

const dayLabel = (day: string) => day.slice(5).replace('-', '/')

const open = ref(false)

const changes = computed(() =>
  [
    props.run.added.length ? `${t('新增')} ${props.run.added.length} ${t('项')}` : '',
    props.run.resolved.length ? `${t('已解决')} ${props.run.resolved.length} ${t('项')}` : ''
  ].filter(Boolean)
)

const summaryText = computed(() =>
  props.run.repeatCount > 1
    ? `${t('结论没变，连续审计')} ${props.run.repeatCount} ${t('次（首次')} ${jakartaStamp(props.run.at)}）`
    : changes.value.length
      ? `${changes.value.join(' · ')}${t('；结论有变化')}`
      : t('首次运行')
)

const weekText = computed(
  () =>
    `${t('这次统计的是')} ${dayLabel(props.run.week)} ${t('那一周')} · ${t('人均')} ${props.run.meanMinutes} ${t('分钟')}${props.run.unknownPeople ? ` · ${t('另有')} ${props.run.unknownPeople} ${t('人缺预计时长')}` : ''}`
)
</script>

<template>
  <div class="rounded-lg bg-muted/40">
    <button
      type="button"
      class="flex w-full items-start gap-2 px-2.5 py-2 text-left"
      @click="open = !open"
    >
      <span class="mt-0.5 text-muted-foreground">
        <Icon :icon="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" :size="14" />
      </span>
      <span class="grid flex-1 gap-1">
        <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
          <span class="font-medium text-foreground">{{ jakartaStamp(run.lastSeenAt) }}</span>
          <BeautyChip
            :tone="
              run.trigger === 'manual'
                ? 'bg-secondary text-secondary-foreground ring-primary/20'
                : 'bg-muted text-muted-foreground ring-border'
            "
          >
            <Icon icon="lucide:clock" :size="10" />
            {{ run.trigger === 'manual' ? t('手动审计') : t('自动审计') }}
          </BeautyChip>
          <span class="text-muted-foreground">
            {{ t('扫了') }} {{ run.taskCount }} {{ t('项任务 · 看到') }} {{ run.issueCount }}
            {{ t('项问题 · 影响') }} {{ run.peopleCount }} {{ t('人') }}
          </span>
        </span>
        <span class="text-[10.5px] text-muted-foreground">{{ summaryText }}</span>
      </span>
    </button>
    <div
      v-if="open"
      class="grid gap-1.5 border-t border-solid border-border/70 px-2.5 py-2 text-[11px]"
    >
      <span class="text-muted-foreground">{{ weekText }}</span>
      <ul v-if="run.taskLines.length" class="grid gap-1">
        <li v-for="line in run.taskLines" :key="line" class="flex gap-1.5">
          <span class="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60"></span>
          <span>{{ line }}</span>
        </li>
      </ul>
      <span v-if="run.added.length" class="text-emerald-700">
        {{ t('新增：') }}{{ run.added.map((item) => item.label).join('；') }}
      </span>
      <span v-if="run.resolved.length" class="text-muted-foreground">
        {{ t('已解决：') }}{{ run.resolved.map((item) => item.label).join('；') }}
      </span>
    </div>
  </div>
</template>
