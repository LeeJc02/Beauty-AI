import assert from "node:assert/strict";
import test from "node:test";
import { createInspectionState } from "./inspectionData";
import {
  addDays,
  applyDisposition,
  canActOnTask,
  canSeeTask,
  evaluateRisks,
  inspectionDay,
  missingFields,
  overviewSummary,
  personAggregates,
  regionAggregates,
  runInspection,
  simulateTaskChange,
  taskOccurrenceMinutes,
  weekStart,
} from "./inspectionEngine";
import type { InspectionActor, InspectionState } from "./inspectionTypes";

const today = inspectionDay();
const week = weekStart(today);
const base = () => createInspectionState();
const risksOf = (state: InspectionState, weeks: string[] = [week]) =>
  evaluateRisks(state, weeks, today);
const findRisk = (state: InspectionState, ruleId: string, taskIdOrRegion?: string) =>
  risksOf(state).find(
    (risk) =>
      risk.ruleId === ruleId &&
      (!taskIdOrRegion ||
        risk.taskIds.includes(taskIdOrRegion) ||
        risk.regionIds.includes(taskIdOrRegion)),
  );

const hq: InspectionActor = {
  id: "sarah",
  name: "Sarah Lee",
  hq: true,
  roleLabel: "总部培训经理",
};
const regional: InspectionActor = {
  id: "fitriani",
  name: "Fitriani",
  hq: false,
  regionId: "south",
  roleLabel: "区域培训主管",
};
const regionalReadOnly: InspectionActor = { ...regional, readOnly: true };

test("任务模型能识别类型、内容、人群、周期、频次、时长与负责人", () => {
  const state = base();
  const task = state.tasks.find((item) => item.id === "hq-product")!;
  assert.equal(task.kind, "study");
  assert.equal(task.weight, "must");
  assert.equal(taskOccurrenceMinutes(task), 35);
  assert.equal(task.frequency?.unit, "once");
  assert.ok((task.audience.resolvedPersonIds ?? []).length > 0);
  assert.equal(task.owners.hqOwnerName, "Sarah Lee");
  assert.equal(missingFields(task).length, 0);
});

test("数据缺失只输出数据不足，不判为违规", () => {
  const state = base();
  const task = state.tasks.find((item) => item.id === "surabaya-media")!;
  assert.ok(missingFields(task).length >= 3);
  const gap = findRisk(state, "F1", "surabaya-media");
  assert.equal(gap?.level, "insufficient");
  assert.equal(gap?.conclusion, "数据不足");
  const loads = regionAggregates(state, week, today);
  const surabaya = loads.find((load) => load.regionId === "surabaya")!;
  assert.equal(surabaya.unknownCount, 8);
  assert.equal(surabaya.overCapacityIds.length, 0);
  assert.equal(
    risksOf(state).some(
      (risk) => risk.ruleId === "A1" && risk.regionIds.includes("surabaya"),
    ),
    false,
  );
});

test("南区超容量、单日峰值与必修考试叠加均被识别", () => {
  const state = base();
  const capacity = findRisk(state, "A1", "south")!;
  assert.equal(capacity.level, "high");
  assert.ok(capacity.personIds.length >= 10);
  assert.ok(capacity.evidence.some((item) => item.text.includes("容量")));
  const peak = findRisk(state, "A3", "south")!;
  assert.equal(peak.level, "high");
  assert.ok((peak.metrics.peakMinutes as number) > (peak.metrics.limit as number));
  const stacked = findRisk(state, "A5", "south")!;
  assert.equal(stacked.level, "high");
  const gap = findRisk(state, "A6", "south")!;
  assert.ok((gap.metrics.mean as number) > (gap.metrics.peerMedian as number));
});

test("重复内容与误命中区域都能定位到人", () => {
  const state = base();
  const duplicate = findRisk(state, "C3", "south-study")!;
  assert.equal(duplicate.level, "medium");
  assert.ok(duplicate.personIds.length > 0);
  const wrongRegion = findRisk(state, "C2", "south-study")!;
  assert.equal(wrongRegion.level, "high");
  assert.equal(wrongRegion.personIds.length, 2);
  const practiceDuplicate = findRisk(state, "D2", "south-vip")!;
  assert.equal(practiceDuplicate.taskIds.length, 2);
  // 「角色不适用」这类结论已经下线，不再产出
  assert.equal(risksOf(state).some((risk) => risk.ruleId === "C4"), false);
});

