/**
 * 数据审计 Agent（Supervisor 工作台）· 工具层
 *
 * 对齐《Supervisor 已确定设计》：
 * - Agent 不直连业务库，只能通过白名单工具取数；工具分两类，
 *   `adm` 走 ADM 权限与数据工具，`supervisor` 是本地确定性计算。
 * - 每次工具调用都要带权限码、查询范围、traceId、数据来源与耗时。
 * - 审计规则由确定性代码执行，Agent 只负责理解问题、补齐条件与组织表达。
 * - Agent 不修改培训任务、人员、组织与成绩；只写独立的审计/审计记录。
 *
 * 本文件是纯函数层：不依赖 React、不写状态，UI 只把调用过程演出来。
 */
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  InspectionTask,
  RiskLevel,
  TaskKind,
} from "./inspectionTypes";
import {
  addDays,
  KIND_LABELS,
  LEVEL_LABELS,
  canSeeTask,
  evaluateRisks,
  inspectionDay,
  missingFields,
  regionAggregates,
  taskOccurrenceMinutes,
  uniqueRisks,
  weekStart,
} from "./inspectionEngine";
import { regionBurden, visibleRegionIds } from "./inspectionBurden";
import { auditView, originalTaskId, scheduledIn } from "./auditHistory";

/* ------------------------------------------------------------------ 类型 */

export type AuditToolId =
  | "query_scope"
  | "check_data_gaps"
  | "query_training_overview"
  | "query_region_comparison"
  | "query_product_stats"
  | "query_learning_completion"
  | "run_inspection_rules"
  | "save_inspection_record"
  | "save_schedule";

/** 工具归属：adm = ADM 数据工具；supervisor = 本地确定性计算。 */
export type AuditToolOwner = "adm" | "supervisor";

export type AuditFocus =
  | "all"
  | "workload"
  | "completion"
  | "datagaps"
  | "duplicate"
  | "coverage";

/** 异常三类：系统问题、权限问题、业务数据问题。 */
export interface AuditError {
  code: string;
  kind: "system" | "permission" | "data";
  userMessage: string;
  modelMessage: string;
  retryable: boolean;
  needUserInput: boolean;
}

export interface AuditFact {
  label: string;
  value: string;
  hint?: string;
}

export interface AuditTable {
  columns: string[];
  rows: string[][];
}

/** 工具返回：一行结论 + 指标 + 明细表 + 口径 + 数据来源。 */
export interface AuditToolOutput {
  headline: string;
  facts: AuditFact[];
  table?: AuditTable;
  /** 口径说明：数字是怎么算出来的。 */
  notes: string[];
  /** 数据来源：结论引用了哪些表 / 字段。 */
  sources: string[];
  scanned: string;
  ms: number;
  traceId: string;
  /** 只在不成功时出现。 */
  error?: AuditError;
}

export interface AuditToolSpec {
  id: AuditToolId;
  /** 工具名，界面用等宽字体展示，便于对照后端实现。 */
  name: string;
  title: string;
  desc: string;
  owner: AuditToolOwner;
  /** ADM 权限码；supervisor 侧工具用本地规则标识。 */
  permission: string;
  /** 本次调用的实参。 */
  params: { label: string; value: string }[];
}

export interface AuditContext {
  /** 审计周期（周一起算），最后一个是最新周期。 */
  weeks: string[];
  /** 最新周期，工时与区域对比按这一周统计。 */
  week: string;
  today: string;
  actor: InspectionActor;
  /** 账号可见区域。 */
  regionIds: string[];
  /** 「全国」「雅加达南区」这类可读范围。 */
  scopeLabel: string;
  /** 关注品类；空数组表示全部品类。 */
  categories: string[];
  /** 关注方面。 */
  focus: AuditFocus;
}

export interface AuditFinding {
  level: RiskLevel;
  ruleId: string;
  title: string;
  detail: string;
  evidence: string;
  source: string;
  taskIds: string[];
}

export interface AuditReport {
  id: string;
  title: string;
  verdict: "阻断" | "需关注" | "提示优化" | "通过";
  summary: string;
  metrics: AuditFact[];
  findings: AuditFinding[];
  actions: string[];
  scope: string;
  /** 报告引用的数据来源与口径。 */
  sources: string[];
  ruleVersion: string;
}

export interface AuditPlan {
  id: string;
  question: string;
  intro: string;
  steps: AuditToolId[];
  followUps: string[];
}

/* ------------------------------------------------------------ 工具元数据 */

export const AUDIT_TOOL_LIST: {
  id: AuditToolId;
  name: string;
  title: string;
  desc: string;
  owner: AuditToolOwner;
  permission: string;
}[] = [
  {
    id: "query_scope",
    name: "query_scope",
    title: "查询地区、产品与组织范围",
    desc: "取当前账号可见的地区、门店、品类与在岗人员，用于确认问题条件与查询边界。",
    owner: "adm",
    permission: "supervisor:scope:read",
  },
  {
    id: "check_data_gaps",
    name: "check_data_gaps",
    title: "检查数据是否缺失",
    desc: "逐任务核对预计时长、逐人分配、频次、负责人、版本、推送与回传记录。",
    owner: "adm",
    permission: "supervisor:data-quality:read",
  },
  {
    id: "query_training_overview",
    name: "query_training_overview",
    title: "查询培训概览",
    desc: "按周期取学习 / 练习 / 考试 / 媒体采集任务的范围、覆盖人数与工时概览。",
    owner: "adm",
    permission: "supervisor:training-overview:read",
  },
  {
    id: "query_region_comparison",
    name: "query_region_comparison",
    title: "查询区域对比",
    desc: "对比各区域人均分钟、超容量人数、完成率与任务数，找出显著偏离的区域。",
    owner: "adm",
    permission: "supervisor:region-comparison:read",
  },
  {
    id: "query_product_stats",
    name: "query_product_stats",
    title: "查询产品与品类统计",
    desc: "按品类汇总任务数、覆盖区域与命中问题，发现只在部分区域上线的品类。",
    owner: "adm",
    permission: "supervisor:product-stats:read",
  },
  {
    id: "query_learning_completion",
    name: "query_learning_completion",
    title: "查询学习与考试完成情况",
    desc: "取学习、练习与考试的完成率、逾期率与考试成绩，判断执行风险。",
    owner: "adm",
    permission: "supervisor:completion:read",
  },
  {
    id: "run_inspection_rules",
    name: "run_inspection_rules",
    title: "执行审计规则",
    desc: "跑 A–G 七类确定性审计规则，输出规则编号、等级、命中对象与阈值参数。",
    owner: "supervisor",
    permission: "rule-set:v1",
  },
  {
    id: "save_inspection_record",
    name: "save_inspection_record",
    title: "保存独立审计记录",
    desc: "把本次结论、证据、规则版本与查询范围保存为独立记录；不修改培训任务。",
    owner: "adm",
    permission: "supervisor:record:write",
  },
  {
    id: "save_schedule",
    name: "save_schedule",
    title: "保存定时报告条件",
    desc: "保存结构化审计条件（地区、品类、指标、时间、规则），由 ADM 定时触发。",
    owner: "adm",
    permission: "supervisor:schedule:write",
  },
];

/* -------------------------------------------------------------- 小工具 */

const hash = (text: string) => {
  let value = 0;
  for (let index = 0; index < text.length; index += 1)
    value = (value * 31 + text.charCodeAt(index)) % 99991;
  return value;
};

