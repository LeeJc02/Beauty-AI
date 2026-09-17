<template>
  <div ref="container" class="series-page-cover">
    <iframe
      v-if="html"
      :srcdoc="html"
      sandbox="allow-scripts"
      tabindex="-1"
      :title="title"
      :style="{ transform: `scale(${width / 1280})` }"
    ></iframe>
    <div v-else class="series-page-cover__placeholder">
      <Icon icon="lucide:presentation" :size="24" />
      <span>{{ title }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { CoursewareApi } from '@/api/courseware'
import { useElementSize } from '@vueuse/core'
const props = defineProps<{ taskId?: number; pageId?: string; title: string }>()
const html = ref('')
const container = ref<HTMLElement>()
const { width } = useElementSize(container)
watch(
  () => [props.taskId, props.pageId],
  async (_, __, onCleanup) => {
    let stale = false
    onCleanup(() => {
      stale = true
    })
    html.value = ''
    if (!props.taskId || !props.pageId) return
    try {
      const preview = await CoursewareApi.getGenerationPagePreview(props.taskId, props.pageId)
      if (!stale) html.value = preview.html
    } catch {
      // 封面失败不阻断课件预览；展示标题，不伪造课件画面。
    }
  },
  { immediate: true }
)
</script>
<style scoped>
.series-page-cover {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
.series-page-cover iframe {
  width: 1280px;
  height: 720px;
  border: 0;
  pointer-events: none;
  transform-origin: 0 0;
}
.series-page-cover__placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  background: #f7f5f2;
  color: #766f73;
  font-size: 13px;
  box-sizing: border-box;
}
</style>
