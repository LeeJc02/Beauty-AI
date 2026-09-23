import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import InspectionWorkspace from './InspectionWorkspace.vue'
import InspectionHome from './InspectionHome.vue'
import { createCase, type InspectionCase } from './model'
import { seedTasks } from './taskFlow'

const KEY = 'beauty-ai:inspection-v4:inspection-entry-test'
let app: App | undefined
let root: HTMLElement
const flush = async () => {
  await nextTick()
  await vi.advanceTimersByTimeAsync(40)
  await nextTick()
}
const mount = async () => {
  app = createApp(InspectionWorkspace, { storageScope: 'inspection-entry-test' })
  app.mount(root)
  await flush()
}
const reload = async () => {
  app?.unmount()
  await mount()
}
const element = <T extends HTMLElement = HTMLElement>(
  selector: string,
  within: ParentNode = root
): T => {
  const node = within.querySelector<T>(selector)
  expect(node, `找不到元素：${selector}`).not.toBeNull()
  return node!
}
const button = (text: string, within: ParentNode = root): HTMLButtonElement => {
  const node = Array.from(within.querySelectorAll<HTMLButtonElement>('button')).find((item) => {
    const label = item.cloneNode(true) as HTMLElement
    label.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove())
    return label.textContent?.replace(/\s+/g, ' ').trim().startsWith(text)
  })
  expect(node, `找不到按钮：${text}`).toBeTruthy()
  return node!
}
const click = async (text: string, within: ParentNode = root) => {
  button(text, within).click()
  await flush()
}
const setValue = async (selector: string, value: string) => {
  const control = element<HTMLInputElement | HTMLTextAreaElement>(selector)
  control.value = value
  control.dispatchEvent(new Event('input', { bubbles: true }))
  await flush()
}
const settle = async () => {
  await vi.advanceTimersByTimeAsync(12_000)
  await flush()
}
const saved = (): {
  version: number
  demoVersion: number
  selectedId: string
  cases: InspectionCase[]
} => JSON.parse(localStorage.getItem(KEY)!)
const current = () => saved().cases.find((item) => item.id === saved().selectedId)!
const begin = async (question = '查询南区本周新品培训，只查一次') => {
  await click('新建任务')
  await setValue('#iv-message-input', question)
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
const report = async () => {
  await begin()
  await click('确认，开始查询')
  await settle()
}
beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
  })
  localStorage.removeItem(KEY)
  root = document.createElement('div')
  document.body.appendChild(root)
  await mount()
})
afterEach(() => {
  app?.unmount()
  app = undefined
  root.remove()
  localStorage.removeItem(KEY)
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('InspectionEntry 自然语言入口与历史路由', () => {
  it('首页九个活跃、两个归档，暂停与等待复查不误判完成', async () => {
    expect(root.querySelector('.inspection-home')).not.toBeNull()
    expect(root.querySelector('.iv-panels')).toBeNull()
    expect(button('正在执行').textContent).toMatch(/正在执行\s*9/)
    expect(button('已完成归档').textContent).toMatch(/已完成归档\s*2/)
    expect(root.querySelectorAll('.home-task')).toHaveLength(9)
    expect(root.textContent).toContain('每周一 09:00')
    await click('已完成归档')
    expect(root.querySelectorAll('.home-task')).toHaveLength(2)
    expect(element('.home-task').textContent).toContain('已复查 5 轮')
    expect(element('.home-task').textContent).toContain('已归档，不再复查')
  })

  it('分类切换保留搜索，空结果可清除，按地区/产品查找', async () => {
    await setValue('[aria-label="搜索巡检任务"]', '敏感肌')
    expect(root.querySelectorAll('.home-task')).toHaveLength(2)
    await click('已完成归档')
    expect(element('.home-empty').textContent).toContain('没有找到匹配的任务')
    await click('清除搜索')
    expect(element<HTMLInputElement>('[aria-label="搜索巡检任务"]').value).toBe('')
    expect(root.querySelectorAll('.home-task')).toHaveLength(2)
    await setValue('[aria-label="搜索巡检任务"]', '东区')
    expect(root.querySelectorAll('.home-task')).toHaveLength(1)
    await click('正在执行')
    await setValue('[aria-label="搜索巡检任务"]', '不存在的产品')
    expect(root.querySelectorAll('.home-task')).toHaveLength(0)
    await click('清除搜索')
    expect(root.querySelectorAll('.home-task')).toHaveLength(9)
  })

  it('无任务提供真实空状态与新建事件', async () => {
    app?.unmount()
    const onNew = vi.fn()
    app = createApp(InspectionHome, { cases: [], onNew })
    app.mount(root)
    await flush()
    expect(element('.home-empty').textContent).toContain('还没有活动任务')
    await click('新建任务', element('.home-empty'))
    expect(onNew).toHaveBeenCalledOnce()
    await click('已完成归档')
    expect(element('.home-empty').textContent).toContain('还没有已归档的任务')
    await click('查看正在执行的任务')
    expect(button('正在执行').getAttribute('aria-pressed')).toBe('true')
  })

  it('仅已授权 watching/paused 活跃，报告/结束/取消归档', async () => {
    app?.unmount()
    const cases = (
      ['reported', 'paused', 'cancelled', 'finished', 'running', 'ready'] as const
    ).map((phase) => ({ ...createCase('南区培训'), phase, authorized: phase === 'paused' }))
    app = createApp(InspectionHome, { cases })
    app.mount(root)
    await flush()
    expect(root.querySelectorAll('.home-task')).toHaveLength(1)
    await click('已完成归档')
    expect(root.querySelectorAll('.home-task')).toHaveLength(3)
  })

  it.each(['盯住新品培训', '看看本周有什么问题', '检查培训负担'])(
    '示例「%s」仅填主输入，不自动发起澄清或查询',
    async (example) => {
      const before = saved().cases
      await click('新建任务')
      await click(example, element('.iv-examples'))
      expect(element<HTMLTextAreaElement>('#iv-message-input').value.length).toBeGreaterThan(10)
      expect(root.querySelector('.iv-query')).toBeNull()
      await settle()
      expect(saved().cases).toEqual(before)
      element<HTMLFormElement>('.iv-composer').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
      await flush()
      expect(root.querySelector('.iv-query')).not.toBeNull()
      expect(root.querySelector('.iv-working')).toBeNull()
      expect(saved().cases).toEqual(before)
    }
  )

  it('缺少条件逐次自然语言反问，确认前无任务；取消不产生工具记录', async () => {
    const before = saved().cases
    await begin('帮我看看情况')
    expect(root.querySelectorAll('.iv-query input[type="radio"]').length).toBeGreaterThan(1)
    await answer('查南区新品培训')
    expect(root.querySelector('[aria-label="回答澄清问题"]')).toBeNull()
    expect(root.querySelector('.iv-query input[type="radio"][value="custom"]')).not.toBeNull()
    await answer('本周，只查一次')
    expect(element('.iv-summary').textContent).toContain('2026-09-14')
    expect(button('确认，开始查询').disabled).toBe(false)
    expect(saved().cases).toEqual(before)
    expect(root.textContent).not.toContain('training_records.query')
    await click('取消', element('.iv-query'))
    await settle()
    expect(root.querySelector('.iv-query')).toBeNull()
    expect(saved().cases).toEqual(before)
  })

  it('执行中返回首页不中止，完成问答从历史进入只读审计页', async () => {
    await begin()
    await click('确认，开始查询')
    const id = current().id
    await vi.advanceTimersByTimeAsync(900)
    await flush()
    expect(current().trace).toHaveLength(2)
    await click('返回初始页')
    await settle()
    expect(saved().cases.find((item) => item.id === id)?.phase).toBe('reported')
    await click('已完成归档')
    element<HTMLButtonElement>('.home-task').click()
    await flush()
    expect(current().id).toBe(id)
    expect(root.querySelector('.iv-task-detail')).not.toBeNull()
    expect(root.querySelector('.iv-composer')).toBeNull()
    await click('执行记录')
    expect(root.querySelectorAll('.iv-task-detail .iv-agent-event')).toHaveLength(5)
    expect(current().authorized).toBe(false)
  })

  it('查询归档刷新仍在首页，重新打开保留参数、人员与执行记录', async () => {
    await report()
    const before = current()
    await click('返回初始页')
    await reload()
    expect(root.querySelector('.inspection-home')).not.toBeNull()
    expect(button('已完成归档').textContent).toMatch(/已完成归档\s*3/)
    await click('已完成归档')
    element<HTMLButtonElement>('.home-task').click()
    await flush()
    expect(current()).toEqual(before)
    expect(root.textContent).toContain('已归档 · 只读')
    expect(root.querySelector('.iv-composer')).toBeNull()
    await click('执行记录')
    expect(root.querySelectorAll('.iv-task-detail .iv-agent-event')).toHaveLength(5)
    await click('人员明细')
    expect(root.querySelectorAll('.iv-task-detail tbody tr')).toHaveLength(30)
  })

  it('活跃历史进入记录页，暂停和恢复均不自行推进，重新打开记录不变', async () => {
    element<HTMLButtonElement>('.home-task').click()
    await flush()
    const id = current().id
    expect(root.querySelector('.iv-active-task')).not.toBeNull()
    expect(root.querySelector('[role="tab"]')).toBeNull()
    expect(root.querySelector('.iv-task-detail')).toBeNull()
    await settle()
    await click('暂停任务')
    expect(current().phase).toBe('paused')
    expect(root.querySelector('.controls')).toBeNull()
    const paused = current()
    await vi.advanceTimersByTimeAsync(20000)
    await settle()
    expect(current()).toEqual(paused)
    await click('恢复任务')
    const resumed = current()
    await vi.advanceTimersByTimeAsync(200_000)
    await settle()
    expect(current()).toEqual(resumed)
    expect(root.querySelector('.iv-active-task [role="switch"]')).toBeNull()
    await click('返回初始页')
    expect(button('正在执行').textContent).toMatch(/正在执行\s*9/)
    await click(saved().cases.find((item) => item.id === id)!.title)
    expect(root.querySelector('.iv-active-task')).not.toBeNull()
    expect(current()).toEqual(resumed)
  })

  it('到期旧记录只展示周期到期，不自动变更任务或新增提醒', async () => {
    const expired = saved().cases.find((item) => item.phase === 'watching')!
    expired.endsOn = expired.startsOn
    app?.unmount()
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, demoVersion: 3, cases: [expired], selectedId: '' })
    )
    await mount()
    await click(expired.title)
    const notices = expired.receipts.filter((item) =>
      ['reminder', 'escalation'].includes(item.kind)
    )
    await settle()
    await vi.advanceTimersByTimeAsync(20000)
    await settle()
    expect(current()).toEqual(expired)
    expect(element('.task-facts').textContent).toContain('周期已到期')
    expect(
      current().receipts.filter((item) => ['reminder', 'escalation'].includes(item.kind))
    ).toEqual(notices)
    expect(root.querySelector('.iv-active-task [role="switch"]')).toBeNull()
  })

  it.each([undefined, 2, 3])(
    '旧存储 demoVersion=%s 升级至4，原记录保留且刷新不重复补齐',
    async (demoVersion) => {
      const legacy =
        demoVersion === 3
          ? seedTasks().slice(0, 8)
          : demoVersion === 2
            ? seedTasks().slice(0, 4)
            : [createCase('旧记录南区培训')]
      app?.unmount()
      localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, demoVersion, cases: legacy, selectedId: legacy[0].id })
      )
      await mount()
      const migrated = saved()
      expect(migrated.demoVersion).toBe(4)
      expect(migrated.cases).toHaveLength(demoVersion === undefined ? 10 : 11)
      for (const item of legacy)
        expect(migrated.cases.find((candidate) => candidate.id === item.id)).toMatchObject(item)
      expect(
        new Set(migrated.cases.filter((item) => item.demoKey).map((item) => item.demoKey)).size
      ).toBe(7)
      await reload()
      expect(saved().cases).toEqual(migrated.cases)
      await reload()
      expect(saved().cases).toEqual(migrated.cases)
    }
  )

  it('seed 完成样本打开五轮结果，无继续复查或授权入口', async () => {
    await click('已完成归档')
    element<HTMLButtonElement>('.home-task').click()
    await flush()
    expect(current()).toMatchObject({ phase: 'finished', round: 5 })
    expect(element('.conclusion').textContent).toContain('全部达标')
    await click('执行记录')
    expect(element('.iv-task-detail').textContent).toContain('followup.preview')
    expect(root.querySelector('.execution-control')).toBeNull()
  })
})
