import type { CoursewareVO, CoursewarePageReqVO } from '@/api/courseware'
import { validInspectionTime, inspectionDateInRange } from './inspectionTime'
import {
  trainingData,
  trainingOutcome,
  matchesTrainingScope,
  trainingScopeValid,
  type TrainingRecord
} from './trainingInspection'
import {
  validInspectionDurationBounds,
  type InspectionRequestPlan,
  type InspectionTool
} from './inspectionRequest'

export interface InspectionQueryResult {
  toolRuns?: Array<{
    id: string
    label: string
    at: string
    status: 'completed' | 'failed'
    input: string
    output: string
  }>
  status: 'complete' | 'partial' | 'error'
  summary: string
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, string | number | null>>
  tools: InspectionTool[]
  evidence: string[]
}
export type CoursewarePageReader = (
  params: CoursewarePageReqVO
) => Promise<{ list: CoursewareVO[]; total: number }>
export function assertQueryPlan(plan: InspectionRequestPlan) {
  if (
    !plan.ready ||
    plan.mode !== 'once' ||
    !(plan.subject === 'training'
      ? trainingScopeValid(plan) && plan.timeMode !== 'ongoing'
      : plan.subject === 'courseware' &&
        validInspectionTime(plan, plan.mode) &&
        ['duration', 'quality'].includes(plan.metric ?? ''))
  )
    throw new Error('请先补齐一次查询条件并确认执行')
  if (plan.metric === 'duration' && !validInspectionDurationBounds(plan))
    throw new Error('请提供大于 0 且不超过 1440 分钟的有效预计学习时长范围')
}

