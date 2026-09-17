import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/courseware', () => ({
  CoursewareApi: {
    getActiveGenerationTask: vi.fn(),
    getGenerationTask: vi.fn()
  }
}))

vi.mock('@/utils/auth', () => ({
  getAccessToken: vi.fn()
}))

import { CoursewareApi, type CoursewareGenerationTaskVO } from '@/api/courseware'
import { getAccessToken } from '@/utils/auth'
import { useCoursewareGenerationStore } from '../coursewareGeneration'

const getActiveGenerationTask = vi.mocked(CoursewareApi.getActiveGenerationTask)
const getGenerationTask = vi.mocked(CoursewareApi.getGenerationTask)
const mockedGetAccessToken = vi.mocked(getAccessToken)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((currentResolve, currentReject) => {
    resolve = currentResolve
    reject = currentReject
  })
  return { promise, resolve, reject }
}

function task(id: number, status: number | string = 'running'): CoursewareGenerationTaskVO {
  return { id, status, progress: 20 }
}

describe('courseware generation store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedGetAccessToken.mockReturnValue('access-token')
  })

  afterEach(() => {
    useCoursewareGenerationStore().clear()
  })

  it('does not request an active task before authentication', async () => {
    mockedGetAccessToken.mockReturnValue(undefined)
    const store = useCoursewareGenerationStore()

    await store.init()

    expect(getActiveGenerationTask).not.toHaveBeenCalled()
    expect(store.initialized).toBe(false)
    expect(store.isGenerating).toBe(false)
  })

  it('shares initialization and ignores an active-task response after task replacement', async () => {
    const pending = deferred<CoursewareGenerationTaskVO | undefined>()
    getActiveGenerationTask.mockReturnValue(pending.promise)
    const store = useCoursewareGenerationStore()

    const first = store.init()
    const second = store.init()
    expect(getActiveGenerationTask).toHaveBeenCalledTimes(1)

    store.setTask(task(2))
    pending.resolve(task(1))
    await Promise.all([first, second])

    expect(store.task?.id).toBe(2)
  })

  it('does not let a stale polling response overwrite a newer task', async () => {
    const pending = deferred<CoursewareGenerationTaskVO>()
    getGenerationTask.mockReturnValue(pending.promise)
    const store = useCoursewareGenerationStore()
    store.setTask(task(1))

    const refresh = store.refreshTask()
    store.setTask(task(2))
    pending.resolve({ ...task(1, 'succeeded'), progress: 100 })
    await refresh

    expect(store.task?.id).toBe(2)
    expect(store.task?.status).toBe('running')
  })

  it('allows only one request per task while slow polling is in flight', async () => {
    const pending = deferred<CoursewareGenerationTaskVO>()
    getGenerationTask.mockReturnValue(pending.promise)
    const store = useCoursewareGenerationStore()
    store.setTask(task(1))
    const first = store.refreshTask()
    await store.refreshTask()
    await store.refreshTask()
    expect(getGenerationTask).toHaveBeenCalledTimes(1)
    expect(getGenerationTask).toHaveBeenCalledWith(1, { silentNetworkError: true })
    pending.resolve({ ...task(1), progress: 35 })
    await first
    expect(store.task?.progress).toBe(35)
    await store.refreshTask()
    expect(getGenerationTask).toHaveBeenCalledTimes(2)
  })

  it('keeps real progress after a timeout and clears the notice on recovery', async () => {
    const store = useCoursewareGenerationStore()
    store.setTask(task(1))
    getGenerationTask.mockRejectedValueOnce(new Error('timeout'))
    await store.refreshTask()
    expect(store.pollError).toBe(true)
    expect(store.task).toEqual(task(1))
    expect(store.isGenerating).toBe(true)
    getGenerationTask.mockResolvedValueOnce({ ...task(1), progress: 40 })
    await store.refreshTask()
    expect(store.pollError).toBe(false)
    expect(store.task?.progress).toBe(40)
  })

  it('does not let a late error affect another task or block its refresh', async () => {
    const pending = deferred<CoursewareGenerationTaskVO>()
    getGenerationTask.mockReturnValueOnce(pending.promise)
    const store = useCoursewareGenerationStore()
    store.setTask(task(1))
    const first = store.refreshTask()
    store.setTask(task(2))
    getGenerationTask.mockResolvedValueOnce({ ...task(2), progress: 45 })
    await store.refreshTask()
    pending.reject(new Error('timeout'))
    await first
    expect(store.pollError).toBe(false)
    expect(store.task?.id).toBe(2)
    expect(store.task?.progress).toBe(45)
    expect(store.refreshingTaskIds).toEqual([])
  })

  it('keeps a nominally succeeded task polling until the durable result is ready', () => {
    const store = useCoursewareGenerationStore()

    store.setTask({ ...task(1, 'succeeded'), progress: 100, done: false })
    expect(store.isGenerating).toBe(true)
    expect(store.isTerminal).toBe(false)

    store.setTask({ ...task(1, 'succeeded'), progress: 100, done: true })
    expect(store.isGenerating).toBe(false)
    expect(store.isTerminal).toBe(true)
  })

  it('does not create polling or synthetic progress without a task', async () => {
    const store = useCoursewareGenerationStore()
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    store.startPolling()
    await store.refreshTask()

    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(store.loadingProgress).toBe(0)
  })
  it('rejects older provider versions even when requests return in order', async () => {
    const store = useCoursewareGenerationStore()
    store.setTask({ ...task(1), snapshotVersion: 10 })
    getGenerationTask.mockResolvedValue({ ...task(1), snapshotVersion: 8, progress: 5 })
    await store.refreshTask()
    expect(store.task?.snapshotVersion).toBe(10)
    expect(store.task?.progress).toBe(20)
    store.setTask({ ...task(1), snapshotVersion: 9 })
    expect(store.task?.snapshotVersion).toBe(10)
    getGenerationTask.mockResolvedValue({ ...task(1), snapshotVersion: 11, progress: 30 })
    await store.refreshTask()
    expect(store.task?.progress).toBe(30)
  })
})
