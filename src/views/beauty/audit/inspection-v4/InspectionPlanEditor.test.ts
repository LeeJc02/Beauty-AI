import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import InspectionPlanEditor from './InspectionPlanEditor.vue'
let app: App | undefined
let root: HTMLElement
async function mount(modelValue = '# 执行计划\n\n核验课件时长', extra = {}) {
  const state = reactive({ modelValue, disabled: false, streaming: false, ...extra })
  const changes: string[] = []
  root = document.createElement('div')
  document.body.append(root)
  app = createApp({
    render: () =>
      h(InspectionPlanEditor, {
        ...state,
        'onUpdate:modelValue': (value: string) => {
          changes.push(value)
          state.modelValue = value
        }
      })
  })
  app.mount(root)
  await nextTick()
  return { state, changes }
}
afterEach(() => {
  app?.unmount()
  root?.remove()
})
describe('InspectionPlanEditor 直接富文本编辑', () => {
  it('无工具栏源码或嵌套卡，原位编辑保留标题与光标节点', async () => {
    const { state } = await mount()
    expect(root.querySelector('button, textarea, .plan-editor__tools')).toBeNull()
    const heading = root.querySelector('h1')!
    heading.textContent = '更新计划'
    root
      .querySelector('.plan-editor__document')!
      .dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(state.modelValue).toBe('# 更新计划\n\n核验课件时长')
    expect(root.querySelector('h1')).toBe(heading)
  })
  it.each(['disabled', 'streaming'] as const)('%s 时不可编辑但外部文本继续更新', async (flag) => {
    const { state, changes } = await mount('初始', { [flag]: true })
    const editor = root.querySelector('.plan-editor__document')!
    expect(editor.getAttribute('contenteditable')).toBe('false')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    expect(changes).toEqual([])
    state.modelValue = '# 新计划\n\n持续到达'
    await nextTick()
    expect(root.querySelector('h1')?.textContent).toBe('新计划')
  })
  it('安全渲染 HTML 和危险链接', async () => {
    await mount(
      '<img src=x onerror=alert(1)>\n\n[危险](javascript:alert(1)) [资料](https://example.com)'
    )
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelectorAll('a')).toHaveLength(1)
    expect(root.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer')
  })
  it('粘贴保留标题强调但移除脚本、图片和危险链接', async () => {
    const { state } = await mount('')
    const editor = root.querySelector('.plan-editor__document')!
    const range = document.createRange()
    range.selectNodeContents(editor)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type: string) =>
          type === 'text/html'
            ? '<h2 onclick="evil()">范围</h2><p><b>新品</b><script>evil()</script><img src=x onerror=evil()><a href="javascript:evil()">危险</a></p>'
            : ''
      }
    })
    editor.dispatchEvent(event)
    await nextTick()
    expect(state.modelValue).toContain('## 范围')
    expect(state.modelValue).toContain('**新品**')
    expect(editor.querySelector('script,img,[onclick],a')).toBeNull()
  })
})
