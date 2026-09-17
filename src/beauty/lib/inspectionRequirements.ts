/**
 * 培训审计 · 自定义审计需求
 *
 * 用户在「问问审计 Agent」里通过选项对话创建一条自己的审计需求：
 * 关注哪些方面、看哪个区域、多久跑一次、从哪天跑到哪天。
 * 这里只做纯计算：按需求筛选审计结论、算出这次运行的「工作记录」、判断是否到点该跑。
 * 不改任务数据，也不写主审计存档。
 */

import {
  KIND_LABELS,
  addDays,
  canSeeRegion,
  canSeeTask,
  compareRisks,
  evaluateRisks,
  inspectionDay,
  personAggregates,
  uniqueRisks,
  weekStart,
} from "./inspectionEngine";
import { visibleRisks } from "./inspectionAgent";
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  InspectionTask,
} from "./inspectionTypes";

/* ------------------------------------------------------------------ 常量 */

export type RequirementAspect =
  | "duplicate"
  | "crowding"
  | "workload"
  | "category"
  /** 历史存档里的「数据不全」，读取仍然认，但不再作为新需求的选项。 */
  | "data-gap";
export type RequirementCadence = "daily" | "weekly" | "monthly";
export type RequirementStatus = "active" | "paused" | "finished";
export type RequirementRunTrigger = "auto" | "manual";

export const CREATE_REQUIREMENT_PROMPT = "新建一个审计需求";
export const MAX_REQUIREMENTS = 6;
export const REQUIREMENT_NAME_LIMIT = 12;

/** 关注方面：沿用总览已有的业务口径，界面不出现规则编号。 */
export const ASPECT_LABELS: Record<RequirementAspect, string> = {
  duplicate: "重复布置",
  crowding: "时间集中",
  workload: "任务量超了",
  category: "包含特定品类",
  "data-gap": "数据不全",
};

export const ASPECT_HINTS: Record<RequirementAspect, string> = {
  duplicate: "同一批人重复做相同内容",
  crowding: "任务挤在同几天到期",
  workload: "一周任务量超过能承受的范围",
  category: "只看某些品类的任务，例如新品 / 敏感肌 / 彩妆",
  "data-gap": "缺关键信息，暂时判断不了",
};

const ASPECT_SHORT: Record<RequirementAspect, string> = {
  duplicate: "重复布置",
  crowding: "时间集中",
  workload: "任务量",
  category: "品类",
  "data-gap": "数据不全",
};

/** 规则 → 业务方面。和总览的「负荷叠加 / 时间集中 / 重复布置」保持一套口径。 */
const ASPECT_RULES: Record<RequirementAspect, string[]> = {
  workload: ["A1", "A2", "A3", "A4", "A6"],
  crowding: ["A5", "B1", "B2", "B3", "B4", "B5"],
  duplicate: ["C3", "C5", "D2", "D3"],
  category: [],
  "data-gap": ["F1", "D5"],
};

/** 创建向导里的关注方面：品类是「额外收窄」，不是一类规则。 */
export const REQUIREMENT_ASPECTS: RequirementAspect[] = [
  "duplicate",
  "crowding",
  "workload",
  "category",
];

/** 存档里合法取值：多带上历史的「数据不全」，老记录不至于被当成坏数据。 */
export const VALID_ASPECTS: RequirementAspect[] = [
  ...REQUIREMENT_ASPECTS,
  "data-gap",
];

/** 按规则分组的方面（品类不算，它只用来按任务品类收窄范围）。 */
export const RULE_ASPECTS: RequirementAspect[] = [
  "duplicate",
  "crowding",
  "workload",
  "data-gap",
];

export const CADENCE_LABELS: Record<RequirementCadence, string> = {
  daily: "每天 08:00",
  weekly: "每周一 08:00",
  monthly: "每月 1 日 08:00",
};

const CADENCE_SHORT: Record<RequirementCadence, string> = {
  daily: "每天审计",
  weekly: "每周审计",
  monthly: "每月审计",
};

export const STATUS_LABELS: Record<RequirementStatus, string> = {
  active: "进行中",
  paused: "已暂停",
  finished: "已结束",
};

