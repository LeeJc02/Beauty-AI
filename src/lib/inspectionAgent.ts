/**
 * 培训巡检 Agent · 对话回答
 *
 * 本轮由本地确定性规则生成回答：只复述巡检引擎已经得出的结论、证据与工作记录，
 * 不新增判断、不修改任何数据。将来接入真实模型时，保留 `answerInspectionQuestion`
 * 这一个入口，把 `localInspectionAnswer` 换成模型适配器即可，界面无需改动。
 */

import {
  AUTO_RUN_MINUTES_DEFAULT,
  KIND_LABELS,
  LEVEL_LABELS,
  clampAutoRunMinutes,
  formatCadence,
  parseCadenceMinutes,
  canSeeRegion,
  canSeeTask,
  compareRisks,
  evaluateRisks,
  inspectionDay,
  missingFields,
  regionAggregates,
  weekStart,
} from "./inspectionEngine";
import type {
  InspectionActor,
  InspectionRisk,
  InspectionRunRecord,
  InspectionState,
  InspectionTask,
  RiskLevel,
} from "./inspectionTypes";

export type AgentIntent =
  | "cadence"
  | "recent"
  | "overlap"
  | "workload"
  | "pending"
  | "top-risk"
  | "data-gaps"
  | "region"
  | "changes"
  | "task-why"
  | "help";

export interface AgentCitation {
  label: string;
  ref: string;
  taskId?: string;
}

/** Agent 能提的写操作：目前只有「改自动巡检间隔」。界面收到后落到巡检策略上。 */
export interface AgentAction {
  type: "set-cadence";
  minutes: number;
}

export interface AgentAnswer {
  id: string;
  intent: AgentIntent;
  title: string;
  paragraphs: string[];
  bullets: string[];
  citations: AgentCitation[];
  followUps: string[];
  taskIds: string[];
  action?: AgentAction;
}

export const AGENT_PRESET_QUESTIONS = [
  "最近巡检了哪些任务？",
  "这一周哪些任务重合了？",
  "人均要做多少分钟？",
  "雅加达南区有哪些任务？",
  "现在有哪些任务需要我处理？",
  "哪些任务数据不全？",
  "自动巡检多久跑一次？",
];

const LEVEL_ORDER: RiskLevel[] = ["high", "medium", "low", "insufficient"];

/** 演示区域的常见简称，便于「南区 / 北区 / 巴厘岛 / 泗水」这类问法命中。 */
const REGION_ALIASES: Record<string, string[]> = {
  south: ["南区", "雅加达南"],
  north: ["北区", "雅加达北"],
  bali: ["巴厘岛", "巴厘"],
  surabaya: ["泗水"],
};

const matchRegion = (state: InspectionState, text: string) =>
  state.regions.find(
    (region) =>
      text.includes(region.name) ||
      (REGION_ALIASES[region.id] ?? []).some((alias) => text.includes(alias)),
  );

const clockOf = (iso: string) => iso.slice(11, 16);
const dayOf = (iso: string) => iso.slice(5, 10).replace("-", "/");

const taskOf = (state: InspectionState, taskId: string) =>
  state.tasks.find((task) => task.id === taskId);

const taskTitleOf = (state: InspectionState, taskIds: string[]) =>
  taskIds
    .map((id) => taskOf(state, id)?.title)
    .filter(Boolean)
    .join("、");

/** 一句话里带上区域，避免「同样是任务量超了」的几条看着像重复。 */
const regionPrefixOf = (state: InspectionState, risk: InspectionRisk) => {
  const names = risk.regionIds
    .map((id) => state.regions.find((region) => region.id === id)?.name)
    .filter((name): name is string => !!name);
  if (!names.length) return "";
  if (names.length <= 2) return `${names.join("、")} · `;
  return `${names.slice(0, 2).join("、")} 等 ${names.length} 个区域 · `;
};

/** 任务多的时候只列前几个，剩下的折成「等 N 项」，避免一句话读不完。 */
const shortTaskTitleOf = (
  state: InspectionState,
  taskIds: string[],
  limit = 3,
) => {
  const titles = taskIds
    .map((id) => taskOf(state, id)?.title)
    .filter((title): title is string => !!title);
  if (!titles.length) return "全局";
  if (titles.length <= limit) return titles.join("、");
  return `${titles.slice(0, limit).join("、")} 等 ${titles.length} 项`;
};

/** 当前登录角色能看到的巡检任务。 */
export function visibleTasks(state: InspectionState, actor: InspectionActor) {
  return state.tasks.filter((task) => canSeeTask(actor, task));
}

