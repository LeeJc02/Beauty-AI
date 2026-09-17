<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

defineProps<{ language?: string }>()
const emit = defineEmits<{ refreshed: [] }>()
</script>

<template>
  <button
    type="button"
    class="brand-catalog-trigger"
    aria-label="管理品牌和品类"
    title="管理品牌和品类"
    @click="emit('refreshed')"
  >
    <Plus :size="14" />
  </button>
</template>

<style scoped>
.brand-catalog-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e7e2df;
  border-radius: 50%;
  background: #fff;
  color: #b25d49;
  cursor: pointer;
}
.brand-catalog-trigger:hover {
  background: #fbf3f0;
  border-color: #b25d49;
}
</style>