const hex = (text: string) => hash(text).toString(16).padStart(4, "0");

/** 耗时为确定性伪随机，保证同一份数据每次演示观感一致。 */
const durationOf = (id: string, seed: number) => 130 + (hash(`${id}:${seed}`) % 680);

const KIND_ORDER: TaskKind[] = ["study", "practice", "exam", "media"];

const ratio = (value: number) => `${Math.round(value * 100)}%`;

const minutesText = (minutes: number) => `${Math.round(minutes)} 分钟`;

const hoursText = (minutes: number) => {
  const hours = minutes / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1).replace(/\.0$/, "")} 小时`;
};

export const WEEK_LABEL = (week: string) => `${week.slice(5).replace("-", "/")} 起 7 天`;

/** 手动单独跑一个工具时，用这句说明用户意图。 */
export const manualToolQuestion = (id: AuditToolId) => `单独执行工具 ${id}`;

/* ---------------------------------------------------------- 审计范围缓存 */

let riskCache: { key: string; value: InspectionRisk[] } | null = null;
const burdenCache = new Map<string, ReturnType<typeof regionBurden>>();

export const FOCUS_LABELS: Record<AuditFocus, string> = {
  all: "全部方面",
  workload: "工时与负荷",
  completion: "完成与考试",
  datagaps: "数据完整度",
  duplicate: "重复布置",
  coverage: "品类覆盖",
};

export function auditContext(
  state: InspectionState,
  actor: InspectionActor,
  week: string,
  today = inspectionDay(),
): AuditContext {
  const regionIds = visibleRegionIds(state, actor);
  const names = regionIds.map(
    (id) => state.regions.find((region) => region.id === id)?.name ?? id,
  );
  return {
    weeks: [week],
    week,
    today,
    actor,
    regionIds,
    scopeLabel: actor.hq ? "全国" : (names[0] ?? "当前区域"),
    categories: [],
    focus: "all",
  };
}

function scopedTasks(state: InspectionState, ctx: AuditContext) {
  return state.tasks.filter(
    (task) =>
      task.status !== "disabled" &&
      !task.mergedIntoId &&
      canSeeTask(ctx.actor, task) &&
      (ctx.categories.length === 0 ||
        task.categories.some((category) => ctx.categories.includes(category))),
  );
}

function openRisksOf(state: InspectionState, ctx: AuditContext) {
  const key = `${state.revision}|${state.seedVersion}|${ctx.weeks.join(",")}|${ctx.today}|${ctx.categories.join(",")}`;
  if (riskCache?.key !== key)
    riskCache = { key, value: evaluateRisks(state, ctx.weeks, ctx.today) };
  return uniqueRisks(riskCache.value)
    /**
     * 只保留「该结论所属周期里真的有排期」的任务：
     * 一个结论只对它自己那一周的任务负责，避免跨周期重复计数。
     */
    .filter((risk) =>
      risk.taskIds.some((taskId) => {
        const task = state.tasks.find((item) => item.id === taskId);
        return task ? scheduledIn(task, [risk.week]) : false;
      }),
    )
    .filter(
      (risk) =>
        (state.risks.find((record) => record.key === risk.key)?.status ??
          "待处理") !== "已解决",
    )
    .filter((risk) =>
      risk.regionIds.length
        ? risk.regionIds.some((id) => ctx.regionIds.includes(id))
        : true,
    )
    .filter((risk) => {
      if (!ctx.categories.length) return true;
      return risk.taskIds.some((taskId) =>
        state.tasks
          .find((task) => task.id === taskId)
          ?.categories.some((category) => ctx.categories.includes(category)),
      );
    });
}

/** 指定区域的工时汇总，按数据版本 + 区域集合缓存。 */
function burdensFor(
  state: InspectionState,
  ctx: AuditContext,
  regionIds: string[],
) {
  const key = `${state.revision}|${state.seedVersion}|${ctx.week}|${ctx.today}|${regionIds.join(",")}`;
  const hit = burdenCache.get(key);
  if (hit) return hit;
  const value = regionBurden(state, ctx.week, ctx.today, regionIds);
  burdenCache.set(key, value);
  return value;
}

function burdensOf(state: InspectionState, ctx: AuditContext) {
  return burdensFor(state, ctx, ctx.regionIds);
}

const riskRank: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
  insufficient: 3,
};

export const sortRisks = (risks: InspectionRisk[]) =>
  [...risks].sort(
    (a, b) =>
      riskRank[a.level] - riskRank[b.level] ||
      b.impact.affectedPeople - a.impact.affectedPeople ||
      a.ruleId.localeCompare(b.ruleId),
  );

/* ------------------------------------------------------------ 调用规格 */

function toolSpec(
  id: AuditToolId,
  ctx: AuditContext,
  extra: { label: string; value: string }[] = [],
): AuditToolSpec {
  const meta = AUDIT_TOOL_LIST.find((tool) => tool.id === id)!;
  return {
    id,
    name: meta.name,
    title: meta.title,
    desc: meta.desc,
    owner: meta.owner,
    permission: meta.permission,
    params: [
      { label: "周期", value: ctx.weeks.map((week) => week.slice(5)).join(" / ") },
      { label: "范围", value: ctx.scopeLabel },
      ...(ctx.categories.length
        ? [{ label: "品类", value: ctx.categories.join("、") }]
        : []),
      ...extra,
    ],
  };
}

export function specFor(
  id: AuditToolId,
  state: InspectionState,
  ctx: AuditContext,
  question?: string,
): AuditToolSpec {
  switch (id) {
    case "query_scope":
      return toolSpec(id, ctx, [{ label: "维度", value: "地区 / 门店 / 品类 / 人员" }]);
    case "check_data_gaps":
      return toolSpec(id, ctx, [{ label: "必填字段", value: "7 项" }]);
    case "query_training_overview":
      return toolSpec(id, ctx, [{ label: "来源", value: "学习 / 练习 / 考试 / 媒体采集" }]);
    case "query_region_comparison":
      return toolSpec(id, ctx, [{ label: "对比维度", value: "人均 / 超容量 / 完成率" }]);
    case "query_product_stats":
      return toolSpec(id, ctx, [{ label: "分组", value: "品类" }]);
    case "query_learning_completion":
      return toolSpec(id, ctx, [{ label: "口径", value: "完成率 / 逾期率 / 考试分" }]);
    case "run_inspection_rules":
      return toolSpec(id, ctx, [{ label: "规则集", value: `v${state.policy.version}` }]);
    case "save_schedule":
      return toolSpec(id, ctx, [
        { label: "频率", value: "每周一 09:00" },
        { label: "关注", value: FOCUS_LABELS[ctx.focus] },
      ]);
    default:
      return toolSpec(id, ctx, [
        { label: "写入", value: "独立记录（不改任务）" },
        ...(question ? [{ label: "来源问题", value: question }] : []),
      ]);
  }
}

/* ---------------------------------------------------------------- 工具实现 */

function queryScope(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
): AuditToolOutput {
  const visibleStores = state.stores.filter((store) =>
    ctx.regionIds.includes(store.regionId),
  );
  const people = state.people.filter(
    (person) => person.active && ctx.regionIds.includes(person.regionId),
  );
  const categories = new Map<string, number>();
  for (const task of scopedTasks(state, ctx))
    for (const category of task.categories)
      categories.set(category, (categories.get(category) ?? 0) + 1);
  const rows = ctx.regionIds.map((regionId) => {
    const region = state.regions.find((item) => item.id === regionId)!;
    const regionTasks = scopedTasks(state, ctx).filter(
      (task) =>
        task.audience.scope === "nationwide" ||
        task.audience.regionIds.includes(regionId),
    );
    return [
      region.name,
      region.ownerName,
      `${state.people.filter((person) => person.active && person.regionId === regionId).length} 人`,
      `${visibleStores.filter((store) => store.regionId === regionId).length} 家`,
      `${regionTasks.length} 项`,
      region.capacityMinutes === null
        ? "未确认"
        : `${region.capacityMinutes} 分钟`,
    ];
  });
  return {
    headline: `权限校验通过：本次可查 ${ctx.regionIds.length} 个区域、${people.length} 名在岗 BA、${categories.size} 个品类，查询范围按当前账号收窄。`,
    facts: [
      { label: "可查区域", value: `${ctx.regionIds.length} 个` },
      { label: "在岗 BA", value: `${people.length} 人` },
      { label: "门店", value: `${visibleStores.length} 家` },
      { label: "品类", value: `${categories.size} 个` },
    ],
    table: {
      columns: ["区域", "负责人", "在岗 BA", "门店", "本期任务", "周容量基线"],
      rows,
    },
    notes: [
      "模型传来的地区、产品和用户身份只能作为请求内容，不能作为权限依据；每次工具调用都由 ADM 重新检查租户、功能权限、数据范围与字段范围。",
      ctx.actor.hq
        ? "当前账号为总部角色，可查看全部区域；区域角色只会返回本区域与全国任务。"
        : `当前账号为${ctx.actor.roleLabel}，只能查看${ctx.scopeLabel}与全国任务，其它区域的数据不会返回。`,
      categories.size
        ? `数据里出现过的品类：${[...categories.keys()].join("、")}。`
        : "本期范围内没有带品类的任务。",
    ],
    sources: ["业务库 · 地区与组织范围", "业务库 · 人员归属与在岗状态", "业务库 · 区域容量基线"],
    scanned: `${ctx.regionIds.length} 个区域 · ${people.length} 名人员 · ${visibleStores.length} 家门店`,
    ms,
    traceId,
  };
}

function checkDataGaps(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
): AuditToolOutput {
  const tasks = scopedTasks(state, ctx);
  const gaps = new Map<string, InspectionTask[]>();
  for (const task of tasks)
    for (const gap of missingFields(task)) {
      const list = gaps.get(gap.field) ?? [];
      list.push(task);
      gaps.set(gap.field, list);
    }
  const affected = new Set([...gaps.values()].flat());
  const complete = tasks.length - affected.size;
  const rows = [...gaps.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([field, list]) => [
      field,
      `${list.length} 项`,
      list
        .slice(0, 2)
        .map((task) => task.title)
        .join("、") + (list.length > 2 ? ` 等 ${list.length} 项` : ""),
      list[0].origin === "source" ? "外部接入" : "平台创建",
    ]);
  const first = [...gaps.values()][0]?.[0];
  return {
    headline: `${tasks.length} 项任务中 ${complete} 项字段完整，${gaps.size} 类字段缺失，涉及 ${affected.size} 项任务。`,
    facts: [
      { label: "字段完整", value: `${complete} / ${tasks.length} 项` },
      { label: "完整率", value: ratio(tasks.length ? complete / tasks.length : 1) },
      { label: "缺字段任务", value: `${affected.size} 项` },
      {
        label: "数据类异常",
        value: gaps.size ? `${gaps.size} 条` : "0 条",
        hint: "异常码 DATA_FIELD_MISSING，只标「数据不足」，不判定违规",
      },
    ],
    table: rows.length
      ? { columns: ["缺失字段", "任务数", "涉及任务", "任务来源"], rows }
      : undefined,
    notes: [
      "核对字段：预计时长、逐人分配、结构化频次、任务负责人、任务版本、推送记录、完成回传。",
      "缺字段只产出「数据不足」结论，不会被判定为违规；缺预计时长的人员不计入工时口径。",
      gaps.size
        ? `补齐入口：任务编辑页补齐后可重跑审计；字段缺失属于业务数据问题（可重试=false，需要用户补齐）。`
        : "本期没有需要补齐字段的任务。",
    ],
    sources: ["业务库 · 任务配置字段", "业务库 · 内容资源时长", "业务库 · 人员名单快照"],
    scanned: `${tasks.length} 项任务 × 7 个必填字段`,
    ms,
    traceId,
    error: first
      ? {
          code: "DATA_FIELD_MISSING",
          kind: "data",
          userMessage: `${affected.size} 项任务缺字段，无法参与完整判定；补齐后重跑即可。`,
          modelMessage: `tasks=${affected.size} missing=${[...gaps.keys()].join("|")}`,
          retryable: false,
          needUserInput: true,
        }
      : undefined,
  };
}

function queryTrainingOverview(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
): AuditToolOutput {
  const tasks = scopedTasks(state, ctx);
  const burdens = burdensOf(state, ctx);
  const known = burdens.reduce((sum, item) => sum + item.knownHeadcount, 0);
  const totalMinutes = burdens.reduce((sum, item) => sum + item.totalMinutes, 0);
  const mean = known ? totalMinutes / known : 0;
  const people = new Set<string>();
  for (const task of tasks)
    for (const id of task.audience.resolvedPersonIds ?? []) people.add(id);
  const risks = openRisksOf(state, ctx);
  const problemTasks = new Set(risks.flatMap((risk) => risk.taskIds));
  const rows = KIND_ORDER.map((kind) => {
    const list = tasks.filter((task) => task.kind === kind);
    const ids = new Set<string>();
    for (const task of list)
      for (const id of task.audience.resolvedPersonIds ?? []) ids.add(id);
    const minutes = list
      .map((task) => taskOccurrenceMinutes(task))
      .filter((value): value is number => value !== null);
    const taskMean = minutes.length
      ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length
      : null;
    const overdue = list.filter((task) => task.results.returnedAt === null).length;
    return [
      KIND_LABELS[kind],
      `${list.length} 项`,
      `${ids.size} 人`,
      taskMean === null ? "缺预计时长" : minutesText(taskMean),
      overdue ? `${overdue} 项无回传` : "回传正常",
    ];
  });
  return {
    headline: `本期 ${tasks.length} 项任务覆盖 ${people.size} 名 BA，人均 ${minutesText(mean)}，其中 ${problemTasks.size} 项命中问题。`,
    facts: [
      { label: "任务数", value: `${tasks.length} 项` },
      { label: "覆盖 BA", value: `${people.size} 人` },
      { label: "本周总时长", value: hoursText(totalMinutes) },
      {
        label: "人均",
        value: minutesText(mean),
        hint: `${known} 名 BA 参与计算，缺预计时长的人不计入`,
      },
    ],
    table: { columns: ["任务类型", "任务数", "涉及 BA", "单次平均时长", "回传"], rows },
    notes: [
      "工时口径：内容预计时长 × 周期内应完成次数 + 附加题；缺预计时长的任务与人员不计入。",
      `周期口径：${ctx.weeks.length > 1 ? `${ctx.weeks.length} 个周期，工时按最新周期 ${WEEK_LABEL(ctx.week)} 统计` : WEEK_LABEL(ctx.week)}。`,
      ctx.categories.length
        ? `已按品类收窄：${ctx.categories.join("、")}。`
        : "未按品类收窄，覆盖全部品类。",
    ],
    sources: [
      "业务库 · 学习 / 练习 / 考试 / 媒体采集任务",
      "业务库 · 任务内容资源与预计时长",
      "业务库 · 任务频次与达标目标",
    ],
    scanned: `${tasks.length} 项任务 · ${people.size} 名 BA · ${known} 条工时可算人员`,
    ms,
    traceId,
  };
}

function queryRegionComparison(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
): AuditToolOutput {
  /** 区域对比始终用账号可见的全部区域：只看一个区域没有对比基线。 */
  const all = [...burdensFor(state, ctx, visibleRegionIds(state, ctx.actor))].sort(
    (a, b) => b.meanMinutes - a.meanMinutes,
  );
  const completionRates = new Map(
    regionAggregates(state, ctx.week, ctx.today).map((region) => [
      region.regionId,
      region.completionRate,
    ]),
  );
  const known = all.reduce((sum, item) => sum + item.knownHeadcount, 0);
  const total = all.reduce((sum, item) => sum + item.totalMinutes, 0);
  const hqMean = known ? total / known : 0;
  const idle = all.filter(
    (item) => item.totalMinutes === 0 || item.knownHeadcount === 0,
  );
  const active = all.filter((item) => !idle.includes(item));
  const top = active[0];
  const bottom = active[active.length - 1];
  const spread =
    active.length > 1 && bottom.meanMinutes > 0
      ? top.meanMinutes / bottom.meanMinutes
      : 1;
  const audited = ctx.regionIds.length < all.length ? ctx.regionIds : [];
  const mark = (regionId: string) =>
    audited.includes(regionId) ? "（本次审计）" : "";
  const rateText = (regionId: string) => {
    const rate = completionRates.get(regionId);
    return rate === null || rate === undefined ? "回传缺失" : ratio(rate);
  };
  const focus = all.find((item) => audited.includes(item.regionId));
  const focusRank = focus ? active.indexOf(focus) + 1 : 0;
  const rows = all.map((item) => [
    `${item.regionName}${mark(item.regionId)}`,
    item.ownerName,
    item.totalMinutes === 0 ? "本期无任务" : minutesText(item.meanMinutes),
    item.totalMinutes === 0 || !hqMean
      ? "—"
      : `${item.meanMinutes >= hqMean ? "+" : ""}${Math.round(
          ((item.meanMinutes - hqMean) / hqMean) * 100,
        )}%`,
    `${item.overCapacityCount} 人`,
    rateText(item.regionId),
    `${item.taskCount} 项`,
  ]);
  const headline = active.length
    ? `${active.length} 个区域人均分钟最高 ${top.regionName} ${minutesText(
        top.meanMinutes,
      )}、最低 ${bottom.regionName} ${minutesText(
        bottom.meanMinutes,
      )}，相差 ${spread.toFixed(1)} 倍${
        focus
          ? `；本次审计的 ${focus.regionName} 人均 ${minutesText(
              focus.meanMinutes,
            )}，在可比区域里排第 ${focusRank}，${
              focus.meanMinutes >= hqMean ? "高于" : "低于"
            }全国人均 ${Math.abs(Math.round(focus.meanMinutes - hqMean))} 分钟`
          : ""
      }${idle.length ? `；${idle.map((item) => item.regionName).join("、")} 本期没有任务或没有可计入工时的 BA` : ""}。`
    : `范围内 ${all.length} 个区域都没有可计入工时的任务排期。`;
  return {
    headline,
    facts: [
      {
        label: "最高区域",
        value: top ? `${top.regionName} · ${minutesText(top.meanMinutes)}` : "—",
      },
      {
        label: "最低区域",
        value: bottom
          ? `${bottom.regionName} · ${minutesText(bottom.meanMinutes)}`
          : "—",
      },
      {
        label: "区域差异",
        value: active.length > 1 ? `${spread.toFixed(1)} 倍` : "无可比区域",
        hint: `阈值：超过 ${state.policy.regionGapRatio} 倍判定为区域总量异常`,
      },
      {
        label: "无任务 / 无工时区域",
        value: idle.length ? `${idle.length} 个` : "无",
        hint: idle.map((item) => item.regionName).join("、"),
      },
      {
        label: "超容量合计",
        value: `${all.reduce((sum, item) => sum + item.overCapacityCount, 0)} 人`,
      },
    ],
    table: {
      columns: ["区域", "负责人", "人均", "相对全国", "超容量", "完成率", "任务数"],
      rows,
    },
    notes: [
      "相对全国 = 本区域人均分钟相对全国人均的偏差，用来判断是普遍偏重还是个别区域偏重。",
      focus
        ? `本次审计对象 ${focus.regionName}：人均 ${minutesText(
            focus.meanMinutes,
          )}（全国人均 ${minutesText(hqMean)}），超容量 ${focus.overCapacityCount} 人，完成率 ${rateText(
            focus.regionId,
          )}。`
        : "本次审计覆盖全部可见区域，没有单独收窄。",
      idle.length
        ? `${idle
            .map((item) => item.regionName)
            .join("、")} 本期没有可计入工时的数据，不参与倍数与人均对比，需要确认是漏排还是本期不排。`
        : "所有区域本期都有可计入工时的任务。",
      all.some((item) => !item.capacityConfirmed)
        ? `${all
            .filter((item) => !item.capacityConfirmed)
            .map((item) => item.regionName)
            .join("、")} 尚未确认容量基线，只能参考历史人均。`
        : "所有区域都已确认容量基线。",
    ],
    sources: ["业务库 · 培训任务与人员排期", "业务库 · 区域容量基线", "业务库 · 完成回传"],
    scanned: `${all.length} 个区域 · ${known} 名 BA 的排期`,
    ms,
    traceId,
  };
}

function queryProductStats(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
): AuditToolOutput {
  const tasks = scopedTasks(state, ctx);
  const risks = openRisksOf(state, ctx);
  const categories = new Map<string, InspectionTask[]>();
  for (const task of tasks)
    for (const category of task.categories) {
      const list = categories.get(category) ?? [];
      list.push(task);
      categories.set(category, list);
    }
  const allRegionIds = visibleRegionIds(state, ctx.actor);
  const rows = [...categories.entries()]
    .map(([category, list]) => {
      const ids = new Set<string>();
      for (const task of list)
        for (const id of task.audience.resolvedPersonIds ?? []) ids.add(id);
      const covered = new Set<string>();
      for (const task of list) {
        if (task.audience.scope === "nationwide")
          allRegionIds.forEach((id) => covered.add(id));
        task.audience.regionIds.forEach((id) => covered.add(id));
      }
      const problem = new Set(
        risks
          .filter((risk) =>
            risk.taskIds.some((taskId) => list.some((task) => task.id === taskId)),
          )
          .flatMap((risk) => risk.taskIds),
      );
      return {
        category,
        list,
        people: ids.size,
        missingRegions: allRegionIds.filter((id) => !covered.has(id)),
        problemTasks: problem.size,
      };
    })
    .sort(
      (a, b) =>
        b.missingRegions.length - a.missingRegions.length ||
        b.problemTasks - a.problemTasks,
    )
    .map((item) => [
      item.category,
      `${item.list.length} 项`,
      `${item.people} 人`,
      `${allRegionIds.length - item.missingRegions.length} / ${allRegionIds.length} 个区域`,
      item.missingRegions.length
        ? `缺 ${item.missingRegions
            .map(
              (id) => state.regions.find((region) => region.id === id)?.name ?? id,
            )
            .join("、")}`
        : "全区覆盖",
      `${item.problemTasks} 项`,
    ]);
  const uncovered = [...categories.entries()].filter(([, list]) =>
    list.every((task) =>
      task.audience.scope === "nationwide" ? false : task.audience.regionIds.length < allRegionIds.length,
    ),
  );
  const topCategory = [...categories.entries()][0];
  return {
    headline: categories.size
      ? `本期共 ${categories.size} 个品类、${tasks.length} 项任务；${uncovered.length} 个品类没有覆盖全部区域，需要确认是漏排还是有意只在部分区域上线。`
      : "本期范围内没有带品类的任务。",
    facts: [
      { label: "品类数", value: `${categories.size} 个` },
      {
        label: "任务最多品类",
        value: topCategory ? `${topCategory[0]} · ${topCategory[1].length} 项` : "—",
      },
      {
        label: "未全区覆盖",
        value: `${uncovered.length} 个品类`,
        hint: uncovered.map(([name]) => name).join("、") || "无",
      },
      { label: "覆盖区域数", value: `${allRegionIds.length} 个` },
    ],
    table: rows.length
      ? { columns: ["品类", "任务数", "涉及 BA", "覆盖区域", "缺口", "命中问题"], rows }
      : undefined,
    notes: [
      "覆盖口径：全国任务视为覆盖全部可见区域；区域任务的命中区域决定覆盖范围。",
      "品类来自任务配置，与题库、课件共用同一套全局品类；品类只在部分区域有任务时属于需要确认的排期问题，不直接判定违规。",
    ],
    sources: ["业务库 · 任务品类配置", "业务库 · 任务下发的区域范围", "业务库 · 项目全局品类"],
    scanned: `${tasks.length} 项任务 · ${categories.size} 个品类 × ${allRegionIds.length} 个区域`,
    ms,
    traceId,
  };
}

function queryLearningCompletion(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
): AuditToolOutput {
  const aggregates = regionAggregates(state, ctx.week, ctx.today).filter((region) =>
    ctx.regionIds.includes(region.regionId),
  );
  const tasks = scopedTasks(state, ctx);
  const examTasks = tasks.filter((task) => task.kind === "exam");
  const scores = examTasks.flatMap((task) => Object.values(task.results.scores));
  const examMean = scores.length
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : null;
  const headcount = aggregates.reduce((sum, region) => sum + region.headcount, 0);
  const rateOf = (region: (typeof aggregates)[number]) => region.completionRate;
  const weighted = aggregates.filter((region) => rateOf(region) !== null);
  const weightedHead = weighted.reduce((sum, region) => sum + region.headcount, 0);
  const meanRate = weightedHead
    ? weighted.reduce(
        (sum, region) => sum + (rateOf(region) as number) * region.headcount,
        0,
      ) / weightedHead
    : null;
  const meanOverdue = aggregates.some((region) => region.overdueRate !== null)
    ? aggregates.reduce((sum, region) => sum + (region.overdueRate ?? 0), 0) /
      aggregates.filter((region) => region.overdueRate !== null).length
    : null;
  const behind = openRisksOf(state, ctx).filter((risk) => risk.ruleId === "E1");
  const rows = aggregates.map((region) => [
    region.name,
    region.completionRate === null ? "回传缺失" : ratio(region.completionRate),
    region.overdueRate === null ? "回传缺失" : ratio(region.overdueRate),
    `${region.headcount} 人`,
    `${region.people.filter((person) => person.unknownTaskCount > 0).length} 人`,
  ]);
  const missingReturn = tasks.filter(
    (task) => task.publishedAt && !task.results.returnedAt,
  ).length;
  return {
    headline:
      meanRate === null
        ? `${headcount} 名 BA 的完成回传不可用，无法给出完成率结论。`
        : `范围内完成率 ${ratio(meanRate)}、逾期率 ${
            meanOverdue === null ? "回传缺失" : ratio(meanOverdue)
          }${examMean === null ? "" : `，考试平均 ${Math.round(examMean)} 分`}，${behind.length} 条结论与进度落后有关。`,
    facts: [
      {
        label: "平均完成率",
        value: meanRate === null ? "回传缺失" : ratio(meanRate),
        hint: "按区域人数加权",
      },
      {
        label: "逾期率",
        value: meanOverdue === null ? "回传缺失" : ratio(meanOverdue),
      },
      {
        label: "考试平均分",
        value: examMean === null ? "暂无成绩" : `${Math.round(examMean)} 分`,
        hint: `${scores.length} 份成绩`,
      },
      {
        label: "进度落后",
        value: `${behind.length} 条`,
        hint: `影响 ${new Set(behind.flatMap((risk) => risk.personIds)).size} 人`,
      },
    ],
    table: {
      columns: ["区域", "完成率", "逾期率", "在岗 BA", "缺时长时间未计入"],
      rows,
    },
    notes: [
      "完成率与逾期率来自任务完成回传；回传缺失的区域（completionReporting=false）不参与加权，也不做完成率结论。",
      missingReturn
        ? `${missingReturn} 项已发布任务没有完成回传，属于数据类问题，需要先确认推送与回传链路。`
        : "所有已发布任务都有完成回传。",
      "考试成绩取任务提交记录中的最终成绩，同一场考试按单次最终成绩计算。",
    ],
    sources: ["业务库 · 学员任务进度", "业务库 · 考试提交记录", "业务库 · 完成回传与推送记录"],
    scanned: `${headcount} 名 BA · ${tasks.length} 项任务 · ${scores.length} 份成绩`,
    ms,
    traceId,
  };
}

function runInspectionRules(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
): AuditToolOutput {
  const risks = openRisksOf(state, ctx);
  const level = (target: RiskLevel) =>
    risks.filter((risk) => risk.level === target).length;
  const byRule = new Map<string, InspectionRisk[]>();
  for (const risk of risks) {
    const list = byRule.get(risk.ruleId) ?? [];
    list.push(risk);
    byRule.set(risk.ruleId, list);
  }
  const rows = [...byRule.entries()]
    .sort(
      (a, b) =>
        riskRank[a[1][0].level] - riskRank[b[1][0].level] ||
        b[1].length - a[1].length,
    )
    .map(([ruleId, list]) => [
      ruleId,
      list[0].ruleName,
      LEVEL_LABELS[list[0].level],
      `${list.length} 条`,
      `${new Set(list.flatMap((risk) => risk.taskIds)).size} 项任务`,
      `${new Set(list.flatMap((risk) => risk.regionIds)).size} 个区域`,
    ]);
  return {
    headline: `规则集 v${state.policy.version} 命中 ${risks.length} 条结论：高风险 ${level("high")}、中风险 ${level("medium")}、低风险 ${level("low")}、数据不足 ${level("insufficient")}。`,
    facts: [
      { label: "命中结论", value: `${risks.length} 条` },
      { label: "高风险", value: `${level("high")} 条`, hint: "阻断发布或需要总部确认" },
      { label: "中风险", value: `${level("medium")} 条` },
      { label: "数据不足", value: `${level("insufficient")} 条`, hint: "字段缺失，不做结论" },
    ],
    table: rows.length
      ? {
          columns: ["规则", "规则名", "等级", "命中", "涉及任务", "涉及区域"],
          rows,
        }
      : undefined,
    notes: [
      "规则分类：A 负荷合理性、B 时间合理性、C 人群合理性、D 内容与任务关系、E 执行风险、F 数据不足、G 品类覆盖。",
      `关键阈值：周容量 ${state.policy.weeklyCapacityMinutes} 分钟、单日 ${state.policy.dailyLimitMinutes} 分钟、单任务周投入 ${state.policy.taskWeeklyLimitMinutes} 分钟、${state.policy.deadlineWindowDays} 天内 ≥ ${state.policy.deadlineTaskCount} 项视为集中。`,
      "规则由确定性代码执行，阈值随规则版本一起记录；相同结论连续出现时合并为持续问题，不重复制造记录。",
    ],
    sources: ["本地规则集 v" + state.policy.version, "ADM 返回的任务与人员快照"],
    scanned: `${scopedTasks(state, ctx).length} 项任务 × ${ctx.weeks.length} 个周期 × 7 类规则`,
    ms,
    traceId,
  };
}

function saveInspectionRecord(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
  question?: string,
): AuditToolOutput {
  const report = buildAuditReport(state, ctx);
  const recordId = `insp-${ctx.week.replace(/-/g, "")}-${hex(`${ctx.scopeLabel}|${ctx.focus}`)}`;
  return {
    headline: `已保存独立审计记录 ${recordId}：${report.findings.length} 条结论、规则集 v${state.policy.version}、查询范围${ctx.scopeLabel}。`,
    facts: [
      { label: "记录编号", value: recordId },
      { label: "结论数", value: `${report.findings.length} 条` },
      { label: "规则版本", value: `v${state.policy.version}` },
      { label: "写入范围", value: ctx.scopeLabel },
    ],
    table: {
      columns: ["保存内容", "说明"],
      rows: [
        ["执行时间", jakartaNow()],
        ["查询范围", `${ctx.scopeLabel} · ${ctx.weeks.map((week) => WEEK_LABEL(week)).join(" / ")}`],
        ["规则版本", `v${state.policy.version}`],
        ["数据来源", report.sources.join("；")],
        ["结论与证据", `${report.findings.length} 条，每条带数据出处`],
        [
          "是否修改任务",
          "否：只写独立审计记录，不改培训任务、人员、组织与成绩",
        ],
        ...(question ? [["来源问题", question]] : []),
      ],
    },
    notes: [
      "审计记录只保存结论、证据、规则版本与查询范围，不修改任何培训任务。",
      "相同问题连续出现时合并为持续问题：只推进最近命中时间与复发次数，不重复新增记录。",
      "写入由 ADM 完成，写入前再次检查创建者的区域范围与字段范围。",
    ],
    sources: ["审计记录表 · 本次批次", "本地规则集 v" + state.policy.version],
    scanned: `1 条记录 · ${report.findings.length} 条结论`,
    ms,
    traceId,
  };
}

function saveSchedule(
  state: InspectionState,
  ctx: AuditContext,
  ms: number,
  traceId: string,
): AuditToolOutput {
  const scheduleId = `sch-${hex(`${ctx.scopeLabel}|${ctx.focus}|${ctx.weeks[0]}`)}`;
  const report = buildAuditReport(state, ctx);
  return {
    headline: `已保存定时报告条件：每周一 09:00（Asia/Jakarta）审计${ctx.scopeLabel}的${FOCUS_LABELS[ctx.focus]}，由 ADM 定时触发。`,
    facts: [
      { label: "订阅编号", value: scheduleId },
      { label: "触发时间", value: "每周一 09:00" },
      { label: "范围", value: ctx.scopeLabel },
      { label: "关注", value: FOCUS_LABELS[ctx.focus] },
    ],
    table: {
      columns: ["保存字段", "值"],
      rows: [
        ["地区范围", ctx.scopeLabel],
        ["品类范围", ctx.categories.length ? ctx.categories.join("、") : "全部品类"],
        ["关注指标", FOCUS_LABELS[ctx.focus]],
        ["时间范围", "最近一个完整周"],
        ["审计规则", `规则集 v${state.policy.version}`],
        ["接收方式", "页面 + 飞书（由 ADM 发送）"],
        ["群报告内容", "仅汇总数据，不包含员工明细"],
      ],
    },
    notes: [
      "审计条件保存的是结构化内容（地区、品类、指标、时间、规则），不是一段让模型以后重新猜测的话。",
      "定时任务由 ADM 触发并向 Supervisor 发起审计；飞书消息由 ADM 在发送前再次检查接收人权限，Supervisor 不直接发送。",
      "个人报告按权限可含明细，群报告默认只发汇总数据。",
      `本次立即预览（飞书群消息草稿）：${report.title} · ${report.verdict} · 命中 ${report.findings.length} 条结论，详情见 Supervisor 工作台。`,
    ],
    sources: ["定时报告条件表 · 本次订阅", "业务库 · 接收人权限"],
    scanned: "1 条订阅 · 7 个结构化字段",
    ms,
    traceId,
  };
}

const jakartaNow = () =>
  new Date().toLocaleString("zh-CN", { timeZone: "Asia/Jakarta" }).slice(0, 16);

/* ---------------------------------------------------------------- 调度 */

export function runAuditTool(
  id: AuditToolId,
  state: InspectionState,
  ctx: AuditContext,
  question?: string,
): AuditToolOutput {
  const ms = durationOf(id, state.revision + state.seedVersion);
  const traceId = `trace-${hex(`${id}|${ctx.weeks.join(",")}|${ctx.scopeLabel}|${state.revision}`)}`;
  /** 审计历史周期时换成带历史副本的视图；当前周期直接用原状态。 */
  const view = auditView(state, ctx.weeks, ctx.today);
  switch (id) {
    case "query_scope":
      return queryScope(view, ctx, ms, traceId);
    case "check_data_gaps":
      return checkDataGaps(view, ctx, ms, traceId);
    case "query_training_overview":
      return queryTrainingOverview(view, ctx, ms, traceId);
    case "query_region_comparison":
      return queryRegionComparison(view, ctx, ms, traceId);
    case "query_product_stats":
      return queryProductStats(view, ctx, ms, traceId);
    case "query_learning_completion":
      return queryLearningCompletion(view, ctx, ms, traceId);
    case "run_inspection_rules":
      return runInspectionRules(view, ctx, ms, traceId);
    case "save_schedule":
      return saveSchedule(view, ctx, ms, traceId);
    default:
      return saveInspectionRecord(view, ctx, ms, traceId, question);
  }
}

/* -------------------------------------------------------- 条件补齐（补问） */

export type ClarifyField = "time" | "region" | "category" | "focus";

export interface ClarifyOption {
  label: string;
  value: string;
  hint?: string;
}

export interface Clarification {
  field: ClarifyField;
  question: string;
  options: ClarifyOption[];
}

export interface AuditPreset {
  id: string;
  label: string;
  question: string;
  hint: string;
}

export const AUDIT_PRESETS: AuditPreset[] = [
  {
    id: "vague",
    label: "最近培训情况怎么样",
    question: "最近培训情况怎么样？",
    hint: "条件不全：Agent 会先补问时间、范围与关注方面，再开始查",
  },
  {
    id: "full",
    label: "审计本周全部培训任务",
    question: "帮我审计本周全国的培训任务",
    hint: "条件齐全，直接跑完整流程",
  },
  {
    id: "workload",
    label: "哪个区域工时压力最大",
    question: "哪个区域 BA 的工时压力最大？",
    hint: "区域对比 + 工时口径",
  },
  {
    id: "quality",
    label: "哪些任务数据不全",
    question: "哪些任务数据不全，需要谁去补？",
    hint: "数据完整度检查，输出待补齐清单",
  },
  {
    id: "coverage",
    label: "品类在区域上的覆盖情况",
    question: "彩妆和新品这些品类在各个区域都排上任务了吗？",
    hint: "品类 × 区域覆盖统计",
  },
];

const REGION_ALIASES: Record<string, string[]> = {
  south: ["南区", "雅加达南"],
  north: ["北区", "雅加达北"],
  bali: ["巴厘岛", "巴厘"],
  surabaya: ["泗水"],
};

const regionMatches = (name: string, id: string, text: string) =>
  text.includes(name) ||
  (REGION_ALIASES[id] ?? []).some((alias) => text.includes(alias));

/** 问题里点到的区域（只在可见范围内匹配）。 */
export function regionFromText(
  state: InspectionState,
  actor: InspectionActor,
  text: string,
) {
  const region = state.regions.find(
    (item) =>
      (actor.hq || actor.regionId === item.id) &&
      regionMatches(item.name, item.id, text),
  );
  return region ?? null;
}

/** 问题里点到但当前账号看不到的区域：用于演示权限类异常。 */
export function outOfScopeRegion(
  state: InspectionState,
  actor: InspectionActor,
  text: string,
) {
  if (actor.hq) return null;
  return (
    state.regions.find(
      (item) =>
        item.id !== actor.regionId && regionMatches(item.name, item.id, text),
    ) ?? null
  );
}

const TIME_HINT =
  /本周|这周|上周|上星期|本月|这个月|本周期|近\s*\d+\s*周|\d+\s*周|最近一个月|今天|昨天|\d{1,2}\s*月/;
const ALL_SCOPE_HINT = /全国|全部区域|所有区域|各个区域|全区/;

/**
 * 时间范围选项：本周 / 上周 / 下周。
 * 定时汇报默认复盘「最近一个完整周」，所以这里以单周期为主，
 * 多周期趋势对比属于后续设计项（见《Supervisor 待确定设计》）。
 */
export function weekOptions(state: InspectionState, today = inspectionDay()) {
  const current = weekStart(today);
  const shift = (count: number) => {
    const date = new Date(`${current}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + count * 7);
    return date.toISOString().slice(0, 10);
  };
  return [
    {
      key: "this-week",
      label: "本周",
      hint: `${current.slice(5)} ~ ${addDays(current, 6).slice(5)}`,
      weeks: [current],
    },
    {
      key: "last-week",
      label: "上周",
      hint: `${shift(-1).slice(5)} ~ ${addDays(shift(-1), 6).slice(5)} · 已回传，可复盘完成情况`,
      weeks: [shift(-1)],
    },
    {
      key: "next-week",
      label: "下周",
      hint: `${shift(1).slice(5)} ~ ${addDays(shift(1), 6).slice(5)} · 发布前预审`,
      weeks: [shift(1)],
    },
  ];
}

