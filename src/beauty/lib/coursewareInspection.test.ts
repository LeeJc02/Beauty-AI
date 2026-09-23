import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'
import {
  createCoursewareInspectionRuntime,
  type CoursewareInspectionRules
} from './coursewareInspection'

const rules: CoursewareInspectionRules & { confirmed: true } = {
  name: '监督时长',
  question: '监督课件',
  scope: 'current_account',
  minDurationMinutes: 10,
  maxDurationMinutes: 20,
  remind: true,
  reportRequested: true,
  confirmed: true
}
function fixture() {
  const data = new Map<string, string>()
  const actor = reactive({ userId: '7', role: 'trainer' })
  const options = {
    identity: () => actor,
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      }
    },
    now: () => new Date('2026-09-21T00:00:00Z')
  }
  const runtime = createCoursewareInspectionRuntime(options)
  const start = (id: number) =>
    runtime.processCoursewareSnapshot({ id, status: 'running', title: '安全培训' })
  const finish = (id: number, seconds = 300) =>
    runtime.processCoursewareSnapshot(
      { id, status: 'succeeded', done: true, resultCoursewareId: id + 100 },
      {
        creatorId: '7',
        creatorName: '培训师',
        estimatedDurationSeconds: seconds,
        source: '课件详情 estimatedDurationSeconds'
      }
    )
  return { runtime, actor, options, data, start, finish }
}

test('无授权不产生事项；确认后只收新进行中事件，旧完成不倒灌', () => {
  const f = fixture()
  f.start(1)
  assert.equal(f.data.size, 0)
  const id = f.runtime.createTask(rules)
  f.start(1)
  f.finish(2)
  assert.equal(f.runtime.tasks.value[0].entries.length, 0)
  f.start(3)
  f.finish(3)
  assert.equal(f.runtime.tasks.value[0].entries[0].status, 'awaiting_confirmation')
  assert.match(f.runtime.briefing(id), /已检查 1 件课件/)
})

test('预计时长缺失不能借用目标；失败不标达标；旧版本被忽略', () => {
  const f = fixture()
  f.runtime.createTask(rules)
  f.start(1)
  f.runtime.processCoursewareSnapshot({
    id: 1,
    status: 'succeeded',
    done: true,
    snapshotVersion: 4,
    promptEnhancement: { summary: { targetDurationMinutes: 15 } },
    resultCoursewareId: 101
  })
  assert.equal(f.runtime.tasks.value[0].entries[0].status, 'missing_evidence')
  f.runtime.processCoursewareSnapshot({ id: 1, status: 'running', snapshotVersion: 2 })
  assert.equal(f.runtime.tasks.value[0].entries[0].status, 'missing_evidence')
  f.start(2)
  f.runtime.processCoursewareSnapshot({ id: 2, status: 'failed' })
  assert.equal(f.runtime.tasks.value[0].entries[1].status, 'failed')
  assert.equal(f.runtime.tasks.value[0].entries[1].outcome, undefined)
})

test('同一培训师跨课件第三次检测立即升级，不等确认；刷新幂等；合规清零且不提醒', () => {
  const f = fixture()
  const id = f.runtime.createTask(rules)
  for (let i = 1; i <= 3; i++) {
    f.start(i)
    f.finish(i)
    f.finish(i)
  }
  let task = f.runtime.tasks.value[0]
  assert.equal(task.trainerFailures['7'], 3)
  assert.equal(task.escalations.length, 1)
  assert.equal(task.escalations[0].status, 'blocked')
  assert.equal(task.escalations[0].recipientUserId, '7')
  assert.equal(task.entries.filter((entry) => entry.status === 'awaiting_confirmation').length, 3)
  const eventCount = task.entries[2].events.length
  f.finish(3)
  assert.equal(task.entries[2].events.length, eventCount)
  assert.equal(f.runtime.acknowledge(id, task.entries[2].id), true)
  assert.equal(f.runtime.acknowledge(id, task.entries[2].id), false)
  assert.equal(task.trainerFailures['7'], 3)
  f.start(4)
  f.finish(4, 900)
  assert.equal(task.trainerFailures['7'], 0)
  assert.equal(task.entries[3].status, 'completed')
  assert.equal(task.entries[3].outcome, 'passed')
  for (let i = 5; i <= 7; i++) {
    f.start(i)
    f.finish(i)
  }
  assert.equal(task.escalations.length, 1)
  const restored = createCoursewareInspectionRuntime(f.options)
  task = restored.tasks.value[0]
  restored.processCoursewareSnapshot({ id: 7, status: 'succeeded', done: true })
  assert.equal(task.escalations.length, 1)
})

