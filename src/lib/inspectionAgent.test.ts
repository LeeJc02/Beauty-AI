import assert from "node:assert/strict";
import test from "node:test";
import { createInspectionState } from "./inspectionData";
import {
  answerInspectionQuestion,
  localInspectionAnswer,
  openRisksOf,
  visibleRisks,
  visibleTasks,
} from "./inspectionAgent";
import {
  formatCadence,
  inspectionDay,
  parseCadenceMinutes,
  weekStart,
} from "./inspectionEngine";
import type { InspectionActor, InspectionState } from "./inspectionTypes";

const today = inspectionDay();
const week = weekStart(today);
const state = (): InspectionState => createInspectionState();

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

test("最近巡检问题回答覆盖了哪些任务，并引用巡检记录", () => {
  const current = state();
  const answer = localInspectionAnswer(current, hq, "最近巡检了哪些任务？");
  assert.equal(answer.intent, "recent");
  assert.ok(answer.bullets.length > 0);
  assert.ok(answer.citations[0].label.includes("巡检记录"));
  assert.ok(answer.paragraphs[0].includes("项任务"));
  assert.ok(answer.taskIds.length > 0);
});

test("待处理问题的数量与当前可见结论一致", () => {
  const current = state();
  const open = openRisksOf(current, visibleRisks(current, hq, week, today));
  const answer = localInspectionAnswer(
    current,
    hq,
    "现在有哪些任务需要我处理？",
  );
  assert.equal(answer.intent, "pending");
  assert.ok(answer.title.includes(String(open.length)));
  assert.ok(answer.bullets.length <= 6);
});

test("最高风险问题给出结论、证据与需要确认的人", () => {
  const current = state();
  const open = openRisksOf(current, visibleRisks(current, hq, week, today));
  const answer = localInspectionAnswer(current, hq, "风险最高的任务是什么？");
  assert.equal(answer.intent, "top-risk");
  assert.equal(answer.citations[0].taskId, open[0].taskIds[0]);
  assert.ok(answer.bullets.length > 0);
  assert.ok(answer.paragraphs.some((text) => text.includes("需要确认")));
});

test("数据不全与变化两个问题命中各自意图", () => {
  const current = state();
  const gaps = localInspectionAnswer(current, hq, "哪些任务数据不全？");
  assert.equal(gaps.intent, "data-gaps");
  const changes = localInspectionAnswer(
    current,
    hq,
    "上次巡检到现在有什么变化？",
  );
  assert.equal(changes.intent, "changes");
  assert.ok(changes.paragraphs[0].includes("到"));
});

test("区域问题按简称命中区域，总部可以查看任一区域", () => {
  const current = state();
  const north = localInspectionAnswer(current, hq, "北区现在什么情况？");
  assert.equal(north.intent, "region");
  assert.ok(north.title.includes("雅加达北区"));
  const bali = localInspectionAnswer(current, hq, "巴厘岛情况如何？");
  assert.ok(bali.title.includes("巴厘岛"));
});

test("区域角色问其他区域时按权限拒绝并说明可见范围", () => {
  const current = state();
  const answer = localInspectionAnswer(current, south, "北区现在什么情况？");
  assert.equal(answer.intent, "region");
  assert.ok(answer.title.includes("不在当前账号的可见范围"));
  assert.equal(
    answer.bullets.some((bullet) => bullet.includes("北区")),
    false,
  );
});

test("区域角色只看到本区域的任务与结论", () => {
  const current = state();
  const tasks = visibleTasks(current, south);
  assert.ok(tasks.length > 0);
  assert.ok(
    tasks.every(
      (task) =>
        !task.audience.regionIds.length ||
        task.audience.regionIds.includes("south"),
    ),
  );
  const risks = visibleRisks(current, south, week, today);
  assert.ok(
    risks.every(
      (risk) =>
        !risk.regionIds.length || risk.regionIds.every((id) => id === "south"),
    ),
  );
});

test("按任务提问时回答该任务为什么被标记", () => {
  const current = state();
  const answer = localInspectionAnswer(
    current,
    hq,
    "南区数字人剧本通关冲刺为什么被标记？",
  );
  assert.equal(answer.intent, "task-why");
  assert.ok(answer.title.includes("南区数字人剧本通关冲刺"));
  assert.ok(answer.bullets.length > 0);
});

test("问不到的问题返回可回答范围，不编造结论", () => {
  const current = state();
  const answer = localInspectionAnswer(current, hq, "今天天气怎么样？");
  assert.equal(answer.intent, "help");
  assert.ok(answer.followUps.length >= 6);
  assert.ok(answer.bullets.length === 0);
});

test("回答引用的任务 ID 都能在任务列表里找到", () => {
  const current = state();
  const questions = [
    "最近巡检了哪些任务？",
    "现在有哪些任务需要我处理？",
    "风险最高的任务是什么？",
    "哪些任务数据不全？",
    "上次巡检到现在有什么变化？",
    "南区现在什么情况？",
    "南区数字人剧本通关冲刺为什么被标记？",
  ];
  for (const question of questions) {
    const answer = localInspectionAnswer(current, hq, question);
    for (const taskId of [
      ...answer.taskIds,
      ...answer.citations
        .map((citation) => citation.taskId)
        .filter(Boolean) as string[],
    ]) {
      assert.ok(
        current.tasks.some((task) => task.id === taskId),
        `${question} 引用了不存在的任务 ${taskId}`,
      );
    }
  }
});

test("对话入口与本地回答保持一致，方便将来替换成真实模型", async () => {
  const current = state();
  const local = localInspectionAnswer(current, hq, "最近巡检了哪些任务？");
  const viaAdapter = await answerInspectionQuestion(
    current,
    hq,
    "最近巡检了哪些任务？",
    [],
    { delayMs: 0 },
  );
  assert.deepEqual(viaAdapter, local);
});

test("自动巡检频次：可以问，也可以让 Agent 改", () => {
  const current = state();
  const asked = localInspectionAnswer(current, hq, "自动巡检多久跑一次？");
  assert.equal(asked.intent, "cadence");
  assert.equal(asked.action, undefined);
  assert.ok(asked.title.includes("30 分钟"));
  assert.ok(asked.paragraphs[0].includes("30 分钟"));

  const changed = localInspectionAnswer(
    current,
    hq,
    "把巡检频率改成每 2 小时一次",
  );
  assert.equal(changed.intent, "cadence");
  assert.deepEqual(changed.action, { type: "set-cadence", minutes: 120 });
  assert.ok(changed.title.includes("2 小时"));
  assert.ok(changed.paragraphs[0].includes("改成"));

  assert.equal(formatCadence(30), "30 分钟");
  assert.equal(formatCadence(60), "1 小时");
  assert.equal(formatCadence(120), "2 小时");
  assert.equal(parseCadenceMinutes("每半小时一次"), 30);
  assert.equal(parseCadenceMinutes("每 15 分钟"), 15);
  assert.equal(parseCadenceMinutes("多久跑一次"), null);
});
