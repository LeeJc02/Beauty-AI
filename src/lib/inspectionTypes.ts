/**
 * 培训审计 Agent · 领域模型
 *
 * 学习 / 练习 / 考试（以及接入中的媒体采集）任务统一转换为审计任务对象：
 * 内容资源、分发范围、实际人员快照、时间规则、任务权重、三级负责人、任务关系与执行结果。
 * 所有 Agent 结论都必须能追溯到规则编号与原始任务字段，模型不修改数值与人员范围。
 */

export type TaskKind = "study" | "practice" | "exam" | "media";
export type TaskOrigin = "demo" | "source";
export type TaskStatus = "draft" | "active" | "paused" | "disabled";
export type TaskWeight = "must" | "optional" | "makeup" | "retraining";
export type AudienceScope = "nationwide" | "region" | "store" | "role" | "segment";
export type PersonRole =
  | "ba"
  | "new_ba"
  | "store_manager"
  | "trainer"
  | "regional_manager";
export type ResourceType =
  | "courseware"
  | "script"
  | "avatar"
  | "quote"
  | "paper"
  | "media";
export type FrequencyUnit = "once" | "daily" | "weekly";

/** 风险等级：高风险阻断发布；中风险允许发布但需确认；低风险提示优化；数据不足不做结论。 */
export type RiskLevel = "high" | "medium" | "low" | "insufficient";
/** A 负荷 / B 时间 / C 人群 / D 内容与任务关系 / E 执行 / F 数据不足 / G 品类覆盖。 */
export type RiskCategory = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type RiskConclusion = "阻断发布" | "建议调整" | "提示优化" | "数据不足";
export type RiskStatus =
  | "待处理"
  | "需确认"
  | "处理中"
  | "已解决"
  | "例外生效";
export type DispositionAction =
  | "adjust-task"
  | "adjust-audience"
  | "adjust-deadline"
  | "reduce-frequency"
  | "merge-duplicates"
  | "pause-publish"
  | "mark-exception"
  | "handover";

export interface InspectionRegion {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  /** 已确认的每人每周培训容量（分钟）。null 表示尚未确认，只能参考历史基线。 */
  capacityMinutes: number | null;
  /** 最近若干完整周期的实际人均分钟，用于参考基线。 */
  history: number[];
  /** 培训师待复核量（区域视图使用）。 */
  trainerPendingReviews: number;
  /** 完成回传是否可用；缺失时不做区域完成率结论。 */
  completionReporting: boolean;
}

export interface InspectionPerson {
  id: string;
  name: string;
  regionId: string;
  storeId: string;
  role: PersonRole;
  active: boolean;
  joinedOn: string;
}

export interface InspectionStore {
  id: string;
  name: string;
  regionId: string;
  city: string;
}

export interface TaskResource {
  id: string;
  name: string;
  type: ResourceType;
  /** 单个资源预计时长（分钟）。null 表示内容侧缺少时长，属于数据不足。 */
  minutes: number | null;
}

export interface TaskFrequency {
  unit: FrequencyUnit;
  /** 每个周期要求完成的次数。 */
  count: number;
}

export interface TaskAudience {
  scope: AudienceScope;
  /** 人群策略的可读描述，例如「全国直营门店 BA」。 */
  label: string;
  regionIds: string[];
  storeIds: string[];
  /** null 表示未按角色限定。 */
  roles: PersonRole[] | null;
  expectedCount: number | null;
  /** 发布时解析出的员工名单快照；null 表示缺少逐人分配。 */
  resolvedPersonIds: string[] | null;
  resolvedAt: string | null;
  /** 人员快照对应的任务版本；小于任务版本说明快照已过期。 */
  snapshotVersion: number;
}

export interface TaskOwners {
  hqOwnerId: string;
  hqOwnerName: string;
  regionOwnerId: string | null;
  regionOwnerName: string | null;
  storeOwnerId: string | null;
  storeOwnerName: string | null;
}

export interface TaskRelations {
  /** 同源内容的其他任务。 */
  sameSourceTaskIds: string[];
  /** 前置任务（必须先完成）。 */
  prerequisiteTaskIds: string[];
  /** 互斥任务（不应同时要求）。 */
  exclusiveTaskIds: string[];
  /** 重复任务（内容与人群重叠）。 */
  duplicateTaskIds: string[];
  /** 是否显式声明了完成顺序。 */
  sequenceDefined: boolean;
}

