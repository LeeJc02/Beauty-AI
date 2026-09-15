/**
 * 培训巡检 Agent · 计算与状态转换层
 *
 * 不依赖 React 与模型：统一把学习 / 练习 / 考试任务转换成员工级负荷，
 * 按 A 负荷 / B 时间 / C 人群 / D 内容关系 / E 执行 / F 数据不足 输出结构化风险。
 * Agent 只做检测、解释和排序；数值、人员范围、责任归属全部由规则从原始任务数据推导。
 */

import type {
  AudienceScope,
  DispositionInput,
  DispositionRecord,
  FrequencyUnit,
  InspectionActor,
  InspectionPolicy,
  InspectionRisk,
  InspectionRunChange,
  InspectionRunOptions,
  InspectionRunRecord,
  InspectionRunSnapshot,
  InspectionRunTaskResult,
  InspectionState,
  InspectionTask,
  PersonAggregate,
  PersonDayItem,
  PersonRole,
  RegionAggregate,
  ResourceType,
  RiskCategory,
  RiskConfirmation,
  RiskLevel,
  RiskStatus,
  SimulationResult,
  TaskKind,
  TaskPatch,
  TaskWeight,
} from "./inspectionTypes";

/* ------------------------------------------------------------------ 基础 */

export const inspectionDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const addDays = (day: string, count: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + count * 86400000)
    .toISOString()
    .slice(0, 10);

export function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

export const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86400000,
  );

export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length
    ? sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
    : 0;
};

export const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
};

export const round = (value: number) => Math.round(value);

/* ------------------------------------------------------- 自动巡检频次 */

/** 没设置过时的默认自动巡检间隔（分钟）。 */
export const AUTO_RUN_MINUTES_DEFAULT = 30;
export const AUTO_RUN_MINUTES_MIN = 1;
export const AUTO_RUN_MINUTES_MAX = 24 * 60;

export const clampAutoRunMinutes = (minutes: number) =>
  Math.min(
    AUTO_RUN_MINUTES_MAX,
    Math.max(AUTO_RUN_MINUTES_MIN, Math.round(minutes)),
  );

/** 策略里的间隔分钟数 → 「30 分钟 / 2 小时」。 */
export const formatCadence = (minutes?: number) => {
  const value = clampAutoRunMinutes(minutes ?? AUTO_RUN_MINUTES_DEFAULT);
  if (value % 60 === 0) return `${value / 60} 小时`;
  return `${value} 分钟`;
};

/** 从「每 30 分钟」「每 2 小时」「半小时」里读出间隔分钟数；读不出来返回 null。 */
export function parseCadenceMinutes(text: string): number | null {
  const halfHour = /半小时|半\s*个小时/.test(text);
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:个)?\s*(?:小时|钟头)/);
  const minutes = text.match(/(\d+)\s*分钟/);
  if (hours) return clampAutoRunMinutes(Number(hours[1]) * 60);
  if (halfHour) return 30;
  if (/每小时|一个小时|一小时/.test(text)) return 60;
  if (/每分钟|一分钟/.test(text)) return 1;
  if (minutes) return clampAutoRunMinutes(Number(minutes[1]));
  return null;
}
export const percent = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

/* ------------------------------------------------------------------ 文案 */

export const KIND_LABELS: Record<TaskKind, string> = {
  study: "学习",
  practice: "练习",
  exam: "考试",
  media: "采集",
};
export const WEIGHT_LABELS: Record<TaskWeight, string> = {
  must: "必修",
  optional: "选修",
  makeup: "补训",
  retraining: "复训",
};
export const SCOPE_LABELS: Record<AudienceScope, string> = {
  nationwide: "全国",
  region: "区域",
  store: "门店",
  role: "角色",
  segment: "人群策略",
};
export const ROLE_LABELS: Record<PersonRole, string> = {
  ba: "BA",
  new_ba: "新员工",
  store_manager: "店长",
  trainer: "培训师",
  regional_manager: "区域经理",
};
export const RESOURCE_LABELS: Record<ResourceType, string> = {
  courseware: "课件",
  script: "剧本",
  avatar: "数字人",
  quote: "金句",
  paper: "试卷",
  media: "媒体",
};
export const FREQUENCY_LABELS: Record<FrequencyUnit, string> = {
  once: "一次性",
  daily: "每日",
  weekly: "每周",
};
export const LEVEL_LABELS: Record<RiskLevel, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
  insufficient: "数据不足",
};
export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  A: "A 负荷合理性",
  B: "B 时间合理性",
  C: "C 人群合理性",
  D: "D 内容与任务关系",
  E: "E 执行风险",
  F: "F 数据不足",
  G: "G 品类覆盖",
};
export const ACTION_LABELS: Record<DispositionInput["action"], string> = {
  "adjust-task": "调整任务",
  "adjust-audience": "调整人群",
  "adjust-deadline": "调整截止时间",
  "reduce-frequency": "降低频次",
  "merge-duplicates": "合并重复任务",
  "pause-publish": "暂停发布",
  "mark-exception": "标记为合理例外",
  handover: "转交负责人",
};
export const conclusionLabel = (level: RiskLevel) =>
  level === "high"
    ? "阻断发布"
    : level === "medium"
      ? "建议调整"
      : level === "low"
        ? "提示优化"
        : "数据不足";

export const levelRank: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
  insufficient: 3,
};

export const compareRisks = (a: InspectionRisk, b: InspectionRisk) => {
  if (levelRank[a.level] !== levelRank[b.level])
    return levelRank[a.level] - levelRank[b.level];
  if (b.impact.affectedPeople !== a.impact.affectedPeople)
    return b.impact.affectedPeople - a.impact.affectedPeople;
  return a.ruleId.localeCompare(b.ruleId);
};

/* ------------------------------------------------------------------ 权限 */

export const canSeeRegion = (actor: InspectionActor, regionId: string) =>
  actor.hq || actor.regionId === regionId;

export const taskRegionIds = (task: InspectionTask) =>
  task.audience.regionIds.length
    ? task.audience.regionIds
    : task.audience.scope === "nationwide"
      ? []
      : [];

export function canSeeTask(actor: InspectionActor, task: InspectionTask) {
  if (actor.hq) return true;
  if (task.audience.scope === "nationwide") return true;
  return task.audience.regionIds.includes(actor.regionId ?? "");
}

/** 区域角色只能调整本区域任务；总部任务需要转交。 */
export function canActOnTask(actor: InspectionActor, task: InspectionTask) {
  if (actor.readOnly || task.origin !== "demo") return false;
  if (actor.hq) return true;
  return (
    task.audience.scope !== "nationwide" &&
    task.audience.regionIds.length > 0 &&
    task.audience.regionIds.every((id) => id === actor.regionId)
  );
}

export const canApproveException = (actor: InspectionActor) =>
  actor.hq && !actor.readOnly;

export const regionName = (state: InspectionState, regionId: string) =>
  state.regions.find((r) => r.id === regionId)?.name ?? regionId;

export const personName = (state: InspectionState, personId: string) =>
  state.people.find((p) => p.id === personId)?.name ?? personId;

export const storeName = (state: InspectionState, storeId: string) =>
  state.stores.find((s) => s.id === storeId)?.name ?? storeId;

/* ------------------------------------------------------------------ 任务 */

export const taskContentIds = (task: InspectionTask) =>
  task.resources.map((resource) => resource.id);

export const taskUnknownMinutes = (task: InspectionTask) =>
  task.resources.length === 0 ||
  task.resources.some((resource) => resource.minutes === null);

/** 单次任务预计分钟：内容资源时长 + 附加题。时长缺失返回 null。 */
export function taskOccurrenceMinutes(task: InspectionTask): number | null {
  if (!task.resources.length) return null;
  let total = task.additionalMinutes;
  for (const resource of task.resources) {
    if (resource.minutes === null) return null;
    total += resource.minutes;
  }
  return total;
}

export function taskAudienceIds(state: InspectionState, task: InspectionTask) {
  if (task.audience.resolvedPersonIds === null) return null;
  return task.audience.resolvedPersonIds.filter((id) =>
    state.people.some((person) => person.id === id),
  );
}

export const taskAppliesTo = (
  state: InspectionState,
  task: InspectionTask,
  personId: string,
) => {
  const ids = taskAudienceIds(state, task);
  return ids === null || ids.includes(personId);
};

export type TaskPeriod = { key: string; day: string; count: number };

/** 一次性任务归入截止周；每周任务按有效周；每日任务按有效日。 */
export function taskPeriods(task: InspectionTask, week: string): TaskPeriod[] {
  const end = addDays(week, 6);
  if (
    task.status === "disabled" ||
    task.status === "paused" ||
    task.mergedIntoId ||
    !task.frequency ||
    task.endsOn < week ||
    task.startsOn > end
  )
    return [];
  if (task.frequency.unit === "once")
    return task.endsOn <= end
      ? [{ key: "once", day: task.endsOn, count: task.frequency.count }]
      : [];
  if (task.frequency.unit === "weekly")
    return [
      {
        key: week,
        day: task.endsOn < end ? task.endsOn : end,
        count: task.frequency.count,
      },
    ];
  return Array.from({ length: 7 }, (_, index) => addDays(week, index))
    .filter((day) => day >= task.startsOn && day <= task.endsOn)
    .map((day) => ({ key: day, day, count: task.frequency!.count }));
}

export function taskPeriodMinutes(task: InspectionTask) {
  return (
    task.frequency!.count * (taskOccurrenceMinutes(task) ?? 0)
  );
}

/** 单个任务在某一周内对某个人的计划 / 剩余分钟。 */
export function taskLoadForPerson(
  task: InspectionTask,
  personId: string,
  week: string,
) {
  const minutes = taskOccurrenceMinutes(task) ?? 0;
  const periods = taskPeriods(task, week);
  return {
    planned: periods.reduce(
      (sum, period) => sum + period.count * minutes,
      0,
    ),
    remaining: periods.reduce(
      (sum, period) =>
        sum +
        Math.max(
          0,
          period.count - (task.results.completed[personId]?.[period.key] ?? 0),
        ) *
          minutes,
      0,
    ),
  };
}

const minutesOnDay = (task: InspectionTask) => taskOccurrenceMinutes(task) ?? 0;

