<script setup lang="ts">
import { computed } from 'vue'
import { getProgressTone, getScoreTone, getTaskStatusBadgeClass } from '@/beauty/lib/visualTones'
import { getEmployeeMonthlyPoints } from '@/beauty/lib/points'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyBadge from './BeautyBadge.vue'
import BeautyProgress from './BeautyProgress.vue'
import MonthlyPointsFormulaTooltip from './MonthlyPointsFormulaTooltip.vue'
import type { StaffProfile } from './types'

/**
 * 员工下钻档案：对应原型 HTDashboard / Dashboard 里选中员工后的详情面板。
 *
 * 两个原型页的这块内容逐字一致（HT 版自带 `border border-t-0 … rounded-b-xl` 外框，
 * 区域版外层 Tabs 已带边框，所以用 `bordered` 区分）。
 */
const props = withDefaults(defineProps<{ staffName: string; profile: StaffProfile; bordered?: boolean }>(), {
  bordered: false
})

const emit = defineEmits<{ (e: 'back'): void }>()

const { t } = useBeautyI18n()

const pointBreakdown = computed(() => [
  {
    label: t('任务完成分'),
    detail: t(`${props.profile.taskCompleted} 个任务已完成`),
    value: `+${props.profile.taskCompleted * 10}`,
    tone: 'text-[#3B8F72]'
  },
  {
    label: t('考试成绩'),
    detail: t('按原始分计入'),
    value: `+${props.profile.examScore}`,
    tone: getScoreTone(props.profile.examScore)
  }
])

const monthlyPoints = computed(() =>
  getEmployeeMonthlyPoints(props.profile.taskCompleted, props.profile.examScore)
)

const taskRateTone = computed(() => getProgressTone(props.profile.taskRate))
</script>

