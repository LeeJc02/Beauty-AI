<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBeautyI18n } from '@/beauty/composables'
// 仅为 unocss 提供 @/beauty/lib/visualTones 等 .ts 工具函数的动态类名（见该文件注释）。
import '@/views/beauty/dashboard/components/toneSafelist'
import BeautyBadge from '../components/BeautyBadge.vue'
import OngoingTaskCard from '../components/OngoingTaskCard.vue'
import type { OngoingTask } from '../components/types'

/**
 * 区域培训负责人（Regional Training Manager）看板：对应原型 `pages/RTMDashboard.tsx`。
 *
 * 原型这一页没有公司级页头（直接从 KPI 卡开始），这里保持原样；
 * 「查看全部任务」用 el-dialog 承载，卡片本体复用 OngoingTaskCard。
 */
defineOptions({ name: 'BeautyRegionalTrainingManagerView' })

const { t } = useBeautyI18n()

const RTM_ONGOING_TASKS: OngoingTask[] = [
  {
    id: 'rtm-task-1',
    title: '夏季新品区域通关考核',
    scope: '区域',
    type: '考试任务',
    completed: 280,
    total: 342,
    progress: 81,
    deadlineText: '本周五 (剩余 3 天)',
    isWarning: true,
    badgeClass: 'border-rose-200 text-rose-600 bg-rose-50'
  },
  {
    id: 'rtm-task-2',
    title: '秋冬面霜系列话术演练',
    scope: '区域',
    type: '练习任务',
    completed: 145,
    total: 342,
    progress: 42,
    cycleLabel: '本日',
    frequency: '每日完成 1 次',
    deadlineText: '今天 23:59',
    isWarning: false,
    badgeClass: 'border-[#E8CCA0] text-[#B9822B] bg-[#FFF7EA]'
  },
  {
    id: 'rtm-task-3',
    title: '『敏感肌抗老』区域专项陪练',
    scope: '区域',
    type: '练习任务',
    completed: 215,
    total: 342,
    progress: 62,
    cycleLabel: '本周',
    frequency: '每周完成 3 次',
    deadlineText: '下周三',
    isWarning: false,
    badgeClass: 'border-[#BFDCCF] text-[#3B8F72] bg-[#EEF8F4]'
  },
  {
    id: 'rtm-task-4',
    title: '店长基础服务抽检复训',
    scope: '区域',
    type: '学习任务',
    completed: 78,
    total: 96,
    progress: 81,
    deadlineText: '本月月底',
    isWarning: false,
    badgeClass: 'border-[#E5DED8] text-[#5D565A] bg-[#F8F5F3]'
  }
]

const VISIBLE_RTM_ONGOING_TASK_COUNT = 3

/** 区域数字资产（原型带有「新增」入口，这里保留按钮与样式，点击暂不跳转）。 */
const ASSET_ROWS = [
  {
    title: '区域在线课件',
    count: '共计: 34 份',
    icon: 'lucide:book-open',
    iconClass: 'bg-rose-100 text-rose-600',
    hoverClass: 'hover:border-rose-200',
    buttonClass: 'text-rose-600 hover:text-white hover:bg-rose-500 border-rose-200 hover:border-rose-500'
  },
  {
    title: '区域场景剧本',
    count: '共计: 12 个',
    icon: 'lucide:message-square',
    iconClass: 'bg-[#F7E6C8] text-[#B9822B]',
    hoverClass: 'hover:border-[#E8CCA0]',
    buttonClass: 'text-[#B9822B] hover:text-white hover:bg-[#B9822B] border-[#E8CCA0] hover:border-[#B9822B]'
  },
  {
    title: '区域题库题目',
    count: '共计: 450 题',
    icon: 'lucide:database',
    iconClass: 'bg-rose-100 text-rose-600',
    hoverClass: 'hover:border-rose-200',
    buttonClass: 'text-rose-600 hover:text-white hover:bg-rose-500 border-rose-200 hover:border-rose-500'
  },
  {
    title: '区域试卷总数',
    count: '共计: 8 份',
    icon: 'lucide:clipboard-list',
    iconClass: 'bg-[#EEF0FF] text-[#4F5FD5]',
    hoverClass: 'hover:border-[#C8CEF8]',
    buttonClass: 'text-[#4F5FD5] hover:text-white hover:bg-[#4F5FD5] border-[#C8CEF8] hover:border-[#4F5FD5]'
  }
]

const showAllTasks = ref(false)

