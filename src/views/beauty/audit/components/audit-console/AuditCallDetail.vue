<script setup lang="ts">
/**
 * 一次工具调用的细节（原型 `AuditConsole.tsx` 的 `CallDetail`）。
 *
 * 成功时给出结论、指标、明细表、口径与数据来源；失败时给出三类异常与权限码。
 */
import { useBeautyI18n } from '@/beauty/composables'
import AuditChip from './AuditChip.vue'
import { ERROR_CLASS, ERROR_LABEL, type TrailStep } from './consoleModel'

defineOptions({ name: 'BeautyAuditCallDetail' })

const props = defineProps<{ step: TrailStep }>()

const { t } = useBeautyI18n()
</script>

<template>
  <div class="audit-detail">
    <template v-if="props.step.error">
      <div class="audit-error" :class="ERROR_CLASS[props.step.error.kind]">
        <strong>{{ t(ERROR_LABEL[props.step.error.kind]) }} · {{ props.step.error.code }}</strong>
        <span>{{ props.step.error.userMessage }}</span>
        <span class="audit-meta">
          {{ props.step.error.retryable ? t('可重试') : t('不可重试') }} ·
          {{ props.step.error.needUserInput ? t('需要补充信息') : t('无需补充信息') }}
        </span>
      </div>
      <div class="audit-tech">
        <span>{{ t('权限码') }} {{ props.step.spec.permission }}</span>
        <span>{{ t('模型可见') }} {{ props.step.error.modelMessage }}</span>
      </div>
    </template>
    <template v-else-if="props.step.output">
      <p class="audit-headline" style="margin: 0">{{ props.step.output.headline }}</p>
      <div v-if="props.step.output.facts.length" class="audit-facts">
        <div
          v-for="fact in props.step.output.facts"
          :key="fact.label"
          class="audit-fact"
          :title="fact.hint"
        >
          <span>{{ fact.label }}</span>
          <strong>{{ fact.value }}</strong>
        </div>
      </div>
      <div v-if="props.step.output.table" style="overflow-x: auto">
        <table class="audit-table">
          <thead>
            <tr>
              <th v-for="column in props.step.output.table.columns" :key="column">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in props.step.output.table.rows" :key="rowIndex">
              <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="audit-section-title">{{ t('口径说明') }}</div>
      <div class="audit-notes">
        <div v-for="note in props.step.output.notes" :key="note" class="audit-notes__row">
          <span></span>
          <span>{{ note }}</span>
        </div>
      </div>
      <div class="audit-section-title">{{ t('数据来源') }}</div>
      <div class="audit-sources">
        <AuditChip v-for="source in props.step.output.sources" :key="source">{{
          source
        }}</AuditChip>
      </div>
      <div class="audit-tech">
        <span class="audit-mono">{{ props.step.spec.name }}</span>
        <span>{{ props.step.spec.owner === 'adm' ? 'ADM' : 'Supervisor' }}</span>
        <span>{{ t('权限码') }} {{ props.step.spec.permission }}</span>
        <span v-for="param in props.step.spec.params" :key="`${param.label}-${param.value}`">
          {{ param.label }}={{ param.value }}
        </span>
        <span class="audit-mono">{{ props.step.output.traceId }}</span>
        <span>{{ props.step.output.scanned }}</span>
        <span>{{ props.step.output.ms }}ms</span>
      </div>
    </template>
  </div>
</template>