<template>
  <div
    class="beauty-panel-in flex h-full flex-col bg-white p-4"
    :class="bordered ? 'rounded-b-xl rounded-t-none border border-t-0 border-[#E9E4DF] shadow-sm' : ''"
  >
    <div class="mb-4 flex flex-row items-center justify-between">
      <button
        type="button"
        class="flex items-center rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 hover:text-rose-800"
        @click="emit('back')"
      >
        <Icon icon="lucide:chevron-left" :size="12" class="mr-1" /> 返回员工列表
      </button>
      <BeautyBadge
        variant="destructive"
        :class="profile.isAtRisk
          ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
          : 'bg-[#EEF8F4] text-[#3B8F72] hover:bg-[#EEF8F4]'"
      >
        {{ profile.status }}
      </BeautyBadge>
    </div>
    <div class="mb-6 flex items-center space-x-4 px-2">
      <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 shadow-sm">
        <img
          :src="`https://api.dicebear.com/7.x/notionists/svg?seed=${staffName}`"
          :alt="staffName"
          class="h-full w-full object-cover"
        />
      </div>
      <div>
        <h3 class="text-lg font-bold text-[#242124]">{{ staffName }}</h3>
        <p class="text-xs text-[#766F73]">{{ profile.meta }}</p>
      </div>
    </div>

    <div class="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
      <div class="space-y-4">
        <div class="flex h-full flex-col rounded-xl border border-[#E9E4DF] bg-white p-4 shadow-sm">
          <h4 class="mb-4 flex items-center text-xs font-bold tracking-wider text-[#242124]">
            <Icon icon="lucide:book-open" :size="16" class="mr-2 text-rose-500" /> 学习与考试
          </h4>
          <div class="flex-1 space-y-4">
            <div class="rounded-lg border border-[#E9E4DF] bg-[#F8F5F3]/50 p-3">
              <div class="mb-2 flex justify-between text-xs">
                <span class="font-medium text-[#766F73]">
                  任务完成率 ({{ profile.taskCompleted }}/{{ profile.taskTotal }})
                </span>
                <span class="font-bold" :class="taskRateTone.textClass">{{ profile.taskRate }}%</span>
              </div>
              <BeautyProgress
                :value="profile.taskRate"
                class="h-1.5 bg-slate-100"
                :indicator-class="taskRateTone.indicatorClass"
              />
            </div>
            <div class="rounded-lg border border-[#E9E4DF] bg-[#F8F5F3]/50 p-3">
              <div class="mb-2 flex justify-between text-xs">
                <span class="font-medium text-[#766F73]">最近考试成绩</span>
                <span class="font-bold" :class="getScoreTone(profile.examScore)">{{ profile.examScore }}分</span>
              </div>
              <div class="mt-1 flex items-center gap-1 text-[10px] font-medium text-[#9A9396]">
                历次趋势：
                <span
                  v-for="(score, index) in profile.examTrend"
                  :key="`${staffName}-${score}-${index}`"
                  :class="index === profile.examTrend.length - 1 ? `font-bold ${getScoreTone(score)}` : 'text-[#5D565A]'"
                >
                  {{ score }}
                </span>
              </div>
            </div>
            <div class="rounded-lg border border-[#F3C9BC] bg-[#FFF0E8] p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-wider text-[#A85F4B]">
                    <MonthlyPointsFormulaTooltip tooltip-class="left-0 translate-x-0" />
                  </p>
                  <p class="mt-1 text-[10px] leading-relaxed text-[#766F73]">
                    任务每完成 1 个计 10 分，考试按原始分计入
                  </p>
                </div>
                <span class="text-2xl font-bold text-[#A85F4B]">{{ monthlyPoints }}</span>
              </div>
              <div class="mt-3 space-y-2 border-t border-[#F3C9BC] pt-2">
                <div
                  v-for="item in pointBreakdown"
                  :key="item.label"
                  class="flex items-center justify-between gap-2 text-[10px]"
                >
                  <span class="min-w-0 text-[#766F73]">
                    <span class="font-bold text-[#3F3A3D]">{{ item.label }}</span>
                    <span class="ml-1">{{ item.detail }}</span>
                  </span>
                  <span class="shrink-0 font-bold" :class="item.tone">{{ item.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="flex h-full flex-col rounded-xl border border-[#E9E4DF] bg-white p-4 shadow-sm">
          <h4 class="mb-4 flex items-center text-xs font-bold tracking-wider text-[#242124]">
            <Icon icon="lucide:circle-play" :size="16" class="mr-2 text-[#3B8F72]" /> 近期任务情况
          </h4>
          <div class="flex-1 overflow-hidden rounded-lg border border-[#E9E4DF] bg-[#F8F5F3]/50">
            <ul class="divide-y divide-[#E9E4DF]">
              <li
                v-for="task in profile.recentTasks"
                :key="task.name"
                class="p-3 transition-colors hover:bg-white/70"
              >
                <div class="flex items-start justify-between gap-3">
                  <h5 class="min-w-0 flex-1 truncate text-xs font-bold leading-5 text-[#242124]">{{ task.name }}</h5>
                  <BeautyBadge
                    variant="outline"
                    :class="['shrink-0 border-none text-[10px] font-normal', getTaskStatusBadgeClass(task.status)]"
                  >
                    {{ task.status }}
                  </BeautyBadge>
                </div>
                <div class="mt-2 flex items-center justify-between gap-3">
                  <span class="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#9A9396]">{{ task.type }}</span>
                  <div class="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <BeautyProgress
                      :value="task.progress"
                      class="h-1.5 max-w-28 bg-slate-100"
                      :indicator-class="getProgressTone(task.progress).indicatorClass"
                    />
                    <span class="w-8 text-right text-[10px] font-bold" :class="getProgressTone(task.progress).textClass">
                      {{ task.progress }}%
                    </span>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="pt-2 md:col-span-2">
        <div class="staff-insight-note relative overflow-visible rounded-xl border border-[#E8CCA0] bg-[#FFF7EA]/50 p-4">
          <span
            class="absolute right-3 top-3 z-20 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-center text-[9px] font-bold leading-4 text-white shadow-sm backdrop-blur-sm"
          >注</span>
          <div class="absolute left-0 top-0 h-full w-1 bg-[#B9822B]" ></div>
          <h4 class="mb-2 flex items-center text-xs font-bold text-[#242124]">
            <Icon icon="lucide:triangle-alert" :size="16" class="mr-2 text-[#B9822B]" />
            数据波动与学习提示
          </h4>
          <div
            class="staff-insight-note__tip absolute bottom-full right-3 z-[80] mb-2 hidden w-96 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm"
          >
            给研发：员工级洞察不要跟首页 AI 自动洞察一样定期跑；在点击员工进入详情时按需生成，并用 SSE/WebSocket 流式输出。后端只传该员工近 30 天聚合指标和少量证据：错题 Top 5、低分考试、未达标任务、陪练卡点标签、最近 3 条短样例；先用规则/SQL 预筛和摘要缓存，避免把全量答卷、录音或转写原文发给模型。结果按 employeeId + 数据版本短缓存，切换员工或数据更新再重算。
          </div>
          <p class="text-xs leading-relaxed text-[#3F3A3D]">
            根据近期错题统计，该员工的知识盲区主要集中在<span class="font-bold text-[#242124]">「夏季新品系列」</span>。其中涉及<span class="mx-1 rounded border border-[#E8CCA0] bg-white px-1 font-mono text-[10px] shadow-sm">焕白精华适用肤质</span>的考题错误率达 <span class="font-bold text-rose-600">60%</span>。
            <span class="mt-2 block border-t border-[#E8CCA0] pt-2 text-[#766F73]">此外，该员工本月尚未进行任何「场景陪练」打卡。建议提醒门店长针对新品知识面进行当面抽查与辅导。</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.beauty-panel-in {
  animation: beauty-panel-in 300ms ease-out;
}

@keyframes beauty-panel-in {
  from {
    opacity: 0;
    transform: translateX(1rem);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.staff-insight-note:hover .staff-insight-note__tip {
  display: block;
}
</style>
