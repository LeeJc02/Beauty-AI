<script setup lang="ts">
/**
 * 补问卡（原型 `AuditConsole.tsx` 的 `ClarifyCard`）。
 *
 * 逐题确认口径：单选直接回答，品类多选后点「下一步」，不确定可以「先跳过」（按默认口径）。
 */
import { useBeautyI18n } from '@/beauty/composables'
import AuditChip from './AuditChip.vue'
import { CLARIFY_DEFAULT, type ClarifyItem } from './consoleModel'
import type { ClarifyField } from '@/beauty/lib/auditTools'

defineOptions({ name: 'BeautyAuditClarifyCard' })

const props = defineProps<{
  item: ClarifyItem
  /** 是否是当前正在问的那张卡（主组件用 pending 判断）。 */
  live: boolean
}>()

const emit = defineEmits<{
  (e: 'answer', index: number, value: string, label: string): void
  (e: 'pick', value: string): void
  (e: 'skip', index: number): void
}>()

const { t } = useBeautyI18n()

const multiOf = (index: number) => props.item.questions[index].field === 'category'

/** 「先跳过（按 本周）」：把默认口径写在按钮上，避免老板猜跳过会发生什么。 */
const defaultLabelOf = (field: ClarifyField) => t(CLARIFY_DEFAULT[field].label)
</script>

<template>
  <div class="audit-card audit-card--clarify">
    <div class="audit-card__head">
      <AuditChip tone="audit-chip--accent">
        <Icon icon="lucide:key-round" :size="9" />
        {{ t('需要你确认') }} · {{ Object.keys(props.item.answers).length }}/{{
          props.item.questions.length
        }}
      </AuditChip>
      <span class="audit-meta">
        {{ t('点选项就行，也可以在下方的输入框里直接打字；不确定的点「先跳过」') }}
      </span>
    </div>
    <div
      v-for="(question, index) in props.item.questions"
      :key="`${question.field}-${index}`"
      class="audit-ask"
      :class="{ 'is-active': props.live && index === props.item.index }"
    >
      <div class="audit-ask__head">
        <span class="audit-ask__no">{{ index + 1 }}</span>
        <span class="audit-ask__q">{{ question.question }}</span>
        <AuditChip v-if="props.item.answers[index]" tone="audit-chip--ok">
          <Icon icon="lucide:check" :size="9" /> {{ props.item.answers[index] }}
        </AuditChip>
      </div>
      <div v-if="props.live && index === props.item.index" class="audit-options">
        <button
          v-for="option in question.options"
          :key="option.value"
          type="button"
          class="audit-option"
          :class="{ selected: props.item.picks.includes(option.value) }"
          :title="option.hint"
          @click="
            multiOf(index)
              ? emit('pick', option.value)
              : emit('answer', index, option.value, option.label)
          "
        >
          <Icon v-if="props.item.picks.includes(option.value)" icon="lucide:check" :size="11" />
          {{ option.label }}
        </button>
        <button
          v-if="multiOf(index)"
          type="button"
          class="cw-primary audit-option--go"
          :disabled="!props.item.picks.length"
          @click="emit('answer', index, props.item.picks.join(','), props.item.picks.join('、'))"
        >
          {{ t('下一步') }}
        </button>
        <button type="button" class="audit-skip" @click="emit('skip', index)">
          {{ t('先跳过') }}（{{ t('按') }} {{ defaultLabelOf(question.field) }}）
        </button>
      </div>
    </div>
  </div>
</template>
