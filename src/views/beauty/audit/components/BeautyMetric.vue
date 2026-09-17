<script setup lang="ts">
/**
 * 指标卡（原型 `shared.tsx` 的 `Metric`）。
 *
 * 原型的 label / value 是 ReactNode（有一处 label 带 InfoTip），这里同时支持
 * 字符串 props 与 `label` / `value` 具名插槽（插槽优先）。
 */
defineOptions({ name: 'BeautyMetric' })

const props = withDefaults(
  defineProps<{
    /** 指标名 */
    label?: string
    /** 指标值 */
    value?: string | number
    /** 单位（value 后面跟的小字） */
    unit?: string
    /** 指标下方的解释 */
    hint?: string
    /** 数值颜色（原子类） */
    tone?: string
    /** 可点击时整体变成按钮语义 */
    clickable?: boolean
  }>(),
  { label: '', value: '', unit: '', hint: '', tone: '', clickable: false }
)

const emit = defineEmits<{ (e: 'click'): void }>()

const onClick = () => {
  if (props.clickable) emit('click')
}

const onKeydown = (event: KeyboardEvent) => {
  if (!props.clickable) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('click')
  }
}
</script>

<template>
  <div
    class="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10"
    :class="clickable ? 'cursor-pointer transition hover:ring-primary/40' : ''"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="onClick"
    @keydown="onKeydown"
  >
    <div class="text-[11px] font-medium text-muted-foreground">
      <slot name="label">{{ label }}</slot>
    </div>
    <div class="mt-1.5 flex items-baseline gap-1">
      <span class="text-[22px] leading-none font-semibold tabular-nums" :class="tone">
        <slot name="value">{{ value }}</slot>
      </span>
      <span v-if="unit" class="text-xs text-muted-foreground">{{ unit }}</span>
    </div>
    <div v-if="hint" class="mt-1.5 text-[11px] leading-snug text-muted-foreground">
      {{ hint }}
    </div>
  </div>
</template>
