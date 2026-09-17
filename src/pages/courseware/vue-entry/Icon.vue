<script setup lang="ts">
import { computed } from 'vue'
import * as Lucide from 'lucide-vue-next'

const props = withDefaults(defineProps<{ icon?: string; size?: number }>(), { size: 16 })
const name = computed(() =>
  (props.icon || '').split(':').pop()!.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(''),
)
const iconComponent = computed(() => (Lucide as Record<string, unknown>)[name.value] || Lucide.CircleHelp)
</script>

<template><component :is="iconComponent" :size="size" /></template>