/** 周期触发时间固定 08:00（Asia/Jakarta = UTC+7，无夏令时 → 01:00 UTC）。 */
const SLOT_UTC_HOUR = 1;

export const aspectOfRule = (ruleId: string): RequirementAspect | null =>
  RULE_ASPECTS.find((aspect) => ASPECT_RULES[aspect].includes(ruleId)) ?? null;

/* ------------------------------------------------------------------ 类型 */

export interface RequirementRunChange {
  label: string;
  taskId: string | null;
}

interface RequirementIssueRef {
  key: string;
  label: string;
  taskId: string | null;
}

export interface RequirementRun {
  id: string;
  /** 同一结论首次记录时间（ISO）。 */
  at: string;
  /** 同一结论最近一次审计时间（ISO）。 */
  lastSeenAt: string;
  /** 连续审计到同一结论的次数（含首次）。 */
  repeatCount: number;
  trigger: RequirementRunTrigger;
  /** 这次运行统计的周期（周一）。 */
  week: string;
  taskCount: number;
  issueCount: number;
  peopleCount: number;
  /** 缺预计时长、不计入人均分钟的人数。 */
  unknownPeople: number;
  /** 关注任务里，这些 BA 人均要花的计划分钟（缺时长的人不计入）。 */
  meanMinutes: number;
  issuesByAspect: Record<RequirementAspect, number>;
  /** 结论是否和上一次一致；一致时只推进时间与连续次数。 */
  unchanged: boolean;
  added: RequirementRunChange[];
  resolved: RequirementRunChange[];
  /** 该次运行逐任务的结论，展开记录就能核对。 */
  taskLines: string[];
  issueIndex: RequirementIssueRef[];
}

export interface InspectionRequirement {
  id: string;
  name: string;
  aspects: RequirementAspect[];
  /** 选中「包含特定品类」时盯的品类；空数组表示不限品类。 */
  categories: string[];
  /** null = 当前账号可见的全部区域（总部就是「全国」）。 */
  regionId: string | null;
  cadence: RequirementCadence;
  startsOn: string;
  endsOn: string | null;
  status: RequirementStatus;
  createdAt: string;
  createdBy: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastViewedAt: string | null;
  /** 最近一次到点自动运行落在哪一天，用来避免同一天重复补跑。 */
  lastAutoDay: string | null;
  runs: RequirementRun[];
}

export interface RequirementDraft {
  name: string;
  aspects: RequirementAspect[];
  categories: string[];
  regionId: string | null;
  cadence: RequirementCadence;
  startsOn: string;
  endsOn: string | null;
  createdBy: string;
}

/* ------------------------------------------------------------- 范围筛选 */

const taskInRegion = (task: InspectionTask, regionId: string | null) => {
  if (!regionId) return true;
  if (task.audience.scope === "nationwide") return true;
  return task.audience.regionIds.includes(regionId);
};

export function riskInRequirementScope(
  state: InspectionState,
  risk: InspectionRisk,
  regionId: string | null,
) {
  if (!regionId) return true;
  const tasks = risk.taskIds
    .map((id) => state.tasks.find((task) => task.id === id))
    .filter((task): task is InspectionTask => !!task);
  if (tasks.length) return tasks.some((task) => taskInRegion(task, regionId));
  return risk.regionIds.includes(regionId);
}

/** 区域需求：人数与区域列表都收窄到这一个区域，避免把全国人数算进来。 */
function narrowToRegion(
  state: InspectionState,
  risk: InspectionRisk,
  regionId: string | null,
): InspectionRisk {
  if (!regionId) return risk;
  const personIds = risk.personIds.filter(
    (id) => state.people.find((person) => person.id === id)?.regionId === regionId,
  );
  const regionIds = risk.regionIds.filter((id) => id === regionId);
  return {
    ...risk,
    personIds,
    regionIds,
    impact: {
      ...risk.impact,
      affectedPeople: risk.personIds.length
        ? personIds.length
        : risk.impact.affectedPeople,
      affectedRegions: regionIds.length || risk.impact.affectedRegions,
    },
  };
}

