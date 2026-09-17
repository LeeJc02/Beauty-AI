import type {
  CoursewareGenerationTaskVO,
  CoursewareOutlineDraftVO,
  CoursewareStudioConfirmation
} from './apiTypes'

export interface StudioDraft {
  answers: Record<string, string>
  customAnswers: Record<string, string>
  notes: Record<string, string>
  brief: NonNullable<CoursewareStudioConfirmation['requirementEdits']>
  outlines: CoursewareOutlineDraftVO[]
  selectedPartIndexes: number[]
}

/** Polling replaces task objects. Only a new question round or review phase
 * should initialize the editor, never a progress/heartbeat update. */
export function studioDraftKey(task?: CoursewareGenerationTaskVO | null): string {
  if (!task) return ''
  const prompt = task.promptEnhancement
  return JSON.stringify([
    task.id,
    task.step,
    prompt?.clarificationRound,
    prompt?.summary?.planningOutline?.map(({ id }) => id),
    (prompt?.questions || []).map(({ id, question }) => [id, question]),
    (task.partSelection?.parts || []).map((part) => [
      part.partIndex,
      part.outlines?.map(({ id }) => id)
    ])
  ])
}

export function createStudioDraft(task?: CoursewareGenerationTaskVO | null): StudioDraft {
  const summary = task?.promptEnhancement?.summary
  return {
    answers: Object.fromEntries(
      (task?.promptEnhancement?.questions || []).flatMap((question) => {
        const recommended =
          question.options?.find((option) => option.id === question.recommendedOptionId) ||
          question.options?.find((option) => option.recommended)
        return recommended ? [[question.id, recommended.id]] : []
      })
    ),
    customAnswers: {},
    notes: {},
    brief: {
      title: summary?.title || '',
      audience: summary?.audience || '',
      objective: summary?.objective || '',
      mustInclude: [...(summary?.scope?.mustInclude || [])]
    },
    outlines: (task?.partSelection?.parts?.length
      ? task.partSelection.parts.flatMap((part) => part.outlines || [])
      : (summary?.planningOutline || []).map((outline) => ({ ...outline, type: 'slide' as const }))
    ).map((outline) => ({ ...outline, keyPoints: [...outline.keyPoints] })),
    selectedPartIndexes: [
      ...(task?.partSelection?.selectedPartIndexes ??
        task?.partSelection?.parts.map((part) => part.partIndex) ??
        [])
    ]
  }
}

export function answerText(
  question: { options?: Array<{ id: string; label: string }> },
  value: string
): string {
  return question.options?.find((option) => option.id === value)?.label || value
}

export function buildStudioInstruction(prompt: string, kind: string): string | undefined {
  const kinds: Record<string, string> = {
    experience: '讲案例、讲经验',
    operation: '教做事、教操作',
    knowledge: '讲知识、讲方法'
  }
  return (
    [prompt.trim(), kinds[kind] ? `课程类型：${kinds[kind]}` : ''].filter(Boolean).join('\n\n') ||
    undefined
  )
}