export function weeksFromKey(
  state: InspectionState,
  key: string,
  today = inspectionDay(),
) {
  const hit = weekOptions(state, today).find((option) => option.key === key);
  return hit ? hit.weeks : [weekStart(today)];
}

/** 从问题文本判断关注方面。 */
export function focusFromText(text: string): AuditFocus {
  if (/数据|字段|不全|补齐|完整/.test(text)) return "datagaps";
  if (/重复|重合|同源|做两遍|两次/.test(text)) return "duplicate";
  if (/品类|产品|新品|覆盖|彩妆|护肤|敏感肌/.test(text)) return "coverage";
  if (/完成|完成率|逾期|考试|成绩|分数|通过率/.test(text)) return "completion";
  if (/工时|负荷|超标|超载|压力|时长|负担|忙/.test(text)) return "workload";
  return "all";
}

export function categoryOptions(state: InspectionState, actor: InspectionActor) {
  const names = new Set<string>();
  for (const task of state.tasks)
    if (canSeeTask(actor, task) && task.status !== "disabled")
      task.categories.forEach((category) => names.add(category));
  return [...names].sort((a, b) => a.localeCompare(b, "zh"));
}

/**
 * 条件补齐：按《Supervisor 设计》先确认条件再查询。
 * 时间与范围缺失必问；问法含糊时再确认关注方面；提到产品而没点名品类时补问品类。
 */
