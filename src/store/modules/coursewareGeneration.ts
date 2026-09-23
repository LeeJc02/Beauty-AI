import { CoursewareApi, CoursewareGenerationTaskVO } from '@/api/courseware'
import { getAccessToken } from '@/utils/auth'
import {
  isCoursewareTaskActive,
  isCoursewareTaskFailed,
  isCoursewareTaskResultReady,
  isCoursewareTaskSucceeded,
  resolveCoursewareTaskProgress
} from '@/views/courseware/create/generationTask'
import { defineStore } from 'pinia'
import {
  collectCoursewareInspectionSnapshot,
  useCoursewareInspectionRuntime
} from '@/beauty/lib/coursewareInspectionRuntime'

interface CoursewareGenerationState {
  task?: CoursewareGenerationTaskVO
  loadingProgress: number
  refreshingTaskIds: number[]
  pollError: boolean
  pollTimer?: number
  initialized: boolean
  taskRevision: number
  inspectionIdentityKey?: string
  acknowledgedTaskIds: number[]
  initializationPromise?: Promise<void>
}

export const useCoursewareGenerationStore = defineStore('coursewareGeneration', {
  state: (): CoursewareGenerationState => ({
    task: undefined,
    loadingProgress: 0,
    refreshingTaskIds: [],
    pollError: false,
    pollTimer: undefined,
    initialized: false,
    taskRevision: 0,
    acknowledgedTaskIds: [],
    initializationPromise: undefined
  }),
  getters: {
    showPrompt: (state) =>
      Boolean(
        state.task &&
        (!isCoursewareTaskResultReady(state.task) ||
          !state.acknowledgedTaskIds.includes(state.task.id))
      ),
    displayProgress: (state) =>
      state.task ? resolveCoursewareTaskProgress(state.task) : (state.loadingProgress ?? 0),
    isGenerating: (state) => {
      const task = state.task
      if (!task) return false
      return (
        isCoursewareTaskActive(task.status) ||
        (isCoursewareTaskSucceeded(task.status) && !isCoursewareTaskResultReady(task))
      )
    },
    isTerminal: (state) =>
      isCoursewareTaskResultReady(state.task) || isCoursewareTaskFailed(state.task?.status),
    promptClass(): string {
      if (isCoursewareTaskResultReady(this.task)) return 'is-success'
      if (isCoursewareTaskFailed(this.task?.status)) return 'is-error'
      return 'is-generating'
    },
    promptIcon(): string {
      if (isCoursewareTaskResultReady(this.task)) return 'ep:circle-check'
      if (isCoursewareTaskFailed(this.task?.status)) return 'ep:circle-close'
      return 'ep:loading'
    }
  },
  actions: {
    // 仅关闭已查看结果的提示，不清空创建页仍需使用的终态和系列数据。
    acknowledgeResult(taskId?: number) {
      if (taskId == null || taskId !== this.task?.id || !isCoursewareTaskResultReady(this.task))
        return
      if (!this.acknowledgedTaskIds.includes(taskId)) {
        this.acknowledgedTaskIds.push(taskId)
      }
      try {
        sessionStorage.setItem(
          'courseware:acknowledged-results',
          JSON.stringify(this.acknowledgedTaskIds)
        )
      } catch {
        /* 存储不可用时仍保留本次会话内的关闭状态。 */
      }
    },
    init() {
      if (this.initializationPromise) return this.initializationPromise
      if (this.initialized) return
      // 浮层会在路由完成前挂载；无令牌时不能请求 active 接口，也不应产生未处理拒绝。
      if (!getAccessToken()) return

      this.initialized = true
      const revision = this.taskRevision
      const inspection = useCoursewareInspectionRuntime()
      const identityKey = inspection.identityKey()
      const initializationPromise = (async () => {
        try {
          const activeTask = await CoursewareApi.getActiveGenerationTask()
          // 初始化请求可能在用户新建/切换任务后才返回，不能覆盖新状态。
          if (inspection.identityKey() !== identityKey) {
            this.initialized = false
            return
          }
          if (this.taskRevision !== revision || !activeTask?.id) return
          this.setTask(activeTask)
        } catch {
          // 下一次页面恢复或登录后可以重新初始化；调用方无需处理初始化网络错误。
          if (this.taskRevision === revision) this.initialized = false
        } finally {
          // 同一时刻只会有一次初始化在飞（开头的 initializationPromise / initialized 双重
          // 守卫保证），因此这里直接清空即可，不必自引用比较 promise。
          this.initializationPromise = undefined
        }
      })()
      this.initializationPromise = initializationPromise
      return initializationPromise
    },
    captureTaskContext() {
      return { identityKey: useCoursewareInspectionRuntime().identityKey() }
    },
    isTaskContextCurrent(context: { identityKey?: string }) {
      return context.identityKey === useCoursewareInspectionRuntime().identityKey()
    },
    setTask(task?: CoursewareGenerationTaskVO, context?: { identityKey?: string }) {
      // 创建、确认和路由恢复的异步回包必须仍属于发起请求时的账号。
      if (context && !this.isTaskContextCurrent(context)) return false
      if (
        task?.id === this.task?.id &&
        task?.snapshotVersion != null &&
        this.task?.snapshotVersion != null &&
        task.snapshotVersion < this.task.snapshotVersion
      )
        return false
      try {
        const saved: unknown = JSON.parse(
          sessionStorage.getItem('courseware:acknowledged-results') || '[]'
        )
        if (Array.isArray(saved))
          this.acknowledgedTaskIds = saved.filter((id) => Number.isSafeInteger(id))
      } catch {
        /* 忽略损坏或不可用的会话存储。 */
      }
      this.taskRevision += 1
      this.task = task
      const inspection = useCoursewareInspectionRuntime()
      this.inspectionIdentityKey = inspection.identityKey()
      void collectCoursewareInspectionSnapshot(task)
      this.pollError = false
      this.loadingProgress = task?.progress ?? 0
      if (this.isGenerating) {
        this.startPolling()
      } else {
        // 终态必须保留给创建页展示成功预览或失败原因；自动清空会让 step=2
        // 退回到无 task 的默认分支，进度显示成 0% 且看起来像任务仍在运行。
        this.stopPolling()
      }
      return true
    },
    async refreshTask() {
      const task = this.task
      const taskId = task?.id
      if (!task || !taskId) {
        this.stopPolling()
        return
      }
      if (this.refreshingTaskIds.includes(taskId)) return
      this.refreshingTaskIds.push(taskId)
      const revision = this.taskRevision
      const inspection = useCoursewareInspectionRuntime()
      const identityKey = inspection.identityKey()
      if (identityKey !== this.inspectionIdentityKey) {
        this.refreshingTaskIds = this.refreshingTaskIds.filter((id) => id !== taskId)
        this.stopPolling()
        return
      }
      try {
        const previousPollIntervalMs = task.pollIntervalMs
        const refreshedTask = await CoursewareApi.getGenerationTask(taskId, {
          silentNetworkError: true
        })
        // 取消、重试或新建任务可发生在旧轮询返回前；只接受仍属于同一版本的响应。
        if (
          inspection.identityKey() !== identityKey ||
          this.taskRevision !== revision ||
          this.task?.id !== taskId
        )
          return
        if (
          refreshedTask?.snapshotVersion != null &&
          this.task?.snapshotVersion != null &&
          refreshedTask.snapshotVersion < this.task.snapshotVersion
        )
          return
        this.pollError = false
        this.task = refreshedTask
        void collectCoursewareInspectionSnapshot(refreshedTask)
        this.taskRevision += 1
        this.loadingProgress = refreshedTask?.progress ?? this.loadingProgress
        if (this.isGenerating && previousPollIntervalMs !== refreshedTask?.pollIntervalMs) {
          this.startPolling()
        } else if (!this.isGenerating) {
          // 保留终态任务，交由页面的成功/失败 UI 和“返回创建”按钮清理。
          this.stopPolling()
        }
      } catch {
        // 暂时查询失败不改变任务状态；由工作区展示重连提示，下一轮继续查询。
        if (this.taskRevision === revision && this.task?.id === taskId) this.pollError = true
      } finally {
        this.refreshingTaskIds = this.refreshingTaskIds.filter((id) => id !== taskId)
      }
    },
    startPolling() {
      this.stopPolling()
      if (!this.isGenerating) return
      const configuredInterval = Number(this.task?.pollIntervalMs)
      const intervalMs = Number.isFinite(configuredInterval)
        ? Math.min(Math.max(configuredInterval, 1000), 30_000)
        : this.task?.generation
          ? 2000
          : 3000
      this.pollTimer = window.setInterval(() => this.refreshTask(), intervalMs)
    },
    stopPolling() {
      if (this.pollTimer) {
        window.clearInterval(this.pollTimer)
        this.pollTimer = undefined
      }
    },
    clear() {
      this.stopPolling()
      this.taskRevision += 1
      this.task = undefined
      this.pollError = false
      this.loadingProgress = 0
    }
  }
})
