import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, reactive, type App } from 'vue'
import CoursewareStudio from '../components/CoursewareStudio.vue'
import { CoursewareApi } from '@/api/courseware'
import type {
  CoursewareGenerationTaskVO,
  CoursewarePagePreviewVO,
  CoursewarePageStateVO
} from '@/api/courseware'

vi.mock('@/api/courseware', () => ({ CoursewareApi: { getGenerationPagePreview: vi.fn() } }))
vi.mock('@/hooks/web/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      /\.(quizStates|quizHints)\.|\.preview(Previous|Next)$/.test(key) ? key : key.split('.').pop()
  })
}))
let app: App | undefined
let root: HTMLElement
const base: CoursewareGenerationTaskVO = {
  id: 31,
  status: 21,
  step: 'waiting_for_user',
  promptEnhancement: {
    clarificationRound: 1,
    questions: [
      {
        id: 'q1',
        question: '客户怎么回应？',
        required: true,
        allowCustom: true,
        options: [
          { id: 'compare', label: '先问比较对象' },
          { id: 'demo', label: '先演示产品' }
        ]
      }
    ]
  }
}
function mount(task = structuredClone(base)) {
  const state = reactive({
    task,
    connectionInterrupted: false,
    busy: false,
    confirmationFailureRevision: 0
  })
  const answer = vi.fn()
  const confirm = vi.fn()
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp(
    defineComponent({
      setup: () => () =>
        h(CoursewareStudio, {
          task: state.task,
          connectionInterrupted: state.connectionInterrupted,
          busy: state.busy,
          confirmationFailureRevision: state.confirmationFailureRevision,
          statusTitle: 'Working',
          statusDescription: '',
          progress: 10,
          onAnswer: answer,
          onConfirm: confirm
        })
    })
  )
  app.component('Icon', { render: () => h('span') })
  app.component('ElDialog', {
    props: { modelValue: Boolean, alignCenter: Boolean, title: String },
    emits: ['update:modelValue'],
    setup:
      (props, { slots, emit }) =>
      () =>
        props.modelValue
          ? h('div', { 'data-align-center': props.alignCenter }, [
              h('button', {
                class: 'dialog-close',
                onClick: () => emit('update:modelValue', false)
              }),
              h('h2', { class: 'dialog-title' }, props.title),
              slots.default?.()
            ])
          : null
  })
  app.mount(root)
  return { state, answer, confirm }
}
async function choose(value: string) {
  const radio = root.querySelector('input[type="radio"][value="' + value + '"]') as HTMLInputElement
  radio.checked = true
  radio.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}