/** 当前登录角色能看到的巡检结论，口径与页面一致（区域角色只看本区域）。 */
export function visibleRisks(
  state: InspectionState,
  actor: InspectionActor,
  week = weekStart(inspectionDay()),
  today = inspectionDay(),
): InspectionRisk[] {
  return evaluateRisks(state, [week], today)
    .filter((risk) => {
      if (actor.regionId && risk.regionIds.length) {
        return risk.regionIds.some((id) => canSeeRegion(actor, id));
      }
      return true;
    })
    .filter((risk) =>
      risk.taskIds.every((id) => {
        const task = taskOf(state, id);
        return !task || canSeeTask(actor, task);
      }),
    )
    .map((risk) => (actor.hq ? risk : narrowRisk(risk, actor, state)))
    .sort(compareRisks);
}

/** 区域角色只保留本区域的人员与区域，回答里的影响人数同步收窄。 */
function narrowRisk(
  risk: InspectionRisk,
  actor: InspectionActor,
  state: InspectionState,
): InspectionRisk {
  const regionId = actor.regionId ?? "";
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

export const openRisksOf = (state: InspectionState, risks: InspectionRisk[]) =>
  risks.filter(
    (risk) =>
      (state.risks.find((record) => record.key === risk.key)?.status ??
        "待处理") !== "已解决",
  );

/* ------------------------------------------------- 把结论翻译成人话 */

/**
 * 规则编号只用于引擎内部计算，回答里一律不出现。
 * 这里把每条规则归类成几种人话说法，业务看得懂就够了。
 */
const PLAIN_GROUPS: Record<string, string[]> = {
  负荷: ["A1", "A2", "A3", "A4", "A6"],
  时间: ["A5", "B3", "B1", "B2", "B4", "B5"],
  重复: ["C3", "C5", "D2", "D3"],
  人群: ["C1", "C2", "C4"],
  顺序: ["D1", "D4"],
  完成: ["E1", "E2", "E3", "E4", "E5"],
  数据: ["F1", "D5"],
  品类: ["G1"],
};

const groupOf = (ruleId: string) =>
  Object.keys(PLAIN_GROUPS).find((group) => PLAIN_GROUPS[group].includes(ruleId));

/** 一条结论的一句话说法：谁、受影响多少人。 */
const plainOf = (risk: InspectionRisk) => {
  const people = risk.impact.affectedPeople;
  // 同样是「负荷」类，单日排太满和整周超量要说成两件事
  if (risk.ruleId === "A3") return `${people} 人有一天任务排得太满`;
  if (risk.ruleId === "A5") return `${people} 人的必修和考试挤在一起`;
  switch (groupOf(risk.ruleId)) {
    case "负荷":
      return `${people} 人这周任务量超了`;
    case "时间":
      return `${people} 人的任务挤在同几天`;
    case "重复":
      return `${people} 人要把相同内容做两遍`;
    case "人群":
      return "安排的人和预期对不上";
    case "顺序":
      return "先考后学，顺序反了";
    case "完成":
      return `${people} 人进度落后`;
    case "数据":
      return "信息不全，暂时判断不了";
    case "品类":
      return `${people} 人所在的区域这期没排到这个品类`;
    default:
      return risk.ruleName;
  }
};

/** 依据写在小字里，只到「哪一类信息」这一层，不抛规则号。 */
const plainRef = (risk: InspectionRisk) => {
  switch (groupOf(risk.ruleId)) {
    case "负荷":
      return "任务时间与人均负荷";
    case "时间":
      return "任务的开始与截止时间";
    case "重复":
      return "任务内容与下发对象";
    case "人群":
      return "下发范围与员工名单";
    case "品类":
      return "任务品类与分发区域";
    case "完成":
      return "完成与逾期记录";
    default:
      return "任务与人员信息";
  }
};

const riskCitation = (
  state: InspectionState,
  risk: InspectionRisk,
): AgentCitation => ({
  label: `${plainOf(risk)} · ${shortTaskTitleOf(state, risk.taskIds)}`,
  ref: plainRef(risk),
  taskId: risk.taskIds[0],
});

const runHeadline = (run: InspectionRunRecord) =>
  `${dayOf(run.at)} ${clockOf(run.at)} ${run.trigger === "manual" ? "手动巡检" : "自动巡检"}` +
  ` · 扫了 ${run.taskCount} 项任务` +
  (run.repeatCount > 1 ? ` · 结论没变（连续 ${run.repeatCount} 次）` : "");

/** 一次巡检里，某个任务命中的最严重结论。 */
const conclusionOf = (risks: InspectionRisk[], taskId: string) => {
  const hit = risks.filter((risk) => risk.taskIds.includes(taskId));
  if (!hit.length) return null;
  const worst = [...hit].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
  )[0];
  return { worst, count: hit.length };
};

