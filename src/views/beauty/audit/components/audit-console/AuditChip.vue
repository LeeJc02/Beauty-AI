<script setup lang="ts">
/**
 * 审计卡里的胶囊标签（原型 `AuditConsole.tsx` 的 `Chip` / `EventTag`）。
 *
 * 传 `event` 时渲染成事件标签（等宽字体 + 终端图标），对应原型的 `EventTag`。
 */
defineOptions({ name: 'BeautyAuditChip' })

const props = withDefaults(
  defineProps<{
    /** 语气类名，如 audit-chip--high；默认是中性灰。 */
    tone?: string
    title?: string
    /** 事件名（如 report_completed），传入即走 event 形态。 */
    event?: string
  }>(),
  { tone: '', title: '', event: '' }
)
</script>

<template>
  <span v-if="props.event" class="audit-chip audit-chip--event">
    <Icon icon="lucide:terminal" :size="9" />
    {{ props.event }}
  </span>
  <span v-else class="audit-chip" :class="props.tone" :title="props.title"><slot></slot></span>
</template>
