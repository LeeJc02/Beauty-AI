import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import InspectionWorkspace from './InspectionWorkspace.vue'
import { type InspectionCase } from './model'
import { seedTasks } from './taskFlow'
import { DEMO_STEP_MS, DEMO_TRIGGER_SECONDS, latestRoundEvents } from './liveDemo'

const KEY = 'beauty-ai:inspection-v4:workspace-test'
let app: App | undefined
let root: HTMLElement
const flush = async () => {
  await nextTick()
  await vi.advanceTimersByTimeAsync(40)
  await nextTick()
}
const mount = async (readOnly = false) => {
  app = createApp(InspectionWorkspace, { storageScope: 'workspace-test', readOnly })
  app.mount(root)
  await flush()
}
const element = <T extends HTMLElement = HTMLElement>(
  selector: string,
  within: ParentNode = root
): T => {
  const found = within.querySelector<T>(selector)
  expect(found, `找不到元素：${selector}`).not.toBeNull()
  return found!
}
const button = (text: string, within: ParentNode = root): HTMLButtonElement => {
  const found = Array.from(within.querySelectorAll<HTMLButtonElement>('button')).find((item) => {
    const label = item.cloneNode(true) as HTMLElement
    label.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return label.textContent?.replace(/\s+/g, ' ').trim().startsWith(text)
  })
  expect(found, `找不到按钮：${text}`).toBeTruthy()
  return found!
}
// 详情页只保留任务操作；直接触发组件事件以覆盖父级演示调度协议。
const taskAction = async (event: 'advance' | 'edit') => {
  const task = element('.iv-active-task') as HTMLElement & {
    __vueParentComponent: { emit: (event: string) => void }
  }
  task.__vueParentComponent.emit(event)
  await flush()
}
const click = async (text: string, within: ParentNode = root) => {
  button(text, within).click()
  await flush()
}
const setValue = async (selector: string, value: string) => {
  const control = element<HTMLTextAreaElement>(selector)
  control.value = value
  control.dispatchEvent(new Event('input', { bubbles: true }))
  await flush()
}
const submit = async (text: string) => {
  await setValue('#iv-message-input', text)
  element<HTMLFormElement>('.iv-composer').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true })
  )
  await flush()
}
const answer = async (text: string) => {
  if (!root.querySelector('[aria-label="回答澄清问题"]')) {
    element<HTMLInputElement>('.iv-query input[type="radio"][value="custom"]').click()
    await flush()
  }
  await setValue('[aria-label="回答澄清问题"]', text)
  await click('发送回答')
}
// 只等待单轮，禁止 runAllTimers 把自动演示的后续轮次全部执行。
const settle = async () => {
  await vi.advanceTimersByTimeAsync(12_000)
  await flush()
}
const saved = (): { selectedId: string; cases: InspectionCase[] } =>
  JSON.parse(localStorage.getItem(KEY)!)
const current = () => saved().cases.find((item) => item.id === saved().selectedId)!
const notices = (item = current()) =>
  item.receipts.filter((r) => ['reminder', 'escalation', 'report'].includes(r.kind))
