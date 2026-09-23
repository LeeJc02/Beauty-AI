import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_STEP_NARRATION,
  AUDIT_TOOL_LIST,
  auditContext,
  buildAuditReport,
  planFor,
  runAuditTool,
  specFor,
} from "./auditTools";
import { createInspectionState } from "./inspectionData";
import { inspectionDay, weekStart } from "./inspectionEngine";
import type { InspectionActor } from "./inspectionTypes";

const actor: InspectionActor = {
  id: "sarah",
  name: "Sarah Lee",
  hq: true,
  roleLabel: "总部培训经理",
};

function fixture() {
  const state = createInspectionState();
  const today = inspectionDay();
  return { state, ctx: auditContext(state, actor, weekStart(today), today) };
}

test("ADM 仅保留范围授权归属，其余工具归属 SV，权限标识保持不变", () => {
  const { state, ctx } = fixture();
  const permissions = {
    query_scope: "supervisor:scope:read",
    check_data_gaps: "supervisor:data-quality:read",
    query_training_overview: "supervisor:training-overview:read",
    query_region_comparison: "supervisor:region-comparison:read",
    query_product_stats: "supervisor:product-stats:read",
    query_learning_completion: "supervisor:completion:read",
    run_inspection_rules: "rule-set:v1",
    save_inspection_record: "supervisor:record:write",
    save_schedule: "supervisor:schedule:write",
  };
  assert.equal(AUDIT_TOOL_LIST.length, Object.keys(permissions).length);
  for (const tool of AUDIT_TOOL_LIST) {
    const expectedOwner = tool.id === "query_scope" ? "adm" : "supervisor";
    assert.equal(tool.owner, expectedOwner, tool.id);
    assert.equal(specFor(tool.id, state, ctx).owner, expectedOwner, tool.id);
    assert.equal(tool.permission, permissions[tool.id], tool.id);
  }
  assert.match(specFor("query_scope", state, ctx).desc, /ADM 仅提供账号授权范围/);
});

test("范围与来源明确为本地演示，不宣称 ADM 返回业务数据或已连接业务库", () => {
  const { state, ctx } = fixture();
  const before = structuredClone(state);
  for (const tool of AUDIT_TOOL_LIST) {
    const output = runAuditTool(tool.id, state, ctx);
    assert.ok(output.sources.length > 0, tool.id);
    assert.ok(output.sources.every((source) => source.includes("本地")), tool.id);
    assert.doesNotMatch(JSON.stringify(output), /ADM 返回|ADM 结果侧|ADM ·|业务库 ·|写入由 ADM|由 ADM 定时触发/);
  }
  const scope = runAuditTool("query_scope", state, ctx);
  assert.match(scope.notes.join(" "), /未调用真实 ADM 授权接口/);
  assert.ok(buildAuditReport(state, ctx).sources.every((source) => source.includes("本地")));
  assert.deepEqual(state, before, "工具层仍只返回结果，不写入传入状态");
});

test("档案由 SV 保存，本地演示不宣称真实数据库写入", () => {
  const { state, ctx } = fixture();
  const output = runAuditTool("save_inspection_record", state, ctx);
  assert.match(output.headline, /本地演示/);
  assert.match(output.notes.join(" "), /档案由 SV 按 ADM 授权范围保存/);
  assert.match(output.notes.join(" "), /未接入真实数据库/);
});

test("定时工具仅保存本地计划，不暗示后台运行或消息已发送", () => {
  const { state, ctx } = fixture();
  const output = runAuditTool("save_schedule", state, ctx);
  assert.match(output.headline, /本地演示仅保存计划/);
  assert.match(output.headline, /未启动后台调度，不会自动执行或发送消息/);
  assert.match(output.notes.join(" "), /由 SV 持有计划和调度状态/);
  assert.match(output.notes.join(" "), /ADM 仅提供非交互授权与飞书投递/);
  assert.deepEqual(output.table?.rows.find(([label]) => label === "接收方式"), [
    "接收方式",
    "页面预览；飞书仅为草稿，未发送",
  ]);
  assert.match(specFor("save_schedule", state, ctx).desc, /仅保存计划，不启动后台调度/);
  assert.match(AUDIT_STEP_NARRATION.save_schedule, /本地演示，不会自动执行/);
  assert.ok(planFor(state, ctx, "审计本周全国任务").followUps.some((text) => /审计计划（本地演示）/.test(text)));
});
