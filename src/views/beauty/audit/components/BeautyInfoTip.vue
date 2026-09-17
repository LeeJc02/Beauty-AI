<script setup lang="ts">
/**
 * 口径说明气泡（原型 `shared.tsx` 的 `InfoTip`）。
 *
 * 原型挂在指标后面，鼠标移上去 / 键盘聚焦时浮出来。原型用 Tailwind 的具名 group
 * 变体控制显隐，这里改用等价类（见 `audit-workspace.scss` 的 `.inspection-infotip`）。
 */
defineOptions({ name: 'BeautyInfoTip' })

withDefaults(defineProps<{ label?: string }>(), { label: '口径说明' })
</script>

<template>
  <span class="inspection-infotip">
    <button type="button" :aria-label="label" class="inspection-infotip__trigger">
      <Icon icon="lucide:info" :size="12" />
    </button>
    <span role="tooltip" class="inspection-infotip__panel">
      <slot></slot>
    </span>
  </span>
</template>