test("品类覆盖：只在部分区域安排的品类会点名缺的区域", () => {
  const state = base();
  const coverage = risksOf(state).find((risk) => risk.ruleId === "G1")!;
  assert.ok(coverage);
  assert.equal(coverage.category, "G");
  assert.equal(coverage.level, "medium");
  assert.ok(coverage.title.includes("彩妆"));
  assert.ok(coverage.reason.includes("只在"));
  assert.ok(coverage.regionIds.length >= 2);
  assert.ok(coverage.regionIds.includes("south"));
  assert.ok(coverage.personIds.length > 0);
  assert.ok(coverage.taskIds.includes("north-makeup"));
  // 覆盖全部的品类（例如全国任务里的新品）不会产生结论
  assert.equal(
    risksOf(state).filter((risk) => risk.ruleId === "G1").length,
    1,
  );
});

test("考试缺少前置学习或顺序未声明时不放过", () => {
  const state = base();
  const missing = findRisk(state, "D3", "hq-exam-sensitive")!;
  assert.equal(missing.level, "high");
  assert.ok(missing.reason.includes("考试之后才开始"));
  // 演示数据里南区考核已声明前置顺序，不再输出顺序缺失；
  // 新建一场未声明顺序、且与同批人共享内容的考试时才命中 D1。
  const draft = structuredClone(state);
  const source = draft.tasks.find((task) => task.id === "south-exam")!;
  source.relations.prerequisiteTaskIds = [];
  source.relations.sequenceDefined = false;
  const unordered = findRisk(draft, "D1", "south-exam")!;
  assert.equal(unordered.level, "medium");
  assert.ok(unordered.taskIds.includes("hq-product"));
  assert.equal(
    risksOf(state).some((risk) => risk.ruleId === "D1"),
    false,
  );
});

test("执行风险覆盖逾期、临期进度与区域完成率异常", () => {
  const state = base();
  // 演示数据按「本周」排期，逾期分支只在一周后半段才自然出现；
  // 这里把日期固定成「已过期」与「明天截止」两种情形，保证规则在任何星期几都被覆盖。
  const overdueState = structuredClone(state);
  overdueState.tasks.find((task) => task.id === "hq-exam-sensitive")!.endsOn =
    addDays(today, -1);
  const overdue = findRisk(overdueState, "E1", "hq-exam-sensitive")!;
  assert.equal(overdue.level, "high");
  assert.ok(overdue.title.includes("逾期"));
  const soonState = structuredClone(state);
  soonState.tasks.find((task) => task.id === "south-exam")!.endsOn =
    addDays(today, 1);
  const soon = findRisk(soonState, "E1", "south-exam")!;
  assert.ok(soon.personIds.length >= 4);
  const regional = findRisk(state, "E3", "surabaya")!;
  assert.equal(regional.level, "medium");
  assert.ok(regional.hypothesis?.includes("推送"));
  const stale = findRisk(state, "E5", "south-exam")!;
  assert.equal(stale.level, "medium");
  assert.ok(stale.title.includes("员工名单"));
  assert.ok(stale.reason.includes("应命中 12 人"));
  assert.equal(stale.personIds.length, 10);
  const reminder = findRisk(state, "E4", "bali-exam-prep")!;
  assert.equal(reminder.level, "low");
});

test("员工聚合给出周期任务数、预计分钟、每日峰值与重复命中", () => {
  const state = base();
  const people = personAggregates(state, week, today, ["south"]);
  const first = people.find((person) => person.personId === "south-1")!;
  assert.ok(first.taskCount >= 6);
  assert.ok(first.plannedMinutes > 200);
  assert.ok(first.dailyPeak > 60);
  assert.ok(first.mandatoryCount >= 3);
  assert.ok(first.deadlineOverlaps >= 3);
  assert.ok(first.duplicateContents >= 1);
  assert.ok(first.byKind.study >= 1 && first.byKind.exam >= 1);
  const summary = overviewSummary(state, week, today);
  assert.ok(summary.high > 0);
  assert.ok(summary.affectedPeople > 0);
  assert.ok(summary.completenessRate < 1);
  assert.ok(summary.missingGroups.some((group) => group.field === "预计时长"));
});

