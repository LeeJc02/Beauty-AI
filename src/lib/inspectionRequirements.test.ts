import assert from "node:assert/strict";
import test from "node:test";
import { createInspectionState } from "./inspectionData";
import { addDays, inspectionDay, weekStart } from "./inspectionEngine";
import {
  REQUIREMENT_ASPECTS,
  VALID_ASPECTS,
  aspectOfRule,
  defaultRequirementName,
  describeRequirement,
  matchRequirementIntent,
  nextRunAt,
  parseAspectsFromText,
  parseCadenceFromText,
  parseCategoriesFromText,
  parsePeriodFromText,
  parseRegionFromText,
  parseReplyCommand,
  requirementCategories,
  requirementDue,
  requirementIssues,
  requirementRisks,
  requirementStatusOf,
  requirementVisibleTo,
  runRequirement,
} from "./inspectionRequirements";
import type {
  InspectionActor,
  InspectionState,
} from "./inspectionTypes";
import type { InspectionRequirement, RequirementAspect } from "./inspectionRequirements";

const today = inspectionDay();
const week = weekStart(today);
const state = (): InspectionState => createInspectionState();

const draft = (
  overrides: Partial<InspectionRequirement> = {},
): InspectionRequirement => ({
  id: "req-test",
  name: "测试审计",
  aspects: ["duplicate"],
  categories: [],
  regionId: null,
  cadence: "weekly",
  startsOn: today,
  endsOn: null,
  status: "active",
  createdAt: `${today}T01:30:00.000Z`,
  createdBy: "sarah",
  nextRunAt: null,
  lastRunAt: null,
  lastViewedAt: null,
  lastAutoDay: null,
  runs: [],
  ...overrides,
});

const hq: InspectionActor = {
  id: "sarah",
  name: "Sarah Lee",
  hq: true,
  roleLabel: "总部培训经理",
};
const south: InspectionActor = {
  id: "fitriani",
  name: "Fitriani",
  hq: false,
  regionId: "south",
  roleLabel: "南区培训主管",
};

test("关注方面：引擎规则映射到业务方面，未知规则不归任何方面", () => {
  assert.equal(aspectOfRule("A1"), "workload");
  assert.equal(aspectOfRule("A5"), "crowding");
  assert.equal(aspectOfRule("B3"), "crowding");
  assert.equal(aspectOfRule("C3"), "duplicate");
  assert.equal(aspectOfRule("D3"), "duplicate");
  assert.equal(aspectOfRule("F1"), "data-gap");
  assert.equal(aspectOfRule("E1"), null);
  assert.equal(aspectOfRule("Z9"), null);
});

test("需求范围：只保留选中的方面，区域需求只看本区域与全国任务", () => {
  const current = state();
  const duplicate = requirementRisks(
    current,
    { aspects: ["duplicate"], regionId: null },
    week,
    today,
  );
  assert.ok(duplicate.length > 0);
  assert.ok(
    duplicate.every((risk) => aspectOfRule(risk.ruleId) === "duplicate"),
  );

  const north = requirementRisks(
    current,
    { aspects: ["workload"], regionId: "north" },
    week,
    today,
  );
  assert.ok(north.length > 0);
  for (const risk of north) {
    const tasks = risk.taskIds
      .map((id) => current.tasks.find((task) => task.id === id))
      .filter(Boolean);
    if (!tasks.length) continue;
    assert.ok(
      tasks.some(
        (task) =>
          task!.audience.scope === "nationwide" ||
          task!.audience.regionIds.includes("north"),
      ),
    );
  }

  const multi = requirementRisks(
    current,
    { aspects: ["duplicate", "data-gap"], regionId: null },
    week,
    today,
  );
  const single = requirementRisks(
    current,
    { aspects: ["duplicate"], regionId: null },
    week,
    today,
  );
  assert.ok(multi.length > single.length);
});

test("区域需求：人数与区域都收窄到本区域，不把全国人数算进来", () => {
  const current = state();
  const national = requirementRisks(
    current,
    { aspects: ["crowding"], regionId: null },
    week,
    today,
  );
  const south = requirementRisks(
    current,
    { aspects: ["crowding"], regionId: "south" },
    week,
    today,
  );
  assert.ok(national.length > 0 && south.length > 0);
  const nationalPeople = Math.max(
    ...national.map((risk) => risk.impact.affectedPeople),
  );
  const southPeople = Math.max(
    ...south.map((risk) => risk.impact.affectedPeople),
  );
  assert.ok(southPeople < nationalPeople);
  assert.ok(
    south.every((risk) =>
      risk.personIds.every(
        (id) => current.people.find((person) => person.id === id)?.regionId === "south",
      ),
    ),
  );
  assert.ok(south.every((risk) => !risk.regionIds.length || risk.regionIds.includes("south")));
});