export function clarificationsFor(
  state: InspectionState,
  ctx: AuditContext,
  question: string,
): Clarification[] {
  const text = question.trim();
  const list: Clarification[] = [];
  if (!TIME_HINT.test(text))
    list.push({
      field: "time",
      question: "先确认看哪段时间？点下面的选项，或者直接打字说「本周」「上周」「下周」。",
      options: weekOptions(state, ctx.today).map((option) => ({
        label: option.label,
        value: option.key,
        hint: option.hint,
      })),
    });
  const region = regionFromText(state, ctx.actor, text);
  if (ctx.actor.hq && !region && !ALL_SCOPE_HINT.test(text))
    list.push({
      field: "region",
      question: "再看哪些地区？可以直接点，也可以打字说「南区」「全国」。",
      options: [
        { label: "全国", value: "__all__", hint: "当前账号可见的全部区域" },
        ...state.regions.map((item) => ({
          label: item.name,
          value: item.id,
          hint: `负责人 ${item.ownerName}`,
        })),
      ],
    });
  const categories = categoryOptions(state, ctx.actor);
  if (
    categories.length &&
    /产品|品类|新品|覆盖/.test(text) &&
    !categories.some((category) => text.includes(category))
  )
    list.push({
      field: "category",
      question: "具体看哪些品类？可以多选，也可以打字，例如「新品和敏感肌」。",
      options: [
        { label: "全部品类", value: "__all__" },
        ...categories.map((category) => ({ label: category, value: category })),
      ],
    });
  if (/情况怎么样|怎么样|有什么问题|有什么异常|汇报|小结|总结|概览|总体表现/.test(text))
    list.push({
      field: "focus",
      question: "这次重点看哪些方面？",
      options: [
        { label: "全部方面", value: "all" },
        { label: "工时与负荷", value: "workload" },
        { label: "完成与考试", value: "completion" },
        { label: "数据完整度", value: "datagaps" },
        { label: "重复布置", value: "duplicate" },
        { label: "品类覆盖", value: "coverage" },
      ],
    });
  return list;
}

