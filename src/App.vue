<script lang="ts" setup>
import { useAppStore } from '@/store/modules/app'
import { useDesign } from '@/hooks/web/useDesign'
import routerSearch from '@/components/RouterSearch/index.vue'
import CoursewareGenerationPrompt from '@/components/CoursewareGenerationPrompt/index.vue'
// Beauty-AI 原型自带的 DOM 翻译运行时（把页面上的中文原文按当前语言替换）
import { useBeautyTranslationRuntime } from '@/beauty/composables'

defineOptions({ name: 'APP' })

useBeautyTranslationRuntime()

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('app')
const appStore = useAppStore()
const currentSize = computed(() => appStore.getCurrentSize)
const greyMode = computed(() => appStore.getGreyMode)
</script>
<template>
  <ConfigGlobal :size="currentSize">
    <RouterView :class="greyMode ? `${prefixCls}-grey-mode` : ''" />
    <CoursewareGenerationPrompt />
    <routerSearch />
  </ConfigGlobal>
</template>
<style lang="scss">
$prefix-cls: #{$namespace}-app;

.size {
  width: 100%;
  height: 100%;
}

html,
body {
  @extend .size;

  padding: 0 !important;
  margin: 0;
  overflow: hidden;

  #app {
    @extend .size;
  }
}

.#{$prefix-cls}-grey-mode {
  filter: grayscale(100%);
}
</style>