test("运行记录：影响人数去重，缺预计时长的人不计入人均分钟", () => {
  const current = state();
  const requirement = draft({ aspects: ["workload"] });
  const next = runRequirement(
    current,
    requirement,
    new Date(`${today}T01:30:00Z`),
    "auto",
    week,
  );
  const run = next.runs.at(-1)!;
  assert.equal(next.runs.length, 1);
  assert.ok(run.taskCount > 0);
  assert.ok(run.issueCount > 0);
  assert.ok(run.peopleCount > 0);
  assert.equal(run.unknownPeople, 0);
  assert.ok(run.meanMinutes > 0);
  assert.equal(run.trigger, "auto");
  assert.equal(next.lastAutoDay, today);
  assert.ok(run.taskLines.length > 0);

  const withGaps = runRequirement(
    current,
    draft({ aspects: ["duplicate"] }),
    new Date(`${today}T01:30:00Z`),
    "auto",
    week,
  ).runs.at(-1)!;
  assert.ok(withGaps.unknownPeople > 0);
  // 影响人数 = 结论里的人员并集（按人去重）
  const union = new Set(
    requirementRisks(current, draft({ aspects: ["duplicate"] }), week, today).flatMap(
      (risk) => risk.personIds,
    ),
  );
  assert.ok(withGaps.peopleCount <= union.size);
  assert.ok(withGaps.peopleCount > 0);
});

test("运行记录：结论没变只推进时间与连续次数，结论变了才新增一条", () => {
  const current = state();
  const now = new Date(`${today}T01:30:00Z`);
  const first = runRequirement(
    current,
    draft({ aspects: ["duplicate"] }),
    now,
    "auto",
    week,
  );
  const again = runRequirement(
    current,
    first,
    new Date(`${today}T02:30:00Z`),
    "auto",
    week,
  );
  assert.equal(again.runs.length, 1);
  assert.equal(again.runs[0].repeatCount, 2);
  assert.equal(again.runs[0].at, first.runs[0].at);
  assert.equal(again.runs[0].lastSeenAt, new Date(`${today}T02:30:00Z`).toISOString());

  // 把其中一条结论标成已解决，再跑一次：新增一条记录，并给出「已解决」
  const resolvedKey = first.runs[0].issueIndex[0].key;
  const patched: InspectionState = {
    ...current,
    risks: current.risks.map((record) =>
      record.key === resolvedKey ? { ...record, status: "已解决" } : record,
    ),
  };
  const changed = runRequirement(
    patched,
    again,
    new Date(`${today}T03:30:00Z`),
    "manual",
    week,
  );
  assert.equal(changed.runs.length, 2);
  const latest = changed.runs.at(-1)!;
  assert.equal(latest.trigger, "manual");
  assert.equal(latest.repeatCount, 1);
  assert.ok(latest.resolved.length >= 1);
  assert.ok(latest.resolved.every((item) => item.label.length > 0));
  assert.ok(latest.issueCount < first.runs[0].issueCount);
});

test("到点判定：每天 / 每周一 / 每月 1 日，08:00 前不跑，同一天只补一期", () => {
  const beforeSlot = new Date(`${today}T00:30:00Z`); // 雅加达 07:30
  const afterSlot = new Date(`${today}T01:30:00Z`); // 雅加达 08:30
  assert.equal(requirementDue(draft({ cadence: "daily" }), beforeSlot), false);
  assert.equal(requirementDue(draft({ cadence: "daily" }), afterSlot), true);

  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  assert.equal(
    requirementDue(draft({ cadence: "weekly" }), afterSlot),
    weekday === 1,
  );
  assert.equal(
    requirementDue(draft({ cadence: "monthly" }), afterSlot),
    today.endsWith("-01"),
  );

  const ranToday = draft({ cadence: "daily", lastAutoDay: today });
  assert.equal(requirementDue(ranToday, afterSlot), false);
  assert.equal(requirementDue(draft({ cadence: "daily", status: "paused" }), afterSlot), false);
  assert.equal(
    requirementDue(draft({ cadence: "daily", endsOn: "2020-01-01" }), afterSlot),
    false,
  );
  assert.equal(
    requirementDue(draft({ cadence: "daily", startsOn: "2099-01-01" }), afterSlot),
    false,
  );
});

