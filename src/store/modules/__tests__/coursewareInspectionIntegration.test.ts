import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed } from 'vue'
vi.mock('@/api/courseware', () => ({
  CoursewareApi: {
    getGenerationTask: vi.fn(),
    getCoursewarePage: vi.fn(),
    getCourseware: vi.fn(),
    getActiveGenerationTask: vi.fn()
  }
}))
vi.mock('@/utils/auth', () => ({ getAccessToken: () => 'token' }))
vi.mock('@/store/modules/user', async () => {
  const { defineStore } = await import('pinia')
  return {
    useUserStore: defineStore('inspection-test-user', {
      state: () => ({ getUser: { id: 7 }, getRoles: ['trainer'] })
    })
  }
})
import { CoursewareApi } from '@/api/courseware'
import { planRequest, toInspectionRules } from '@/beauty/lib/inspectionRequest'
import { createCoursewareInspectionFixtures } from '@/beauty/lib/coursewareInspectionFixtures'
import { useUserStore } from '@/store/modules/user'
import { useCoursewareGenerationStore } from '../coursewareGeneration'
import {
  useCoursewareInspectionRuntime as useProductRuntime,
  collectCoursewareInspectionSnapshot,
  collectTrainingInspectionRecord
} from '@/beauty/lib/coursewareInspectionRuntime'

// 既有用例只断言其自行创建的任务，不依赖产品初始任务的数量或排序。
function useCoursewareInspectionRuntime() {
  const runtime = useProductRuntime()
  return {
    ...runtime,
    tasks: computed(() =>
      runtime.tasks.value.filter((task) => !task.id.startsWith('business-seed-'))
    )
  }
}

