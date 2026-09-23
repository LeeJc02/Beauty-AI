import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetCoursewareMockStoreForTests,
  coursewareRoutes
} from './courseware'
import type { MockCtx } from '../types'

const handler = (method: MockCtx['method'], path: string) => {
  const route = coursewareRoutes.find((item) => item.method === method && item.path === path)
  if (!route || typeof route.path !== 'string') throw new Error(`mock route missing: ${method} ${path}`)
  return route.handler
}

const call = (
  method: MockCtx['method'],
  path: string,
  query: Record<string, any> = {},
  body: any = {}
) =>
  handler(method, path)({
    method,
    path,
    query,
    body,
    config: {} as MockCtx['config']
  })

describe('courseware mock generation flow', () => {
  beforeEach(() => {
    __resetCoursewareMockStoreForTests()
    localStorage.removeItem('beauty-ai:demo-role')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-18T08:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.removeItem('beauty-ai:demo-role')
    __resetCoursewareMockStoreForTests()
  })

  it('keeps a selected later part and completes it into a previewable courseware', async () => {
    const created = await call('POST', '/ai/courseware/generation-task/create', {}, {
      language: 'cn',
      description: '价格异议处理',
      materialFiles: [{ name: 'barrier-shield.pdf' }],
      brandIds: [1],
      categoryIds: [11],
      productIds: [101]
    })
    expect(created.step).toBe('waiting_for_user')

    const answered = await call(
      'POST',
      '/ai/courseware/generation-task/answer',
      { id: created.id },
      {
        answers: [
          { id: 'audience', value: 'store-ba' },
          { id: 'scenario', value: 'price' },
          { id: 'split', value: 'two' }
        ]
      }
    )
    expect(answered.step).toBe('waiting_for_confirmation')

    const splitting = await call(
      'POST',
      '/ai/courseware/generation-task/confirm',
      { id: created.id },
      { confirmed: true }
    )
    expect(splitting.step).toBe('splitting_outline')

    vi.setSystemTime(Date.now() + 3201)
    const parts = await call('GET', '/ai/courseware/generation-task/get', { id: created.id })
    expect(parts.step).toBe('waiting_for_part_selection')
    expect(parts.partSelection.parts).toHaveLength(2)

    const generating = await call(
      'POST',
      '/ai/courseware/generation-task/confirm',
      { id: created.id },
      { confirmed: true, selectedPartIndexes: [2] }
    )
    expect(generating.step).toBe('generating_children')
    expect(generating.generation.pages.length).toBeGreaterThan(0)
    expect(generating.generation.pages.every((page: any) => page.partIndex === 2)).toBe(true)

    vi.setSystemTime(Date.now() + generating.generation.pages.length * 2600 + 801)
    const finalizing = await call('GET', '/ai/courseware/generation-task/get', { id: created.id })
    expect(finalizing.step).toBe('finalizing')

    vi.setSystemTime(Date.now() + 2601)
    const done = await call('GET', '/ai/courseware/generation-task/get', { id: created.id })
    expect(done.step).toBe('completed')
    expect(done.resultCoursewareId).toBeTypeOf('number')
    expect(done.generation.pages.every((page: any) => page.partIndex === 2)).toBe(true)

    const courseware = await call('GET', '/ai/courseware/get', { id: done.resultCoursewareId })
    expect(courseware.id).toBe(done.resultCoursewareId)
    expect(courseware.catalogBrandCount).toBe(1)
    expect(courseware.previewUrl).toBe('/mock-classroom.html')
    const embed = await call('GET', '/ai/courseware/salesboost/embed', { id: done.resultCoursewareId })
    expect(embed.coursewareId).toBe(done.resultCoursewareId)
    expect(embed.token).toContain(String(done.resultCoursewareId))
  })

  it('保留生成发起人身份，系列产物各有独立ID与预计学习时长', async () => {
    localStorage.setItem('beauty-ai:demo-role', 'hq_trainer')
    const created = await call('POST', '/ai/courseware/generation-task/create', {}, { description: '系列课件', language: 'cn' })
    await call('POST', '/ai/courseware/generation-task/answer', { id: created.id }, { answers: [{ id: 'split', value: 'two' }] })
    await call('POST', '/ai/courseware/generation-task/confirm', { id: created.id }, { confirmed: true })
    vi.setSystemTime(Date.now() + 3201)
    const planned = await call('GET', '/ai/courseware/generation-task/get', { id: created.id })
    expect(planned.partSelection.parts).toHaveLength(2)
    const generating = await call('POST', '/ai/courseware/generation-task/confirm', { id: created.id }, { confirmed: true, selectedPartIndexes: [1, 2] })
    // 切换角色不能改变已发起任务的产物创建人，也不能把它当作新角色的active任务。
    localStorage.setItem('beauty-ai:demo-role', 'regional_trainer')
    expect(await call('GET', '/ai/courseware/generation-task/active')).toBeNull()
    vi.setSystemTime(Date.now() + generating.generation.pages.length * 2600 + 801)
    await call('GET', '/ai/courseware/generation-task/get', { id: created.id })
    vi.setSystemTime(Date.now() + 2601)
    const done = await call('GET', '/ai/courseware/generation-task/get', { id: created.id })
    const ids = done.series.items.map((part: any) => part.resultCoursewareId)
    expect(new Set(ids).size).toBe(2)
    for (const part of done.series.items) {
      const metadata = await call('GET', '/ai/courseware/get', { id: part.resultCoursewareId })
      expect(metadata.creator).toBe('1001')
      expect(metadata.creatorName).toContain('Sarah')
      expect(metadata.estimatedDurationSeconds).toBe(part.estimatedDurationSeconds)
    }
  })

  it('supports the browser upload-session contract used by the create page', async () => {
    const initialized = await call('POST', '/infra/file/upload-session/init', {}, {
      name: 'training.pdf',
      size: 42,
      type: 'application/pdf'
    })
    expect(initialized.uploadId).toMatch(/^mock-upload-/)
    expect(initialized.objectKey).toContain('training.pdf')

    const refreshed = await call('POST', '/infra/file/upload-session/refresh', {}, {
      uploadId: initialized.uploadId
    })
    expect(refreshed.uploadId).toBe(initialized.uploadId)

    const completed = await call('POST', '/infra/file/upload-session/complete', {}, {
      uploadId: initialized.uploadId,
      objectKey: initialized.objectKey,
      name: 'training.pdf',
      size: 42,
      type: 'application/pdf'
    })
    expect(completed.objectUrl).toBe('/mock/files/training.pdf')
    expect(await call('POST', '/infra/file/upload-session/abort', {}, { uploadId: initialized.uploadId })).toBe(true)
  })
})
