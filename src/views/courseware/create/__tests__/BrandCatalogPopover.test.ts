import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, type App, watch } from 'vue'
import BrandCatalogPopover from '../components/BrandCatalogPopover.vue'
import { CoursewareApi } from '@/api/courseware'
import { CategorySettingsApi } from '@/api/categorySettings'
import { AiTrainingProductApi } from '@/api/ai-training/product'

const permissions = vi.hoisted(() => ({ category: true, product: true }))
vi.mock('@/api/courseware', () => ({ CoursewareApi: { getCatalogOptions: vi.fn() } }))
vi.mock('@/api/categorySettings', () => ({
  CategorySettingsApi: { createBrand: vi.fn(), createCategory: vi.fn(), createTag: vi.fn() }
}))
vi.mock('@/api/ai-training/product', () => ({ AiTrainingProductApi: { create: vi.fn() } }))
vi.mock('@/utils/permission', () => ({
  checkPermi: (keys: string[]) =>
    keys[0] === 'ai:category:create' ? permissions.category : permissions.product
}))
vi.mock('@/hooks/web/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key.split('.').pop() })
}))
vi.mock('@/hooks/web/useMessage', () => ({ useMessage: () => ({ success: vi.fn() }) }))

let app: App
let root: HTMLElement
const options = {
  brands: [{ id: 1, name: '品牌 A' }],
  categories: [
    { id: 2, brandId: 1, name: '品类 A' },
    { id: 3, brandId: 1, parentId: 2, name: '系列 A' }
  ],
  products: [{ id: 4, brandId: 1, categoryId: 3, name: '产品 A' }]
}
async function settle() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}
async function mount() {
  const refreshed = vi.fn()
  root = document.createElement('div')
  document.body.append(root)
  app = createApp(BrandCatalogPopover, { language: 'cn', onRefreshed: refreshed })
  app.component('Icon', { render: () => h('i') })
  app.directive('loading', {})
  app.component(
    'ElDialog',
    defineComponent({
      props: ['modelValue'],
      emits: ['open', 'closed', 'update:modelValue'],
      setup(props, { slots, emit }) {
        watch(
          () => props.modelValue,
          (visible) => emit(visible ? 'open' : 'closed')
        )
        return () =>
          props.modelValue
            ? h('div', { role: 'dialog' }, [
                h(
                  'button',
                  { class: 'close', onClick: () => emit('update:modelValue', false) },
                  'close'
                ),
                slots.default?.(),
                slots.footer?.()
              ])
            : null
      }
    })
  )
  app.component(
    'ElButton',
    defineComponent({
      setup:
        (_, { slots, attrs }) =>
        () =>
          h('button', attrs, slots.default?.())
    })
  )
  app.component(
    'ElInput',
    defineComponent({
      props: ['modelValue'],
      emits: ['update:modelValue'],
      setup:
        (props, { emit }) =>
        () =>
          h('input', {
            value: props.modelValue,
            onInput: (event: Event) =>
              emit('update:modelValue', (event.target as HTMLInputElement).value)
          })
    })
  )
  app.component('ElEmpty', { render: () => h('span') })
  app.component(
    'ElTree',
    defineComponent({
      props: ['data'],
      setup:
        (props, { slots }) =>
        () => {
          const nodes: any[] = []
          const visit = (items: any[]) =>
            items.forEach((item) => {
              nodes.push(h('div', { 'data-node': item.key }, slots.default?.({ data: item })))
              visit(item.children || [])
            })
          visit(props.data)
          return h('div', nodes)
        }
    })
  )
  app.mount(root)
  root.querySelector<HTMLButtonElement>('.brand-catalog-trigger')!.click()
  await settle()
  return refreshed
}
async function add(selector: string, name: string) {
  root.querySelector<HTMLButtonElement>(selector)!.click()
  await nextTick()
  const input = root.querySelector('input')!
  input.value = name
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  const buttons = root.querySelectorAll<HTMLButtonElement>('.brand-catalog-add__actions button')
  buttons[1].click()
  await settle()
}
beforeEach(() => {
  permissions.category = true
  permissions.product = true
  vi.clearAllMocks()
  vi.mocked(CoursewareApi.getCatalogOptions).mockResolvedValue(options)
})
afterEach(() => {
  app?.unmount()
  root?.remove()
})

describe('read/add-only catalog dialog', () => {
  it('opens from the plus trigger and clears an unfinished form on close', async () => {
    await mount()
    expect(root.querySelector('[role="dialog"]')).not.toBeNull()
    root.querySelector<HTMLButtonElement>('.brand-catalog-new-brand')!.click()
    await nextTick()
    expect(root.querySelector('input')).not.toBeNull()
    expect(root.querySelectorAll('[role="dialog"]')).toHaveLength(2)
    root.querySelector<HTMLButtonElement>('.close')!.click()
    await settle()
    root.querySelector<HTMLButtonElement>('.brand-catalog-trigger')!.click()
    await settle()
    expect(root.querySelector('input')).toBeNull()
  })
  it('adds all four levels through existing APIs and refreshes options', async () => {
    const refreshed = await mount()
    await add('.brand-catalog-new-brand', '新品牌')
    expect(CategorySettingsApi.createBrand).toHaveBeenCalledWith(
      expect.objectContaining({ name: '新品牌', lang: 'cn', status: 1 })
    )
    await add('[data-node="brand-1"] button', '新品类')
    expect(CategorySettingsApi.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: 1, name: '新品类', status: 0 })
    )
    await add('[data-node="category-2"] button', '新系列')
    expect(CategorySettingsApi.createTag).toHaveBeenCalledWith({
      categoryId: 2,
      name: '新系列',
      sort: 0
    })
    await add('[data-node="series-3"] button', '新产品')
    expect(AiTrainingProductApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: 1, categoryId: 3, name: '新产品', lang: 'cn' })
    )
    expect(root.querySelector('[data-node="product-4"] button')).toBeNull()
    expect(CoursewareApi.getCatalogOptions).toHaveBeenCalledTimes(5)
    expect(refreshed).toHaveBeenCalledTimes(4)
    root.querySelector<HTMLButtonElement>('.close')!.click()
    await settle()
    expect(refreshed).toHaveBeenCalledTimes(5)
  })

  it('is read-only when existing create permissions are absent', async () => {
    permissions.category = false
    permissions.product = false
    await mount()
    expect(root.textContent).toContain('品牌 A')
    expect(root.textContent).toContain('产品 A')
    expect(root.querySelector('.brand-catalog-new-brand')).toBeNull()
    expect(root.querySelectorAll('.brand-catalog-node button')).toHaveLength(0)
  })
})
