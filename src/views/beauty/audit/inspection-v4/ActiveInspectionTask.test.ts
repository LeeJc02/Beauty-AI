import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import { readFileSync } from 'node:fs'
import ActiveInspectionTask from './ActiveInspectionTask.vue'
import { eventNarrative } from './eventNarrative'
import { advanceCase, authorizeCase, createCase, pauseCase, type InspectionCase } from './model'
import { executionEvents, supervisionEvent, type AgentEvent } from './taskFlow'

let app: App | undefined
let root: HTMLElement
const task = () => {
  const item = authorizeCase(createCase('南区新品培训，未来一个月'), '每天 09:00', '未达标员工本人')
  item.trace = [...executionEvents(item), supervisionEvent(item)]
  return item
}
const mount = async (
  item: InspectionCase,
  extras: {
    busy?: boolean
    readOnly?: boolean
    replaying?: boolean
    liveEvents?: AgentEvent[]
  } = {}
) => {
  root = document.createElement('div')
  document.body.appendChild(root)
  const props = reactive({ item, liveEvents: executionEvents(item), ...extras })
  app = createApp({ render: () => h(ActiveInspectionTask, props) })
  app.mount(root)
  await nextTick()
  return props
}
const report = () => root.querySelector('.stage-report')!.textContent!.replace(/\s+/g, ' ')
afterEach(() => {
  app?.unmount()
  root?.remove()
})

