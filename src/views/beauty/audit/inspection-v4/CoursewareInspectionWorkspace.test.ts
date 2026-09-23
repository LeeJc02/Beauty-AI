import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, nextTick, reactive, type App } from 'vue'
import { readFileSync } from 'node:fs'
import {
  createCoursewareInspectionRuntime,
  type CoursewareInspectionRuntime
} from '@/beauty/lib/coursewareInspection'
import CoursewareInspectionWorkspace from './CoursewareInspectionWorkspace.vue'
import { taskIntelligence } from './taskPresentation'
vi.mock('vue', async (original) => {
  const vue = await original<typeof import('vue')>()
  return {
    ...vue,
    Transition: {
      inheritAttrs: false,
      setup:
        (_props: unknown, { slots }: { slots: { default: () => unknown } }) =>
        () =>
          slots.default()
    }
  }
})
import {
  createCoursewareInspectionFixtures,
  COURSEWARE_INSPECTION_SEED_VERSION
} from '@/beauty/lib/coursewareInspectionFixtures'

const { readPage } = vi.hoisted(() => ({ readPage: vi.fn() }))
vi.mock('@/api/courseware', () => ({ CoursewareApi: { getCoursewarePage: readPage } }))
let runtime: CoursewareInspectionRuntime
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/beauty/lib/coursewareInspectionRuntime', () => ({
  useCoursewareInspectionRuntime: () => runtime
}))
let app: App | undefined
let root: HTMLElement
const clock = () => new Date('2026-09-21T09:00:00Z')
const seed = () =>
  runtime.createTask({
    name: '新课件 · 学习时长监督',
    question: '监督以后新课件预计学习时长5到10分钟',
    timeMode: 'ongoing',
    scope: 'current_account',
    minDurationMinutes: 5,
    maxDurationMinutes: 10,
    remind: true,
    reportRequested: true,
    confirmed: true
  })
