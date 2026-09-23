import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'
import {
  createCoursewareInspectionRuntime,
  inspectionEvaluation,
  type CoursewareInspectionTask
} from './coursewareInspection'
import {
  createCoursewareInspectionFixtures,
  COURSEWARE_INSPECTION_SEED_VERSION
} from './coursewareInspectionFixtures'
import { assertQueryPlan, type InspectionQueryResult } from './inspectionQuery'
import { planFromTask } from './inspectionRequest'

const clock = new Date('2026-09-23T12:00:00Z')
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
function fixture(previousVersion = 0, savedTasks: CoursewareInspectionTask[] = []) {
  const actor = reactive({ userId: '7', role: 'trainer', displayName: '林悦' })
  const data = new Map<string, string>()
  let writes = 0
  const key = 'courseware:inspection:v1:7:trainer'
  if (previousVersion)
    data.set(
      key,
      JSON.stringify({ tasks: savedTasks, knownIds: [123], seedVersion: previousVersion })
    )
  const options = {
    identity: () => actor,
    now: () => clock,
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes++
        data.set(key, value)
      }
    },
    seed: {
      version: COURSEWARE_INSPECTION_SEED_VERSION,
      create: createCoursewareInspectionFixtures
    }
  }
  return {
    actor,
    data,
    key,
    options,
    runtime: createCoursewareInspectionRuntime(options),
    writes: () => writes
  }
}

/** 还原 v4 已保存的读取状态，覆盖原先四个在途阶段。 */
function legacyV4Tasks(stage: number) {
  const tasks = createCoursewareInspectionFixtures(
    { userId: '7', role: 'trainer', displayName: '林悦' },
    clock
  )
  for (const task of tasks) {
    if (task.id.startsWith('business-seed-v4:')) {
      task.queryPending = true
      task.pendingQueryResult = task.queryResult
      delete task.queryResult
      delete task.completedAt
      const entry = task.entries[0]
      entry.events = entry.events.slice(0, stage + 1)
      entry.presentationStage = stage
      entry.status = 'checking'
      entry.summary = entry.events[stage].text
      delete entry.completedAt
      if (stage > 0) {
        const columns = task.pendingQueryResult!.columns.filter((column) => column.key !== 'result')
        task.queryIntermediate = {
          columns: clone(columns),
          rows: task.pendingQueryResult!.rows.map((row) =>
            Object.fromEntries(columns.map((column) => [column.key, row[column.key]]))
          )
        }
      }
    }
    for (const entry of task.entries) entry.evaluatedOutcome = inspectionEvaluation(entry)
  }
  return clone(tasks)
}

test('初始11条为5条监督运行、6条完成；两领域查询均保留结果且不会进入监督事件流', () => {
  const f = fixture()
  const tasks = f.runtime.productTasks.value
  const running = tasks.filter((task) => !task.completedAt)
  const queries = tasks.filter((task) => task.mode === 'once')
  assert.equal(tasks.length, 11)
  assert.equal(running.length, 5)
  assert.ok(running.every((task) => task.mode === 'continuous'))
  assert.equal(tasks.filter((task) => task.completedAt).length, 6)
  assert.equal(queries.length, 4)
  assert.ok(tasks.every((task) => !task.queryPending && !task.pendingQueryResult))
  for (const subject of ['courseware', 'training']) {
    assert.equal(queries.filter((task) => task.subject === subject).length, 2)
  }
  for (const task of queries) {
    assert.equal(task.enabled, false)
    assert.ok(task.completedAt && task.queryResult?.rows.length)
    const before = JSON.stringify(task)
    const writes = f.writes()
    assert.equal(f.runtime.advancePresentation(task.id), false)
    assert.equal(f.writes(), writes)
    assert.equal(JSON.stringify(task), before)
    assert.equal(f.runtime.briefing(task.id), task.queryResult!.summary)
  }
  for (const task of queries.filter((task) => task.id.startsWith('business-seed-v4:'))) {
    assertQueryPlan(planFromTask(task))
    const entry = task.entries[0]
    assert.equal(entry.status, 'completed')
    assert.equal(entry.completedAt, task.completedAt)
    assert.equal(entry.presentationStage, 4)
    assert.equal(entry.events.length, 5)
    assert.deepEqual(
      entry.events.slice(1).map((event) => event.tool),
      ['read', 'filter', 'check', 'summarize'].map((step) => `${task.subject}.${step}`)
    )
    assert.ok(entry.events.slice(1).every((event) => event.input && event.output))
    assert.ok(
      entry.events.every((event, index) => index === 0 || event.at > entry.events[index - 1].at)
    )
    assert.ok(task.completedAt! < clock.toISOString())
    assert.equal(entry.notificationState, undefined)
    assert.deepEqual(task.trainerFailures, {})
    assert.deepEqual(task.escalations, [])
  }
  const training = queries.find((task) => task.id.endsWith(':query:1'))!
  const record = tasks.find((task) => task.name === '南区新品培训达标监督')!.entries[0]
  const row = training.queryResult!.rows[0]
  for (const key of ['region', 'person', 'product', 'checkedAt', 'score'] as const)
    assert.equal(row[key], record[key])
  assert.equal(training.requestPlan!.timeMode, 'current')
  assert.equal(training.requestPlan!.ready, true)
  const queriesBefore = JSON.stringify(queries)
  f.runtime.processCoursewareSnapshot({ id: 900, title: '敏感肌保湿', status: 'running' })
  assert.equal(
    tasks
      .filter((task) => task.mode !== 'once')
      .flatMap((task) => task.entries)
      .filter((entry) => entry.generationTaskId === 900).length,
    1
  )
  assert.equal(JSON.stringify(queries), queriesBefore)
})

