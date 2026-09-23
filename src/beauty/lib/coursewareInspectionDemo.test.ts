import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'
import { createCoursewareInspectionRuntime } from './coursewareInspection'
import { createCoursewareInspectionDemo } from './coursewareInspectionDemo'

function fixture() {
  const actor = reactive({ userId: '42', role: 'trainer' })
  const data = new Map<string, string>()
  const options = {
    identity: () => actor,
    mode: 'demo' as const,
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      }
    }
  }
  const runtime = createCoursewareInspectionRuntime(options)
  const demo = createCoursewareInspectionDemo(runtime)
  const task = () => runtime.tasks.value.find((item) => item.id === demo.taskId.value)!
  const acknowledge = () => runtime.acknowledge(task().id, task().entries.at(-1)!.id)
  return { runtime, demo, task, acknowledge, options, actor }
}

test('逐步演示，等待本人确认，第三次立即模拟汇报且没有网络发送', (context) => {
  const network = context.mock.method(globalThis, 'fetch', () => {
    throw new Error('演示禁止网络发送')
  })
  const f = fixture()
  f.demo.start('escalation')
  assert.equal(f.task().entries.length, 1)
  assert.equal(f.task().entries[0].status, 'generating')
  for (let index = 0; index < 3; index++) {
    assert.equal(f.demo.next(), true)
    assert.equal(f.task().entries.at(-1)!.status, 'awaiting_confirmation')
    assert.equal(f.demo.next(), false)
    assert.equal(f.demo.next(), false)
    assert.equal(f.task().entries.length, index + 1)
    if (index === 2) {
      const receipt = f.task().escalations[0]
      assert.equal(receipt.status, 'simulated')
      assert.equal(receipt.recipientUserId, '42')
      assert.match(receipt.content!, /已形成飞书汇报/)
      for (let number = 1; number <= 3; number++)
        assert.match(receipt.content!, new RegExp(`演示课件 ${number}`))
      assert.equal((receipt.content!.match(/3 分钟/g) || []).length, 3)
      assert.equal(f.task().escalations.length, 1)
    }
    assert.equal(f.acknowledge(), true)
    if (index < 2) {
      assert.equal(f.demo.next(), true)
      assert.equal(f.task().entries.at(-1)!.status, 'generating')
    }
  }
  assert.equal(f.demo.finished.value, true)
  assert.equal(f.demo.next(), false)
  assert.doesNotMatch(f.runtime.briefing(f.task().id), /接口|阻塞|待发送/)
  assert.equal(network.mock.callCount(), 0)
})

test('整改后清零，不再提醒；刷新可恢复待确认与下一步', () => {
  const f = fixture()
  const id = f.demo.start('recovery')
  f.demo.next()
  const runtime = createCoursewareInspectionRuntime(f.options)
  const restored = createCoursewareInspectionDemo(runtime)
  assert.equal(restored.attach(id), true)
  assert.equal(restored.canNext.value, false)
  runtime.acknowledge(id, runtime.tasks.value[0].entries[0].id)
  restored.next()
  restored.next()
  assert.equal(runtime.tasks.value[0].trainerFailures['42'], 0)
  assert.equal(runtime.tasks.value[0].entries[1].outcome, 'passed')
  assert.equal(runtime.tasks.value[0].escalations.length, 0)
  assert.equal(restored.finished.value, true)
})

test('演示与自建任务双向隔离；停止不删除，重新演示独立任务', () => {
  const f = fixture()
  const normal = f.runtime.createTask({
    name: '真实订阅',
    question: '监督',
    scope: 'current_account',
    remind: true,
    reportRequested: true,
    confirmed: true
  })
  const first = f.demo.start('escalation')
  f.demo.next()
  assert.equal(f.runtime.tasks.value.find((item) => item.id === normal)!.entries.length, 0)
  f.runtime.processCoursewareSnapshot({ id: 15, status: 'running', title: '普通课件' })
  assert.equal(f.task().entries.length, 1)
  f.demo.stop()
  assert.equal(f.demo.next(), false)
  const second = f.demo.start('recovery')
  assert.notEqual(second, first)
  assert.equal(f.runtime.tasks.value.length, 3)
  const previous = f.runtime.tasks.value.find((item) => item.id === first)!
  assert.equal(previous.enabled, false)
  assert.equal(previous.entries[0].outcome, 'stopped')
  assert.equal(f.runtime.tasks.value.find((item) => item.id === normal)!.enabled, true)
  f.actor.userId = '43'
  assert.equal(f.demo.next(), false)
  assert.equal(f.runtime.tasks.value.length, 0)
})

test('暂停/修改规则保护；恢复后已停止事项明确要求重新体验', () => {
  const f = fixture()
  let id = f.demo.start('escalation')
  f.runtime.pauseTask(id)
  assert.equal(f.demo.canNext.value, false)
  f.runtime.resumeTask(id)
  assert.equal(f.demo.next(), false)
  assert.match(f.demo.hint.value, /重新开始体验/)
  id = f.demo.start('recovery')
  f.runtime.updateTask(id, { ...f.task(), confirmed: true, maxDurationMinutes: 20 })
  assert.equal(f.demo.next(), false)
  assert.match(f.demo.hint.value, /规则已修改/)
})

test('reportRequested 守卫在demo模式保留', () => {
  const f = fixture()
  const id = f.runtime.createTask({
    name: '不汇报',
    question: '监督',
    scope: 'current_account',
    minDurationMinutes: 5,
    remind: false,
    reportRequested: false,
    confirmed: true
  })
  for (let number = 1; number <= 3; number++) {
    f.runtime.processCoursewareSnapshot({ id: number, status: 'running' })
    f.runtime.processCoursewareSnapshot(
      { id: number, status: 'succeeded', done: true, resultCoursewareId: number },
      { creatorId: '42', estimatedDurationSeconds: 180, source: '演示' }
    )
  }
  assert.equal(f.runtime.tasks.value.find((item) => item.id === id)!.escalations.length, 0)
})