async function input(selector: string, value: string) {
  const element = root.querySelector(selector) as HTMLInputElement
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
function pageFixture(
  id: string,
  order: number,
  overrides: Partial<CoursewarePageStateVO> = {}
): CoursewarePageStateVO {
  return {
    id: `1:${id}`,
    outlineId: id,
    partIndex: 1,
    order,
    title: id,
    summary: '',
    status: 'completed',
    retryCount: 0,
    mediaPending: false,
    version: 1,
    ...overrides
  }
}
function generationFixture(pages: CoursewarePageStateVO[]): CoursewareGenerationTaskVO {
  return { id: 41, status: 20, step: 'generating_scenes', generation: { phase: 'pages', pages } }
}
function deferredPreview() {
  let resolve!: (result: CoursewarePagePreviewVO) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<CoursewarePagePreviewVO>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
function previewFixture(pageId: string, version = 1): CoursewarePagePreviewVO {
  return { pageId, version, mediaPending: false, html: `<h1>${pageId} version ${version}</h1>` }
}
function previewNav(direction: 'previous' | 'next') {
  return root.querySelectorAll<HTMLButtonElement>('.studio__preview-nav')[
    direction === 'previous' ? 0 : 1
  ]
}
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.mocked(CoursewareApi.getGenerationPagePreview).mockReset()
  HTMLElement.prototype.scrollTo = vi.fn()
})
afterEach(() => {
  app?.unmount()
  root?.remove()
})
describe('course studio interactions', () => {
  it('hydrates the same task through interview, summary and real page review without stale section ids', async () => {
    const { state, confirm } = mount()
    const summary = {
      title: '异议处理',
      audience: '门店销售',
      objective: '回应价格异议',
      scope: { mustInclude: ['价格比较'] },
      planningOutline: [
        { id: 'section-1', title: '比较', description: '练习比较', keyPoints: ['倾听'] }
      ]
    }
    state.task = {
      id: base.id,
      status: 22,
      step: 'waiting_for_confirmation',
      promptEnhancement: { summary }
    }
    await nextTick()
    expect(root.querySelector('.studio__brief-values')?.textContent).toContain('回应价格异议')
    expect(root.querySelector('.studio__part summary')?.textContent).toContain('比较')
    expect(root.querySelector('.studio__document input')).toBeNull()
    root.querySelector<HTMLButtonElement>('.studio__edit-brief')!.click()
    await nextTick()
    await input('.studio__planning-goals input', '编辑后标题')
    state.task = { ...state.task, snapshotVersion: 3 }
    await nextTick()
    expect(root.querySelector<HTMLInputElement>('.studio__planning-goals input')!.value).toBe(
      '编辑后标题'
    )
    root.querySelector<HTMLButtonElement>('.studio__draft .studio__primary')!.click()
    await nextTick()
    expect(root.querySelector('.studio__edit-brief')).toBeNull()
    expect(root.querySelector('.studio__section-actions')).toBeNull()
    state.busy = true
    await nextTick()
    expect(root.querySelector('.studio__brief-values')?.textContent).toContain('编辑后标题')
    state.busy = false
    state.task = { ...state.task, status: 20, step: 'generating_outline' }
    await nextTick()
    expect(root.querySelector('.studio__edit-brief')).toBeNull()
    state.task = {
      ...state.task,
      status: 22,
      step: 'waiting_for_part_selection',
      partSelection: {
        required: true,
        parts: [
          {
            partIndex: 1,
            partCount: 1,
            title: '正式课件',
            outlines: [
              {
                id: 'page-1',
                type: 'slide',
                title: '正式页面',
                description: '正式目的',
                keyPoints: ['正式要点']
              }
            ]
          }
        ]
      }
    }
    await nextTick()
    expect(root.querySelector('.studio__part summary')?.textContent).toContain('正式页面')
    root.querySelector<HTMLButtonElement>('.studio__draft .studio__primary')!.click()
    expect(confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedPartIndexes: [1],
        outlineEdits: [expect.objectContaining({ id: 'page-1' })]
      })
    )
  })

  it('keeps an existing recommendation selected when clicked again and offers None last', async () => {
    mount()
    const selected = root.querySelector<HTMLInputElement>('input[value="compare"]')!
    expect(selected.checked).toBe(true)
    selected.click()
    await nextTick()
    expect(selected.checked).toBe(true)
    expect(root.querySelectorAll('input[type=radio]:checked')).toHaveLength(1)
    expect(Array.from(root.querySelectorAll('.studio__option')).at(-1)?.textContent).toContain(
      'None'
    )
    expect(root.querySelectorAll('.studio__option small')).toHaveLength(3)
  })

  it('keeps backend None as AI delegation and a separate custom-text choice', async () => {
    const task = structuredClone(base)
    task.promptEnhancement!.questions![0].options!.push({
      id: 'none',
      label: 'None',
      description: '由 AI 决定'
    })
    const { answer } = mount(task)
    const labels = Array.from(root.querySelectorAll('.studio__option strong')).map(
      (item) => item.textContent
    )
    expect(labels.filter((label) => label === 'None')).toHaveLength(1)
    expect(labels.at(-1)).toBe('None')
    await choose('none')
    expect(root.querySelector('.studio__input-label textarea')).toBeNull()
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(answer).toHaveBeenLastCalledWith([{ id: 'q1', value: 'none' }])
    await choose('__none__')
    expect(root.querySelector('.studio__input-label textarea')).not.toBeNull()
  })

  it('preselects explicit generation recommendations without auto-submitting', async () => {
    const task = structuredClone(base)
    task.promptEnhancement!.questions![0].id = 'generation-option-homework'
    task.promptEnhancement!.questions![0].requiresExplicitAnswer = true
    task.promptEnhancement!.questions![0].recommendedOptionId = 'compare'
    const { answer } = mount(task)
    expect((root.querySelector('input[value="compare"]') as HTMLInputElement).checked).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 1100))
    expect(answer).not.toHaveBeenCalled()
  })

  it('preselects the recommendation and preserves another choice through refresh', async () => {
    const task = structuredClone(base)
    task.promptEnhancement!.questions![0].recommendedOptionId = 'compare'
    const { answer, state } = mount(task)
    expect((root.querySelector('input[value="compare"]') as HTMLInputElement).checked).toBe(true)
    const button = root.querySelector('.studio__composer .studio__primary') as HTMLButtonElement
    expect(button.disabled).toBe(false)
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(answer).toHaveBeenCalledWith([{ id: 'q1', value: 'compare' }])
    await choose('demo')
    state.task = { ...state.task, snapshotVersion: 5 }
    await nextTick()
    expect((root.querySelector('input[value="demo"]') as HTMLInputElement).checked).toBe(true)
    app?.unmount()
    root.remove()
    mount(task)
    expect((root.querySelector('input[value="demo"]') as HTMLInputElement).checked).toBe(true)
  })
  it('keeps a connection notice visible outside the scrolling conversation until recovery', async () => {
    const { state } = mount()
    state.connectionInterrupted = true
    await nextTick()
    expect(root.querySelector('.studio__connection-notice')?.textContent).toContain(
      'connectionInterrupted'
    )
    expect(root.querySelector('.studio__thread .studio__connection-notice')).toBeNull()
    state.connectionInterrupted = false
    await nextTick()
    expect(root.querySelector('.studio__connection-notice')).toBeNull()
  })
  it('resizes textareas from two lines to three and back without a rows minimum', async () => {
    mount()
    await choose('__none__')
    const editor = root.querySelector('textarea') as HTMLTextAreaElement
    vi.spyOn(editor, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList)
    editor.style.borderTopWidth = '1px'
    editor.style.borderBottomWidth = '1px'
    const height = vi.spyOn(editor, 'scrollHeight', 'get')
    height.mockReturnValue(64)
    await input('textarea', '第一行\n第二行')
    expect(editor.style.height).toBe('66px')
    height.mockReturnValue(86)
    await input('textarea', '第一行\n第二行\n第三行')
    expect(editor.style.height).toBe('88px')
    height.mockReturnValue(64)
    await input('textarea', '第一行\n第二行')
    expect(editor.style.height).toBe('66px')
  })
  it('offers exclusive choices and sends an optional supplement without exposing a text-only question', async () => {
    const { answer } = mount()
    expect(root.querySelectorAll('input[type=radio]')).toHaveLength(3)
    expect(
      root.querySelector('.studio__conversation .studio__composer .studio__primary')
    ).not.toBeNull()
    expect(root.querySelector('.studio__draft .studio__composer .studio__primary')).toBeNull()
    expect(root.querySelector('.studio__input-label textarea')).toBeNull()
    await choose('compare')
    await input('.studio__note textarea', '用本店常见场景')
    await choose('demo')
    expect(root.querySelectorAll('input[type=radio]:checked')).toHaveLength(1)
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(answer).toHaveBeenCalledWith([{ id: 'q1', value: 'demo', note: '用本店常见场景' }])
    await choose('__none__')
    expect(
      (root.querySelector('.studio__composer .studio__primary') as HTMLButtonElement).disabled
    ).toBe(true)
    await input('.studio__input-label textarea', '自己填写的答案')
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(answer).toHaveBeenLastCalledWith([{ id: 'q1', value: '自己填写的答案' }])
  })
  it('retains the planning draft and waits for formal outline review before production', async () => {
    const task: CoursewareGenerationTaskVO = {
      id: 38,
      status: 22,
      step: 'waiting_for_confirmation',
      promptEnhancement: {
        summary: {
          title: 'Course',
          audience: 'Staff',
          objective: 'Act',
          scope: { mustInclude: ['Case'] },
          planningOutline: [1, 2, 3].map((i) => ({
            id: 's' + i,
            title: 'Section ' + i,
            description: 'Learning goal and exercise',
            keyPoints: ['Explain', 'Demonstrate', 'Practice']
          }))
        }
      }
    }
    mount(task)
    expect(root.querySelectorAll('.studio__steps li')).toHaveLength(4)
    expect(root.querySelector('.studio__draft .studio__composer .studio__primary')).not.toBeNull()
    expect(
      root.querySelector('.studio__conversation .studio__composer .studio__primary')
    ).toBeNull()
    expect(root.querySelectorAll('.studio__part details[open]')).toHaveLength(3)
    expect(root.querySelector('.studio__draft-header')?.textContent).toContain('courseSummary')
    expect(root.querySelector('.studio__part .studio__page-content input')).toBeNull()
    ;(root.querySelector('.studio__section-actions button') as HTMLButtonElement).click()
    await nextTick()
    await input('.studio__part .studio__page-content input', '客户异议处理')
    await input('.studio__part .studio__page-content textarea', '通过角色扮演练习比较产品')
    app?.unmount()
    root.remove()
    const { confirm, state } = mount(task)
    await nextTick()
    expect(root.querySelector('.studio__part summary')?.textContent).toContain('客户异议处理')
    expect(root.querySelector('.studio__page-readonly-desc')?.textContent).toContain(
      '通过角色扮演练习比较产品'
    )
    ;(root.querySelector('.studio__composer .studio__primary') as HTMLButtonElement).click()
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledWith({
      requirementEdits: expect.objectContaining({
        planningOutline: expect.arrayContaining([
          expect.objectContaining({
            id: 's1',
            title: '客户异议处理',
            description: '通过角色扮演练习比较产品'
          })
        ])
      })
    })
    state.task = { ...task, status: 20, step: 'generating_outline' }
    await nextTick()
    expect(root.querySelector('.studio__leave-hint')).toBeNull()
    expect(root.querySelector('.studio__composer .studio__primary')).toBeNull()
    expect(root.querySelector('.studio__section-actions')).toBeNull()
    expect(root.querySelector('.studio__part input, .studio__part textarea')).toBeNull()
  })

  it('shows a readable failure summary instead of child provider diagnostics', () => {
    mount({
      id: 34,
      status: 20,
      series: {
        seriesId: 'series-34',
        title: 'Series',
        items: [
          {
            childJobId: 'child-34',
            partIndex: 1,
            partCount: 2,
            title: 'Part one',
            status: 'failed',
            error: 'Provider diagnostic stack with internal request details'
          }
        ]
      }
    })
    expect(root.querySelector('.studio__series-error')?.textContent).toBe('failed')
    expect(root.textContent).not.toContain('Provider diagnostic')
  })
  it('retains an unsent answer across polling and page remount, then submits actual text', async () => {
    const { state } = mount()
    await choose('__none__')
    await input('textarea', '我先问客户在和什么比较')
    const editor = root.querySelector('textarea') as HTMLTextAreaElement
    editor.focus()
    editor.setSelectionRange(3, 3)
    state.task = structuredClone(base)
    await nextTick()
    expect(root.querySelector('textarea')).toBe(editor)
    expect(document.activeElement).toBe(editor)
    expect(editor.selectionStart).toBe(3)
    expect(editor.value).toBe('我先问客户在和什么比较')
    app?.unmount()
    root.remove()
    const { answer } = mount()
    await nextTick()
    expect((root.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      '我先问客户在和什么比较'
    )
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(answer).toHaveBeenCalledWith([{ id: 'q1', value: '我先问客户在和什么比较' }])
  })
  it('submits with Ctrl+Enter without submitting an IME composition or repeated keypress', async () => {
    const { answer } = mount()
    await choose('__none__')
    await input('textarea', '先确认客户的比较对象')
    const editor = root.querySelector('textarea')!
    for (const options of [{ isComposing: true }, { repeat: true }]) {
      editor.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
          ...options
        })
      )
    }
    expect(answer).not.toHaveBeenCalled()
    editor.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      })
    )
    expect(answer).toHaveBeenCalledOnce()
    expect(answer).toHaveBeenCalledWith([{ id: 'q1', value: '先确认客户的比较对象' }])
  })
  it('does not reuse the previous answer when the next round uses the same question id', async () => {
    const { state } = mount()
    await choose('__none__')
    await input('textarea', '第一个案例')
    state.task = {
      ...base,
      promptEnhancement: { ...base.promptEnhancement, clarificationRound: 2 }
    }
    await nextTick()
    expect(root.querySelector('.studio__input-label textarea')).toBeNull()
    await choose('__none__')
    expect((root.querySelector('textarea') as HTMLTextAreaElement).value).toBe('')
  })
  it('submits edited page content and never silently restores deselected parts', async () => {
    const task: CoursewareGenerationTaskVO = {
      id: 32,
      status: 22,
      step: 'waiting_for_part_selection',
      partSelection: {
        required: true,
        parts: [1, 2].map((index) => ({
          partIndex: index,
          partCount: 2,
          title: `Part ${index}`,
          outlines: [
            {
              id: `p${index}`,
              type: 'slide',
              title: 'Original',
              description: 'Purpose',
              keyPoints: ['Point']
            }
          ]
        }))
      }
    }
    const { state, confirm } = mount(task)
    ;(root.querySelector('.studio__section-actions button') as HTMLButtonElement).click()
    await nextTick()
    await input('.studio__part .studio__page-content input', '修改后的标题')
    const checkbox = root.querySelector('input[type=checkbox]') as HTMLInputElement
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    state.task = structuredClone(task)
    await nextTick()
    expect((root.querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(false)
    ;(root.querySelector('.studio__composer .studio__primary') as HTMLButtonElement).click()
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedPartIndexes: [2],
        outlineEdits: expect.arrayContaining([
          expect.objectContaining({ id: 'p1', title: '修改后的标题' })
        ])
      })
    )
  })
  it('submits the edited brief without rejecting the task', async () => {
    const { confirm } = mount({
      id: 33,
      status: 22,
      step: 'waiting_for_confirmation',
      promptEnhancement: {
        summary: {
          title: 'Course',
          audience: 'Staff',
          objective: 'Act',
          scope: { mustInclude: ['Case'] }
        }
      }
    })
    expect(root.querySelector('.studio__document input')).toBeNull()
    expect(root.querySelector('.studio__brief-values')?.textContent).toContain('Staff')
    ;(root.querySelector('.studio__edit-brief') as HTMLButtonElement).click()
    await nextTick()
    await input('.studio__document input', '新主题')
    ;(root.querySelector('.studio__composer .studio__primary') as HTMLButtonElement).click()
    expect(confirm).toHaveBeenCalledWith({
      requirementEdits: {
        title: '新主题',
        audience: 'Staff',
        objective: 'Act',
        mustInclude: ['Case']
      }
    })
  })
  it.each(['summary', 'outline'] as const)(
    'unlocks %s confirmation only on failure and preserves edits across retries',
    async (phase) => {
      const { state, confirm } = mount({
        id: 33,
        status: 22,
        step: phase === 'outline' ? 'waiting_for_part_selection' : 'waiting_for_confirmation',
        promptEnhancement: {
          summary: { title: 'Course', audience: 'Staff', objective: 'Act' }
        },
        ...(phase === 'outline'
          ? {
              partSelection: {
                required: true,
                parts: [1, 2].map((partIndex) => ({
                  partIndex,
                  partCount: 2,
                  title: `Part ${partIndex}`,
                  outlines: [
                    {
                      id: `p${partIndex}`,
                      type: 'slide' as const,
                      title: 'Original',
                      description: 'Purpose',
                      keyPoints: ['Point']
                    }
                  ]
                }))
              }
            }
          : {})
      })
      root.querySelector<HTMLButtonElement>('.studio__edit-brief')!.click()
      await nextTick()
      await input('.studio__document input', '修改后的主题')
      if (phase === 'outline') {
        root.querySelector<HTMLButtonElement>('.studio__section-actions button')!.click()
        await nextTick()
        await input('.studio__part .studio__page-content input', '修改后的页面')
        root.querySelector<HTMLInputElement>('input[type=checkbox]')!.click()
        await nextTick()
      }
      const button = root.querySelector<HTMLButtonElement>('.studio__draft .studio__primary')!
      button.click()
      await nextTick()
      expect(confirm).toHaveBeenCalledTimes(1)
      const submitted = confirm.mock.calls[0][0]
      expect(submitted.requirementEdits.title).toBe('修改后的主题')
      if (phase === 'outline') {
        expect(submitted.selectedPartIndexes).toEqual([2])
        expect(submitted.outlineEdits[0].title).toBe('修改后的页面')
      }
      for (const revision of [1, 2]) {
        state.busy = true
        await nextTick()
        state.task = { ...state.task, snapshotVersion: revision }
        state.busy = false
        await nextTick()
        expect(button.disabled).toBe(true)
        expect(root.querySelector('.studio__edit-brief')).toBeNull()
        expect(root.querySelector('.studio__section-actions')).toBeNull()
        state.confirmationFailureRevision += 1
        await nextTick()
        expect(button.disabled).toBe(false)
        expect(root.querySelector('.studio__edit-brief')).not.toBeNull()
        expect(root.querySelector('.studio__brief-values')?.textContent).toContain('修改后的主题')
        if (phase === 'outline') {
          expect(root.querySelector('.studio__section-actions')).not.toBeNull()
          expect(root.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(false)
        }
        button.click()
        await nextTick()
        expect(confirm).toHaveBeenCalledTimes(revision + 1)
        expect(confirm).toHaveBeenLastCalledWith(submitted)
      }
      // 成功只结束 busy；轮询仍返回相同 key 时，编辑和重复提交继续锁定。
      state.busy = true
      await nextTick()
      state.task = { ...state.task, snapshotVersion: 3 }
      state.busy = false
      await nextTick()
      expect(button.disabled).toBe(true)
      expect(root.querySelector('.studio__edit-brief')).toBeNull()
      expect(root.querySelector('.studio__section-actions')).toBeNull()
      button.click()
      root
        .querySelector('.studio')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
      expect(confirm).toHaveBeenCalledTimes(3)
    }
  )
  it('previews completed pages while the course is still running without fetching waiting pages', async () => {
    const { state } = mount({
      id: 31,
      status: 20,
      step: 'generating_scenes',
      generation: {
        phase: 'pages',
        pages: [
          {
            id: '1:p1',
            outlineId: 'p1',
            partIndex: 1,
            order: 1,
            title: 'First',
            summary: 'Ready',
            status: 'completed',
            retryCount: 1,
            mediaPending: true,
            version: 2
          },
          {
            id: '1:p2',
            outlineId: 'p2',
            partIndex: 1,
            order: 2,
            title: 'Second',
            summary: '',
            status: 'generating',
            retryCount: 0,
            mediaPending: false,
            version: 1
          }
        ]
      }
    })
    vi.mocked(CoursewareApi.getGenerationPagePreview).mockResolvedValue({
      pageId: '1:p1',
      version: 2,
      mediaPending: true,
      html: '<h1>Actual slide</h1>'
    })
    expect(root.querySelector('.studio__conversation .studio__generated-pages')).toBeNull()
    expect(root.querySelector('.studio__draft .studio__generated-pages')).not.toBeNull()
    expect(root.querySelectorAll('.studio__draft .studio__generated-pages article')).toHaveLength(2)
    expect(root.querySelector('.studio__leave-hint')?.textContent).toContain('leaveHint')
    expect(root.querySelector('.studio__history')).not.toBeNull()
    const buttons = root.querySelectorAll('.studio__generated-pages button')
    expect(buttons).toHaveLength(1)
    ;(buttons[0] as HTMLButtonElement).click()
    await vi.waitFor(() =>
      expect(root.querySelector('iframe')?.getAttribute('srcdoc')).toContain('Actual slide')
    )
    expect(CoursewareApi.getGenerationPagePreview).toHaveBeenCalledWith(31, '1:p1')
    expect(root.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts')
    expect(root.querySelector('.studio__preview-shell')).not.toBeNull()
    // Polling replaces the DTO even when the task and selected page are unchanged.
    state.task = { ...state.task, snapshotVersion: 10 }
    await nextTick()
    expect(root.querySelector('iframe')?.getAttribute('srcdoc')).toContain('Actual slide')
    state.task = { ...state.task, status: 50 }
    await nextTick()
    expect(root.querySelector('iframe')).toBeNull()
  })

  it('shows quiz as queued until pages finish and reuses completed quiz pages for preview', async () => {
    const task = {
      id: 41,
      status: 20,
      step: 'generating_scenes',
      generateHomeworkSync: true,
      homeworkGenerationStatus: 'queued',
      generation: {
        phase: 'pages' as const,
        pages: [
          {
            id: '1:slide',
            outlineId: 'slide-1',
            partIndex: 1,
            order: 1,
            title: '讲解页',
            summary: '',
            status: 'generating' as const,
            retryCount: 0,
            mediaPending: false,
            version: 1
          }
        ]
      }
    } satisfies CoursewareGenerationTaskVO
    mount(task)
    expect(root.querySelector('.studio__quiz-card')?.textContent).toContain('待生成')
    const completedTask = {
      ...task,
      homeworkGenerationStatus: 'imported',
      generation: {
        ...task.generation,
        pages: [
          ...task.generation.pages.map((page) => ({ ...page, status: 'completed' as const })),
          {
            id: '1:scene_homework_quiz',
            outlineId: 'scene_homework_quiz',
            partIndex: 1,
            order: 2,
            title: '课后练习',
            summary: '',
            status: 'completed' as const,
            retryCount: 0,
            mediaPending: false,
            version: 1
          }
        ]
      }
    } satisfies CoursewareGenerationTaskVO
    app?.unmount()
    root.remove()
    vi.mocked(CoursewareApi.getGenerationPagePreview).mockResolvedValue({
      pageId: '1:scene_homework_quiz',
      version: 1,
      mediaPending: false,
      html: '<h1>Quiz</h1>'
    })
    mount(completedTask)
    expect(root.querySelector('.studio__quiz-card')).toBeNull()
    const previewButton = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.studio__preview-link')
    ).at(-1)
    previewButton?.click()
    await vi.waitFor(() => expect(root.querySelector('iframe')?.srcdoc).toContain('Quiz'))
    expect(CoursewareApi.getGenerationPagePreview).toHaveBeenCalledWith(41, '1:scene_homework_quiz')
  })

  it('centers the preview and navigates completed pages in page order within the selected PPT', async () => {
    mount(
      generationFixture([
        pageFixture('last', 4),
        pageFixture('first', 1),
        pageFixture('waiting', 2, { status: 'waiting' }),
        pageFixture('generating', 3, { status: 'generating' }),
        pageFixture('foreign', 1, { id: '2:foreign', partIndex: 2 })
      ])
    )
    vi.mocked(CoursewareApi.getGenerationPagePreview).mockImplementation(async (_id, pageId) =>
      previewFixture(pageId)
    )
    root.querySelector<HTMLButtonElement>('.studio__preview-link')!.click()
    await vi.waitFor(() => expect(root.querySelector('iframe')?.srcdoc).toContain('first'))
    expect(root.querySelector('.studio-preview-dialog')?.getAttribute('data-align-center')).toBe(
      'true'
    )
    expect(previewNav('previous').disabled).toBe(true)
    expect(previewNav('next').disabled).toBe(false)
    expect(root.querySelector('.studio__preview-counter')?.textContent).toContain('1 / 2')
    previewNav('next').click()
    await vi.waitFor(() => expect(root.querySelector('iframe')?.srcdoc).toContain('last'))
    expect(previewNav('next').disabled).toBe(true)
    expect(root.querySelector('.dialog-title')?.textContent).toBe('last')
    previewNav('previous').click()
    await vi.waitFor(() => expect(root.querySelector('iframe')?.srcdoc).toContain('first'))
    expect(
      vi.mocked(CoursewareApi.getGenerationPagePreview).mock.calls.map((call) => call[1])
    ).toEqual(['1:first', '1:last', '1:first'])
  })

  it('keeps navigation usable while loading and ignores an earlier success and failure', async () => {
    mount(
      generationFixture([
        pageFixture('first', 1),
        pageFixture('second', 2),
        pageFixture('third', 3)
      ])
    )
    const requests = [deferredPreview(), deferredPreview(), deferredPreview()]
    vi.mocked(CoursewareApi.getGenerationPagePreview)
      .mockImplementationOnce(() => requests[0].promise)
      .mockImplementationOnce(() => requests[1].promise)
      .mockImplementationOnce(() => requests[2].promise)
    root.querySelector<HTMLButtonElement>('.studio__preview-link')!.click()
    await nextTick()
    expect(previewNav('next').disabled).toBe(false)
    previewNav('next').click()
    await nextTick()
    previewNav('next').click()
    await nextTick()
    requests[0].resolve(previewFixture('1:first'))
    requests[1].reject(new Error('late failure'))
    await nextTick()
    await nextTick()
    expect(root.querySelector('iframe')).toBeNull()
    expect(root.querySelector('.studio__preview-shell')?.getAttribute('aria-busy')).toBe('true')
    expect(root.querySelector('.dialog-title')?.textContent).toBe('third')
    requests[2].resolve(previewFixture('1:third'))
    await vi.waitFor(() => expect(root.querySelector('iframe')?.srcdoc).toContain('third'))
    expect(root.querySelector('.studio__preview-content [role="alert"]')).toBeNull()
  })

  it('invalidates a closed preview request and reloads a newer polled version during loading', async () => {
    const { state } = mount(generationFixture([pageFixture('first', 1)]))
    const closed = deferredPreview()
    const initial = deferredPreview()
    const updated = deferredPreview()
    vi.mocked(CoursewareApi.getGenerationPagePreview)
      .mockImplementationOnce(() => closed.promise)
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => updated.promise)
    root.querySelector<HTMLButtonElement>('.studio__preview-link')!.click()
    await nextTick()
    root.querySelector<HTMLButtonElement>('.dialog-close')!.click()
    await nextTick()
    root.querySelector<HTMLButtonElement>('.studio__preview-link')!.click()
    await nextTick()
    closed.resolve(previewFixture('1:first', 100))
    await nextTick()
    expect(root.querySelector('iframe')).toBeNull()
    state.task.generation!.pages[0].version = 2
    await nextTick()
    expect(CoursewareApi.getGenerationPagePreview).toHaveBeenCalledTimes(3)
    updated.resolve(previewFixture('1:first', 2))
    await vi.waitFor(() => expect(root.querySelector('iframe')?.srcdoc).toContain('version 2'))
    initial.resolve(previewFixture('1:first'))
    await nextTick()
    expect(root.querySelector('iframe')?.srcdoc).toContain('version 2')
    state.task = { ...state.task, snapshotVersion: 99 }
    await nextTick()
    expect(CoursewareApi.getGenerationPagePreview).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['queued', 'waiting', '待生成'],
    ['running', 'generating', '生成中'],
    ['succeeded', 'generating', '生成中'],
    ['imported', 'completed', '已完成'],
    ['failed', 'failed', '生成失败'],
    ['canceled', 'failed', '生成失败'],
    ['observed', 'waiting', '待生成'],
    [undefined, 'waiting', '待生成']
  ])('maps child homework %s to %s independently of the parent', (homework, cssStatus, label) => {
    mount({
      ...generationFixture([pageFixture('first', 1)]),
      generateHomeworkSync: true,
      homeworkGenerationStatus: 'imported',
      series: {
        seriesId: 'series',
        title: 'Course',
        items: [
          {
            childJobId: 'child-1',
            partIndex: 1,
            partCount: 1,
            title: 'Part 1',
            status: 'succeeded',
            homeworkGenerationStatus: homework
          }
        ]
      }
    })
    const card = root.querySelector('.studio__quiz-card')!
    expect(card.querySelector(`.studio__page-status.is-${cssStatus}`)?.textContent).toBe(label)
    expect(CoursewareApi.getGenerationPagePreview).not.toHaveBeenCalled()
  })

  it('keeps quizzes pending until all parts finish, then reflects the selected child only', async () => {
    const { state } = mount({
      ...generationFixture([
        pageFixture('first', 1),
        pageFixture('second', 1, { id: '2:second', partIndex: 2, status: 'generating' })
      ]),
      generateHomeworkSync: true,
      homeworkGenerationStatus: 'running',
      series: {
        seriesId: 'series',
        title: 'Course',
        items: [1, 2].map((partIndex) => ({
          childJobId: `child-${partIndex}`,
          partIndex,
          partCount: 2,
          title: `Part ${partIndex}`,
          status: partIndex === 1 ? 'succeeded' : 'running',
          homeworkGenerationStatus: partIndex === 1 ? 'running' : 'queued'
        }))
      }
    })
    expect(root.querySelector('.studio__quiz-card .studio__page-status')?.textContent).toBe(
      '待生成'
    )
    state.task.generation!.pages[1].status = 'completed'
    state.task.series!.items[1].status = 'succeeded'
    await nextTick()
    expect(root.querySelector('.studio__quiz-card .studio__page-status')?.textContent).toBe(
      '生成中'
    )
    root.querySelectorAll<HTMLButtonElement>('.studio__part-tabs button')[1].click()
    await nextTick()
    expect(root.querySelector('.studio__quiz-card .studio__page-status')?.textContent).toBe(
      '待生成'
    )
  })

  it('recognizes reviewed quiz outlines without mistaking an exercise slide for a quiz', async () => {
    const { state } = mount({
      ...generationFixture([pageFixture('exercise', 1, { title: '练习操作方法' })]),
      generateHomeworkSync: true,
      partSelection: {
        required: false,
        parts: [
          {
            partIndex: 1,
            partCount: 1,
            title: 'Part 1',
            outlines: [
              {
                id: 'exercise',
                type: 'slide',
                title: '练习操作方法',
                description: '演示操作',
                keyPoints: ['示范']
              }
            ]
          }
        ]
      }
    })
    expect(root.querySelector('.studio__quiz-card')).not.toBeNull()
    state.task.partSelection!.parts[0].outlines![0].type = 'quiz'
    await nextTick()
    expect(root.querySelector('.studio__quiz-card')).toBeNull()
    expect(root.querySelectorAll('.studio__preview-link')).toHaveLength(1)
  })

  it('invalidates page requests on part and task changes', async () => {
    const { state } = mount(
      generationFixture([
        pageFixture('first', 1),
        pageFixture('second', 1, { id: '2:second', partIndex: 2 })
      ])
    )
    const first = deferredPreview()
    const second = deferredPreview()
    vi.mocked(CoursewareApi.getGenerationPagePreview)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    root.querySelector<HTMLButtonElement>('.studio__preview-link')!.click()
    await nextTick()
    root.querySelectorAll<HTMLButtonElement>('.studio__part-tabs button')[1].click()
    await nextTick()
    expect(root.querySelector('.studio__preview-shell')).toBeNull()
    root.querySelector<HTMLButtonElement>('.studio__preview-link')!.click()
    await nextTick()
    first.resolve(previewFixture('1:first'))
    await nextTick()
    expect(root.querySelector('iframe')).toBeNull()
    expect(root.querySelector('.dialog-title')?.textContent).toBe('second')
    state.task = { ...state.task, id: 99 }
    await nextTick()
    second.resolve(previewFixture('2:second'))
    await nextTick()
    expect(root.querySelector('.studio__preview-shell')).toBeNull()
    expect(root.querySelector('.studio__part-tabs button')?.getAttribute('aria-pressed')).toBe(
      'true'
    )
  })

  it('hides single-PPT progress but retains page status and overall production progress', async () => {
    const { state } = mount(generationFixture([pageFixture('first', 1, { status: 'generating' })]))
    expect(root.querySelector('.studio__part-progress')).toBeNull()
    expect(root.querySelector('.studio__page-status.is-generating')).not.toBeNull()
    expect(root.querySelector('.studio__part-summary')).not.toBeNull()
    expect(root.querySelector('.studio__production progress')).not.toBeNull()
    state.task.generation!.pages.push(
      pageFixture('second', 1, { id: '2:second', partIndex: 2, status: 'waiting' })
    )
    await nextTick()
    expect(root.querySelector('.studio__part-progress')).not.toBeNull()
    state.task.generation!.pages.pop()
    await nextTick()
    expect(root.querySelector('.studio__part-progress')).toBeNull()
  })

  it('swaps the same live panels in both directions and restores the preference on remount', async () => {
    mount()
    const conversation = root.querySelector('.studio__conversation')!
    const draft = root.querySelector('.studio__draft')!
    const swap = root.querySelector<HTMLButtonElement>('.studio__swap-panels')!
    for (const swapped of [true, false, true]) {
      swap.click()
      await nextTick()
      expect(root.querySelector('.studio__conversation')).toBe(conversation)
      expect(root.querySelector('.studio__draft')).toBe(draft)
      expect(conversation.classList.contains('is-swapped')).toBe(swapped)
      expect(draft.classList.contains('is-swapped')).toBe(swapped)
      expect(localStorage.getItem('courseware-studio-panels-swapped')).toBe(String(swapped))
    }
    app?.unmount()
    root.remove()
    mount()
    expect(root.querySelector('.studio__conversation.is-swapped')).not.toBeNull()
    expect(root.querySelector('.studio__draft.is-swapped')).not.toBeNull()
  })

  it('switches child PPT tabs and shows failed status even when a legacy task reports 100%', async () => {
    const { state } = mount({
      id: 31,
      status: 20,
      step: 'generating_children',
      series: {
        seriesId: 'series',
        title: 'Course',
        items: [1, 2, 3].map((partIndex) => ({
          childJobId: `child-${partIndex}`,
          partIndex,
          partCount: 3,
          title: `Part ${partIndex}`,
          status: partIndex === 3 ? 'failed' : 'running',
          progress: partIndex === 3 ? 100 : 90
        }))
      },
      generation: {
        phase: 'pages',
        pages: [1, 2, 3].map((partIndex) => ({
          id: `${partIndex}:p1`,
          outlineId: 'p1',
          partIndex,
          order: 1,
          title: `Page ${partIndex}`,
          summary: '',
          status: partIndex === 3 ? 'failed' : 'completed',
          retryCount: 0,
          mediaPending: false,
          version: 1
        }))
      }
    })
    const tabs = root.querySelectorAll<HTMLButtonElement>('.studio__part-tabs button')
    expect(tabs).toHaveLength(3)
    expect(root.querySelector('.studio__part-progress')?.textContent).toContain('90%')
    expect(root.querySelector('.studio__generated-pages')?.textContent).toContain('Page 1')
    expect(root.querySelectorAll('.studio__production progress')).toHaveLength(1)
    expect(root.querySelectorAll('.studio__part-progress progress')).toHaveLength(1)
    expect(root.querySelectorAll('.studio__conversation progress')).toHaveLength(1)
    expect(root.querySelector('.studio__draft-header .studio__hint')).toBeNull()
    tabs[2].click()
    await nextTick()
    expect(root.querySelectorAll('.studio__generated-pages article')).toHaveLength(1)
    expect(root.querySelector('.studio__generated-pages')?.textContent).toContain('Page 3')
    expect(root.querySelector('.studio__generated-pages')?.textContent).not.toContain('Page 1')
    expect(root.textContent).not.toContain('100%')
    expect(root.querySelector('.studio__part-progress')?.textContent).toContain('99%')
    expect(root.querySelector('.studio__part-progress small')?.textContent).toBe('FAILED')
    const pagePanel = root.querySelector('.studio__generated-pages')!
    expect(pagePanel.classList.contains('is-page-turning-next')).toBe(true)
    state.task = { ...state.task, snapshotVersion: 12 }
    await nextTick()
    expect(root.querySelector('.studio__generated-pages')).toBe(pagePanel)
    expect(tabs[2].getAttribute('aria-pressed')).toBe('true')
    tabs[0].click()
    await nextTick()
    expect(
      root.querySelector('.studio__generated-pages')?.classList.contains('is-page-turning-previous')
    ).toBe(true)
  })
})
