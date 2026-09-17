<script setup lang="ts">
/**
 * 风险结论卡（原型 `training-inspection/RiskCard.tsx`）。
 *
 * `variant="card"` 默认展开（任务覆盖清单里用），`variant="row"` 默认收起（任务体检里用）。
 */
import { computed, ref } from 'vue'
import { KIND_LABELS, WEIGHT_LABELS } from '@/beauty/lib/inspectionEngine'
import type { InspectionActor, InspectionRisk, InspectionState, RiskStatus } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautyChip from './BeautyChip.vue'
import BeautyField from './BeautyField.vue'
import BeautyKindBadge from './BeautyKindBadge.vue'
import BeautyLevelBadge from './BeautyLevelBadge.vue'
import BeautyStatusBadge from './BeautyStatusBadge.vue'

defineOptions({ name: 'BeautyRiskCard' })

const props = withDefaults(
  defineProps<{
    state: InspectionState
    actor: InspectionActor
    risk: InspectionRisk
    status: RiskStatus
    variant?: 'card' | 'row'
  }>(),
  { variant: 'card' }
)

const emit = defineEmits<{
  (e: 'simulate', risk: InspectionRisk): void
  (e: 'dispose', risk: InspectionRisk): void
  (e: 'open-task', taskId: string): void
}>()

const { t } = useBeautyI18n()

const open = ref(props.variant === 'card')

const tasks = computed(() =>
  props.risk.taskIds
    .map((id) => props.state.tasks.find((task) => task.id === id))
    .filter((task) => Boolean(task))
)

const regions = computed(() =>
  props.risk.regionIds
    .map((id) => props.state.regions.find((region) => region.id === id)?.name ?? id)
    .filter(Boolean)
)

const canAct = computed(() => !props.actor.readOnly && props.risk.ruleId !== 'F1')
const kinds = computed(() => [...new Set(tasks.value.map((task) => task!.kind))])

/** 任务与影响范围摘要（原型把相邻文本节点直接拼在一起，这里先拼好再渲染）。 */
const summaryLine = computed(() => {
  const parts = tasks.value.slice(0, 3).map(
    (task) =>
      `${task!.title}（${t(KIND_LABELS[task!.kind])}${task!.weight ? `·${t(WEIGHT_LABELS[task!.weight])}` : ''}）`
  )
  const more = tasks.value.length > 3 ? `等 ${tasks.value.length} 项任务` : ''
  const regionsText = regions.value.join('、') || t('全局')
  return `${parts.join('')}${more} · ${t('影响')} ${props.risk.impact.affectedPeople} ${t('人')} · ${regionsText}`
})
</script>

<template>
  <div class="rounded-xl bg-card ring-1 ring-foreground/10" :class="status === '已解决' ? 'opacity-70' : ''">
    <button
      type="button"
      class="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
      @click="open = !open"
    >
      <span class="mt-0.5 text-muted-foreground">
        <Icon :icon="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" :size="15" />
      </span>
      <span class="grid flex-1 gap-1.5">
        <span class="flex flex-wrap items-center gap-1.5">
          <BeautyLevelBadge :level="risk.level" />
          <BeautyKindBadge v-for="kind in kinds" :key="kind" :kind="kind" />
          <BeautyStatusBadge :status="status" />
        </span>
        <span class="text-sm font-semibold text-foreground">{{ risk.title }}</span>
        <span class="text-[11px] text-muted-foreground">{{ summaryLine }}</span>
      </span>
    </button>
    <div v-if="open" class="grid gap-3 border-t border-solid border-border/70 px-3.5 py-3">
      <div class="grid gap-2 text-[12px] leading-relaxed">
        <BeautyField :label="t('结论')" variant="row">{{ risk.conclusion }}</BeautyField>
        <BeautyField :label="t('原因')" variant="row">{{ risk.reason }}</BeautyField>
        <div class="grid grid-cols-[46px_1fr] gap-2">
          <span class="text-muted-foreground">{{ t('证据') }}</span>
          <ul class="grid gap-1">
            <li v-for="item in risk.evidence" :key="item.text" class="grid gap-0.5">
              <span>{{ item.text }}</span>
              <span class="text-[10.5px] text-muted-foreground">{{ t('来源：') }}{{ item.ref }}</span>
            </li>
          </ul>
        </div>
        <BeautyField :label="t('建议')" variant="row">{{ risk.suggestion }}</BeautyField>
        <BeautyField :label="t('影响')" variant="row">{{ risk.impact.text }}</BeautyField>
        <BeautyField v-if="risk.hypothesis" :label="t('待核实')" variant="row">
          {{ risk.hypothesis }}
        </BeautyField>
        <BeautyField :label="t('需要确认')" variant="row">
          {{
            risk.confirmation
              ? `${risk.confirmation.name}（${t(risk.confirmation.roleLabel)}）`
              : t('无需额外确认')
          }}
        </BeautyField>
      </div>
      <div class="flex flex-wrap gap-1.5 border-t border-solid border-border/70 pt-2.5">
        <el-button size="small" plain @click="emit('simulate', risk)">
          <Icon icon="lucide:sparkles" :size="13" /> {{ t('调整') }}
        </el-button>
        <el-button
          size="small"
          plain
          :disabled="!tasks.length"
          @click="tasks[0] && emit('open-task', tasks[0].id)"
        >
          <Icon icon="lucide:external-link" :size="13" /> {{ t('原任务') }}
        </el-button>
        <el-button
          size="small"
          text
          :disabled="!canAct || status === '已解决'"
          @click="emit('dispose', risk)"
        >
          <Icon icon="lucide:shield-check" :size="13" /> {{ t('处置') }}
        </el-button>
        <span
          v-if="status === '已解决'"
          class="inline-flex items-center gap-1 text-[11px] text-emerald-600"
        >
          <Icon icon="lucide:file-warning" :size="12" /> {{ t('已解除') }}
        </span>
      </div>
    </div>
  </div>
</template>