/** 把补问答案落到查询条件上。 */
export function applyClarification(
  state: InspectionState,
  ctx: AuditContext,
  field: ClarifyField,
  value: string,
): AuditContext {
  if (field === "time") {
    const weeks = weeksFromKey(state, value, ctx.today);
    return { ...ctx, weeks, week: weeks[weeks.length - 1] };
  }
  if (field === "region") {
    if (value === "__all__")
      return {
        ...ctx,
        regionIds: visibleRegionIds(state, ctx.actor),
        scopeLabel: "全国",
      };
    const region = state.regions.find((item) => item.id === value);
    return {
      ...ctx,
      regionIds: [value],
      scopeLabel: region?.name ?? value,
    };
  }
  if (field === "category") {
    if (value === "__all__") return { ...ctx, categories: [] };
    const picked = value.split(",").filter(Boolean);
    return { ...ctx, categories: [...new Set([...ctx.categories, ...picked])] };
  }
  return { ...ctx, focus: value as AuditFocus };
}

/* -------------------------------------------------------------- 审计计划 */

const STEPS_BY_FOCUS: Record<AuditFocus, AuditToolId[]> = {
  all: [
    "query_scope",
    "check_data_gaps",
    "query_training_overview",
    "query_learning_completion",
    "query_product_stats",
    "query_region_comparison",
    "run_inspection_rules",
  ],
  workload: [
    "query_scope",
    "query_training_overview",
    "query_region_comparison",
    "run_inspection_rules",
  ],
  completion: [
    "query_scope",
    "query_learning_completion",
    "query_region_comparison",
    "run_inspection_rules",
  ],
  datagaps: [
    "query_scope",
    "check_data_gaps",
    "query_training_overview",
    "run_inspection_rules",
  ],
  duplicate: [
    "query_scope",
    "query_training_overview",
    "run_inspection_rules",
  ],
  coverage: ["query_scope", "query_product_stats", "run_inspection_rules"],
};