/** 仅读取现有课件清单；读取失败与缺依据分别返回 error / partial。 */
export async function queryCurrentCourseware(
  plan: InspectionRequestPlan,
  options: {
    getPage?: CoursewarePageReader
    assertCurrentIdentity?: () => void
    trainingRecords?: TrainingRecord[]
    now?: Date
  } = {}
): Promise<InspectionQueryResult> {
  assertQueryPlan(plan)
  if (plan.subject === 'training') {
    options.assertCurrentIdentity?.()
    const rows = (options.trainingRecords ?? trainingData(options.now))
      .filter((record) => matchesTrainingScope(record, plan, options.now))
      .map((record) => ({
        id: record.id,
        title: record.title,
        person: record.person,
        region: record.region,
        product: record.product,
        checkedAt: record.checkedAt,
        score: record.score ?? null,
        courseCompleted:
          record.courseCompleted == null ? '待补齐' : record.courseCompleted ? '已完课' : '未完课',
        result: { passed: '达标', mismatch: '未达标', missing: '缺少依据，暂不判断' }[
          trainingOutcome(record, plan)
        ]
      }))
    const missing = rows.filter((row) => row.result.includes('缺少')).length
    options.assertCurrentIdentity?.()
    return {
      toolRuns: [
        {
          id: 'training-read',
          label: '读取并筛选培训记录',
          at: new Date().toISOString(),
          status: 'completed',
          input: `地区：${plan.region === '全部' ? '全部地区' : plan.region}；人员：${plan.person === '全部' ? '全部受训人' : plan.person}；产品：${plan.product === '全部' ? '全部产品' : plan.product}；时间：${plan.timeMode === 'range' ? `${plan.startsOn} 至 ${plan.endsOn}` : '截至当前的记录'}`,
          output: `匹配${rows.length}项记录`
        },
        {
          id: 'training-check',
          label: '核验完课与成绩',
          at: new Date().toISOString(),
          status: 'completed',
          input: `${plan.requireCourseCompleted ? '要求完成课程，且' : '不限定完课状态，'}考核至少 ${plan.minScore} 分`,
          output: `${rows.length - missing}项已判断，${missing}项缺少依据`
        },
        {
          id: 'training-result',
          label: '生成查询结果',
          at: new Date().toISOString(),
          status: 'completed',
          input: `${rows.length}项筛选后记录`,
          output: missing ? '部分记录缺依据，已保留待核验结果' : '已生成完整结果'
        }
      ],
      status: missing ? 'partial' : 'complete',
      summary: `已查询 ${rows.length} 项培训记录：${rows.filter((row) => row.result === '达标').length} 项达标，${rows.filter((row) => row.result === '未达标').length} 项未达标，${missing} 项缺少依据。`,
      columns: [
        { key: 'person', label: '受训人' },
        { key: 'region', label: '地区' },
        { key: 'product', label: '产品' },
        { key: 'title', label: '培训' },
        { key: 'checkedAt', label: '记录时间' },
        { key: 'courseCompleted', label: '完课情况' },
        { key: 'score', label: '成绩' },
        { key: 'result', label: '核验结果' }
      ],
      rows,
      tools: plan.tools.map((tool) => ({ ...tool })),
      evidence: [
        `严格按${plan.region}、${plan.person}、${plan.product}和已确认时间范围筛选。`,
        `依据完课状态与考核成绩，成绩阈值${plan.minScore}分；缺成绩不判为未达标。`
      ]
    }
  }
  const result: InspectionQueryResult = {
    status: 'complete',
    toolRuns: [],
    summary: '',
    columns: [
      { key: 'title', label: '课件' },
      { key: 'creator', label: '创建人' },
      { key: 'createTime', label: '创建时间' },
      { key: 'duration', label: '预计学习时长（分钟）' },
      { key: 'result', label: '核验结果' }
    ],
    rows: [],
    tools: plan.tools.map((tool) => ({ ...tool })),
    evidence: [
      '依据当前课件清单中的预计学习时长；生成前设定的目标时长不作为核验依据。',
      plan.timeMode === 'range'
        ? `按创建时间筛选 ${plan.startsOn} 至 ${plan.endsOn}；缺创建时间仅列为待补齐依据，不纳入范围达标结论。`
        : '检查截至当前可见的课件记录。'
    ]
  }
  try {
    const getPage =
      options.getPage ?? (await import('@/api/courseware')).CoursewareApi.getCoursewarePage
    const items: CoursewareVO[] = []
    let expectedTotal = 0
    for (let pageNo = 1; pageNo <= 100; pageNo++) {
      options.assertCurrentIdentity?.()
      const page = await getPage({ pageNo, pageSize: 100, keyword: plan.keyword })
      options.assertCurrentIdentity?.()
      if (!page || !Array.isArray(page.list) || !Number.isFinite(page.total) || page.total < 0)
        throw new Error('课件清单格式不完整')
      result.toolRuns!.push({
        id: `courseware-page-${pageNo}`,
        label: '读取课件清单',
        at: new Date().toISOString(),
        status: 'completed',
        input: `读取第 ${pageNo} 页课件，每页最多 100 件；${plan.keyword ? `标题包含“${plan.keyword}”` : '当前可见课件'}`,
        output: `读取${page.list.length}项，总计${page.total}项`
      })
      expectedTotal = page.total
      items.push(...page.list)
      if (items.length >= expectedTotal || !page.list.length) break
    }
    if (items.length < expectedTotal) result.status = 'partial'
    const seen = new Set<number>()
    let missing = 0
    let passed = 0
    for (const item of items) {
      if (item.id != null && seen.has(item.id)) {
        result.status = 'partial'
        continue
      }
      if (item.id != null) seen.add(item.id)
      if (
        plan.keyword &&
        !item.title?.toLocaleLowerCase().includes(plan.keyword.toLocaleLowerCase())
      )
        continue
      if (plan.timeMode === 'range') {
        const inRange = inspectionDateInRange(item.createTime, plan)
        if (inRange === false) continue
        if (inRange === undefined) {
          missing++
          result.rows.push({
            id: item.id ?? null,
            title: item.title || '未命名课件',
            creator: item.creatorName || item.creator || '未知创建人',
            duration: null,
            result: '缺少创建时间，无法判断是否属于所选范围',
            createTime: null
          })
          continue
        }
      }
      const seconds = item.estimatedDurationSeconds
      const duration =
        typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0
          ? seconds / 60
          : null
      let conclusion: string
      if (plan.metric === 'duration') {
        if (duration == null) {
          missing++
          conclusion = '缺少预计学习时长，暂不能判断'
        } else if (
          (plan.minDurationMinutes != null && duration < plan.minDurationMinutes) ||
          (plan.maxDurationMinutes != null && duration > plan.maxDurationMinutes)
        )
          conclusion = '不符合时长要求'
        else {
          passed++
          conclusion = '符合时长要求'
        }
      } else {
        // 发布状态不等于内容质量，不将草稿直接判为生成失败。
        const artifact = Boolean(item.previewUrl || item.embedUrl || item.downloadUrl)
        if (!artifact || item.status == null) {
          missing++
          conclusion = '生成结果依据不完整，暂不能判断'
        } else {
          passed++
          conclusion = '已具备生成状态与产物凭据；内容质量待评审'
        }
      }
      result.rows.push({
        id: item.id ?? null,
        title: item.title || '未命名课件',
        creator: item.creatorName || item.creator || '未知创建人',
        duration,
        createTime: item.createTime ? String(item.createTime) : null,
        result: conclusion
      })
    }
    result.toolRuns!.push({
      id: 'courseware-check',
      label: '筛选并核验课件',
      at: new Date().toISOString(),
      status: 'completed',
      input: JSON.stringify({
        keyword: plan.keyword,
        metric: plan.metric,
        timeMode: plan.timeMode,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        min: plan.minDurationMinutes,
        max: plan.maxDurationMinutes
      }),
      output: `${result.rows.length}项匹配，${passed}项符合，${missing}项缺依据`
    })
    if (missing) result.status = 'partial'
    result.summary = `已查询 ${result.rows.length} 件课件：${passed} 件${plan.metric === 'duration' ? '符合时长要求' : '具备生成结果凭据'}，${result.rows.length - passed - missing} 件不符合要求，${missing} 件缺少核验依据。${result.status === 'partial' ? '本次结果不完整，缺少依据的课件不作合格判断。' : ''}${plan.metric === 'quality' ? '内容准确性与教学质量仍需评审。' : ''}`
  } catch {
    // 身份失效必须终止整次运行，不能将跨账号读取当普通错误保存。
    options.assertCurrentIdentity?.()
    result.toolRuns!.push({
      id: 'courseware-error',
      label: '读取课件数据',
      at: new Date().toISOString(),
      status: 'failed',
      input: plan.keyword || '当前可见课件',
      output: '读取失败，未形成核验结论'
    })
    result.status = 'error'
    result.rows = []
    result.summary = '课件数据读取失败，本次未形成核验结论，请稍后重试。'
  }
  return result
}
