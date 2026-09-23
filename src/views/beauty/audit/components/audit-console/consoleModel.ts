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
  | {
      kind: 'report'
      id: string
      report: AuditReport
      ctx: AuditContext
      question: string
      trailId: string
    }

/** 报告项（工作台右栏与汇报卡共用）。 */
export type ReportItem = Extract<ConsoleItem, { kind: 'report' }>

/** 找当前批次报告；新一轮查询会显式清空 activeReportId，避免沿用旧结论。 */
export const reportFor = (items: ConsoleItem[], activeReportId: string | null) => {
  if (!activeReportId) return null
  return (
    items.find(
      (item): item is ReportItem => item.kind === 'report' && item.id === activeReportId
    ) ?? null
  )
}

/** 口径优先级：补问中的临时口径 > 当前批次 > 当前报告 > 页面基础口径。 */
export const auditContextFor = (
  base: AuditContext,
  pending: AuditContext | null,
  run: AuditContext | null,
  report: AuditContext | null
) => pending ?? run ?? report ?? base

/**
 * 右栏（产物区）的阶段。
 *
 * 口径没确认完之前，右栏不能出现「这次查了什么」——那些只是页面默认值，
 * 不等于用户选过的条件；所以「确认口径」期间右栏只给空态提示。
 */
export type ArtifactStage = 'idle' | 'clarifying' | 'collecting' | 'reporting'

export const artifactStageOf = (input: {
  entered: boolean
  pending: boolean
  hasTrail: boolean
  hasReport: boolean
}): ArtifactStage => {
  if (!input.entered) return 'idle'
  if (input.hasReport) return 'reporting'
  if (input.hasTrail) return 'collecting'
  if (input.pending) return 'clarifying'
  return 'idle'
}

/** 已确认的口径只在取数开始后展示；补问期间一律不显示默认值。 */
export const stageShowsScope = (stage: ArtifactStage) =>
  stage === 'collecting' || stage === 'reporting'

/** 只在用户已经贴近底部时自动跟随，避免阅读历史消息被新步骤打断。 */
export const isNearBottom = (
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 48
) => scrollHeight - scrollTop - clientHeight <= threshold

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
