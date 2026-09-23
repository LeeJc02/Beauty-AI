import type { AgentEvent } from './taskFlow'

// 只转述可核对的执行记录，不推测模型内部推理或未发生的通知。
export function eventNarrative(event: AgentEvent) {
  let data: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(event.output || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed
  } catch {
    /* 旧记录可能为自然语言 */
  }
  const titles: Record<string, string> = {
    'training_records.query': '读取培训与考核记录',
    'qualification.evaluate': '核对课程与考核是否达标',
    'employee.remind': '整理未达标员工的提醒预览',
    'feishu.report': '整理给创建人的飞书汇报预览',
    'feishu.escalate': '整理持续未达标人员的升级预览',
    'scheduler.create': '安排后续定时检查',
    'scheduler.finish': '结束到期任务',
    'report.compose · 简报就绪': '汇总本次检查结果',
    'followup.preview · 复查结果': '汇总本轮复查结果',
    '工具选择 · 已明确用户需求': '确认检查范围与执行步骤',
    '复核 Agent · 结果检查': '复核结果与缺失数据'
  }
  let detail = event.detail
  if (event.title === 'training_records.query' && typeof data.rows === 'number')
    detail = `已读取 ${typeof data.stores === 'number' ? `${data.stores} 家门店、` : ''}${data.rows} 人的培训与考核示例记录，接下来核对课程完成情况和成绩。`
  if (event.title === 'qualification.evaluate' && typeof data.total === 'number')
    detail = `已核对 ${data.total} 人：${data.qualified} 人达标，${data.unqualified} 人未达标，${data.missing} 人数据缺失。课程完成且考核达到 80 分才算达标；缺数据人员不触发提醒。`
  if (typeof data.preview === 'string') detail = `${data.preview}（仅生成预览，未真实发送。）`
  if (event.title === 'scheduler.create')
    detail = '已按确认的频率安排后续检查；当前仅在页面内模拟，不会在后台运行。'
  if (event.kind === 'result' && event.output) detail = event.output
  return {
    title:
      titles[event.title] ||
      (event.title.startsWith('复查 Agent')
        ? '开始本轮复查'
        : event.kind === 'tool'
          ? '完成一项检查'
          : event.title),
    detail
  }
}
