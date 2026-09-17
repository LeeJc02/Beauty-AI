import { describe, expect, it } from 'vitest'
import {
  buildCoursewareAgentActivity,
  COURSEWARE_AGENT_STAGES,
  resolveCoursewareAgentStageIndex
} from '../agentActivity'
import { COURSEWARE_TASK_STATUS } from '../generationTask'
import type { CoursewareGenerationTaskVO } from '@/api/courseware'

const buildTask = (
  overrides: Partial<CoursewareGenerationTaskVO> = {}
): CoursewareGenerationTaskVO =>
  ({
    id: 1,
    status: COURSEWARE_TASK_STATUS.RUNNING,
    ...overrides
  }) as CoursewareGenerationTaskVO

describe('resolveCoursewareAgentStageIndex', () => {
  it('回退到首个阶段且不抛错', () => {
    expect(resolveCoursewareAgentStageIndex(undefined)).toBe(0)
    expect(resolveCoursewareAgentStageIndex(null)).toBe(0)
    expect(resolveCoursewareAgentStageIndex(buildTask())).toBe(0)
  })

  it('按 step 推进阶段', () => {
    expect(resolveCoursewareAgentStageIndex(buildTask({ step: 'reviewing_outline' }))).toBe(1)
    expect(resolveCoursewareAgentStageIndex(buildTask({ step: 'splitting_outline' }))).toBe(2)
    expect(resolveCoursewareAgentStageIndex(buildTask({ step: 'generating_children' }))).toBe(3)
  })

  it('按状态推进阶段', () => {
    expect(resolveCoursewareAgentStageIndex(buildTask({ status: 'SUCCEEDED' }))).toBe(4)
    expect(resolveCoursewareAgentStageIndex(buildTask({ status: 'GENERATING_CHILDREN' }))).toBe(3)
  })

  it('取 step、状态与轨迹事件中的最大阶段，避免进度回退', () => {
    const task = buildTask({
      step: 'initializing',
      traceEvents: [{ at: '2026-01-01T00:00:00.000Z', event: 'outline_split' }]
    })
    expect(resolveCoursewareAgentStageIndex(task)).toBe(2)
  })

  it('阶段序列覆盖完整流水线', () => {
    expect(COURSEWARE_AGENT_STAGES).toEqual(['clarify', 'outline', 'split', 'children', 'done'])
  })
})

describe('buildCoursewareAgentActivity', () => {
  it('最新事件排在最前，并标记失败事件', () => {
    const task = buildTask({
      traceEvents: [
        { at: '2026-01-01T00:00:00.000Z', event: 'prompt_enhancement_started' },
        { at: '2026-01-01T00:01:00.000Z', event: 'outline_review_started' },
        { at: '2026-01-01T00:02:00.000Z', event: 'child_failed' }
      ]
    })

    const activity = buildCoursewareAgentActivity(task)
    expect(activity.map((item) => item.event)).toEqual([
      'child_failed',
      'outline_review_started',
      'prompt_enhancement_started'
    ])
    expect(activity[0].state).toBe('failed')
    expect(activity[1].state).toBe('done')
  })

  it('忽略无信息量或未知事件，保证左侧面板不堆噪声', () => {
    const task = buildTask({
      traceEvents: [
        { at: '2026-01-01T00:00:00.000Z', event: 'heartbeat' },
        { at: '2026-01-01T00:00:01.000Z', event: 'outline_split' }
      ]
    })

    expect(buildCoursewareAgentActivity(task).map((item) => item.event)).toEqual(['outline_split'])
  })

  it('缺少轨迹时返回空列表', () => {
    expect(buildCoursewareAgentActivity(undefined)).toEqual([])
    expect(buildCoursewareAgentActivity(buildTask())).toEqual([])
  })
})
