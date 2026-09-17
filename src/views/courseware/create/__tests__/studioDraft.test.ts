import { describe, expect, it } from 'vitest'
import {
  answerText,
  buildStudioInstruction,
  createStudioDraft,
  studioDraftKey
} from '../studioDraft'
import type { CoursewareGenerationTaskVO } from '@/api/courseware'

const task: CoursewareGenerationTaskVO = {
  id: 21,
  status: 21,
  step: 'waiting_for_user',
  promptEnhancement: {
    clarificationRound: 1,
    questions: [
      { id: 'q1', question: '客户怎么回应？', required: true, allowCustom: true, options: [] }
    ]
  }
}
describe('course studio drafts', () => {
  it('keeps draft identity across polling but distinguishes reused question ids in a new round', () => {
    expect(studioDraftKey({ ...task, progress: 20 })).toBe(studioDraftKey(task))
    expect(
      studioDraftKey({
        ...task,
        promptEnhancement: { ...task.promptEnhancement, clarificationRound: 2 }
      })
    ).not.toBe(studioDraftKey(task))
    expect(
      studioDraftKey({
        ...task,
        promptEnhancement: {
          questions: [{ id: 'q1', question: '什么时候不适用？', required: true }]
        }
      })
    ).not.toBe(studioDraftKey(task))
  })
  it('does not mutate server snapshots when editing an outline', () => {
    const source = {
      ...task,
      partSelection: {
        required: true,
        parts: [
          {
            partIndex: 1,
            partCount: 1,
            title: 'Course',
            outlines: [
              {
                id: 'p1',
                type: 'slide' as const,
                title: 'Title',
                description: 'Purpose',
                keyPoints: ['One']
              }
            ]
          }
        ]
      }
    }
    const draft = createStudioDraft(source)
    draft.outlines[0].keyPoints.push('Two')
    expect(source.partSelection.parts[0].outlines[0].keyPoints).toEqual(['One'])
    expect(draft.selectedPartIndexes).toEqual([1])
  })
  it('shows selected option labels and preserves free-text answers', () => {
    const question = { options: [{ id: 'new', label: '门店新人' }] }
    expect(answerText(question, 'new')).toBe('门店新人')
    expect(answerText(question, '资深店长')).toBe('资深店长')
  })
  it('passes the chosen teaching approach without inventing a topic', () => {
    expect(buildStudioInstruction('  异议处理  ', 'experience')).toBe(
      '异议处理\n\n课程类型：讲案例、讲经验'
    )
    expect(buildStudioInstruction('', 'auto')).toBeUndefined()
  })
})
