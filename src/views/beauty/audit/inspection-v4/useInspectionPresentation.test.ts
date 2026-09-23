import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, KeepAlive, nextTick, ref, type App } from 'vue'
import { useInspectionPresentation } from './useInspectionPresentation'

let app: App | undefined
let root: HTMLElement
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  root = document.createElement('div')
  document.body.append(root)
})
afterEach(() => {
  app?.unmount()
  root.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
describe('可见业务进展订阅', () => {
  it('进入立即推进，暂停/离开/隐藏立即清理，恢复只有一个定时器', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    const set = vi.spyOn(globalThis, 'setTimeout')
    const id = ref<string | undefined>('one')
    const advance = vi.fn(() => true)
    app = createApp(
      defineComponent({
        setup() {
          useInspectionPresentation(() => id.value, advance)
          return () => h('div')
        }
      })
    )
    app.mount(root)
    expect(advance).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1600)
    expect(advance).toHaveBeenCalledTimes(2)
    id.value = undefined
    await nextTick()
    expect(clear).toHaveBeenLastCalledWith(set.mock.results.at(-1)?.value)
    vi.advanceTimersByTime(10000)
    expect(advance).toHaveBeenCalledTimes(2)
    id.value = 'one'
    expect(advance).toHaveBeenCalledTimes(3)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(10000)
    expect(advance).toHaveBeenCalledTimes(3)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(advance).toHaveBeenCalledTimes(4)
    expect(vi.getTimerCount()).toBe(1)
    id.value = 'two'
    expect(advance).toHaveBeenLastCalledWith('two')
    expect(vi.getTimerCount()).toBe(1)
    app.unmount()
    app = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
  it('KeepAlive失活停止，激活继续；首次隐藏不推进', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const active = ref(true)
    const advance = vi.fn(() => true)
    const child = defineComponent({
      setup() {
        useInspectionPresentation(() => 'one', advance)
        return () => h('div')
      }
    })
    app = createApp({
      setup: () => () => h(KeepAlive, null, { default: () => (active.value ? h(child) : null) })
    })
    app.mount(root)
    expect(advance).not.toHaveBeenCalled()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(advance).toHaveBeenCalledTimes(1)
    active.value = false
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(5000)
    expect(advance).toHaveBeenCalledTimes(1)
    active.value = true
    await nextTick()
    expect(advance).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)
  })
})