test("下次运行时间与结束状态：暂停 / 到期都不再排期", () => {
  const now = new Date(`${today}T02:00:00Z`);
  const daily = nextRunAt(draft({ cadence: "daily" }), now);
  assert.equal(daily, new Date(`${today}T01:00:00Z`).toISOString().replace(`${today}T01:00:00.000Z`, daily!));
  assert.ok(daily && daily > now.toISOString());
  assert.equal(nextRunAt(draft({ cadence: "weekly", status: "paused" }), now), null);
  assert.equal(requirementStatusOf(draft({ endsOn: "2020-01-01" })), "finished");
  assert.equal(
    nextRunAt(draft({ cadence: "daily", endsOn: "2020-01-01" }), now),
    null,
  );
});

test("区域账号：只看到本区域与全国需求；总部看全部", () => {
  assert.equal(requirementVisibleTo({ regionId: null }, hq), true);
  assert.equal(requirementVisibleTo({ regionId: "north" }, hq), true);
  assert.equal(requirementVisibleTo({ regionId: "south" }, south), true);
  assert.equal(requirementVisibleTo({ regionId: null }, south), true);
  assert.equal(requirementVisibleTo({ regionId: "north" }, south), false);

  const current = state();
  const national = requirementIssues(
    current,
    { aspects: ["duplicate"], regionId: null },
    south,
    week,
    today,
  );
  assert.ok(national.length > 0);
  for (const risk of national) {
    const regionIds = risk.regionIds;
    assert.ok(
      !regionIds.length || regionIds.includes("south"),
      "区域账号只看得到本区域的结论",
    );
  }
});

test("对话意图与文案：说新建审计才进向导，名称与描述可读", () => {
  assert.equal(matchRequirementIntent("帮我新建一个审计需求"), true);
  assert.equal(matchRequirementIntent("创建一个重复布置的检查"), true);
  assert.equal(matchRequirementIntent("最近审计了哪些任务？"), false);
  assert.equal(matchRequirementIntent("这一周哪些任务重合了？"), false);

  const current = state();
  const name = defaultRequirementName(current, {
    aspects: ["duplicate"],
    regionId: "south",
    cadence: "weekly",
  });
  assert.equal(name, "雅加达南区重复布置审计");
  assert.ok(name.length <= 12);

  const description = describeRequirement(current, {
    aspects: ["duplicate", "crowding"],
    regionId: "south",
    cadence: "daily",
    startsOn: today,
    endsOn: null,
  });
  assert.ok(description.includes("雅加达南区"));
  assert.ok(description.includes("每天 08:00"));
  assert.ok(description.includes("重复布置、时间集中"));
  assert.ok(description.includes("长期"));
});

test("关注方面为空的需求不会产出任何问题", () => {
  const current = state();
  const empty = requirementRisks(
    current,
    { aspects: [] as RequirementAspect[], regionId: null },
    week,
    today,
  );
  assert.equal(empty.length, 0);
  const run = runRequirement(current, draft({ aspects: [] }), new Date(`${today}T01:30:00Z`), "auto", week);
  assert.equal(run.runs.at(-1)!.issueCount, 0);
  assert.equal(run.runs.at(-1)!.peopleCount, 0);
});

