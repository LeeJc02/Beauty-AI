<script setup lang="ts">
/**
 * 对话预览弹窗（原型 components/ConversationPlaygroundDialog.tsx）。
 * 左侧是模拟聊天记录，右侧由调用方通过 `right-pane` 插槽提供上下文信息。
 */
import type { PlaygroundMessage } from './types'

defineOptions({ name: 'BeautyConversationPlaygroundDialog' })

const props = defineProps<{
  modelValue: boolean
  title: string
  subtitle?: string
  seedKey: string
  initialMessages: PlaygroundMessage[]
  generateReply: (input: string, history: PlaygroundMessage[]) => string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const messages = ref<PlaygroundMessage[]>([])
const input = ref('')
const typing = ref(false)
let replyTimer: ReturnType<typeof setTimeout> | null = null

const clearReplyTimer = () => {
  if (replyTimer) {
    clearTimeout(replyTimer)
    replyTimer = null
  }
}

const resetConversation = () => {
  clearReplyTimer()
  messages.value = [...props.initialMessages]
  input.value = ''
  typing.value = false
}

const sendMessage = () => {
  const text = input.value.trim()
  if (!text) return

  const userMessage: PlaygroundMessage = {
    id: `${Date.now()}-user`,
    role: 'user',
    text
  }
  const reply = props.generateReply(text, [...messages.value, userMessage])

  clearReplyTimer()
  messages.value = [...messages.value, userMessage]
  input.value = ''
  typing.value = true

  replyTimer = setTimeout(() => {
    messages.value = [
      ...messages.value,
      { id: `${Date.now()}-assistant`, role: 'assistant', text: reply }
    ]
    typing.value = false
    replyTimer = null
  }, 650)
}

watch(
  () => [props.modelValue, props.seedKey] as const,
  ([open]) => {
    if (open) {
      resetConversation()
    } else {
      clearReplyTimer()
    }
  }
)

onBeforeUnmount(() => clearReplyTimer())
</script>

<template>
  <el-dialog
    v-model="visible"
    class="beauty-playground-dialog"
    width="1120px"
    top="6vh"
    append-to-body
  >
    <template #header>
      <div class="flex items-center justify-between pr-8">
        <div>
          <div class="text-lg font-bold text-[#242124]">{{ title }}</div>
          <p v-if="subtitle" class="mt-1 text-xs text-[#766F73]">{{ subtitle }}</p>
        </div>
        <div
          class="inline-flex items-center gap-1.5 rounded-full border border-[#E5DED8] bg-[#F8F5F3] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A9396]"
        >
          <Icon icon="lucide:message-square" :size="14" />
          预览
        </div>
      </div>
    </template>

    <div
      class="grid h-[76vh] min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]"
    >
      <div class="flex min-h-0 flex-col border-r border-[#E5DED8] bg-[#FDFBFA]">
        <div class="flex items-center justify-between border-b border-[#E5DED8] bg-white px-6 py-3">
          <div class="text-xs font-bold uppercase tracking-wider text-[#9A9396]">聊天记录</div>
          <el-button
            size="small"
            class="!border-[#E5DED8] !bg-white !text-[#3F3A3D]"
            @click="resetConversation"
          >
            <Icon icon="lucide:rotate-ccw" :size="16" class="mr-1" />重置对话
          </el-button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div class="space-y-4">
            <div
              v-for="message in messages"
              :key="message.id"
              class="flex"
              :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="flex max-w-[85%] items-end gap-3"
                :class="message.role === 'user' ? 'flex-row-reverse' : ''"
              >
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  :class="
                    message.role === 'user'
                      ? 'bg-rose-600 text-white'
                      : 'border border-[#E5DED8] bg-white text-rose-600'
                  "
                >
                  <Icon :icon="message.role === 'user' ? 'lucide:user' : 'lucide:bot'" :size="16" />
                </div>
                <div
                  class="rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
                  :class="
                    message.role === 'user'
                      ? 'rounded-br-md bg-rose-600 text-white'
                      : 'rounded-bl-md border border-[#E5DED8] bg-white text-[#242124]'
                  "
                >
                  <p data-i18n-skip="true" class="whitespace-pre-wrap">{{ message.text }}</p>
                </div>
              </div>
            </div>

            <div v-if="typing" class="flex justify-start">
              <div class="flex items-end gap-3">
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5DED8] bg-white text-rose-600"
                >
                  <Icon icon="lucide:bot" :size="16" />
                </div>
                <div
                  class="rounded-2xl rounded-bl-md border border-[#E5DED8] bg-white px-4 py-3 shadow-sm"
                >
                  <div class="flex items-center gap-1.5">
                    <span
                      class="h-2 w-2 rounded-full bg-[#C9C1C4] animate-bounce [animation-delay:-0.2s]"
                    ></span>
                    <span
                      class="h-2 w-2 rounded-full bg-[#C9C1C4] animate-bounce [animation-delay:-0.1s]"
                    ></span>
                    <span class="h-2 w-2 rounded-full bg-[#C9C1C4] animate-bounce"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t border-[#E5DED8] bg-white p-4">
          <div class="flex items-end gap-3">
            <textarea
              v-model="input"
              placeholder="输入消息..."
              class="min-h-[56px] flex-1 resize-none rounded-lg border border-[#E5DED8] bg-white px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-[#9A9396] focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
              @keydown.enter.exact.prevent="sendMessage"
            ></textarea>
            <button
              type="button"
              class="flex h-10 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-sm font-bold text-white transition-colors hover:bg-rose-700"
              @click="sendMessage"
            >
              <Icon icon="lucide:send" :size="16" />
              <span>发送</span>
            </button>
          </div>
        </div>
      </div>

      <div class="min-h-0 overflow-y-auto bg-[#F8F5F3] px-5 py-5">
        <slot name="right-pane"></slot>
      </div>
    </div>
  </el-dialog>
</template>

<style lang="scss" scoped>
:global(.beauty-playground-dialog .el-dialog__header) {
  margin: 0;
  padding: 16px 24px;
  border-bottom: 1px solid #e5ded8;
  background: #fff;
}

:global(.beauty-playground-dialog .el-dialog__body) {
  padding: 0;
}

:global(.beauty-playground-dialog .el-dialog__footer) {
  padding: 0;
}
</style>