test('v4各读取阶段就地归档，保留准备结果、原事件、用户字段和5/6分布；刷新幂等', () => {
  for (const stage of [0, 1, 2, 3]) {
    const legacy = legacyV4Tasks(stage)
    const pending = legacy.filter((task) => task.queryPending)
    for (const task of pending) {
      task.name += ' · 已调整名称'
      task.question += ' 请保留备注。'
      task.pendingQueryResult!.summary += ' 已核对原记录。'
      task.pendingQueryResult!.rows[0].note = '保留已存数据'
      task.entries[0].events[0].text += ' 查询人已补充说明。'
    }
    legacy[1].name = '用户修改的监督规则'
    legacy[1].minDurationMinutes = 9
    legacy[1].enabled = false
    const before = clone(legacy)
    const f = fixture(4, legacy)
    const tasks = f.runtime.productTasks.value
    assert.equal(tasks.length, 11)
    assert.equal(new Set(tasks.map((task) => task.id)).size, 11)
    assert.equal(tasks.filter((task) => !task.completedAt).length, 5)
    assert.equal(tasks.filter((task) => task.completedAt).length, 6)
    assert.ok(tasks.filter((task) => !task.completedAt).every((task) => task.mode !== 'once'))
    for (const task of tasks) {
      const original = before.find((item) => item.id === task.id)!
      if (!original.queryPending) {
        assert.deepEqual(clone(task), original)
        continue
      }
      assert.equal(task.name, original.name)
      assert.equal(task.question, original.question)
      assert.equal(task.createdAt, original.createdAt)
      assert.equal(task.subscribedAt, original.subscribedAt)
      assert.deepEqual(clone(task.requestPlan), original.requestPlan)
      assert.deepEqual(clone(task.queryResult), original.pendingQueryResult)
      assert.deepEqual(task.queryIntermediate, original.queryIntermediate)
      assert.deepEqual(task.trainerFailures, original.trainerFailures)
      assert.deepEqual(task.escalations, original.escalations)
      assert.equal(task.queryPending, undefined)
      assert.equal(task.pendingQueryResult, undefined)
      assert.equal(task.completedAt, clock.toISOString())
      assert.equal(task.entries.length, original.entries.length)
      const entry = task.entries[0]
      assert.equal(entry.id, original.entries[0].id)
      assert.equal(entry.status, 'completed')
      assert.equal(entry.completedAt, task.completedAt)
      assert.deepEqual(entry.events.slice(0, stage + 1), original.entries[0].events)
      assert.equal(entry.events.length, 5)
      assert.equal(new Set(entry.events.slice(1).map((event) => event.tool)).size, 4)
      assert.equal(entry.events[4].text, original.pendingQueryResult!.summary)
      assert.ok(
        entry.events.every((event, index) => index === 0 || event.at >= entry.events[index - 1].at)
      )
      assert.equal(f.runtime.advancePresentation(task.id), false)
    }
    const saved = f.data.get(f.key)!
    assert.equal(JSON.parse(saved).seedVersion, 5)
    assert.deepEqual(JSON.parse(saved).knownIds, [123])
    for (let refresh = 1; refresh <= 3; refresh++) {
      const restored = createCoursewareInspectionRuntime({
        ...f.options,
        now: () => new Date(clock.getTime() + refresh * 86400_000)
      })
      assert.deepEqual(clone(restored.tasks.value), clone(tasks))
      assert.equal(f.data.get(f.key), saved)
      restored.dispose()
    }
  }
})