const isOpenRisk = (state: InspectionState, risk: InspectionRisk) =>
  (state.risks.find((record) => record.key === risk.key)?.status ?? "待处理") !==
  "已解决";

/** 需求范围：关注方面（规则分组）+ 品类 + 区域。 */
export type RequirementScope = Pick<InspectionRequirement, "aspects" | "regionId"> & {
  categories?: string[];
};

/** 只要选中了品类，问题就必须落在含这些品类的任务上。 */
function riskInCategoryScope(
  state: InspectionState,
  risk: InspectionRisk,
  categories: string[],
) {
  if (!categories.length) return true;
  return risk.taskIds.some((taskId) => {
    const task = state.tasks.find((item) => item.id === taskId);
    return !!task && (task.categories ?? []).some((item) => categories.includes(item));
  });
}

/** 选中的规则方面；只选了「包含特定品类」时，等于这一类品类上的问题都要。 */
function riskMatchesAspects(risk: InspectionRisk, aspects: RequirementAspect[]) {
  // 一个方面都没选的需求不产出结论（向导里也不允许这样建）
  if (!aspects.length) return false;
  const picked = aspects.filter(
    (aspect) => aspect !== "category" && ASPECT_RULES[aspect].length > 0,
  );
  if (!picked.length) return true;
  const aspect = aspectOfRule(risk.ruleId);
  return !!aspect && picked.includes(aspect);
}

/** 需求口径下的全部结论（不看具体是谁在看）：关注方面 + 品类 + 区域范围。 */
export function requirementRisks(
  state: InspectionState,
  requirement: RequirementScope,
  week: string,
  today = inspectionDay(),
): InspectionRisk[] {
  const categories = requirement.categories ?? [];
  return uniqueRisks(
    evaluateRisks(state, [week], today)
      .filter((risk) => isOpenRisk(state, risk))
      .filter((risk) => riskMatchesAspects(risk, requirement.aspects))
      .filter((risk) => riskInCategoryScope(state, risk, categories))
      .filter((risk) => riskInRequirementScope(state, risk, requirement.regionId)),
  )
    .map((risk) => narrowToRegion(state, risk, requirement.regionId))
    .sort(compareRisks);
}

/** 界面上展示的问题清单：在需求范围之上，再按当前账号的可见区域收窄。 */
export function requirementIssues(
  state: InspectionState,
  requirement: RequirementScope,
  actor: InspectionActor,
  week: string,
  today = inspectionDay(),
): InspectionRisk[] {
  const categories = requirement.categories ?? [];
  return uniqueRisks(
    visibleRisks(state, actor, week, today)
      .filter((risk) => isOpenRisk(state, risk))
      .filter((risk) => riskMatchesAspects(risk, requirement.aspects))
      .filter((risk) => riskInCategoryScope(state, risk, categories))
      .filter((risk) => riskInRequirementScope(state, risk, requirement.regionId)),
  )
    .map((risk) => narrowToRegion(state, risk, requirement.regionId))
    .sort(compareRisks);
}

/* --------------------------------------------------------------- 人话文案 */

/** 一句话说法（不带任务名）：谁受影响、影响多大。 */
export function issuePhraseOf(risk: InspectionRisk): string {
  const people = risk.impact.affectedPeople;
  if (risk.ruleId === "A3") return `${people} 人有一天任务排得太满`;
  if (risk.ruleId === "A5") return `${people} 人的必修和考试挤在一起`;
  switch (aspectOfRule(risk.ruleId)) {
    case "workload":
      return people ? `${people} 人这周任务量超了` : "任务量偏高";
    case "crowding":
      return people ? `${people} 人的任务挤在同几天` : "任务挤在同几天";
    case "duplicate":
      return people ? `${people} 人要把相同内容做两遍` : "内容重复布置";
    case "data-gap":
      return "信息不全，暂时判断不了";
    default:
      return risk.title;
  }
}

/** 一条结论的一句话说法：谁受影响、影响多大（可带涉及的任务名）。 */
export function requirementIssueLabel(
  state: InspectionState,
  risk: InspectionRisk,
): string {
  const tasks = risk.taskIds
    .map((id) => state.tasks.find((task) => task.id === id)?.title)
    .filter(Boolean)
    .slice(0, 2)
    .join("、");
  return `${issuePhraseOf(risk)}${tasks ? `（${tasks}）` : ""}`;
}

