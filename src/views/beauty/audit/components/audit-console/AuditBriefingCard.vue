<script setup lang="ts">
/**
 * 汇报卡（原型 `AuditConsole.tsx` 的 `BriefingCard`）。
 *
 * 结论 → 关键指标 → 两张手写图表 → 问题清单（可跳任务）→ 建议 → 数据 / 技术明细 → 保存动作。
 * 所有「保存 / 定时 / 导出」都通过事件交给页面容器，卡片自己不写状态。
 */
import { useBeautyI18n } from '@/beauty/composables'
import { LEVEL_LABELS } from '@/beauty/lib/inspectionEngine'
import type { AuditReport, AuditToolId } from '@/beauty/lib/auditTools'
import AuditChip from './AuditChip.vue'
import AuditDayChart from './AuditDayChart.vue'
import AuditRegionChart from './AuditRegionChart.vue'
import { LEVEL_CLASS, VERDICT_CLASS, type TrailStep } from './consoleModel'

defineOptions({ name: 'BeautyAuditBriefingCard' })

const props = defineProps<{
  report: AuditReport
  steps: TrailStep[]
  busy: boolean
  /** 任务 id → 标题（由主组件从当前演示数据里取）。 */
  taskTitleOf: (taskId: string) => string
}>()

const emit = defineEmits<{
  (e: 'focus-task', taskId: string): void
  (e: 'export', report: AuditReport): void
  (e: 'run-tool', id: AuditToolId): void
}>()

const { t } = useBeautyI18n()

/** 展开哪一块明细：数据表 / 技术明细，都收起时为 none。 */
const open = ref<'none' | 'data' | 'tech'>('none')
const acked = ref(false)

const tables = computed(() => props.steps.filter((step) => step.output?.table))

const sources = computed(() => [
  ...new Set(props.steps.flatMap((step) => step.output?.sources ?? []))
])

const toggle = (next: 'data' | 'tech') => {
  open.value = open.value === next ? 'none' : next
}
</script>

