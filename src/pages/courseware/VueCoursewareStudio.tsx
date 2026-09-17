import { useEffect, useRef } from 'react'
import { createApp, h, reactive, type App } from 'vue'
import VueStudioSfc from './vue-studio/CoursewareStudio.vue'
import {
  canRetryHomework,
  resolveGenerationStatus,
  resolveProgress,
  type CwQuestion,
  type CwOutline,
  type CwTask,
  waitingQuestions,
} from '../../lib/coursewareStudio'
import type { CoursewareGenerationTaskVO } from './vue-studio/apiTypes'
import './courseware.css'

export interface VueCoursewareStudioProps {
  task: CwTask
  sourcePrompt: string
  busy: boolean
  autoConfirm?: boolean
  onAnswer: (questions: CwQuestion[], answers: Record<string, string>, notes: Record<string, string>) => void
  onConfirm: (payload: {
    requirementEdits?: {
      title: string
      audience: string
      objective: string
      mustInclude: string[]
      planningOutline: { id: string; title: string; description: string; keyPoints: string[] }[]
    }
    outlineEdits: CwOutline[]
    selectedPartIndexes: number[]
  }) => void
  onCancel: () => void
  onRetryHomework?: () => void
}

/** 将 Beauty 的演示 VO 适配为原版 Vue 工作台需要的字段形状。 */
function toVueTask(task: CwTask): CoursewareGenerationTaskVO {
  return {
    ...(task as unknown as CoursewareGenerationTaskVO),
    id: task.id,
    status: task.status,
    step: task.step,
    progress: task.progress,
    generation: task.generation
      ? ({ ...task.generation, phase: task.generation.phase } as CoursewareGenerationTaskVO['generation'])
      : undefined,
    series: task.series as CoursewareGenerationTaskVO['series'],
    partSelection: task.partSelection as CoursewareGenerationTaskVO['partSelection'],
    promptEnhancement: task.promptEnhancement as CoursewareGenerationTaskVO['promptEnhancement'],
  }
}

/**
 * React 只负责生命周期和事件转换；视觉、键盘交互、草稿和页面预览全部由原版 Vue 源码负责。
 * 每次 task/busy 更新都通过 updateProps 重新设置 Vue props，不重建 Vue app。
 */
export function VueCoursewareStudio({
  task,
  sourcePrompt,
  busy,
  autoConfirm = false,
  onAnswer,
  onConfirm,
  onCancel,
  onRetryHomework,
}: VueCoursewareStudioProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const bridgePropsRef = useRef<Record<string, any> | null>(null)
  const propsRef = useRef({ task, sourcePrompt, busy, autoConfirm, onAnswer, onConfirm, onCancel, onRetryHomework })
  propsRef.current = { task, sourcePrompt, busy, autoConfirm, onAnswer, onConfirm, onCancel, onRetryHomework }

  useEffect(() => {
    if (!hostRef.current) return
    const getProps = () => {
      const current = propsRef.current
      const vueTask = toVueTask(current.task)
      const status = resolveGenerationStatus(current.task)
      return {
        task: vueTask,
        sourcePrompt: current.sourcePrompt,
        busy: current.busy,
        autoConfirm: current.autoConfirm,
        statusTitle: status.title,
        statusDescription: status.description,
        progress: resolveProgress(current.task),
        sourcePreparationPending: current.task.sourcePreparation?.status === 'running',
        canRetryHomework: canRetryHomework(current.task),
        onAnswer: (answers: Array<{ id: string; value: string; note?: string }>) => {
          const latest = propsRef.current
          const questions = waitingQuestions(latest.task)
          const values: Record<string, string> = {}
          const notes: Record<string, string> = {}
          answers.forEach((answer) => {
            values[answer.id] = answer.value
            if (answer.note) notes[answer.id] = answer.note
          })
          latest.onAnswer(questions, values, notes)
        },
        onConfirm: (payload: any) => propsRef.current.onConfirm({
          requirementEdits: payload.requirementEdits
            ? { ...payload.requirementEdits, planningOutline: payload.requirementEdits.planningOutline ?? [] }
            : undefined,
          outlineEdits: payload.outlineEdits ?? [],
          selectedPartIndexes: payload.selectedPartIndexes ?? [],
        }),
        onCancel: () => propsRef.current.onCancel(),
        onRetryHomework: () => propsRef.current.onRetryHomework?.(),
      }
    }
    const bridgeProps = reactive(getProps())
    const app = createApp({ setup: () => () => h(VueStudioSfc, bridgeProps) })
    appRef.current = app
    bridgePropsRef.current = bridgeProps
    app.mount(hostRef.current)
    return () => {
      app.unmount()
      appRef.current = null
      bridgePropsRef.current = null
    }
  }, [])

  useEffect(() => {
    const bridgeProps = bridgePropsRef.current
    if (!bridgeProps) return
    const current = propsRef.current
    bridgeProps.task = toVueTask(current.task)
    bridgeProps.sourcePrompt = current.sourcePrompt
    bridgeProps.busy = current.busy
    bridgeProps.autoConfirm = current.autoConfirm
    bridgeProps.statusTitle = resolveGenerationStatus(current.task).title
    bridgeProps.statusDescription = resolveGenerationStatus(current.task).description
    bridgeProps.progress = resolveProgress(current.task)
    bridgeProps.sourcePreparationPending = current.task.sourcePreparation?.status === 'running'
    bridgeProps.canRetryHomework = canRetryHomework(current.task)
  }, [task, sourcePrompt, busy, autoConfirm])

  return <div ref={hostRef} style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column' }} />
}