/** 某个任务平均每人要花多少分钟；没有排期数据时返回 null。 */
const minutesPerPersonOf = (
  aggregates: { people: { items: { taskId: string; minutes: number }[] }[] }[],
  taskId: string,
) => {
  const totals: number[] = [];
  for (const region of aggregates)
    for (const person of region.people) {
      const minutes = person.items
        .filter((item) => item.taskId === taskId)
        .reduce((sum, item) => sum + item.minutes, 0);
      if (minutes > 0) totals.push(minutes);
    }
  if (!totals.length) return null;
  return Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length);
};

/** 任务清单里每一项的一句话尾巴：多少人、多少分钟、有没有问题。 */
const plainTaskLine = (
  state: InspectionState,
  task: InspectionTask,
  risks: InspectionRisk[],
  aggregates: { people: { items: { taskId: string; minutes: number }[] }[] }[],
) => {
  const minutes = minutesPerPersonOf(aggregates, task.id);
  const gaps = missingFields(task);
  const conclusion = conclusionOf(risks, task.id);
  const tail = conclusion
    ? plainOf(conclusion.worst)
    : gaps.length
      ? `信息不全（缺${gaps.map((gap) => gap.field).join("、")}）`
      : "正常";
  return `${task.title}（${KIND_LABELS[task.kind]}）· ${minutes ? `人均约 ${minutes} 分钟 · ` : ""}${tail}`;
};

/** 重复布置 / 内容重合的结论。 */
const DUPLICATE_RULES = ["C3", "C5", "D2", "D3"];
/** 任务挤在同几天。 */
const CROWD_RULES = ["B3", "A5", "A3"];
/** 任务量超了。 */
const LOAD_RULES = ["A1", "A2", "A4", "A6"];

const followUpDefaults = [
  "这一周哪些任务重合了？",
  "人均要做多少分钟？",
  "现在有哪些任务需要我处理？",
];

/**
 * 自动巡检频次：问就回答当前设置；带「改成 / 设置」这类说法时给出一条写操作，
 * 界面收到 action 后落到巡检策略上（Agent 自己不改数据）。
 */
const cadenceAnswer = (
  state: InspectionState,
  text: string,
  apply: boolean,
): AgentAnswer => {
  const current = clampAutoRunMinutes(
    state.policy.autoRunMinutes ?? AUTO_RUN_MINUTES_DEFAULT,
  );
  const wanted = parseCadenceMinutes(text);
  const minutes = wanted ?? current;
  const changing = apply && wanted !== null && minutes !== current;
  const paragraphs = changing
    ? [
        `自动巡检已经改成每 ${formatCadence(minutes)}一次（原来是每 ${formatCadence(current)}一次）。`,
        "到点会自动重算一遍；结论没变就合并进同一条记录，只有出现新增或已解决才会记新批次。",
      ]
    : [
        `现在是每 ${formatCadence(current)}自动巡检一次，每次都会重新扫一遍当前周期的任务。`,
        "结论没变只更新时间，不刷屏；想调就说一句「改成每 2 小时一次」。",
      ];
  return {
    id: changing ? "cadence:set" : "cadence",
    intent: "cadence",
    title: changing
      ? `自动巡检改为每 ${formatCadence(minutes)}一次`
      : `自动巡检：每 ${formatCadence(current)}一次`,
    paragraphs,
    bullets: [],
    citations: [
      { label: `当前策略 v${state.policy.version}`, ref: "巡检策略 · 自动巡检间隔" },
    ],
    followUps: ["最近巡检了哪些任务？", "现在有哪些任务需要我处理？"],
    taskIds: [],
    action: changing ? { type: "set-cadence", minutes } : undefined,
  };
};

const asksCadence = (text: string) =>
  /(巡检|检查|扫)/.test(text) &&
  /(多久|多长时间|几小时|几分钟|几次|频率|间隔|频率是多少|多久一次)/.test(text);

const helpAnswer = (): AgentAnswer => ({
  id: "help",
  intent: "help",
  title: "我只回答巡检范围内的问题",
  paragraphs: ["换个问法试试，例如："],
  bullets: [],
  citations: [],
  followUps: AGENT_PRESET_QUESTIONS,
  taskIds: [],
});