test("打字也能回答：方面、范围、周期、起止时间都能从自然语言解析", () => {
  const current = state();

  assert.deepEqual(parseAspectsFromText("重复布置和时间集中都要盯"), [
    "duplicate",
    "crowding",
  ]);
  assert.deepEqual(parseAspectsFromText("都要"), [...REQUIREMENT_ASPECTS]);
  assert.deepEqual(parseAspectsFromText("就是任务太忙"), ["workload"]);
  assert.deepEqual(parseAspectsFromText("看看新品的重复情况"), [
    "duplicate",
    "category",
  ]);
  assert.deepEqual(parseAspectsFromText("今天天气不错"), []);

  assert.deepEqual(parseRegionFromText(current, hq, "看下南区"), {
    regionId: "south",
  });
  assert.deepEqual(parseRegionFromText(current, hq, "全国范围"), {
    regionId: null,
  });
  assert.deepEqual(parseRegionFromText(current, south, "全国"), {
    regionId: "south",
  });
  assert.equal(parseRegionFromText(current, hq, "上海"), null);

  assert.equal(parseCadenceFromText("每天都跑"), "daily");
  assert.equal(parseCadenceFromText("每周一早上"), "weekly");
  assert.equal(parseCadenceFromText("每月 1 日"), "monthly");
  assert.equal(parseCadenceFromText("看心情"), null);

  assert.deepEqual(parsePeriodFromText("从今天起连续 4 周", today), {
    startsOn: today,
    endsOn: addDays(today, 27),
  });
  assert.deepEqual(parsePeriodFromText("9月20日到12月31日", today), {
    startsOn: `${today.slice(0, 4)}-09-20`,
    endsOn: `${today.slice(0, 4)}-12-31`,
  });
  assert.deepEqual(parsePeriodFromText("长期有效", today), {
    startsOn: today,
    endsOn: null,
  });
  assert.deepEqual(parsePeriodFromText("2026-09-20 开始", today), {
    startsOn: "2026-09-20",
    endsOn: null,
  });
  assert.equal(parsePeriodFromText("随便啦", today), null);

  assert.equal(parseReplyCommand("确认"), "confirm");
  assert.equal(parseReplyCommand("可以，就这么建"), "confirm");
  assert.equal(parseReplyCommand("算了，不建了"), "cancel");
  assert.equal(parseReplyCommand("返回修改"), "back");
  assert.equal(parseReplyCommand("不确定"), null);
});

test("包含特定品类：品类来自任务数据，问题只看这些品类的任务", () => {
  const current = state();
  const categories = requirementCategories(current);
  assert.equal(categories[0].name, "新品");
  assert.equal(categories[0].taskCount, 9);
  assert.ok(categories.some((item) => item.name === "敏感肌"));
  assert.ok(categories.some((item) => item.name === "彩妆"));

  assert.deepEqual(parseCategoriesFromText(current, hq, "新品和敏感肌"), [
    "新品",
    "敏感肌",
  ]);
  assert.deepEqual(
    parseCategoriesFromText(current, hq, "都要").map((name) => !!name),
    categories.map((item) => !!item.name),
  );
  assert.deepEqual(parseCategoriesFromText(current, hq, "随便看看"), []);

  // 只盯品类、不限定规则：这一类品类上的问题都算
  const sensitive = requirementRisks(
    current,
    { aspects: ["category"], categories: ["敏感肌"], regionId: null },
    week,
    today,
  );
  assert.ok(sensitive.length > 0);
  for (const risk of sensitive)
    assert.ok(
      risk.taskIds.some((taskId) =>
        (current.tasks.find((task) => task.id === taskId)?.categories ?? []).includes(
          "敏感肌",
        ),
      ),
    );

  const makeup = requirementRisks(
    current,
    { aspects: ["category"], categories: ["彩妆"], regionId: null },
    week,
    today,
  );
  assert.ok(
    makeup.every((risk) =>
      risk.taskIds.some((taskId) =>
        (current.tasks.find((task) => task.id === taskId)?.categories ?? []).includes(
          "彩妆",
        ),
      ),
    ),
  );

  // 品类 + 规则方面：两个条件同时成立
  const scoped = requirementRisks(
    current,
    {
      aspects: ["category", "duplicate"],
      categories: ["新品"],
      regionId: null,
    },
    week,
    today,
  );
  assert.ok(scoped.length > 0);
  assert.ok(scoped.every((risk) => aspectOfRule(risk.ruleId) === "duplicate"));

  const run = runRequirement(
    current,
    {
      ...draft({ aspects: ["category"], categories: ["新品"] }),
    },
    new Date(`${today}T01:30:00Z`),
    "auto",
    week,
  ).runs.at(-1)!;
  assert.ok(run.issueCount > 0);
  assert.ok(run.peopleCount > 0);

  const name = defaultRequirementName(current, {
    aspects: ["category"],
    categories: ["新品"],
    regionId: null,
    cadence: "weekly",
  });
  assert.equal(name, "全国新品每周审计");
  const description = describeRequirement(current, {
    aspects: ["category"],
    categories: ["新品", "敏感肌"],
    regionId: "south",
    cadence: "daily",
    startsOn: today,
    endsOn: null,
  });
  assert.ok(description.includes("包含特定品类（新品、敏感肌）"));
});

test("新的关注方面列表里不再提供数据不全，但历史存档仍然认", () => {
  assert.ok(REQUIREMENT_ASPECTS.includes("category"));
  assert.ok(!REQUIREMENT_ASPECTS.includes("data-gap"));
  assert.ok(VALID_ASPECTS.includes("data-gap"));
});
