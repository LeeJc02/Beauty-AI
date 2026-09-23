import { describe, expect, it } from 'vitest'
import type { DeepReadonly } from 'vue'
import type {
  CoursewareInspectionEntry,
  CoursewareInspectionTask
} from '../../../../beauty/lib/coursewareInspection'
import type { InspectionQueryResult } from '../../../../beauty/lib/inspectionQuery'
import { taskIntelligence } from './taskPresentation'

function task(patch: Partial<CoursewareInspectionTask> = {}): CoursewareInspectionTask {
  return {
    id: 'task',
    name: '新品培训',
    question: '核验新品培训',
    scope: 'current_account',
    remind: false,
    reportRequested: false,
    createdAt: '2026-09-21',
    subscribedAt: '2026-09-21',
    completedAt: '2026-09-22',
    enabled: false,
    entries: [],
    ignoredIds: [],
    trainerFailures: {},
    escalations: [],
    ownerUserId: 'owner',
    mode: 'once',
    ...patch
  }
}
function query(rows: InspectionQueryResult['rows'], patch: Partial<InspectionQueryResult> = {}) {
  return task({
    queryResult: {
      status: 'complete',
      summary: '本次查询已完成，全部合规。',
      rows,
      columns: [],
      tools: [],
      evidence: [],
      ...patch
    }
  })
}
function entry(patch: Partial<CoursewareInspectionEntry>): CoursewareInspectionEntry {
  return {
    id: 'entry',
    generationTaskId: 1,
    title: '新品课件',
    creator: '王老师',
    status: 'completed',
    summary: '',
    events: [],
    ...patch
  }
}

describe('完成任务业务情报', () => {
  it('优先依据明细给出对象、实际成绩、完课和合规比例，不复述动作', () => {
    const result = taskIntelligence(
      query([
        {
          person: '李欣',
          title: '新品培训',
          score: 72,
          courseCompleted: '未完课',
          result: '未达标'
        },
        { person: '张敏', score: 90, courseCompleted: '已完课', result: '达标' },
        { person: '陈悦', score: null, courseCompleted: '待补齐', result: '缺少依据，暂不判断' }
      ])
    )
    expect(result).toContain('李欣 · 新品培训：未完课，考核 72 分，未达标')
    expect(result).toContain('张敏：已完课，考核 90 分')
    expect(result).toContain('1 项合规，1 项不合规，1 项待补依据')
    expect(result).toContain('可判定 2 项中合规比例 50%')
    expect(result).not.toContain('本次查询已完成')
    expect(result).not.toContain('全部合规')
  })
  it('课件依据实际时长而非生成目标，保留 0 值', () => {
    const source = query([
      { title: '防晒课件', creator: '王老师', duration: 0, result: '不符合时长要求' }
    ])
    source.minDurationMinutes = 5
    source.maxDurationMinutes = 10
    expect(taskIntelligence(source)).toContain(
      '王老师 · 防晒课件：预计学习时长 0 分钟，不符合时长要求'
    )
    expect(taskIntelligence(source)).toContain('合规比例 0%')
  })
  it('全缺依据没有合规比例，不把未知结果计为合格', () => {
    const result = taskIntelligence(
      query([
        { title: '课件', duration: null, result: '缺少预计学习时长，暂不能判断' },
        { title: '旧记录' }
      ])
    )
    expect(result).toContain('2 项待补依据')
    expect(result).toContain('暂无可判定的合规比例')
  })
  it('质量凭据不是质量合格', () => {
    const result = taskIntelligence(
      query([{ title: '课件', result: '已具备生成状态与产物凭据；内容质量待评审' }])
    )
    expect(result).toContain('0 项合规')
    expect(result).toContain('1 项内容质量待评审')
  })
  it.each(['', '已查询 0 件课件：全部合规。', '未找到匹配记录，全部合规。'])(
    '零样本不报告全部合规：%s',
    (summary) => {
      expect(taskIntelligence(query([], { summary }))).toBe(
        '没有匹配记录，暂无可核验样本，不能判断是否全部合规。'
      )
    }
  )
  it('失败不采用残留行或成功摘要', () => {
    expect(taskIntelligence(query([{ result: '达标' }], { status: 'error' }))).toBe(
      '数据读取失败，未形成可靠核验结论，不能判断是否合规。'
    )
  })
  it('partial 即使已读取行全合规也不扩展成总体结论', () => {
    expect(taskIntelligence(query([{ result: '达标' }], { status: 'partial' }))).toContain(
      '结论仅限已有记录，不能代表全部对象'
    )
  })
  it('旧 fixtures 保留业务总结并删除查询完成和不持续关注套话', () => {
    expect(
      taskIntelligence(
        query([], {
          summary:
            '已查询 3 件新品课件，预计学习时长均符合 5–10 分钟要求。本次查询已完成，不持续关注后续事件。'
        })
      )
    ).toBe('已查询 3 件新品课件，预计学习时长均符合 5–10 分钟要求。')
  })
  it('只有操作套话时不伪造业务结论', () => {
    expect(
      taskIntelligence(query([], { summary: '本次查询完成。不再持续关注后续事件。' }))
    ).toContain('暂无可核验样本')
  })
  it('结束监督依据核验事实统计，停止和签收不等于达标', () => {
    const source = task({
      mode: 'continuous',
      entries: [
        entry({ outcome: 'passed', estimatedDurationSeconds: 420 }),
        entry({ outcome: 'acknowledged', estimatedDurationSeconds: 120 }),
        entry({ outcome: 'stopped', evaluatedOutcome: 'missing' }),
        entry({ outcome: 'stopped', events: [{ at: '', text: '已核验，预计学习时长不符合要求' }] }),
        entry({ outcome: 'stopped' })
      ]
    })
    const readonlyTask: DeepReadonly<CoursewareInspectionTask> = source
    const before = JSON.stringify(source)
    const result = taskIntelligence(readonlyTask)
    expect(result).toContain('1 项合规，2 项不合规，2 项待补依据')
    expect(result).toContain('合规比例 33.3%')
    expect(result).toContain('预计学习时长 2 分钟')
    expect(result).toContain('其余 2 项见任务明细')
    expect(result).not.toContain('预计学习时长 7 分钟')
    expect(result).toContain('签收仅代表知悉，不代表整改达标')
    expect(JSON.stringify(source)).toBe(before)
  })
  it('无查询结果与无监督样本都不报合格', () => {
    expect(taskIntelligence(task())).toContain('缺少查询结果')
    expect(taskIntelligence(task({ mode: 'continuous' }))).toContain('暂无核验样本')
  })
})