const visibleRegionsOf = (state: InspectionState, actor: InspectionActor) =>
  state.regions.filter((region) => canSeeRegion(actor, region.id));

/** 问到某个区域时用这个；没点名就返回当前账号能看的全部区域。 */
const regionScopeOf = (
  state: InspectionState,
  actor: InspectionActor,
  question: string,
) => {
  const requested = matchRegion(state, question);
  if (requested) return canSeeRegion(actor, requested.id) ? [requested] : [];
  return visibleRegionsOf(state, actor);
};

const recentAnswer = (
  state: InspectionState,
  actor: InspectionActor,
  risks: InspectionRisk[],
  today: string,
): AgentAnswer => {
  const runs = state.inspectionRuns;
  const latest = runs.at(-1);
  if (!latest) {
    return {
      id: "recent:empty",
      intent: "recent",
      title: "还没有巡检记录",
      paragraphs: ["点右上角「立即巡检」，就会留下第一条记录。"],
      bullets: [],
      citations: [],
      followUps: followUpDefaults,
      taskIds: [],
    };
  }
  const tasks = visibleTasks(state, actor).filter((task) =>
    latest.taskIds.includes(task.id),
  );
  const aggregates = regionAggregates(
    state,
    weekStart(today),
    today,
    visibleRegionsOf(state, actor).map((region) => region.id),
  );
  const counts = { 要处理: 0, 信息不全: 0, 正常: 0 };
  for (const task of tasks) {
    const gaps = missingFields(task);
    const conclusion = conclusionOf(risks, task.id);
    if (!conclusion && gaps.length) counts.信息不全 += 1;
    else if (!conclusion) counts.正常 += 1;
    else if (conclusion.worst.level === "insufficient") counts.信息不全 += 1;
    else counts.要处理 += 1;
  }
  const kinds = [...new Set(tasks.map((task) => KIND_LABELS[task.kind]))];
  return {
    id: `recent:${latest.id}`,
    intent: "recent",
    title: "最近一次巡检",
    paragraphs: [
      `${runHeadline(latest)}。`,
      `扫到的任务：${kinds.join("、") || "当前没有可见任务"}，共 ${tasks.length} 项。`,
      `结论：${counts.要处理} 项要处理，${counts.信息不全} 项信息不全，${counts.正常} 项正常。`,
    ],
    bullets: tasks.slice(0, 8).map((task) => plainTaskLine(state, task, risks, aggregates)),
    citations: [
      {
        label: `巡检记录 · ${dayOf(latest.at)} ${clockOf(latest.at)}`,
        ref: latest.actorName,
      },
    ],
    followUps: followUpDefaults,
    taskIds: tasks.slice(0, 8).map((task) => task.id),
  };
};

const pendingAnswer = (
  state: InspectionState,
  risks: InspectionRisk[],
): AgentAnswer => {
  const open = openRisksOf(state, risks);
  if (!open.length) {
    return {
      id: "pending:none",
      intent: "pending",
      title: "当前没有要处理的任务",
      paragraphs: ["本周的问题都已解决或标记例外。"],
      bullets: [],
      citations: [],
      followUps: ["最近巡检了哪些任务？", "人均要做多少分钟？"],
      taskIds: [],
    };
  }
  // 同一类问题（例如都是「任务量超了」）只留影响最大的那条，避免车轱辘话
  const picked: InspectionRisk[] = [];
  const seen = new Set<string>();
  for (const risk of open) {
    const label = `${regionPrefixOf(state, risk)}${plainOf(risk)}`;
    if (seen.has(label)) continue;
    seen.add(label);
    picked.push(risk);
    if (picked.length === 5) break;
  }
  return {
    id: "pending",
    intent: "pending",
    title: `${open.length} 项要处理`,
    paragraphs: ["按影响的人数和紧急程度排，最靠前的几条："],
    bullets: picked.map(
      (risk) =>
        `${regionPrefixOf(state, risk)}${shortTaskTitleOf(state, risk.taskIds)}：${plainOf(risk)}，建议${risk.suggestion}`,
    ),
    citations: picked.map((risk) => riskCitation(state, risk)),
    followUps: [
      "这一周哪些任务重合了？",
      "人均要做多少分钟？",
      "上次巡检到现在有什么变化？",
    ],
    taskIds: picked.flatMap((risk) => risk.taskIds.slice(0, 1)),
  };
};

