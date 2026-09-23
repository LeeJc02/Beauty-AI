import type { InspectionRequestPlan } from '@/beauty/lib/inspectionRequest'

export function buildPlanDocument(plan: InspectionRequestPlan): string {
  const training = plan.subject === 'training'
  const once = plan.mode === 'once'
  return `# 任务计划

## 背景与目标
${training ? '核对人员培训完成情况与考核表现，识别需要跟进的学习事项。' : '核对课件生成产物与质量依据，识别需要跟进的课件事项。'}

## 任务需求
${plan.summary.replace(/请确认后执行[。！]?$/, '')}

## 范围与时间
- 检查对象：${training ? '人员培训记录' : '当前账号可访问的课件产物'}。
- 地区：${plan.region || '以已确认范围为准'}；人员：${plan.person || '以已确认范围为准'}；产品：${plan.product || plan.keyword || '以已确认范围为准'}。
- 时间：${plan.startsOn ? `${plan.startsOn} 至 ${plan.endsOn || '任务暂停或结束'}` : plan.timeMode === 'ongoing' ? '从确认起关注之后新增记录，暂停或结束后停止' : '当前已确认时间范围'}；日期按 Asia/Jakarta 核对。
- 处理方式：${once ? '一次查询，不建立持续监督' : '持续监督，只处理已确认范围内的业务记录'}。

## 数据依据与核验口径
${training ? '- 读取培训记录中的人员、地区、产品、学习完成状态与有效考核成绩，保留核验时间与记录标识。' : '- 读取课件标识、标题、创建人、生成状态与产物预计学习时长 estimatedDurationSeconds。生成需求 targetDurationMinutes 不作为产物时长依据。'}
- 先筛选范围与时间，再检查依据是否完整；范围外数据不纳入结论。

## 执行步骤
${plan.tools.map((tool, index) => `${index + 1}. **${tool.label}**：${tool.detail}`).join('\n')}

## 异常处理
- 读取失败保留失败原因与未完成范围，不以空结果代替成功。
- 缺少依据时不作达标判断，保留待核验事项，不新增提醒或未达标次数。
${once ? '- 一次查询只输出核验结果，不执行人员提醒或升级汇报。' : `- ${plan.remind ? '仅对有充分依据的未达标事项提醒本人；本人确认仅表示签收，不代表整改达标。' : '仅记录核验结果，不向本人发送提醒。'}\n- ${plan.reportRequested ? '同一人员连续第三次未达标时向任务创建人汇报；合规清零，缺依据中断连续，已升级人员不重复升级。' : '不进行升级汇报。'}`}

## 交付与执行约定
- 人工确认后开始执行；修改计划必须重新核对并再次确认。
- 在任务详情交付阶段汇报、逐项执行记录及已完成事项，保留数据依据和核验时间。
- ${once ? '一次查询完成后保存在已完成任务中，不进入运行中。' : '监督持续至约定结束时间或人工暂停、结束；已核验事实保留，不改写既有记录。'}`
}