async function mount(readOnly = false) {
  app = createApp(CoursewareInspectionWorkspace, { readOnly })
  app.mount(root)
  await nextTick()
}
async function click(label: string) {
  if (
    root.querySelector(
      '.is-plan-confirmation [role="status"], .is-analysis-stream, .is-streaming-status'
    )
  ) {
    await vi.advanceTimersByTimeAsync(2000)
    await nextTick()
  }
  const task = runtime.tasks.value.find((item) => item.name === label)
  if (task)
    label = (task.requestPlan?.ready ? task.requestPlan.summary : task.question) || task.name
  label = label.replace(/请确认后执行[。！]?$/, '').trim()
  const button = Array.from(root.querySelectorAll('button')).find((node) =>
    node.textContent?.trim().includes(label)
  )
  expect(button, `缺少按钮 ${label}`).toBeTruthy()
  button!.click()
  await nextTick()
}
async function fill(selector: string, text: string) {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  expect(input).toBeTruthy()
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  readPage.mockReset().mockResolvedValue({
    list: [
      {
        id: 101,
        title: '新品精华课件',
        creatorName: 'Sarah',
        estimatedDurationSeconds: 360,
        status: 20,
        previewUrl: '/lesson'
      }
    ],
    total: 1
  })
  localStorage.removeItem('inspection-panels-swapped')
  runtime = createCoursewareInspectionRuntime({
    identity: () => ({ userId: 1001, role: 'hq_trainer' }),
    now: clock
  })
  root = document.createElement('div')
  document.body.appendChild(root)
})
afterEach(() => {
  app?.unmount()
  root.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
describe('课件事件驱动工作台', () => {
  it('首页无重复标题，培训任务显示业务条件，已结束监督不能恢复修改', async () => {
    runtime = createCoursewareInspectionRuntime({
      identity: () => ({ userId: 1001, role: 'hq_trainer' }),
      now: clock,
      mode: 'demo',
      seed: {
        version: COURSEWARE_INSPECTION_SEED_VERSION,
        create: createCoursewareInspectionFixtures
      }
    })
    const running = runtime.tasks.value.find(
      (task) => task.subject === 'training' && !task.completedAt
    )!
    const ended = runtime.tasks.value.find((task) => task.mode !== 'once' && task.completedAt)!
    expect(running).toBeTruthy()
    expect(ended).toBeTruthy()
    await mount()
    expect(root.querySelector('.ci-header')).toBeNull()
    expect(root.querySelector('.ci-entry-badge')?.textContent).toContain('智能巡检工作区')
    expect(root.querySelector('.ci-task-rows')?.textContent).toContain('培训 · 持续监督')
    await click(running.name)
    expect(root.querySelector('.ci-facts')?.textContent).toContain('测验至少')
    expect(root.querySelector('.ci-facts')?.textContent).not.toContain('预计学习')
    expect(root.querySelector('.ci-overview-topbar')).toBeNull()
    expect(root.querySelector('.ci-metadata .ci-task-actions')).not.toBeNull()
    expect(root.querySelector('.ci-metadata h1')?.textContent?.trim()).toBe(running.question)
    expect(root.querySelector('.ci-metadata')?.lastElementChild?.className).toBe('ci-task-actions')
    expect(root.textContent).not.toContain('前往生成课件')
    await click('返回任务')
    await click('已完成')
    await click(ended.name)
    expect(root.querySelector('.ci-task-actions')?.textContent).not.toMatch(
      /恢复任务|暂停任务|编辑任务/
    )
    expect(root.querySelector('.ci-task-actions')?.textContent).toContain('返回任务')
    expect(root.querySelector('.ci-task-actions')?.textContent).toContain('新建任务')
  })
  it('详情立即接收专属事件，自动续接，暂停与离开停止且不签收旧提醒', async () => {
    const id = seed()
    const advance = vi.spyOn(runtime, 'advancePresentation')
    await mount()
    expect(advance).toHaveBeenCalledTimes(1)
    await click('新课件 · 学习时长监督')
    expect(advance).toHaveBeenCalledTimes(2)
    expect(root.querySelector('.ci-progress .ci-timeline li')).not.toBeNull()
    await vi.advanceTimersByTimeAsync(1600)
    expect(advance).toHaveBeenCalledTimes(3)
    await click('暂停任务')
    await vi.advanceTimersByTimeAsync(4800)
    expect(advance).toHaveBeenCalledTimes(3)
    await click('恢复任务')
    expect(advance).toHaveBeenCalledTimes(4)
    await click('返回任务')
    await vi.advanceTimersByTimeAsync(4800)
    expect(advance).toHaveBeenCalledTimes(8)
    await click('已完成')
    await vi.advanceTimersByTimeAsync(4800)
    expect(advance).toHaveBeenCalledTimes(8)
    expect(runtime.tasks.value.find((task) => task.id === id)).toBeTruthy()
  })
  it('执行流跟随底部，主动上翻不抢滚动，回到最新恢复跟随', async () => {
    seed()
    await mount()
    await click('新课件 · 学习时长监督')
    const stream = root.querySelector<HTMLElement>('.ci-progress .ci-card-scroll')!
    Object.defineProperties(stream, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 200 }
    })
    await vi.advanceTimersByTimeAsync(1600)
    expect(stream.scrollTop).toBe(1200)
    stream.scrollTop = 100
    stream.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(1600)
    expect(stream.scrollTop).toBe(100)
    await click('回到最新')
    expect(stream.scrollTop).toBe(1200)
  })

  it('首页是有业务数据的任务工作台，首页和详情不提供演示控制', async () => {
    runtime = createCoursewareInspectionRuntime({
      identity: () => ({ userId: 1001, role: 'hq_trainer', displayName: 'Sarah' }),
      now: clock,
      mode: 'demo',
      seed: {
        version: COURSEWARE_INSPECTION_SEED_VERSION,
        create: createCoursewareInspectionFixtures
      }
    })
    await mount()
    expect(root.querySelectorAll('.ci-task-row')).toHaveLength(
      runtime.tasks.value.filter((task) => !task.completedAt).length
    )
    expect(root.querySelector('.ci-entry-story')).not.toBeNull()
    expect(root.querySelectorAll('.ci-list-filters button')).toHaveLength(2)
    expect(root.querySelector('input[type=search]')).toBeNull()
    expect(root.textContent).toContain(
      runtime.tasks.value.find((task) => task.name === '新品课件时长监督')!.question
    )
    expect(root.querySelector('.ci-task-status-label')).toBeNull()
    expect(root.textContent).not.toMatch(/体验|演示|模拟|原型|重新演示|下一步/)
    expect(root.querySelector('.ci-demo-scenarios')).toBeNull()
    await click('新品课件时长监督')
    expect(root.querySelector('.ci-progress')?.textContent).toContain('新品精华搭配建议')
    expect(root.querySelector('.ci-report-receipt')?.textContent).toContain('汇报已完成')
    expect(root.textContent).not.toMatch(/体验|演示|模拟|原型|重新演示|下一步/)
    const awaiting = runtime.tasks.value
      .find((task) => task.name === '新品课件时长监督')!
      .entries.find((entry) => entry.status === 'awaiting_confirmation')!
    await vi.advanceTimersByTimeAsync(1600 * 3)
    expect(awaiting.status).toBe('awaiting_confirmation')
    expect(awaiting.completedAt).toBeUndefined()
    await click('本人确认已知晓')
    expect(root.querySelector('.ci-acknowledge')).toBeNull()
    expect(root.querySelectorAll('.ci-history .ci-completed-entry')).toHaveLength(4)
  })
  it('仅运行中和已完成两类，暂停仍运行中，完成查询可打开结果', async () => {
    runtime = createCoursewareInspectionRuntime({
      identity: () => ({ userId: 1001, role: 'hq_trainer' }),
      now: clock,
      mode: 'demo',
      seed: {
        version: COURSEWARE_INSPECTION_SEED_VERSION,
        create: createCoursewareInspectionFixtures
      }
    })
    await mount()
    expect(root.querySelectorAll('.ci-task-row')).toHaveLength(
      runtime.tasks.value.filter((task) => !task.completedAt).length
    )
    expect(root.querySelector('.ci-task-rows')?.textContent).toContain('彩妆')
    await click('已完成')
    expect(root.querySelectorAll('.ci-task-row')).toHaveLength(
      runtime.tasks.value.filter((task) => task.completedAt).length
    )
    const query = runtime.tasks.value.find((task) => task.name === '新品课件时长核对')!
    const queryRow = Array.from(root.querySelectorAll('.ci-task-row')).find((row) =>
      row.textContent?.includes(query.question)
    )!
    expect(queryRow.querySelector('.ci-task-state-summary')?.textContent).toBe(
      taskIntelligence(query)
    )
    expect(queryRow.querySelector('.ci-task-progress')).toBeNull()
    await click('新品课件时长核对')
    expect(root.querySelector('.inspection-session')).toBeNull()
    expect(root.querySelectorAll('.ci-detail > .ci-card')).toHaveLength(3)
    expect(root.querySelector('.ci-narrative')?.textContent).toBe(taskIntelligence(query))
    expect(root.querySelector('.ci-task-actions')?.textContent).not.toMatch(
      /编辑任务|恢复任务|暂停任务/
    )
    await click('返回任务')
    await click('运行中')
    await click('彩妆培训')
    await click('恢复任务')
    expect(runtime.tasks.value.find((task) => task.name === '彩妆培训')?.enabled).toBe(true)
  })
  it('运行中只有两类监督，一次查询归入已完成且保留原过程', async () => {
    runtime = createCoursewareInspectionRuntime({
      identity: () => ({ userId: 1001, role: 'hq_trainer' }),
      now: clock,
      mode: 'demo',
      seed: {
        version: COURSEWARE_INSPECTION_SEED_VERSION,
        create: createCoursewareInspectionFixtures
      }
    })
    await mount()
    expect(
      runtime.tasks.value
        .filter((task) => !task.completedAt)
        .map((task) => task.mode || 'continuous')
    ).not.toContain('once')
    expect(root.querySelectorAll('.ci-task-row')).toHaveLength(5)
    expect(root.querySelector('.ci-task-rows')?.textContent).not.toMatch(/查询分析|查询中/)
    expect(root.querySelector('.ci-list-heading h2')?.textContent).toBe('我的任务')
    expect(root.querySelector('.ci-list-heading .ci-list-filters')).not.toBeNull()
    const archived = runtime.tasks.value.find((task) => task.name === '南区培训进度核查')!
    expect(archived.queryPending).toBeFalsy()
    expect(archived.completedAt).toBeTruthy()
    await click('已完成')
    expect(root.querySelectorAll('.ci-task-row')).toHaveLength(6)
    const completedKinds = new Set(
      runtime.tasks.value
        .filter((task) => task.completedAt)
        .map((task) => `${task.subject || 'courseware'}:${task.mode || 'continuous'}`)
    )
    expect([...completedKinds].sort()).toEqual([
      'courseware:continuous',
      'courseware:once',
      'training:continuous',
      'training:once'
    ])
    await click(archived.name)
    expect(root.querySelector('.is-confirmation')).toBeNull()
    expect(root.querySelectorAll('.ci-detail > .ci-card')).toHaveLength(3)
    expect(root.querySelector('.ci-query-table')?.textContent).toContain('李欣')
    expect(root.querySelector('.ci-timeline')?.textContent).toContain('已按确认的范围筛选记录')
  })
  it('首页上方左右分区，下方任务列表，完整需求优先于简短名称', async () => {
    const id = seed()
    const task = runtime.tasks.value.find((item) => item.id === id)!
    await mount()
    const home = root.querySelector('.ci-home')!
    expect(home.children[0].className).toBe('ci-entry-intro')
    expect(home.children[1].className).toBe('ci-task-list')
    expect(root.querySelector('.ci-entry-intro .ci-entry-story h2')).not.toBeNull()
    expect(root.querySelectorAll('.ci-entry-guide .ci-entry-roadmap li')).toHaveLength(3)
    expect(root.querySelector('.ci-entry-intro > .ci-entry-start')).not.toBeNull()
    expect(root.querySelector('.ci-entry-intro > .ci-entry-description')).not.toBeNull()
    expect(root.querySelector('.ci-task-description strong')?.textContent).toBe(task.question)
    expect(root.querySelector('.ci-task-status-label')).toBeNull()
    await click(task.name)
    expect(root.querySelector('.ci-metadata-content')?.firstElementChild?.tagName).toBe('H1')
    expect(root.querySelector('.ci-task-actions .ci-primary')?.textContent).toContain('新建任务')
    expect(root.querySelectorAll('.ci-detail > .ci-card')).toHaveLength(3)
  })
  it('右上状态区区分生成、核验、等待依据，摘要不再占独立行', async () => {
    seed()
    runtime.processCoursewareSnapshot({
      id: 31,
      title: '新品防晒课件',
      status: 'RUNNING',
      snapshotVersion: 1
    })
    vi.spyOn(runtime, 'advancePresentation').mockReturnValue(false)
    const task = reactive(JSON.parse(JSON.stringify(runtime.tasks.value[0])))
    runtime = { ...runtime, tasks: computed(() => [task]) }
    const entry = task.entries[0]
    entry.creator = 'Sarah'
    await mount()
    const summary = () => root.querySelector('.ci-task-state .ci-task-state-summary')?.textContent
    expect(summary()).toContain(`Sarah · 新品防晒课件：${entry.summary}`)
    expect(summary()).not.toContain('已核验 0 项')
    expect(summary()).not.toContain('正在核验')
    entry.status = 'checking'
    entry.summary = '正在核验产物预计学习时长。'
    await nextTick()
    expect(summary()).toContain(entry.summary)
    entry.status = 'missing_evidence'
    entry.summary = '等待补齐时长依据。'
    await nextTick()
    expect(summary()).toContain(entry.summary)
    expect(root.querySelector('.ci-task-progress')).toBeNull()
    expect(root.querySelector('.ci-task-footer')?.textContent).not.toContain('已核验')
    expect(root.textContent).not.toContain('提醒签收不影响后续核验')
    expect(
      root
        .querySelector('.ci-task-description')
        ?.nextElementSibling?.classList.contains('ci-task-state')
    ).toBe(true)
  })
  it('任务列表具有独立固定高度，分类切换不依赖条目数量撑高卡片', () => {
    const styles = readFileSync(
      'src/views/beauty/audit/inspection-v4/courseware-inspection.scss',
      'utf8'
    )
    const rows = styles.match(/\.ci-task-rows\s*\{([^}]+)\}/)![1]
    expect(rows).toMatch(/\n\s*height:\s*500px/)
    expect(rows).toMatch(/overflow-y:\s*auto/)
    expect(rows).not.toMatch(/max-height:/)
    expect(styles.match(/\.ci-home\s*\{([^}]+)\}/)![1]).toContain(
      'grid-template-columns: minmax(0, 1fr)'
    )
    expect(styles).not.toMatch(/\.ci-entry-roadmap\s*\{\s*display:\s*none/)
  })
  it('隐藏历史脚本案例但保留存储，自建任务仍然展示', async () => {
    runtime.createTask({
      name: '演示 · 旧脚本',
      question: '旧案例',
      scope: 'current_account',
      remind: true,
      reportRequested: true,
      confirmed: true,
      demoScenario: 'escalation'
    })
    seed()
    await mount()
    expect(root.querySelectorAll('.ci-task-row')).toHaveLength(1)
    expect(root.textContent).not.toMatch(/演示|旧脚本/)
    expect(runtime.tasks.value).toHaveLength(2)
  })
  it('统一对话确认前不建立订阅，按需求规划持续监督', async () => {
    await mount()
    await click('新建任务')
    expect(root.querySelector('.ci-header')).toBeNull()
    expect(root.querySelector('.is-composer textarea')).not.toBeNull()
    await fill('textarea', '持续监督以后新课件预计学习时长5到10分钟，不合规提醒本人，连续3次汇报')
    await click('发送')
    expect(runtime.tasks.value).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(root.querySelector('.is-materials')?.textContent).toContain('任务计划')
    await click('确认，开始持续监督')
    expect(runtime.tasks.value).toHaveLength(1)
    expect(runtime.tasks.value[0]).toMatchObject({
      minDurationMinutes: 5,
      maxDurationMinutes: 10,
      enabled: true
    })
    expect(root.querySelector('.inspection-session')).toBeNull()
    expect(root.querySelector('.ci-detail')).not.toBeNull()
    expect(root.querySelector('.ci-task-title')?.textContent).toContain('5')
    expect(runtime.tasks.value[0].entries.length).toBeGreaterThan(0)
  })
  it('多轮澄清明确一次查询，执行后有数据且归入已完成，不创建监督', async () => {
    await mount()
    await click('新建任务')
    await fill('textarea', '查一下当前课件预计学习时长')
    await click('发送')
    await vi.advanceTimersByTimeAsync(2000)
    expect(root.querySelector('.is-choices')?.textContent).toContain('5–10 分钟')
    expect(readPage).not.toHaveBeenCalled()
    await click('5–10 分钟')
    await vi.advanceTimersByTimeAsync(2000)
    expect(root.querySelector('.is-materials')?.textContent).toContain('任务计划')
    await click('确认，开始查询')
    await vi.waitFor(() =>
      expect(root.querySelector('.ci-query-table')?.textContent).toContain('新品精华课件')
    )
    expect(runtime.tasks.value[0]).toMatchObject({
      mode: 'once',
      enabled: false,
      remind: false,
      reportRequested: false
    })
    expect(runtime.tasks.value[0].completedAt).toBeTruthy()
    expect(root.querySelectorAll('.ci-detail > .ci-card')).toHaveLength(3)
    expect(root.querySelector('.ci-query-table')?.textContent).toContain('新品精华课件')
    await click('返回任务')
    await click('已完成')
    expect(root.querySelectorAll('.ci-task-row')).toHaveLength(1)
  })
  it('修改任务通过对话确认，返回不改变规则，最终确认保持原ID', async () => {
    const id = seed()
    await mount()
    await click('新课件 · 学习时长监督')
    await click('编辑任务')
    await fill('textarea', '合格范围改为7到10分钟')
    await click('发送')
    await click('返回任务')
    expect(runtime.tasks.value[0].minDurationMinutes).toBe(5)
    await click('编辑任务')
    await fill('textarea', '合格范围改为7到10分钟')
    await click('发送')
    await click('确认，更新监督条件')
    expect(runtime.tasks.value).toHaveLength(1)
    expect(runtime.tasks.value[0]).toMatchObject({ id, minDurationMinutes: 7 })
    expect(root.querySelector('.inspection-session')).toBeNull()
    expect(root.querySelector('.ci-detail')).not.toBeNull()
    expect(root.querySelector('.ci-task-title')?.textContent).toContain('7')
  })
  it('事件进度与完成记录不重复，本人确认才进入已完成', async () => {
    vi.spyOn(runtime, 'advancePresentation').mockReturnValue(false)
    seed()
    runtime.processCoursewareSnapshot({
      id: 21,
      title: '新品课件',
      status: 'RUNNING',
      snapshotVersion: 1
    })
    runtime.processCoursewareSnapshot(
      {
        id: 21,
        title: '新品课件',
        status: 'SUCCEEDED',
        done: true,
        resultCoursewareId: 121,
        snapshotVersion: 2
      },
      {
        creatorId: '1001',
        creatorName: 'Sarah',
        estimatedDurationSeconds: 60,
        source: 'courseware metadata'
      }
    )
    await mount()
    expect(root.querySelector('.ci-task-status-label')).toBeNull()
    expect(root.querySelector('.ci-task-state-summary')?.textContent).toContain(
      runtime.tasks.value[0].entries[0].summary
    )
    expect(root.querySelector('.ci-task-progress')).toBeNull()
    await click('新课件 · 学习时长监督')
    expect(root.querySelectorAll('.ci-progress .ci-entry')).toHaveLength(1)
    expect(root.querySelectorAll('.ci-history .ci-completed-entry')).toHaveLength(0)
    expect(root.querySelector('.ci-progress')?.textContent).toContain('Sarah')
    expect(root.querySelector('.ci-progress')?.textContent).toContain('等待培训师确认')
    await click('本人确认已知晓')
    expect(root.querySelectorAll('.ci-progress .ci-entry')).toHaveLength(0)
    expect(root.querySelectorAll('.ci-history .ci-completed-entry')).toHaveLength(1)
    const history = root.querySelector<HTMLDetailsElement>('.ci-history .ci-completed-entry')!
    history.open = true
    expect(history.querySelector('.ci-timeline time[datetime]')).not.toBeNull()
    expect(history.querySelectorAll('.ci-timeline li')).toHaveLength(
      runtime.tasks.value[0].entries[0].events.length
    )
    expect(root.querySelector('.ci-history')?.textContent).toContain('本人已确认')
  })
  it('第三次不合规显示待发送汇报，不伪称已发飞书', async () => {
    seed()
    for (let id = 1; id <= 3; id++) {
      runtime.processCoursewareSnapshot({
        id,
        title: `课件${id}`,
        status: 'RUNNING',
        snapshotVersion: 1
      })
      runtime.processCoursewareSnapshot(
        {
          id,
          title: `课件${id}`,
          status: 'SUCCEEDED',
          done: true,
          resultCoursewareId: id + 100,
          snapshotVersion: 2
        },
        {
          creatorId: '1001',
          creatorName: 'Sarah',
          estimatedDurationSeconds: 60,
          source: 'courseware metadata'
        }
      )
    }
    await mount()
    await click('新课件 · 学习时长监督')
    expect(root.querySelectorAll('.ci-report-pending')).toHaveLength(1)
    expect(root.querySelector('.ci-report-pending')?.textContent).toContain('连续 3 次不合规')
    expect(root.querySelector('.ci-report-pending')?.textContent).toContain('未发送')
  })
  it('只读隐藏创建修改暂停，仅可查看业务记录', async () => {
    const advance = vi.spyOn(runtime, 'advancePresentation')
    seed()
    await mount(true)
    expect(root.textContent).toContain('新建任务')
    await click('新课件 · 学习时长监督')
    await vi.advanceTimersByTimeAsync(4800)
    expect(advance).not.toHaveBeenCalled()
    expect(root.querySelector('.ci-task-actions')?.textContent).not.toMatch(/暂停任务|编辑任务/)
    await click('返回任务')
    expect(root.querySelector('.ci-task-row')).not.toBeNull()
    expect(root.textContent).not.toContain('查看原有任务记录')
  })
})