const FOCUS_INTRO: Record<AuditFocus, string> = {
  all: "我按固定流程跑一遍：先确认可查范围，再核数据、看概览与完成情况、做区域和品类对比，最后执行审计规则并出报告。每一步工具调用和返回值都留在这里。",
  workload: "这次重点看工时与负荷：先确认范围，取培训概览，再做区域横向对比，最后用规则集判定超容量与集中排期。",
  completion: "这次重点看完成与考试：取完成率、逾期率与考试成绩，再和区域横向对比，最后判定执行风险。",
  datagaps: "这次重点看数据完整度：逐任务核对必填字段，再给待补齐清单，最后按规则判定哪些结论只能标「数据不足」。",
  duplicate: "这次重点看重复布置与时间集中：先取本期任务，再用规则集找同源内容重复与集中排期。",
  coverage: "这次重点看品类覆盖：按品类统计任务、覆盖区域与命中问题，找出只在部分区域上线的品类。",
};

export function planFor(
  state: InspectionState,
  ctx: AuditContext,
  question: string,
): AuditPlan {
  const text = question.trim();
  const focus = ctx.focus === "all" ? focusFromText(text) : ctx.focus;
  const steps = STEPS_BY_FOCUS[focus];
  return {
    id: `plan-${focus}`,
    question: text,
    intro: FOCUS_INTRO[focus],
    steps,
    followUps: [
      "把结论保存成审计记录",
      "每周一早上九点自动跑这个审计",
      "哪个区域工时压力最大",
      "哪些任务数据不全",
    ],
  };
}

