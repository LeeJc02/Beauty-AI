<script setup lang="ts">
import { getProgressTone } from '@/beauty/lib/visualTones'
import { useBeautyI18n } from '@/beauty/composables'
// 仅为 unocss 提供 @/beauty/lib/visualTones 等 .ts 工具函数的动态类名（见该文件注释）。
import '@/views/beauty/dashboard/components/toneSafelist'
import BeautyBadge from '../components/BeautyBadge.vue'
import BeautyProgress from '../components/BeautyProgress.vue'

/**
 * 区域培训师（Regional Trainer）看板：对应原型 `pages/RTDashboard.tsx`。
 *
 * 原型这一页没有公司级页头，直接从 KPI 卡开始；表格是手写 `<table>`（含进度条与徽标），
 * 按原型要求没有替换成 el-table。
 */
defineOptions({ name: 'BeautyRegionalTrainerView' })

const { t } = useBeautyI18n()

/** 「已分发给您的 BA」剧本卡。 */
const REGION_SCRIPTS = [
  {
    title: '斋月大促客流高峰话术',
    description: '为即将来临的斋月准备，重点演练快速接待多位顾客、推荐斋月礼盒套餐的特殊话术。',
    practicedCount: 123
  },
  {
    title: '太平洋广场-竞品阻击专项',
    description: "针对 Pacific Place 商圈对门开店的 'Brand X'，演练我方产品的长效保湿优势应对。",
    practicedCount: 45
  }
]

/** 区域高频错题（原型两条内联卡片）。 */
const REGION_TOP_MISTAKES = [
  {
    question: "Q4: 客户提到竞品 'Brand A' 的光甘草定精华时，最佳应对策略是？",
    module: '知识模块：2026早春抗老新品速递卡',
    rate: '68%',
    cardClass: 'border-rose-100 bg-rose-50/30',
    labelClass: 'text-rose-400',
    rateClass: 'text-rose-600'
  },
  {
    question: 'Q12: 当检测出受试者眼周存在假性干纹时，以下哪种连带销售手法最合理？',
    module: '知识模块：进阶连带销售话术',
    rate: '45%',
    cardClass: 'border-[#F2DEC0] bg-[#FFF7EA]/30',
    labelClass: 'text-[#B9822B]',
    rateClass: 'text-[#B9822B]'
  }
]
</script>