/** 员工在某一周内的任务时间轴（含每天分钟数与完成情况）。 */
export function personItems(
  state: InspectionState,
  personId: string,
  week: string,
): PersonDayItem[] {
  const items: PersonDayItem[] = [];
  for (const task of state.tasks) {
    if (task.origin !== "demo") continue;
    if (!["active", "draft"].includes(task.status)) continue;
    if (!taskAppliesTo(state, task, personId)) continue;
    for (const period of taskPeriods(task, week)) {
      items.push({
        taskId: task.id,
        taskTitle: task.title,
        kind: task.kind,
        day: period.day,
        minutes: minutesOnDay(task) * period.count,
        weight: task.weight,
        count: period.count,
        done: Math.min(
          period.count,
          task.results.completed[personId]?.[period.key] ?? 0,
        ),
      });
    }
  }
  return items.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/* ------------------------------------------------------------- 员工聚合 */

export function personAggregates(
  state: InspectionState,
  week: string,
  today = inspectionDay(),
  regionIds?: string[],
): PersonAggregate[] {
  const people = state.people.filter(
    (person) =>
      person.active && (!regionIds || regionIds.includes(person.regionId)),
  );
  return people.map((person) => {
    const items = personItems(state, person.id, week);
    const tasks = state.tasks.filter(
      (task) =>
        task.origin === "demo" &&
        ["active", "draft"].includes(task.status) &&
        taskAudienceIds(state, task)?.includes(person.id) &&
        taskPeriods(task, week).length > 0,
    );
    const byDay = new Map<string, number>();
    for (const item of items)
      byDay.set(item.day, (byDay.get(item.day) ?? 0) + item.minutes);
    const peak = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const contentCount = new Map<string, Set<string>>();
    for (const task of tasks)
      for (const id of taskContentIds(task)) {
        const set = contentCount.get(id) ?? new Set<string>();
        set.add(task.id);
        contentCount.set(id, set);
      }
    const windowDays = state.policy.deadlineWindowDays;
    const dueDays = [...new Set(items.map((item) => item.day))].sort();
    let deadlineOverlaps = 0;
    for (const day of dueDays) {
      const end = addDays(day, windowDays - 1);
      const count = new Set(
        items.filter((item) => item.day >= day && item.day <= end).map((i) => i.taskId),
      ).size;
      deadlineOverlaps = Math.max(deadlineOverlaps, count);
    }
    const reportTasks = tasks.filter(
      (task) => task.results.returnedAt !== null,
    );
    const reported = reportTasks.flatMap((task) =>
      taskPeriods(task, week).map((period) => ({
        day: period.day,
        count: period.count,
        done: Math.min(
          period.count,
          task.results.completed[person.id]?.[period.key] ?? 0,
        ),
      })),
    );
    const totalCount = reported.reduce((sum, item) => sum + item.count, 0);
    const doneCount = reported.reduce((sum, item) => sum + item.done, 0);
    const overdue = reported.filter(
      (item) => item.day < today && item.done < item.count,
    ).length;
    const byKind: Record<TaskKind, number> = {
      study: 0,
      practice: 0,
      exam: 0,
      media: 0,
    };
    for (const task of tasks) byKind[task.kind] += 1;
    return {
      personId: person.id,
      name: person.name,
      regionId: person.regionId,
      storeId: person.storeId,
      role: person.role,
      taskCount: tasks.length,
      plannedMinutes: items.reduce((sum, item) => sum + item.minutes, 0),
      remainingMinutes: items.reduce(
        (sum, item) => sum + (item.count - item.done) * (item.minutes / item.count),
        0,
      ),
      dailyPeak: peak?.[1] ?? 0,
      peakDay: peak?.[0] ?? null,
      mandatoryCount: tasks.filter((task) => task.weight === "must").length,
      deadlineOverlaps,
      duplicateContents: [...contentCount.values()].filter(
        (ids) => ids.size > 1,
      ).length,
      completionRate: totalCount ? doneCount / totalCount : null,
      overdueRate: reported.length ? overdue / reported.length : null,
      unknownTaskCount: tasks.filter(taskUnknownMinutes).length,
      items,
      byKind,
    };
  });
}

export function regionAggregates(
  state: InspectionState,
  week: string,
  today = inspectionDay(),
  regionIds?: string[],
): RegionAggregate[] {
  const regions = state.regions.filter(
    (region) => !regionIds || regionIds.includes(region.id),
  );
  return regions.map((region) => {
    const people = personAggregates(state, week, today, [region.id]);
    const capacity =
      region.capacityMinutes ?? state.policy.weeklyCapacityMinutes;
    const known = people.filter((person) => person.unknownTaskCount === 0);
    const values = known.map((person) => person.plannedMinutes);
    const mean = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    const regionsMinutes = people.map((person) => {
      const hq = person.items
        .filter((item) => {
          const task = state.tasks.find((t) => t.id === item.taskId);
          return task?.audience.scope === "nationwide";
        })
        .reduce((sum, item) => sum + item.minutes, 0);
      return { hq, total: person.plannedMinutes };
    });
    const hqMean = regionsMinutes.length
      ? regionsMinutes.reduce((sum, row) => sum + row.hq, 0) /
        regionsMinutes.length
      : 0;
    const rated = people.filter((person) => person.completionRate !== null);
    const ratedSeconds = people.filter((person) => person.overdueRate !== null);
    const peak = [...people].sort((a, b) => b.dailyPeak - a.dailyPeak)[0];
    return {
      regionId: region.id,
      name: region.name,
      people,
      headcount: people.length,
      meanMinutes: round(mean),
      p90Minutes: percentile(values, 0.9),
      peakDay: peak?.peakDay ?? null,
      peakDayMinutes: peak?.dailyPeak ?? 0,
      capacityMinutes: capacity,
      capacityConfirmed: region.capacityMinutes !== null,
      overCapacityIds: known
        .filter((person) => person.plannedMinutes > capacity)
        .map((person) => person.personId),
      hqMean: round(hqMean),
      regionalMean: round(mean - hqMean),
      trainerPendingReviews: region.trainerPendingReviews,
      completionRate: rated.length
        ? rated.reduce((sum, person) => sum + (person.completionRate ?? 0), 0) /
          rated.length
        : null,
      overdueRate: ratedSeconds.length
        ? ratedSeconds.reduce((sum, person) => sum + (person.overdueRate ?? 0), 0) /
          ratedSeconds.length
        : null,
      unknownCount: people.length - known.length,
    };
  });
}

/* --------------------------------------------------------------- 风险工具 */

class RiskBuilder {
  private risks: InspectionRisk[] = [];
  constructor(
    private state: InspectionState,
    private week: string,
  ) {}
  add(
    risk: Omit<InspectionRisk, "key" | "week" | "conclusion"> & {
      key?: string;
      conclusion?: InspectionRisk["conclusion"];
      suffix?: string;
    },
  ) {
    const { suffix, ...rest } = risk;
    const key =
      rest.key ??
      `${this.week}:${rest.category}:${rest.ruleId}:${suffix ?? (rest.taskIds.join("+") || rest.regionIds.join("+"))}`;
    this.risks.push({
      ...rest,
      key,
      week: this.week,
      conclusion: rest.conclusion ?? conclusionLabel(rest.level),
    });
  }
  list() {
    return this.risks;
  }
  get policy() {
    return this.state.policy;
  }
}

const evidence = (text: string, ref: string) => ({ text, ref });

const confirmationFor = (
  state: InspectionState,
  ownerId: string | null,
  roleLabel: string,
): RiskConfirmation | null => {
  if (!ownerId) return null;
  const person = state.people.find((p) => p.id === ownerId);
  const regionOwner = state.regions.find((r) => r.ownerId === ownerId);
  const name = person?.name ?? regionOwner?.ownerName;
  if (!name) return null;
  return { id: ownerId, name, roleLabel };
};

/* ------------------------------------------------------------- 规则引擎 */

const taskRef = (task: InspectionTask, field: string) =>
  `任务「${task.title}」v${task.version} · ${field}`;

const frequencyText = (task: InspectionTask) =>
  task.frequency
    ? `${FREQUENCY_LABELS[task.frequency.unit]} ${task.frequency.count} 次`
    : "未配置频次";

const weightText = (task: InspectionTask) =>
  task.weight ? WEIGHT_LABELS[task.weight] : "未标注权重";

const ownerConfirmation = (state: InspectionState, task: InspectionTask) => {
  const hq = confirmationFor(state, task.owners.hqOwnerId || null, "总部负责人");
  if (hq) return hq;
  return confirmationFor(
    state,
    task.owners.regionOwnerId ?? null,
    "区域负责人",
  );
};

function personBreakdown(
  state: InspectionState,
  personId: string,
  week: string,
) {
  const items = personItems(state, personId, week);
  const byTask = new Map<string, number>();
  for (const item of items)
    byTask.set(item.taskId, (byTask.get(item.taskId) ?? 0) + item.minutes);
  return [...byTask.entries()]
    .map(([taskId, minutes]) => {
      const task = state.tasks.find((t) => t.id === taskId);
      return `${task?.title ?? taskId} ${round(minutes)} 分钟`;
    })
    .join(" + ");
}

export function missingFields(task: InspectionTask) {
  const fields: { field: string; ref: string; source?: string }[] = [];
  if (task.origin === "source") {
    for (const gap of task.dataGaps)
      fields.push({ field: gap, ref: taskRef(task, "数据接入契约") , source: "source"});
    return fields;
  }
  if (taskUnknownMinutes(task))
    fields.push({ field: "预计时长", ref: taskRef(task, "内容资源.预计时长") });
  if (task.audience.resolvedPersonIds === null)
    fields.push({ field: "逐人分配", ref: taskRef(task, "分发范围.员工名单") });
  if (!task.frequency)
    fields.push({ field: "结构化频次", ref: taskRef(task, "时间规则.频次") });
  if (!task.owners.hqOwnerId && !task.owners.regionOwnerId)
    fields.push({ field: "任务负责人", ref: taskRef(task, "负责人") });
  if (!task.version)
    fields.push({ field: "任务版本", ref: taskRef(task, "版本") });
  if (task.publishedAt && !task.results.pushedAt)
    fields.push({ field: "推送记录", ref: taskRef(task, "执行结果.推送记录") });
  if (task.publishedAt && !task.results.returnedAt)
    fields.push({ field: "完成回传", ref: taskRef(task, "执行结果.完成回传") });
  return fields;
}

/** 结构性能否完成：与 B1 相同的口径，供 E1 避免重复命中。 */
function structurallyInfeasible(
  task: InspectionTask,
  today: string,
  policy: InspectionPolicy,
  doneAvg: number,
) {
  if (!task.frequency || taskOccurrenceMinutes(task) === null) return false;
  const windowDays = daysBetween(task.startsOn, task.endsOn) + 1;
  const periodsInWindow =
    task.frequency.unit === "daily"
      ? windowDays
      : task.frequency.unit === "once"
        ? 1
        : Math.max(1, Math.ceil(windowDays / 7));
  const required = task.targetCount ?? task.frequency.count * periodsInWindow;
  const daysLeft = daysBetween(today, task.endsOn);
  const horizon = Math.ceil(policy.completionRiskHours / 24);
  const feasible = (Math.max(0, daysLeft) + 1) * policy.requiredCountPerDay;
  return daysLeft > horizon && required - doneAvg > feasible;
}

export function evaluateWeek(
  state: InspectionState,
  week: string,
  today = inspectionDay(),
): InspectionRisk[] {
  const risks = new RiskBuilder(state, week);
  const policy = state.policy;
  const aggregates = regionAggregates(state, week, today);
  const tasks = state.tasks.filter(
    (task) =>
      task.origin === "demo" && ["active", "draft"].includes(task.status),
  );
  const regionsOf = (task: InspectionTask) =>
    task.audience.regionIds.length
      ? task.audience.regionIds
      : state.regions.map((region) => region.id);

  /* --------------------------------------------------- F 数据不足 */

  for (const task of state.tasks) {
    if (task.status === "disabled" || task.mergedIntoId) continue;
    const gaps = missingFields(task);
    if (!gaps.length) continue;
    const inWeek = (regionsOf(task).length > 0 && task.endsOn >= week && task.startsOn <= addDays(week, 6)) ||
      task.origin === "source";
    if (!inWeek) continue;
    risks.add({
      ruleId: "F1",
      ruleName: "关键字段缺失",
      category: "F",
      level: "insufficient",
      title: `${task.title}缺少${gaps.map((gap) => gap.field).join("、")}`,
      taskIds: [task.id],
      personIds: [],
      regionIds: regionsOf(task),
      reason: `${task.title}缺少 ${gaps.map((gap) => gap.field).join("、")}，无法据此判断安排是否合理。`,
      evidence: gaps.map((gap) => evidence(`缺少字段：${gap.field}`, gap.ref)),
      suggestion: `补齐${gaps.map((gap) => gap.field).join("、")}后重新巡检；补齐前不输出合理或不合理结论。`,
      impact: {
        text: "补齐字段后 Agent 才能计算负荷、频次与人群偏差。",
        affectedPeople: 0,
        affectedRegions: regionsOf(task).length,
      },
      confirmation: ownerConfirmation(state, task),
      metrics: { missingCount: gaps.length },
      ruleParams: { requiredFields: "时长/人员/频次/负责人/版本/推送/回传" },
      key: `${week}:F:F1:${task.id}`,
    });
  }

  for (const region of state.regions) {
    if (region.capacityMinutes !== null || region.history.length >= 4) continue;
    risks.add({
      ruleId: "F2",
      ruleName: "缺少容量基线",
      category: "F",
      level: "insufficient",
      title: `${region.name}缺少容量基线与足够历史`,
      taskIds: [],
      personIds: [],
      regionIds: [region.id],
      reason: `${region.name}未确认每人每周培训容量，可用完整历史周期仅 ${region.history.length} / 4，无法判定负荷是否超容量。`,
      evidence: [
        evidence(
          `可用完整历史周期 ${region.history.length} / 4`,
          `区域「${region.name}」· 容量基线`,
        ),
      ],
      suggestion: "确认区域每人每周培训容量，或积累四个完整周期后重新巡检。",
      impact: {
        text: "缺少基线时只输出参考水平，不作为违规结论。",
        affectedPeople: region.history.length,
        affectedRegions: 1,
      },
      confirmation: confirmationFor(state, region.ownerId, "区域负责人"),
      metrics: { historyPeriods: region.history.length },
      ruleParams: { requiredPeriods: 4 },
      key: `${week}:F:F2:${region.id}`,
    });
  }

  /* --------------------------------------------------- A 负荷合理性 */

  for (const load of aggregates) {
    const region = state.regions.find((r) => r.id === load.regionId)!;
    const confirmed = region.capacityMinutes !== null;
    if (!confirmed && region.history.length < 4) continue;
    const capacity = load.capacityMinutes;
    if (load.overCapacityIds.length) {
      const level: RiskLevel = confirmed ? "high" : "medium";
      const worst = load.people
        .filter((person) => load.overCapacityIds.includes(person.personId))
        .sort((a, b) => b.plannedMinutes - a.plannedMinutes);
      const sample = worst.slice(0, 2);
      const evidenceRows = sample.map((person) =>
        evidence(
          `${person.name}：${round(person.plannedMinutes)} 分钟 = ${personBreakdown(state, person.personId, week)}`,
          `员工 ${person.personId} · 本周任务明细`,
        ),
      );
      const relatedTasks = tasks.filter((task) =>
        taskAudienceIds(state, task)?.some((id) =>
          load.overCapacityIds.includes(id),
        ),
      );
      risks.add({
        ruleId: "A1",
        ruleName: "单人预计分钟数超过区域容量",
        category: "A",
        level,
        title: confirmed
          ? `${region.name}人均负荷超过容量`
          : `${region.name}人均负荷高于历史参考`,
        taskIds: relatedTasks.map((task) => task.id),
        personIds: load.overCapacityIds,
        regionIds: [region.id],
        reason: `${
          confirmed
            ? `${region.name} ${load.overCapacityIds.length} 名员工本周预计人均超过 ${capacity} 分钟容量`
            : `${region.name} ${load.overCapacityIds.length} 名员工本周预计人均超过历史参考基线 ${capacity} 分钟`
        }（区域均值 ${load.meanMinutes} 分钟）。`,
        evidence: [
          evidence(
            confirmed
              ? `已确认容量 ${capacity} 分钟 / 人 / 周`
              : `未确认容量，参考历史中位数 ${median(region.history.slice(-4))} × ${policy.historyMultiplier} = ${round(capacity)} 分钟`,
            `区域「${region.name}」· 容量基线`,
          ),
          ...evidenceRows,
          evidence(
            `超出容量 ${load.overCapacityIds.length} / ${load.headcount} 人；区域人均 ${load.meanMinutes} 分钟，高负荷人群人均 ${load.p90Minutes} 分钟`,
            `区域「${region.name}」· 本周负荷聚合`,
          ),
        ],
        suggestion: "将非必修任务顺延至下周，或下调每周练习频次；必修与考试保留在原周期。",
        impact: {
          text: `若顺延非必修任务，预计 ${load.overCapacityIds.length} 人回落至 ${capacity} 分钟以内。`,
          affectedPeople: load.overCapacityIds.length,
          affectedRegions: 1,
        },
        confirmation: confirmationFor(state, region.ownerId, "区域负责人"),
        hypothesis: confirmed
          ? "可能由总部与区域任务同时下发造成。"
          : "区域容量未确认，只能按历史参考提示调整。",
        metrics: {
          meanMinutes: load.meanMinutes,
          p90Minutes: load.p90Minutes,
          capacity,
          overCount: load.overCapacityIds.length,
        },
        ruleParams: {
          weeklyCapacityMinutes: capacity,
          capacityConfirmed: confirmed,
          historyMultiplier: policy.historyMultiplier,
        },
        key: `${week}:A:A1:${region.id}`,
      });
    }

    const gap = load.p90Minutes - load.meanMinutes;
    if (
      load.headcount >= 5 &&
      load.p90Minutes > 0 &&
      gap >= policy.p90GapMinutes &&
      load.p90Minutes >= load.meanMinutes * policy.p90Ratio
    ) {
      const spread = load.people
        .filter((person) => person.plannedMinutes >= load.p90Minutes)
        .sort((a, b) => b.plannedMinutes - a.plannedMinutes);
      risks.add({
        ruleId: "A2",
        ruleName: "少数员工负荷明显高于区域平均",
        category: "A",
        level: "medium",
        title: `${region.name}少数员工负荷明显偏高`,
        taskIds: [
          ...new Set(spread.flatMap((person) => person.items.map((i) => i.taskId))),
        ],
        personIds: spread.map((person) => person.personId),
        regionIds: [region.id],
        reason: `${region.name}负荷最重的员工人均 ${load.p90Minutes} 分钟，比区域人均 ${load.meanMinutes} 分钟高出 ${round(gap)} 分钟，少数员工承担了大部分任务。`,
        evidence: [
          evidence(
            `区域人均 ${load.meanMinutes} 分钟；负荷最高的员工人均 ${load.p90Minutes} 分钟，高出 ${round(gap)} 分钟`,
            `区域「${region.name}」· 本周负荷聚合`,
          ),
          ...spread
            .slice(0, 3)
            .map((person) =>
              evidence(
                `${person.name}：${round(person.plannedMinutes)} 分钟（${person.taskCount} 项任务）`,
                `员工 ${person.personId} · 本周任务明细`,
              ),
            ),
        ],
        suggestion: "核对高负荷员工的任务范围，将可共享的任务改为分批或按角色下发。",
        impact: {
          text: `预计可让 ${spread.length} 名员工回到区域均值附近。`,
          affectedPeople: spread.length,
          affectedRegions: 1,
        },
        confirmation: confirmationFor(state, region.ownerId, "区域负责人"),
        suffix: region.id,
        metrics: {
          meanMinutes: load.meanMinutes,
          p90Minutes: load.p90Minutes,
          gap: round(gap),
          spreadCount: spread.length,
        },
        ruleParams: {
          p90Ratio: policy.p90Ratio,
          p90GapMinutes: policy.p90GapMinutes,
        },
        key: `${week}:A:A2:${region.id}`,
      });
    }

    if (load.peakDayMinutes > policy.dailyLimitMinutes) {
      const peakPeople = load.people
        .filter(
          (person) =>
            person.peakDay === load.peakDay &&
            person.dailyPeak > policy.dailyLimitMinutes,
        )
        .sort((a, b) => b.dailyPeak - a.dailyPeak);
      if (peakPeople.length) {
        const sample = peakPeople[0];
        const sameDay = sample.items.filter((item) => item.day === sample.peakDay);
        risks.add({
          ruleId: "A3",
          ruleName: "单人单日任务分钟数超过阈值",
          category: "A",
          level: "high",
          title: `${load.peakDay} 单日负荷超过 ${policy.dailyLimitMinutes} 分钟`,
          taskIds: [...new Set(sameDay.map((item) => item.taskId))],
          personIds: peakPeople.map((person) => person.personId),
          regionIds: [region.id],
          reason: `${region.name} ${peakPeople.length} 名员工在 ${load.peakDay} 当天安排了 ${sample.dailyPeak} 分钟任务，超过单日阈值 ${policy.dailyLimitMinutes} 分钟。`,
          evidence: [
            evidence(
              `${sample.name} ${sample.peakDay}：${sameDay
                .map((item) => `${item.taskTitle} ${round(item.minutes)} 分钟`)
                .join("、")}`,
              `员工 ${sample.personId} · 每日时间轴`,
            ),
            evidence(
              `单日阈值 ${policy.dailyLimitMinutes} 分钟，实际峰值 ${sample.dailyPeak} 分钟`,
              "策略 · 单日负荷阈值",
            ),
          ],
          suggestion: "将其中一项任务截止时间错开一天，或把同内容的练习合并在同一任务内。",
          impact: {
            text: `错开一天后，${sample.name} 等 ${peakPeople.length} 人单日峰值预计降至 ${policy.dailyLimitMinutes} 分钟以内。`,
            affectedPeople: peakPeople.length,
            affectedRegions: 1,
          },
          confirmation: confirmationFor(state, region.ownerId, "区域负责人"),
          metrics: {
            peakDay: sample.peakDay,
            peakMinutes: sample.dailyPeak,
            limit: policy.dailyLimitMinutes,
          },
          ruleParams: { dailyLimitMinutes: policy.dailyLimitMinutes },
          key: `${week}:A:A3:${region.id}:${sample.peakDay}`,
        });
      }
    }
  }

  const compared = aggregates.filter(
    (load) => load.headcount > 0 && load.unknownCount < load.headcount,
  );
  if (compared.length >= 3) {
    for (const load of compared) {
      const peers = compared.filter((item) => item.regionId !== load.regionId);
      const loadMedian = median(peers.map((item) => item.meanMinutes));
      if (loadMedian <= 0) continue;
      if (load.meanMinutes < loadMedian * policy.regionGapRatio) continue;
      const region = state.regions.find((item) => item.id === load.regionId)!;
      const regionTasks = state.tasks.filter(
        (task) =>
          task.origin === "demo" &&
          ["active", "draft"].includes(task.status) &&
          taskAudienceIds(state, task)?.some((id) =>
            load.people.some((person) => person.personId === id),
          ),
      );
      risks.add({
        ruleId: "A6",
        ruleName: "区域任务总量明显高于其他区域",
        category: "A",
        level: load.meanMinutes >= loadMedian * 1.6 ? "high" : "medium",
        title: `${load.name}任务总量明显偏高`,
        taskIds: regionTasks.map((task) => task.id),
        personIds: load.people.map((person) => person.personId),
        regionIds: [load.regionId],
        reason: `${load.name}人均 ${load.meanMinutes} 分钟，是其他区域中位数 ${round(loadMedian)} 分钟的 ${(load.meanMinutes / loadMedian).toFixed(2)} 倍。`,
        evidence: [
          evidence(
            `区域均值 ${load.meanMinutes} 分钟 / 其他区域中位数 ${round(loadMedian)} 分钟`,
            `区域「${load.name}」· 本周负荷聚合`,
          ),
          evidence(
            `总部任务 ${load.hqMean} 分钟 + 区域任务 ${load.regionalMean} 分钟 / 人`,
            `区域「${load.name}」· 任务来源拆分`,
          ),
        ],
        suggestion: "把区域自建任务分批下发，或与总部任务错峰，避免同一批人承担全部任务。",
        impact: {
          text: `错峰后 ${load.name}人均预计下降至 ${round(loadMedian * policy.regionGapRatio)} 分钟以内。`,
          affectedPeople: load.headcount,
          affectedRegions: 1,
        },
        confirmation: confirmationFor(state, region.ownerId, "区域负责人"),
        metrics: {
          mean: load.meanMinutes,
          peerMedian: round(loadMedian),
        },
        ruleParams: { regionGapRatio: policy.regionGapRatio },
        key: `${week}:A:A6:${load.regionId}`,
      });
    }
  }

  for (const task of tasks) {
    if (!task.frequency || task.frequency.unit === "once") continue;
    const minutes = taskOccurrenceMinutes(task);
    if (minutes === null) continue;
    const perWeek = taskPeriodMinutes(task);
    if (perWeek <= policy.taskWeeklyLimitMinutes) continue;
    risks.add({
      ruleId: "A4",
      ruleName: "周期频次 × 单次时长超出合理投入",
      category: "A",
      level: perWeek > policy.weeklyCapacityMinutes ? "high" : "medium",
      title: `${task.title}单周期投入偏高`,
      taskIds: [task.id],
      personIds: taskAudienceIds(state, task) ?? [],
      regionIds: regionsOf(task),
      reason: `${task.title}按${frequencyText(task)}执行，每人每周需投入 ${perWeek} 分钟，超过单任务上限 ${policy.taskWeeklyLimitMinutes} 分钟。`,
      evidence: [
        evidence(
          `单次 ${minutes} 分钟 × ${task.frequency.count} 次 / ${task.frequency.unit === "daily" ? "日（按 7 日折算）" : "周"} = ${perWeek} 分钟`,
          taskRef(task, "时间规则.频次 × 内容资源.预计时长"),
        ),
        evidence(
          `单任务周投入上限 ${policy.taskWeeklyLimitMinutes} 分钟`,
          "策略 · 单任务周期投入",
        ),
      ],
      suggestion: `将频次从${task.frequency.unit === "daily" ? "每日" : "每周"} ${task.frequency.count} 次调整为 ${Math.max(1, Math.floor(policy.taskWeeklyLimitMinutes / minutes))} 次，或拆分内容分批下发。`,
      impact: {
        text: `降低频次后每人每周减少 ${perWeek - Math.floor(policy.taskWeeklyLimitMinutes / minutes) * minutes} 分钟。`,
        affectedPeople: taskAudienceIds(state, task)?.length ?? 0,
        affectedRegions: regionsOf(task).length,
      },
      confirmation: ownerConfirmation(state, task),
      metrics: { perWeek, limit: policy.taskWeeklyLimitMinutes, minutes },
      ruleParams: { taskWeeklyLimitMinutes: policy.taskWeeklyLimitMinutes },
      key: `${week}:A:A4:${task.id}`,
    });
  }

  /* --------------------------------------------------- B 时间合理性 */

  for (const task of tasks) {
    if (!task.frequency) continue;
    const minutes = taskOccurrenceMinutes(task);
    if (minutes === null) continue;
    const windowDays = daysBetween(task.startsOn, task.endsOn) + 1;
    const periodsInWindow =
      task.frequency.unit === "daily"
        ? windowDays
        : task.frequency.unit === "once"
          ? 1
          : Math.max(1, Math.ceil(windowDays / 7));
    const required = task.targetCount ?? task.frequency.count * periodsInWindow;
    const audienceIds = taskAudienceIds(state, task) ?? [];
    const doneAvg = audienceIds.length
      ? audienceIds.reduce(
          (sum, id) =>
            sum +
            Object.values(task.results.completed[id] ?? {}).reduce(
              (total, value) => total + value,
              0,
            ),
          0,
        ) / audienceIds.length
      : 0;
    const remaining = required - doneAvg;
    const daysLeft = daysBetween(today, task.endsOn);
    const horizon = Math.ceil(policy.completionRiskHours / 24);
    const feasible = (Math.max(0, daysLeft) + 1) * policy.requiredCountPerDay;
    if (remaining > 0 && daysLeft > horizon && remaining > feasible) {
      risks.add({
        ruleId: "B1",
        ruleName: "剩余时间不足以完成要求次数",
        category: "B",
        level: remaining > feasible * 1.5 ? "high" : "medium",
        title: `${task.title}剩余时间不足`,
        taskIds: [task.id],
        personIds: audienceIds,
        regionIds: regionsOf(task),
        reason: `${task.title}距截止还有 ${daysLeft} 天，人均仍需完成约 ${Math.round(remaining)} 次（${required} 次要求已完成 ${round(doneAvg)} 次），按每天 ${policy.requiredCountPerDay} 次的上限无法完成。`,
        evidence: [
          evidence(
            `要求 ${required} 次 / 周期 ${windowDays} 天：${frequencyText(task)}${task.targetCount ? `，达标次数 ${task.targetCount}` : ""}`,
            taskRef(task, "时间规则.频次 + 达标次数"),
          ),
          evidence(
            `截止 ${task.endsOn}，剩余 ${daysLeft} 天，最多可实现约 ${feasible} 次`,
            taskRef(task, "时间规则.截止时间"),
          ),
        ],
        suggestion: `把截止时间延后至 ${addDays(today, Math.ceil(remaining / policy.requiredCountPerDay) + 1)}，或下调要求次数。`,
        impact: {
          text: `延后后 ${audienceIds.length} 人可按当前节奏达标。`,
          affectedPeople: audienceIds.length,
          affectedRegions: regionsOf(task).length,
        },
        confirmation: ownerConfirmation(state, task),
        metrics: { required, remaining: round(remaining), daysLeft, feasible },
        ruleParams: { requiredCountPerDay: policy.requiredCountPerDay },
        key: `${week}:B:B1:${task.id}`,
      });
    }

    if (
      task.frequency.unit === "weekly" &&
      task.frequency.count > 5 &&
      windowDays < 7
    ) {
      risks.add({
        ruleId: "B2",
        ruleName: "截止日期与频次不匹配",
        category: "B",
        level: "high",
        title: `${task.title}周期与频次不匹配`,
        taskIds: [task.id],
        personIds: audienceIds,
        regionIds: regionsOf(task),
        reason: `任务有效周期仅 ${windowDays} 天，却要求每周完成 ${task.frequency.count} 次。`,
        evidence: [
          evidence(
            `周期 ${task.startsOn} ~ ${task.endsOn}（${windowDays} 天）`,
            taskRef(task, "时间规则.起止时间"),
          ),
          evidence(frequencyText(task), taskRef(task, "时间规则.频次")),
        ],
        suggestion: "把有效周期延长到完整一周，或把频次调整为可在周期内完成的次数。",
        impact: {
          text: `调整后 ${audienceIds.length} 人可按周期完成要求。`,
          affectedPeople: audienceIds.length,
          affectedRegions: regionsOf(task).length,
        },
        confirmation: ownerConfirmation(state, task),
        metrics: { windowDays, count: task.frequency.count },
        ruleParams: { minWindowDays: 7 },
        key: `${week}:B:B2:${task.id}`,
      });
    }

    if (task.publishedAt && task.publishedAt > task.startsOn) {
      const delay = daysBetween(task.startsOn, task.publishedAt);
      risks.add({
        ruleId: "B4",
        ruleName: "发布时间晚于有效周期起点",
        category: "B",
        level: delay >= 2 ? "medium" : "low",
        title: `${task.title}发布时间晚于周期起点`,
        taskIds: [task.id],
        personIds: audienceIds,
        regionIds: regionsOf(task),
        reason: `任务有效周期从 ${task.startsOn} 开始，但 ${task.publishedAt} 才发布，实际可用时间被压缩 ${delay} 天。`,
        evidence: [
          evidence(
            `起止 ${task.startsOn} ~ ${task.endsOn}`,
            taskRef(task, "时间规则.起止时间"),
          ),
          evidence(
            `发布时间 ${task.publishedAt}`,
            taskRef(task, "发布记录.发布时间"),
          ),
        ],
        suggestion: "把周期起点同步为发布时间，或确认频次在压缩后的窗口内仍可达成。",
        impact: {
          text: `${audienceIds.length} 人的实际可用时间减少 ${delay} 天。`,
          affectedPeople: audienceIds.length,
          affectedRegions: regionsOf(task).length,
        },
        confirmation: ownerConfirmation(state, task),
        metrics: { delayDays: delay },
        ruleParams: { allowedDelayDays: 0 },
        key: `${week}:B:B4:${task.id}`,
      });
    }

    const span = daysBetween(task.startsOn, task.endsOn);
    if (span > policy.longRunningDays && task.reviewCadenceDays === null) {
      risks.add({
        ruleId: "B5",
        ruleName: "长期有效任务没有复查或失效机制",
        category: "B",
        level: "low",
        title: `${task.title}长期有效且无复查机制`,
        taskIds: [task.id],
        personIds: audienceIds,
        regionIds: regionsOf(task),
        reason: `任务有效期 ${span} 天，超过 ${policy.longRunningDays} 天但没有配置复查或失效机制。`,
        evidence: [
          evidence(
            `有效周期 ${task.startsOn} ~ ${task.endsOn}（${span} 天）`,
            taskRef(task, "时间规则.起止时间"),
          ),
          evidence("复查间隔：未配置", taskRef(task, "复查机制")),
        ],
        suggestion: "为长期任务增加复查周期（例如每 30 天）或设置失效时间。",
        impact: {
          text: "加入复查后可避免长期任务变成默认负担。",
          affectedPeople: audienceIds.length,
          affectedRegions: regionsOf(task).length,
        },
        confirmation: ownerConfirmation(state, task),
        metrics: { spanDays: span },
        ruleParams: { longRunningDays: policy.longRunningDays },
        key: `${week}:B:B5:${task.id}`,
      });
    }
  }

  for (const load of aggregates) {
    const hit = load.people.filter((person) => {
      const days = [...new Set(person.items.map((item) => item.day))].sort();
      return days.some((day) => {
        const end = addDays(day, policy.deadlineWindowDays - 1);
        return (
          end >= today &&
          new Set(
            person.items
              .filter((item) => item.day >= day && item.day <= end)
              .map((item) => item.taskId),
          ).size >= policy.deadlineTaskCount
        );
      });
    });
    if (!hit.length) continue;
    const sample = hit[0];
    const windowEnd = addDays(
      sample.items[0].day,
      policy.deadlineWindowDays - 1,
    );
    const windowItems = sample.items.filter((item) => item.day <= windowEnd);
    risks.add({
      ruleId: "B3",
      ruleName: "多个任务在同一天或同一时段集中截止",
      category: "B",
      level: "medium",
      title: `${load.name} ${hit.length} 人截止日集中`,
      taskIds: [...new Set(windowItems.map((item) => item.taskId))],
      personIds: hit.map((person) => person.personId),
      regionIds: [load.regionId],
      reason: `${load.name} ${hit.length} 名员工在连续 ${policy.deadlineWindowDays} 天内至少有 ${policy.deadlineTaskCount} 项任务截止（例如 ${sample.name}）。`,
      evidence: [
        evidence(
          `${sample.name}：${windowItems
            .map((item) => `${item.taskTitle} 截止 ${item.day}`)
            .join("；")}`,
          `员工 ${sample.personId} · 截止日堆叠`,
        ),
        evidence(
          `窗口 ${policy.deadlineWindowDays} 天，任务数阈值 ${policy.deadlineTaskCount}`,
          "策略 · 截止集中",
        ),
      ],
      suggestion: "按优先级分批执行，把可调整任务的截止日错开到其他周。",
      impact: {
        text: `错峰后 ${hit.length} 人单窗口任务数降至 ${policy.deadlineTaskCount - 1} 项以内。`,
        affectedPeople: hit.length,
        affectedRegions: 1,
      },
      confirmation: confirmationFor(
        state,
        state.regions.find((region) => region.id === load.regionId)!.ownerId,
        "区域负责人",
      ),
      metrics: { hitCount: hit.length },
      ruleParams: {
        deadlineWindowDays: policy.deadlineWindowDays,
        deadlineTaskCount: policy.deadlineTaskCount,
      },
      suffix: load.regionId,
      key: `${week}:B:B3:${load.regionId}`,
    });
  }

  /* A5 必修任务与考试集中在同一时间窗口 */
  for (const load of aggregates) {
    const windowDays = policy.deadlineWindowDays;
    const windowOf = (person: PersonAggregate, day: string) => {
      const end = addDays(day, windowDays - 1);
      return {
        end,
        items: person.items.filter(
          (item) => item.day >= day && item.day <= end,
        ),
      };
    };
    const triggers = (person: PersonAggregate, day: string) => {
      const { end, items } = windowOf(person, day);
      if (end < today) return false;
      const keys = new Set(
        items
          .filter((item) => item.weight === "must" || item.kind === "exam")
          .map((item) => item.taskId),
      );
      return (
        keys.size >= policy.deadlineTaskCount &&
        items.some((item) => item.kind === "exam") &&
        items.some((item) => item.weight === "must" && item.kind !== "exam")
      );
    };
    let sample: { person: PersonAggregate; day: string; items: PersonDayItem[] } | null =
      null;
    for (const person of load.people) {
      const days = [...new Set(person.items.map((item) => item.day))].sort();
      for (const day of days) {
        if (!triggers(person, day)) continue;
        sample = { person, day, items: windowOf(person, day).items };
        break;
      }
      if (sample) break;
    }
    if (!sample) continue;
    const hit = load.people.filter((person) =>
      [...new Set(person.items.map((item) => item.day))].some((day) =>
        triggers(person, day),
      ),
    );
    const firstTask = state.tasks.find(
      (task) => task.id === sample!.items[0].taskId,
    );
    risks.add({
      ruleId: "A5",
      ruleName: "必修任务与考试集中在同一时间窗口",
      category: "A",
      level: "high",
      title: `必修与考试在 ${windowDays} 天内叠加`,
      taskIds: [...new Set(sample.items.map((item) => item.taskId))],
      personIds: hit.map((person) => person.personId),
      regionIds: [load.regionId],
      reason: `${load.name} ${hit.length} 名员工在连续 ${windowDays} 天内同时承接必修任务与考试，学习、练习与考核挤在同一窗口。`,
      evidence: [
        evidence(
          `${sample.person.name}（${sample.day} 起 ${windowDays} 天）：${sample.items
            .map(
              (item) =>
                `${item.taskTitle} ${item.day}（${KIND_LABELS[item.kind]}${item.weight ? `·${WEIGHT_LABELS[item.weight]}` : ""}）`,
            )
            .join("；")}`,
          `员工 ${sample.person.personId} · 任务时间轴`,
        ),
        evidence(
          `窗口 ${windowDays} 天内必修 / 考试任务数 ≥ ${policy.deadlineTaskCount}`,
          "策略 · 集中窗口",
        ),
      ],
      suggestion: "把考试安排在学习任务结束后的下一个窗口，或将非必修内容顺延。",
      impact: {
        text: `调整后 ${hit.length} 人的必修与考试不再落在同一窗口。`,
        affectedPeople: hit.length,
        affectedRegions: 1,
      },
      confirmation: firstTask ? ownerConfirmation(state, firstTask) : null,
      metrics: { windowDays, hitCount: hit.length },
      ruleParams: {
        deadlineWindowDays: windowDays,
        deadlineTaskCount: policy.deadlineTaskCount,
      },
      key: `${week}:A:A5:${load.regionId}`,
    });
  }

  /* --------------------------------------------------- C 人群合理性 */

  for (const task of tasks) {
    const ids = taskAudienceIds(state, task);
    const expected = task.audience.expectedCount;
    if (
      ids &&
      expected !== null &&
      expected > 0 &&
      Math.abs(ids.length - expected) / expected > policy.audienceDeviationRatio
    ) {
      const ratio = (ids.length - expected) / expected;
      const under = ratio < 0;
      risks.add({
        ruleId: "C1",
        ruleName: "命中人数与预期人群差异过大",
        category: "C",
        level: under ? "medium" : "low",
        title: `${task.title}命中人数与预期差异 ${Math.round(Math.abs(ratio) * 100)}%`,
        taskIds: [task.id],
        personIds: ids,
        regionIds: regionsOf(task),
        reason: `人群策略「${task.audience.label}」预期 ${expected} 人，实际命中 ${ids.length} 人，偏差 ${Math.round(Math.abs(ratio) * 100)}%。`,
        evidence: [
          evidence(
            `预期 ${expected} 人 / 实际 ${ids.length} 人（${under ? "少" : "多"} ${Math.abs(ids.length - expected)} 人）`,
            taskRef(task, "分发范围.预期人数"),
          ),
          evidence(
            `员工名单生成时间 ${task.audience.resolvedAt ?? "未记录"}`,
            taskRef(task, "分发范围.员工名单"),
          ),
        ],
        suggestion: under
          ? "检查人群策略条件（在职状态、区域、角色），补齐未覆盖人群。"
          : "核对策略是否命中非目标人群，必要时改为按角色或门店下发。",
        impact: {
          text: under
            ? `补齐后预计覆盖 ${expected} 人。`
            : `收窄后预计命中 ${expected} 人。`,
          affectedPeople: Math.abs(ids.length - expected),
          affectedRegions: regionsOf(task).length,
        },
        confirmation: ownerConfirmation(state, task),
        metrics: { expected, actual: ids.length, ratio: Math.round(ratio * 100) },
        ruleParams: { audienceDeviationRatio: policy.audienceDeviationRatio },
        key: `${week}:C:C1:${task.id}`,
      });
    }

    if (
      ids &&
      task.audience.scope !== "nationwide" &&
      task.audience.regionIds.length
    ) {
      const outside = ids.filter((id) => {
        const person = state.people.find((p) => p.id === id);
        return person && !task.audience.regionIds.includes(person.regionId);
      });
      if (outside.length) {
        risks.add({
          ruleId: "C2",
          ruleName: "区域任务误命中其他区域员工",
          category: "C",
          level: "high",
          title: `${task.title}误命中其他区域员工`,
          taskIds: [task.id],
          personIds: outside,
          regionIds: [
            ...new Set(
              outside
                .map((id) => state.people.find((p) => p.id === id)?.regionId)
                .filter(Boolean) as string[],
            ),
          ],
          reason: `区域任务只应命中 ${task.audience.regionIds.map((id) => regionName(state, id)).join("、")}，实际有 ${outside.length} 人来自其他区域。`,
          evidence: [
            evidence(
              `${outside
                .slice(0, 4)
                .map(
                  (id) =>
                    `${personName(state, id)}（${regionName(state, state.people.find((p) => p.id === id)!.regionId)} · ${storeName(state, state.people.find((p) => p.id === id)!.storeId)}）`,
                )
                .join("、")}`,
              taskRef(task, "分发范围.员工名单"),
            ),
            evidence(
              `任务范围 ${task.audience.label}`,
              taskRef(task, "分发范围.范围"),
            ),
          ],
          suggestion: "从员工名单中移除其他区域员工，并核对人群策略是否误用了跨区条件。",
          impact: {
            text: `${outside.length} 名外区员工的错误安排可立即移除。`,
            affectedPeople: outside.length,
            affectedRegions: 1,
          },
          confirmation: ownerConfirmation(state, task),
          metrics: { outsideCount: outside.length },
          ruleParams: { scope: task.audience.scope },
          key: `${week}:C:C2:${task.id}`,
        });
      }
    }

    if (
      ids &&
      taskContentIds(task).length &&
      task.weight !== "retraining" &&
      !task.exceptionNote
    ) {
      for (const other of tasks) {
        if (other.id === task.id || other.kind === "exam") continue;
        const shared = taskContentIds(task).filter((id) =>
          taskContentIds(other).includes(id),
        );
        if (!shared.length) continue;
        const otherIds = taskAudienceIds(state, other) ?? [];
        const overlap = ids.filter((id) => otherIds.includes(id));
        if (!overlap.length) continue;
        const completed = overlap.filter((id) =>
          taskPeriods(other, week).every(
            (period) =>
              (other.results.completed[id]?.[period.key] ?? 0) >= period.count,
          ) && taskPeriods(other, week).length > 0,
        );
        if (!completed.length) continue;
        risks.add({
          ruleId: "C3",
          ruleName: "已完成同源任务的员工再次被安排相同内容",
          category: "C",
          level: "medium",
          title: "同源内容重复安排",
          taskIds: [task.id, other.id],
          personIds: completed,
          regionIds: regionsOf(task),
          reason: `${completed.length} 名员工已完成「${other.title}」，仍然被安排同源内容「${task.title}」，且没有复训说明。`,
          evidence: [
            evidence(
              `同源内容：${shared.join("、")}`,
              `${taskRef(task, "内容资源")} / ${taskRef(other, "内容资源")}`,
            ),
            evidence(
              `${completed.slice(0, 4).map((id) => personName(state, id)).join("、")} 已完成 ${other.title}`,
              taskRef(other, "执行结果.完成回传"),
            ),
          ],
          suggestion: "合并重复任务，或为确实需要的复训填写复训理由与有效期。",
          impact: {
            text: `${completed.length} 人可免于重复学习，人均节省 ${taskOccurrenceMinutes(task) ?? "?"} 分钟。`,
            affectedPeople: completed.length,
            affectedRegions: regionsOf(task).length,
          },
          confirmation: ownerConfirmation(state, task),
          metrics: { overlap: completed.length, shared: shared.length },
          ruleParams: { requireRetrainingReason: true },
          key: `${week}:C:C3:${[task.id, other.id].sort().join(":")}`,
        });
      }
    }

  }

  /* --------------------------------------------------- G 品类覆盖 */

  // 同一批任务里，某个品类只在部分区域有安排：别的区域这一期接触不到这个品类。
  const categoryCoverage = new Map<
    string,
    { regions: Set<string>; taskIds: string[] }
  >();
  for (const task of tasks) {
    if (!taskPeriods(task, week).length) continue;
    for (const category of task.categories ?? []) {
      const entry =
        categoryCoverage.get(category) ??
        { regions: new Set<string>(), taskIds: [] as string[] };
      for (const regionId of regionsOf(task)) entry.regions.add(regionId);
      entry.taskIds.push(task.id);
      categoryCoverage.set(category, entry);
    }
  }
  for (const [category, entry] of categoryCoverage) {
    const missing = state.regions.filter(
      (region) => !entry.regions.has(region.id),
    );
    if (!missing.length) continue;
    const missingPeople = state.people.filter(
      (person) =>
        person.active && missing.some((region) => region.id === person.regionId),
    );
    if (!missingPeople.length) continue;
    const coveredNames = [...entry.regions]
      .map((id) => state.regions.find((region) => region.id === id)?.name ?? id)
      .join("、");
    risks.add({
      ruleId: "G1",
      ruleName: "品类覆盖不完整",
      category: "G",
      level: "medium",
      title: `「${category}」在 ${missing.length} 个区域没有任务`,
      taskIds: entry.taskIds,
      personIds: missingPeople.map((person) => person.id),
      regionIds: missing.map((region) => region.id),
      reason: `「${category}」这个品类当前只在 ${coveredNames} 有任务，${missing
        .map((region) => region.name)
        .join("、")}本周没有对应的学习安排。`,
      evidence: [
        evidence(
          `覆盖区域：${coveredNames}（${entry.taskIds
            .map((id) => state.tasks.find((task) => task.id === id)?.title)
            .filter(Boolean)
            .join("、")}）`,
          "任务分发范围 / 品类",
        ),
        evidence(
          `缺少区域：${missing.map((region) => region.name).join("、")}`,
          "任务分发范围",
        ),
      ],
      suggestion: `确认「${category}」是不是应该覆盖全部区域；需要的话给缺的区域补一条任务，或者说明本期只在部分区域上线。`,
      impact: {
        text: `${missingPeople.length} 名员工这一期接触不到「${category}」。`,
        affectedPeople: missingPeople.length,
        affectedRegions: missing.length,
      },
      confirmation: null,
      metrics: { missingRegions: missing.length },
      ruleParams: { category },
      key: `${week}:G:G1:${category}`,
    });
  }

  for (const load of aggregates) {
    const covered = load.people.filter((person) => person.taskCount > 0);
    const maxTasks = load.people.reduce(
      (max, person) => Math.max(max, person.taskCount),
      0,
    );
    const coverage = load.headcount ? covered.length / load.headcount : 1;
    if (coverage < 0.6 && maxTasks >= 3) {
      const heavy = load.people
        .filter((person) => person.taskCount >= maxTasks)
        .map((person) => person.personId);
      const missing = load.people
        .filter((person) => person.taskCount === 0)
        .map((person) => person.personId);
      risks.add({
        ruleId: "C5",
        ruleName: "命中不均衡：部分员工重复命中，其他目标人群未覆盖",
        category: "C",
        level: "medium",
        title: `${load.name}任务命中不均衡`,
        taskIds: [
          ...new Set(
            load.people
              .filter((person) => person.taskCount >= maxTasks)
              .flatMap((person) => person.items.map((item) => item.taskId)),
          ),
        ],
        personIds: [...new Set([...heavy, ...missing])],
        regionIds: [load.regionId],
        reason: `${load.name}仅 ${covered.length} / ${load.headcount} 人被任务命中，但个别员工承担 ${maxTasks} 项任务，命中分布不均衡。`,
        evidence: [
          evidence(
            `覆盖 ${covered.length} / ${load.headcount} 人（${Math.round(coverage * 100)}%）`,
            `区域「${load.name}」· 本周任务明细`,
          ),
          evidence(
            `${missing.slice(0, 4).map((id) => personName(state, id)).join("、")} 近一周没有任何任务`,
            `区域「${load.name}」· 员工时间轴`,
          ),
        ],
        suggestion: "把任务改为按人群策略逐批下发，让目标人群都被覆盖到。",
        impact: {
          text: `重新分批后 ${missing.length} 名未覆盖员工可收到任务。`,
          affectedPeople: missing.length,
          affectedRegions: 1,
        },
        confirmation: confirmationFor(
          state,
          state.regions.find((r) => r.id === load.regionId)!.ownerId,
          "区域负责人",
        ),
        metrics: { coverage: Math.round(coverage * 100), maxTasks },
        ruleParams: { concentrationRatio: policy.concentrationRatio },
        key: `${week}:C:C5:${load.regionId}`,
      });
    }
  }

  /* ------------------------------------------ D 内容与任务关系 */

  for (const task of tasks) {
    if (task.kind !== "exam") continue;
    const contents = taskContentIds(task);
    const examAudience = taskAudienceIds(state, task) ?? [];
    const related = tasks.filter(
      (other) =>
        other.id !== task.id &&
        other.kind !== "exam" &&
        (task.relations.sameSourceTaskIds.includes(other.id) ||
          (taskContentIds(other).some((id) => contents.includes(id)) &&
            (taskAudienceIds(state, other) ?? []).some((id) =>
              examAudience.includes(id),
            ))),
    );
    const ordered =
      task.relations.prerequisiteTaskIds.length > 0 || task.relations.sequenceDefined;
    const before = related.filter((other) => other.startsOn <= task.startsOn);
    if (related.length && before.length && !ordered) {
      risks.add({
        ruleId: "D1",
        ruleName: "学习内容与考试之间没有明确顺序",
        category: "D",
        level: "medium",
        title: `${task.title}与学习任务未声明顺序`,
        taskIds: [task.id, ...related.map((item) => item.id)],
        personIds: taskAudienceIds(state, task) ?? [],
        regionIds: regionsOf(task),
        reason: `「${related[0].title}」与考试「${task.title}」使用同源内容，但没有声明先后顺序。`,
        evidence: [
          evidence(
            `关联任务：${related.map((item) => item.title).join("、")}`,
            taskRef(task, "任务关系.同源内容"),
          ),
          evidence(
            `前置任务：${task.relations.prerequisiteTaskIds.length ? task.relations.prerequisiteTaskIds.join("、") : "未声明"}；顺序声明：${task.relations.sequenceDefined ? "已声明" : "未声明"}`,
            taskRef(task, "任务关系.前置任务"),
          ),
        ],
        suggestion: "把学习任务设为考试的前置任务，并声明完成顺序。",
        impact: {
          text: `${taskAudienceIds(state, task)?.length ?? 0} 人的考试将排在学习之后。`,
          affectedPeople: taskAudienceIds(state, task)?.length ?? 0,
          affectedRegions: regionsOf(task).length,
        },
        confirmation: ownerConfirmation(state, task),
        metrics: { related: related.length },
        ruleParams: { requiresSequence: true },
        key: `${week}:D:D1:${task.id}`,
      });
    }
  }

  for (const task of tasks) {
    if (task.kind !== "practice") continue;
    for (const other of tasks) {
      if (other.kind !== "practice" || other.id <= task.id) continue;
      const shared = taskContentIds(task).filter((id) =>
        taskContentIds(other).includes(id),
      );
      if (!shared.length) continue;
      const a = taskAudienceIds(state, task) ?? [];
      const b = taskAudienceIds(state, other) ?? [];
      const overlap = a.filter((id) => b.includes(id));
      if (!overlap.length) continue;
      risks.add({
        ruleId: "D2",
        ruleName: "同一场景被多个练习任务重复要求",
        category: "D",
        level: "medium",
        title: "练习场景重复安排",
        taskIds: [task.id, other.id],
        personIds: overlap,
        regionIds: regionsOf(task),
        reason: `「${task.title}」与「${other.title}」要求同一场景（${shared.join("、")}），${overlap.length} 人需要重复练习。`,
        evidence: [
          evidence(
            `同源内容：${shared.join("、")}`,
            `${taskRef(task, "内容资源")} / ${taskRef(other, "内容资源")}`,
          ),
          evidence(
            `${overlap.length} 人同时命中两项练习任务`,
            `员工 ${overlap.slice(0, 3).join("、")} · 任务时间轴`,
          ),
        ],
        suggestion: "合并为一个练习任务，或明确两次练习的递进目标。",
        impact: {
          text: `${overlap.length} 人可少做一项重复练习。`,
          affectedPeople: overlap.length,
          affectedRegions: regionsOf(task).length,
        },
        confirmation: ownerConfirmation(state, task),
        metrics: { overlap: overlap.length },
        ruleParams: { duplicatePractice: true },
        key: `${week}:D:D2:${[task.id, other.id].sort().join(":")}`,
      });
    }
  }

  for (const task of tasks) {
    if (task.kind !== "exam") continue;
    const contents = taskContentIds(task);
    const candidates = tasks.filter(
      (other) =>
        other.id !== task.id &&
        other.kind !== "exam" &&
        (task.relations.sameSourceTaskIds.includes(other.id) ||
          taskContentIds(other).some((id) => contents.includes(id))),
    );
    const before = candidates.filter((other) => other.startsOn <= task.startsOn);
    if (candidates.length && before.length) continue;
    if (task.status !== "active" && task.status !== "draft") continue;
    risks.add({
      ruleId: "D3",
      ruleName: "考试发布前缺少对应学习内容或练习任务",
      category: "D",
      level: "high",
      title: `${task.title}缺少前置学习`,
      taskIds: [task.id, ...candidates.map((item) => item.id)],
      personIds: taskAudienceIds(state, task) ?? [],
      regionIds: regionsOf(task),
      reason: candidates.length
        ? `考试「${task.title}」开始于 ${task.startsOn}，但同源学习任务「${candidates.map((item) => item.title).join("、")}」在考试之后才开始。`
        : `考试「${task.title}」没有任何同源学习或练习任务，员工将没有学习机会直接参加考试。`,
      evidence: [
        evidence(
          candidates.length
            ? candidates
                .map(
                  (item) =>
                    `${item.title} 开始 ${item.startsOn}（晚于考试开始 ${task.startsOn}）`,
                )
                .join("；")
            : "同源学习 / 练习任务：无",
          taskRef(task, "任务关系.同源内容"),
        ),
        evidence(
          `考试周期 ${task.startsOn} ~ ${task.endsOn}`,
          taskRef(task, "时间规则.起止时间"),
        ),
      ],
      suggestion: "先安排同源学习任务，再把考试截止时间排在学习结束之后。",
      impact: {
        text: `${taskAudienceIds(state, task)?.length ?? 0} 人在考试前可获得学习内容。`,
        affectedPeople: taskAudienceIds(state, task)?.length ?? 0,
        affectedRegions: regionsOf(task).length,
      },
      confirmation: ownerConfirmation(state, task),
      metrics: { candidates: candidates.length },
      ruleParams: { requirePrerequisite: true },
      key: `${week}:D:D3:${task.id}`,
    });
  }

  for (const task of tasks) {
    const issues: string[] = [];
    if (task.kind === "exam" && !task.resources.some((r) => r.type === "paper"))
      issues.push("考试任务未关联试卷资源");
    if (task.kind === "study" && task.resources.some((r) => r.type === "paper"))
      issues.push("学习任务关联了试卷资源");
    if (/(考试|考核)/.test(task.title) && task.kind !== "exam")
      issues.push("任务名称包含「考试/考核」但类型不是考试");
    if (!task.resources.length) issues.push("未关联任何内容资源");
    if (!issues.length) continue;
    risks.add({
      ruleId: "D5",
      ruleName: "任务名称、内容与类型不一致",
      category: "D",
      level: "low",
      title: `${task.title}配置不一致`,
      taskIds: [task.id],
      personIds: taskAudienceIds(state, task) ?? [],
      regionIds: regionsOf(task),
      reason: `${task.title}（${KIND_LABELS[task.kind]}）存在配置不一致：${issues.join("；")}。`,
      evidence: [
        evidence(
          `任务类型 ${KIND_LABELS[task.kind]}；内容资源 ${task.resources.map((r) => `${r.name}（${RESOURCE_LABELS[r.type]}）`).join("、") || "无"}`,
          taskRef(task, "类型 + 内容资源"),
        ),
      ],
      suggestion: "统一任务类型、名称与内容资源，避免员工误解任务要求。",
      impact: {
        text: "配置一致后提醒文案与考核方式不会产生歧义。",
        affectedPeople: taskAudienceIds(state, task)?.length ?? 0,
        affectedRegions: regionsOf(task).length,
      },
      confirmation: ownerConfirmation(state, task),
      metrics: { issues: issues.length },
      ruleParams: { consistency: true },
      key: `${week}:D:D5:${task.id}`,
    });
  }

  /* --------------------------------------------------- E 执行风险 */

  for (const task of tasks) {
    if (task.status !== "active" || task.results.returnedAt === null) continue;
    const idsForGap = taskAudienceIds(state, task) ?? [];
    const doneAvgForGap = idsForGap.length
      ? idsForGap.reduce(
          (sum, id) =>
            sum +
            Object.values(task.results.completed[id] ?? {}).reduce(
              (total, value) => total + value,
              0,
            ),
          0,
        ) / idsForGap.length
      : 0;
    if (structurallyInfeasible(task, today, policy, doneAvgForGap)) continue;
    const audienceIds = taskAudienceIds(state, task);
    if (!audienceIds || !audienceIds.length || !task.frequency) continue;
    const daysLeft = daysBetween(today, task.endsOn);
    const horizon = Math.ceil(policy.completionRiskHours / 24);
    if (daysLeft > horizon) continue;
    const windowDays = daysBetween(task.startsOn, task.endsOn) + 1;
    const periodsInWindow =
      task.frequency.unit === "daily"
        ? Math.max(1, windowDays)
        : task.frequency.unit === "once"
          ? 1
          : Math.max(1, Math.ceil(windowDays / 7));
    const required = task.targetCount ?? task.frequency.count * periodsInWindow;
    const feasible = Math.max(1, daysLeft + 1) * policy.requiredCountPerDay;
    const overdue = daysLeft < 0;
    const pending = audienceIds.filter((id) => {
      const done = Object.values(task.results.completed[id] ?? {}).reduce(
        (sum, value) => sum + value,
        0,
      );
      const remaining = required - done;
      if (remaining <= 0) return false;
      if (overdue) return true;
      if (task.frequency!.unit === "once")
        return daysLeft <= 1 && remaining > 0;
      return remaining > feasible;
    });
    if (!pending.length) continue;
    const ratio = pending.length / audienceIds.length;
    risks.add({
      ruleId: "E1",
      ruleName: overdue
        ? "任务已逾期仍有员工未达标"
        : "当前进度不足以在截止前达标",
      category: "E",
      level: overdue || ratio >= 0.5 ? "high" : "medium",
      title: overdue
        ? `${task.title}已逾期未完成`
        : `${task.title}未来 ${Math.max(1, daysLeft + 1)} 天完成风险`,
      taskIds: [task.id],
      personIds: pending,
      regionIds: regionsOf(task),
      reason: overdue
        ? `${task.title}已于 ${task.endsOn} 截止，${pending.length} / ${audienceIds.length} 人仍未完成 ${required} 次要求。`
        : `${task.title}将在 ${task.endsOn} 截止，${pending.length} / ${audienceIds.length} 人按当前进度无法在剩余 ${Math.max(1, daysLeft + 1)} 天完成。`,
      evidence: [
        evidence(
          `未完成 ${pending.length} / ${audienceIds.length} 人，例如 ${pending
            .slice(0, 3)
            .map((id) => personName(state, id))
            .join("、")}`,
          taskRef(task, "执行结果.完成回传"),
        ),
        evidence(
          `要求 ${required} 次，剩余可实现约 ${feasible} 次（每天 ${policy.requiredCountPerDay} 次）`,
          taskRef(task, "时间规则 + 达标次数"),
        ),
      ],
      suggestion: overdue
        ? "按例外流程处理逾期人员，或顺延截止时间并重新提醒。"
        : "优先提醒未完成人群，或按当前进度顺延截止时间。",
      impact: {
        text: `及时提醒可将完成率从 ${Math.round(((audienceIds.length - pending.length) / audienceIds.length) * 100)}% 提升至 90% 以上。`,
        affectedPeople: pending.length,
        affectedRegions: regionsOf(task).length,
      },
      confirmation: ownerConfirmation(state, task),
      metrics: {
        pending: pending.length,
        audience: audienceIds.length,
        required,
        feasible,
        hours: policy.completionRiskHours,
      },
      ruleParams: { completionRiskHours: policy.completionRiskHours },
      key: `${week}:E:E1:${task.id}`,
    });
  }

  for (const load of aggregates) {
    if (load.completionRate === null) continue;
    if (
      load.completionRate < policy.lowCompletionRate &&
      load.overCapacityIds.length > 0
    ) {
      risks.add({
        ruleId: "E2",
        ruleName: "完成率偏低且区域处于高负荷",
        category: "E",
        level: "medium",
        title: `${load.name}完成率偏低且负荷超容量`,
        taskIds: [
          ...new Set(
            load.people
              .filter((person) => load.overCapacityIds.includes(person.personId))
              .flatMap((person) => person.items.map((item) => item.taskId)),
          ),
        ],
        personIds: load.overCapacityIds,
        regionIds: [load.regionId],
        reason: `${load.name}本周完成率 ${Math.round(load.completionRate * 100)}%，同时 ${load.overCapacityIds.length} 人负荷超过容量，低完成可能由高负荷导致。`,
        evidence: [
          evidence(
            `完成率 ${Math.round(load.completionRate * 100)}%（阈值 ${Math.round(policy.lowCompletionRate * 100)}%）`,
            `区域「${load.name}」· 完成回传聚合`,
          ),
          evidence(
            `超容量员工 ${load.overCapacityIds.length} 人，人均 ${load.meanMinutes} 分钟 / 容量 ${load.capacityMinutes} 分钟`,
            `区域「${load.name}」· 本周负荷聚合`,
          ),
        ],
        suggestion: "先降低非必修任务负荷，再观察完成率，而不是直接催办员工。",
        impact: {
          text: `负荷下降后预计完成率回升至 ${Math.round(policy.lowCompletionRate * 100)}% 以上。`,
          affectedPeople: load.overCapacityIds.length,
          affectedRegions: 1,
        },
        confirmation: confirmationFor(
          state,
          state.regions.find((r) => r.id === load.regionId)!.ownerId,
          "区域负责人",
        ),
        hypothesis: "低完成率可能是高负荷造成，而非员工执行意愿问题。",
        metrics: {
          completionRate: Math.round(load.completionRate * 100),
          overCapacity: load.overCapacityIds.length,
        },
        ruleParams: { lowCompletionRate: policy.lowCompletionRate },
        key: `${week}:E:E2:${load.regionId}`,
      });
    }
  }

  const rated = aggregates.filter((load) => load.completionRate !== null);
  const best = rated.length
    ? Math.max(...rated.map((load) => load.completionRate ?? 0))
    : null;
  if (best !== null && best > 0) {
    for (const load of rated) {
      const rate = load.completionRate ?? 0;
      if (rate >= best * 0.7) continue;
      const regionTasks = tasks.filter((task) =>
        regionsOf(task).includes(load.regionId),
      );
      const missingPush = regionTasks.filter(
        (task) => task.publishedAt && !task.results.pushedAt,
      );
      risks.add({
        ruleId: "E3",
        ruleName: "区域完成率异常低，可能推送或人群策略未生效",
        category: "E",
        level: "medium",
        title: `${load.name}完成率明显低于其他区域`,
        taskIds: regionTasks.map((task) => task.id),
        personIds: load.people.slice(0, 8).map((person) => person.personId),
        regionIds: [load.regionId],
        reason: `${load.name}完成率 ${Math.round(rate * 100)}%，明显低于最好区域 ${Math.round(best * 100)}%，可能推送或人群策略未生效。`,
        evidence: [
          evidence(
            `完成率 ${Math.round(rate * 100)}% vs 最高区域 ${Math.round(best * 100)}%`,
            `区域「${load.name}」· 完成回传聚合`,
          ),
          evidence(
            missingPush.length
              ? `${missingPush.map((task) => task.title).join("、")} 缺少推送记录`
              : "推送记录已存在，需要核对人群策略与提醒设置",
            "执行结果.推送记录",
          ),
        ],
        suggestion: "核对推送记录与人群策略是否生效，必要时重新下发提醒。",
        impact: {
          text: `${load.headcount} 名员工重新收到提醒后完成率可恢复。`,
          affectedPeople: load.headcount,
          affectedRegions: 1,
        },
        confirmation: confirmationFor(
          state,
          state.regions.find((r) => r.id === load.regionId)!.ownerId,
          "区域负责人",
        ),
        hypothesis: "低完成率可能是推送或人群策略未生效，需要人工核实。",
        metrics: {
          rate: Math.round(rate * 100),
          best: Math.round(best * 100),
          missingPush: missingPush.length,
        },
        ruleParams: { regionGapRatio: policy.regionGapRatio },
        key: `${week}:E:E3:${load.regionId}`,
      });
    }
  }

  for (const task of tasks) {
    if (task.status !== "active" || !task.publishedAt) continue;
    const ownerMissing =
      !task.owners.hqOwnerId && !task.owners.regionOwnerId;
    const reminderMissing = !task.reminder || !task.reminder.enabled;
    if (!ownerMissing && !reminderMissing) continue;
    risks.add({
      ruleId: "E4",
      ruleName: "已发布任务缺少负责人或提醒策略",
      category: "E",
      level: ownerMissing ? "medium" : "low",
      title: ownerMissing
        ? `${task.title}缺少负责人`
        : `${task.title}缺少提醒策略`,
      taskIds: [task.id],
      personIds: taskAudienceIds(state, task) ?? [],
      regionIds: regionsOf(task),
      reason: ownerMissing
        ? `${task.title}已发布但没有总部或区域负责人，问题无法转交。`
        : `${task.title}已发布但没有启用提醒策略，员工可能错过截止时间。`,
      evidence: [
        evidence(
          `总部负责人：${task.owners.hqOwnerName || "未配置"}；区域负责人：${task.owners.regionOwnerName || "未配置"}`,
          taskRef(task, "负责人"),
        ),
        evidence(
          task.reminder
            ? `提醒：${task.reminder.enabled ? "已启用" : "未启用"}（提前 ${task.reminder.daysBefore} 天）`
            : "提醒：未配置",
          taskRef(task, "提醒策略"),
        ),
      ],
      suggestion: ownerMissing
        ? "补充任务负责人，再继续执行。"
        : "启用到期提醒（建议提前 1 天），减少临期未完成。",
      impact: {
        text: ownerMissing
          ? "补齐负责人后问题可转交到具体责任人。"
          : "启用提醒后通常可提升临期完成率。",
        affectedPeople: taskAudienceIds(state, task)?.length ?? 0,
        affectedRegions: regionsOf(task).length,
      },
      confirmation: ownerConfirmation(state, task),
      metrics: { ownerMissing: ownerMissing ? 1 : 0 },
      ruleParams: { requireReminder: true },
      key: `${week}:E:E4:${task.id}`,
    });
  }

  for (const task of tasks) {
    if (
      task.audience.snapshotVersion >= task.version ||
      task.audience.resolvedPersonIds === null
    )
      continue;
    risks.add({
      ruleId: "E5",
      ruleName: "任务修改后仍有员工处于旧版本",
      category: "E",
      level: "medium",
      title: `${task.title}改版后没有重新生成员工名单`,
      taskIds: [task.id],
      personIds: task.audience.resolvedPersonIds,
      regionIds: regionsOf(task),
      reason: `任务已经更新到第 ${task.version} 版，但下发的员工名单还是第 ${task.audience.snapshotVersion} 版时生成的${
        task.audience.expectedCount !== null &&
        task.audience.expectedCount !== task.audience.resolvedPersonIds.length
          ? `：按当前人群策略应命中 ${task.audience.expectedCount} 人，名单里仍是 ${task.audience.resolvedPersonIds.length} 人`
          : "，名单可能与最新的人群策略不一致"
      }。`,
      evidence: [
        evidence(
          `任务第 ${task.version} 版 / 员工名单由第 ${task.audience.snapshotVersion} 版生成`,
          taskRef(task, "版本 + 分发范围.员工名单"),
        ),
        ...(task.audience.expectedCount !== null
          ? [
              evidence(
                `人群策略「${task.audience.label}」应命中 ${task.audience.expectedCount} 人，名单实际 ${task.audience.resolvedPersonIds.length} 人`,
                taskRef(task, "分发范围.预期人数 vs 员工名单"),
              ),
            ]
          : []),
      ],
      suggestion: "按当前人群策略重新生成员工名单，确认后再下发，避免员工继续按旧名单执行。",
      impact: {
        text: `${task.audience.resolvedPersonIds.length} 人的分配范围需要重新确认。`,
        affectedPeople: task.audience.resolvedPersonIds.length,
        affectedRegions: regionsOf(task).length,
      },
      confirmation: ownerConfirmation(state, task),
      metrics: {
        taskVersion: task.version,
        snapshotVersion: task.audience.snapshotVersion,
      },
      ruleParams: { requireFreshSnapshot: true },
      key: `${week}:E:E5:${task.id}`,
    });
  }

  return risks.list();
}

export function evaluateRisks(
  state: InspectionState,
  weeks: string[],
  today = inspectionDay(),
): InspectionRisk[] {
  const unique = [...new Set(weeks)].filter(Boolean);
  return unique
    .flatMap((week) => evaluateWeek(state, week, today))
    .sort(compareRisks);
}

/* ----------------------------------------------- 巡检运行与状态机 */

/**
 * 同一批结论里可能出现同 key 的双向记录（例如 C3 同源重复：A→B 与 B→A 会算出同一个 key），
 * 渲染与计数前先按 key 去重，避免重复行和重复计数。
 */
export const uniqueRisks = (risks: InspectionRisk[]) =>
  [...new Map(risks.map((risk) => [risk.key, risk])).values()];

export const risksForTask = (risks: InspectionRisk[], taskId: string) =>
  risks.filter((risk) => risk.taskIds.includes(taskId));

export function activeException(
  state: InspectionState,
  riskKey: string,
  today = inspectionDay(),
) {
  return (
    state.exceptions.find(
      (exception) =>
        exception.riskKey === riskKey &&
        exception.status === "approved" &&
        exception.expiresOn >= today,
    ) ?? null
  );
}

export function pendingException(
  state: InspectionState,
  riskKey: string,
  today = inspectionDay(),
) {
  return (
    state.exceptions.find(
      (exception) =>
        exception.riskKey === riskKey &&
        exception.status === "pending" &&
        exception.expiresOn >= today,
    ) ?? null
  );
}

/** 重新巡检：把当前事实与风险台账对齐，保留历史、复发与例外状态。 */
export function runInspection(
  input: InspectionState,
  now = new Date(),
  extraWeeks: string[] = [],
  options: InspectionRunOptions = {},
): InspectionState {
  const state = structuredClone(input);
  const today = inspectionDay(now);
  const at = now.toISOString();
  if (!Array.isArray(state.inspectionRuns)) state.inspectionRuns = [];
  const previousLevels = new Map(
    state.risks.map((record) => [record.key, record.level]),
  );
  const weeks = [
    ...new Set([
      weekStart(today),
      addDays(weekStart(today), 7),
      ...extraWeeks.filter(Boolean),
      ...state.risks
        .filter((record) => record.status !== "已解决")
        .map((record) => record.week),
    ]),
  ];
  const risks = evaluateRisks(state, weeks, today);
  const byKey = new Map(risks.map((risk) => [risk.key, risk]));
  for (const risk of risks) {
    const approved = activeException(state, risk.key, today);
    const pending = pendingException(state, risk.key, today);
    const record = state.risks.find((item) => item.key === risk.key);
    if (!record) {
      state.risks.push({
        key: risk.key,
        ruleId: risk.ruleId,
        ruleName: risk.ruleName,
        title: risk.title,
        level: risk.level,
        status: approved ? "例外生效" : pending ? "需确认" : "待处理",
        firstSeenAt: at,
        lastSeenAt: at,
        resolvedAt: null,
        recurrence: 0,
        week: risk.week,
        taskIds: risk.taskIds,
        personIds: risk.personIds,
        regionIds: risk.regionIds,
        history: [
          {
            at,
            actor: "巡检 Agent",
            text: `规则 ${risk.ruleId}（${risk.ruleName}）命中；策略 v${state.policy.version}，数据 v${state.revision}。`,
          },
        ],
      });
      continue;
    }
    const reopened = record.status === "已解决";
    const dispositionTouched = state.dispositions.some(
      (disposition) =>
        risk.taskIds.includes(disposition.taskId) &&
        Date.parse(disposition.at) >= Date.parse(record.firstSeenAt),
    );
    let status: RiskStatus = approved
      ? "例外生效"
      : pending
        ? "需确认"
        : dispositionTouched
          ? "处理中"
          : "待处理";
    if (reopened) {
      status = approved ? "例外生效" : "待处理";
      record.recurrence += 1;
      record.resolvedAt = null;
      record.history.push({
        at,
        actor: "巡检 Agent",
        text: `相同问题再次出现（第 ${record.recurrence + 1} 次），重新开启。`,
      });
    }
    if (record.status !== status) {
      record.history.push({
        at,
        actor: "巡检 Agent",
        text: `状态更新：${record.status} → ${status}。`,
      });
      record.status = status;
    }
    record.level = risk.level;
    record.ruleName = risk.ruleName;
    record.title = risk.title;
    record.lastSeenAt = at;
    record.week = risk.week;
    record.taskIds = risk.taskIds;
    record.personIds = risk.personIds;
    record.regionIds = risk.regionIds;
  }
  for (const record of state.risks) {
    if (byKey.has(record.key)) continue;
    if (record.status === "已解决") continue;
    record.status = "已解决";
    record.resolvedAt = at;
    record.lastSeenAt = at;
    record.history.push({
      at,
      actor: "巡检 Agent",
      text: "重算后规则不再命中，问题关闭。",
    });
  }
  for (const exception of state.exceptions) {
    if (
      exception.status === "approved" &&
      exception.expiresOn < today &&
      byKey.has(exception.riskKey)
    ) {
      const record = state.risks.find((item) => item.key === exception.riskKey);
      if (record && record.status === "例外生效") {
        record.status = "待处理";
        record.history.push({
          at,
          actor: "巡检 Agent",
          text: `例外 ${exception.id} 已于 ${exception.expiresOn} 到期，恢复为待处理。`,
        });
      }
    }
  }
  state.lastRunAt = at;
  recordInspectionRun(state, {
    at,
    today,
    weeks,
    evaluated: risks,
    previousLevels,
    options,
  });
  return state;
}

/* -------------------------------------------------------------- 工作记录 */

/** 工作记录最多保留的批次数。 */
export const INSPECTION_RUN_LIMIT = 60;

const snapshotOf = (risks: InspectionRisk[]): InspectionRunSnapshot => ({
  high: risks.filter((risk) => risk.level === "high").length,
  medium: risks.filter((risk) => risk.level === "medium").length,
  low: risks.filter((risk) => risk.level === "low").length,
  insufficient: risks.filter((risk) => risk.level === "insufficient").length,
});

/** 把本次评估结果落到逐任务结论上。 */
const taskResultsOf = (
  risks: InspectionRisk[],
  taskIds: string[],
): InspectionRunTaskResult[] =>
  taskIds.map((taskId) => {
    const hit = risks
      .filter((risk) => risk.taskIds.includes(taskId))
      .sort(compareRisks);
    return {
      taskId,
      level: hit[0]?.level ?? null,
      ruleIds: [...new Set(hit.map((risk) => risk.ruleId))],
    };
  });

const sameTaskSet = (left: string[], right: string[]) =>
  left.length === right.length && right.every((id) => left.includes(id));

/** 这次巡检实际评估过的任务：停用与已合并任务不参与规则。 */
export const inspectedTaskIds = (state: InspectionState) =>
  state.tasks
    .filter((task) => task.status !== "disabled" && !task.mergedIntoId)
    .map((task) => task.id);

/**
 * 把一次巡检写入工作记录。
 * 结论没有变化时不新增条目，只把最近一条的 lastSeenAt 与 repeatCount 往前推；
 * 手动巡检、出现变化、覆盖任务变化或跨天时新增一条，最多保留 INSPECTION_RUN_LIMIT 条。
 */
function recordInspectionRun(
  state: InspectionState,
  {
    at,
    today,
    weeks,
    evaluated,
    previousLevels,
    options,
  }: {
    at: string;
    today: string;
    weeks: string[];
    evaluated: InspectionRisk[];
    previousLevels: Map<string, RiskLevel>;
    options: InspectionRunOptions;
  },
) {
  const trigger = options.record ?? "auto";
  if (trigger === "none") return;

  const taskIds = inspectedTaskIds(state);
  // 同一个问题可能同时命中本周与下周，工作记录只保留一条，避免同一条结论重复汇报。
  const dedupe = <T extends { ruleId: string; title: string }>(list: T[]) => {
    const seen = new Set<string>();
    return list.filter((item) => {
      const signature = `${item.ruleId}|${item.title}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  };
  const added: InspectionRunChange[] = dedupe(
    evaluated
      .filter((risk) => !previousLevels.has(risk.key))
      .map((risk) => ({
        key: risk.key,
        ruleId: risk.ruleId,
        ruleName: risk.ruleName,
        level: risk.level,
        title: risk.title,
        taskIds: risk.taskIds,
      })),
  );
  const levelChanged = dedupe(
    evaluated
      .filter(
        (risk) =>
          previousLevels.has(risk.key) &&
          previousLevels.get(risk.key) !== risk.level,
      )
      .map((risk) => ({
        key: risk.key,
        ruleId: risk.ruleId,
        title: risk.title,
        from: previousLevels.get(risk.key)!,
        to: risk.level,
      })),
  );
  const resolved: InspectionRunChange[] = dedupe(
    state.risks
      .filter((record) => record.status === "已解决" && record.resolvedAt === at)
      .map((record) => ({
        key: record.key,
        ruleId: record.ruleId,
        ruleName: record.ruleName ?? record.ruleId,
        level: record.level,
        title: record.title ?? record.ruleId,
        taskIds: record.taskIds,
      })),
  );

  const last = state.inspectionRuns.at(-1);
  const changed = added.length + resolved.length + levelChanged.length > 0;
  const coverageChanged = !last || !sameTaskSet(last.taskIds, taskIds);
  const crossedDay = !last || inspectionDay(new Date(last.at)) !== today;
  if (trigger === "auto" && !changed && !coverageChanged && !crossedDay && last) {
    last.lastSeenAt = at;
    last.repeatCount += 1;
    return;
  }

  const record: InspectionRunRecord = {
    id: `run-${at}-${state.inspectionRuns.length}`,
    at,
    lastSeenAt: at,
    repeatCount: 1,
    trigger,
    weeks: [...weeks],
    taskIds,
    taskCount: taskIds.length,
    dataGapTaskCount: state.tasks.filter(
      (task) =>
        task.status !== "disabled" &&
        !task.mergedIntoId &&
        missingFields(task).length > 0,
    ).length,
    snapshot: snapshotOf(evaluated),
    taskResults: taskResultsOf(evaluated, taskIds),
    added,
    resolved,
    levelChanged,
    actorName: options.actorName ?? "巡检 Agent",
    roleLabel: options.roleLabel ?? "自动巡检",
  };
  state.inspectionRuns = [...state.inspectionRuns, record].slice(
    -INSPECTION_RUN_LIMIT,
  );
}

/* ------------------------------------------------------- 发布前模拟 */

const audienceRegionIds = (state: InspectionState, task: InspectionTask) =>
  task.audience.regionIds.length
    ? task.audience.regionIds
    : state.regions.map((region) => region.id);

function loadStats(
  state: InspectionState,
  task: InspectionTask,
  weeks: string[],
  today: string,
) {
  const regionIds = audienceRegionIds(state, task);
  const rows = regionIds.map((regionId) => {
    const perWeek = weeks.map((week) =>
      personAggregates(state, week, today, [regionId]),
    );
    const people = perWeek[0] ?? [];
    const values = people
      .filter((person) => person.unknownTaskCount === 0)
      .map((person) =>
        perWeek.reduce((sum, list) => {
          const match = list.find((item) => item.personId === person.personId);
          return sum + (match?.plannedMinutes ?? 0);
        }, 0) / perWeek.length,
      );
    return {
      regionId,
      people,
      values,
      mean: values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0,
      audience: people.filter((person) =>
        taskAudienceIds(state, task)?.includes(person.personId),
      ).length,
      over: values.filter(
        (value) =>
          value >
          (state.regions.find((region) => region.id === regionId)
            ?.capacityMinutes ?? state.policy.weeklyCapacityMinutes),
      ).length,
    };
  });
  const allValues = rows.flatMap((row) => row.values);
  const peaks = weeks.flatMap((week) =>
    regionIds.flatMap((regionId) =>
      personAggregates(state, week, today, [regionId]).map(
        (person) => person.dailyPeak,
      ),
    ),
  );
  return {
    rows,
    mean: allValues.length
      ? allValues.reduce((sum, value) => sum + value, 0) / allValues.length
      : 0,
    p90: percentile(allValues, 0.9),
    max: allValues.length ? Math.max(...allValues) : 0,
    peak: peaks.length ? Math.max(...peaks) : 0,
    audience: rows.reduce((sum, row) => sum + row.audience, 0),
  };
}

export function applyTaskPatch(
  task: InspectionTask,
  patch: TaskPatch,
): InspectionTask {
  const next: InspectionTask = structuredClone(task);
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.weight !== undefined) next.weight = patch.weight;
  if (patch.startsOn !== undefined) next.startsOn = patch.startsOn;
  if (patch.endsOn !== undefined) next.endsOn = patch.endsOn;
  if (patch.frequency !== undefined) next.frequency = patch.frequency;
  if (patch.additionalMinutes !== undefined)
    next.additionalMinutes = patch.additionalMinutes;
  if (patch.resources !== undefined) next.resources = patch.resources;
  if (patch.minutes !== undefined) {
    if (patch.minutes === null) {
      next.resources = next.resources.map((resource) => ({
        ...resource,
        minutes: null,
      }));
    } else {
      if (!next.resources.length)
        next.resources = [
          { id: `${task.id}-content`, name: task.title, type: "courseware", minutes: patch.minutes },
        ];
      else {
        const total = next.resources.reduce(
          (sum, resource) => sum + (resource.minutes ?? 0),
          0,
        );
        const base = next.resources.filter((resource) => resource.minutes !== null);
        if (!base.length || total === 0) {
          next.resources = next.resources.map((resource, index) => ({
            ...resource,
            minutes: index === 0 ? patch.minutes : 0,
          }));
        } else {
          let assigned = 0;
          next.resources = next.resources.map((resource, index) => {
            if (resource.minutes === null) return resource;
            const isLast = index === next.resources.length - 1;
            const value = isLast
              ? Math.max(0, patch.minutes! - assigned)
              : Math.round((resource.minutes / total) * patch.minutes!);
            assigned += value;
            return { ...resource, minutes: value };
          });
        }
      }
    }
  }
  if (patch.audience) {
    next.audience = { ...next.audience, ...patch.audience };
    if (!next.audience.resolvedPersonIds) next.audience.resolvedAt = null;
  }
  if (patch.owners) next.owners = { ...next.owners, ...patch.owners };
  if (patch.reminder !== undefined) next.reminder = patch.reminder;
  return next;
}

export function validateTask(state: InspectionState, task: InspectionTask) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.startsOn))
    throw new Error("开始日期格式不正确");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.endsOn))
    throw new Error("截止日期格式不正确");
  if (task.endsOn < task.startsOn) throw new Error("截止日期不能早于开始日期");
  const minutes = taskOccurrenceMinutes(task);
  if (minutes !== null && (minutes <= 0 || minutes > 1440))
    throw new Error("单次预计时长需要在 1 ~ 1440 分钟之间");
  if (
    task.frequency &&
    (!Number.isInteger(task.frequency.count) ||
      task.frequency.count < 1 ||
      task.frequency.count > 100)
  )
    throw new Error("频次需要填写 1 ~ 100 的整数次数");
  if (
    task.audience.resolvedPersonIds?.some(
      (id) => !state.people.some((person) => person.id === id && person.active),
    )
  )
    throw new Error("目标人群包含已离职或不存在的人员");
  return task;
}

export function simulateTaskChange(
  state: InspectionState,
  taskId: string,
  patch: TaskPatch,
  options: { weeks?: string[]; today?: string } = {},
): SimulationResult {
  const today = options.today ?? inspectionDay();
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("任务不存在");
  const weeks = options.weeks ?? [weekStart(today)];
  const draft = applyTaskPatch(task, patch);
  const nextState = structuredClone(state);
  nextState.tasks = nextState.tasks.map((item) =>
    item.id === taskId ? draft : item,
  );
  const before = loadStats(state, task, weeks, today);
  const after = loadStats(nextState, draft, weeks, today);
  const filter = (risks: InspectionRisk[]) =>
    risks.filter(
      (risk) =>
        risk.taskIds.includes(taskId) ||
        (risk.taskIds.length === 0 &&
          risk.regionIds.some((id) =>
            audienceRegionIds(state, task).includes(id),
          )),
    );
  const beforeRisks = filter(evaluateRisks(state, weeks, today));
  const afterRisks = filter(evaluateRisks(nextState, weeks, today));
  const afterKeys = new Map(afterRisks.map((risk) => [risk.key, risk]));
  const beforeKeys = new Map(beforeRisks.map((risk) => [risk.key, risk]));
  const resolved = beforeRisks.filter((risk) => !afterKeys.has(risk.key));
  const added = afterRisks.filter((risk) => !beforeKeys.has(risk.key));
  const levelChanged = beforeRisks
    .filter(
      (risk) =>
        afterKeys.has(risk.key) &&
        afterKeys.get(risk.key)!.level !== risk.level,
    )
    .map((risk) => ({
      key: risk.key,
      title: risk.title,
      from: risk.level,
      to: afterKeys.get(risk.key)!.level,
    }));
  const highBefore = beforeRisks.filter((risk) => risk.level === "high").length;
  const highAfter = afterRisks.filter((risk) => risk.level === "high").length;
  const reasons: string[] = [];
  if (after.audience !== before.audience)
    reasons.push(`受影响人数 ${before.audience} → ${after.audience} 人`);
  if (round(after.mean) !== round(before.mean))
    reasons.push(
      `区域人均预计分钟 ${round(before.mean)} → ${round(after.mean)} 分钟`,
    );
  if (round(after.peak) !== round(before.peak))
    reasons.push(`单日峰值 ${round(before.peak)} → ${round(after.peak)} 分钟`);
  for (const risk of resolved)
    reasons.push(`规则 ${risk.ruleId}「${risk.ruleName}」不再命中`);
  for (const risk of added)
    reasons.push(`新增命中 ${risk.ruleId}「${risk.ruleName}」`);
  for (const change of levelChanged)
    reasons.push(
      `「${change.title}」风险等级 ${LEVEL_LABELS[change.from]} → ${LEVEL_LABELS[change.to]}`,
    );
  if (!reasons.length) reasons.push("风险结论与负荷未发生变化");
  const summary = `受影响人数 ${before.audience} → ${after.audience}；区域人均 ${round(before.mean)} → ${round(after.mean)} 分钟；高风险 ${highBefore} → ${highAfter} 项。`;
  return {
    taskId,
    peopleBefore: before.audience,
    peopleAfter: after.audience,
    meanBefore: round(before.mean),
    meanAfter: round(after.mean),
    p90Before: round(before.p90),
    p90After: round(after.p90),
    maxBefore: round(before.max),
    maxAfter: round(after.max),
    peakBefore: round(before.peak),
    peakAfter: round(after.peak),
    rows: before.rows.map((row) => {
      const target = after.rows.find((item) => item.regionId === row.regionId);
      return {
        regionId: row.regionId,
        name: regionName(state, row.regionId),
        peopleBefore: row.audience,
        peopleAfter: target?.audience ?? 0,
        meanBefore: round(row.mean),
        meanAfter: round(target?.mean ?? 0),
        overBefore: row.over,
        overAfter: target?.over ?? 0,
      };
    }),
    resolved,
    added,
    levelChanged,
    summary,
    reasons,
  };
}

/* ------------------------------------------------- 处置动作与复查记录 */

export function describePatch(
  before: InspectionTask,
  after: InspectionTask,
): Record<string, { from: string; to: string }> {
  const statusLabels: Record<string, string> = {
    draft: "草稿",
    active: "执行中",
    paused: "已暂停",
    disabled: "已停用",
  };
  const diff: Record<string, { from: string; to: string }> = {};
  const compare = (key: string, from: string, to: string) => {
    if (from !== to) diff[key] = { from, to };
  };
  compare("任务名称", before.title, after.title);
  compare(
    "状态",
    statusLabels[before.status] ?? before.status,
    statusLabels[after.status] ?? after.status,
  );
  compare(
    "任务权重",
    before.weight ? WEIGHT_LABELS[before.weight] : "未标注",
    after.weight ? WEIGHT_LABELS[after.weight] : "未标注",
  );
  compare(
    "有效周期",
    `${before.startsOn} ~ ${before.endsOn}`,
    `${after.startsOn} ~ ${after.endsOn}`,
  );
  compare("频次", frequencyText(before), frequencyText(after));
  compare(
    "单次预计时长",
    `${taskOccurrenceMinutes(before) ?? "缺失"} 分钟`,
    `${taskOccurrenceMinutes(after) ?? "缺失"} 分钟`,
  );
  compare(
    "目标人群",
    `${before.audience.label}（${before.audience.resolvedPersonIds?.length ?? 0} 人）`,
    `${after.audience.label}（${after.audience.resolvedPersonIds?.length ?? 0} 人）`,
  );
  compare(
    "负责人",
    `${before.owners.hqOwnerName || "未配置"} / ${before.owners.regionOwnerName || "未配置"}`,
    `${after.owners.hqOwnerName || "未配置"} / ${after.owners.regionOwnerName || "未配置"}`,
  );
  compare(
    "提醒策略",
    before.reminder?.enabled ? `启用（提前 ${before.reminder.daysBefore} 天）` : "未启用",
    after.reminder?.enabled ? `启用（提前 ${after.reminder.daysBefore} 天）` : "未启用",
  );
  if (before.mergedIntoId !== after.mergedIntoId)
    compare(
      "重复任务合并",
      before.mergedIntoId ?? "未合并",
      after.mergedIntoId ?? "未合并",
    );
  return diff;
}

export function applyDisposition(
  state: InspectionState,
  actor: InspectionActor,
  input: DispositionInput,
): InspectionState {
  if (actor.readOnly) throw new Error("当前角色为只读，不能提交处置动作");
  const task = state.tasks.find((item) => item.id === input.taskId);
  if (!task) throw new Error("任务不存在");
  if (task.origin !== "demo")
    throw new Error("外部接入任务需要先在原任务页补齐数据契约");
  if (!input.reason.trim()) throw new Error("请填写调整原因，处置记录需要留存");
  const exceptionOnly =
    input.action === "mark-exception" || input.action === "handover";
  if (!exceptionOnly && !canActOnTask(actor, task))
    throw new Error("当前角色只能处置本区域任务，总部任务请转交负责人");
  if (exceptionOnly && !canSeeTask(actor, task))
    throw new Error("当前角色没有该任务的权限");
  const today = inspectionDay();
  const at = new Date().toISOString();
  const next = structuredClone(state);
  const target = next.tasks.find((item) => item.id === task.id)!;
  const before = structuredClone(target);
  let exceptionId: string | null = null;
  let handoverTo: RiskConfirmation | null = input.handoverTo ?? null;
  if (input.action === "mark-exception") {
    if (!input.exception) throw new Error("请填写例外到期日");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.exception.expiresOn))
      throw new Error("请选择有效的例外到期日");
    if (input.exception.expiresOn < today)
      throw new Error("例外到期日不能早于今天");
    const existing = next.exceptions.find(
      (exception) =>
        exception.riskKey === input.exception!.riskKey &&
        exception.status !== "rejected",
    );
    if (existing) throw new Error("该风险已有例外记录，无需重复申请");
    const id = `EX-${next.exceptions.length + 1001}`;
    next.exceptions.push({
      id,
      riskKey: input.exception.riskKey,
      taskId: task.id,
      ruleId: input.exception.ruleId,
      reason: input.reason.trim(),
      requestedBy: actor.name,
      requestedAt: at,
      status: canApproveException(actor) ? "approved" : "pending",
      approvedBy: canApproveException(actor) ? actor.name : null,
      approvedAt: canApproveException(actor) ? at : null,
      expiresOn: input.exception.expiresOn,
      decisionNote: input.exception.decisionNote ?? "",
    });
    exceptionId = id;
  } else {
    const patched = applyTaskPatch(target, input.patch);
    validateTask(next, patched);
    patched.version = before.version + 1;
    // 处置动作由负责人确认，员工名单随新版本同步，避免把本次调整误判为旧名单。
    patched.audience.snapshotVersion = patched.version;
    next.tasks = next.tasks.map((item) =>
      item.id === target.id ? patched : item,
    );
    if (input.action === "merge-duplicates" && input.mergeTaskIds?.length) {
      next.tasks = next.tasks.map((item) =>
        input.mergeTaskIds!.includes(item.id)
          ? { ...item, mergedIntoId: patched.id, status: "paused", version: item.version + 1 }
          : item,
      );
    }
  }
  next.revision += 1;
  const week = weekStart(today);
  const weeks = [week, addDays(week, 7), weekStart(before.endsOn)];
  const beforeRisks = evaluateRisks(state, weeks, today).filter((risk) =>
    risk.taskIds.includes(task.id),
  );
  const afterRisks = evaluateRisks(next, weeks, today).filter((risk) =>
    risk.taskIds.includes(task.id),
  );
  const afterKeys = new Set(afterRisks.map((risk) => risk.key));
  const beforeKeys = new Set(beforeRisks.map((risk) => risk.key));
  const resolvedRules = beforeRisks
    .filter((risk) => !afterKeys.has(risk.key))
    .map((risk) => risk.ruleId);
  const remainingRules = afterRisks
    .filter((risk) => beforeKeys.has(risk.key))
    .map((risk) => risk.ruleId);
  const addedRules = afterRisks
    .filter((risk) => !beforeKeys.has(risk.key))
    .map((risk) => risk.ruleId);
  const patchDiff = describePatch(
    before,
    next.tasks.find((item) => item.id === task.id)!,
  );
  if (input.action === "merge-duplicates" && input.mergeTaskIds?.length)
    patchDiff["合并的重复任务"] = {
      from: input.mergeTaskIds.join("、"),
      to: `合并到「${before.title}」并暂停`,
    };
  const record: DispositionRecord = {
    id: `DP-${next.dispositions.length + 1001}`,
    at,
    action: input.action,
    actorId: actor.id,
    actorName: actor.name,
    taskId: task.id,
    taskTitle: before.title,
    taskVersionBefore: before.version,
    taskVersionAfter:
      next.tasks.find((item) => item.id === task.id)?.version ?? before.version,
    reason: input.reason.trim(),
    patch: patchDiff,
    expectedImpact:
      input.expectedImpact ??
      simulateTaskChange(state, task.id, input.patch, { weeks: [week], today })
        .summary,
    recheck: {
      at,
      resolvedRules,
      remainingRules,
      addedRules,
      summary: resolvedRules.length
        ? `重新巡检：${resolvedRules.length} 条规则不再命中${remainingRules.length ? `；${remainingRules.length} 条规则仍需处理` : ""}。`
        : addedRules.length
          ? `重新巡检：新增 ${addedRules.join("、")}，需要继续调整。`
          : "重新巡检：规则仍然命中，问题保持开启。",
    },
    handoverTo,
    exceptionId,
  };
  next.dispositions.push(record);
  return runInspection(next, new Date(), weeks, {
    record: "auto",
    actorName: actor.name,
    roleLabel: actor.roleLabel,
  });
}

/* ------------------------------------------------------- 总览聚合 */

export interface OverviewSummary {
  high: number;
  medium: number;
  low: number;
  insufficient: number;
  confirmNeeded: number;
  pendingExceptions: number;
  affectedPeople: number;
  affectedRegions: number;
  affectedStores: number;
  totalMinutes: number;
  headcount: number;
  meanMinutes: number;
  p90Minutes: number;
  dailyPeak: number;
  peakDay: string | null;
  conflicts: number;
  lowCompletionTasks: number;
  lowCompletionPeople: number;
  completeTasks: number;
  totalTasks: number;
  completenessRate: number;
  missingGroups: { field: string; tasks: number }[];
  sourceTasks: number;
}

export function overviewSummary(
  state: InspectionState,
  week: string,
  today = inspectionDay(),
): OverviewSummary {
  const risks = evaluateRisks(state, [week], today);
  const open = risks.filter((risk) => {
    const record = state.risks.find((item) => item.key === risk.key);
    return !record || record.status !== "已解决";
  });
  const levelCount = (level: RiskLevel) =>
    open.filter((risk) => risk.level === level).length;
  const people = new Set(open.flatMap((risk) => risk.personIds));
  const regions = new Set(open.flatMap((risk) => risk.regionIds));
  const stores = new Set(
    [...people]
      .map((id) => state.people.find((person) => person.id === id)?.storeId)
      .filter(Boolean) as string[],
  );
  const aggregates = regionAggregates(state, week, today);
  const allPeople = aggregates.flatMap((region) => region.people);
  const totalMinutes = allPeople.reduce(
    (sum, person) => sum + person.plannedMinutes,
    0,
  );
  const peakPerson = [...allPeople].sort((a, b) => b.dailyPeak - a.dailyPeak)[0];
  const conflictRules = ["B3", "D2", "C3", "A4"];
  const conflicts = open.filter((risk) =>
    conflictRules.includes(risk.ruleId),
  ).length;
  const lowCompletion = open.filter((risk) => risk.ruleId === "E1");
  const tasks = state.tasks.filter((task) => task.status !== "disabled");
  const complete = tasks.filter((task) => missingFields(task).length === 0);
  const groups = new Map<string, number>();
  for (const task of tasks)
    for (const gap of missingFields(task))
      groups.set(gap.field, (groups.get(gap.field) ?? 0) + 1);
  return {
    high: levelCount("high"),
    medium: levelCount("medium"),
    low: levelCount("low"),
    insufficient: levelCount("insufficient"),
    confirmNeeded:
      levelCount("medium") +
      levelCount("low") +
      state.exceptions.filter((exception) => exception.status === "pending").length,
    pendingExceptions: state.exceptions.filter(
      (exception) => exception.status === "pending",
    ).length,
    affectedPeople: people.size,
    affectedRegions: regions.size,
    affectedStores: stores.size,
    totalMinutes: round(totalMinutes),
    headcount: allPeople.length,
    meanMinutes: allPeople.length ? round(totalMinutes / allPeople.length) : 0,
    p90Minutes: percentile(
      allPeople.map((person) => person.plannedMinutes),
      0.9,
    ),
    dailyPeak: peakPerson?.dailyPeak ?? 0,
    peakDay: peakPerson?.peakDay ?? null,
    conflicts,
    lowCompletionTasks: lowCompletion.length,
    lowCompletionPeople: new Set(lowCompletion.flatMap((risk) => risk.personIds))
      .size,
    completeTasks: complete.length,
    totalTasks: tasks.length,
    completenessRate: tasks.length ? complete.length / tasks.length : 1,
    missingGroups: [...groups.entries()]
      .map(([field, count]) => ({ field, tasks: count }))
      .sort((a, b) => b.tasks - a.tasks),
    sourceTasks: state.tasks.filter((task) => task.origin === "source").length,
  };
}

/** 某个任务当前的最高风险等级，用于列表排序与徽标。 */
export function taskRiskLevel(
  state: InspectionState,
  taskId: string,
  week: string,
  today = inspectionDay(),
): RiskLevel | null {
  const risks = risksForTask(evaluateRisks(state, [week], today), taskId);
  if (!risks.length) return null;
  return risks.reduce<RiskLevel>(
    (worst, risk) =>
      levelRank[risk.level] < levelRank[worst] ? risk.level : worst,
    "insufficient",
  );
}

/** 总部审批区域提交的例外申请。 */
export function decideException(
  state: InspectionState,
  actor: InspectionActor,
  exceptionId: string,
  approve: boolean,
  note: string,
): InspectionState {
  if (!canApproveException(actor))
    throw new Error("只有总部角色可以审批例外申请");
  const exception = state.exceptions.find((item) => item.id === exceptionId);
  if (!exception) throw new Error("例外记录不存在");
  if (exception.status !== "pending") throw new Error("该例外申请已处理");
  const next = structuredClone(state);
  const target = next.exceptions.find((item) => item.id === exceptionId)!;
  target.status = approve ? "approved" : "rejected";
  target.approvedBy = actor.name;
  target.approvedAt = new Date().toISOString();
  target.decisionNote = note.trim();
  next.revision += 1;
  const risk = next.risks.find((record) => record.key === target.riskKey);
  if (risk)
    risk.history.push({
      at: new Date().toISOString(),
      actor: actor.name,
      text: `${approve ? "批准" : "驳回"}例外 ${target.id}：${note.trim() || "无补充说明"}`,
    });
  return runInspection(next, new Date(), [], {
    record: "auto",
    actorName: actor.name,
    roleLabel: actor.roleLabel,
  });
}