<template>
  <div class="audit-card audit-card--report">
    <div class="audit-card__head">
      <span class="audit-report__icon">
        <Icon icon="lucide:file-text" :size="12" />
      </span>
      <span style="font-size: 12.5px; font-weight: 600">{{ props.report.title }}</span>
      <AuditChip :tone="VERDICT_CLASS[props.report.verdict]">{{ props.report.verdict }}</AuditChip>
      <span class="audit-meta audit-mono">{{ t('规则集') }} {{ props.report.ruleVersion }}</span>
    </div>

    <p class="audit-briefing">{{ props.report.briefing }}</p>

    <div class="audit-report__metrics">
      <div
        v-for="metric in props.report.metrics"
        :key="metric.label"
        class="audit-fact"
        :title="metric.hint"
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
      </div>
    </div>

    <AuditRegionChart :report="props.report" />
    <AuditDayChart :report="props.report" />

    <template v-if="props.report.findings.length">
      <div class="audit-section-title">
        {{ t('需要你知道的') }} {{ props.report.findings.length }} {{ t('件事') }}
      </div>
      <div
        v-for="(finding, index) in props.report.findings"
        :key="`${index}-${finding.ruleId}`"
        class="audit-finding"
      >
        <div class="audit-card__head">
          <AuditChip :tone="LEVEL_CLASS[finding.level]">{{
            t(LEVEL_LABELS[finding.level])
          }}</AuditChip>
          <span class="audit-tool-name">{{ finding.ruleId }}</span>
          <span style="font-size: 11.5px; font-weight: 600">{{ finding.title }}</span>
        </div>
        <div class="audit-finding__detail">{{ finding.detail }}</div>
        <div class="audit-finding__evidence">
          {{ t('证据：') }}{{ finding.evidence }}
          <span class="audit-meta"> · {{ t('出处') }} {{ finding.source }}</span>
        </div>
        <div v-if="finding.taskIds.length" class="audit-options">
          <button
            v-for="taskId in finding.taskIds.slice(0, 3)"
            :key="taskId"
            type="button"
            class="audit-option audit-option--task"
            :title="props.taskTitleOf(taskId)"
            @click="emit('focus-task', taskId)"
          >
            {{ t('看') }}「{{ props.taskTitleOf(taskId) }}」
          </button>
        </div>
      </div>
    </template>
    <div v-else class="audit-ok-note">
      <Icon icon="lucide:check-circle-2" :size="12" />
      {{ t('本期没有命中审计规则，按现在的排期继续即可。') }}
    </div>

    <template v-if="props.report.actions.length">
      <div class="audit-section-title">
        <Icon icon="lucide:lightbulb" :size="12" /> {{ t('建议怎么做（不会自动改任务）') }}
      </div>
      <div class="audit-notes">
        <div v-for="(action, index) in props.report.actions" :key="action" class="audit-notes__row">
          <span style="margin-top: 6px"></span>
          <span style="color: var(--cw-ink2); font-size: 11.5px"
            >{{ index + 1 }}. {{ action }}</span
          >
        </div>
      </div>
    </template>

    <div class="audit-actions audit-actions--toggles">
      <button
        type="button"
        class="audit-toggle"
        :class="{ 'is-open': open === 'data' }"
        @click="toggle('data')"
      >
        <Icon icon="lucide:database" :size="12" />
        {{ t('汇报背后的数据') }}（{{ tables.length }} {{ t('张表') }}）
      </button>
      <button
        type="button"
        class="audit-toggle"
        :class="{ 'is-open': open === 'tech' }"
        @click="toggle('tech')"
      >
        <Icon icon="lucide:wrench" :size="12" />
        {{ t('这次怎么查的') }}（{{ props.steps.length }} {{ t('步') }}）
      </button>
    </div>

    <div v-if="open === 'data'" class="audit-detail">
      <div v-for="(step, index) in tables" :key="step.id" class="audit-detail__block">
        <div class="audit-section-title">{{ index + 1 }}. {{ step.spec.title }}</div>
        <div v-if="step.output && step.output.table" style="overflow-x: auto">
          <table class="audit-table">
            <thead>
              <tr>
                <th v-for="column in step.output.table.columns" :key="column">{{ column }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in step.output.table.rows" :key="rowIndex">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="audit-section-title">{{ t('数据来源与口径') }}</div>
      <div class="audit-sources">
        <AuditChip v-for="source in sources" :key="source">{{ source }}</AuditChip>
      </div>
      <div class="audit-meta">{{ props.report.scope }}</div>
    </div>

    <div v-if="open === 'tech'" class="audit-detail">
      <div v-for="step in props.steps" :key="step.id" class="audit-tech audit-tech--block">
        <span class="audit-mono">{{ step.spec.name }}</span>
        <span>{{ step.spec.owner === 'adm' ? 'ADM' : 'Supervisor' }}</span>
        <span>{{ t('权限码') }} {{ step.spec.permission }}</span>
        <span v-for="param in step.spec.params" :key="`${param.label}-${param.value}`">
          {{ param.label }}={{ param.value }}
        </span>
        <template v-if="step.output">
          <span class="audit-mono">{{ step.output.traceId }}</span>
          <span>{{ step.output.scanned }}</span>
          <span>{{ step.output.ms }}ms</span>
        </template>
      </div>
    </div>

    <div class="audit-actions audit-actions--footer">
      <button
        type="button"
        class="cw-primary"
        :disabled="props.busy"
        @click="emit('run-tool', 'save_inspection_record')"
      >
        <Icon icon="lucide:shield-check" :size="14" /> {{ t('保存审计记录') }}
      </button>
      <button
        type="button"
        class="cw-ghost"
        :disabled="props.busy"
        @click="emit('run-tool', 'save_schedule')"
      >
        <Icon icon="lucide:sparkles" :size="13" /> {{ t('每周一自动审计') }}
      </button>
      <button type="button" class="cw-ghost" @click="emit('export', props.report)">
        <Icon icon="lucide:download" :size="13" /> {{ t('导出报告') }}
      </button>
      <button type="button" class="cw-ghost" :disabled="acked" @click="acked = true">
        <Icon icon="lucide:check" :size="13" /> {{ acked ? t('已确认') : t('标记已确认') }}
      </button>
    </div>
  </div>
</template>