const openSeed = async (readOnly = false, key?: string) => {
  app?.unmount()
  const item = key ? seedTasks().find((item) => item.demoKey === key)! : seedTasks()[0]
  localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, demoVersion: 4, cases: [item], selectedId: '' })
  )
  await mount(readOnly)
  await click(item.title)
  return item
}
const advance = async () => {
  await taskAction('advance')
  await settle()
}

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
  })
  localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, demoVersion: 4, cases: [], selectedId: '' })
  )
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => {})
  root = document.createElement('div')
  document.body.appendChild(root)
  await mount()
  await click('新建任务')
})
afterEach(() => {
  app?.unmount()
  app = undefined
  root.remove()
  localStorage.removeItem(KEY)
  Reflect.deleteProperty(document, 'visibilityState')
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('InspectionWorkspace 工具授权与页面内演示', () => {
  it('顶部移除演示与旧历史入口，活跃任务使用简洁名称且导航紧随标题', async () => {
    await openSeed()
    const header = element('.iv-header')
    expect(header.textContent).not.toContain('前端演示')
    expect(header.textContent).not.toContain('之前交代的事')
    expect(element('h1', header).textContent).toBe('新品 · 培训达标监督')
    expect(Array.from(header.children)).toEqual([
      element('.iv-brand', header),
      element('[aria-label="任务导航"]', header)
    ])
    expect(button('返回初始页', header)).toBeTruthy()
    expect(button('新建任务', header)).toBeTruthy()
    expect(button('暂停任务', header).disabled).toBe(true)
    expect(button('修改任务', header).disabled).toBe(true)
    await click('修改任务', header)
    expect(root.querySelector('.iv-query')).toBeNull()
    await settle()
    expect(button('暂停任务', header).disabled).toBe(false)
    expect(button('修改任务', header).disabled).toBe(false)
    expect(root.querySelector('.overview-actions')).toBeNull()
  })

  it('修改预填旧确认条件，停止演示，取消后原任务与记录不变', async () => {
    const original = await openSeed(false, 'third-reminder')
    await settle()
    await click('修改任务', element('.iv-header'))
    expect(root.querySelector('.iv-active-task')).toBeNull()
    expect(Array.from(element('.iv-panels').children)).toEqual([
      element('.iv-conversation'),
      element('.iv-query-materials')
    ])
    expect(button('确认，保存修改').disabled).toBe(false)
    expect(root.querySelector('.iv-query')?.textContent).not.toContain('确认，创建监督任务')
    expect(element('.iv-summary').textContent).toContain(original.product)
    expect(element('.iv-summary').textContent).toContain(original.startsOn)
    expect(element('.iv-summary').textContent).toContain('提醒满 3 次后，再复查仍未达标才升级')
    await click('补充或修改需求')
    await answer('产品是敏感肌，北区，每周一09:00')
    await vi.advanceTimersByTimeAsync(180_000)
    await flush()
    expect(saved().cases).toEqual([original])
    await click('取消', element('.iv-query'))
    expect(root.querySelector('.iv-active-task')).not.toBeNull()
    expect(current()).toEqual(original)
  })

  it('修改最终确认替换同一任务，不重复新增；新条件重建执行结果', async () => {
    const original = await openSeed(false, 'third-reminder')
    await settle()
    await click('修改任务')
    await click('补充或修改需求')
    await answer('产品是敏感肌，北区，每周一09:00，连续3轮未达标升级')
    expect(saved().cases).toEqual([original])
    await click('确认，保存修改')
    expect(saved().cases).toHaveLength(1)
    expect(current()).toMatchObject({ id: original.id, phase: 'running' })
    await settle()
    expect(current()).toMatchObject({
      id: original.id,
      demoKey: original.demoKey,
      createdAt: original.createdAt,
      phase: 'watching',
      round: 0,
      product: '敏感肌',
      regions: ['北区'],
      cadence: '每周一 09:00',
      toolPlan: { escalationRule: 'consecutive' }
    })
    expect(notices().filter((receipt) => receipt.kind === 'escalation')).toEqual([])
  })

  it.each(['返回初始页', '新建任务'])(
    '修改中%s丢弃草稿，后续新建不覆盖旧任务',
    async (navigation) => {
      const original = await openSeed()
      await settle()
      await click('修改任务')
      await click(navigation, element('.iv-header'))
      if (navigation === '返回初始页') await click('新建任务')
      await submit('查询北区本周敏感肌培训，只查一次')
      await click('确认，开始查询')
      await settle()
      expect(saved().cases).toHaveLength(2)
      expect(saved().cases.find((item) => item.id === original.id)).toEqual(original)
      expect(current().id).not.toBe(original.id)
    }
  )

  it('执行或只读时不能进入修改', async () => {
    await openSeed()
    await settle()
    await taskAction('advance')
    expect(button('修改任务').disabled).toBe(true)
    await click('修改任务')
    await taskAction('edit')
    expect(root.querySelector('.iv-query')).toBeNull()
    await openSeed(true)
    const editButton = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((node) =>
      node.textContent?.includes('修改任务')
    )
    expect(!editButton || editButton.disabled).toBe(true)
    await taskAction('edit')
    expect(root.querySelector('.iv-query')).toBeNull()
  })

  it('固定左交互右材料，示例只填写不执行', async () => {
    expect(Array.from(element('.iv-panels').children)).toEqual([
      element('.iv-conversation'),
      element('.iv-materials')
    ])
    await click('盯住新品培训')
    expect(element<HTMLTextAreaElement>('#iv-message-input').value).not.toBe('')
    expect(root.querySelector('.iv-query')).toBeNull()
    await settle()
    expect(saved().cases).toEqual([])
  })

  it('radio需发送，自定义多轮澄清后仍须最终确认，不能提前建任务', async () => {
    await submit('帮我看看情况')
    const radio = element<HTMLInputElement>('.iv-options input[type="radio"]:not([value="custom"])')
    radio.click()
    await flush()
    expect(saved().cases).toEqual([])
    expect(root.querySelector('.iv-summary')).toBeNull()
    await click('发送回答')
    expect(saved().cases).toEqual([])
    await answer('查询北区、巴厘岛新品培训，只查一次')
    await answer('从2026-10-20到2026-10-01')
    expect(root.querySelector('.iv-summary')).toBeNull()
    expect(saved().cases).toEqual([])
    await answer('日期改成2026-10-01到2026-10-31')
    expect(element('.iv-summary').textContent).toContain('北区、巴厘岛')
    await settle()
    expect(saved().cases).toEqual([])
    await click('确认，开始查询')
    await settle()
    expect(current()).toMatchObject({
      phase: 'reported',
      authorized: false,
      regions: ['北区', '巴厘岛'],
      startsOn: '2026-10-01',
      endsOn: '2026-10-31'
    })
    expect(current().question).toContain('日期改成')
  })

  it.each([
    ['查询南区本周新品培训，只查一次', '确认，开始查询', false, false],
    [
      '查询南区新品培训，从2026-10-01到2026-10-31，每天09:00定时查询，不提醒不汇报不升级',
      '确认，创建定时任务',
      true,
      false
    ],
    [
      '查询南区新品培训，从2026-10-01到2026-10-31，每天09:00定时查询，每轮飞书汇报给我，不提醒不升级',
      '确认，创建定时任务',
      true,
      true
    ]
  ])('工具分流：%s', async (question, confirm, scheduled, report) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('演示不应联网'))
    await submit(question as string)
    expect(saved().cases).toEqual([])
    await click(confirm as string)
    await settle()
    expect(current()).toMatchObject({
      phase: scheduled ? 'watching' : 'reported',
      authorized: scheduled,
      toolPlan: {
        scheduled,
        reportToCreator: report,
        remindEmployees: false,
        escalateToCreator: false
      }
    })
    expect(current().trace?.some((event) => event.title === 'feishu.report')).toBe(report)
    expect(notices().every((receipt) => receipt.kind === 'report')).toBe(true)
    if (scheduled) {
      await click('返回初始页')
      await click(current().title)
      await settle()
      await advance()
      expect(current().round).toBe(1)
      expect(notices().filter((receipt) => receipt.kind === 'report')).toHaveLength(report ? 2 : 0)
    }
    expect(
      current().trace?.some((event) => ['employee.remind', 'feishu.escalate'].includes(event.title))
    ).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('进入详情立即逐条回放，超过20秒后仍不新增检查或通知', async () => {
    const original = await openSeed()
    expect(root.querySelectorAll('.live-event')).toHaveLength(1)
    expect(root.textContent).toContain('最近一轮回放')
    const playbackMs =
      (latestRoundEvents(original.trace!, original.round).length - 1) * DEMO_STEP_MS
    await vi.advanceTimersByTimeAsync(playbackMs)
    await flush()
    expect(current()).toEqual(original)
    expect(notices()).toEqual(notices(original))
    await vi.advanceTimersByTimeAsync(DEMO_TRIGGER_SECONDS * 1000)
    await flush()
    expect(element('.iv-active-task').getAttribute('aria-busy')).toBe('false')
    await vi.advanceTimersByTimeAsync(180_000)
    await flush()
    expect(current()).toEqual(original)
    expect(notices()).toEqual(notices(original))
    expect(root.querySelectorAll('.live-event')).toHaveLength(
      latestRoundEvents(original.trace!, original.round).length
    )
  })

  it('暂停监督阻止自动与手动推进，恢复后可继续', async () => {
    await openSeed()
    await settle()
    await click('暂停任务')
    const paused = current()
    await taskAction('advance')
    await vi.advanceTimersByTimeAsync(120_000)
    await flush()
    expect(current()).toEqual(paused)
    await click('恢复任务')
    const resumed = current()
    await vi.advanceTimersByTimeAsync(120_000)
    await flush()
    expect(current()).toEqual(resumed)
    await advance()
    expect(current().round).toBe(paused.round + 1)
  })

  it('只读仅回放，无操作开关，不推进模型', async () => {
    const before = await openSeed(true)
    expect(root.querySelectorAll('.live-event')).toHaveLength(1)
    expect(root.querySelector('[role="switch"]')).toBeNull()
    expect(
      Array.from(root.querySelectorAll('button')).some((b) => b.textContent?.includes('立即复查'))
    ).toBe(false)
    await vi.advanceTimersByTimeAsync(180_000)
    await flush()
    expect(root.querySelectorAll('.live-event').length).toBeGreaterThan(1)
    expect(current()).toEqual(before)
  })

  it('离开详情停止未来调度，但已启动的一轮允许完成', async () => {
    const before = await openSeed()
    await settle()
    await taskAction('advance')
    expect(element('.iv-active-task').getAttribute('aria-busy')).toBe('true')
    await click('返回初始页')
    await settle()
    expect(current().round).toBe(before.round + 1)
    const completed = current()
    await vi.advanceTimersByTimeAsync(180_000)
    await flush()
    expect(current()).toEqual(completed)
    expect(root.querySelector('.inspection-home')).not.toBeNull()
  })

  it('回放中离开或隐藏标签页不会新增轮次', async () => {
    const before = await openSeed()
    await click('返回初始页')
    await vi.advanceTimersByTimeAsync(100_000)
    await flush()
    expect(current()).toEqual(before)
    await click(before.title)
    await settle()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    await vi.advanceTimersByTimeAsync(100_000)
    await flush()
    expect(current()).toEqual(before)
  })

  it('旧无toolPlan三次提醒后不升级，第四轮升级，第五轮完成后停止自动执行', async () => {
    await openSeed(false, 'third-reminder')
    expect(current().toolPlan).toBeUndefined()
    expect(notices().filter((r) => r.kind === 'escalation')).toHaveLength(0)
    await settle()
    await advance()
    expect(current().round).toBe(4)
    expect(notices().filter((r) => r.kind === 'escalation')).toHaveLength(1)
    await advance()
    expect(current()).toMatchObject({ round: 5, phase: 'finished' })
    const finished = current()
    await vi.advanceTimersByTimeAsync(180_000)
    await flush()
    expect(current()).toEqual(finished)
  })

  it('新连续三轮计划第三轮升级，非提醒三次后的第四轮', async () => {
    await submit(
      '监督南区新品培训，从2026-10-01到2026-10-31，每天09:00查询，未达标提醒本人，连续3轮未达标飞书通知我，全员达标后停止'
    )
    await click('确认，创建监督任务')
    await settle()
    await click('返回初始页')
    await click(current().title)
    await settle()
    for (let round = 1; round <= 3; round++) {
      await advance()
      expect(current().round).toBe(round)
      expect(notices().filter((r) => r.kind === 'escalation')).toHaveLength(round === 3 ? 1 : 0)
    }
  })

  it('只读不能最终授权监督，可修改为单次查询；修改期间不建任务', async () => {
    app?.unmount()
    await mount(true)
    await click('新建任务')
    await submit('监督南区新品培训，从2026-10-01到2026-10-31，每天09:00提醒未达标员工')
    expect(button('确认，创建监督任务').disabled).toBe(true)
    await click('确认，创建监督任务')
    await settle()
    expect(saved().cases).toEqual([])
    await click('补充或修改需求')
    await answer('改为只查询一次')
    expect(saved().cases).toEqual([])
    await click('确认，开始查询')
    await settle()
    expect(current()).toMatchObject({ phase: 'reported', authorized: false })
    expect(notices()).toEqual([])
  })

  it('没有自动调度开关，等待再久也不推进', async () => {
    const before = await openSeed()
    expect(root.querySelector('[role="switch"]')).toBeNull()
    await vi.advanceTimersByTimeAsync(180_000)
    await flush()
    expect(current()).toEqual(before)
    expect(root.querySelectorAll('.live-event')).toHaveLength(
      latestRoundEvents(before.trace!, before.round).length
    )
    await advance()
    expect(current().round).toBe(before.round + 1)
  })

  it('材料筛选和切换不改变固定左右布局及对话草稿', async () => {
    await submit('查询南区本周新品培训，只查一次')
    await click('确认，开始查询')
    await settle()
    const before = current()
    const left = element('.iv-conversation'),
      right = element('.iv-materials')
    await setValue('#iv-message-input', '这些人如何补学？')
    await click('查看 30 人的依据', left)
    expect(right.querySelectorAll('.iv-evidence-table tbody tr')).toHaveLength(30)
    await click('未达标', element('.iv-evidence-filters'))
    expect(right.querySelectorAll('.iv-evidence-table tbody tr')).toHaveLength(6)
    await click('核查过程', right)
    await click('巡检简报', right)
    expect(current()).toEqual(before)
    expect(element<HTMLTextAreaElement>('#iv-message-input').value).toBe('这些人如何补学？')
    expect(Array.from(element('.iv-panels').children)).toEqual([left, right])
  })

  it('取消执行不补授权，刷新进行中的任务恢复为取消', async () => {
    await submit('查询南区本周新品培训，只查一次')
    await click('确认，开始查询')
    await click('停止')
    await settle()
    expect(current()).toMatchObject({ phase: 'cancelled', authorized: false })
    expect(notices()).toEqual([])
    await click('重新查询')
    await click('确认，开始查询')
    const id = current().id
    app?.unmount()
    await mount()
    await settle()
    expect(saved().cases.find((item) => item.id === id)).toMatchObject({
      phase: 'cancelled',
      authorized: false
    })
  })
})