test("发布前模拟即时给出人数、负荷与风险变化", () => {
  const state = base();
  const result = simulateTaskChange(state, "south-drill", {
    status: "paused",
  });
  assert.equal(result.peopleBefore, result.peopleAfter);
  assert.ok(result.meanAfter < result.meanBefore);
  assert.ok(result.resolved.some((risk) => risk.ruleId === "A4"));
  assert.ok(result.summary.includes("受影响人数"));
  assert.ok(result.reasons.length > 0);
  const reduced = simulateTaskChange(state, "south-vip", {
    frequency: { unit: "weekly", count: 2 },
  });
  assert.ok(reduced.meanAfter < reduced.meanBefore);
  const audience = simulateTaskChange(state, "hq-product", {
    audience: { resolvedPersonIds: ["south-1", "south-2"] },
  });
  assert.equal(audience.peopleAfter, 2);
  assert.ok(audience.peopleBefore > audience.peopleAfter);
});

test("处置动作保留操作人、原始版本、原因、预计影响与复查结果", () => {
  const state = runInspection(base(), new Date());
  const before = state.tasks.find((task) => task.id === "south-drill")!;
  const updated = applyDisposition(state, hq, {
    action: "reduce-frequency",
    taskId: "south-drill",
    reason: "南区本周负荷超容量，降低冲刺频次",
    patch: { frequency: { unit: "weekly", count: 2 } },
  });
  const record = updated.dispositions.at(-1)!;
  assert.equal(record.actorName, "Sarah Lee");
  assert.equal(record.taskVersionBefore, before.version);
  assert.equal(record.taskVersionAfter, before.version + 1);
  assert.ok(record.reason.includes("超容量"));
  assert.ok(record.expectedImpact.length > 0);
  assert.ok(record.patch["频次"]);
  assert.ok(record.recheck.summary.includes("重新审计"));
  const task = updated.tasks.find((item) => item.id === "south-drill")!;
  assert.equal(task.version, before.version + 1);
  assert.equal(task.frequency?.count, 2);
  assert.ok(
    !risksOf(updated).some(
      (risk) => risk.ruleId === "A4" && risk.taskIds.includes("south-drill"),
    ),
  );
});

test("区域角色只能处置本区域任务，只读角色不能提交处置", () => {
  const state = base();
  const southTask = state.tasks.find((task) => task.id === "south-study")!;
  const hqTask = state.tasks.find((task) => task.id === "hq-product")!;
  assert.equal(canSeeTask(regional, hqTask), true);
  assert.equal(canActOnTask(regional, hqTask), false);
  assert.equal(canActOnTask(regional, southTask), true);
  assert.throws(() =>
    applyDisposition(state, regional, {
      action: "adjust-deadline",
      taskId: "hq-product",
      reason: "总部任务需要总部确认",
      patch: { endsOn: addDays(week, 5) },
    }),
  );
  assert.throws(() =>
    applyDisposition(state, regionalReadOnly, {
      action: "adjust-deadline",
      taskId: "south-study",
      reason: "只读角色不允许调整",
      patch: { endsOn: addDays(week, 5) },
    }),
  );
  const updated = applyDisposition(state, regional, {
    action: "adjust-deadline",
    taskId: "south-study",
    reason: "南区截止日与考核冲突，顺延一天",
    patch: { endsOn: addDays(week, 5) },
  });
  assert.equal(updated.dispositions.at(-1)?.actorName, "Fitriani");
  assert.ok(updated.dispositions.at(-1)?.expectedImpact);
});

test("风险台账记录处理中、已解决与复发", () => {
  let state = runInspection(base(), new Date());
  const key = `${week}:A:A4:south-drill`;
  const record = state.risks.find((item) => item.key === key)!;
  assert.equal(record.status, "待处理");
  state = applyDisposition(state, hq, {
    action: "reduce-frequency",
    taskId: "south-drill",
    reason: "降低频次后重新审计",
    patch: { frequency: { unit: "weekly", count: 3 } },
  });
  assert.equal(state.risks.find((item) => item.key === key)?.status, "已解决");
  state = applyDisposition(state, hq, {
    action: "adjust-task",
    taskId: "south-drill",
    reason: "为了验证复发重新提高频次",
    patch: { frequency: { unit: "weekly", count: 6 } },
  });
  const reopened = state.risks.find((item) => item.key === key)!;
  assert.notEqual(reopened.status, "已解决");
  assert.equal(reopened.recurrence, 1);
  assert.ok(
    reopened.history.some((event) => event.text.includes("相同问题再次出现")),
  );
});

