import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  createApp,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  type App
} from 'vue'
import { createCoursewareInspectionRuntime } from '@/beauty/lib/coursewareInspection'
vi.mock('@/store/modules/coursewareGeneration', () => ({
  useCoursewareGenerationStore: () => ({ task: undefined, init: vi.fn() })
}))
vi.mock('@/directives/permission/hasPermi', () => ({ hasPermission: () => false }))
vi.mock('vue-router', () => ({ useRoute: () => ({}), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/beauty/lib/coursewareInspectionRuntime', () => ({
  useCoursewareInspectionRuntime: () => runtime
}))
import Prompt from './index.vue'
let runtime: ReturnType<typeof createCoursewareInspectionRuntime>
let app: App
let root: HTMLDivElement
let taskId: string
const Dialog = defineComponent({
  props: { modelValue: Boolean },
  setup:
    (props, { slots }) =>
    () =>
      props.modelValue
        ? h('section', { role: 'dialog' }, [slots.default?.(), slots.footer?.()])
        : null
})
const Button = defineComponent({
  setup:
    (_, { slots, attrs }) =>
    () =>
      h('button', attrs, slots.default?.())
})
describe('课件监督全局提醒', () => {
  beforeEach(async () => {
    for (const [name, value] of Object.entries({
      computed,
      ref,
      nextTick,
      onMounted,
      onBeforeUnmount,
      useI18n: () => ({ t: (key: string) => key })
    }))
      vi.stubGlobal(name, value)
    runtime = createCoursewareInspectionRuntime({
      identity: () => ({ userId: 7, role: 'trainer' })
    })
    taskId = runtime.createTask({
      name: '监督',
      question: '监督',
      scope: 'current_account',
      minDurationMinutes: 10,
      remind: true,
      reportRequested: true,
      confirmed: true
    })
    runtime.processCoursewareSnapshot({ id: 1, status: 'running' })
    runtime.processCoursewareSnapshot(
      { id: 1, status: 'succeeded', done: true, resultCoursewareId: 101 },
      { creatorId: 7, estimatedDurationSeconds: 300, source: 'metadata' }
    )
    root = document.createElement('div')
    document.body.appendChild(root)
    app = createApp(Prompt)
    app.component('ElDialog', Dialog)
    app.component('ElButton', Button)
    app.component('Icon', { render: () => null })
    app.component('ElProgress', { render: () => null })
    app.mount(root)
    await nextTick()
  })
  afterEach(() => {
    app?.unmount()
    root?.remove()
    vi.unstubAllGlobals()
  })
  it('明确本人确认才签收；确认不代表达标', async () => {
    expect(root.querySelector('[role=dialog]')).not.toBeNull()
    const button = Array.from(root.querySelectorAll('button')).find(
      (item) => item.textContent === '本人确认已知晓'
    )!
    button.click()
    await nextTick()
    expect(runtime.tasks.value[0].entries[0].outcome).toBe('acknowledged')
    expect(runtime.tasks.value[0].trainerFailures['7']).toBe(1)
    expect(root.querySelector('[role=dialog]')).toBeNull()
  })
  it.each(['inbox', 'legacy'])('历史%s事项不抢占正常首页弹窗', async (kind) => {
    const saved = JSON.parse(JSON.stringify(runtime.tasks.value[0]))
    if (kind === 'inbox') saved.entries[0].notificationState = 'inbox'
    else saved.demoScenario = 'escalation'
    app.unmount()
    runtime = createCoursewareInspectionRuntime({
      identity: () => ({ userId: 7, role: 'trainer' }),
      seed: { version: 1, create: () => [saved] }
    })
    app = createApp(Prompt)
    app.component('ElDialog', Dialog)
    app.component('ElButton', Button)
    app.component('Icon', { render: () => null })
    app.component('ElProgress', { render: () => null })
    app.mount(root)
    await nextTick()
    expect(root.querySelector('[role=dialog]')).toBeNull()
    expect(runtime.tasks.value[0].entries[0].status).toBe('awaiting_confirmation')
  })
  it('稍后处理不隐式签收', async () => {
    const button = Array.from(root.querySelectorAll('button')).find(
      (item) => item.textContent === '稍后处理'
    )!
    button.click()
    await nextTick()
    expect(runtime.tasks.value[0].entries[0].status).toBe('awaiting_confirmation')
    expect(root.querySelector('[role=dialog]')).toBeNull()
  })
  it('暂停关闭弹窗并留存中止事项，不记为达标', async () => {
    runtime.pauseTask(taskId)
    await nextTick()
    expect(root.querySelector('[role=dialog]')).toBeNull()
    expect(runtime.tasks.value[0].entries[0].outcome).toBe('stopped')
    expect(runtime.tasks.value[0].entries[0].completedAt).toBeTruthy()
  })
})