/** 未补齐条件时的初始上下文：先按问题里的线索收窄，再交给补问。 */
export function planContext(
  state: InspectionState,
  ctx: AuditContext,
  question: string,
): AuditContext {
  const region = regionFromText(state, ctx.actor, question);
  const focus = ctx.focus === "all" ? focusFromText(question) : ctx.focus;
  const categories = categoryOptions(state, ctx.actor).filter((category) =>
    question.includes(category),
  );
  return {
    ...ctx,
    ...(region ? { regionIds: [region.id], scopeLabel: region.name } : {}),
    focus,
    ...(categories.length ? { categories } : {}),
  };
}

/* -------------------------------------------------------------- 审计报告 */

export function buildAuditReport(
  baseState: InspectionState,
  ctx: AuditContext,
): AuditReport {
  const state = auditView(baseState, ctx.weeks, ctx.today);
  const risks = sortRisks(openRisksOf(state, ctx));
  const burdens = burdensOf(state, ctx);
  const known = burdens.reduce((sum, item) => sum + item.knownHeadcount, 0);
  const totalMinutes = burdens.reduce((sum, item) => sum + item.totalMinutes, 0);
  const mean = known ? totalMinutes / known : 0;
  const high = risks.filter((risk) => risk.level === "high").length;
  const medium = risks.filter((risk) => risk.level === "medium").length;
  const insufficient = risks.filter((risk) => risk.level === "insufficient").length;
  const people = new Set(risks.flatMap((risk) => risk.personIds));
  const tasks = new Set(risks.flatMap((risk) => risk.taskIds));
  const verdict: AuditReport["verdict"] =
    high > 0 ? "阻断" : medium > 0 ? "需关注" : risks.length ? "提示优化" : "通过";
  const findings: AuditFinding[] = risks.slice(0, 5).map((risk) => ({
    level: risk.level,
    ruleId: risk.ruleId,
    title: risk.title,
    detail: risk.reason,
    evidence: risk.evidence[0]
      ? `${risk.evidence[0].text}（${risk.evidence[0].ref}）`
      : "—",
    source: risk.evidence[0]?.ref ?? "—",
    /** 历史周期的结论指向副本，展示时还原成原任务 id。 */
    taskIds: [...new Set(risk.taskIds.map(originalTaskId))],
  }));
  const confirmations = [
    ...new Set(
      risks
        .filter((risk) => risk.confirmation)
        .map((risk) => `${risk.confirmation!.name}（${risk.confirmation!.roleLabel}）`),
    ),
  ];
  const actions = [
    ...new Set(risks.slice(0, 4).map((risk) => risk.suggestion)),
    ...(confirmations.length ? [`需要确认：${confirmations.join("、")}`] : []),
    ...(insufficient
      ? [`先补齐 ${insufficient} 条「数据不足」结论对应的任务字段，再重跑审计。`]
      : []),
  ].slice(0, 5);
  const scopeText = `${ctx.scopeLabel} · ${ctx.weeks.length > 1 ? `${ctx.weeks.length} 个周期（${ctx.weeks[0].slice(5)} ~ ${ctx.week.slice(5)}）` : WEEK_LABEL(ctx.week)}${ctx.categories.length ? ` · 品类 ${ctx.categories.join("、")}` : ""} · 覆盖 ${scopedTasks(state, ctx).length} 项任务 / ${known} 名可计工时 BA`;

  return {
    id: `report-${ctx.week}-${hex(`${ctx.scopeLabel}|${ctx.focus}|${ctx.categories.join(",")}`)}`,
    title: `${ctx.scopeLabel} · ${FOCUS_LABELS[ctx.focus]}审计报告`,
    verdict,
    summary:
      risks.length === 0
        ? `${scopeText}；本期没有命中审计规则，人均 ${minutesText(mean)}，可以按计划发布。`
        : `${scopeText}；命中 ${risks.length} 条结论（高风险 ${high}、中风险 ${medium}、数据不足 ${insufficient}），影响 ${people.size} 名 BA、${tasks.size} 项任务，人均 ${minutesText(mean)}，${burdens.reduce((sum, item) => sum + item.overCapacityCount, 0)} 人超出区域容量。`,
    metrics: [
      { label: "审计结论", value: verdict },
      { label: "命中规则", value: `${risks.length} 条` },
      { label: "影响 BA", value: `${people.size} 人` },
      { label: "影响任务", value: `${tasks.size} 项` },
      { label: "人均工时", value: minutesText(mean) },
      {
        label: "需人工确认",
        value: confirmations.length ? `${confirmations.length} 人` : "无",
      },
    ],
    findings,
    actions,
    scope: scopeText,
    sources: [
      "业务库 · 学习 / 练习 / 考试 / 媒体采集任务",
      "业务库 · 人员归属、在岗状态与名单快照",
      "业务库 · 完成回传与考试成绩",
      `本地规则集 v${state.policy.version}（A–G，阈值随版本固定）`,
    ],
    ruleVersion: `v${state.policy.version}`,
  };
}
