<script setup lang="ts">
/**
 * 「查询过程」卡（原型 `AuditConsole.tsx` 的 `TrailCard`：
 * 每步一条旁白，可展开看这次调用的明细）。
 */
import { computed, ref } from 'vue'
import { useBeautyI18n } from '@/beauty/composables'
import AuditCallDetail from './AuditCallDetail.vue'
import { shortHeadline, type TrailItem, type TrailStep } from './consoleModel'

defineOptions({ name: 'BeautyAuditTrailCard' })

const props = defineProps<{ item: TrailItem; live: boolean }>()

const { t } = useBeautyI18n()

/** 哪些步骤展开了明细（默认全收起，和原型一致）。 */
const open = ref<Record<string, boolean>>({})

const toggle = (id: string) => {
  open.value = { ...open.value, [id]: !open.value[id] }
}

const doneCount = computed(
  () => props.item.steps.filter((step) => step.status !== 'running').length
)

/** 旁白右侧的一句话结果；只留第一句，避免卡片被长句子撑开。 */
const resultText = (step: TrailStep) => {
  if (step.status === 'running') return t('查询中…')
  if (step.status === 'error') return t('权限被拒绝')
  return shortHeadline(step.output?.headline ?? '')
}

const canExpand = (step: TrailStep) => Boolean(step.output?.table || step.error)
</script>

<template>
  <div class="audit-trail" :class="{ 'is-live': props.live }">
    <div class="audit-trail__head">
      <span class="audit-trail__title">
        <Icon icon="lucide:list-checks" :size="12" /> {{ t('查询过程') }}
      </span>
      <span class="audit-meta"
        >{{ doneCount }}/{{ props.item.steps.length }} {{ t('步完成') }}</span
      >
    </div>
    <div
      v-for="step in props.item.steps"
      :key="step.id"
      class="audit-step"
      :class="`is-${step.status}`"
    >
      <div class="audit-step__row">
        <span class="audit-step__dot" :class="`is-${step.status}`">
          <Icon
            v-if="step.status === 'running'"
            icon="lucide:loader-2"
            :size="11"
            class="cw-spin"
          />
          <Icon v-else-if="step.status === 'error'" icon="lucide:alert-triangle" :size="11" />
          <Icon v-else icon="lucide:check" :size="11" />
        </span>
        <span class="audit-step__text">
          <span class="audit-step__narration">{{ step.narration }}</span>
          <span class="audit-step__meta">
            <span class="audit-step__tool audit-mono">{{ step.spec.name }}</span>
            <span class="audit-step__result">{{ resultText(step) }}</span>
          </span>
        </span>
        <button
          v-if="canExpand(step)"
          type="button"
          class="audit-step__more"
          @click="toggle(step.id)"
        >
          <Icon :icon="open[step.id] ? 'lucide:chevron-down' : 'lucide:chevron-right'" :size="11" />
          {{ open[step.id] ? t('收起') : t('看数据') }}
        </button>
      </div>
      <AuditCallDetail v-if="open[step.id]" :step="step" />
    </div>
  </div>
</template>