const topRiskAnswer = (
  state: InspectionState,
  risks: InspectionRisk[],
): AgentAnswer => {
  const open = openRisksOf(state, risks);
  const top = open[0];
  if (!top) {
    return {
      id: "top:none",
      intent: "top-risk",
      title: "本周期没有问题",
      paragraphs: ["任务量、时间安排和下发对象都没问题，可以按计划执行。"],
      bullets: [],
      citations: [],
      followUps: ["这一周哪些任务重合了？", "最近巡检了哪些任务？"],
      taskIds: [],
    };
  }
  const owner = top.confirmation
    ? `${top.confirmation.name}（${top.confirmation.roleLabel}）`
    : "不需要额外确认";
  const tasks = taskTitleOf(state, top.taskIds) || top.title;
  return {
    id: `top:${top.key}`,
    intent: "top-risk",
    title: `最该先动：${tasks}`,
    paragraphs: [
      `${plainOf(top)}。`,
      `影响 ${top.impact.affectedPeople} 人；建议：${top.suggestion}`,
      `需要确认：${owner}。`,
    ],
    bullets: [
      `涉及任务：${tasks}`,
      `受影响的人：${top.impact.affectedPeople} 人`,
      top.impact.text,
    ],
    citations: [riskCitation(state, top)],
    followUps: ["现在有哪些任务需要我处理？", "这一周哪些任务重合了？"],
    taskIds: top.taskIds,
  };
};

/** 「这一周哪些任务重合了？」 */
const overlapAnswer = (
  state: InspectionState,
  risks: InspectionRisk[],
): AgentAnswer => {
  const open = openRisksOf(state, risks);
  const duplicates = open.filter((risk) => DUPLICATE_RULES.includes(risk.ruleId));
  const crowded = open.filter((risk) => CROWD_RULES.includes(risk.ruleId));
  const crowdedPeople = new Set(crowded.flatMap((risk) => risk.personIds));
  const crowdedTasks = [
    ...new Set(crowded.flatMap((risk) => risk.taskIds)),
  ]
    .map((id) => taskOf(state, id)?.title)
    .filter(Boolean);

  if (!duplicates.length && !crowded.length) {
    return {
      id: "overlap:none",
      intent: "overlap",
      title: "没发现任务重合",
      paragraphs: [
        "本周没有同一批人重复做相同内容，也没有任务挤在同几天。",
      ],
      bullets: [],
      citations: [],
      followUps: ["人均要做多少分钟？", "最近巡检了哪些任务？"],
      taskIds: [],
    };
  }

  const paragraphs: string[] = [];
  if (duplicates.length)
    paragraphs.push("下面这些任务是重复的，同一批人要做两遍：");
  if (crowded.length)
    paragraphs.push(
      `另外 ${crowdedPeople.size} 人的任务挤在同几天（${crowdedTasks
        .slice(0, 4)
        .join("、")}${crowdedTasks.length > 4 ? ` 等 ${crowdedTasks.length} 项` : ""}），建议错开截止时间。`,
    );

  return {
    id: "overlap",
    intent: "overlap",
    title: duplicates.length ? `${duplicates.length} 处内容重合` : "任务时间挤在一起",
    paragraphs,
    bullets: duplicates.map(
      (risk) =>
        `${taskTitleOf(state, risk.taskIds) || "任务"} · ${risk.impact.affectedPeople} 人重复，建议${risk.suggestion}`,
    ),
    citations: [...duplicates, ...crowded].slice(0, 6).map((risk) => riskCitation(state, risk)),
    followUps: ["人均要做多少分钟？", "现在有哪些任务需要我处理？"],
    taskIds: [...duplicates, ...crowded].flatMap((risk) => risk.taskIds.slice(0, 2)),
  };
};

