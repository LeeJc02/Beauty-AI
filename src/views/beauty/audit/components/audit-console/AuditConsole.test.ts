import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import AuditConsole from '../AuditConsole.vue'
import { createInspectionState } from '@/beauty/lib/inspectionData'
import { inspectionDay, weekStart } from '@/beauty/lib/inspectionEngine'
import type { AuditRecord, AuditSchedule, InspectionActor } from '@/beauty/lib/inspectionTypes'

vi.mock('@/beauty/composables', () => ({ useBeautyI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../shared', () => ({ jakartaStamp: (value: string) => value }))
vi.mock('./AuditRegionChart.vue', () => ({
  default: defineComponent(() => () => h('div', '区域图表'))
}))
vi.mock('./AuditDayChart.vue', () => ({
  default: defineComponent(() => () => h('div', '每日图表'))
}))

let app: App
let root: HTMLElement
let records: AuditRecord[]
let schedules: AuditSchedule[]
let actor: InspectionActor

const click = async (text: string, within: ParentNode = root) => {
  const button = Array.from(within.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === text
  )
  expect(button, `找不到按钮：${text}`).toBeTruthy()
  button!.click()
  await nextTick()
}
const inputText = async (selector: string, value: string) => {
  const input = root.querySelector<HTMLInputElement>(selector)!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
const settle = async () => {
  await vi.runAllTimersAsync()
  await nextTick()
}
const clarify = async () => {
  for (let index = 0; index < 5; index++) {
    const skip = root.querySelector<HTMLButtonElement>('.audit-ask.is-active .audit-skip')
    if (!skip) break
    skip.click()
    await nextTick()
  }
}
const start = async (question = '本周全国全部品类全部方面的培训情况怎么样？') => {
  await inputText('#audit-entry-question', question)
  await click('开始审计')
  await clarify()
}
const finish = async () => {
  await click('确认并开始审查')
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('scrollTo', vi.fn())
  HTMLElement.prototype.scrollTo = vi.fn()
  records = []
  schedules = []
  root = document.createElement('div')
  document.body.appendChild(root)
  const today = inspectionDay()
  actor = { id: 'hq', name: '总部培训师', hq: true, roleLabel: 'HQ Trainer' }
  app = createApp(AuditConsole, {
    state: createInspectionState(),
    actor,
    today,
    week: weekStart(today),
    onSaveAuditRecord: (record: AuditRecord) => records.push(record),
    onSaveAuditSchedule: (schedule: AuditSchedule) => schedules.push(schedule)
  })
  app.component('Icon', { render: () => h('span') })
  app.mount(root)
})
afterEach(() => {
  app.unmount()
  root.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('数据审查交互与产物分区', () => {
  it('requires final scope confirmation before collecting data', async () => {
    await start()
    expect(root.querySelector('.audit-confirm-panel')).not.toBeNull()
    expect(root.querySelector('.studio__draft .audit-trail')).toBeNull()
    expect(root.querySelector('.studio__draft .audit-rail-block')).toBeNull()
    await settle()
    expect(root.querySelector('.audit-card--report')).toBeNull()
    await finish()
    expect(root.querySelector('.studio__draft .audit-card--report')).not.toBeNull()
    expect(root.querySelector('.studio__conversation .audit-card--report')).toBeNull()
    expect(root.querySelector('.studio__conversation .audit-trail')).toBeNull()
    expect(root.querySelector('.studio__swap-panels')).toBeNull()
  })

  it('keeps report actions on the left and receipts on the right without duplicate saves', async () => {
    await start()
    await finish()
    const left = root.querySelector('.studio__conversation')!
    const right = root.querySelector('.studio__draft')!
    expect(right.textContent).not.toContain('保存审计记录')
    await click('保存审计记录', left)
    await settle()
    expect(records).toHaveLength(1)
    expect(records[0].taskCount).toBeGreaterThan(0)
    const savedButton = Array.from(left.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('已保存本地记录')
    )!
    expect(savedButton.disabled).toBe(true)
    await inputText('.audit-input', '把结论保存成审计记录')
    await click('发送')
    await settle()
    expect(records).toHaveLength(1)
    await click('保存每周一定时条件', left)
    await settle()
    expect(schedules).toHaveLength(1)
    const processTab = right.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]
    processTab.click()
    await nextTick()
    expect(right.querySelectorAll('.audit-trail')).toHaveLength(3)
    expect(right.textContent).toContain('操作回执')
  })

  it('clears previous artifacts and saved status before confirming a new query', async () => {
    await start()
    await finish()
    await click('保存审计记录')
    await settle()
    await inputText('.audit-input', '本周南区全部品类的工时压力怎么样？')
    await click('发送')
    await clarify()
    expect(root.querySelector('.studio__draft .audit-trail')).toBeNull()
    expect(root.querySelector('.studio__draft .audit-card--report')).toBeNull()
    expect(root.querySelector('.audit-report-controls')).toBeNull()
    await finish()
    expect(root.querySelector('.audit-report-controls')?.textContent).toContain('保存审计记录')
    await click('保存每周一定时条件')
    await settle()
    expect(schedules[0].scopeLabel).toContain('南')
  })

  it('does not create a report or schedule from an action-only initial request', async () => {
    await start('每周一自动审计')
    await settle()
    expect(root.textContent).toContain('请先完成一次审查')
    expect(root.querySelector('.audit-card--report')).toBeNull()
    expect(records).toHaveLength(0)
    expect(schedules).toHaveLength(0)
  })

  it('rejects out-of-scope queries without displaying confirmed scope', async () => {
    actor.hq = false
    actor.regionId = 'south'
    await start('本周北区全部品类的培训情况怎么样？')
    await settle()
    expect(root.textContent).toContain('范围不可访问，未取数')
    expect(root.querySelector('.studio__draft .audit-rail-block')).toBeNull()
    expect(root.querySelector('.audit-card--report')).toBeNull()
  })

  it('does not silently save a different or unauthorized region from an action request', async () => {
    actor.hq = false
    actor.regionId = 'south'
    await start('本周南区全部品类全部方面的培训情况怎么样？')
    await finish()
    await inputText('.audit-input', '每周一自动审计北区')
    await click('发送')
    await settle()
    expect(schedules).toHaveLength(0)
    expect(root.textContent).toContain('未保存任何记录或定时条件')
    await inputText('.audit-input', '保存全国定时计划')
    await click('发送')
    await settle()
    expect(schedules).toHaveLength(0)
    expect(root.textContent).toContain('操作未执行')
  })

  it('preserves expanded evidence when switching artifact tabs', async () => {
    await start()
    await finish()
    const right = root.querySelector('.studio__draft')!
    const toggle = Array.from(right.querySelectorAll<HTMLButtonElement>('.audit-toggle')).find(
      (button) => button.textContent?.includes('汇报背后的数据')
    )!
    toggle.click()
    await nextTick()
    expect(right.querySelector('.audit-card--report .audit-detail')).not.toBeNull()
    const tabs = right.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[1].click()
    await nextTick()
    const dataButton = right.querySelector<HTMLButtonElement>('.audit-step__more')!
    dataButton.click()
    await nextTick()
    tabs[0].click()
    await nextTick()
    expect(right.querySelector('.audit-card--report .audit-detail')).not.toBeNull()
    tabs[1].click()
    await nextTick()
    expect(right.querySelector('.audit-trail .audit-detail')).not.toBeNull()
  })
})
