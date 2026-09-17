import { COURSEWARE_TASK_STATUS } from './generationTask'
import type { CoursewareGenerationTaskVO } from '@/api/courseware'

/** 智能体执行阶段。顺序即真实生成流水线，用于左侧“执行轨迹”高亮。 */
export const COURSEWARE_AGENT_STAGES = ['clarify', 'outline', 'split', 'children', 'done'] as const

export type CoursewareAgentStageKey = (typeof COURSEWARE_AGENT_STAGES)[number]

const STEP_STAGE_INDEX: Record<string, number> = {
  initializing: 0,
  waiting_for_user: 0,
  waiting_for_confirmation: 0,
  reviewing_outline: 1,
  splitting_outline: 2,
  generating_children: 3,
  succeeded: 4
}

const STATUS_STAGE_INDEX: Record<string, number> = {
  [COURSEWARE_TASK_STATUS.QUEUED]: 0,
  [COURSEWARE_TASK_STATUS.WAITING_INTEGRATION]: 0,
  [COURSEWARE_TASK_STATUS.WAITING_FOR_USER]: 0,
  [COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION]: 0,
  [COURSEWARE_TASK_STATUS.REVIEWING_OUTLINE]: 1,
  [COURSEWARE_TASK_STATUS.SPLITTING_OUTLINE]: 2,
  [COURSEWARE_TASK_STATUS.GENERATING_CHILDREN]: 3,
  [COURSEWARE_TASK_STATUS.SUCCEEDED]: 4
}

const EVENT_STAGE_INDEX: Record<string, number> = {
  prompt_enhancement_started: 0,
  requirement_questions_presented: 0,
  requirement_confirmation_presented: 0,
  user_answers_received: 0,
  requirement_confirmed: 0,
  prompt_enhancement_completed: 0,
  outline_review_started: 1,
  outline_review_completed: 1,
  outline_split: 2,
  parts_selection_presented: 2,
  parts_selected: 2,
  child_created: 3,
  child_started: 3,
  child_retry: 3,
  child_succeeded: 3,
  child_failed: 3,
  job_succeeded: 4
}

/**
 * 依据任务 step、状态与已记录的轨迹事件，推断当前执行阶段。
 * 三者取最大值，避免进度回退导致轨迹抖动。
 */
export function resolveCoursewareAgentStageIndex(task?: CoursewareGenerationTaskVO | null): number {
  if (!task) return 0
  const candidates: number[] = [0]
  const stepIndex = task.step ? STEP_STAGE_INDEX[task.step] : undefined
  if (stepIndex != null) candidates.push(stepIndex)
  const statusIndex = STATUS_STAGE_INDEX[String(task.status ?? '')]
  if (statusIndex != null) candidates.push(statusIndex)
  for (const event of task.traceEvents || []) {
    const index = EVENT_STAGE_INDEX[event?.event || '']
    if (index != null) candidates.push(index)
  }
  return Math.max(...candidates)
}

export interface CoursewareAgentActivityItem {
  id: string
  event: string
  at?: string
  message?: string
  state: 'done' | 'failed'
}

const FAILED_EVENTS = new Set(['job_failed', 'child_failed'])

/** 将后端轨迹事件转换为左侧执行面板可见的活动记录（最新在前）。
 * 只保留有信息量的事件，避免把心跳类记录堆到界面上。
 */
export function buildCoursewareAgentActivity(
  task?: CoursewareGenerationTaskVO | null
): CoursewareAgentActivityItem[] {
  const events = task?.traceEvents || []
  return events
    .filter((event) => event?.event && EVENT_STAGE_INDEX[event.event] != null)
    .map((event, index) => ({
      id: `${event.at || ''}-${event.event}-${index}`,
      event: event.event,
      at: event.at,
      message: event.message,
      state: FAILED_EVENTS.has(event.event) ? ('failed' as const) : ('done' as const)
    }))
    .reverse()
}
