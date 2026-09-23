import type { DeepReadonly } from 'vue'
import type { CoursewareInspectionTask } from '../../../../beauty/lib/coursewareInspection'
import { inspectionEvaluation } from '../../../../beauty/lib/inspectionEvaluation'

type Finding = 'passed' | 'mismatch' | 'missing' | 'review'
type Row = Readonly<Record<string, string | number | null>>

function rowFinding(row: Row): Finding {
  const result = String(row.result ?? '')
  if (/缺少|缺失|不完整|无法判断|不能判断|暂不判断|待补/.test(result)) return 'missing'
  // 有产物凭据并不意味着内容质量合格。
  if (/待评审|仍需评审/.test(result)) return 'review'
  if (/未达标|不达标|不符合|不合规|不合格/.test(result)) return 'mismatch'
  if (/^(达标|合规|合格|符合)/.test(result)) return 'passed'
  return 'missing'
}

function totals(findings: Finding[]): string {
  const count = (finding: Finding) => findings.filter((item) => item === finding).length
  const passed = count('passed')
  const checked = passed + count('mismatch')
  return (
    [
      `共 ${findings.length} 项，${passed} 项合规，${count('mismatch')} 项不合规，${count('missing')} 项待补依据`,
      count('review') ? `${count('review')} 项内容质量待评审` : '',
      checked
        ? `可判定 ${checked} 项中合规比例 ${Number(((passed / checked) * 100).toFixed(1))}%`
        : '暂无可判定的合规比例'
    ]
      .filter(Boolean)
      .join('；') + '。'
  )
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function rowDetail(row: Row): string {
  const name = [row.person ?? row.creator, row.title].filter(Boolean).join(' · ') || '未命名对象'
  const facts = [
    row.courseCompleted ? String(row.courseCompleted) : '',
    finite(row.score) ? `考核 ${row.score} 分` : '',
    finite(row.duration) ? `预计学习时长 ${Number(row.duration.toFixed(2))} 分钟` : '',
    String(row.result || '缺少核验结论，待补依据')
  ].filter(Boolean)
  return `${name}：${facts.join('，')}`
}

function keyFindings(rows: readonly Row[]): string {
  const priority = { mismatch: 0, missing: 1, review: 2, passed: 3 }
  const selected = [...rows]
    .sort((a, b) => priority[rowFinding(a)] - priority[rowFinding(b)])
    .slice(0, 3)
  return (
    selected.map(rowDetail).join('；') +
    '。' +
    (rows.length > selected.length ? `其余 ${rows.length - selected.length} 项见任务明细。` : '')
  )
}

/** 兼容只有总结的旧存储；去掉执行/关注状态，保留历史业务事实。 */
function legacySummary(summary: unknown): string {
  if (typeof summary !== 'string') return ''
  return summary
    .split(/(?<=[。！？；;，,\n])/)
    .filter(
      (part) =>
        !/^(?:本次)?(?:查询|任务|监督)(?:已)?(?:完成|结束)[。！？；;，,\s]*$|^(?:后续)?(?:不再|不会|不)(?:持续)?(?:关注|跟踪|跟进|监督|监听)|^(?:已)?(?:生成|保存)(?:查询)?结果[。！？；;，,\s]*$/.test(
          part.trim()
        )
    )
    .join('')
    .trim()
    .replace(/[，,；;]$/, '。')
}

/** 阶段汇报只取已归档事项；处理中状态变化不改变汇报内容。 */
export function taskStageBriefing(task: DeepReadonly<CoursewareInspectionTask>): string {
  // 一次查询沿用已有结果口径及三层详情，不混入监督事项统计。
  if (task.mode === 'once' || task.queryResult) return taskIntelligence(task)
  const entries = task.entries
    .filter((entry) => Boolean(entry.completedAt))
    .slice()
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
  const state = task.completedAt
    ? '这项监督已经结束，已有记录会保留，不再继续跟进。'
    : !task.enabled
      ? '这项监督已暂停，已有记录会保留，恢复后再继续跟进。'
      : '我会继续按约定关注新的进展，等事项处理完毕，再向你更新汇报。'
  if (!entries.length)
    return `目前还没有处理完毕的事项，暂时不能下达标结论。${state}`

  const findings = entries.map((entry) => inspectionEvaluation(entry))
  const passed = findings.filter((finding) => finding === 'passed').length
  const mismatch = findings.filter((finding) => finding === 'mismatch').length
  const missing = entries.length - passed - mismatch
  const overview = `目前已有 ${entries.length} 项处理记录归档：其中 ${passed} 项核验合规，${mismatch} 项未达标，另外 ${missing} 项缺少足够核验依据，暂时不能判断。`
  const latest = entries[0]!
  const finding = inspectionEvaluation(latest)
  const facts = [
    latest.courseCompleted == null ? '' : latest.courseCompleted ? '已完成课程学习' : '尚未完成课程学习',
    finite(latest.score) ? `实际测验成绩为 ${latest.score} 分` : '',
    finite(latest.estimatedDurationSeconds)
      ? `产物预计学习时长为 ${Number((latest.estimatedDurationSeconds / 60).toFixed(2))} 分钟`
      : ''
  ].filter(Boolean)
  const conclusion = finding === 'passed'
    ? '按已确认标准核验合规'
    : finding === 'mismatch'
      ? '按已确认标准仍未达标'
      : '现有依据还不足以作出达标判断'
  const recent = `最近处理完的是${latest.person || latest.creator}的「${latest.title}」，${[...facts, conclusion].join('，')}。`
  const receipt = latest.outcome === 'acknowledged'
    ? '这次本人回执已签收，只代表知晓问题，不代表整改达标。'
    : entries.some((entry) => entry.outcome === 'acknowledged')
      ? '已归档记录中的本人签收只代表知晓问题，不能当作整改达标。'
      : ''
  const stopped = latest.outcome === 'stopped'
    ? '该事项已停止跟进；归档不改变原有核验结论，也不表示已经整改。'
    : ''
  return overview + recent + receipt + stopped + state
}

/** 面向已完成任务的业务情报；只总结已有核验事实，不把签收或停止当作达标。 */
export function taskIntelligence(task: DeepReadonly<CoursewareInspectionTask>): string {
  const query = task.queryResult
  if (query) {
    if (query.status === 'error') return '数据读取失败，未形成可靠核验结论，不能判断是否合规。'
    const warning =
      query.status === 'partial' ? '依据不完整，结论仅限已有记录，不能代表全部对象。' : ''
    // 本地历史结果可能缺字段或含异常明细；展示层不能因此阻断详情挂载，也不能当作零样本成功。
    if (
      query.rows != null &&
      (!Array.isArray(query.rows) ||
        query.rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row)))
    )
      return '查询明细格式不完整，暂无可靠核验结论，请重新查询。'
    if (query.rows?.length) {
      return warning + totals(query.rows.map(rowFinding)) + keyFindings(query.rows)
    }
    const summary = legacySummary(query.summary)
    // 旧 fixtures 没有明细但有真实汇总；显式零样本不能沿用“全部合规”。
    if (
      summary &&
      !/(?:共|查询|匹配|找到|读取|核验)\s*0\s*(?:项|件|条|人)|(?:没有|未找到|无)匹配/.test(summary)
    )
      return warning + summary
    return warning + '没有匹配记录，暂无可核验样本，不能判断是否全部合规。'
  }
  if (task.mode === 'once') return '缺少查询结果，暂无可靠核验结论。'
  if (!task.entries.length) return '暂无核验样本，不能判断是否全部合规。'
  const findings = task.entries.map((entry) => inspectionEvaluation(entry) ?? 'missing')
  const rows = task.entries.map((entry) => ({
    person: entry.person ?? entry.creator,
    title: entry.title,
    score: entry.score ?? null,
    courseCompleted:
      entry.courseCompleted == null ? null : entry.courseCompleted ? '已完课' : '未完课',
    duration: finite(entry.estimatedDurationSeconds) ? entry.estimatedDurationSeconds / 60 : null,
    result: { passed: '合规', mismatch: '不合规', missing: '待补依据，暂不判断' }[
      inspectionEvaluation(entry) ?? 'missing'
    ]
  }))
  const acknowledged = task.entries.some((entry) => entry.outcome === 'acknowledged')
  return (
    totals(findings) +
    keyFindings(rows) +
    (acknowledged ? '提醒签收仅代表知悉，不代表整改达标。' : '')
  )
}
