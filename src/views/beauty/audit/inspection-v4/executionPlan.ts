import type { InspectionCase } from './model'

/** 用户最终确认的工具组合；只控制本地演示，不创建真实调度或发送消息。 */
export interface ToolPlan {
  scheduled: boolean
  reportToCreator: boolean
  remindEmployees: boolean
  escalateToCreator: boolean
  escalationThreshold: number
  escalationRule: 'consecutive' | 'after-reminders'
  stopWhenQualified: boolean
  cadenceSource: 'user' | 'recommended'
}

export function defaultToolPlan(scheduled = false): ToolPlan {
  return {
    scheduled,
    reportToCreator: false,
    remindEmployees: false,
    escalateToCreator: false,
    escalationThreshold: 3,
    escalationRule: 'consecutive',
    stopWhenQualified: false,
    cadenceSource: 'user'
  }
}

export function planFor(
  item: Pick<InspectionCase, 'toolPlan' | 'authorized' | 'queryMode'>
): ToolPlan {
  if (item.toolPlan) return { ...item.toolPlan }
  // 旧任务继续遵守原授权，不在升级界面时改写既有提醒约定。
  return {
    ...defaultToolPlan(item.authorized || item.queryMode === 'scheduled'),
    remindEmployees: item.authorized,
    escalateToCreator: item.authorized,
    escalationRule: 'after-reminders',
    stopWhenQualified: item.authorized
  }
}

export function toolLabels(plan: ToolPlan): string[] {
  return [
    ...(plan.scheduled ? ['定时调度'] : []),
    '只读查询',
    '结果校验',
    ...(plan.remindEmployees ? ['员工提醒'] : []),
    ...(plan.reportToCreator ? ['飞书汇报'] : []),
    ...(plan.escalateToCreator ? ['异常升级'] : [])
  ]
}

export function policySummary(plan: ToolPlan): string {
  const rules = [plan.remindEmployees ? '未达标时提醒员工本人' : '不提醒员工']
  if (plan.reportToCreator)
    rules.push(
      plan.scheduled ? '初查及每轮完成后向你生成飞书汇报预览' : '本次查询完成后向你生成飞书汇报预览'
    )
  if (plan.escalateToCreator)
    rules.push(
      plan.escalationRule === 'consecutive'
        ? `同一人员连续 ${plan.escalationThreshold} 轮未达标，在第 ${plan.escalationThreshold} 轮生成给你的飞书升级预览`
        : `提醒满 ${plan.escalationThreshold} 次后，再复查仍未达标才升级`
    )
  else rules.push('不进行异常升级')
  rules.push(
    plan.stopWhenQualified && (plan.remindEmployees || plan.escalateToCreator)
      ? '全员达标后停止监督'
      : plan.scheduled
        ? '按周期持续查询，不因全员达标提前结束'
        : '仅执行本次查询'
  )
  if (plan.scheduled && (plan.remindEmployees || plan.escalateToCreator))
    rules.push('初查不提醒或升级，监督计数从授权后的第 1 轮开始')
  rules.push('缺失记录单独核实，所有通知仅为本地预览')
  return rules.join('；') + '。'
}