test('迁移不删除或复写用户完成查询、自建监督、其他身份及非内置在途记录', () => {
  const saved = legacyV4Tasks(2)
  const original = saved.find((task) => task.queryPending)!
  const completed = clone(original)
  completed.id = 'user-completed-query'
  completed.completedAt = '2026-09-22T10:05:00.000Z'
  completed.queryResult = clone(original.pendingQueryResult!)
  completed.queryResult.summary = '本人已完成的独立查询'
  delete completed.queryPending
  delete completed.pendingQueryResult
  completed.entries = []
  const supervision = { ...clone(saved[0]), id: 'user-created-supervision', name: '我的监督' }
  const alreadyCompleted = clone(original)
  alreadyCompleted.completedAt = '2026-09-23T11:30:00.000Z'
  alreadyCompleted.queryResult = clone(original.pendingQueryResult!)
  alreadyCompleted.queryResult.summary = '内置查询已由用户完成，不覆盖结果'
  saved.splice(
    saved.findIndex((task) => task.id === original.id),
    1,
    alreadyCompleted
  )
  const untouched = [
    completed,
    supervision,
    { ...clone(original), id: 'user-pending-query' },
    { ...clone(original), id: 'business-seed-v4:7:manager:query:0' },
    { ...clone(original), id: 'business-seed-v4:7:trainer:query:10' }
  ]
  saved.push(...untouched)
  untouched.push(alreadyCompleted)
  const f = fixture(4, saved)
  assert.equal(f.runtime.tasks.value.length, saved.length)
  for (const original of untouched) {
    const task = f.runtime.tasks.value.find((task) => task.id === original.id)!
    assert.deepEqual(clone(task), original)
    if (task.mode === 'once') {
      assert.equal(f.runtime.advancePresentation(task.id), false)
      assert.deepEqual(clone(task), original)
    }
  }
  const runningSupervision = f.runtime.productTasks.value.filter(
    (task) => task.mode !== 'once' && !task.completedAt
  )
  assert.equal(runningSupervision.length, 6)
  assert.ok(runningSupervision.every((task) => !task.queryPending))
  f.actor.role = 'manager'
  assert.equal(f.runtime.tasks.value.length, 11)
  assert.ok(f.runtime.tasks.value.every((task) => task.id.includes(':manager:')))
  f.actor.role = 'trainer'
  assert.equal(f.runtime.tasks.value.length, saved.length)
})

test('v5只增补未到达的旧版本，不补回已删除任务；所有新增查询直接完成', () => {
  for (const previous of [1, 2, 3, 4, 5]) {
    const f = fixture(previous)
    const tasks = f.runtime.tasks.value
    assert.equal(tasks.length, previous === 1 ? 7 : previous === 2 ? 6 : previous === 3 ? 2 : 0)
    assert.equal(tasks.filter((task) => task.id.startsWith('business-seed-v1:')).length, 0)
    assert.ok(tasks.every((task) => !task.queryPending && !task.pendingQueryResult))
    assert.ok(
      tasks
        .filter((task) => task.mode === 'once')
        .every((task) => task.completedAt && task.queryResult)
    )
    const saved = f.data.get(f.key)
    const restored = createCoursewareInspectionRuntime(f.options)
    assert.deepEqual(clone(restored.tasks.value), clone(tasks))
    assert.equal(f.data.get(f.key), saved)
    assert.deepEqual(JSON.parse(saved!).knownIds, [123])
    const query = tasks.find((task) => task.mode === 'once')
    if (query) {
      f.actor.userId = '8'
      void restored.tasks.value
      const writes = f.writes()
      assert.equal(restored.advancePresentation(query.id), false)
      assert.equal(f.writes(), writes)
    }
  }
})

test('真实executeQuery等待执行器返回才新增完成记录，读取中或抛错不创建假完成任务', async () => {
  const f = fixture()
  const source = f.runtime.tasks.value.find((task) => task.id.endsWith(':query:0'))!
  const plan = planFromTask(source)
  const before = JSON.stringify(f.runtime.tasks.value)
  const saved = f.data.get(f.key)
  let resolve!: (result: InspectionQueryResult) => void
  const pending = f.runtime.executeQuery(
    plan,
    { confirmed: true },
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  await Promise.resolve()
  assert.equal(JSON.stringify(f.runtime.tasks.value), before)
  assert.equal(f.data.get(f.key), saved)
  assert.ok(f.runtime.tasks.value.every((task) => !task.queryPending))
  const actual: InspectionQueryResult = {
    status: 'complete',
    summary: '读取器返回的真实查询结果',
    columns: [{ key: 'title', label: '课件' }],
    rows: [{ title: '本次读取的课件' }],
    tools: [],
    evidence: ['本次读取记录']
  }
  resolve(actual)
  const id = await pending
  const completed = f.runtime.tasks.value.find((task) => task.id === id)!
  assert.equal(f.runtime.tasks.value.length, 12)
  assert.equal(completed.mode, 'once')
  assert.equal(completed.enabled, false)
  assert.equal(completed.completedAt, clock.toISOString())
  assert.deepEqual(completed.queryResult, actual)
  assert.deepEqual(completed.entries, [])
  assert.equal(completed.queryPending, undefined)
  assert.equal(completed.pendingQueryResult, undefined)
  assert.equal(f.runtime.advancePresentation(id), false)
  const after = JSON.stringify(f.runtime.tasks.value)
  await assert.rejects(
    f.runtime.executeQuery(plan, { confirmed: true }, async () => {
      throw new Error('读取失败')
    }),
    /读取失败/
  )
  assert.equal(JSON.stringify(f.runtime.tasks.value), after)
})
