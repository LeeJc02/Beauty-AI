<script setup lang="ts">
import { computed, ref } from 'vue'
import { checkDay, type InspectionCase } from './model'
import { isActiveTask, isArchived } from './taskFlow'

const props = defineProps<{ cases: InspectionCase[] }>()
const emit = defineEmits<{ new: []; open: [item: InspectionCase] }>()
const selected = ref<'active' | 'archived'>('active')
const search = ref('')
const activeCases = computed(() => props.cases.filter(isActiveTask))
const archivedCases = computed(() => props.cases.filter(isArchived))
const phaseLabels: Record<InspectionCase['phase'], string> = {
  ready: '待执行',
  running: '执行中',
  reported: '问答已完成',
  watching: '等待定时复查',
  paused: '已暂停',
  finished: '已完成',
  cancelled: '已取消'
}
const visibleCases = computed(() => {
  const items = selected.value === 'active' ? activeCases.value : archivedCases.value
  const keyword = search.value.trim().toLocaleLowerCase()
  if (!keyword) return items
  return items.filter((item) =>
    [item.title, ...item.regions, item.region, item.product, item.period, phaseLabels[item.phase]]
      .join(' ')
      .toLocaleLowerCase()
      .includes(keyword)
  )
})

function nextCheck(item: InspectionCase): string {
  if (isArchived(item)) return '已归档，不再复查'
  if (item.phase === 'paused') return '已暂停，等待恢复'
  if (item.phase === 'watching') {
    const day = checkDay(item, item.round + 1)
    return day > item.endsOn ? '周期已到期，待结束演示' : `演示 ${day} · ${item.cadence}`
  }
  if (item.phase === 'running') return '当前正在执行'
  if (item.phase === 'ready') return '待启动，尚未安排'
  if (item.phase === 'cancelled') return '已取消，不再复查'
  return '尚未安排复查'
}
</script>