const taskLineOf = (
  state: InspectionState,
  risk: InspectionRisk,
  taskId: string,
): string | null => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return null;
  const hit = risk.taskIds.includes(taskId);
  return `${task.title}（${KIND_LABELS[task.kind]}）· ${hit ? requirementIssueLabel(state, risk) : "正常"}`;
};

/* --------------------------------------------------------------- 运行计算 */

const jakartaSlotMs = (day: string) =>
  Date.parse(`${day}T0${SLOT_UTC_HOUR}:00:00Z`);

const cadenceHitsDay = (cadence: RequirementCadence, day: string) => {
  if (cadence === "daily") return true;
  if (cadence === "weekly")
    return new Date(`${day}T12:00:00Z`).getUTCDay() === 1;
  return day.endsWith("-01");
};

/** 今天是不是这个需求该跑的时点（已经过了 08:00 才算）。 */
export function scheduledSlotDay(
  requirement: Pick<
    InspectionRequirement,
    "cadence" | "startsOn" | "endsOn" | "status"
  >,
  now = new Date(),
): string | null {
  if (requirement.status !== "active") return null;
  const day = inspectionDay(now);
  if (day < requirement.startsOn) return null;
  if (requirement.endsOn && day > requirement.endsOn) return null;
  if (!cadenceHitsDay(requirement.cadence, day)) return null;
  if (now.getTime() < jakartaSlotMs(day)) return null;
  return day;
}

/** 到点且今天还没自动跑过。 */
export function requirementDue(
  requirement: Pick<
    InspectionRequirement,
    "cadence" | "startsOn" | "endsOn" | "status" | "lastAutoDay"
  >,
  now = new Date(),
) {
  const slot = scheduledSlotDay(requirement, now);
  return !!slot && requirement.lastAutoDay !== slot;
}

/** 下一次该跑的时间；暂停 / 已结束 / 到期都不返回。 */
export function nextRunAt(
  requirement: Pick<
    InspectionRequirement,
    "cadence" | "startsOn" | "endsOn" | "status"
  >,
  now = new Date(),
): string | null {
  if (requirement.status !== "active") return null;
  const start = inspectionDay(now);
  for (let offset = 0; offset <= 62; offset += 1) {
    const day = addDays(start, offset);
    if (day < requirement.startsOn) continue;
    if (requirement.endsOn && day > requirement.endsOn) return null;
    if (!cadenceHitsDay(requirement.cadence, day)) continue;
    const at = jakartaSlotMs(day);
    if (at < now.getTime()) continue;
    return new Date(at).toISOString();
  }
  return null;
}

/** 结束日期到了就自动变成「已结束」，并把下次运行时间清掉。 */
export function refreshRequirement(
  requirement: InspectionRequirement,
  now = new Date(),
): InspectionRequirement {
  const day = inspectionDay(now);
  const status: RequirementStatus =
    requirement.status === "active" &&
    requirement.endsOn &&
    requirement.endsOn < day
      ? "finished"
      : requirement.status;
  const next = nextRunAt({ ...requirement, status }, now);
  if (status === requirement.status && next === requirement.nextRunAt)
    return requirement;
  return { ...requirement, status, nextRunAt: next };
}

/** 需求当前对外显示的运行状态（到期自动算「已结束」）。 */
export const requirementStatusOf = (
  requirement: InspectionRequirement,
  now = new Date(),
): RequirementStatus =>
  requirement.status === "active" &&
  requirement.endsOn &&
  requirement.endsOn < inspectionDay(now)
    ? "finished"
    : requirement.status;

const audiencePeopleOf = (state: InspectionState, task: InspectionTask) => {
  if (task.audience.resolvedPersonIds?.length)
    return task.audience.resolvedPersonIds;
  return state.people
    .filter((person) => {
      if (!person.active) return false;
      if (task.audience.scope === "nationwide") return true;
      if (task.audience.regionIds.length)
        return task.audience.regionIds.includes(person.regionId);
      if (task.audience.storeIds.length)
        return task.audience.storeIds.includes(person.storeId);
      return true;
    })
    .map((person) => person.id);
};

