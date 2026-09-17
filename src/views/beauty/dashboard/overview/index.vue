<script setup lang="ts">
import { useBeautyI18n } from '@/beauty/composables'
// 仅为 unocss 提供 @/beauty/lib/visualTones 等 .ts 工具函数的动态类名（见该文件注释）。
import '@/views/beauty/dashboard/components/toneSafelist'
import AppDownloadButton from '../components/AppDownloadButton.vue'

/**
 * 超管「运行概览」：对应原型 `pages/SADashboard.tsx`。
 *
 * 原型这一页是纯静态演示数据（无 @/beauty/lib 业务数据源），这里保持逐字搬迁：
 * 4 张指标卡 + 近期系统动态列表 + 服务节点状态进度条。
 */
defineOptions({ name: 'BeautyDashboardOverview' })

const { t } = useBeautyI18n()

/** 近期系统动态：图标、图标配色、标题、描述、时间。 */
const SYSTEM_ACTIVITIES = [
  {
    icon: 'lucide:activity',
    iconClass: 'bg-[#F7E6C8] text-[#B9822B]',
    title: 'API Gateway 429 频率限制',
    description: '节点 `ais-prod-api-v2-5f6` 触发外部 LLM API 并发速率限制，已自动切换至指数避退重试策略。',
    time: '2 分钟前'
  },
  {
    icon: 'lucide:database',
    iconClass: 'bg-[#DCEFE7] text-[#3B8F72]',
    title: 'PostgreSQL Vacuum 分析完成',
    description: '每日守护进程 `pg_vacuum` 运行结束，耗时 45.2s，共计释放 1.2GB 碎片化存储空间。',
    time: '45 分钟前'
  },
  {
    icon: 'lucide:cpu',
    iconClass: 'bg-rose-100 text-rose-600',
    title: 'Pod 内存溢出 (OOM) 自动重启',
    description: '多媒体转码 Worker 服务内存超限 ( >2Gi)，Kubernetes 控制平面已杀死并重新调度该容器态。',
    time: '2 小时前'
  },
  {
    icon: 'lucide:shield-check',
    iconClass: 'bg-blue-100 text-blue-600',
    title: '内网 TLS 证书热重载',
    description: 'VPC 内服务间通信的 TLS 证书已通过 Cert-Manager 成功轮换，当前主连接零宕机。',
    time: '昨天 14:30'
  }
]

/** 服务节点状态：图标、名称、占用百分比、进度条配色、百分比配色、预警文案。 */
const SERVICE_NODES = [
  {
    icon: 'lucide:cpu',
    label: 'AI 推理集群 (GPU)',
    percent: 68,
    widthClass: 'w-[68%]',
    barClass: 'bg-rose-500',
    valueClass: 'text-[#5D565A]',
    warning: ''
  },
  {
    icon: 'lucide:database',
    label: '主数据库 (PostgreSQL)',
    percent: 42,
    widthClass: 'w-[42%]',
    barClass: 'bg-[#3B8F72]',
    valueClass: 'text-[#5D565A]',
    warning: ''
  },
  {
    icon: 'lucide:hard-drive',
    label: '媒体存储 (OSS/S3)',
    percent: 84,
    widthClass: 'w-[84%]',
    barClass: 'bg-rose-500',
    valueClass: 'text-rose-600',
    warning: '存储阈值预警，建议进行扩容操作'
  },
  {
    icon: 'lucide:network',
    label: '前端 CDN 分发网络',
    percent: 31,
    widthClass: 'w-[31%]',
    barClass: 'bg-[#4F5FD5]',
    valueClass: 'text-[#5D565A]',
    warning: ''
  }
]
</script>

<template>
  <div class="flex flex-1 flex-col space-y-6 pt-2">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-wider text-[#9A9396]">Dashboard</p>
        <h2 class="text-xl font-bold text-[#242124]">{{ t('系统运行概览') }}</h2>
      </div>
      <AppDownloadButton />
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="p-5 pb-0">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#9A9396]">今日系统日活 (DAU)</div>
        </div>
        <div class="p-5 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold">12,450</span>
            <span class="mb-1 text-xs font-semibold text-green-500">↑ 12%</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="p-5 pb-0">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#9A9396]">月活用户 (MAU)</div>
        </div>
        <div class="p-5 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold">45,820</span>
            <span class="mb-1 text-xs font-semibold text-green-500">↑ 5%</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="p-5 pb-0">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#9A9396]">系统内容量</div>
        </div>
        <div class="p-5 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold">3,892</span>
            <span class="mb-1 text-xs text-[#9A9396]">个课件</span>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="p-5 pb-0">
          <div class="text-xs font-semibold uppercase tracking-widest text-[#9A9396]">累计练习量</div>
        </div>
        <div class="p-5 pt-2">
          <div class="flex items-end justify-between leading-none">
            <span class="text-3xl font-bold">4.2M</span>
            <span class="mb-1 text-xs text-[#9A9396]">次演练</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid h-full flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="flex h-[400px] flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="border-b border-[#E9E4DF] bg-[#F8F5F3] p-5">
          <div class="flex items-center text-base font-bold">
            <Icon icon="lucide:activity" :size="16" class="mr-2 text-[#766F73]" /> 近期系统动态
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-0">
          <div class="divide-y divide-slate-50">
            <div
              v-for="activity in SYSTEM_ACTIVITIES"
              :key="activity.title"
              class="flex items-start space-x-3 p-4 hover:bg-[#F8F5F3]"
            >
              <div class="mt-0.5 rounded-lg p-2" :class="activity.iconClass">
                <Icon :icon="activity.icon" :size="16" />
              </div>
              <div>
                <p class="text-sm font-semibold text-[#1F1C1F]">{{ activity.title }}</p>
                <p class="mt-0.5 text-xs text-[#766F73]">{{ activity.description }}</p>
                <p class="mt-1 text-[10px] text-[#9A9396]">{{ activity.time }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex h-[400px] flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] shadow-sm">
        <div class="border-b border-[#E9E4DF] bg-[#F8F5F3] p-5">
          <div class="flex items-center text-base font-bold">
            <Icon icon="lucide:server" :size="16" class="mr-2 text-[#766F73]" /> 服务节点状态
          </div>
        </div>
        <div class="flex-1 p-5">
          <div class="space-y-6">
            <div v-for="node in SERVICE_NODES" :key="node.label">
              <div class="mb-2 flex items-center justify-between">
                <div class="flex items-center text-sm font-medium text-[#3F3A3D]">
                  <Icon :icon="node.icon" :size="16" class="mr-2 text-[#9A9396]" /> {{ node.label }}
                </div>
                <span class="text-xs font-semibold" :class="node.valueClass">{{ node.percent }}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div class="h-full" :class="[node.widthClass, node.barClass]" ></div>
              </div>
              <p v-if="node.warning" class="mt-1 text-[10px] text-rose-500">{{ node.warning }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
