import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, reactive, type App } from 'vue'
import { readFileSync } from 'node:fs'
import UnifiedInspectionSession from './UnifiedInspectionSession.vue'
import { parsePlanMarkdown } from './markdown'
import {
  createCoursewareInspectionRuntime,
  type CoursewareInspectionRuntime
} from '@/beauty/lib/coursewareInspection'
const { readPage } = vi.hoisted(() => ({ readPage: vi.fn() }))
vi.mock('@/api/courseware', () => ({ CoursewareApi: { getCoursewarePage: readPage } }))
vi.mock('@/beauty/lib/coursewareInspectionRuntime', () => ({
  useCoursewareInspectionRuntime: () => runtime
}))
let runtime: CoursewareInspectionRuntime
let identity: { userId: number; role: string }
let app: App | undefined
let root: HTMLElement
async function mount(extras = {}) {
  app = createApp(UnifiedInspectionSession, extras)
  app.mount(root)
  await nextTick()
}
async function finishStream() {
  await vi.advanceTimersByTimeAsync(8000)
  await nextTick()
}
const button = (label: string) => {
  const found = Array.from(root.querySelectorAll('button')).find((item) =>
    item.textContent?.trim().includes(label)
  )
  expect(found, `找不到按钮 ${label}`).toBeTruthy()
  return found!
}
async function click(label: string) {
  button(label).click()
  await nextTick()
  await finishStream()
}
async function send(text: string) {
  const input = root.querySelector('textarea')!
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  await click('发送')
}
function draft(value: string) {
  const editor = root.querySelector<HTMLElement>('.plan-editor__document')!
  editor.innerHTML = parsePlanMarkdown(value)
    .map((block) => block.html)
    .join('')
  editor.dispatchEvent(new Event('input', { bubbles: true }))
}
const request = '持续监督以后新课件预计学习时长5到10分钟，不合规提醒本人，连续3次汇报'
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  identity = reactive({ userId: 7, role: 'trainer' })
  runtime = createCoursewareInspectionRuntime({ identity: () => identity })
  readPage.mockReset().mockResolvedValue({
    list: [
      {
        id: 1,
        title: '新品培训',
        status: 20,
        previewUrl: '/courseware/1',
        estimatedDurationSeconds: 360
      }
    ],
    total: 1
  })
  root = document.createElement('div')
  document.body.appendChild(root)
})
afterEach(() => {
  app?.unmount()
  root.remove()
  runtime.dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
describe('统一交互工作区仅新建编辑计划', () => {
  it('四种入口与固定底部输入，交换保留偏好，无结果标签', async () => {
    await mount()
    expect(root.querySelectorAll('.is-suggestions button')).toHaveLength(4)
    expect(root.querySelector('.is-result-tabs')).toBeNull()
    expect(root.querySelector('.is-composer textarea')).not.toBeNull()
    root.querySelector<HTMLButtonElement>('[aria-label="交换左右面板"]')!.click()
    await nextTick()
    expect(root.querySelectorAll('.is-panel.is-swapped')).toHaveLength(2)
    expect(localStorage.getItem('inspection-panels-swapped')).toBe('true')
  })
  it('多轮澄清逐步输出已知、待确认、依据，保留每轮摘要且不取数据', async () => {
    await mount()
    const input = root.querySelector('textarea')!
    input.value = '查一下南区李欣的新品培训是否达标'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    button('发送').click()
    await nextTick()
    expect(input.disabled).toBe(true)
    expect(root.querySelector('.is-plan-confirmation')?.textContent).toContain('正在整理需求')
    expect(root.querySelector('.plan-editor')).toBeNull()
    expect(root.querySelector('.is-empty-materials')?.textContent).toContain('时间')
    await vi.advanceTimersByTimeAsync(20)
    const partial = root.querySelector('.is-processing-summary p')?.textContent || ''
    expect(partial.length).toBeGreaterThan(0)
    expect(partial).not.toContain('依据')
    await finishStream()
    expect(root.querySelector('.is-processing-summary')?.textContent).toMatch(/已知.*待确认.*依据/s)
    const firstSummary = root.querySelector('.is-processing-summary')?.textContent || ''
    expect(firstSummary).toContain('未明确就可能把历史或未来数据混入')
    await click('本周')
    const secondSummary = root.querySelectorAll('.is-processing-summary')[1].textContent || ''
    expect(secondSummary).toMatch(/时间范围：\d{4}-\d{2}-\d{2} 至 \d{4}-\d{2}-\d{2}/)
    expect(secondSummary).toContain('Asia/Jakarta（UTC+7）')
    expect(secondSummary).toContain('不能用默认阈值')
    await click('完课且80分')
    const thirdSummary = root.querySelectorAll('.is-processing-summary')[2].textContent || ''
    expect(thirdSummary).toContain('要求完成课程；考核成绩至少 80 分')
    expect(thirdSummary).toContain('只查询，不提醒、不升级')
    expect(root.querySelectorAll('.is-processing-summary')).toHaveLength(3)
    expect(root.querySelector('.is-document')?.textContent).toMatch(/南区.*李欣.*新品/s)
    expect(readPage).not.toHaveBeenCalled()
  })
  it('详细计划真实逐段输出，确认仅位于交互卡', async () => {
    await mount()
    const input = root.querySelector('textarea')!
    input.value = request
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    button('发送').click()
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    const partial = root.querySelector('.plan-editor__document')?.textContent || ''
    expect(partial.length).toBeGreaterThan(0)
    expect(partial).not.toContain('交付与执行约定')
    expect(root.querySelector('.plan-editor__document')?.getAttribute('contenteditable')).toBe(
      'false'
    )
    await finishStream()
    expect(root.querySelector('.is-document')?.textContent).toContain('交付与执行约定')
    expect(root.querySelector('.is-conversation .is-plan-confirmation')).not.toBeNull()
    expect(root.querySelector('.is-materials button')).toBeNull()
    expect(button('确认，开始持续监督').disabled).toBe(false)
  })
  it.each(['once', 'continuous'] as const)('%s 确认后只通知父级转详情', async (mode) => {
    const onSaved = vi.fn()
    await mount({ onSaved })
    await send(mode === 'once' ? '查一下当前课件预计学习时长，5到10分钟合格' : request)
    await click(mode === 'once' ? '确认，开始查询' : '确认，开始持续监督')
    expect(runtime.tasks.value).toHaveLength(1)
    expect(onSaved).toHaveBeenCalledWith(runtime.tasks.value[0].id, mode)
    expect(root.querySelector('.is-result-tabs,.is-table-wrap')).toBeNull()
  })
  it('查询失败也保存真实失败结果并由父级详情展示', async () => {
    readPage.mockRejectedValue(new Error('network'))
    const onSaved = vi.fn()
    await mount({ onSaved })
    await send('查一下当前课件生成质量')
    await click('确认，开始查询')
    expect(runtime.tasks.value[0].queryResult?.status).toBe('error')
    expect(onSaved).toHaveBeenCalledWith(runtime.tasks.value[0].id, 'once')
  })
  it('查询在途禁止重复执行，卸载后异步完成不发送saved', async () => {
    let resolve!: (value: unknown) => void
    readPage.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const onSaved = vi.fn()
    await mount({ onSaved })
    await send('查一下当前课件生成质量')
    button('确认，开始查询').click()
    await nextTick()
    expect(root.querySelector('textarea')?.disabled).toBe(true)
    expect(button('正在执行…').disabled).toBe(true)
    button('正在执行…').click()
    await vi.advanceTimersByTimeAsync(1)
    expect(readPage).toHaveBeenCalledOnce()
    app?.unmount()
    app = undefined
    resolve({ list: [], total: 0 })
    await finishStream()
    expect(onSaved).not.toHaveBeenCalled()
  })
  it('只读角色允许查询但不创建监督', async () => {
    await mount({ readOnly: true })
    await send(request)
    expect(button('确认，开始持续监督').disabled).toBe(true)
    expect(root.querySelector('.plan-editor__document')?.getAttribute('contenteditable')).toBe(
      'false'
    )
    await send('改为只查一次当前课件')
    await click('确认，开始查询')
    expect(runtime.tasks.value[0].mode).toBe('once')
  })
  it('富文本修改须重新核对再人工确认，保存格式与更新标准', async () => {
    await mount()
    await send(request)
    const editor = root.querySelector<HTMLElement>('.plan-editor__document')!
    editor.innerHTML = editor.innerHTML
      .replace('任务计划', '新版任务计划')
      .replace('不超过 10 分钟', '不超过 <strong>20</strong> 分钟')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(button('核对计划修改')).toBeTruthy()
    expect(runtime.tasks.value).toHaveLength(0)
    await click('核对计划修改')
    expect(runtime.tasks.value).toHaveLength(0)
    await click('确认，开始持续监督')
    expect(runtime.tasks.value[0].maxDurationMinutes).toBe(20)
    expect(runtime.tasks.value[0].requestPlan?.planMarkdown).toContain('# 新版任务计划')
    expect(runtime.tasks.value[0].requestPlan?.planMarkdown).toContain('**20**')
  })
  it('纯格式修改不改变条件，但仍需确认', async () => {
    await mount()
    await send(request)
    const editor = root.querySelector<HTMLElement>('.plan-editor__document')!
    editor.innerHTML = editor.innerHTML.replace('不少于 5 分钟', '不少于 <em>5</em> 分钟')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await click('核对计划修改')
    expect(root.querySelector('.is-error')).toBeNull()
    await click('确认，开始持续监督')
    expect(runtime.tasks.value[0].minDurationMinutes).toBe(5)
  })
  it('仅删除业务条件不可绕过核对', async () => {
    await mount()
    await send(request)
    draft('# 任务计划')
    await nextTick()
    await click('核对计划修改')
    expect(root.querySelector('.is-error')?.textContent).toContain('明确要取消的条件')
    expect(runtime.tasks.value).toHaveLength(0)
  })
  it('编辑现有监督更新原任务；一次查询不停止原监督', async () => {
    const id = runtime.createTask({
      name: '课件监督',
      question: '持续监督以后课件时长',
      timeMode: 'ongoing',
      scope: 'current_account',
      minDurationMinutes: 5,
      maxDurationMinutes: 10,
      remind: true,
      reportRequested: true,
      confirmed: true
    })
    await mount({ task: runtime.tasks.value.find((task) => task.id === id), editing: true })
    await send('不超过20分钟')
    await click('确认，更新监督条件')
    expect(runtime.tasks.value).toHaveLength(1)
    expect(runtime.tasks.value[0].maxDurationMinutes).toBe(20)
    app?.unmount()
    await mount({ task: runtime.tasks.value[0], editing: true })
    await send('改为只查一次当前课件')
    expect(root.textContent).toContain('不会停止或修改原有监督任务')
    await click('确认，开始查询')
    expect(runtime.tasks.value).toHaveLength(2)
    expect(runtime.tasks.value.find((task) => task.id === id)?.enabled).toBe(true)
  })
  it.each(['查询课件生成情况', '持续关注新课件', '查询人员培训情况', '持续跟进培训达标'])(
    '入口 %s 提供自然复杂种子但仍需反问',
    async (label) => {
      await mount()
      await click(label)
      expect(root.querySelector('.is-message.user')?.textContent?.length).toBeGreaterThan(30)
      expect(root.querySelector('.is-choices')).not.toBeNull()
      expect(root.querySelector('.plan-editor')).toBeNull()
      expect(runtime.tasks.value).toHaveLength(0)
      expect(readPage).not.toHaveBeenCalled()
    }
  )
  it('标准数值与提醒升级只复述已明确条件，未授权时不猜测', async () => {
    await mount()
    await send('持续监督以后新课件预计学习时长5到10分钟')
    let summary = root.querySelectorAll('.is-processing-summary')[0].textContent || ''
    expect(summary).toContain('不少于 5 分钟')
    expect(summary).toContain('不超过 10 分钟')
    expect(summary).toContain('提醒与升级方式尚待确认')
    expect(summary).not.toContain('连续第三次')
    expect(summary).toContain('不等于已获得提醒或汇报授权')
    await send('不合规提醒本人，连续3次汇报')
    summary = root.querySelectorAll('.is-processing-summary')[1].textContent || ''
    expect(summary).toContain('未达标提醒本人')
    expect(summary).toContain('同人连续第三次未达标向任务创建人汇报')
  })
  it.each([
    ['账号', 'userId', 8],
    ['角色', 'role', 'manager']
  ] as const)('%s 切换清空新建草稿与计划，不能跨身份确认', async (_label, key, value) => {
    await mount()
    await send(request)
    const input = root.querySelector('textarea')!
    input.value = '尚未发送的私人备注'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    Object.assign(identity, { [key]: value })
    await nextTick()
    expect(input.value).toBe('')
    expect(
      root.querySelector('.plan-editor,.is-plan-confirmation,.is-processing-summary')
    ).toBeNull()
    expect(root.textContent).not.toContain('私人备注')
    expect(root.textContent).toContain('未确认的需求与计划已清空')
    expect(runtime.tasks.value).toHaveLength(0)
  })
  it('A→B→A 同步切换也取消流式与在途确认，不恢复旧计划', async () => {
    let resolve!: (value: unknown) => void
    readPage.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const onSaved = vi.fn()
    await mount({ onSaved })
    await send('查一下当前课件生成质量')
    button('确认，开始查询').click()
    await vi.advanceTimersByTimeAsync(1)
    identity.userId = 8
    identity.userId = 7
    await nextTick()
    resolve({ list: [], total: 0 })
    await finishStream()
    expect(onSaved).not.toHaveBeenCalled()
    expect(root.querySelector('.is-error,.is-plan-confirmation,.plan-editor')).toBeNull()
    expect(runtime.tasks.value).toHaveLength(0)
    const input = root.querySelector('textarea')!
    input.value = request
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    button('发送').click()
    await vi.advanceTimersByTimeAsync(20)
    identity.userId = 8
    identity.userId = 7
    await finishStream()
    expect(root.querySelector('.plan-editor,.is-processing-summary')).toBeNull()
    expect(input.disabled).toBe(false)
  })
  it('等宽平移与独立滚动布局保留', () => {
    const styles = readFileSync(
      'src/views/beauty/audit/inspection-v4/inspection-session.scss',
      'utf8'
    )
    expect(styles).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
    expect(styles).toContain('translateX(calc(100% + 20px))')
    expect(styles).toMatch(/\.is-composer\s*\{\s*flex:\s*0 0 auto/)
    expect(styles).toContain('prefers-reduced-motion')
  })
})