/** 这条结论会影响哪些人；任务级问题（例如数据不全）用任务下发范围兜底。 */
function affectedPersonIds(
  state: InspectionState,
  risks: InspectionRisk[],
  regionId: string | null,
) {
  const ids = new Set<string>();
  for (const risk of risks) {
    if (risk.personIds.length) {
      risk.personIds.forEach((id) => ids.add(id));
      continue;
    }
    for (const taskId of risk.taskIds) {
      const task = state.tasks.find((item) => item.id === taskId);
      if (task) audiencePeopleOf(state, task).forEach((id) => ids.add(id));
    }
  }
  return state.people
    .filter(
      (person) =>
        ids.has(person.id) &&
        person.active &&
        (!regionId || person.regionId === regionId),
    )
    .map((person) => person.id);
}

const sameKeys = (a: string[], b: string[]) =>
  a.length === b.length && a.every((key) => b.includes(key));

const emptyAspectCount = (): Record<RequirementAspect, number> => ({
  duplicate: 0,
  crowding: 0,
  workload: 0,
  category: 0,
  "data-gap": 0,
});

/**
 * 按需求跑一次审计：只统计这个需求关注的任务与问题，
 * 结论和上一次一致时只推进时间与连续次数，不新增记录。
 */
export function runRequirement(
  state: InspectionState,
  requirement: InspectionRequirement,
  now = new Date(),
  trigger: RequirementRunTrigger = "manual",
  week?: string,
): InspectionRequirement {
  const day = inspectionDay(now);
  const statWeek = week ?? weekStart(day);
  const at = now.toISOString();
  const risks = requirementRisks(state, requirement, statWeek, day);
  const taskIds = [...new Set(risks.flatMap((risk) => risk.taskIds))];

  const issuesByAspect = emptyAspectCount();
  for (const risk of risks) {
    const aspect = aspectOfRule(risk.ruleId);
    if (aspect) issuesByAspect[aspect] += 1;
  }

  const personIds = affectedPersonIds(state, risks, requirement.regionId);
  const aggregates = personAggregates(
    state,
    statWeek,
    day,
    requirement.regionId ? [requirement.regionId] : undefined,
  );
  const byId = new Map(aggregates.map((person) => [person.personId, person]));
  const scopeTaskIds = new Set(taskIds);
  const known: number[] = [];
  let unknownPeople = 0;
  for (const personId of personIds) {
    const aggregate = byId.get(personId);
    if (!aggregate) continue;
    if (aggregate.unknownTaskCount > 0) {
      unknownPeople += 1;
      continue;
    }
    known.push(
      aggregate.items
        .filter((item) => scopeTaskIds.has(item.taskId))
        .reduce((sum, item) => sum + item.minutes, 0),
    );
  }
  const meanMinutes = known.length
    ? Math.round(known.reduce((sum, value) => sum + value, 0) / known.length)
    : 0;

  const issueIndex: RequirementIssueRef[] = risks.map((risk) => ({
    key: risk.key,
    label: requirementIssueLabel(state, risk),
    taskId: risk.taskIds[0] ?? null,
  }));
  const taskLines = risks
    .flatMap((risk) =>
      risk.taskIds.map((taskId) => taskLineOf(state, risk, taskId)),
    )
    .filter((line): line is string => !!line)
    .filter((line, index, list) => list.indexOf(line) === index)
    .slice(0, 12);
  if (!risks.length)
    taskLines.push(
      `本次审计了 ${taskIds.length} 项任务，没有发现这一类问题。`,
    );

  const previous = requirement.runs.at(-1);
  const nextKeys = issueIndex.map((issue) => issue.key);
  const unchanged = !!previous && sameKeys(previous.issueIndex.map((issue) => issue.key), nextKeys);

  const base = {
    trigger,
    week: statWeek,
    taskCount: taskIds.length,
    issueCount: risks.length,
    peopleCount: personIds.length,
    unknownPeople,
    meanMinutes,
    issuesByAspect,
    taskLines,
    issueIndex,
  };

  const runs = previous && unchanged
    ? [
        ...requirement.runs.slice(0, -1),
        {
          ...previous,
          lastSeenAt: at,
          repeatCount: previous.repeatCount + 1,
          meanMinutes,
          peopleCount: personIds.length,
          unknownPeople,
        },
      ]
    : [
        ...requirement.runs,
        {
          ...base,
          id: `req-run-${at}-${requirement.runs.length}`,
          at,
          lastSeenAt: at,
          repeatCount: 1,
          unchanged: false,
          added: previous
            ? issueIndex
                .filter(
                  (issue) =>
                    !previous.issueIndex.some((item) => item.key === issue.key),
                )
                .map((issue) => ({
                  label: issue.label,
                  taskId: issue.taskId,
                }))
            : [],
          resolved: previous
            ? previous.issueIndex
                .filter(
                  (item) => !nextKeys.includes(item.key),
                )
                .map((item) => ({ label: item.label, taskId: item.taskId }))
            : [],
        },
      ];

  const updated: InspectionRequirement = {
    ...requirement,
    runs: runs.slice(-30),
    lastRunAt: at,
    lastAutoDay: trigger === "auto" ? day : requirement.lastAutoDay,
  };
  return { ...updated, nextRunAt: nextRunAt(updated, now) };
}