export interface TaskReminder {
  enabled: boolean;
  daysBefore: number;
  channels: string[];
}

export interface TaskResults {
  /** personId -> 周期键 -> 已完成次数。 */
  completed: Record<string, Record<string, number>>;
  /** personId -> 考试成绩。 */
  scores: Record<string, number>;
  /** 完成回传最近时间；null 表示缺少回传。 */
  returnedAt: string | null;
  /** 推送记录最近时间；null 表示缺少推送记录。 */
  pushedAt: string | null;
}

export interface InspectionTask {
  id: string;
  title: string;
  kind: TaskKind;
  /** 内容涉及的品类（新品 / 敏感肌 / 彩妆…），自定义审计可以按品类盯。 */
  categories: string[];
  origin: TaskOrigin;
  sourceId: string;
  status: TaskStatus;
  version: number;
  createdAt: string;
  /** 任务创建人：调整建议（站内信）默认发给他；外部接入任务可能缺失。 */
  createdByName?: string;
  publishedAt: string | null;
  startsOn: string;
  endsOn: string;
  frequency: TaskFrequency | null;
  /** 周期内达标次数目标；null 表示未配置。 */
  targetCount: number | null;
  resources: TaskResource[];
  /** 附加题等固定加时（分钟）。 */
  additionalMinutes: number;
  weight: TaskWeight | null;
  audience: TaskAudience;
  owners: TaskOwners;
  relations: TaskRelations;
  reminder: TaskReminder | null;
  /** 长期任务复查/失效机制：复查间隔天数；null 表示没有机制。 */
  reviewCadenceDays: number | null;
  results: TaskResults;
  /** 数据接入任务缺失的字段，用于「数据不足」结论。 */
  dataGaps: string[];
  /** 被合并到的目标任务（重复任务合并后）。 */
  mergedIntoId: string | null;
  exceptionNote: string;
}

/** 规则参数：全部可追溯，Agent 只解释不修改。 */
export interface InspectionPolicy {
  version: number;
  /** 自动审计间隔（分钟）：界面上显示成「每 N 分钟 / 每 N 小时一次」，可以跟 Agent 对话调整。 */
  autoRunMinutes: number;
  /** 区域未确认容量时的全局参考容量（分钟/人/周）。 */
  weeklyCapacityMinutes: number;
  /** 单人单日任务分钟阈值。 */
  dailyLimitMinutes: number;
  /** P90 与均值比例的异常阈值。 */
  p90Ratio: number;
  /** P90 与均值的最小差值（分钟）。 */
  p90GapMinutes: number;
  /** 单个任务的周期人均投入上限（分钟/周）。 */
  taskWeeklyLimitMinutes: number;
  /** 连续 N 天内多任务集中截止的窗口。 */
  deadlineWindowDays: number;
  /** 窗口内的任务数阈值。 */
  deadlineTaskCount: number;
  /** 剩余时间不足时，每天需要完成的次数。 */
  requiredCountPerDay: number;
  /** 命中人数与预期人群的偏差比例阈值。 */
  audienceDeviationRatio: number;
  /** 低完成风险的观察窗口（小时）。 */
  completionRiskHours: number;
  /** 完成率偏低阈值。 */
  lowCompletionRate: number;
  /** 区域之间总量差异比例阈值。 */
  regionGapRatio: number;
  /** 长期有效任务天数阈值。 */
  longRunningDays: number;
  /** 人均重复命中集中度阈值（同一人被命中次数 / 目标人群均值）。 */
  concentrationRatio: number;
  historyMultiplier: number;
  /** 观察模式：Agent 只建议，不自动修改。 */
  observeOnly: boolean;
  observationStartedOn: string;
}

export interface RiskEvidence {
  text: string;
  /** 数据出处，例如「任务 新品核心卖点 v2 · 时间规则.截止时间」。 */
  ref: string;
}

export interface RiskImpact {
  text: string;
  affectedPeople: number;
  affectedRegions: number;
}