/** 「人均要做多少分钟？」 */
const workloadAnswer = (
  state: InspectionState,
  actor: InspectionActor,
  today: string,
  question: string,
): AgentAnswer => {
  const scope = regionScopeOf(state, actor, question);
  if (!scope.length) return helpAnswer();
  const aggregates = regionAggregates(
    state,
    weekStart(today),
    today,
    scope.map((region) => region.id),
  );
  const people = aggregates.flatMap((region) => region.people);
  const known = people.filter((person) => person.unknownTaskCount === 0);
  const total = known.reduce((sum, person) => sum + person.plannedMinutes, 0);
  const mean = known.length ? Math.round(total / known.length) : 0;
  const busiest = [...known].sort((a, b) => b.plannedMinutes - a.plannedMinutes);
  const capacity =
    scope.length === 1
      ? aggregates[0]?.capacityMinutes ?? state.policy.weeklyCapacityMinutes
      : state.policy.weeklyCapacityMinutes;
  const over = known.filter((person) => person.plannedMinutes > capacity).length;
  const scopeLabel =
    scope.length === 1 ? scope[0].name : `${scope.length} 个区域`;

  return {
    id: `workload:${scope.map((region) => region.id).join(",")}`,
    intent: "workload",
    title: `${scopeLabel}：人均 ${mean} 分钟`,
    paragraphs: [
      `${scopeLabel}本周 ${known.length} 人一共 ${total} 分钟，人均 ${mean} 分钟；最忙的是 ${busiest[0]?.name ?? "暂无"}（${busiest[0]?.plannedMinutes ?? 0} 分钟）。`,
      `参考容量 ${capacity} 分钟/人/周，${over ? `${over} 人超出` : "没有人超出"}。`,
    ],
    bullets: busiest
      .slice(0, 5)
      .map(
        (person) =>
          `${person.name} · ${person.plannedMinutes} 分钟 · ${person.taskCount} 项任务${
            person.peakDay ? `（${dayOf(person.peakDay)} 最忙，${person.dailyPeak} 分钟）` : ""
          }`,
      ),
    citations: [
      {
        label: `${scopeLabel}的容量参考`,
        ref: `${capacity} 分钟 / 人 / 周`,
      },
    ],
    followUps: ["这一周哪些任务重合了？", "现在有哪些任务需要我处理？"],
    taskIds: [],
  };
};

const dataGapAnswer = (
  state: InspectionState,
  actor: InspectionActor,
): AgentAnswer => {
  const tasks = visibleTasks(state, actor)
    .map((task) => ({ task, gaps: missingFields(task) }))
    .filter((item) => item.gaps.length > 0);
  if (!tasks.length) {
    return {
      id: "gaps:none",
      intent: "data-gaps",
      title: "没有缺信息的任务",
      paragraphs: ["时长、人群、频次和负责人都齐，可以直接给结论。"],
      bullets: [],
      citations: [],
      followUps: followUpDefaults,
      taskIds: [],
    };
  }
  return {
    id: "gaps",
    intent: "data-gaps",
    title: `${tasks.length} 项任务信息不全`,
    paragraphs: ["这些任务缺信息，只能先标「数据不足」，补齐后再判断。"],
    bullets: tasks.map(
      (item) =>
        `${item.task.title}（${KIND_LABELS[item.task.kind]}）· 缺 ${item.gaps
          .map((gap) => gap.field)
          .join("、")}`,
    ),
    citations: tasks.flatMap((item) =>
      item.gaps.slice(0, 1).map((gap) => ({
        label: `${item.task.title} · 缺 ${gap.field}`,
        ref: gap.ref,
        taskId: item.task.id,
      })),
    ),
    followUps: ["现在有哪些任务需要我处理？", "最近巡检了哪些任务？"],
    taskIds: tasks.map((item) => item.task.id),
  };
};