<template>
  <section class="inspection-home" aria-label="巡检任务首页">
    <div class="home-intro">
      <div class="home-intro__copy">
        <p class="home-eyebrow">巡检助手 · 持续关注，有据可查</p>
        <h1>把需要持续关注的事，<br />交给巡检助手</h1>
        <p class="home-description">从一个问题开始，确认范围，再按节奏回看变化。</p>
      </div>
      <div class="home-create">
        <h2>开始一次新的巡检</h2>
        <p>查询一次，或持续跟进。<br />先告诉助手你想关注什么。</p>
        <button class="home-primary" type="button" @click="emit('new')">新建任务</button>
        <small>本地演示 · 不会后台运行或实际发送通知</small>
      </div>
    </div>

    <section class="home-tasks" aria-labelledby="inspection-tasks-title">
      <div class="home-tasks__heading">
        <div>
          <h2 id="inspection-tasks-title">我的巡检任务</h2>
          <p>继续跟进当前任务，或回看已完成的记录。</p>
        </div>
        <label class="home-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            v-model="search"
            type="search"
            aria-label="搜索巡检任务"
            placeholder="搜索任务、地区或产品"
          />
        </label>
      </div>
      <div class="home-filters" role="group" aria-label="任务分类">
        <button
          type="button"
          :aria-pressed="selected === 'active'"
          :class="{ 'is-selected': selected === 'active' }"
          @click="selected = 'active'"
        >
          正在执行 <span>{{ activeCases.length }}</span>
        </button>
        <button
          type="button"
          :aria-pressed="selected === 'archived'"
          :class="{ 'is-selected': selected === 'archived' }"
          @click="selected = 'archived'"
        >
          已完成归档 <span>{{ archivedCases.length }}</span>
        </button>
      </div>
      <p class="home-filter-note" aria-live="polite">
        {{
          selected === 'active'
            ? '仅展示监督周期内尚未结束的定时任务，按约定频率复查；暂停的监督任务仍保留在此。'
            : '单次问答已结束，或监督任务已完成；不再运行，保留报告与执行记录。'
        }}
        <span v-if="search.trim()">找到 {{ visibleCases.length }} 个任务</span>
      </p>

      <div class="home-list-scroll" role="region" aria-label="巡检任务列表" tabindex="0">
        <ul v-if="visibleCases.length" class="home-list">
          <li v-for="item in visibleCases" :key="item.id">
            <button class="home-task" type="button" @click="emit('open', item)">
              <span class="home-task__main">
                <span class="home-task__title">{{ item.title }}</span>
                <span class="home-task__scope">
                  {{ item.regions.length ? item.regions.join('、') : item.region }} ·
                  {{ item.product }}
                </span>
                <span class="home-task__period">巡检周期 · {{ item.period }}</span>
              </span>
              <span class="home-task__schedule">
                <span class="home-task__label">{{
                  isArchived(item) ? '归档状态' : '下次复查'
                }}</span>
                <span>{{ nextCheck(item) }}</span>
                <span class="home-task__round">{{
                  item.round > 0 ? `已复查 ${item.round} 轮` : '尚未复查'
                }}</span>
              </span>
              <span class="home-task__state">
                <span
                  class="home-phase"
                  :class="{
                    'home-phase--accent':
                      !isArchived(item) && (item.phase === 'watching' || item.phase === 'running')
                  }"
                >
                  {{ phaseLabels[item.phase] }}
                </span>
                <span v-if="item.archivedAt && item.phase !== 'finished'" class="home-task__label"
                  >已归档</span
                >
                <span class="home-task__open">查看任务 <span aria-hidden="true">→</span></span>
              </span>
            </button>
          </li>
        </ul>
        <div v-else class="home-empty" role="status">
          <h3>{{
            search.trim()
              ? '没有找到匹配的任务'
              : selected === 'active'
                ? '还没有活动任务'
                : '还没有已归档的任务'
          }}</h3>
          <p>{{
            search.trim()
              ? '试试其他任务名称、地区或产品，或清除搜索条件。'
              : selected === 'active'
                ? '新建一个任务，把需要持续关注的事记录下来。'
                : '问答结束或监督完成后自动归档，可以在这里回看。'
          }}</p>
          <button v-if="search.trim()" class="home-secondary" type="button" @click="search = ''"
            >清除搜索</button
          >
          <button
            v-else-if="selected === 'active'"
            class="home-primary"
            type="button"
            @click="emit('new')"
            >新建任务</button
          >
          <button v-else class="home-secondary" type="button" @click="selected = 'active'"
            >查看正在执行的任务</button
          >
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped lang="scss">
.inspection-home {
  --home-accent: var(--iv-accent, var(--iv-green, #b25d49));
  --home-ink: var(--iv-ink, #1c1917);
  --home-muted: var(--iv-muted, #78716c);
  --home-line: var(--iv-line, #e7e2df);
  --home-bg: var(--iv-soft, #faf8f6);
  --home-tint: var(--iv-accent-subtle, #fbf3f0);
  --home-surface: var(--iv-surface, #fff);
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  overscroll-behavior: contain;
  padding: 0 4px 12px;
  color: var(--home-ink);
  background: var(--home-bg);
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;

  &,
  * {
    box-sizing: border-box;
  }
  h1,
  h2,
  h3,
  p {
    margin: 0;
  }
  button,
  input {
    font: inherit;
  }
  button {
    cursor: pointer;
  }
  button:focus-visible,
  .home-list-scroll:focus-visible {
    outline: 2px solid var(--home-accent);
    outline-offset: 3px;
  }
}
.home-intro,
.home-tasks {
  width: 100%;
  max-width: 1680px;
  margin-inline: auto;
  border: 1px solid var(--home-line);
  border-radius: 24px;
  background: var(--home-surface);
  animation: home-enter 320ms ease-out both;
}
.home-intro {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
  padding: 24px 40px;
  gap: 40px;
  min-height: 200px;
}
.home-eyebrow {
  color: var(--home-accent);
  font-size: 12px;
  font-weight: 600;
}
.home-intro h1 {
  margin-block: 16px;
  font-size: clamp(25px, 2.2vw, 32px);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.45;
}
.home-description,
.home-create p {
  color: var(--home-muted);
}
.home-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 0;
  margin: 28px 0 0;
  list-style: none;
  li {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  span {
    color: var(--home-accent);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  strong {
    font-weight: 500;
  }
  small {
    color: var(--home-muted);
    font-size: 12px;
  }
}
.home-create {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding-left: 36px;
  border-left: 1px solid var(--home-line);
  gap: 12px;
  h2 {
    font-size: 18px;
    font-weight: 600;
  }
  small {
    color: var(--home-muted);
    font-size: 11px;
  }
}
.home-create__mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: var(--home-accent);
  background: var(--home-tint);
  font-size: 25px;
}
.home-primary,
.home-secondary {
  min-height: 42px;
  padding: 9px 24px;
  border: 1px solid transparent;
  border-radius: 10px;
  transition: filter 160ms ease;
  &:hover {
    filter: brightness(0.95);
  }
}
.home-primary {
  color: var(--iv-on-accent, #fff);
  background: var(--home-accent);
}
.home-create .home-primary {
  width: 100%;
  margin-top: 4px;
}
.home-secondary {
  color: var(--home-ink);
  background: var(--home-bg);
  border-color: var(--home-line);
}
.home-tasks {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  margin-top: 24px;
  padding: 28px 32px;
  animation-delay: 60ms;
}
.home-tasks__heading {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  h2 {
    font-size: 18px;
    font-weight: 600;
  }
  p {
    margin-top: 4px;
    color: var(--home-muted);
    font-size: 13px;
  }
}
.home-search {
  display: flex;
  align-items: center;
  width: 280px;
  max-width: 100%;
  min-width: 0;
  padding: 0 12px;
  gap: 8px;
  border: 1px solid var(--home-line);
  border-radius: 10px;
  background: var(--home-bg);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
  &:focus-within {
    border-color: var(--home-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--home-accent) 18%, transparent);
  }
  svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    stroke: var(--home-muted);
    stroke-width: 1.6;
  }
  input {
    width: 100%;
    min-width: 0;
    min-height: 42px;
    border: 0;
    border-radius: 0;
    outline: none;
    box-shadow: none;
    appearance: none;
    background: transparent;
    color: var(--home-ink);
    font-size: 13px;
  }
  input:focus,
  input:focus-visible {
    outline: none;
    box-shadow: none;
  }
  input::placeholder {
    color: var(--home-muted);
  }
}
.home-filters {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
  button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 14px;
    border: 1px solid var(--home-line);
    border-radius: 10px;
    color: var(--home-muted);
    background: var(--home-surface);
  }
  button:hover {
    background: var(--home-bg);
  }
  .is-selected {
    border-color: var(--home-accent);
    color: var(--home-accent);
    background: var(--home-tint);
    font-weight: 600;
  }
  span {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
}
.home-filter-note {
  flex-shrink: 0;
  margin-block: 12px 18px !important;
  color: var(--home-muted);
  font-size: 12px;
}
.home-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 5px;
  border-radius: 12px;
}
.home-list {
  padding: 0;
  margin: 0;
  list-style: none;
  li + li {
    border-top: 1px solid var(--home-line);
  }
}
.home-task {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(110px, auto);
  align-items: center;
  width: 100%;
  gap: 24px;
  padding: 22px 12px;
  border: 0;
  border-radius: 12px;
  color: var(--home-ink);
  background: transparent;
  text-align: left;
  transition: background 160ms ease;
  &:hover {
    background: var(--home-bg);
  }
}
.home-task__main,
.home-task__schedule,
.home-task__state {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 5px;
}
.home-task__title {
  font-size: 15px;
  font-weight: 600;
}
.home-task__scope,
.home-task__schedule {
  font-size: 13px;
}
.home-task__period,
.home-task__label,
.home-task__round {
  color: var(--home-muted);
  font-size: 12px;
}
.home-task__state {
  align-items: flex-end;
  gap: 10px;
}
.home-phase {
  padding: 3px 10px;
  border-radius: 7px;
  background: #f4f0ec;
  color: var(--home-muted);
  font-size: 12px;
}
.home-phase--accent {
  color: var(--home-accent);
  background: var(--home-tint);
}
.home-task__open {
  color: var(--home-accent);
  font-size: 12px;
}
.home-empty {
  padding: 40px 16px;
  text-align: center;
  h3 {
    font-size: 16px;
    font-weight: 500;
  }
  p {
    margin: 8px 0 20px;
    color: var(--home-muted);
  }
}
@keyframes home-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 900px), (max-height: 650px) {
  .inspection-home {
    overflow-y: auto;
  }
  .home-tasks {
    flex: none;
    height: max(420px, min(560px, 65dvh));
  }
}
@media (max-width: 900px) {
  .home-intro {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .home-create {
    padding: 24px 0 0;
    border-left: 0;
    border-top: 1px solid var(--home-line);
  }
  .home-create .home-primary {
    max-width: 320px;
  }
  .home-task {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
  }
  .home-task__main {
    grid-column: 1 / -1;
  }
}
@media (max-width: 600px) {
  .home-tasks {
    height: max(520px, min(560px, 65dvh));
    padding: 20px 16px;
  }
  .home-tasks__heading {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
  }
  .home-search {
    width: 100%;
  }
  .home-steps {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
  .home-steps li {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    column-gap: 8px;
  }
  .home-steps small {
    grid-column: 2;
  }
  .home-task {
    padding-inline: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .home-intro,
  .home-tasks {
    animation: none;
  }
  .home-primary,
  .home-secondary,
  .home-search,
  .home-task {
    transition: none;
  }
}
@media (min-width: 761px) and (max-height: 800px) {
  .home-intro {
    min-height: 0;
    padding: 14px 28px;
    gap: 28px;
  }
  .home-intro h1 {
    font-size: 28px;
    margin-block: 10px;
  }
  .home-steps,
  .home-create__mark {
    display: none;
  }
  .home-create {
    gap: 8px;
  }
  .home-tasks {
    margin-top: 16px;
    padding: 20px 24px;
  }
  .home-filters {
    margin-top: 16px;
  }
}
@media (max-width: 760px) {
  .home-steps {
    display: none;
  }
}
</style>
