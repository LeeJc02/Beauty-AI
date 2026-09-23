<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AgentEvent } from './taskFlow'
const props = defineProps<{
  events: AgentEvent[]
  running?: boolean
  waiting?: string
  expanded?: boolean
  full?: boolean
}>()
const body = ref<HTMLElement>()
const follow = ref(true)
const count = computed(() => props.events.length)
watch(count, async () => {
  await nextTick()
  if (follow.value && body.value) body.value.scrollTop = body.value.scrollHeight
})
const labels = { analysis: '分析摘要', tool: '工具调用', result: '输出', waiting: '等待' }
</script>
<template>
  <section
    class="iv-agent"
    :class="{ 'iv-agent--full': full }"
    aria-label="Agent 执行过程"
    :aria-busy="running"
  >
    <header
      ><strong><span :class="{ 'iv-agent-live': running }">●</span> Agent 执行过程</strong
      ><span>{{ running ? '模拟执行中' : waiting ? '等待调度' : '执行记录' }}</span></header
    >
    <p class="iv-agent-note">本地模拟 · 展示执行摘要与工具输入输出，非真实模型思维链</p>
    <div
      ref="body"
      class="iv-agent-stream"
      @scroll="
        follow =
          !$event.target ||
          ($event.target as HTMLElement).scrollHeight -
            ($event.target as HTMLElement).scrollTop -
            ($event.target as HTMLElement).clientHeight <
            64
      "
    >
      <article v-for="(event, index) in events" :key="event.id" class="iv-agent-event">
        <div class="iv-agent-meta"
          ><span>{{ String(index + 1).padStart(2, '0') }}</span
          ><b>{{ labels[event.kind] }}</b
          ><span>完成</span></div
        >
        <strong>{{ event.title }}</strong
        ><p>{{ event.detail }}</p>
        <details
          v-if="event.input || event.output"
          :open="expanded || (running && index === events.length - 1)"
          ><summary>查看{{ event.input ? '参数与返回' : '输出结果' }}</summary
          ><template v-if="event.input"
            ><small>INPUT</small><pre>{{ event.input }}</pre></template
          ><template v-if="event.output"
            ><small>OUTPUT · SIMULATED</small><pre>{{ event.output }}</pre>
          </template></details
        >
      </article>
      <p v-if="!events.length" class="iv-agent-empty">等待确认查询参数，尚未调用查询工具。</p>
      <div v-if="running" class="iv-agent-pending" role="status"
        ><i></i> 正在执行下一步<span class="iv-agent-cursor">▍</span></div
      >
      <div v-else-if="waiting" class="iv-agent-wait">{{ waiting }}</div>
    </div>
  </section>
</template>
<style scoped lang="scss">
.iv-agent {
  border: 1px solid var(--iv-line, #e7e2df);
  border-radius: 14px;
  background: var(--iv-soft, #faf8f6);
  overflow: hidden;
  margin-bottom: 20px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 15px 16px 7px;
  font-size: 12px;
}
header > span {
  color: var(--iv-muted);
  font-size: 11px;
}
header strong span {
  color: var(--iv-accent);
  margin-right: 6px;
}
.iv-agent-note {
  font-size: 10px;
  color: var(--iv-muted);
  padding: 0 16px 12px;
  margin: 0;
  border-bottom: 1px solid var(--iv-line);
}
.iv-agent-stream {
  max-height: 440px;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0 16px;
  scrollbar-width: thin;
}
.iv-agent--full .iv-agent-stream {
  max-height: none;
  overflow: visible;
}
.iv-agent-event {
  padding: 15px 0;
  border-bottom: 1px solid var(--iv-line);
  animation: trace-arrive 0.24s ease-out;
}
.iv-agent-meta {
  display: flex;
  gap: 9px;
  font-size: 10px;
  color: var(--iv-muted);
  margin-bottom: 7px;
}
.iv-agent-meta span:last-child {
  margin-left: auto;
}
.iv-agent-meta b {
  font-weight: 500;
  color: var(--iv-accent);
}
.iv-agent-event > strong {
  font:
    500 12px/1.6 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
  overflow-wrap: anywhere;
}
.iv-agent-event p {
  font-size: 12px;
  line-height: 1.8;
  margin: 5px 0 0;
  color: var(--iv-muted);
}
details {
  margin-top: 10px;
}
summary {
  cursor: pointer;
  color: var(--iv-accent);
  font-size: 11px;
  padding: 4px 0;
}
small {
  display: block;
  font:
    9px/2 ui-monospace,
    monospace;
  color: var(--iv-muted);
  margin-top: 8px;
}
pre {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--iv-line);
  border-radius: 8px;
  background: var(--iv-surface, #fff);
  font:
    11px/1.7 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.iv-agent-empty,
.iv-agent-wait,
.iv-agent-pending {
  padding: 16px 0;
  margin: 0;
  color: var(--iv-muted);
  font-size: 12px;
  line-height: 1.8;
}
.iv-agent-pending {
  color: var(--iv-accent);
}
.iv-agent-live,
.iv-agent-cursor {
  animation: trace-pulse 1.2s ease-in-out infinite;
}
@keyframes trace-arrive {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes trace-pulse {
  50% {
    opacity: 0.3;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
  }
}
</style>