/* --------------------------------------------------------------- 展示文案 */

export const regionLabelOf = (
  state: InspectionState,
  requirement: Pick<InspectionRequirement, "regionId">,
) =>
  requirement.regionId
    ? (state.regions.find((region) => region.id === requirement.regionId)?.name ??
      requirement.regionId)
    : "全国";

export const aspectLabelOf = (
  aspects: RequirementAspect[],
  categories: string[] = [],
) => {
  const picked = aspects.filter((aspect) => aspect !== "category");
  if (
    aspects.includes("category") &&
    picked.length === REQUIREMENT_ASPECTS.length - 1 &&
    !categories.length
  )
    return "全部方面";
  if (aspects.length === REQUIREMENT_ASPECTS.length && !categories.length)
    return "全部方面";
  return aspects
    .map((aspect) =>
      aspect === "category"
        ? categories.length
          ? `${ASPECT_LABELS.category}（${categories.join("、")}）`
          : ASPECT_LABELS.category
        : ASPECT_LABELS[aspect],
    )
    .join("、");
};

export const cadenceLabelOf = (cadence: RequirementCadence) =>
  CADENCE_LABELS[cadence];

export const periodLabelOf = (
  requirement: Pick<InspectionRequirement, "startsOn" | "endsOn">,
) => {
  const day = (value: string) => value.slice(5).replace("-", "/");
  return requirement.endsOn
    ? `${day(requirement.startsOn)} – ${day(requirement.endsOn)}`
    : `从 ${day(requirement.startsOn)} 起 · 长期`;
};

/** 一句话描述：范围 · 周期 · 关注点 · 起止。 */
export function describeRequirement(
  state: InspectionState,
  requirement: Pick<
    InspectionRequirement,
    "regionId" | "cadence" | "aspects" | "startsOn" | "endsOn"
  > & { categories?: string[] },
) {
  return [
    regionLabelOf(state, requirement),
    CADENCE_LABELS[requirement.cadence],
    `关注：${aspectLabelOf(requirement.aspects, requirement.categories ?? [])}`,
    periodLabelOf(requirement),
  ].join(" · ");
}

/** 默认名称：区域 + 关注点 + 审计，例如「雅加达南区重复布置审计」。 */
export function defaultRequirementName(
  state: InspectionState,
  draft: Pick<RequirementDraft, "aspects" | "regionId" | "cadence"> & {
    categories?: string[];
  },
) {
  const region = draft.regionId
    ? (state.regions.find((item) => item.id === draft.regionId)?.name ?? "区域")
    : "全国";
  const categories = draft.categories ?? [];
  const aspect =
    draft.aspects.length === 1
      ? draft.aspects[0] === "category" && categories.length
        ? categories.length === 1
          ? categories[0]
          : "多品类"
        : ASPECT_SHORT[draft.aspects[0]]
      : categories.length && draft.aspects.includes("category")
        ? categories[0]
        : "综合";
  const plain = `${region}${aspect}审计`;
  const withCadence = `${region}${aspect}${CADENCE_SHORT[draft.cadence].slice(0, 2)}审计`;
  return (withCadence.length <= REQUIREMENT_NAME_LIMIT ? withCadence : plain).slice(
    0,
    REQUIREMENT_NAME_LIMIT,
  );
}