export interface RiskConfirmation {
  id: string;
  name: string;
  roleLabel: string;
}

export interface InspectionRisk {
  key: string;
  ruleId: string;
  ruleName: string;
  category: RiskCategory;
  level: RiskLevel;
  conclusion: RiskConclusion;
  title: string;
  week: string;
  taskIds: string[];
  personIds: string[];
  regionIds: string[];
  reason: string;
  evidence: RiskEvidence[];
  suggestion: string;
  impact: RiskImpact;
  confirmation: RiskConfirmation | null;
  hypothesis?: string;
  /** 规则计算出的结构化指标，便于复核。 */
  metrics: Record<string, number | string | null>;
  /** 规则阈值与开关。 */
  ruleParams: Record<string, number | string | boolean | null>;
}

export interface RiskRecord {
  key: string;
  ruleId: string;
  /** 规则名与标题快照，供工作记录在风险解除后仍能复述。 */
  ruleName: string;
  title: string;
  level: RiskLevel;
  status: RiskStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  recurrence: number;
  week: string;
  taskIds: string[];
  personIds: string[];
  regionIds: string[];
  history: { at: string; actor: string; text: string }[];
}

export interface RiskException {
  id: string;
  riskKey: string;
  taskId: string;
  ruleId: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  approvedBy: string | null;
  approvedAt: string | null;
  expiresOn: string;
  decisionNote: string;
}

export interface DispositionRecheck {
  at: string;
  resolvedRules: string[];
  remainingRules: string[];
  addedRules: string[];
  summary: string;
}

export interface DispositionRecord {
  id: string;
  at: string;
  action: DispositionAction;
  actorId: string;
  actorName: string;
  taskId: string;
  taskTitle: string;
  taskVersionBefore: number;
  taskVersionAfter: number;
  reason: string;
  /** 变更字段摘要：字段 -> { from, to }。 */
  patch: Record<string, { from: string; to: string }>;
  expectedImpact: string;
  recheck: DispositionRecheck;
  handoverTo: RiskConfirmation | null;
  exceptionId: string | null;
}

/** 审计批次内的一条风险变化（新增 / 解除）。 */
export interface InspectionRunChange {
  key: string;
  ruleId: string;
  ruleName: string;
  level: RiskLevel;
  title: string;
  taskIds: string[];
}

/** 审计批次的风险等级变化。 */
export interface InspectionRunLevelChange {
  key: string;
  ruleId: string;
  title: string;
  from: RiskLevel;
  to: RiskLevel;
}

/** 批次内单个任务的审计结论，保证历史批次可独立复述。 */
export interface InspectionRunTaskResult {
  taskId: string;
  /** null 表示该任务本次没有命中规则。 */
  level: RiskLevel | null;
  ruleIds: string[];
}

export interface InspectionRunSnapshot {
  high: number;
  medium: number;
  low: number;
  insufficient: number;
}

/**
 * 审计工作记录：一次审计做了什么。
 * 结论无变化时不新增记录，只把 lastSeenAt 与 repeatCount 往前推；
 * 出现新增 / 解除 / 等级变化 / 覆盖任务变化或跨天时新增一条。
 */
export interface InspectionRunRecord {
  id: string;
  /** 批次首次记录时间（ISO）。 */
  at: string;
  /** 同一结论被连续审计到的最近时间（ISO）。 */
  lastSeenAt: string;
  /** 连续审计到同一结论的次数（含首次）。 */
  repeatCount: number;
  trigger: "manual" | "auto";
  /** 本次覆盖的审计周期。 */
  weeks: string[];
  taskIds: string[];
  taskCount: number;
  /** 覆盖任务中缺关键字段、只能输出「数据不足」的任务数。 */
  dataGapTaskCount: number;
  /** 本次评估命中的风险快照。 */
  snapshot: InspectionRunSnapshot;
  /** 逐任务结论，展开批次即可核对这一次审计了哪些任务、结论是什么。 */
  taskResults: InspectionRunTaskResult[];
  added: InspectionRunChange[];
  resolved: InspectionRunChange[];
  levelChanged: InspectionRunLevelChange[];
  actorName: string;
  roleLabel: string;
}