test("合理例外需要总部审批，并保留到期时间", () => {
  let state = runInspection(base(), new Date());
  const key = `${week}:B:B3:south`;
  state = applyDisposition(state, regional, {
    action: "mark-exception",
    taskId: "south-study",
    reason: "该重复安排由区域确认，属于合理例外范围",
    patch: {},
    exception: {
      riskKey: key,
      ruleId: "B3",
      expiresOn: addDays(today, 14),
    },
  });
  const pending = state.risks.find((item) => item.key === key)!;
  assert.equal(pending.status, "需确认");
  assert.equal(state.exceptions.at(-1)?.status, "pending");
  state = applyDisposition(state, hq, {
    action: "mark-exception",
    taskId: "hq-product",
    reason: "总部确认该风险属于合理例外，保留到期日",
    patch: {},
    exception: {
      riskKey: `${week}:B:B4:hq-practice`,
      ruleId: "B4",
      expiresOn: addDays(today, 7),
    },
  });
  const approved = state.exceptions.at(-1)!;
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedBy, "Sarah Lee");
  assert.equal(
    state.risks.find((item) => item.key === approved.riskKey)?.status,
    "例外生效",
  );
});

test("合并重复任务会暂停重复任务并记录版本", () => {
  const state = runInspection(base(), new Date());
  const mergedBefore = state.tasks.find((task) => task.id === "north-makeup")!;
  const updated = applyDisposition(state, hq, {
    action: "merge-duplicates",
    taskId: "hq-product",
    reason: "与总部必修同源，合并到总部任务",
    patch: {},
    mergeTaskIds: ["north-makeup"],
  });
  const merged = updated.tasks.find((task) => task.id === "north-makeup")!;
  assert.equal(merged.mergedIntoId, "hq-product");
  assert.equal(merged.version, mergedBefore.version + 1);
  assert.equal(merged.status, "paused");
  assert.ok(updated.dispositions.at(-1)?.patch["合并的重复任务"]);
  const weekRisks = evaluateRisks(updated, [week], today);
  assert.equal(
    weekRisks.some((risk) => risk.taskIds.includes("north-makeup")),
    false,
  );
});

test("任务周期与频次不匹配、发布时间滞后、长期无复查可被识别", () => {
  const state = base();
  const mismatch = findRisk(state, "B2", "north-sprint")!;
  assert.equal(mismatch.level, "high");
  const late = findRisk(state, "B4", "hq-practice")!;
  assert.equal(late.level, "medium");
  assert.equal(late.metrics.delayDays, 2);
  const longRunning = findRisk(state, "B5", "hq-longterm")!;
  assert.equal(longRunning.level, "low");
});

/* ---------------------------------------------------------- 审计工作记录 */

const blankRuns = (state: InspectionState): InspectionState => ({
  ...state,
  inspectionRuns: [],
});
const at = (day: string, clock: string) =>
  new Date(`${day}T${clock}:00+07:00`);

test("演示数据自带近 7 天的审计工作记录", () => {
  const state = base();
  assert.equal(state.inspectionRuns.length, 4);
  const latest = state.inspectionRuns.at(-1)!;
  assert.equal(latest.trigger, "auto");
  assert.equal(latest.taskResults.length, latest.taskCount);
  assert.ok(latest.added.length > 0);
  assert.ok(
    state.inspectionRuns.some((record) =>
      record.resolved.some((change) => change.ruleId === "B4"),
    ),
  );
  assert.ok(
    state.inspectionRuns.every((record) =>
      record.taskResults.every((result) =>
        state.tasks.some((task) => task.id === result.taskId),
      ),
    ),
  );
});

test("结论没有变化时合并批次，跨天或出现变化时新增批次", () => {
  const day = inspectionDay();
  const first = runInspection(blankRuns(base()), at(day, "09:00"));
  assert.equal(first.inspectionRuns.length, 1);
  const record = first.inspectionRuns[0];
  assert.equal(record.trigger, "auto");
  assert.equal(record.repeatCount, 1);
  assert.equal(record.taskResults.length, record.taskCount);
  assert.equal(
    record.dataGapTaskCount,
    first.tasks.filter(
      (task) =>
        task.status !== "disabled" &&
        !task.mergedIntoId &&
        missingFields(task).length > 0,
    ).length,
  );

  const repeat = runInspection(first, at(day, "09:01"));
  assert.equal(repeat.inspectionRuns.length, 1);
  assert.equal(repeat.inspectionRuns[0].repeatCount, 2);
  assert.equal(
    repeat.inspectionRuns[0].lastSeenAt,
    at(day, "09:01").toISOString(),
  );
  assert.equal(repeat.inspectionRuns[0].at, first.inspectionRuns[0].at);

  const nextDay = runInspection(repeat, at(addDays(day, 1), "09:00"));
  assert.equal(nextDay.inspectionRuns.length, 2);
  assert.equal(nextDay.inspectionRuns.at(-1)!.repeatCount, 1);

  const paused = runInspection(
    nextDay,
    at(addDays(day, 1), "09:05"),
    [],
    { record: "auto" },
  );
  assert.equal(paused.inspectionRuns.length, 2);
});