/** 名称里的空格与长度都收一下，避免 tab 被撑开。 */
export const normalizeRequirementName = (name: string) =>
  name.trim().replace(/\s+/g, "").slice(0, REQUIREMENT_NAME_LIMIT);

/** 有还没看过的新运行记录时，tab 上点一个小圆点。 */
export const requirementHasUnreadRun = (requirement: InspectionRequirement) => {
  const latest = requirement.runs.at(-1);
  if (!latest) return false;
  return latest.lastSeenAt > (requirement.lastViewedAt ?? "");
};

/** 用户在对话里说「新建 / 创建一个审计」，就进入创建向导。 */
export function matchRequirementIntent(text: string) {
  const wantsNew = /(新建|创建|新增|加一个|做一个|搞一个|定制)/.test(text);
  const aboutInspection = /(审计|体检|检查|监控|盯)/.test(text);
  return wantsNew && aboutInspection;
}

/** 演示数据里出现过的品类（按任务数排序），向导用它做选项。 */
export function requirementCategories(
  state: InspectionState,
  actor?: InspectionActor,
): { name: string; taskCount: number }[] {
  const counts = new Map<string, number>();
  for (const task of state.tasks) {
    if (actor && !canSeeTask(actor, task)) continue;
    if (task.status === "disabled") continue;
    for (const name of task.categories ?? [])
      counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, taskCount]) => ({ name, taskCount }))
    .sort((a, b) => b.taskCount - a.taskCount || a.name.localeCompare(b.name, "zh"));
}

/* ------------------------------------------------------------ 对话解析 */

/** 用户直接打字说想盯哪些方面；认不出来就返回空数组，让 Agent 再问一次。 */
export function parseAspectsFromText(text: string): RequirementAspect[] {
  const aspects: RequirementAspect[] = [];
  if (/(重复|重合|同源|做两遍|两遍|撞车)/.test(text)) aspects.push("duplicate");
  if (/(挤|集中|扎堆|同几天|堆在|截止|撞期|时间安排)/.test(text))
    aspects.push("crowding");
  if (/(任务量|负荷|超载|超了|负担|太多|太忙|忙不忙|分钟|时长)/.test(text))
    aspects.push("workload");
  if (/(品类|系列|新品|敏感肌|彩妆|护肤|产品线|某个产品|某类产品)/.test(text))
    aspects.push("category");
  if (aspects.length) return aspects;
  // 没点名具体方面时才认「都要 / 全都」这类说法
  return /(都要|全都|全部|所有|四个都|都看|都盯|每一类)/.test(text)
    ? [...REQUIREMENT_ASPECTS]
    : [];
}

/** 演示区域的常见简称，和对话 Agent 用同一套叫法。 */
const REGION_ALIASES: Record<string, string[]> = {
  south: ["南区", "雅加达南", "selatan"],
  north: ["北区", "雅加达北", "utara"],
  bali: ["巴厘", "bali", "登巴萨"],
  surabaya: ["泗水", "surabaya"],
};

/** 用户打字说的品类；只认数据里真实存在、且当前账号看得到的品类。 */
export function parseCategoriesFromText(
  state: InspectionState,
  actor: InspectionActor | undefined,
  text: string,
): string[] {
  const known = requirementCategories(state, actor);
  if (!known.length) return [];
  if (/(都要|全都|全部|所有品类|每个品类)/.test(text))
    return known.map((item) => item.name);
  return known
    .filter((item) => text.includes(item.name))
    .map((item) => item.name);
}

