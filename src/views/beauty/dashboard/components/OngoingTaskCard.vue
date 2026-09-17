<script setup lang="ts">
import { computed } from 'vue'
import { getProgressTone } from '@/beauty/lib/visualTones'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyBadge from './BeautyBadge.vue'
import BeautyProgress from './BeautyProgress.vue'
import type { OngoingTask } from './types'

/**
 * 任务监控卡片：对应原型里重复出现的进行中任务卡（全国/区域/区域经理页 + 「查看全部任务」弹窗）。
 *
 * 原型列表态与弹窗态的差异只有字号与内边距（text-[9px]/p-3 vs text-[10px]/p-4），
 * 用 `large` 切换；卡片底部（截止日期 / 开始-结束时间）差异较大，交给 `footer` 插槽。
 */
const props = withDefaults(defineProps<{ task: OngoingTask; large?: boolean }>(), { large: false })

const { t } = useBeautyI18n()

const tone = computed(() => getProgressTone(props.task.progress))

const progressText = computed(() => {
  const task = props.task
  if (task.type === '练习任务') {
    return t(`${task.cycleLabel ?? '当前周期'} ${task.completed} / ${task.total} 人已达标`)
  }
  return t(`${task.completed} / ${task.total} 人已完成`)
})
</script>

<template>
  <div
    class="group relative overflow-hidden rounded-xl border border-[#E9E4DF] bg-white shadow-sm transition-all hover:shadow cursor-pointer"
    :class="large ? 'p-4' : 'p-3'"
  >
    <div class="absolute left-0 top-0 h-full w-1" :class="tone.barClass" ></div>
    <div class="flex items-start justify-between" :class="large ? 'mb-3' : 'mb-2'">
      <h4
        class="font-bold text-[#242124] transition-colors"
        :class="[large ? 'text-sm' : 'text-xs', large ? '' : tone.hoverClass]"
      >
        {{ task.title }}
      </h4>
      <div class="flex items-center gap-1">
        <BeautyBadge
          variant="outline"
          :class="[large ? 'text-[10px]' : 'text-[9px]', 'py-0 border-[#E5DED8] text-[#5D565A] bg-[#F8F5F3]']"
        >
          {{ task.scope }}
        </BeautyBadge>
        <BeautyBadge variant="outline" :class="[large ? 'text-[10px]' : 'text-[9px]', 'py-0', task.badgeClass]">
          {{ task.type }}
        </BeautyBadge>
      </div>
    </div>
    <div
      class="flex justify-between font-medium text-[#766F73]"
      :class="large ? 'text-xs mb-2' : 'text-[10px] mb-1.5'"
    >
      <span>{{ progressText }}</span>
      <span class="font-bold" :class="tone.textClass">{{ task.progress }}%</span>
    </div>
    <BeautyProgress
      :value="task.progress"
      :class="large ? 'h-2 bg-slate-100' : 'h-1.5 bg-slate-100'"
      :indicator-class="tone.indicatorClass"
    />
    <slot name="footer" ></slot>
  </div>
</template>