const regionAnswer = (
  state: InspectionState,
  actor: InspectionActor,
  risks: InspectionRisk[],
  question: string,
  today: string,
): AgentAnswer => {
  const requested = matchRegion(state, question);
  if (requested && !canSeeRegion(actor, requested.id)) {
    return {
      id: `region:denied:${requested.id}`,
      intent: "region",
      title: `${requested.name}不在当前账号的可见范围`,
      paragraphs: [
        `当前身份是${actor.roleLabel}，只能看${visibleRegionsOf(state, actor)
          .map((region) => region.name)
          .join("、")}。`,
      ],
      bullets: [],
      citations: [],
      followUps: AGENT_PRESET_QUESTIONS.filter((item) => !item.includes("南区")),
      taskIds: [],
    };
  }
  const region = requested ?? visibleRegionsOf(state, actor)[0];
  if (!region) return helpAnswer();

  const tasks = visibleTasks(state, actor).filter(
    (task) =>
      !task.audience.regionIds.length ||
      task.audience.regionIds.includes(region.id),
  );
  const aggregates = regionAggregates(state, weekStart(today), today, [region.id]);
  const aggregate = aggregates[0];
  const people = aggregate?.people ?? [];
  const busiest = [...people].sort((a, b) => b.plannedMinutes - a.plannedMinutes)[0];
  const regionRisks = risks.filter(
    (risk) => !risk.regionIds.length || risk.regionIds.includes(region.id),
  );
  const open = openRisksOf(state, regionRisks);
  const duplicates = open.filter((risk) => DUPLICATE_RULES.includes(risk.ruleId));
  const crowded = open.filter((risk) => CROWD_RULES.includes(risk.ruleId));
  const crowdedPeople = new Set(crowded.flatMap((risk) => risk.personIds));
  const duplicateTasks = [...new Set(duplicates.flatMap((risk) => risk.taskIds))];

  const paragraphs = [
    `${region.name}本周 ${tasks.length} 项任务，覆盖 ${people.length} 人；人均 ${
      aggregate?.meanMinutes ?? 0
    } 分钟${busiest ? `，最忙的 ${busiest.name}（${busiest.plannedMinutes} 分钟）` : ""}。`,
  ];
  if (aggregate?.capacityConfirmed)
    paragraphs.push(
      `参考容量 ${aggregate.capacityMinutes} 分钟/人/周，${
        aggregate.overCapacityIds.length
          ? `${aggregate.overCapacityIds.length} 人超出`
          : "没有人超出"
      }。`,
    );
  paragraphs.push(
    duplicateTasks.length || crowdedPeople.size
      ? `需要注意：${duplicateTasks.length ? `${duplicateTasks.length} 项任务和其他任务内容重复` : ""}${
          duplicateTasks.length && crowdedPeople.size ? "，" : ""
        }${crowdedPeople.size ? `${crowdedPeople.size} 人的任务挤在同几天` : ""}。`
      : "任务之间没有发现内容重复，也没有挤在同几天。",
  );

  return {
    id: `region:${region.id}`,
    intent: "region",
    title: `${region.name}本周任务`,
    paragraphs,
    bullets: tasks
      .slice(0, 8)
      .map((task) => plainTaskLine(state, task, regionRisks, aggregates)),
    citations: [
      {
        label: `${region.name}的容量参考`,
        ref: `${aggregate?.capacityMinutes ?? "未确认"} 分钟 / 人 / 周 · 负责人 ${region.ownerName}`,
      },
      ...duplicates.slice(0, 2).map((risk) => riskCitation(state, risk)),
    ],
    followUps: ["这一周哪些任务重合了？", "人均要做多少分钟？"],
    taskIds: tasks.slice(0, 8).map((task) => task.id),
  };
};

const changesAnswer = (
  state: InspectionState,
  actor: InspectionActor,
  risks: InspectionRisk[],
  today: string,
): AgentAnswer => {
  const runs = state.inspectionRuns;
  const latest = runs.at(-1);
  const previous = runs.at(-2);
  if (!latest) return recentAnswer(state, actor, risks, today);
  const levelWord = (from: string, to: string) =>
    LEVEL_ORDER.indexOf(to as RiskLevel) < LEVEL_ORDER.indexOf(from as RiskLevel)
      ? "变严重了"
      : "变轻了";
  const delta = previous
    ? [
        ...latest.added.map((change) => `新增问题：${change.title}`),
        ...latest.resolved.map((change) => `已解决：${change.title}`),
        ...latest.levelChanged.map(
          (change) => `${levelWord(change.from, change.to)}：${change.title}`,
        ),
      ]
    : [];
  return {
    id: `changes:${latest.id}`,
    intent: "changes",
    title: delta.length ? `和上次相比有 ${delta.length} 处变化` : "和上次一样",
    paragraphs: previous
      ? [
          `从 ${dayOf(previous.at)} ${clockOf(previous.at)} 到 ${dayOf(latest.at)} ${clockOf(latest.at)}：`,
          delta.length ? `共 ${delta.length} 处变化。` : "没有变化，结论和上次相同。",
        ]
      : [`${runHeadline(latest)}。`, "这是第一条记录，之后的变化会写在这里。"],
    bullets: delta.slice(0, 8),
    citations: previous
      ? [
          {
            label: "巡检记录对比",
            ref: `${dayOf(previous.at)} ${clockOf(previous.at)} → ${dayOf(latest.at)} ${clockOf(latest.at)}`,
          },
        ]
      : [],
    followUps: followUpDefaults,
    taskIds: [...latest.added, ...latest.resolved].flatMap((change) =>
      change.taskIds.slice(0, 1),
    ),
  };
};

