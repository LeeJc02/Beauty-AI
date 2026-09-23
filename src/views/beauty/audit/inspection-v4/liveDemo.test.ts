import { describe, expect, it } from 'vitest'
import { DEMO_STEP_MS, DEMO_TRIGGER_SECONDS, latestRoundEvents } from './liveDemo'
import { seedTasks, type AgentEvent } from './taskFlow'

describe('liveDemo 最近轮回放', () => {
  it('演示时钟为20秒触发、850ms逐事件', () => {
    expect(DEMO_TRIGGER_SECONDS).toBe(20)
    expect(DEMO_STEP_MS).toBe(850)
  })
  it('只回放指定轮次，不修改原始记录、人员或通知', () => {
    const item = seedTasks().find((item) => item.demoKey === 'scheduled-report')!
    const before = JSON.stringify(item)
    const events = latestRoundEvents(item.trace!, item.round)
    expect(events.length).toBeGreaterThan(1)
    expect(events.every((event) => event.round === item.round)).toBe(true)
    expect(events.some((event) => event.title === 'feishu.report')).toBe(true)
    expect(JSON.stringify(item)).toBe(before)
  })
  it('旧记录以最后规划段开始，不回放全部历史', () => {
    const events: AgentEvent[] = [
      { id: '1', kind: 'analysis', title: '工具选择', detail: '' },
      { id: '2', kind: 'tool', title: 'training_records.query', detail: '' },
      { id: '3', kind: 'analysis', title: '复查 Agent · 第2轮', detail: '' },
      { id: '4', kind: 'tool', title: 'qualification.evaluate', detail: '' }
    ]
    expect(latestRoundEvents(events, 2)).toEqual(events.slice(2))
    expect(latestRoundEvents([], 0)).toEqual([])
  })
  it('无法判定轮次的旧记录回放最多12条', () => {
    const events: AgentEvent[] = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      kind: 'tool',
      title: 'query',
      detail: ''
    }))
    expect(latestRoundEvents(events, 0)).toEqual(events.slice(-12))
  })
})
