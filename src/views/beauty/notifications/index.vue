<script setup lang="ts">
/**
 * 通知设置（原型 `src/pages/NotificationSettings.tsx`，仅超级管理员可见）。
 *
 * 三个消息通道：Lumina App Push / WhatsApp Business / 飞书(Lark)。
 * 「开启/关闭」切换通道启用态，启用时才展开 API 接入配置与支持的消息类型。
 *
 * 与原型一致的取舍：原型把 WhatsApp 卡片（带研发备注气泡）与普通卡片写成了两套 JSX，
 * 这里合并成一份模板 + 条件气泡，DOM 结构与类名保持原样。
 */
import { useBeautyI18n } from '@/beauty/composables'

defineOptions({ name: 'BeautyNotifications' })

interface NotificationChannel {
  id: 'app' | 'whatsapp' | 'feishu'
  name: string
  /** lucide 图标名（原型用 lucide-react 组件，这里转成 kebab-case 图标名） */
  icon: string
  enabled: boolean
  /** 是否已接入 API（展示「已接入API」徽标） */
  connected: boolean
  desc: string
}

/** 研发备注气泡只在 WhatsApp 通道上展示（原型注释：其他渠道沟通配置一期不做）。 */
const DEV_NOTE_CHANNEL_ID = 'whatsapp'

const { t } = useBeautyI18n()

const channels = ref<NotificationChannel[]>([
  {
    id: 'app',
    name: 'Lumina App Push',
    icon: 'lucide:smartphone',
    enabled: true,
    connected: true,
    desc: '原生应用内部推送弹窗与消息盒子'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    icon: 'lucide:message-square',
    enabled: true,
    connected: true,
    desc: '东南亚区域BA常用社交渠道'
  },
  {
    id: 'feishu',
    name: '飞书 (Lark)',
    icon: 'lucide:megaphone',
    enabled: false,
    connected: false,
    desc: '企业内部工作协同通讯工具'
  }
])

/** 等价原型 toggleChannel：只翻转目标通道的 enabled。 */
const toggleChannel = (id: NotificationChannel['id']) => {
  channels.value = channels.value.map((channel) =>
    channel.id === id ? { ...channel, enabled: !channel.enabled } : channel
  )
}

/** 原型里写死的通道配置（API Key 只展示掩码，不可编辑）。 */
const API_KEY_MASK = '*************************'
const WEBHOOK_URL = 'https://api.lumina.global/webhook/notify'

const MESSAGE_TYPES = ['账号初始激活通知', '新学习任务 / 考试指派', '任务催办预警 (Deadline-24h)']
</script>

<template>
  <div class="flex h-[calc(100vh-11.5rem)] min-h-[560px] flex-1 flex-col overflow-y-auto pt-2">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-[#1F1C1F]">全局通知渠道配置</h2>
        <p class="mt-1 text-sm text-[#766F73]">
          配置并管理平台发送培训任务、考试提醒及账号激活的各个消息通道
        </p>
      </div>
    </div>

    <div class="max-w-4xl space-y-6">
      <div
        v-for="channel in channels"
        :key="channel.id"
        class="notification-channel relative"
      >
        <span
          v-if="channel.id === DEV_NOTE_CHANNEL_ID"
          class="absolute -top-2 -right-1 z-10 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-center text-[9px] leading-4 font-bold text-white shadow-sm backdrop-blur-sm"
        >
          注
        </span>

        <div
          class="rounded-2xl border shadow-sm transition-colors"
          :class="
            channel.enabled
              ? 'border-rose-200 bg-white'
              : 'border-[#E9E4DF] bg-[#F8F5F3] opacity-80'
          "
        >
          <div class="p-6">
            <div class="flex items-start justify-between">
              <div class="flex items-center space-x-4">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-xl shadow-sm"
                  :class="
                    channel.enabled ? 'bg-rose-50 text-rose-600' : 'bg-slate-200 text-[#766F73]'
                  "
                >
                  <Icon :icon="channel.icon" :size="24" />
                </div>
                <div>
                  <h3 class="flex items-center text-lg font-bold text-[#1F1C1F]">
                    {{ channel.name }}
                    <span
                      v-if="channel.connected"
                      class="ml-2 inline-flex h-5 w-fit shrink-0 items-center rounded-full border border-emerald-200 bg-[#EEF8F4] px-1.5 py-0 text-[10px] font-medium whitespace-nowrap text-[#3B8F72]"
                    >
                      <Icon icon="lucide:check-circle-2" :size="12" class="mr-1" /> 已接入API
                    </span>
                  </h3>
                  <p class="mt-1 text-sm text-[#766F73]">{{ channel.desc }}</p>
                </div>
              </div>
              <div class="flex flex-col items-end space-y-2">
                <div class="flex items-center space-x-2">
                  <span class="text-sm font-semibold text-[#5D565A]">
                    {{ channel.enabled ? '已启用' : '已停用' }}
                  </span>
                  <el-button
                    size="small"
                    class="!h-6 !rounded-lg !px-2 !text-xs"
                    :class="
                      channel.enabled
                        ? '!border-rose-600 !bg-rose-600 !text-white hover:!border-rose-700 hover:!bg-rose-700'
                        : '!text-[#766F73]'
                    "
                    @click="toggleChannel(channel.id)"
                  >
                    开启/关闭
                  </el-button>
                </div>
              </div>
            </div>

            <div
              v-if="channel.enabled"
              class="mt-6 grid grid-cols-2 gap-6 border-t border-[#E9E4DF] pt-6"
            >
              <div class="space-y-4">
                <h4 class="text-sm font-bold text-[#242124]">API 接入配置</h4>
                <div class="space-y-3">
                  <div>
                    <label class="text-xs font-semibold text-[#766F73]">API Key / Token</label>
                    <input
                      type="password"
                      :value="API_KEY_MASK"
                      readonly
                      class="mt-1 h-8 w-full rounded-lg border border-[#E5DED8] bg-[#F8F5F3] px-2.5 font-mono text-xs text-[#3F3A3D] outline-none"
                    />
                  </div>
                  <div>
                    <label class="text-xs font-semibold text-[#766F73]">Webhook URL</label>
                    <input
                      :value="WEBHOOK_URL"
                      readonly
                      class="mt-1 h-8 w-full rounded-lg border border-[#E5DED8] bg-[#F8F5F3] px-2.5 font-mono text-xs text-[#3F3A3D] outline-none"
                    />
                  </div>
                </div>
                <el-button size="small" class="!h-8">修改配置</el-button>
              </div>

              <div class="space-y-4">
                <h4 class="text-sm font-bold text-[#242124]">支持的消息类型</h4>
                <div class="space-y-2">
                  <div v-for="type in MESSAGE_TYPES" :key="type" class="flex items-center space-x-2">
                    <div
                      class="flex h-4 w-4 items-center justify-center rounded-sm bg-rose-500 text-white"
                    >
                      <Icon icon="lucide:check-circle-2" :size="12" />
                    </div>
                    <span class="text-sm text-[#5D565A]">{{ type }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="channel.id === DEV_NOTE_CHANNEL_ID"
          class="notification-channel__tip absolute right-0 bottom-full z-[80] mb-2 w-72 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm"
        >
          {{ t('研发备注：其他渠道沟通配置，一期不做，二期不做。') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 原型用 group-hover/dev-note:block 控制研发备注气泡，unocss 0.58 的命名分组变体不可靠，改用 scoped css。 */
.notification-channel__tip {
  display: none;
}

.notification-channel:hover .notification-channel__tip,
.notification-channel:focus-within .notification-channel__tip {
  display: block;
}
</style>
