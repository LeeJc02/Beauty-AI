import { describe, expect, it } from 'vitest'
import type { CoursewareGenerationQuestionVO } from '@/api/courseware'
import {
  COURSEWARE_TASK_STATUS,
  buildTaskAnswerPayload,
  createCoursewareFormDefaults,
  getSeriesTaskProgressSummary,
  getWaitingConfirmationSummary,
  getWaitingQuestions,
  hasCoursewarePreviewRouteQuery,
  isCoursewareTaskActive,
  isCoursewareTaskFailed,
  isCoursewareTaskResultReady,
  mergeWaitingQuestionAnswers,
  mergeWaitingQuestionNotes,
  resolveCoursewareTaskResult,
  resolveCoursewareTaskDisplayStatus,
  resolveCoursewareTaskProgress,
  resolveCoursewareTaskStage,
  resolveCoursewareSeriesItemProgress,
  resolveCoursewareTaskStatus,
  resolveWaitingQuestionSignature,
  withOutlineEnhancementPayload,
  resolvePartSelectionPlan,
  resolvePartSelectionSignature,
  defaultSelectedPartIndexes,
  resolvePartSelectionInit,
  recommendedQuestionAnswer,
  NONE_ANSWER
} from '../generationTask'

describe('generationTask helpers', () => {
  it('defaults to the first option when a recommendation is absent or invalid', () => {
    const question = {
      id: 'q',
      question: 'Question',
      required: true,
      options: [{ id: 'first', label: 'First' }]
    }
    expect(recommendedQuestionAnswer(question)).toBe('first')
    expect(recommendedQuestionAnswer({ ...question, recommendedOptionId: 'missing' })).toBe('first')
    expect(recommendedQuestionAnswer({ ...question, options: [] })).toBe(NONE_ANSWER)
  })

  it('builds default form state with smart splitting enabled', () => {
    const defaults = createCoursewareFormDefaults('cn')
    expect(defaults.language).toBe('cn')
    expect(defaults.outlineEnhancementEnabled).toBe(true)
    expect(defaults.generateHomeworkSync).toBe(true)
    expect(defaults.enableImageGeneration).toBe(true)
    expect(defaults).not.toHaveProperty('promptEnhancementEnabled')
  })

  it('adds only the outline enhancement switch to the generation payload', () => {
    const payload = withOutlineEnhancementPayload(
      {
        description: 'desc',
        generateHomeworkSync: true,
        promptEnhancementEnabled: true
      },
      false
    )

    expect(payload).toEqual({
      description: 'desc',
      generateHomeworkSync: true,
      promptEnhancementEnabled: true,
      outlineEnhancementEnabled: false
    })
  })

  it('maps numeric, numeric-string, and case-insensitive task statuses', () => {
    expect(resolveCoursewareTaskStatus(10)).toBe(COURSEWARE_TASK_STATUS.QUEUED)
    expect(resolveCoursewareTaskStatus('10')).toBe(COURSEWARE_TASK_STATUS.QUEUED)
    expect(resolveCoursewareTaskStatus('SUCCEEDED')).toBe(COURSEWARE_TASK_STATUS.SUCCEEDED)
    expect(resolveCoursewareTaskStatus('FAILED')).toBe(COURSEWARE_TASK_STATUS.FAILED)
    expect(resolveCoursewareTaskStatus('CANCELLED')).toBe(COURSEWARE_TASK_STATUS.CANCELED)
    expect(resolveCoursewareTaskStatus('WAITING_FOR_USER')).toBe(
      COURSEWARE_TASK_STATUS.WAITING_FOR_USER
    )
    expect(resolveCoursewareTaskStatus('GENERATING_CHILDREN')).toBe(
      COURSEWARE_TASK_STATUS.GENERATING_CHILDREN
    )
    expect(isCoursewareTaskActive('running')).toBe(true)
    expect(isCoursewareTaskActive('WAITING_FOR_CONFIRMATION')).toBe(true)
    expect(isCoursewareTaskFailed('failed')).toBe(true)
  })

  it('uses the preserved task step for localized running-stage progress', () => {
    expect(resolveCoursewareTaskDisplayStatus({ status: 20, step: 'splitting_outline' })).toBe(
      COURSEWARE_TASK_STATUS.SPLITTING_OUTLINE
    )
    expect(
      resolveCoursewareTaskDisplayStatus({ status: 'RUNNING', step: 'generating_children' })
    ).toBe(COURSEWARE_TASK_STATUS.GENERATING_CHILDREN)
    expect(
      resolveCoursewareTaskDisplayStatus({ status: 'SUCCEEDED', step: 'reviewing_outline' })
    ).toBe(COURSEWARE_TASK_STATUS.SUCCEEDED)
  })

  it('keeps backend finalization phases and never presents failed work as 100%', () => {
    expect(resolveCoursewareTaskStage({ status: 'running', step: 'generating_media' })).toBe(
      'generating_media'
    )
    expect(resolveCoursewareTaskStage({ status: 'running', step: 'generating_tts' })).toBe(
      'generating_tts'
    )
    expect(resolveCoursewareTaskStage({ status: 'running', step: 'persisting' })).toBe('persisting')
    expect(resolveCoursewareTaskStage({ status: 'running', step: 'finalizing' })).toBe('finalizing')
    expect(resolveCoursewareTaskProgress({ status: 'failed', progress: 100 })).toBe(99)
    expect(resolveCoursewareSeriesItemProgress({ status: 'failed', progress: 100 })).toBe(99)
    expect(resolveCoursewareSeriesItemProgress({ status: 'succeeded', progress: 100 }, true)).toBe(
      90
    )
    expect(
      resolveCoursewareSeriesItemProgress(
        { status: 'succeeded', progress: 100, homeworkGenerationStatus: 'running' },
        true
      )
    ).toBe(95)
    expect(
      resolveCoursewareSeriesItemProgress(
        { status: 'succeeded', progress: 100, homeworkGenerationStatus: 'imported' },
        true
      )
    ).toBe(100)
    expect(
      resolveCoursewareSeriesItemProgress(
        { status: 'succeeded', progress: 100, homeworkGenerationStatus: 'failed' },
        true
      )
    ).toBe(99)
  })

  it('forces 100% only when the root task and synchronous homework are complete', () => {
    const task = {
      status: 'succeeded',
      progress: 81,
      done: true,
      generateHomeworkSync: true,
      homeworkGenerationStatus: 'imported'
    }
    expect(resolveCoursewareTaskProgress(task)).toBe(100)
  })

  it('recognizes series preview query parameters as a resumable route', () => {
    expect(hasCoursewarePreviewRouteQuery({ seriesId: 'series-1', currentPart: '2' })).toBe(true)
    expect(hasCoursewarePreviewRouteQuery({ seriesId: '', currentPart: null })).toBe(false)
  })

  it('summarizes completed child coursewares from the server series state', () => {
    expect(
      getSeriesTaskProgressSummary({
        series: {
          seriesId: 'series-1',
          title: '销售培训',
          items: [
            {
              childJobId: 'child-1',
              partIndex: 1,
              partCount: 3,
              title: '第一部分',
              status: 'succeeded'
            },
            {
              childJobId: 'child-2',
              partIndex: 2,
              partCount: 3,
              title: '第二部分',
              status: 'running'
            },
            {
              childJobId: 'child-3',
              partIndex: 3,
              partCount: 3,
              title: '第三部分',
              status: 'failed'
            }
          ]
        }
      })
    ).toEqual({ total: 3, completed: 2 })
  })

  it('exposes waiting questions and confirmation summary', () => {
    const questions = [
      {
        id: 'audience',
        question: '面向谁？',
        required: true,
        allowCustom: false,
        recommendedOptionId: 'ba',
        options: [
          { id: 'ba', label: 'BA', recommended: true },
          { id: 'manager', label: '管理者' }
        ]
      }
    ]
    const summary = { title: '新品培训', objective: '统一话术' }

    expect(
      getWaitingQuestions({
        status: 'WAITING_FOR_USER',
        promptEnhancement: { questions }
      })
    ).toEqual(questions)

    expect(
      getWaitingConfirmationSummary({
        status: 'WAITING_FOR_CONFIRMATION',
        promptEnhancement: { summary }
      })
    ).toEqual(summary)
  })

  it('builds answer payload from selected option ids', () => {
    const answers = buildTaskAnswerPayload(
      [
        {
          id: 'audience',
          question: '面向谁？',
          required: true,
          allowCustom: false,
          options: [
            { id: 'ba', label: 'BA' },
            { id: 'manager', label: '管理者' }
          ]
        }
      ],
      { audience: 'manager' }
    )

    expect(answers).toEqual([{ id: 'audience', value: 'manager' }])
  })

  it('keeps and submits optional question notes without sending blank notes', () => {
    const questions: CoursewareGenerationQuestionVO[] = [
      { id: 'audience', question: '面向谁？', required: true }
    ]

    expect(mergeWaitingQuestionNotes({ audience: '更具体的受众' }, questions)).toEqual({
      audience: '更具体的受众'
    })
    expect(
      buildTaskAnswerPayload(questions, { audience: 'manager' }, { audience: '  只面向一线销售  ' })
    ).toEqual([{ id: 'audience', value: 'manager', note: '只面向一线销售' }])
    expect(buildTaskAnswerPayload(questions, { audience: 'manager' }, { audience: ' ' })).toEqual([
      { id: 'audience', value: 'manager' }
    ])
  })

  it('resolves single result preview and separate download url', () => {
    const state = resolveCoursewareTaskResult({
      status: 'succeeded',
      progress: 100,
      done: true,
      result: {
        url: 'https://preview.example.com/classroom/1',
        downloadUrl: 'https://download.example.com/courseware/1.pptx'
      }
    })

    expect(state.mode).toBe('single-preview')
    expect(state.previewUrl).toBe('https://preview.example.com/classroom/1')
    expect(state.downloadUrl).toBe('https://download.example.com/courseware/1.pptx')
  })

  it('shows series list by default and restores current part from query', () => {
    const task = {
      status: 'succeeded',
      progress: 100,
      done: true,
      series: {
        seriesId: 'series-1',
        title: '完整系列',
        items: [
          {
            childJobId: 'child-1',
            partIndex: 1,
            partCount: 2,
            title: '第一部分',
            status: 'succeeded',
            previewUrl: 'https://preview.example.com/1',
            downloadUrl: 'https://download.example.com/1.pptx'
          },
          {
            childJobId: 'child-2',
            partIndex: '2' as unknown as number,
            partCount: 2,
            title: '第二部分',
            status: 'succeeded',
            previewUrl: 'https://preview.example.com/2',
            downloadUrl: 'https://download.example.com/2.pptx'
          }
        ]
      }
    }

    const listState = resolveCoursewareTaskResult(task)
    expect(listState.mode).toBe('series-list')
    expect(listState.series?.items).toHaveLength(2)

    const previewState = resolveCoursewareTaskResult(task, {
      seriesId: 'series-1',
      currentPart: '2'
    })
    expect(previewState.mode).toBe('series-preview')
    expect(Number(previewState.currentItem?.partIndex)).toBe(2)
    expect(previewState.downloadUrl).toBe('https://download.example.com/2.pptx')
  })

  it('does not expose a preview before the durable task completion state', () => {
    const result = {
      previewUrl: 'https://preview.example.com/classroom/1'
    }

    expect(
      resolveCoursewareTaskResult({ status: 'succeeded', progress: 99, done: true, result }).mode
    ).toBe('single-preview')
    expect(
      resolveCoursewareTaskResult({ status: 'succeeded', progress: 100, done: false, result }).mode
    ).toBe('none')
    expect(isCoursewareTaskResultReady({ status: 'succeeded', progress: 100, done: true })).toBe(
      true
    )
  })

  it('requires every synchronous series homework task to be imported before preview', () => {
    const task = {
      status: 'succeeded',
      progress: 100,
      done: true,
      generateHomeworkSync: true,
      homeworkGenerationStatus: 'imported',
      series: {
        seriesId: 'series-1',
        title: '完整系列',
        items: [
          {
            childJobId: 'child-1',
            partIndex: 1,
            partCount: 2,
            title: '第一部分',
            status: 'succeeded',
            homeworkGenerationStatus: 'imported'
          },
          {
            childJobId: 'child-2',
            partIndex: 2,
            partCount: 2,
            title: '第二部分',
            status: 'succeeded',
            homeworkGenerationStatus: 'running'
          }
        ]
      }
    }

    expect(isCoursewareTaskResultReady(task)).toBe(false)
    expect(resolveCoursewareTaskResult(task).mode).toBe('none')

    task.series.items[1].homeworkGenerationStatus = 'imported'
    expect(isCoursewareTaskResultReady(task)).toBe(true)
  })

  it('does not preview a series snapshot before all declared parts arrive', () => {
    const task = {
      status: 'succeeded',
      progress: 100,
      done: true,
      generateHomeworkSync: true,
      homeworkGenerationStatus: 'imported',
      series: {
        seriesId: 'series-1',
        title: '完整系列',
        items: [
          {
            childJobId: 'child-1',
            partIndex: 1,
            partCount: 3,
            title: '第一部分',
            status: 'succeeded',
            homeworkGenerationStatus: 'imported'
          }
        ]
      }
    }

    expect(isCoursewareTaskResultReady(task)).toBe(false)
    expect(resolveCoursewareTaskResult(task).mode).toBe('none')
  })

  it('does not preview an empty series snapshot', () => {
    const task = {
      status: 'succeeded',
      progress: 100,
      done: true,
      generateHomeworkSync: true,
      homeworkGenerationStatus: 'imported',
      series: {
        seriesId: 'series-1',
        title: '完整系列',
        items: []
      }
    }

    expect(isCoursewareTaskResultReady(task)).toBe(false)
    expect(resolveCoursewareTaskResult(task).mode).toBe('none')
  })

  it('keeps selected answers while the question set is unchanged and defaults new questions to recommendations', () => {
    const questions: CoursewareGenerationQuestionVO[] = [
      { id: 'q1', question: '问题一', required: true },
      {
        id: 'q2',
        question: '问题二',
        required: true,
        recommendedOptionId: 'opt-recommended',
        options: [
          { id: 'opt-recommended', label: '推荐选项' },
          { id: 'opt-other', label: '其他选项' }
        ]
      }
    ]

    expect(resolveWaitingQuestionSignature(questions)).toBe('q1|q2')
    expect(resolveWaitingQuestionSignature([...questions].reverse())).toBe('q2|q1')

    const merged = mergeWaitingQuestionAnswers({ q1: 'opt-a', q2: '' }, questions)
    expect(merged).toEqual({ q1: 'opt-a', q2: 'opt-recommended' })
  })

  it('drops answers for questions that disappear and uses the recommended flag as a fallback', () => {
    const merged = mergeWaitingQuestionAnswers({ q1: 'opt-a', stale: 'opt-x' }, [
      { id: 'q1', question: '问题一', required: true },
      {
        id: 'q3',
        question: '问题三',
        required: true,
        options: [
          { id: 'opt-recommended', label: '推荐选项', recommended: true },
          { id: 'opt-other', label: '其他选项' }
        ]
      }
    ])

    expect(merged).toEqual({ q1: 'opt-a', q3: 'opt-recommended' })
  })

  it('does not replace an existing answer with a recommendation', () => {
    const merged = mergeWaitingQuestionAnswers({ audience: 'manager' }, [
      {
        id: 'audience',
        question: '面向谁？',
        required: true,
        recommendedOptionId: 'ba',
        options: [
          { id: 'ba', label: 'BA' },
          { id: 'manager', label: '管理者' }
        ]
      }
    ])

    expect(merged).toEqual({ audience: 'manager' })
  })
  it('only exposes the part selection plan while the job waits for the choice', () => {
    const plan = {
      required: true,
      parts: [
        { partIndex: 1, partCount: 2, title: '开场' },
        { partIndex: 2, partCount: 2, title: '收尾' }
      ]
    }

    expect(resolvePartSelectionPlan({ partSelection: plan })?.parts).toHaveLength(2)
    expect(
      resolvePartSelectionPlan({ partSelection: { ...plan, required: false } })
    ).toBeUndefined()
    expect(
      resolvePartSelectionPlan({ partSelection: { required: true, parts: [] } })
    ).toBeUndefined()
    expect(resolvePartSelectionPlan({})).toBeUndefined()
  })

  it('keeps part selection stable across polling and defaults to all parts', () => {
    const first = {
      required: true,
      parts: [
        { partIndex: 1, partCount: 3, title: 'A' },
        { partIndex: 2, partCount: 3, title: 'B' },
        { partIndex: 3, partCount: 3, title: 'C' }
      ]
    }
    const samePlanAfterPoll = { ...first, parts: first.parts.map((part) => ({ ...part })) }
    const changedPlan = { ...first, parts: first.parts.slice(0, 2) }

    // 同一份计划身份不变：轮询不应重置用户已取消的勾选。
    expect(resolvePartSelectionSignature(first)).toBe(
      resolvePartSelectionSignature(samePlanAfterPoll)
    )
    expect(resolvePartSelectionSignature(first)).not.toBe(
      resolvePartSelectionSignature(changedPlan)
    )
    expect(resolvePartSelectionSignature(undefined)).toBe('')
    // 默认全选
    expect(defaultSelectedPartIndexes(first)).toEqual([1, 2, 3])
    expect(defaultSelectedPartIndexes(undefined)).toEqual([])
  })

  it('initializes part selection once per plan and never restores a cleared selection', () => {
    const plan = {
      required: true,
      parts: [
        { partIndex: 1, partCount: 2, title: 'A' },
        { partIndex: 2, partCount: 2, title: 'B' }
      ]
    }

    // 第一次看到计划：默认全选
    const firstInit = resolvePartSelectionInit(plan, '')
    expect(firstInit).toEqual({ signature: '1|2', indexes: [1, 2] })

    // 同一份计划在轮询中被整体替换：不再干预，用户“全部取消”的选择得以保留
    expect(resolvePartSelectionInit(plan, '1|2')).toBeUndefined()

    // 计划真的变了（少了第 2 部分）：重新初始化
    expect(resolvePartSelectionInit({ ...plan, parts: plan.parts.slice(0, 1) }, '1|2')).toEqual({
      signature: '1',
      indexes: [1]
    })

    // 离开勾选阶段：清空
    expect(resolvePartSelectionInit(undefined, '1|2')).toEqual({ signature: '', indexes: [] })
  })
})
