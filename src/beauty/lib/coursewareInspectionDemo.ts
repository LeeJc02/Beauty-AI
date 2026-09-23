import { computed, ref } from 'vue'
import type { CoursewareInspectionRuntime } from './coursewareInspection'

export type CoursewareInspectionDemoScenario = 'escalation' | 'recovery'

/**
 * UI 契约：start 新建独立演示任务并只注入第一件生成中事件；next 每次推进一个阶段。
 * 结果不合规后必须由用户调用 runtime.acknowledge，控制器绝不代签收。
 * attach/resume 可恢复持久化演示；stop/reset 仅停止本控制器，不修改或删除任务。
 * 暂停期间不可推进；暂停导致事项停止或修改规则后，请 start 重新体验。
 * 所有 refs 均可只读消费；无定时器、无网络、无自动推进。
 */
export function createCoursewareInspectionDemo(runtime: CoursewareInspectionRuntime) {
  const taskId = ref('')
  const scenario = ref<CoursewareInspectionDemoScenario>()
  const stopped = ref(false)
  const identity = ref<string>()
  const task = computed(() =>
    runtime.identityKey() === identity.value
      ? runtime.tasks.value.find((item) => item.id === taskId.value)
      : undefined
  )
  const last = computed(() => task.value?.entries.at(-1))
  const limit = computed(() => (scenario.value === 'recovery' ? 2 : 3))
  const finished = computed(() =>
    Boolean(
      task.value &&
      task.value.entries.length >= limit.value &&
      last.value?.status === 'completed' &&
      last.value.outcome !== 'stopped'
    )
  )
  const invalid = computed(() =>
    Boolean(
      task.value?.demoInvalidated ||
      task.value?.entries.some((entry) => entry.outcome === 'stopped')
    )
  )
  const canNext = computed(() =>
    Boolean(
      task.value?.enabled &&
      !stopped.value &&
      !invalid.value &&
      !finished.value &&
      last.value?.status !== 'awaiting_confirmation'
    )
  )
  const nextLabel = computed(() =>
    last.value?.status === 'generating' ? '完成本次生成并核验' : '生成下一件演示课件'
  )
  const hint = computed(() => {
    if (!task.value) return '请选择演示任务，或重新开始体验。'
    if (stopped.value) return '演示已停止；可重新进入该任务继续，或重新开始体验。'
    if (!task.value.enabled) return '监督已暂停，请先恢复；已停止的事项需要重新开始体验。'
    if (invalid.value) return '规则已修改或事项已停止，请重新开始体验；原记录将保留。'
    if (last.value?.status === 'awaiting_confirmation')
      return task.value.escalations.some((item) => item.status === 'simulated')
        ? '第三次不合规已立即向创建人生成飞书演示回执；请本人确认提醒，模拟汇报无需等待签收。'
        : '请本人点击确认知晓后再继续；确认只代表签收，不代表整改达标。'
    if (finished.value)
      return scenario.value === 'recovery'
        ? '第二件课件已达标，连续不合规计数归零，不再提醒；演示完成。'
        : '连续三次不合规已完成飞书模拟汇报；演示完成，不实际发送。'
    return last.value?.status === 'generating'
      ? '课件正在生成；点击下一步查看产物预计学习时长及核验结果。'
      : '本次提醒已签收；点击下一步生成下一件独立课件。'
  })
  function generate() {
    const current = task.value
    const actor = runtime.actor()
    if (!current || !actor) return false
    // 负数仅供本地演示，且只投递到目标任务，不进入其他订阅或已观察 ID 集合。
    const id = -(Date.now() * 1000 + Math.floor(Math.random() * 1000))
    runtime.processCoursewareSnapshot(
      {
        id,
        status: 'running',
        title: `演示课件 ${current.entries.length + 1} · ${scenario.value === 'recovery' ? '整改达标' : '连续不合规'}`,
        step: 'pages'
      },
      {
        creatorId: actor.userId,
        creatorName: actor.displayName || `本人（${actor.userId}）`
      },
      current.id
    )
    return true
  }
  function attach(id: string): boolean {
    const current = runtime.tasks.value.find((item) => item.id === id)
    if (!current?.demoScenario) return false
    taskId.value = id
    scenario.value = current.demoScenario
    identity.value = runtime.identityKey()
    stopped.value = false
    return true
  }
  function start(value: CoursewareInspectionDemoScenario): string {
    if (!['escalation', 'recovery'].includes(value)) throw new Error('未知演示场景')
    if (!runtime.actor()) throw new Error('请先登录并确认当前角色')
    // 一次只播放一个演示场景，避免旧场景的待确认弹窗抢占新场景；不影响自建任务。
    for (const previous of runtime.tasks.value) {
      if (previous.demoScenario && previous.enabled) runtime.pauseTask(previous.id)
    }
    const id = runtime.createTask({
      name: value === 'escalation' ? '演示 · 连续三次不合规汇报' : '演示 · 整改达标不打扰',
      question:
        '演示：监督本人课件预计学习时长为 5–10 分钟，不合规提醒本人，连续第三次向创建人模拟汇报。',
      scope: 'current_account',
      minDurationMinutes: 5,
      maxDurationMinutes: 10,
      remind: true,
      reportRequested: true,
      confirmed: true,
      demoScenario: value
    })
    attach(id)
    generate()
    return id
  }
  function next(): boolean {
    if (!canNext.value) return false
    const entry = last.value
    const actor = runtime.actor()
    if (!actor) return false
    if (!entry || entry.status === 'completed') return generate()
    if (entry.status !== 'generating') return false
    const duration = scenario.value === 'recovery' && task.value!.entries.length === 2 ? 420 : 180
    runtime.processCoursewareSnapshot(
      {
        id: entry.generationTaskId,
        status: 'succeeded',
        done: true,
        resultCoursewareId: Math.abs(entry.generationTaskId),
        title: entry.title
      },
      {
        creatorId: actor.userId,
        creatorName: actor.displayName || `本人（${actor.userId}）`,
        estimatedDurationSeconds: duration,
        source: '课件产物（演示数据）'
      },
      taskId.value
    )
    return true
  }
  const stop = () => {
    stopped.value = true
  }
  return {
    taskId,
    scenario,
    nextLabel,
    hint,
    canNext,
    finished,
    start,
    attach,
    resume: attach,
    next,
    stop,
    reset: stop
  }
}