test('暂停不处理或补发；修改保留历史且只用于新生成任务', () => {
  const f = fixture()
  const id = f.runtime.createTask(rules)
  f.start(1)
  f.runtime.pauseTask(id)
  f.finish(1)
  f.start(2)
  f.finish(2)
  f.runtime.resumeTask(id)
  f.finish(1)
  f.finish(2)
  assert.equal(f.runtime.tasks.value[0].entries.length, 1)
  f.start(3)
  f.runtime.updateTask(id, { ...rules, minDurationMinutes: 1 })
  f.finish(3)
  assert.equal(f.runtime.tasks.value[0].entries[1].retired, true)
  assert.equal(f.runtime.tasks.value[0].entries[1].outcome, 'stopped')
  assert.ok(f.runtime.tasks.value[0].entries[1].completedAt)
  f.start(4)
  f.finish(4)
  assert.equal(f.runtime.tasks.value[0].entries[2].outcome, 'passed')
})

test('同一任务更换后端生成作业是新产物，刷新版本不是新产物', () => {
  const f = fixture()
  f.runtime.createTask(rules)
  for (const externalTaskId of ['job-a', 'job-b']) {
    f.runtime.processCoursewareSnapshot({ id: 1, externalTaskId, status: 'running' })
    f.runtime.processCoursewareSnapshot(
      { id: 1, externalTaskId, status: 'succeeded', done: true, resultCoursewareId: 101 },
      { creatorId: '7', estimatedDurationSeconds: 300, source: 'metadata' }
    )
  }
  assert.equal(f.runtime.tasks.value[0].entries.length, 2)
  assert.equal(f.runtime.tasks.value[0].trainerFailures['7'], 2)
  assert.notEqual(f.runtime.tasks.value[0].entries[0].id, f.runtime.tasks.value[0].entries[1].id)
})

test('关闭汇报授权不生成升级；首次终态只在时间明确证明为新任务时接入', () => {
  const f = fixture()
  f.runtime.createTask({ ...rules, reportRequested: false })
  for (let i = 1; i <= 3; i++) {
    f.start(i)
    f.finish(i)
  }
  assert.equal(f.runtime.tasks.value[0].trainerFailures['7'], 3)
  assert.equal(f.runtime.tasks.value[0].escalations.length, 0)
  f.runtime.processCoursewareSnapshot(
    {
      id: 4,
      status: 'succeeded',
      done: true,
      resultCoursewareId: 104,
      createTime: new Date('2026-09-21T00:00:01Z')
    },
    { creatorId: '7', estimatedDurationSeconds: 300, source: 'metadata' }
  )
  assert.equal(f.runtime.tasks.value[0].entries.length, 4)
  f.runtime.processCoursewareSnapshot({
    id: 5,
    status: 'succeeded',
    done: true,
    resultCoursewareId: 105
  })
  assert.equal(f.runtime.tasks.value[0].entries.length, 4)
})

test('订阅前已知任务即使时间晚也不倒灌', () => {
  const f = fixture()
  f.start(1)
  f.runtime.createTask(rules)
  f.runtime.processCoursewareSnapshot({
    id: 1,
    status: 'succeeded',
    done: true,
    createTime: new Date('2026-09-21T00:00:01Z')
  })
  assert.equal(f.runtime.tasks.value[0].entries.length, 0)
})

test('账号/角色隔离，标题过滤，损坏存储安全降级', () => {
  const f = fixture()
  f.runtime.createTask({ ...rules, scope: 'title_keyword', titleFilter: '安全' })
  f.runtime.processCoursewareSnapshot({ id: 1, status: 'running', title: '销售' })
  assert.equal(f.runtime.tasks.value[0].entries.length, 0)
  f.actor.role = 'manager'
  assert.equal(f.runtime.tasks.value.length, 0)
  f.actor.role = 'trainer'
  assert.equal(f.runtime.tasks.value.length, 1)
  f.actor.userId = '8'
  assert.equal(f.runtime.tasks.value.length, 0)
  const broken = createCoursewareInspectionRuntime({
    identity: () => ({ userId: 1, role: 'x' }),
    storage: {
      getItem: () => '{',
      setItem: () => {
        throw new Error('quota')
      }
    }
  })
  assert.equal(broken.tasks.value.length, 0)
  broken.createTask(rules)
  assert.match(broken.storageError.value, /未能保存/)
})
