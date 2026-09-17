/**
 * 「数据审计 · Agent 对话」工作台的共享类型与纯函数。
 *
 * 逐条对应原型 `src/pages/training-inspection/AuditConsole.tsx` 顶部的类型、常量与小工具；
 * 拆成模块是为了让主组件与卡片子组件共用同一份定义（原型里它们都在同一个文件里）。
 *
 * 文案、正则与默认值全部照抄原型（`jakartaStamp` 由页面容器共享的 shared.ts 提供）。
 */
import { FOCUS_LABELS } from '@/beauty/lib/auditTools'
import type {
  AuditContext,
  AuditError,
  AuditReport,
  AuditToolId,
  AuditToolOutput,
  AuditToolSpec,
  Clarification,
  ClarifyField
} from '@/beauty/lib/auditTools'
import type { RiskLevel } from '@/beauty/lib/inspectionTypes'

export { FOCUS_LABELS }

/* ------------------------------------------------------------------ 类型 */

/** 查询过程里的一步：工具 + 旁白 + 结果。 */
export interface TrailStep {
  id: string
  spec: AuditToolSpec
  narration: string
  status: 'running' | 'done' | 'error'
  output?: AuditToolOutput
  error?: AuditError
}

export interface TrailItem {
  kind: 'trail'
  id: string
  steps: TrailStep[]
}

export interface ClarifyItem {
  kind: 'clarify'
  id: string
  questions: Clarification[]
  /** 已答问题的可读答案，键是问题序号。 */
  answers: Record<number, string>
  picks: string[]
  /** 当前正在问第几个问题；等于 questions.length 时表示问完了。 */
  index: number
}

export type ConsoleItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'agent'; id: string; text: string; event?: string; tone?: 'note' | 'confirm' | 'error' }
  | ClarifyItem
  | TrailItem
  | { kind: 'report'; id: string; report: AuditReport; ctx: AuditContext; question: string }

/** 报告项（工作台右栏与汇报卡共用）。 */
export type ReportItem = Extract<ConsoleItem, { kind: 'report' }>

/* ------------------------------------------------------------------ 常量 */

export const uid = () => `audit-${Math.random().toString(36).slice(2, 9)}`

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 四个阶段，与「生成课件」的轨道同构：理解 → 确认 → 取数 → 汇报。 */
export const AUDIT_STEPS = ['理解需求', '确认口径', '取数核对', '汇报结论'] as const

/** 补问的默认答案：老板点「先跳过」时按这个口径继续。 */
export const CLARIFY_DEFAULT: Record<ClarifyField, { value: string; label: string }> = {
  time: { value: 'this-week', label: '本周' },
  region: { value: '__all__', label: '全国' },
  category: { value: '__all__', label: '全部品类' },
  focus: { value: 'all', label: '全部方面' }
}

export const LEVEL_CLASS: Record<RiskLevel, string> = {
  high: 'audit-chip--high',
  medium: 'audit-chip--medium',
  low: 'audit-chip--low',
  insufficient: 'audit-chip--insufficient'
}

export const VERDICT_CLASS: Record<AuditReport['verdict'], string> = {
  阻断: 'audit-chip--high',
  需关注: 'audit-chip--medium',
  提示优化: 'audit-chip--low',
  通过: 'audit-chip--ok'
}

export const ERROR_CLASS: Record<AuditError['kind'], string> = {
  permission: 'audit-error--permission',
  data: 'audit-error--data',
  system: 'audit-error--system'
}

export const ERROR_LABEL: Record<AuditError['kind'], string> = {
  permission: '权限问题',
  data: '业务数据问题',
  system: '系统问题'
}

/** 日期标签带上星期：老板读「周三」比读「17」快。 */
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/* ---------------------------------------------------------------- 小工具 */

export const toolIntentOf = (text: string): AuditToolId | null => {
  if (/保存.*记录|存成?记录|留档|归档/.test(text)) return 'save_inspection_record'
  if (/每周|定时|订阅|自动跑|自动审计|自动巡检|定期/.test(text)) return 'save_schedule'
  return null
}

/** 旁白下面的结果摘要：只留第一句话，避免卡片被长句子撑开。 */
export function shortHeadline(text: string) {
  const cut = text.split(/[。；]/)[0] ?? text
  return cut.length > 46 ? `${cut.slice(0, 46)}…` : cut
}

export const scopeText = (ctx: AuditContext) =>
  `${ctx.scopeLabel} · ${
    ctx.weeks.length > 1 ? `${ctx.weeks.length} 个周期` : `周期 ${ctx.week.slice(5)}`
  } · ${FOCUS_LABELS[ctx.focus]}${
    ctx.categories.length ? ` · 品类 ${ctx.categories.join('、')}` : ''
  }`
