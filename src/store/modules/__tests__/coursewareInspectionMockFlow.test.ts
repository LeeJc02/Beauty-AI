import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { __resetCoursewareMockStoreForTests, coursewareRoutes } from '@/mock/handlers/courseware'
import type { MockCtx } from '@/mock/types'
import { useCoursewareGenerationStore } from '../coursewareGeneration'
import { useCoursewareInspectionRuntime } from '@/beauty/lib/coursewareInspectionRuntime'

vi.mock('@/utils/auth', () => ({ getAccessToken: () => 'mock-token' }))
vi.mock('@/store/modules/user', async () => {
  const { defineStore } = await import('pinia')
  return {
    useUserStore: defineStore('mock-flow-user', {
      state: () => ({ getUser: { id: 1001 }, getRoles: ['hq_trainer'] })
    })
  }
})
vi.mock('@/api/courseware', () => ({
  CoursewareApi: {
    getGenerationTask: async (id: number) =>
      call('GET', '/ai/courseware/generation-task/get', { id }),
    getCourseware: async (id: number) => call('GET', '/ai/courseware/get', { id }),
    getActiveGenerationTask: async () => call('GET', '/ai/courseware/generation-task/active')
  }
}))
function call(
  method: MockCtx['method'],
  path: string,
  query: Record<string, any> = {},
  body: any = {}
) {
  const route = coursewareRoutes.find((item) => item.method === method && item.path === path)
  if (!route) throw new Error(`缺少路由 ${path}`)
  return route.handler({ method, path, query, body, config: {} as MockCtx['config'] })
}
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}
async function generate() {
  const store = useCoursewareGenerationStore()
  const context = store.captureTaskContext()
  const created = await call(
    'POST',
    '/ai/courseware/generation-task/create',
    {},
    { description: '新品课件时长监督验证', language: 'cn' }
  )
  expect(store.setTask(created, context)).toBe(true)
  store.setTask(
    await call(
      'POST',
      '/ai/courseware/generation-task/answer',
      { id: created.id },
      { answers: [{ id: 'split', value: 'two' }] }
    ),
    context
  )
  store.setTask(
    await call(
      'POST',
      '/ai/courseware/generation-task/confirm',
      { id: created.id },
      { confirmed: true }
    ),
    context
  )
  vi.setSystemTime(Date.now() + 3201)
  await store.refreshTask()
  const generating = await call(
    'POST',
    '/ai/courseware/generation-task/confirm',
    { id: created.id },
    { confirmed: true, selectedPartIndexes: [1] }
  )
  store.setTask(generating, context)
  vi.setSystemTime(Date.now() + generating.generation.pages.length * 2600 + 801)
  await store.refreshTask()
  vi.setSystemTime(Date.now() + 2601)
  await store.refreshTask()
  await flush()
  expect(store.task?.done).toBe(true)
}
describe('真实演示课件链路 → 事件监督', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    localStorage.setItem('beauty-ai:demo-role', 'hq_trainer')
    __resetCoursewareMockStoreForTests()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T10:00:00Z'))
  })
  afterEach(() => {
    useCoursewareGenerationStore().clear()
    __resetCoursewareMockStoreForTests()
    vi.useRealTimers()
    localStorage.clear()
  })
  it('从生成接口到产物详情核验，三次不合规升级且不伪造飞书发送', async () => {
    const runtime = useCoursewareInspectionRuntime()
    const id = runtime.createTask({
      name: '核验课件',
      question: '预计学习时长最多1分钟',
      scope: 'current_account',
      maxDurationMinutes: 1,
      remind: true,
      reportRequested: true,
      confirmed: true
    })
    for (let count = 1; count <= 3; count++) {
      await generate()
      const task = runtime.tasks.value.find((task) => task.id === id)!
      const awaiting = task.entries.filter((entry) => entry.status === 'awaiting_confirmation')
      expect(awaiting).toHaveLength(1)
      expect(awaiting[0].creatorId).toBe('1001')
      expect(awaiting[0].creator).toContain('Sarah')
      expect(task.trainerFailures['1001']).toBe(count)
      expect(task.escalations).toHaveLength(count === 3 ? 1 : 0)
      expect(runtime.acknowledge(id, awaiting[0].id)).toBe(true)
    }
    const task = runtime.tasks.value.find((task) => task.id === id)!
    expect(task.entries.filter((entry) => entry.outcome === 'acknowledged')).toHaveLength(3)
    expect(task.escalations[0].status).toBe('simulated')
    expect(task.escalations[0].content).toContain('已形成飞书汇报')
    expect(task.escalations[0].recipientUserId).toBe('1001')
  })
})