/** 用户打字说的范围；认不出来返回 null。全国对区域账号就等于自己那一片。 */
export function parseRegionFromText(
  state: InspectionState,
  actor: InspectionActor,
  text: string,
): { regionId: string | null } | null {
  if (/(全国|所有区域|全部区域|不限区域|全部可见|总部)/.test(text))
    return { regionId: actor.hq ? null : (actor.regionId ?? null) };
  const lower = text.toLowerCase();
  const hit = state.regions
    .filter((region) => canSeeRegion(actor, region.id))
    .find(
      (region) =>
        text.includes(region.name) ||
        (REGION_ALIASES[region.id] ?? []).some((alias) =>
          lower.includes(alias.toLowerCase()),
        ),
    );
  return hit ? { regionId: hit.id } : null;
}

/** 用户打字说的运行周期；认不出来返回 null。 */
export function parseCadenceFromText(text: string): RequirementCadence | null {
  if (/(每天|每日|天天|按天|一天一次|日日)/.test(text)) return "daily";
  if (/(每月|每个月|月初|月一次|一个月一次)/.test(text)) return "monthly";
  if (/(每周|每星期|周一|星期一|按周|一周一次)/.test(text)) return "weekly";
  return null;
}

const CN_NUMBER: Record<string, number> = {
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

/** 「连续 4 周」「一个月」这类说法换算成周数。 */
function durationWeeks(text: string): number | null {
  const match = text.match(/(\d+|[一二两三四五六七八九十])\s*个?\s*(周|星期|月)/);
  if (!match) return null;
  const amount = /^\d+$/.test(match[1])
    ? Number(match[1])
    : (CN_NUMBER[match[1]] ?? 0);
  if (!amount) return null;
  return match[2] === "月" ? amount * 4 : amount;
}

/** 认日期：2026-09-20 / 2026年9月20日 / 9月20日 / 今天 / 明天。 */
function collectDates(text: string, today: string): string[] {
  const found = new Set<string>();
  const full = /(20\d{2})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*[日号]?/g;
  for (const match of text.matchAll(full))
    found.add(
      `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
    );
  const partial = /(^|[^\d])(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/g;
  for (const match of text.matchAll(partial)) {
    if (/[年/]/.test(match[1] ?? "")) continue;
    found.add(
      `${today.slice(0, 4)}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
    );
  }
  if (!found.size) {
    if (/后天/.test(text)) found.add(addDays(today, 2));
    else if (/明天/.test(text)) found.add(addDays(today, 1));
    else if (/今天|现在|马上|立刻/.test(text)) found.add(today);
  }
  return [...found].sort();
}

/** 用户打字说的起止时间；认不出来返回 null。 */
export function parsePeriodFromText(
  text: string,
  today = inspectionDay(),
): { startsOn: string; endsOn: string | null } | null {
  const dates = collectDates(text, today);
  const weeks = durationWeeks(text);
  const longTerm = /(长期|永久|一直|不限|没有结束|不设结束|持续有效)/.test(text);
  if (dates.length >= 2) return { startsOn: dates[0], endsOn: dates[1] };
  if (dates.length === 1)
    return {
      startsOn: dates[0],
      endsOn: weeks ? addDays(dates[0], weeks * 7 - 1) : null,
    };
  if (weeks) return { startsOn: today, endsOn: addDays(today, weeks * 7 - 1) };
  if (longTerm) return { startsOn: today, endsOn: null };
  return null;
}

export type RequirementReplyCommand = "confirm" | "cancel" | "back";

/** 确认页上直接打字回复的短指令。 */
export function parseReplyCommand(text: string): RequirementReplyCommand | null {
  const value = text.trim();
  if (/(不确定|不确认|先不|再想想|让我想想)/.test(value)) return null;
  if (/(取消|算了|不要了|不建了|不弄了)/.test(value)) return "cancel";
  if (/(修改|返回|重来|改一下|换一个|调整一下)/.test(value)) return "back";
  if (/(确认|确定|好的|可以|没问题|就这么|创建|建吧|就这样|ok)/i.test(value))
    return "confirm";
  return null;
}

/** 这条需求当前账号能不能看到：总部看全部，区域账号看本区域与全国需求。 */
export function requirementVisibleTo(
  requirement: Pick<InspectionRequirement, "regionId">,
  actor: InspectionActor,
) {
  if (actor.hq) return true;
  if (!requirement.regionId) return true;
  return requirement.regionId === actor.regionId;
}