const hiddenTaskCount = computed(() => RTM_ONGOING_TASKS.length - VISIBLE_RTM_ONGOING_TASK_COUNT)
</script>

<template>
  <div class="flex flex-1 flex-col space-y-6 pt-2">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">区域注册 BA 总数</div>
          <Icon icon="lucide:users" :size="16" class="text-rose-400" />
        </div>
        <div class="p-4 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">342</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">本月课件学习次数</div>
          <Icon icon="lucide:book-open" :size="16" class="text-rose-400" />
        </div>
        <div class="p-4 pt-2">
          <div class="mb-2 flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">12.5<span class="ml-1 text-lg font-medium text-[#766F73]">k</span></span>
            <span class="rounded-md bg-[#F3F5FF] px-2 py-1 text-[10px] font-bold text-[#4F5FD5]">环比 ↑ 15%</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">本月平均任务完成率</div>
          <Icon icon="lucide:calendar-check" :size="16" class="text-[#3B8F72]" />
        </div>
        <div class="p-4 pt-2">
          <div class="mb-2 flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">89.2%</span>
            <span class="rounded-md bg-[#EEF8F4] px-2 py-1 text-[10px] font-bold text-[#3B8F72]">环比 ↑ 5.1%</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
        <div class="flex flex-row items-center justify-between p-4 pb-0">
          <div class="text-xs font-bold uppercase tracking-widest text-[#766F73]">本月区域练习总次数</div>
          <Icon icon="lucide:clock" :size="16" class="text-amber-400" />
        </div>
        <div class="p-4 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">3.1<span class="ml-1 text-lg font-medium text-[#766F73]">k</span></span>
            <span class="rounded-md bg-[#FFF7EA] px-2 py-1 text-[10px] font-bold text-[#B9822B]">约 1.2 万小时</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid h-full min-h-[460px] flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="flex flex-col">
        <div class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
          <div class="border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
            <div class="flex items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:database" :size="16" class="mr-2 text-rose-500" /> 数字资产大盘 (区域通览)
            </div>
          </div>
          <div class="flex flex-1 flex-col space-y-4 p-4">
            <div class="flex flex-1 flex-col content-start gap-3">
              <div
                v-for="asset in ASSET_ROWS"
                :key="asset.title"
                class="group flex cursor-pointer items-center justify-between rounded-xl border border-[#E9E4DF] bg-[#F8F5F3] p-3 transition-colors"
                :class="asset.hoverClass"
              >
                <div class="flex items-center space-x-3">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                    :class="asset.iconClass"
                  >
                    <Icon :icon="asset.icon" :size="20" />
                  </div>
                  <div>
                    <div class="text-sm font-bold text-[#242124]">{{ asset.title }}</div>
                    <div class="mt-0.5 text-[10px] font-medium text-[#766F73]">{{ asset.count }}</div>
                  </div>
                </div>
                <button
                  type="button"
                  class="flex shrink-0 items-center rounded-md border bg-white px-2.5 py-1 text-[11px] font-bold shadow-sm transition-colors"
                  :class="asset.buttonClass"
                >
                  <Icon icon="lucide:plus" :size="12" class="mr-1" /> 新增
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col">
        <div class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm">
          <div class="flex flex-row items-center justify-between border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
            <div class="flex items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:calendar-check" :size="16" class="mr-2 text-rose-500" /> 区域任务监控 (进行中)
            </div>
            <button
              type="button"
              class="flex items-center text-[10px] font-bold text-rose-600 hover:underline"
              @click="showAllTasks = true"
            >
              查看全部任务 <Icon icon="lucide:arrow-right" :size="12" class="ml-1" />
            </button>
          </div>
          <div class="flex flex-1 flex-col space-y-4 overflow-y-auto p-4">
            <OngoingTaskCard
              v-for="task in RTM_ONGOING_TASKS.slice(0, VISIBLE_RTM_ONGOING_TASK_COUNT)"
              :key="task.id"
              :task="task"
            >
              <template #footer>
                <div class="mt-3 flex items-center text-[10px] text-[#9A9396]">
                  <Icon v-if="task.isWarning" icon="lucide:triangle-alert" :size="12" class="mr-1 text-[#B9822B]" />
                  截止日期: {{ task.deadlineText }}
                </div>
              </template>
            </OngoingTaskCard>

            <div v-if="hiddenTaskCount > 0" class="w-full pt-1 text-center text-xs font-bold text-[#9A9396]">
              其他 {{ hiddenTaskCount }} 个任务进行中
            </div>

            <button
              type="button"
              class="mt-2 flex w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 py-3 text-xs font-bold text-[#766F73] transition-colors hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-600"
            >
              <Icon icon="lucide:calendar-check" :size="12" class="mr-1" /> 新增区域任务
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-col">
        <div class="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-slate-800 text-white shadow-sm">
          <div class="absolute right-0 top-0 p-4 opacity-10">
            <Icon icon="lucide:brain-circuit" :size="96" />
          </div>
          <div class="insight-note relative z-30 border-b border-slate-700 bg-slate-900/50 p-4">
            <span
              class="absolute right-3 top-3 z-20 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-center text-[9px] font-bold leading-4 text-white shadow-sm backdrop-blur-sm"
            >注</span>
            <div class="flex items-center text-sm font-bold text-white">
              <Icon icon="lucide:brain-circuit" :size="16" class="mr-2 text-rose-400" /> AI 自动洞察: 区域核心薄弱点
            </div>
            <div class="mt-1 text-[10px] text-[#9A9396]">该洞察基于区域近期数据生成，每周刷新</div>
            <div
              class="insight-note__tip absolute right-3 top-full z-[80] mt-2 w-96 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm"
            >
              给研发：每周离线跑一次，只扫近 7-14 天聚合数据：任务完成率、考试题目错误率、陪练场景卡点率、语音转写标签统计、门店/区域 Top N。为降低 token，先用 SQL/规则聚合出 Top 20 候选，每个候选只传指标、趋势和 2-3 条短样例，不传全量原文/录音；结果缓存为周报，低置信度再二次调用模型。
            </div>
          </div>
          <div class="relative z-10 flex-1 space-y-4 overflow-y-auto p-4">
            <div class="flex flex-col space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 backdrop-blur-sm">
              <div class="flex items-start justify-between">
                <span class="text-xs font-bold text-rose-100">TOP 1: 新品核心成分区分体验</span>
                <BeautyBadge variant="destructive" class="border-none bg-rose-500 px-1.5 py-0 text-[9px] text-white">
                  72% 高频卡点
                </BeautyBadge>
              </div>
              <p class="text-[10px] leading-relaxed text-[#C9C1C4]">
                <span class="font-bold tracking-wide text-rose-400">💡 AI 结论：</span> 区域内大量门店 BA 无法通过情景演练清晰表述双萃系列 "亲水亲油" 的黄金比例，当面对敏感肌顾客时极易背错浓度配比。
              </p>
            </div>

            <div class="flex flex-col space-y-2 rounded-xl border border-[#B9822B]/30 bg-[#B9822B]/10 p-3 backdrop-blur-sm">
              <div class="flex items-start justify-between">
                <span class="text-xs font-bold text-amber-100">TOP 2: 竞对异议处理 (价格向)</span>
                <BeautyBadge variant="outline" class="border-[#B9822B]/50 px-1.5 py-0 text-[9px] font-bold text-amber-300">
                  48% 卡顿超5s
                </BeautyBadge>
              </div>
              <p class="text-[10px] leading-relaxed text-[#C9C1C4]">
                <span class="font-bold tracking-wide text-amber-400">💡 AI 结论：</span> 语音识别显示，员工在被质问 "区域内XX大楼的XX牌更便宜" 时，卡顿显著，缺少差异化卖点和情绪价值支撑。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showAllTasks"
      :title="t('区域任务监控 (所有进行中)')"
      width="672px"
      append-to-body
      top="8vh"
      class="beauty-task-dialog"
    >
      <div class="max-h-[58vh] space-y-3 overflow-y-auto px-1 py-4">
        <OngoingTaskCard v-for="task in RTM_ONGOING_TASKS" :key="task.id" :task="task" large>
          <template #footer>
            <div class="mt-4 flex items-center text-xs font-medium text-[#766F73]">
              <Icon v-if="task.isWarning" icon="lucide:triangle-alert" :size="16" class="mr-1 text-[#B9822B]" />
              截止日期: {{ task.deadlineText }}
            </div>
          </template>
        </OngoingTaskCard>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.insight-note:hover .insight-note__tip {
  display: block;
}
</style>

<!-- el-dialog 挂载在 body 下，scoped 样式够不到，这里做窄屏兜底。 -->
<style lang="scss">
.beauty-task-dialog {
  max-width: calc(100vw - 32px);
}
</style>
