import assert from "node:assert/strict";
import test from "node:test";
import { createInspectionState } from "./inspectionData";
import { inspectionDay, weekStart } from "./inspectionEngine";
import {
  buildAdjustmentSuggestion,
  taskCreatorOf,
} from "./adjustmentSuggestion";

const state = () => createInspectionState();
const week = () => weekStart(inspectionDay());

test("调整建议：发给任务创建者，问题去重、动作来自巡检结论", () => {
  const current = state();
  const task = current.tasks.find((item) => item.id === "south-vip")!;
  const suggestion = buildAdjustmentSuggestion(
    current,
    task,
    week(),
    inspectionDay(),
  );
  assert.equal(suggestion.recipient.name, "Fitriani");
  assert.ok(suggestion.recipient.roleLabel.includes("任务创建者"));
  assert.ok(suggestion.title.includes(task.title));
  assert.ok(suggestion.problems.length > 0 && suggestion.problems.length <= 3);
  assert.equal(
    new Set(suggestion.problems).size,
    suggestion.problems.length,
    "同一类问题只保留一条",
  );
  for (const line of suggestion.problems) {
    const parts = line.split(" · ");
    assert.equal(
      new Set(parts).size,
      parts.length,
      `问题描述不要重复同一句：${line}`,
    );
    assert.ok(
      !/\d{4}-\d{2}-\d{2}/.test(line),
      `问题描述里的日期用 09/20 这种短写法：${line}`,
    );
  }
  assert.ok(suggestion.actions.length > 0);
  assert.ok(
    suggestion.impact.includes("分钟") || suggestion.impact.includes("人"),
  );
  assert.ok(suggestion.note.includes("巡检 Agent"));
});

test("调整建议：总部任务的创建者是总部负责人；无问题时也能给出草稿", () => {
  const current = state();
  const national = current.tasks.find((item) => item.id === "hq-product")!;
  assert.equal(taskCreatorOf(current, national).name, "Sarah Lee");

  const clean = structuredClone(current);
  clean.risks = clean.risks.map((record) => ({ ...record, status: "已解决" }));
  const suggestion = buildAdjustmentSuggestion(
    clean,
    national,
    week(),
    inspectionDay(),
  );
  assert.ok(suggestion.problems.length >= 1);
  assert.ok(suggestion.actions.length >= 1);
});
