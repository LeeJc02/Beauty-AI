<script setup lang="ts">
/**
 * 迁移占位页：Beauty-AI 原型（React）页面逐个移植为 Vue3 + Element Plus 期间使用。
 * 每个占位页都会注明对应的原型来源文件，方便对照还原。
 */
defineOptions({ name: 'BeautyPagePlaceholder' })

defineProps({
  title: { type: String, required: true },
  source: { type: String, default: '' }
})
</script>

<template>
  <ContentWrap :title="title">
    <div class="flex flex-col items-center justify-center py-60px text-center">
      <div class="mb-12px text-16px font-600 text-[var(--beauty-text-strong)]">
        {{ title }} · 迁移中
      </div>
      <div class="text-13px text-[var(--beauty-text-muted)]">
        该页面正在按 SalesBoost-vue 的技术栈（Vue3 + Element Plus）重建
      </div>
      <div v-if="source" class="mt-6px text-12px text-[var(--beauty-text-subtle)]">
        原型来源：{{ source }}
      </div>
    </div>
  </ContentWrap>
</template>