const rules = {
  name: '监督',
  question: '监督预计学习时长',
  scope: 'current_account' as const,
  minDurationMinutes: 10,
  remind: true,
  reportRequested: true,
  confirmed: true as const
}
const tick = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
describe('课件生成事件监督集成', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(() => useCoursewareGenerationStore().clear())
  it('一次查询使用课件分页读取并保存独立完成记录', async () => {
    const runtime = useCoursewareInspectionRuntime()
    vi.mocked(CoursewareApi.getCoursewarePage).mockResolvedValue({
      total: 1,
      list: [{ id: 501, title: '产品知识', estimatedDurationSeconds: 420 }]
    })
    const id = await runtime.executeQuery(
      planRequest('查一下当前课件预计学习时长，5到10分钟合格'),
      { confirmed: true }
    )
    expect(CoursewareApi.getCoursewarePage).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 100,
      keyword: undefined
    })
    const task = runtime.tasks.value.find((item) => item.id === id)!
    expect(task.completedAt).toBeTruthy()
    expect(task.queryResult?.rows[0].result).toBe('符合时长要求')
    useCoursewareGenerationStore().setTask({ id: 999, status: 'running', title: '产品知识' })
    expect(task.entries).toHaveLength(0)
    expect(task.trainerFailures).toEqual({})
  })
  it('真实课件查询读取中不保存任务，回包后才产生完成记录且不进入监督列表', async () => {
    const runtime = useProductRuntime()
    const initial = JSON.stringify(runtime.productTasks.value)
    let resolve!: (value: any) => void
    vi.mocked(CoursewareApi.getCoursewarePage).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const pending = runtime.executeQuery(planRequest('查一下当前课件预计学习时长，5到10分钟合格'), {
      confirmed: true
    })
    await vi.waitFor(() => expect(CoursewareApi.getCoursewarePage).toHaveBeenCalledTimes(1))
    expect(JSON.stringify(runtime.productTasks.value)).toBe(initial)
    expect(runtime.productTasks.value.some((task) => task.queryPending)).toBe(false)
    resolve({ total: 1, list: [{ id: 502, title: '实际读取课件', estimatedDurationSeconds: 420 }] })
    const id = await pending
    const task = runtime.productTasks.value.find((item) => item.id === id)!
    expect(task.completedAt).toBeTruthy()
    expect(task.queryResult?.rows[0].title).toBe('实际读取课件')
    expect(task.queryPending).toBeUndefined()
    expect(task.entries).toHaveLength(0)
    expect(runtime.advancePresentation(id)).toBe(false)
    expect(runtime.productTasks.value.filter((item) => !item.completedAt)).toHaveLength(5)
    expect(runtime.productTasks.value.filter((item) => item.completedAt)).toHaveLength(7)
  })
  it('产品runtime载入v4时归档两领域查询，保留准备数据并持久化v5，生产者不改查询历史', () => {
    const key = 'courseware:inspection:v1:7:trainer'
    const fixtures = createCoursewareInspectionFixtures(
      { userId: 7, role: 'trainer', displayName: '林悦' },
      new Date(Date.now() - 86400_000)
    )
    const queries = fixtures.filter((task) => task.id.startsWith('business-seed-v4:'))
    for (const task of queries) {
      task.queryPending = true
      task.pendingQueryResult = task.queryResult
      delete task.queryResult
      delete task.completedAt
      const entry = task.entries[0]
      entry.status = 'checking'
      entry.presentationStage = 1
      entry.events = entry.events.slice(0, 2)
      entry.summary = entry.events[1].text
      delete entry.completedAt
    }
    const prepared = queries.map((task) => JSON.parse(JSON.stringify(task.pendingQueryResult)))
    const originalEvents = queries.map((task) => JSON.parse(JSON.stringify(task.entries[0].events)))
    localStorage.setItem(key, JSON.stringify({ tasks: fixtures, knownIds: [456], seedVersion: 4 }))
    const runtime = useProductRuntime()
    expect(runtime.productTasks.value).toHaveLength(11)
    expect(runtime.productTasks.value.filter((task) => !task.completedAt)).toHaveLength(5)
    expect(runtime.productTasks.value.filter((task) => task.completedAt)).toHaveLength(6)
    queries.forEach((original, index) => {
      const task = runtime.productTasks.value.find((item) => item.id === original.id)!
      expect(task.queryResult).toEqual(prepared[index])
      expect(task.queryPending).toBeUndefined()
      expect(task.pendingQueryResult).toBeUndefined()
      expect(task.entries[0].events.slice(0, 2)).toEqual(originalEvents[index])
      expect(task.entries[0].events).toHaveLength(5)
      expect(task.entries[0].completedAt).toBe(task.completedAt)
      expect(runtime.advancePresentation(task.id)).toBe(false)
    })
    expect(JSON.parse(localStorage.getItem(key)!).seedVersion).toBe(5)
    expect(JSON.parse(localStorage.getItem(key)!).knownIds).toEqual([456])
    const before = JSON.stringify(runtime.productTasks.value.filter((task) => task.mode === 'once'))
    useCoursewareGenerationStore().setTask({ id: 802, status: 'running', title: '新品精华' })
    collectTrainingInspectionRecord({
      id: 'after-query-migration',
      person: '李欣',
      personId: 'li-xin',
      region: '南区',
      product: '新品',
      title: '新品培训',
      checkedAt: new Date(Date.now() + 1000).toISOString(),
      score: 72,
      courseCompleted: false
    })
    expect(JSON.stringify(runtime.productTasks.value.filter((task) => task.mode === 'once'))).toBe(
      before
    )
  })
  it('培训查询和事件共享当前身份runtime，课件store不会写入培训任务', async () => {
    const runtime = useCoursewareInspectionRuntime()
    const plan = planRequest(
      '持续监督南区李欣以后新增的新品培训，完课且80分，不合规提醒本人，连续3次汇报'
    )
    const id = runtime.createTask({ ...toInspectionRules(plan), confirmed: true })
    const task = runtime.tasks.value.find((task) => task.id === id)!
    useCoursewareGenerationStore().setTask({ id: 888, title: '新品课件', status: 'running' })
    expect(task.entries).toHaveLength(0)
    expect(
      collectTrainingInspectionRecord({
        id: 'training-event',
        person: '李欣',
        personId: 'li-xin',
        region: '南区',
        product: '新品',
        title: '新品应用培训',
        checkedAt: new Date(Date.now() + 1000).toISOString(),
        score: 72,
        courseCompleted: false
      })
    ).toBe(true)
    expect(task.entries).toHaveLength(1)
    expect(task.entries[0].status).toBe('awaiting_confirmation')
    const once = planRequest('只查一次当前记录', plan)
    const queryId = await runtime.executeQuery(once, { confirmed: true })
    const query = runtime.tasks.value.find((task) => task.id === queryId)!
    expect(query.subject).toBe('training')
    expect(query.completedAt).toBeTruthy()
    expect(
      query.queryResult?.rows.every(
        (row) => row.person === '李欣' && row.region === '南区' && row.product === '新品'
      )
    ).toBe(true)
    expect(CoursewareApi.getCoursewarePage).not.toHaveBeenCalled()
    expect(runtime.advancePresentation(queryId)).toBe(false)
  })
  it('产品入口自动载入业务任务，正常store事件接续且新提醒仍走弹窗', async () => {
    const runtime = useProductRuntime()
    const running = runtime.productTasks.value.filter((task) => !task.completedAt)
    expect(running).toHaveLength(5)
    expect(running.every((task) => task.mode === 'continuous')).toBe(true)
    expect(runtime.productTasks.value.filter((task) => task.queryPending)).toHaveLength(0)
    expect(runtime.productTasks.value.filter((task) => task.completedAt)).toHaveLength(6)
    expect(runtime.productTasks.value.filter((task) => task.mode === 'once')).toHaveLength(4)
    expect(
      runtime.productTasks.value.find((task) => task.id === 'business-seed-v3:7:trainer:training')
        ?.subject
    ).toBe('training')
    expect(
      runtime.productTasks.value
        .flatMap((task) => task.entries)
        .filter((entry) => entry.status === 'awaiting_confirmation')
        .every((entry) => entry.notificationState === 'inbox')
    ).toBe(true)
    const store = useCoursewareGenerationStore()
    store.setTask({ id: 701, status: 'running', title: '敏感肌保湿护理' })
    vi.mocked(CoursewareApi.getGenerationTask).mockResolvedValue({
      id: 701,
      status: 'succeeded',
      done: true,
      title: '敏感肌保湿护理',
      resultCoursewareId: 1701
    })
    vi.mocked(CoursewareApi.getCourseware).mockResolvedValue({
      id: 1701,
      title: '敏感肌保湿护理',
      creator: '7',
      creatorName: 'Sarah',
      estimatedDurationSeconds: 300
    })
    await store.refreshTask()
    await tick()
    const entries = runtime.productTasks.value
      .flatMap((task) => task.entries)
      .filter((entry) => entry.generationTaskId === 701)
    expect(entries).toHaveLength(1)
    expect(entries[0].status).toBe('awaiting_confirmation')
    expect(entries[0].notificationState).toBeUndefined()
    expect(CoursewareApi.getCourseware).toHaveBeenCalledTimes(1)
  })
  it('创建或确认请求的回包不能跨账号写入新账号的生成任务', () => {
    const store = useCoursewareGenerationStore()
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    const context = store.captureTaskContext()
    useUserStore().$patch({ getUser: { id: 8 } } as any)
    runtime.createTask(rules)
    expect(store.setTask({ id: 91, status: 'running' }, context)).toBe(false)
    expect(store.task).toBeUndefined()
    expect(runtime.tasks.value[0].entries).toHaveLength(0)
    expect(store.isTaskContextCurrent(context)).toBe(false)
    const currentContext = store.captureTaskContext()
    expect(store.setTask({ id: 92, status: 'running' }, currentContext)).toBe(true)
    expect(runtime.tasks.value[0].entries[0].generationTaskId).toBe(92)
  })
  it('setTask和refreshTask两条路径接入，完成后只查一次metadata，不增加轮询', async () => {
    const store = useCoursewareGenerationStore()
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    const interval = vi.spyOn(window, 'setInterval')
    store.setTask({ id: 1, status: 'running' })
    vi.mocked(CoursewareApi.getGenerationTask).mockResolvedValue({
      id: 1,
      status: 'succeeded',
      done: true,
      resultCoursewareId: 101
    })
    vi.mocked(CoursewareApi.getCourseware).mockResolvedValue({
      id: 101,
      title: '培训',
      creator: '7',
      creatorName: 'Sarah',
      estimatedDurationSeconds: 300
    })
    await store.refreshTask()
    await tick()
    expect(runtime.tasks.value[0].entries[0].status).toBe('awaiting_confirmation')
    expect(runtime.tasks.value[0].entries[0].creator).toBe('Sarah')
    expect(CoursewareApi.getCourseware).toHaveBeenCalledTimes(1)
    expect(interval).toHaveBeenCalledTimes(1)
    store.setTask({
      id: 1,
      status: 'succeeded',
      done: true,
      resultCoursewareId: 101,
      snapshotVersion: 8
    })
    await store.refreshTask()
    await tick()
    expect(CoursewareApi.getCourseware).toHaveBeenCalledTimes(1)
    expect(runtime.tasks.value[0].trainerFailures['7']).toBe(1)
    expect(store.pollTimer).toBeUndefined()
  })
  it('切换账号期间丢弃的metadata不永久缓存，切回原账号可由同版本事件重试', async () => {
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    await collectCoursewareInspectionSnapshot({ id: 10, status: 'running' })
    let resolve!: (value: any) => void
    vi.mocked(CoursewareApi.getCourseware).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const dto = {
      id: 10,
      status: 'succeeded',
      done: true,
      resultCoursewareId: 110,
      snapshotVersion: 2
    }
    const pending = collectCoursewareInspectionSnapshot(dto)
    useUserStore().$patch({ getUser: { id: 8 } } as any)
    resolve({ id: 110, creator: '7', estimatedDurationSeconds: 300 })
    await pending
    useUserStore().$patch({ getUser: { id: 7 } } as any)
    vi.mocked(CoursewareApi.getCourseware).mockResolvedValue({
      id: 110,
      title: '培训',
      creator: '7',
      estimatedDurationSeconds: 300
    })
    await collectCoursewareInspectionSnapshot(dto)
    expect(CoursewareApi.getCourseware).toHaveBeenCalledTimes(2)
    expect(runtime.tasks.value[0].entries[0].status).toBe('awaiting_confirmation')
  })
  it('非数字creator只能作为姓名，不能伪造当前账号身份', async () => {
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    await collectCoursewareInspectionSnapshot({ id: 1, status: 'running' })
    vi.mocked(CoursewareApi.getCourseware).mockResolvedValue({
      id: 101,
      creator: 'Sarah',
      estimatedDurationSeconds: 300
    })
    await collectCoursewareInspectionSnapshot({
      id: 1,
      status: 'succeeded',
      done: true,
      resultCoursewareId: 101
    })
    expect(runtime.tasks.value[0].entries[0].status).toBe('missing_evidence')
    expect(runtime.tasks.value[0].entries[0].creatorId).toBeUndefined()
    expect(runtime.tasks.value[0].trainerFailures).toEqual({})
  })
  it('失败后由新快照重试；同一成功快照不重复请求', async () => {
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    await collectCoursewareInspectionSnapshot({ id: 1, status: 'running' })
    const dto = {
      id: 1,
      status: 'succeeded',
      done: true,
      resultCoursewareId: 101,
      snapshotVersion: 1
    }
    vi.mocked(CoursewareApi.getCourseware).mockRejectedValueOnce(new Error('network'))
    await collectCoursewareInspectionSnapshot(dto)
    vi.mocked(CoursewareApi.getCourseware).mockResolvedValue({
      id: 101,
      creator: '7',
      estimatedDurationSeconds: 300
    })
    await collectCoursewareInspectionSnapshot(dto)
    await collectCoursewareInspectionSnapshot(dto)
    expect(CoursewareApi.getCourseware).toHaveBeenCalledTimes(2)
    expect(runtime.tasks.value[0].entries[0].status).toBe('awaiting_confirmation')
  })
  it('成功但缺证据的旧版本缓存不阻断新版本补证据', async () => {
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    await collectCoursewareInspectionSnapshot({ id: 1, status: 'running' })
    const dto = {
      id: 1,
      status: 'succeeded',
      done: true,
      resultCoursewareId: 101,
      snapshotVersion: 1
    }
    vi.mocked(CoursewareApi.getCourseware).mockResolvedValueOnce({ id: 101, creator: '7' })
    await collectCoursewareInspectionSnapshot(dto)
    await collectCoursewareInspectionSnapshot(dto)
    expect(CoursewareApi.getCourseware).toHaveBeenCalledTimes(1)
    vi.mocked(CoursewareApi.getCourseware).mockResolvedValueOnce({
      id: 101,
      creator: '7',
      estimatedDurationSeconds: 300
    })
    await collectCoursewareInspectionSnapshot({ ...dto, snapshotVersion: 2 })
    expect(CoursewareApi.getCourseware).toHaveBeenCalledTimes(2)
    expect(runtime.tasks.value[0].entries[0].status).toBe('awaiting_confirmation')
  })
  it('系列按各子课件ID查询和核验，不读取父级合计；同批第三件不合规也升级', async () => {
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    await collectCoursewareInspectionSnapshot({ id: 1, status: 'running' })
    vi.mocked(CoursewareApi.getCourseware).mockImplementation(async (id) => ({
      id,
      creator: '7',
      creatorName: 'Sarah',
      estimatedDurationSeconds: 300
    }))
    const dto = {
      id: 1,
      status: 'succeeded',
      done: true,
      coursewareId: 999,
      series: {
        seriesId: 'series-1',
        title: '系列',
        items: [101, 102, 103].map((id, i) => ({
          childJobId: `child-${i}`,
          coursewareId: id,
          title: `子课件${i + 1}`,
          partIndex: i + 1,
          partCount: 3,
          status: 'succeeded'
        }))
      }
    }
    await collectCoursewareInspectionSnapshot(dto)
    await collectCoursewareInspectionSnapshot(dto)
    const task = runtime.tasks.value[0]
    expect(CoursewareApi.getCourseware).toHaveBeenCalledTimes(3)
    expect(CoursewareApi.getCourseware).not.toHaveBeenCalledWith(999)
    expect(
      task.entries
        .filter((entry) => entry.status === 'awaiting_confirmation')
        .map((entry) => entry.coursewareId)
    ).toEqual([101, 102, 103])
    expect(task.trainerFailures['7']).toBe(3)
    expect(task.escalations).toHaveLength(1)
  })
  it('系列中合规产物清零且不提醒；分配ID后衔接原子任务不重复', async () => {
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    const base = {
      id: 1,
      status: 'running',
      series: {
        seriesId: 's',
        title: '系列',
        items: [1, 2, 3].map((i) => ({
          childJobId: `c${i}`,
          title: `课件${i}`,
          partIndex: i,
          partCount: 3,
          status: 'running'
        }))
      }
    }
    await collectCoursewareInspectionSnapshot(base)
    vi.mocked(CoursewareApi.getCourseware).mockImplementation(async (id) => ({
      id,
      creator: '7',
      estimatedDurationSeconds: id === 102 ? 900 : 300
    }))
    await collectCoursewareInspectionSnapshot({
      ...base,
      status: 'succeeded',
      done: true,
      series: {
        ...base.series,
        items: base.series.items.map((item, i) => ({
          ...item,
          status: 'succeeded',
          coursewareId: 101 + i
        }))
      }
    })
    const task = runtime.tasks.value[0]
    expect(task.entries).toHaveLength(3)
    expect(task.entries[1].outcome).toBe('passed')
    expect(task.entries.filter((entry) => entry.status === 'awaiting_confirmation')).toHaveLength(2)
    expect(task.trainerFailures['7']).toBe(1)
    expect(task.escalations).toHaveLength(0)
  })
  it('首次系列终态有新创建时间即使无父ID也核验各子产物', async () => {
    const runtime = useCoursewareInspectionRuntime()
    const taskId = runtime.createTask(rules)
    const created = new Date(Date.parse(runtime.tasks.value[0].createdAt) + 1000)
    vi.mocked(CoursewareApi.getCourseware).mockResolvedValue({
      id: 101,
      creator: '7',
      estimatedDurationSeconds: 900
    })
    await collectCoursewareInspectionSnapshot({
      id: 1,
      status: 'succeeded',
      done: true,
      createTime: created,
      series: {
        seriesId: 's',
        title: '系列',
        items: [
          {
            childJobId: 'a',
            coursewareId: 101,
            title: '子课件',
            partIndex: 1,
            partCount: 1,
            status: 'succeeded'
          }
        ]
      }
    })
    expect(runtime.tasks.value.find((task) => task.id === taskId)?.entries[0].outcome).toBe(
      'passed'
    )
  })
  it('无授权任务不请求metadata；新监督不倒灌旧完成', async () => {
    const store = useCoursewareGenerationStore()
    store.setTask({ id: 1, status: 'succeeded', done: true, resultCoursewareId: 101 })
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    store.setTask({ id: 1, status: 'succeeded', done: true, resultCoursewareId: 101 })
    await tick()
    expect(CoursewareApi.getCourseware).not.toHaveBeenCalled()
    expect(runtime.tasks.value[0].entries).toHaveLength(0)
  })
  it('metadata缺失、失败均待证据，不把生成目标当时长', async () => {
    const store = useCoursewareGenerationStore()
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    store.setTask({ id: 1, status: 'running' })
    vi.mocked(CoursewareApi.getCourseware).mockRejectedValue(new Error('network'))
    store.setTask({
      id: 1,
      status: 'succeeded',
      done: true,
      resultCoursewareId: 101,
      promptEnhancement: { summary: { targetDurationMinutes: 10 } }
    })
    await tick()
    expect(runtime.tasks.value[0].entries[0].status).toBe('missing_evidence')
    expect(runtime.tasks.value[0].trainerFailures).toEqual({})
  })
  it('暂停后metadata回包不补发提醒，旧事项明确中止', async () => {
    let resolve!: (data: unknown) => void
    vi.mocked(CoursewareApi.getCourseware).mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    const store = useCoursewareGenerationStore()
    const runtime = useCoursewareInspectionRuntime()
    const id = runtime.createTask(rules)
    store.setTask({ id: 1, status: 'running' })
    store.setTask({ id: 1, status: 'succeeded', done: true, resultCoursewareId: 101 })
    runtime.pauseTask(id)
    resolve({ id: 101, creator: 'Sarah', estimatedDurationSeconds: 300 })
    await tick()
    runtime.resumeTask(id)
    expect(runtime.tasks.value[0].entries[0].outcome).toBe('stopped')
    expect(runtime.tasks.value[0].trainerFailures).toEqual({})
    expect(runtime.tasks.value[0].escalations).toEqual([])
  })
  it('生成刷新回包跨账号时丢弃，不更新另一账号的store或监督', async () => {
    let resolve!: (data: unknown) => void
    vi.mocked(CoursewareApi.getGenerationTask).mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    const store = useCoursewareGenerationStore()
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    store.setTask({ id: 1, status: 'running' })
    const request = store.refreshTask()
    useUserStore().$patch({ getUser: { id: 8 } } as any)
    resolve({ id: 1, status: 'succeeded', done: true, resultCoursewareId: 101 })
    await request
    expect(CoursewareApi.getCourseware).not.toHaveBeenCalled()
    expect(store.task?.status).toBe('running')
    expect(runtime.tasks.value).toHaveLength(0)
  })
  it('账号切换后丢弃在途metadata，旧账号记录不被新账号污染', async () => {
    let resolve!: (data: unknown) => void
    vi.mocked(CoursewareApi.getCourseware).mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    const store = useCoursewareGenerationStore()
    const runtime = useCoursewareInspectionRuntime()
    runtime.createTask(rules)
    store.setTask({ id: 1, status: 'running' })
    store.setTask({ id: 1, status: 'succeeded', done: true, resultCoursewareId: 101 })
    useUserStore().$patch({ getUser: { id: 8 } } as any)
    resolve({ id: 101, creator: '7', estimatedDurationSeconds: 300 })
    await tick()
    expect(runtime.tasks.value).toHaveLength(0)
    useUserStore().$patch({ getUser: { id: 7 } } as any)
    expect(runtime.tasks.value[0].entries[0].status).toBe('missing_evidence')
  })
})