/** 仅消除编辑器支持的格式标记，不把标题、加粗或斜体误解释成业务修改。 */
export function planDocumentClauses(markdown: string): string[] {
  const lines = markdown.split('\n')
  const firstContentLine = lines.findIndex((line) => line.trim())
  return lines
    .filter((line, index) => {
      if (/^\s*(?:---+\s*$|\*\*\*+\s*$|___+\s*$|```)/.test(line)) return false
      // 文档标题与章节标签不是执行条件；正文改为标题样式仍应保留其业务含义。
      if (/^\s*#{1,6}\s/.test(line)) {
        const text = line.replace(/^\s*#{1,6}\s+/, '').trim()
        if (
          [
            '背景与目标',
            '任务需求',
            '范围与时间',
            '数据依据与核验口径',
            '执行步骤',
            '异常处理',
            '交付与执行约定',
            '执行约定'
          ].includes(text)
        )
          return false
        if (index === firstContentLine && !/分钟|成绩|完课|不合规|不少于|不超过/.test(text))
          return false
      }
      return true
    })
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*(?:>\s*|[-+*]\s+|\d+\.\s+)*/, '')
        .replace(
          /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\n]*)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g,
          (_, code, label, _href, bold, italic) => code ?? label ?? bold ?? italic
        )
    )
    .join('\n')
    .split(/[\n；;。！]/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** 删除也属于业务修改，不能因同时修改了别的字段而沿用被删条件。 */
export function removedDurationCondition(baseline: string, draft: string): string | undefined {
  const before = planDocumentClauses(baseline).join('；')
  const after = planDocumentClauses(draft).join('；')
  const number = '[+-]?(?:\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?|Infinity|NaN)'
  const range = new RegExp(`${number}\\s*(?:到|至|[-~～–])\\s*${number}\\s*分钟`, 'gi')
  const count = (text: string, pattern: RegExp) => Array.from(text.matchAll(pattern)).length
  for (const [label, words, cancel] of [
    ['时长下限', '至少|不少于|不低于|最短', /取消下限|不限下限/],
    ['时长上限', '最多|不超过|不高于|最长', /取消上限|不限上限/]
  ] as const) {
    const bound = new RegExp(`(?:${words})\\s*${number}\\s*分钟`, 'gi')
    if (
      !cancel.test(after) &&
      count(before, bound) + count(before, range) > count(after, bound) + count(after, range)
    ) {
      return `计划中删除了${label}。请明确写出“取消${label === '时长下限' ? '下限' : '上限'}”后再核对，或在对话中说明；不会自动沿用或取消被删条件。`
    }
  }
  return undefined
}

function visibleLine(line: string) {
  const prefix = line.match(/^\s*(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+\.\s+)*/)?.[0].length || 0
  const source = line.slice(prefix)
  let text = ''
  const positions: number[] = []
  const append = (value: string, at: number) => {
    text += value
    for (let i = 0; i < value.length; i++) positions.push(prefix + at + i)
  }
  const pattern = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\n]*)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g
  let cursor = 0
  for (const match of source.matchAll(pattern)) {
    append(source.slice(cursor, match.index), cursor)
    const content = match[1] ?? match[2] ?? match[4] ?? match[5]
    append(content, match.index! + (match[4] !== undefined ? 2 : 1))
    cursor = match.index! + match[0].length
  }
  append(source.slice(cursor), cursor)
  return { text, positions }
}

// 将已核对的数值/措辞同步到未改语义的行，尽量保留用户在该行设置的格式。
function updateFormattedLine(line: string, nextLine: string): string {
  const { text: before, positions } = visibleLine(line)
  const after = visibleLine(nextLine).text
  if (before === after) return line
  if (before.length * after.length > 1_000_000) return nextLine
  const width = after.length + 1
  const table = new Uint32Array((before.length + 1) * width)
  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
  const edits: Array<{ start: number; end: number; value: string }> = []
  let i = 0
  let j = 0
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      i++
      j++
      continue
    }
    const start = i
    let value = ''
    while (i < before.length || j < after.length) {
      if (i < before.length && j < after.length && before[i] === after[j]) break
      if (
        j < after.length &&
        (i === before.length || table[i * width + j + 1] >= table[(i + 1) * width + j])
      )
        value += after[j++]
      else i++
    }
    edits.push({ start, end: i, value })
  }
  for (const edit of edits.reverse()) {
    const from = positions[edit.start] ?? (positions.length ? positions.at(-1)! + 1 : line.length)
    const to = edit.end > edit.start ? positions[edit.end - 1] + 1 : from
    line = line.slice(0, from) + edit.value + line.slice(to)
  }
  return line
}

/** 只同步尚未改写语义的生成行；用户标题、排版与补充说明保持原样。 */
export function reconcilePlanDocument(
  draft: string,
  previous: InspectionRequestPlan,
  next: InspectionRequestPlan
): string {
  const oldLines = buildPlanDocument(previous).split('\n')
  const nextLines = buildPlanDocument(next).split('\n')
  return draft
    .split('\n')
    .map((line) => {
      const visible = visibleLine(line).text
      const index = oldLines.findIndex(
        (old, position) => visibleLine(old).text === visible && old !== nextLines[position]
      )
      return index < 0 ? line : updateFormattedLine(line, nextLines[index])
    })
    .join('\n')
}

/** 同一标准在文档各处必须一致，不能让两份互相矛盾的值进入最终确认。 */
export function conflictingPlanCondition(
  document: string,
  plan: InspectionRequestPlan
): string | undefined {
  const text = planDocumentClauses(document).join('；')
  const number = '(\\d+(?:\\.\\d+)?)'
  const values = (pattern: RegExp) =>
    Array.from(text.matchAll(pattern), (match) => Number(match[1]))
  if (plan.subject === 'training') {
    const scores = values(/(?:至少|不低于)\s*(\d+(?:\.\d+)?)\s*分(?!钟)/g)
    if (scores.some((score) => score !== plan.minScore))
      return '计划中的成绩标准不一致，请统一后再核对。'
    return undefined
  }
  const min = values(new RegExp(`(?:至少|不少于|不低于|最短)\\s*${number}\\s*分钟`, 'g'))
  const max = values(new RegExp(`(?:最多|不超过|不高于|最长)\\s*${number}\\s*分钟`, 'g'))
  for (const match of text.matchAll(
    new RegExp(`${number}\\s*(?:到|至|[-~～–])\\s*${number}\\s*分钟`, 'g')
  )) {
    min.push(Number(match[1]))
    max.push(Number(match[2]))
  }
  if (
    min.some((value) => value !== plan.minDurationMinutes) ||
    max.some((value) => value !== plan.maxDurationMinutes)
  )
    return '计划中的时长标准不一致，请统一任务需求与执行步骤后再核对。'
  return undefined
}