const taskWhyAnswer = (
  state: InspectionState,
  risks: InspectionRisk[],
  task: InspectionTask,
  today: string,
  actor: InspectionActor,
): AgentAnswer => {
  const hit = risks
    .filter((risk) => risk.taskIds.includes(task.id))
    .sort(compareRisks);
  if (!hit.length) {
    const gaps = missingFields(task);
    return {
      id: `why:none:${task.id}`,
      intent: "task-why",
      title: `${task.title}没有问题`,
      paragraphs: [
        gaps.length
          ? `缺${gaps.map((gap) => gap.field).join("、")}，这周只能标「数据不足」。`
          : "任务量、时间安排和下发对象都没问题，可以按计划做。",
      ],
      bullets: gaps.map((gap) => `缺 ${gap.field}`),
      citations: [],
      followUps: ["哪些任务数据不全？", "最近巡检了哪些任务？"],
      taskIds: [task.id],
    };
  }
  const minutes = minutesPerPersonOf(
    regionAggregates(
      state,
      weekStart(today),
      today,
      visibleRegionsOf(state, actor).map((region) => region.id),
    ),
    task.id,
  );
  return {
    id: `why:${task.id}`,
    intent: "task-why",
    title: `${task.title}为什么被标记`,
    paragraphs: [
      `${hit.length} 个原因：${[...new Set(hit.map(plainOf))].join("；")}。`,
      minutes ? `这项任务人均要花 ${minutes} 分钟。` : "",
    ].filter(Boolean),
    bullets: hit.map(
      (risk) => `${plainOf(risk)} · 建议：${risk.suggestion}`,
    ),
    citations: hit.map((risk) => riskCitation(state, risk)),
    followUps: ["现在有哪些任务需要我处理？", "这一周哪些任务重合了？"],
    taskIds: [task.id],
  };
};

/**
 * 本地确定性回答：只根据当前巡检状态与工作记录生成，说法保持业务化。
 * 复杂问题不猜：识别不了时返回可回答范围。
 */
export function localInspectionAnswer(
  state: InspectionState,
  actor: InspectionActor,
  question: string,
  today = inspectionDay(),
): AgentAnswer {
  const text = question.trim();
  const week = weekStart(today);
  const risks = visibleRisks(state, actor, week, today);
  const tasks = visibleTasks(state, actor);
  const askedTask =
    tasks.find((task) => text.includes(task.title)) ??
    tasks.find((task) => text.length >= 6 && task.title.includes(text));
  const asksWhy = /为什么|原因|依据|凭什么/.test(text) || !!askedTask;

  if (askedTask && asksWhy)
    return taskWhyAnswer(state, risks, askedTask, today, actor);
  // 自动巡检频次：可以问，也可以直接让 Agent 改
  const cadenceChange =
    parseCadenceMinutes(text) !== null &&
    /(改|设置|设成|调|换|变成|定成|调整)/.test(text);
  if (cadenceChange) return cadenceAnswer(state, text, true);
  if (asksCadence(text)) return cadenceAnswer(state, text, false);
  if (/变化|变动|差异|进展|新增|解除|跟上次|和上次/.test(text))
    return changesAnswer(state, actor, risks, today);
  if (/数据不全|数据不足|缺少|补齐|缺字段|字段/.test(text))
    return dataGapAnswer(state, actor);
  if (/重合|重复|重叠|撞车|挤在|冲突/.test(text))
    return overlapAnswer(state, risks);
  if (/人均|多少分钟|时长|负荷|工作量|任务量|忙不忙|忙吗/.test(text))
    return workloadAnswer(state, actor, today, text);
  if (/最危险|最高|最严重|最需要|优先|最该/.test(text))
    return topRiskAnswer(state, risks);
  if (/需要我|要处理|待处理|待办|还没|没处理|要做什么|下一步/.test(text))
    return pendingAnswer(state, risks);
  if (/巡检|扫过|检查过|看过/.test(text))
    return recentAnswer(state, actor, risks, today);
  if (matchRegion(state, text) || /区域|南区|北区|门店|巴厘|泗水|有哪些任务/.test(text))
    return regionAnswer(state, actor, risks, text, today);
  if (askedTask) return taskWhyAnswer(state, risks, askedTask, today, actor);
  return helpAnswer();
}

export interface AgentRequestOptions {
  /** 模拟思考耗时；接入真实模型时换成真实请求。 */
  delayMs?: number;
  today?: string;
}

/**
 * 对话入口：界面只依赖这一个函数。
 * 将来接入真实模型时，在这里替换实现（例如改为调用后端 /api/inspection-agent），
 * 输入输出保持 AgentAnswer 不变，界面与工作记录无需改动。
 */
export async function answerInspectionQuestion(
  state: InspectionState,
  actor: InspectionActor,
  question: string,
  _history: { role: "user" | "agent"; text: string }[] = [],
  options: AgentRequestOptions = {},
): Promise<AgentAnswer> {
  const delay = options.delayMs ?? 420;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  return localInspectionAnswer(state, actor, question, options.today);
}