<template>
  <div class="flex flex-1 flex-col space-y-6 pt-2">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="flex flex-row items-center justify-between p-5 pb-0">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#9A9396]">管辖门店数</div>
          <Icon icon="lucide:map-pin" :size="16" class="text-[#C9C1C4]" />
        </div>
        <div class="p-5 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">18<span class="ml-1 text-sm font-medium text-[#766F73]">家</span></span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="flex flex-row items-center justify-between p-5 pb-0">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#9A9396]">总管辖 BA 人数</div>
          <Icon icon="lucide:users" :size="16" class="text-[#C9C1C4]" />
        </div>
        <div class="p-5 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">142<span class="ml-1 text-sm font-medium text-[#766F73]">人</span></span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="flex flex-row items-center justify-between p-5 pb-0">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#9A9396]">本周任务完课率</div>
          <Icon icon="lucide:book-open" :size="16" class="text-[#C9C1C4]" />
        </div>
        <div class="p-5 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-rose-600">88%</span>
            <span class="mb-1 text-xs font-semibold text-rose-500">进度良好</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="flex flex-row items-center justify-between p-5 pb-0">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#9A9396]">系统自动催办提醒</div>
          <Icon icon="lucide:bell-ring" :size="16" class="text-[#B9822B]" />
        </div>
        <div class="p-5 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold text-[#242124]">27<span class="ml-1 text-sm font-medium text-[#766F73]">次</span></span>
            <span class="mb-1 rounded-full bg-[#DCEFE7] px-2 py-0.5 text-[10px] font-bold text-[#2F735C]">今日已全自动发送</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid h-full flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
          <div class="flex flex-row items-center justify-between border-b border-[#E9E4DF] bg-[#F8F5F3] p-5">
            <div class="flex items-center text-base font-bold">
              <Icon icon="lucide:users" :size="16" class="mr-2 text-rose-500" /> {{ t('BA 本周学习进度与档案') }}
            </div>
            <BeautyBadge class="border-[#E5DED8] bg-white font-normal text-[#5D565A]">支持录音回读与分值调出</BeautyBadge>
          </div>
          <div class="overflow-y-auto p-0">
            <table class="w-full text-sm">
              <thead class="hidden border-b border-[#E9E4DF] bg-[#F8F5F3] text-left text-xs uppercase tracking-wider text-[#766F73] sm:table-header-group">
                <tr>
                  <th class="px-5 py-3 font-medium">姓名 / 门店</th>
                  <th class="w-1/4 px-2 py-3 font-medium">课程任务进度</th>
                  <th class="px-3 py-3 text-center font-medium">AI 陪练得分</th>
                  <th class="px-3 py-3 text-center font-medium">最新考分</th>
                  <th class="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr>
                  <td class="px-5 py-4">
                    <p class="font-semibold text-[#1F1C1F]">Arief</p>
                    <p class="text-[10px] text-[#9A9396]">Toko Senayan</p>
                  </td>
                  <td class="px-2 py-4">
                    <div class="flex flex-col space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] text-[#9A9396]">昨日已学</span>
                        <span class="text-[10px] font-bold" :class="getProgressTone(100).textClass">完毕</span>
                      </div>
                      <BeautyProgress
                        :value="100"
                        class="h-1.5 w-full bg-slate-100"
                        :indicator-class="getProgressTone(100).indicatorClass"
                      />
                    </div>
                  </td>
                  <td class="px-3 py-4 text-center">
                    <BeautyBadge class="border-emerald-100 bg-[#EEF8F4] text-[#3B8F72]">92 分</BeautyBadge>
                  </td>
                  <td class="px-3 py-4 text-center font-bold text-[#3F3A3D]">98</td>
                  <td class="px-5 py-4 text-right">
                    <button
                      type="button"
                      class="flex w-full items-center justify-end text-xs font-semibold text-rose-600 transition-colors hover:text-rose-800"
                    >
                      <Icon icon="lucide:circle-play" :size="14" class="mr-1" /> 调取录音
                    </button>
                  </td>
                </tr>
                <tr>
                  <td class="px-5 py-4">
                    <p class="font-semibold text-[#1F1C1F]">Dian</p>
                    <p class="text-[10px] text-[#9A9396]">Toko Pacific</p>
                  </td>
                  <td class="px-2 py-4">
                    <div class="flex flex-col space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] text-[#9A9396]">今日 09:12 学过</span>
                        <span class="text-[10px] font-bold" :class="getProgressTone(80).textClass">80%</span>
                      </div>
                      <BeautyProgress
                        :value="80"
                        class="h-1.5 w-full bg-slate-100"
                        :indicator-class="getProgressTone(80).indicatorClass"
                      />
                    </div>
                  </td>
                  <td class="px-3 py-4 text-center">
                    <BeautyBadge class="border-rose-100 bg-rose-50 text-rose-600">85 分</BeautyBadge>
                  </td>
                  <td class="px-3 py-4 text-center font-bold text-[#3F3A3D]">82</td>
                  <td class="px-5 py-4 text-right">
                    <button
                      type="button"
                      class="flex w-full items-center justify-end text-xs font-semibold text-rose-600 transition-colors hover:text-rose-800"
                    >
                      <Icon icon="lucide:circle-play" :size="14" class="mr-1" /> 调取录音
                    </button>
                  </td>
                </tr>
                <tr class="bg-[#FFF7EA]/20">
                  <td class="px-5 py-4">
                    <p class="font-semibold text-[#4C3415]">Rina</p>
                    <p class="text-[10px] text-[#B9822B]">Toko Kelapa Gading</p>
                  </td>
                  <td class="px-2 py-4">
                    <div class="flex flex-col space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-medium text-[#B9822B]">3天未登录</span>
                        <span class="text-[10px] font-bold" :class="getProgressTone(20).textClass">20%</span>
                      </div>
                      <BeautyProgress
                        :value="20"
                        class="h-1.5 w-full bg-slate-100"
                        :indicator-class="getProgressTone(20).indicatorClass"
                      />
                    </div>
                  </td>
                  <td class="px-3 py-4 text-center">
                    <BeautyBadge class="border-none bg-[#F7E6C8] font-bold text-[#8B621F]">58 分</BeautyBadge>
                  </td>
                  <td class="px-3 py-4 text-center font-bold text-rose-600">45</td>
                  <td class="flex flex-col items-end space-y-2 px-5 py-4 pb-2 text-right">
                    <button
                      type="button"
                      class="flex items-center text-xs font-semibold text-rose-600 transition-colors hover:text-rose-800"
                    >
                      查看错题
                    </button>
                    <button
                      type="button"
                      class="flex items-center text-[10px] font-semibold text-rose-600 opacity-70 transition-colors hover:text-rose-800"
                    >
                      <Icon icon="lucide:circle-play" :size="12" class="mr-1" /> 听取陪练
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
          <div class="flex flex-row items-center justify-between border-b border-[#E9E4DF] bg-[#F8F5F3] p-5">
            <div class="flex items-center text-base font-bold">
              <Icon icon="lucide:triangle-alert" :size="16" class="mr-2 text-rose-500" /> {{ t('区域高频考试错题分析') }}
            </div>
            <BeautyBadge class="border-[#E5DED8] bg-white font-normal text-[#5D565A]">一键发送群讲解</BeautyBadge>
          </div>
          <div class="p-5">
            <div class="space-y-4">
              <div
                v-for="mistake in REGION_TOP_MISTAKES"
                :key="mistake.question"
                class="flex items-start justify-between rounded-xl border p-4"
                :class="mistake.cardClass"
              >
                <div class="pr-4">
                  <p class="mb-1 text-sm font-bold text-[#242124]">{{ mistake.question }}</p>
                  <p class="text-xs text-[#766F73]">{{ mistake.module }}</p>
                </div>
                <div class="shrink-0 text-center">
                  <p class="mb-1 text-xs font-semibold" :class="mistake.labelClass">区域内错误率</p>
                  <p class="text-2xl font-bold" :class="mistake.rateClass">{{ mistake.rate }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
          <div class="flex flex-col border-b border-rose-50/50 bg-rose-50/50 p-5">
            <div class="mb-2 flex items-center text-base font-bold text-rose-950">
              <Icon icon="lucide:file-text" :size="16" class="mr-2 text-rose-500" /> {{ t('特色区域陪练剧本库') }}
            </div>
            <div class="text-xs text-rose-600/70">
              可基于本地特性（如商圈特定竞品、当地节假日习俗）下发布区域专属AI陪练内容。
            </div>
          </div>
          <div class="flex flex-1 flex-col space-y-4 p-5">
            <button
              type="button"
              class="group flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-rose-200 py-4 text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50"
            >
              <div class="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 transition-transform group-hover:scale-110">
                <Icon icon="lucide:plus" :size="16" />
              </div>
              <span class="text-sm font-bold">创建区域专属剧本</span>
            </button>

            <div class="mt-4 space-y-3">
              <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-[#9A9396]">已分发给您的 BA</p>

              <div
                v-for="script in REGION_SCRIPTS"
                :key="script.title"
                class="group cursor-pointer rounded-xl border border-[#E9E4DF] bg-white p-3 transition-all hover:border-rose-100 hover:shadow-sm"
              >
                <div class="mb-2 flex items-start justify-between">
                  <span class="text-sm font-bold text-[#242124]">{{ script.title }}</span>
                  <BeautyBadge class="border-none bg-rose-50 text-[10px] font-bold text-rose-600">生效中</BeautyBadge>
                </div>
                <p class="mb-3 line-clamp-2 text-[10px] leading-relaxed text-[#766F73]">{{ script.description }}</p>
                <div class="flex items-center justify-between border-t border-slate-50 pt-2 text-[10px] text-[#9A9396]">
                  <span>{{ script.practicedCount }}人 已练</span>
                  <span class="flex items-center font-semibold hover:text-rose-600">
                    <Icon icon="lucide:message-square" :size="12" class="mr-1" /> 编辑
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
