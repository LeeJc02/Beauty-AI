import { afterEach, expect, test } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import QueryClarification from './QueryClarification.vue'
import type { QueryConfig } from './taskFlow'
let app: App | undefined
let root: HTMLElement
const payloads: QueryConfig[] = []
afterEach(() => {
  app?.unmount()
  root?.remove()
  payloads.length = 0
})
async function mount(question = '查看当前状态', readOnly = false, initialConfig?: QueryConfig) {
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp(QueryClarification, {
    question,
    readOnly,
    initialConfig,
    onConfirm: (value: QueryConfig) => payloads.push(value)
  })
  app.mount(root)
  await nextTick()
}
async function click(text: string) {
  const button = Array.from(root.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === text
  )
  expect(button).toBeTruthy()
  button!.click()
  await nextTick()
}
async function select(label: string) {
  const option = Array.from(root.querySelectorAll('label.iv-option')).find(
    (node) => node.querySelector('strong')?.textContent === label
  )
  expect(option).toBeTruthy()
  const input = option!.querySelector<HTMLInputElement>('input')!
  input.click()
  await nextTick()
  expect(option!.classList.contains('selected')).toBe(true)
  expect(payloads).toHaveLength(0)
  await click('发送回答')
}
test('radio 卡片多轮、回执、折叠历史，必须手动最终确认', async () => {
  await mount()
  expect(root.textContent).toContain('非真实 LLM')
  for (const label of [
    '培训达标',
    '新品',
    '全国 / 全部地区',
    '未来一个月',
    '监督 + 员工提醒 + 异常升级',
    '每天 09:00'
  ]) {
    expect(root.textContent).toContain('自己输入')
    await select(label)
  }
  expect(root.querySelector('details')?.open).toBe(false)
  expect(root.textContent).toContain('已记录你的回答')
  expect(root.textContent).toContain('员工提醒')
  expect(root.textContent).toContain('第 3 轮')
  expect(payloads).toHaveLength(0)
  await click('确认，创建监督任务')
  expect(payloads).toHaveLength(1)
  expect(payloads[0].toolPlan?.cadenceSource).toBe('recommended')
  expect(payloads[0].clarificationSummary).toContain('查看当前状态')
})
test('自由输入补齐多个字段，修改后仍须最终确认', async () => {
  await mount()
  root.querySelector<HTMLInputElement>('input[value="custom"]')!.click()
  await nextTick()
  const input = root.querySelector('textarea')!
  input.value = '查南区新品培训，本周只查询一次'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  await click('发送回答')
  await click('补充或修改需求')
  const edit = root.querySelector('textarea')!
  edit.value = '地区改成北区'
  edit.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  await click('发送回答')
  expect(payloads).toHaveLength(0)
  await click('确认，开始查询')
  expect(payloads[0].regions).toEqual(['北区'])
})
test('只读禁止定时及单次外发，只允许纯查询', async () => {
  await mount('查南区新品培训，本周只查询一次，飞书汇报', true)
  expect(root.textContent).toContain('不能创建定时任务或启用任何外发动作')
  await click('确认，开始查询')
  expect(payloads).toHaveLength(0)
  await click('补充或修改需求')
  const edit = root.querySelector('textarea')!
  edit.value = '只查询一次'
  edit.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  await click('发送回答')
  await click('确认，开始查询')
  expect(payloads).toHaveLength(1)
})
test('修改预填精确结构化条件而非重解析旧问题，保留工具约定且不修改传入配置', async () => {
  const initial: QueryConfig = {
    scenario: 'workload',
    regions: ['巴厘岛', '北区'],
    product: '特殊配方产品',
    startsOn: '2026-10-01',
    endsOn: '2026-10-31',
    mode: 'scheduled',
    cadence: '每3天 09:00',
    escalationRecipient: '计划创建人',
    toolPlan: {
      scheduled: true,
      remindEmployees: false,
      reportToCreator: true,
      escalateToCreator: false,
      escalationRule: 'after-reminders',
      escalationThreshold: 5,
      stopWhenQualified: false,
      cadenceSource: 'recommended'
    }
  }
  const before = JSON.parse(JSON.stringify(initial))
  await mount('原问题并未说明参数', false, initial)
  expect(root.querySelector('.iv-summary')?.textContent).toContain('特殊配方产品')
  expect(root.querySelector('.iv-summary')?.textContent).toContain('助手推荐')
  expect(payloads).toEqual([])
  await click('补充或修改需求')
  const input = root.querySelector('textarea')!
  input.value = '产品是新品'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  await click('发送回答')
  expect(initial).toEqual(before)
  expect(payloads).toEqual([])
  await click('确认，创建定时任务')
  expect(payloads[0]).toMatchObject({ ...initial, product: '新品' })
})

test('定时查询无监督动作使用定时任务确认按钮', async () => {
  await mount('查南区新品培训，本周每天9点定时查询')
  expect(root.textContent).toContain('确认，创建定时任务')
  expect(payloads).toHaveLength(0)
  await click('确认，创建定时任务')
  expect(payloads[0].toolPlan?.remindEmployees).toBe(false)
})
