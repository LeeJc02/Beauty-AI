<script lang="ts" setup>
import { useI18n } from '@/hooks/web/useI18n'

defineOptions({ name: 'AvatarPreviewDialog' })

const props = defineProps<{
  modelValue: boolean
  title?: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const { t } = useI18n()

const messages = ref([
  { role: 'user', text: '你好，我想了解一下你们的产品' },
  { role: 'avatar', text: '您好！很高兴为您介绍我们的产品。我们专注于护肤与美容领域，请问您具体想了解哪方面的产品呢？' },
  { role: 'user', text: '护肤方面有什么推荐吗？' },
  { role: 'avatar', text: '我们有很多优质的护肤产品。根据您的肤质和需求，我可以为您推荐最适合您的产品组合。' },
])

const newMessage = ref('')

const sendMessage = () => {
  if (!newMessage.value.trim()) return
  messages.value.push({ role: 'user', text: newMessage.value })
  messages.value.push({
    role: 'avatar',
    text: '这是一个模拟的回复。实际使用时将使用数字人设定进行真实对话。'
  })
  newMessage.value = ''
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="props.title || t('contentPreview.dialoguePreview')"
    width="600px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="playground-chat">
      <div class="chat-messages">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="chat-bubble"
          :class="msg.role"
        >
          <div class="bubble-avatar">
            {{ msg.role === 'avatar' ? 'AI' : '👤' }}
          </div>
          <div class="bubble-text">{{ msg.text }}</div>
        </div>
      </div>
      <div class="chat-input-row">
        <el-input
          v-model="newMessage"
          placeholder="输入对话内容..."
          @keyup.enter="sendMessage"
        />
        <el-button type="primary" @click="sendMessage">发送</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style lang="scss" scoped>
.playground-chat {
  display: flex;
  flex-direction: column;
  height: 400px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f8f5f3;
  border-radius: 12px;
}

.chat-bubble {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.chat-bubble.user {
  flex-direction: row-reverse;

  .bubble-text {
    background: var(--beauty-brand);
    color: #fff;
  }
}

.bubble-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f3c9bc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.chat-bubble.user .bubble-avatar {
  background: #eee;
}

.bubble-text {
  padding: 10px 14px;
  background: #fff;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  max-width: 75%;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
}

.chat-input-row {
  display: flex;
  gap: 8px;
  padding: 12px 0 0;
}
</style>
