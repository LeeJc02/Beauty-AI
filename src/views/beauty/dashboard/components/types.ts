/**
 * 看板页（运行概览 / 全国数据 / 区域数据）共用的展示型数据结构。
 *
 * 字段与原型 `pages/*.tsx` 里的字面量对象一一对应，仅把演示数据抽成类型，
 * 数据本身仍按原型逐字写在页面里（原型这三页没有接 `@/beauty/lib/*` 的业务数据源）。
 */

export type TaskType = '练习任务' | '学习任务' | '考试任务'

/** 任务监控卡片（原型 MOCK_ONGOING_TASKS / REGION_ONGOING_TASKS / RTM_ONGOING_TASKS）。 */
export interface OngoingTask {
  id: string
  title: string
  scope: string
  type: string
  completed: number
  total: number
  progress: number
  cycleLabel?: string
  frequency?: string
  deadlineText: string
  startTime?: string
  endTime?: string
  isWarning: boolean
  badgeClass: string
}

export interface StaffRecentTask {
  name: string
  type: string
  status: string
  progress: number
}

export interface StaffPointBreakdownItem {
  label: string
  detail: string
  value: string
  tone: string
}

/** 员工下钻档案（原型 HQ_STAFF_PROFILES / REGION_STAFF_PROFILES）。 */
export interface StaffProfile {
  status: string
  meta: string
  taskCompleted: number
  taskTotal: number
  taskRate: number
  examScore: number
  examTrend: number[]
  recentTasks: StaffRecentTask[]
  isAtRisk: boolean
  monthlyPoints?: number
  pointBreakdown?: StaffPointBreakdownItem[]
  practiceStatus?: string
  practiceStatusClass?: string
  scriptProgress?: string
  latestPracticeTask?: string
  evaluation?: string
  evaluationClass?: string
}

export interface StoreEmployee {
  id: string
  name: string
  monthlyPoints: number
  completionRate: number
  lastExamScore: number
}

/** 门店下钻档案（原型 HQ_STORE_PROFILES / REGION_STORE_PROFILES）。 */
export interface StoreProfile {
  manager: string
  baCount: number
  avgTaskCompletion: number
  avgStudyCount: number
  avgPracticeCount: number
  avgExamScore: number
  employees: StoreEmployee[]
}

export type BAActivityStatus = 'online' | 'offline'

export type BAActivityType = 'learning' | 'exam' | 'task' | 'idle'

export type BAActivityFilter = 'all' | BAActivityStatus | BAActivityType

/** 全国 BA 实时活动行（原型 HQ_BA_ACTIVITY_ROWS）。 */
export interface BAActivityRow {
  id: string
  name: string
  region: string
  status: BAActivityStatus
  lastActivity: string
  activityType: BAActivityType
  activity: string
  progress: number
}