test("手动审计始终留下一条批次，并记录执行人", () => {
  const day = inspectionDay();
  const first = runInspection(blankRuns(base()), at(day, "09:00"));
  const manual = runInspection(first, at(day, "09:05"), [], {
    record: "manual",
    actorName: "Sarah Lee",
    roleLabel: "总部培训经理",
  });
  assert.equal(manual.inspectionRuns.length, 2);
  const record = manual.inspectionRuns.at(-1)!;
  assert.equal(record.trigger, "manual");
  assert.equal(record.actorName, "Sarah Lee");
  assert.equal(record.roleLabel, "总部培训经理");
  assert.equal(record.repeatCount, 1);
});

test("初始化读取本地数据不会写入新的批次", () => {
  const day = inspectionDay();
  const state = base();
  const silent = runInspection(
    { ...state, inspectionRuns: [] },
    at(day, "09:00"),
    [],
    { record: "none" },
  );
  assert.equal(silent.inspectionRuns.length, 0);
  assert.ok(silent.lastRunAt);
});

test("覆盖任务变化会新增批次，并同步逐任务结论", () => {
  const day = inspectionDay();
  const first = runInspection(blankRuns(base()), at(day, "09:00"));
  const before = first.inspectionRuns[0];
  const disabled = runInspection(
    {
      ...first,
      tasks: first.tasks.map((task) =>
        task.id === "hq-quote" ? { ...task, status: "disabled" as const } : task,
      ),
    },
    at(day, "09:05"),
  );
  assert.equal(disabled.inspectionRuns.length, 2);
  const record = disabled.inspectionRuns.at(-1)!;
  assert.equal(record.taskCount, before.taskCount - 1);
  assert.equal(
    record.taskResults.some((result) => result.taskId === "hq-quote"),
    false,
  );
  const hit = record.taskResults.find((result) => result.ruleIds.length);
  assert.ok(hit);
  assert.ok(hit.ruleIds.every((ruleId) => /^[A-F]\d$/.test(ruleId)));
});

test("批次记录保留最近 60 条", () => {
  const day = inspectionDay();
  const first = runInspection(blankRuns(base()), at(day, "09:00"));
  const template = first.inspectionRuns[0];
  const bulk = {
    ...first,
    inspectionRuns: Array.from({ length: 60 }, (_, index) => ({
      ...template,
      id: `bulk-${index}`,
      at: at(addDays(day, -60 + index), "09:00").toISOString(),
      lastSeenAt: at(addDays(day, -60 + index), "09:00").toISOString(),
    })),
  };
  const after = runInspection(bulk, at(day, "09:10"), [], { record: "manual" });
  assert.equal(after.inspectionRuns.length, 60);
  assert.equal(after.inspectionRuns.at(-1)!.trigger, "manual");
  assert.equal(after.inspectionRuns[0].id, "bulk-1");
});

test("同一结论同时命中本周与下周时，工作记录只记一条", () => {
  const day = inspectionDay();
  const first = runInspection(blankRuns(base()), at(day, "09:00"));
  const signatures = first.inspectionRuns[0].added.map(
    (change) => `${change.ruleId}|${change.title}`,
  );
  assert.equal(new Set(signatures).size, signatures.length);

  const seeded = base().inspectionRuns.flatMap((record) =>
    record.added.map((change) => `${change.ruleId}|${change.title}`),
  );
  assert.equal(new Set(seeded).size, seeded.length);

  const manual = runInspection(
    { ...first, inspectionRuns: [] },
    at(day, "10:00"),
    [],
    { record: "manual" },
  );
  const addedSignatures = manual.inspectionRuns[0].added.map(
    (change) => `${change.ruleId}|${change.title}`,
  );
  assert.equal(
    new Set(addedSignatures).size,
    addedSignatures.length,
  );
});