describe('ActiveInspectionTask 浅色记录详情', () => {
  it('三卡独立滚动，操作与重复演示声明退出卡片，边界集中于折叠依据', async () => {
    const item = advanceCase(task())
    item.trace = executionEvents(item, true)
    await mount(item)
    expect(root.querySelectorAll('.iv-active-task > .active-card')).toHaveLength(3)
    expect(root.querySelectorAll('.active-card > .card-scroll')).toHaveLength(3)
    expect(
      root.querySelector(
        '.overview-actions, .terminal-footer, .terminal-badge, .terminal-boundary, .report-round'
      )
    ).toBeNull()
    expect(root.textContent).not.toContain('修改任务')
    expect(report()).toContain('26 人达标、 2 人未达标')
    expect(report()).toContain('下一步建议')
    expect(root.querySelector('.supporting')?.textContent).toContain('不与后台事件联动')
    expect(root.querySelector('.supporting')?.textContent).toContain('未真实发送')
    expect(root.querySelector<HTMLDetailsElement>('.supporting')?.open).toBe(false)
    const tools = item.trace.filter((event) => event.kind === 'tool').reverse()
    const details = Array.from(root.querySelectorAll<HTMLDetailsElement>('.history-tool'))
    expect(details).toHaveLength(tools.length)
    expect(details.every((node) => !node.open)).toBe(true)
    details[0].querySelector('summary')!.click()
    await nextTick()
    expect(details[0].open).toBe(true)
    expect(details[0].textContent).toContain(eventNarrative(tools[0]).detail)
  })

  it('忙碌时冻结完整汇报及检查次数，完成后更新', async () => {
    const props = await mount(task())
    props.busy = true
    await nextTick()
    const frozen = report()
    props.item = advanceCase(props.item)
    props.liveEvents = executionEvents(props.item, true)
    await nextTick()
    expect(report()).toBe(frozen)
    expect(report()).toContain('22 人达标、 6 人未达标')
    expect(report()).toContain('上轮结果')
    props.busy = false
    await nextTick()
    expect(report()).toContain('26 人达标、 2 人未达标')
    expect(report()).toContain(
      `已完成 ${props.item.receipts.filter((r) => r.kind === 'check').length} 次检查`
    )
  })

  it('通知只概括最新检查后的预览，不累计历史', async () => {
    const item = task()
    item.receipts = [
      { id: 'old', kind: 'check', at: '旧时刻', title: '', detail: '' },
      { id: 'reminder', kind: 'reminder', at: '', title: '', detail: '' },
      { id: 'new', kind: 'check', at: '新时刻', title: '', detail: '' },
      { id: 'report', kind: 'report', at: '', title: '', detail: '' }
    ]
    await mount(item)
    expect(report()).toContain('已完成 2 次检查')
    expect(report()).toContain('本轮整理了1 批飞书汇报预览')
    expect(report()).not.toMatch(/员工提醒|旧时刻/)
  })

  it('上翻记录后不拉回，点击回到最新恢复跟随', async () => {
    const props = await mount(task(), { liveEvents: [] })
    const stream = root.querySelector<HTMLElement>('.execution-stream')!
    Object.defineProperty(stream, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(stream, 'clientHeight', { configurable: true, value: 300 })
    stream.scrollTop = 100
    stream.dispatchEvent(new Event('scroll'))
    props.liveEvents = executionEvents(props.item)
    await nextTick()
    await nextTick()
    await nextTick()
    expect(stream.scrollTop).toBe(100)
    root.querySelector<HTMLButtonElement>('.latest-button')!.click()
    expect(stream.scrollTop).toBe(1200)
  })

  it.each(['training', 'overview', 'workload'] as const)(
    '保留 %s 元数据、原文及执行约定',
    async (scenario) => {
      const item = task()
      Object.assign(item, {
        scenario,
        regions: ['东区', '西区'],
        region: '旧范围',
        product: '焕亮精华',
        startsOn: '2026-10-01',
        endsOn: '2026-10-31',
        cadence: '每天 17:00'
      })
      await mount(item)
      expect(root.querySelector('.confirmed-goal')?.textContent).toContain('对东区、西区的焕亮精华')
      expect(root.querySelector('.task-metadata')?.textContent).not.toContain('旧范围')
      expect(root.querySelector('.task-facts')?.textContent).toContain('2026-10-01 17:00')
      const request = root.querySelector<HTMLDetailsElement>('.task-request')!
      expect(request.open).toBe(false)
      request.querySelector('summary')!.click()
      expect(request.open).toBe(true)
      expect(request.querySelector('p')?.textContent).toBe(item.question)
      if (scenario === 'workload') expect(report()).toContain('当前不能判断工作负担')
    }
  )

  it.each([{ readOnly: true }, { replaying: true }, { busy: true }])(
    '保留 %j 状态，卡片不再提供任务操作',
    async (extras) => {
      await mount(task(), extras)
      expect(root.querySelector('.controls')).toBeNull()
      expect(root.querySelector('.stream-status')?.textContent).toContain(
        extras.busy ? '本轮执行中' : extras.replaying ? '最近一轮回放' : '只读查看'
      )
    }
  )

  it('暂停与结束状态不暗示自动执行，空记录不编造结论', async () => {
    const props = await mount(pauseCase(task()))
    expect(root.querySelector('.stream-status')?.textContent).toContain('监督已暂停')
    props.item = { ...props.item, phase: 'cancelled', trace: [], receipts: [] }
    props.liveEvents = []
    await nextTick()
    expect(report()).toContain('尚未完成检查')
    expect(report()).not.toContain('人达标')
    expect(root.textContent).toContain('尚无本轮执行记录')
    expect(root.textContent).toContain('尚无已完成事项')
  })

  it('执行流仅呈现自然语言，无可执行输入或原始 JSON', async () => {
    const item = task()
    const events = executionEvents(item)
    await mount(item, { liveEvents: events })
    const stream = root.querySelector('.execution-card')!
    expect(stream.querySelectorAll('input, textarea, [contenteditable], pre')).toHaveLength(0)
    const nodes = stream.querySelectorAll('.live-event')
    expect(nodes).toHaveLength(events.length)
    events.forEach((event, index) => {
      expect(nodes[index].querySelector('h3')?.textContent).toContain(eventNarrative(event).title)
      expect(nodes[index].querySelector('p')?.textContent).toBe(eventNarrative(event).detail)
    })
  })

  it('三卡统一主题色并限制高度，底部记录内部滚动且遵循减少动画偏好', () => {
    const styles = readFileSync('src/views/beauty/audit/inspection-v4/active-task.scss', 'utf8')
    expect(styles).toContain('--terminal-bg: var(--iv-surface)')
    expect(styles).not.toMatch(/#20252b|#282e35|#cad1d8/)
    expect(styles).toMatch(/grid-template-rows:\s*minmax\([\s\S]*?minmax\([\s\S]*?minmax\(/)
    expect(styles.match(/\.card-scroll\s*\{([^}]+)\}/)![1]).toMatch(/overflow:\s*auto/)
    expect(styles.match(/\.active-card\s*\{([^}]+)\}/)![1]).toMatch(/min-height:\s*0/)
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })
})
