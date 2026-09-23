<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import type { CoursewareInspectionEntry } from '@/beauty/lib/coursewareInspection'
defineProps<{ entry: DeepReadonly<CoursewareInspectionEntry> }>()
function stamp(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Jakarta',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date)
    : '时间未记录'
}
</script>

<template>
  <ol class="ci-timeline">
    <li v-for="(event, index) in entry.events" :key="index">
      <time :datetime="event.at">{{ stamp(event.at) }}</time>
      <div class="ci-timeline-body"
        ><p>{{ event.text }}</p
        ><details v-if="event.input || event.output"
          ><summary>查看处理依据</summary><p v-if="event.input">条件：{{ event.input }}</p
          ><p v-if="event.output">结果：{{ event.output }}</p></details
        ></div
      >
    </li>
  </ol>
</template>

<style scoped lang="scss">
.ci-timeline {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  li {
    position: relative;
    display: grid;
    grid-template-columns: 128px minmax(0, 1fr);
    gap: 16px;
    padding: 0 0 12px 18px;
    border-left: 1px solid var(--ci-line, #e7e1dd);
    line-height: 1.8;
    font-size: 14px;
    overflow-wrap: anywhere;
    &::before {
      content: '';
      position: absolute;
      left: -4px;
      top: 9px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ci-accent, #b25d49);
    }
    &:last-child {
      padding-bottom: 0;
    }
  }
  time {
    color: var(--ci-muted, #78716c);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
}
.ci-timeline-body {
  min-width: 0;
  p {
    margin: 0;
  }
  details {
    margin-top: 5px;
    color: var(--ci-muted, #78716c);
    font-size: 12px;
  }
  summary {
    cursor: pointer;
  }
  details p {
    margin-top: 7px;
    white-space: pre-wrap;
  }
}
@media (max-width: 560px) {
  .ci-timeline li {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
