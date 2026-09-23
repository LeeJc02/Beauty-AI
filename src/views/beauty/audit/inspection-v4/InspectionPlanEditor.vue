<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { parsePlanMarkdown, planHtmlToMarkdown } from './markdown'
const props = defineProps<{ modelValue: string; disabled?: boolean; streaming?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const document = ref<HTMLElement>()
const locked = computed(() => Boolean(props.disabled || props.streaming))
let lastEmitted: string | undefined
function render() {
  if (document.value)
    document.value.innerHTML = parsePlanMarkdown(props.modelValue)
      .map((block) => block.html)
      .join('')
}
onMounted(render)
watch(
  () => props.modelValue,
  (value) => {
    // 不重建用户正在编辑的 DOM，保留光标与标题节点。
    if (value !== lastEmitted || locked.value) render()
    lastEmitted = undefined
  }
)
function update() {
  if (locked.value || !document.value) return
  lastEmitted = planHtmlToMarkdown(document.value.innerHTML)
  emit('update:modelValue', lastEmitted)
}
function paste(event: ClipboardEvent) {
  event.preventDefault()
  if (locked.value || !document.value) return
  const clipboard = event.clipboardData
  if (!clipboard) return
  const html = clipboard.getData('text/html')
  const markdown = html ? planHtmlToMarkdown(html) : clipboard.getData('text/plain')
  // HTML 先转白名单 Markdown 再经安全渲染器生成，绝不插入剪贴板原始 HTML。
  const safe = parsePlanMarkdown(markdown)
    .map((block) => block.html)
    .join('')
  const selection = window.getSelection()
  if (!selection?.rangeCount || !document.value.contains(selection.anchorNode)) return
  const range = selection.getRangeAt(0)
  range.deleteContents()
  const fragment = range.createContextualFragment(safe)
  const last = fragment.lastChild
  range.insertNode(fragment)
  if (last) {
    range.setStartAfter(last)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }
  update()
}
function preventLink(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('a')) event.preventDefault()
}
</script>

<template>
  <div class="plan-editor" :aria-busy="streaming || undefined">
    <div
      ref="document"
      class="plan-editor__document"
      role="textbox"
      aria-label="任务计划正文"
      aria-multiline="true"
      :aria-readonly="locked"
      :contenteditable="!locked"
      :tabindex="locked ? -1 : 0"
      spellcheck="false"
      @input="update"
      @paste="paste"
      @drop.prevent
      @click="preventLink"
    ></div>
  </div>
</template>

<style scoped>
.plan-editor {
  width: 100%;
  min-width: 0;
  color: var(--is-ink, #292524);
}
.plan-editor__document {
  min-height: 240px;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.9;
  outline: none;
  cursor: text;
}
.plan-editor__document:focus-visible {
  outline: 2px solid var(--is-accent-border, #f0d8d0);
  outline-offset: 8px;
}
.plan-editor__document :deep(h1) {
  margin: 0 0 26px;
  font-size: 25px;
  line-height: 1.5;
}
.plan-editor__document :deep(h2) {
  margin: 28px 0 12px;
  font-size: 18px;
  line-height: 1.6;
}
.plan-editor__document :deep(h3) {
  margin: 22px 0 10px;
  font-size: 16px;
}
.plan-editor__document :deep(p) {
  margin: 12px 0;
}
.plan-editor__document :deep(ul),
.plan-editor__document :deep(ol) {
  padding-left: 24px;
  margin: 12px 0;
}
.plan-editor__document :deep(li) {
  margin: 8px 0;
}
.plan-editor__document :deep(blockquote) {
  margin: 16px 0;
  padding-left: 14px;
  border-left: 2px solid var(--is-accent-border);
  color: var(--is-muted);
}
.plan-editor__document :deep(a) {
  color: var(--is-accent);
  text-decoration: underline;
}
.plan-editor__document :deep(pre) {
  white-space: pre-wrap;
}
.plan-editor__document[contenteditable='false'] {
  cursor: default;
}
</style>