/** runInspection 的可选行为：是否记账、以谁的名义记账。 */
export interface InspectionRunOptions {
  record?: "manual" | "auto" | "none";
  actorName?: string;
  roleLabel?: string;
}

export interface InspectionState {
  schema: 2;
  /** 演示数据版本；升级后本地旧快照会自动重新载入演示数据。 */
  seedVersion: number;
  revision: number;
  regions: InspectionRegion[];
  people: InspectionPerson[];
  stores: InspectionStore[];
  tasks: InspectionTask[];
  policy: InspectionPolicy;
  risks: RiskRecord[];
  exceptions: RiskException[];
  dispositions: DispositionRecord[];
  /** 审计工作记录：按批次记录审计了哪些任务、发现了什么。 */
  inspectionRuns: InspectionRunRecord[];
  lastRunAt: string | null;
  sourceSyncedAt: Record<string, string>;
}

export interface InspectionActor {
  id: string;
  name: string;
  hq: boolean;
  regionId?: string;
  readOnly?: boolean;
  roleLabel: string;
}

/** 员工级聚合：当前周期任务数、预计分钟、每日峰值、重复命中、完成与逾期表现。 */
export interface PersonAggregate {
  personId: string;
  name: string;
  regionId: string;
  storeId: string;
  role: PersonRole;
  taskCount: number;
  plannedMinutes: number;
  remainingMinutes: number;
  dailyPeak: number;
  peakDay: string | null;
  mandatoryCount: number;
  deadlineOverlaps: number;
  duplicateContents: number;
  completionRate: number | null;
  overdueRate: number | null;
  unknownTaskCount: number;
  items: PersonDayItem[];
  byKind: Record<TaskKind, number>;
}

export interface PersonDayItem {
  taskId: string;
  taskTitle: string;
  kind: TaskKind;
  day: string;
  minutes: number;
  weight: TaskWeight | null;
  count: number;
  done: number;
}

export interface RegionAggregate {
  regionId: string;
  name: string;
  people: PersonAggregate[];
  headcount: number;
  meanMinutes: number;
  p90Minutes: number;
  peakDay: string | null;
  peakDayMinutes: number;
  capacityMinutes: number;
  capacityConfirmed: boolean;
  overCapacityIds: string[];
  hqMean: number;
  regionalMean: number;
  trainerPendingReviews: number;
  completionRate: number | null;
  overdueRate: number | null;
  unknownCount: number;
}

export interface SimulationRegionRow {
  regionId: string;
  name: string;
  peopleBefore: number;
  peopleAfter: number;
  meanBefore: number;
  meanAfter: number;
  overBefore: number;
  overAfter: number;
}

export interface SimulationResult {
  taskId: string;
  peopleBefore: number;
  peopleAfter: number;
  meanBefore: number;
  meanAfter: number;
  /** 负荷最高员工的前后对比（内部按 P90 口径计算，界面用人均可读表达）。 */
  p90Before: number;
  p90After: number;
  maxBefore: number;
  maxAfter: number;
  peakBefore: number;
  peakAfter: number;
  rows: SimulationRegionRow[];
  resolved: InspectionRisk[];
  added: InspectionRisk[];
  levelChanged: { key: string; title: string; from: RiskLevel; to: RiskLevel }[];
  summary: string;
  reasons: string[];
}

export interface TaskPatch {
  title?: string;
  status?: TaskStatus;
  weight?: TaskWeight;
  startsOn?: string;
  endsOn?: string;
  frequency?: TaskFrequency | null;
  minutes?: number | null;
  additionalMinutes?: number;
  audience?: Partial<
    Pick<TaskAudience, "scope" | "label" | "regionIds" | "roles" | "expectedCount"> & {
      resolvedPersonIds: string[] | null;
    }
  >;
  owners?: Partial<TaskOwners>;
  reminder?: TaskReminder | null;
  resources?: TaskResource[];
}

export interface DispositionInput {
  action: DispositionAction;
  taskId: string;
  reason: string;
  patch: TaskPatch;
  exception?: {
    expiresOn: string;
    riskKey: string;
    ruleId: string;
    decisionNote?: string;
  };
  handoverTo?: RiskConfirmation | null;
  expectedImpact?: string;
  mergeTaskIds?: string[];
}
