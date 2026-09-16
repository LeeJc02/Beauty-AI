import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  FileText,
  KeyRound,
  Loader2,
  PlayCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  Wrench,
} from "lucide-react";
import {
  AUDIT_PRESETS,
  AUDIT_TOOL_LIST,
  applyClarification,
  auditContext,
  buildAuditReport,
  clarificationsFor,
  manualToolQuestion,
  outOfScopeRegion,
  planContext,
  planFor,
  runAuditTool,
  specFor,
  type AuditError,
  type AuditContext,
  type AuditReport,
  type AuditToolId,
  type AuditToolOutput,
  type AuditToolSpec,
  type Clarification,
} from "../../lib/auditTools";
import { LEVEL_LABELS } from "../../lib/inspectionEngine";
import type {
  InspectionActor,
  InspectionState,
  RiskLevel,
} from "../../lib/inspectionTypes";
import { Chip, SectionHeading, jakartaStamp } from "./shared";

/* ------------------------------------------------------------------ 类型 */

type ConsoleItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "agent"; id: string; text: string; event?: string }
  | {
      kind: "clarify";
      id: string;
      clarification: Clarification;
      picks: string[];
      answered?: string;
    }
  | {
      kind: "tool";
      id: string;
      spec: AuditToolSpec;
      status: "running" | "done" | "error";
      event: string;
      output?: AuditToolOutput;
      error?: AuditError;
    }
  | {
      kind: "report";
      id: string;
      report: AuditReport;
      /** 报告对应的查询条件：报告上的动作要沿用它，不能退回页面默认周期。 */
      ctx: AuditContext;
    };

const uid = () => `audit-${Math.random().toString(36).slice(2, 9)}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const LEVEL_TONE: Record<RiskLevel, string> = {
  high: "bg-rose-50 text-rose-700 ring-rose-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-sky-50 text-sky-700 ring-sky-200",
  insufficient: "bg-slate-100 text-slate-600 ring-slate-200",
};

const VERDICT_TONE: Record<AuditReport["verdict"], string> = {
  阻断: "bg-rose-50 text-rose-700 ring-rose-200",
  需关注: "bg-amber-50 text-amber-700 ring-amber-200",
  提示优化: "bg-sky-50 text-sky-700 ring-sky-200",
  通过: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const ERROR_TONE: Record<AuditError["kind"], string> = {
  permission: "bg-amber-50 text-amber-800 ring-amber-200",
  data: "bg-sky-50 text-sky-800 ring-sky-200",
  system: "bg-rose-50 text-rose-700 ring-rose-200",
};

const ERROR_KIND_LABEL: Record<AuditError["kind"], string> = {
  permission: "权限问题",
  data: "业务数据问题",
  system: "系统问题",
};

/** 保存类/定时类意图直接落到对应工具，不走整条计划。 */
const toolIntentOf = (text: string): AuditToolId | null => {
  if (/保存.*记录|存成?记录|留档|归档/.test(text)) return "save_inspection_record";
  if (/每周|定时|订阅|自动跑|自动审计|自动审计|定期/.test(text))
    return "save_schedule";
  return null;
};

function EventTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground ring-1 ring-border">
      <Terminal size={9} />
      {name}
    </span>
  );
}

function OwnerBadge({ spec }: { spec: AuditToolSpec }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ring-1 ${
        spec.owner === "adm"
          ? "bg-primary/10 text-primary ring-primary/25"
          : "bg-secondary text-secondary-foreground ring-primary/15"
      }`}
      title={
        spec.owner === "adm"
          ? "ADM 数据工具：每次调用都由 ADM 重新检查权限与参数"
          : "Supervisor 本地确定性计算"
      }
    >
      {spec.owner === "adm" ? "ADM" : "Supervisor"}
    </span>
  );
}

/* ------------------------------------------------------------ 工具调用卡 */

function ToolCallCard({ item }: { item: Extract<ConsoleItem, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const done = item.status === "done";
  const failed = item.status === "error";
  const output = item.output;
  return (
    <div
      className={`rounded-lg bg-background ring-1 ${
        failed
          ? "ring-amber-300"
          : done
            ? "ring-foreground/10"
            : "ring-primary/30"
      }`}
    >
      <div className="flex items-start gap-2 px-2.5 py-2">
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-1 ${
            failed
              ? "bg-amber-50 text-amber-600 ring-amber-200"
              : done
                ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                : "bg-primary/10 text-primary ring-primary/25"
          }`}
        >
          {failed ? (
            <AlertTriangle size={11} />
          ) : done ? (
            <Check size={11} />
          ) : (
            <Loader2 size={11} className="animate-spin" />
          )}
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              {item.spec.name}
            </code>
            <span className="text-[11.5px] font-medium text-foreground">
              {item.spec.title}
            </span>
            <OwnerBadge spec={item.spec} />
            <EventTag name={item.event} />
            {done && output ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                {output.traceId} · {output.scanned} · {output.ms}ms
              </span>
            ) : failed ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                {item.error?.code}
              </span>
            ) : (
              <span className="text-[10.5px] text-muted-foreground">调用中…</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground ring-1 ring-border"
              title="ADM 在执行工具前再次校验权限码与参数"
            >
              <KeyRound size={9} />
              {item.spec.permission}
            </span>
            {item.spec.params.map((param) => (
              <span
                key={`${param.label}-${param.value}`}
                className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground ring-1 ring-primary/10"
              >
                <span className="text-muted-foreground">{param.label}</span>
                <span className="font-medium">{param.value}</span>
              </span>
            ))}
          </div>
          {!done && !failed ? (
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/50" />
            </div>
          ) : null}
          {failed && item.error ? (
            <div className="grid gap-1">
              <div
                className={`flex flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] leading-relaxed ring-1 ${ERROR_TONE[item.error.kind]}`}
              >
                <span className="font-semibold">
                  {ERROR_KIND_LABEL[item.error.kind]} · {item.error.code}
                </span>
                <span>{item.error.userMessage}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                  模型可见：{item.error.modelMessage}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5">
                  {item.error.retryable ? "可重试" : "不可重试"}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5">
                  {item.error.needUserInput ? "需要用户补充信息" : "无需用户补充"}
                </span>
              </div>
            </div>
          ) : null}
          {done && output ? (
            <>
              <div className="text-[11.5px] leading-relaxed text-foreground">
                {output.headline}
              </div>
              {output.facts.length ? (
                <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
                  {output.facts.map((fact, factIndex) => (
                    <div
                      key={`${factIndex}-${fact.label}`}
                      className="rounded-md bg-muted/50 px-2 py-1.5"
                      title={fact.hint}
                    >
                      <div className="text-[10px] text-muted-foreground">
                        {fact.label}
                      </div>
                      <div className="text-[12px] font-semibold text-foreground">
                        {fact.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {output.error ? (
                <div
                  className={`flex flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] ring-1 ${ERROR_TONE[output.error.kind]}`}
                >
                  <span className="font-semibold">
                    {ERROR_KIND_LABEL[output.error.kind]} · {output.error.code}
                  </span>
                  <span>{output.error.userMessage}</span>
                </div>
              ) : null}
              <button
                type="button"
                className="inspection-link w-fit"
                onClick={() => setOpen((value) => !value)}
              >
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {open ? "收起工具返回" : "展开工具返回"}
              </button>
              {open ? (
                <div className="grid gap-2 border-t border-border/70 pt-2">
                  {output.table ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[11px]">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            {output.table.columns.map((column) => (
                              <th
                                key={column}
                                className="whitespace-nowrap border-b border-border/70 px-2 py-1 font-medium"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {output.table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="border-b border-border/40 px-2 py-1 align-top text-foreground"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <div className="grid gap-1">
                    <div className="text-[10.5px] font-semibold text-foreground">
                      口径说明
                    </div>
                    {output.notes.map((note, index) => (
                      <div
                        key={`${index}-${note}`}
                        className="flex gap-1.5 text-[10.5px] leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/50" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-1">
                    <div className="text-[10.5px] font-semibold text-foreground">
                      数据来源
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {output.sources.map((source, sourceIndex) => (
                        <span
                          key={`${sourceIndex}-${source}`}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- 报告卡 */

function ReportCard({
  report,
  onFocusTask,
  onExport,
  onRunTool,
  busy,
}: {
  report: AuditReport;
  onFocusTask: (taskId: string) => void;
  onExport: (report: AuditReport) => void;
  onRunTool: (id: AuditToolId) => void;
  busy: boolean;
}) {
  const [acked, setAcked] = useState(false);
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-primary/25">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <FileText size={11} />
        </span>
        <span className="text-[12.5px] font-semibold text-foreground">
          {report.title}
        </span>
        <Chip tone={VERDICT_TONE[report.verdict]} className="font-semibold">
          {report.verdict}
        </Chip>
        <EventTag name="report_completed" />
        <span className="font-mono text-[10px] text-muted-foreground">
          规则集 {report.ruleVersion}
        </span>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-foreground">
        {report.summary}
      </p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
        {report.metrics.map((metric, metricIndex) => (
          <div
            key={`${metricIndex}-${metric.label}`}
            className="rounded-md bg-muted/50 px-2 py-1.5"
          >
            <div className="text-[10px] text-muted-foreground">{metric.label}</div>
            <div className="text-[12px] font-semibold text-foreground">
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {report.findings.length ? (
        <div className="mt-3 grid gap-2">
          <div className="text-[11.5px] font-semibold text-foreground">
            关键发现（{report.findings.length}）
          </div>
          {report.findings.map((finding, findingIndex) => (
            <div
              key={`${findingIndex}-${finding.ruleId}`}
              className="grid gap-1 rounded-lg bg-muted/40 px-2.5 py-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone={LEVEL_TONE[finding.level]}>
                  {LEVEL_LABELS[finding.level]}
                </Chip>
                <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border">
                  {finding.ruleId}
                </span>
                <span className="text-[11.5px] font-medium text-foreground">
                  {finding.title}
                </span>
              </div>
              <div className="text-[11px] leading-relaxed text-muted-foreground">
                {finding.detail}
              </div>
              <div className="text-[10.5px] leading-relaxed text-muted-foreground">
                证据：{finding.evidence}
              </div>
              {finding.taskIds.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {finding.taskIds.slice(0, 3).map((taskId) => (
                    <button
                      key={taskId}
                      type="button"
                      className="inspection-link"
                      onClick={() => onFocusTask(taskId)}
                    >
                      看任务详情
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {report.actions.length ? (
        <div className="mt-3 grid gap-1">
          <div className="text-[11.5px] font-semibold text-foreground">
            整改建议（不自动改任务）
          </div>
          {report.actions.map((action, index) => (
            <div
              key={`${index}-${action}`}
              className="flex gap-1.5 text-[11px] leading-relaxed text-foreground"
            >
              <span className="text-muted-foreground">{index + 1}.</span>
              <span>{action}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-1 border-t border-border/70 pt-2.5">
        <div className="text-[11px] font-semibold text-foreground">
          数据来源与口径
        </div>
        <div className="flex flex-wrap gap-1">
          {report.sources.map((source, sourceIndex) => (
            <span
              key={`${sourceIndex}-${source}`}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {source}
            </span>
          ))}
        </div>
        <div className="text-[10.5px] text-muted-foreground">{report.scope}</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2.5">
        <button
          type="button"
          className="inspection-button primary"
          disabled={busy}
          onClick={() => onRunTool("save_inspection_record")}
        >
          <ShieldCheck size={13} /> 保存审计记录
        </button>
        <button
          type="button"
          className="inspection-button"
          disabled={busy}
          onClick={() => onRunTool("save_schedule")}
        >
          <Sparkles size={13} /> 每周一自动审计
        </button>
        <button
          type="button"
          className="inspection-button"
          onClick={() => onExport(report)}
        >
          <Download size={13} /> 导出报告
        </button>
        <button
          type="button"
          className="inspection-button"
          onClick={() => setAcked(true)}
          disabled={acked}
        >
          <Check size={13} /> {acked ? "已标记已确认" : "标记已确认"}
        </button>
      </div>
      {acked ? (
        <div className="mt-2 rounded-md bg-emerald-50/70 px-2.5 py-1.5 text-[10.5px] text-emerald-800 ring-1 ring-emerald-200">
          已记录「{report.title}」确认结果（原型演示）。Agent 只给结论与证据，不修改培训任务、人员、组织与成绩；处置动作需要人工确认后才写入新版本。
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ 主组件 */

export function AuditConsole({
  state,
  actor,
  week,
  today,
  onFocusTask,
  onToast,
}: {
  state: InspectionState;
  actor: InspectionActor;
  week: string;
  today: string;
  onFocusTask: (taskId: string) => void;
  onToast: (text: string) => void;
}) {
  const [items, setItems] = useState<ConsoleItem[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);
  const runningRef = useRef(false);
  const liveRef = useRef({ state, week, today, actor });
  liveRef.current = { state, week, today, actor };
  /** 待补齐的条件：排队问完才开始查。 */
  const [pending, setPending] = useState<{
    question: string;
    queue: Clarification[];
    ctx: ReturnType<typeof auditContext>;
  } | null>(null);

  const baseCtx = useMemo(
    () => auditContext(state, actor, week, today),
    [state, actor, week, today],
  );

  const callCounts = useMemo(() => {
    const counts = new Map<AuditToolId, number>();
    for (const item of items)
      if (item.kind === "tool")
        counts.set(item.spec.id, (counts.get(item.spec.id) ?? 0) + 1);
    return counts;
  }, [items]);

  const latestHeadline = useMemo(() => {
    const map = new Map<AuditToolId, string>();
    for (const item of items)
      if (item.kind === "tool" && item.output)
        map.set(item.spec.id, item.output.headline);
    return map;
  }, [items]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [items]);

  useEffect(
    () => () => {
      runRef.current += 1;
      runningRef.current = false;
    },
    [],
  );

  const push = useCallback((...next: ConsoleItem[]) => {
    setItems((previous) => [...previous, ...next]);
  }, []);

  /** 执行工具计划：每一步都是一个 tool_call_started / tool_call_completed 事件。 */
  const runPlan = useCallback(
    async (question: string, ctx: ReturnType<typeof auditContext>) => {
      const token = (runRef.current += 1);
      runningRef.current = true;
      setRunning(true);
      const { state: current } = liveRef.current;
      const plan = planFor(current, ctx, question);
      push({
        kind: "agent",
        id: uid(),
        text: plan.intro,
        event: "run_started",
      });
      for (const step of plan.steps) {
        if (token !== runRef.current) return;
        const spec = specFor(step, current, ctx, question);
        const itemId = uid();
        push({
          kind: "tool",
          id: itemId,
          spec,
          status: "running",
          event:
            step === "run_inspection_rules"
              ? "inspection_started"
              : "tool_call_started",
        });
        await sleep(240 + spec.params.length * 70);
        if (token !== runRef.current) return;
        const output = runAuditTool(step, current, ctx, question);
        setItems((previous) =>
          previous.map((item) =>
            item.kind === "tool" && item.id === itemId
              ? {
                  ...item,
                  status: "done",
                  output,
                  event:
                    step === "run_inspection_rules"
                      ? "finding_created"
                      : "tool_call_completed",
                }
              : item,
          ),
        );
        await sleep(110);
      }
      if (token !== runRef.current) return;
      push({
        kind: "report",
        id: uid(),
        report: buildAuditReport(current, ctx),
        ctx,
      });
      runningRef.current = false;
      setRunning(false);
    },
    [push],
  );

  /** 手动只跑一个工具：保存类动作也走这里。 */
  const runTool = useCallback(
    async (id: AuditToolId, question?: string, override?: AuditContext) => {
      if (runningRef.current) return;
      const { state: current, week: currentWeek, today: currentToday, actor: currentActor } =
        liveRef.current;
      const ctx =
        override ?? auditContext(current, currentActor, currentWeek, currentToday);
      const spec = specFor(id, current, ctx, question);
      if (id !== "save_inspection_record" && id !== "save_schedule") {
        const token = (runRef.current += 1);
        runningRef.current = true;
        setRunning(true);
        push(
          { kind: "user", id: uid(), text: manualToolQuestion(id) },
          {
            kind: "agent",
            id: uid(),
            text: `只跑「${spec.title}」这一个工具，范围是${ctx.scopeLabel}、周期 ${ctx.week}。`,
            event: "run_started",
          },
          {
            kind: "tool",
            id: uid(),
            spec,
            status: "running",
            event: "tool_call_started",
          },
        );
        await sleep(320);
        if (token !== runRef.current) return;
        const output = runAuditTool(id, current, ctx, question);
        setItems((previous) =>
          previous.map((item) =>
            item.kind === "tool" && item.status === "running"
              ? { ...item, status: "done", output, event: "tool_call_completed" }
              : item,
          ),
        );
        runningRef.current = false;
        setRunning(false);
        return;
      }
      // 保存类：作为报告动作触发，直接产出调用卡，不再加一轮对话
      runningRef.current = true;
      setRunning(true);
      const itemId = uid();
      push({
        kind: "tool",
        id: itemId,
        spec,
        status: "running",
        event: "tool_call_started",
      });
      await sleep(280);
      const output = runAuditTool(id, current, ctx, question);
      setItems((previous) =>
        previous.map((item) =>
          item.kind === "tool" && item.id === itemId
            ? { ...item, status: "done", output, event: "tool_call_completed" }
            : item,
        ),
      );
      runningRef.current = false;
      setRunning(false);
      onToast(`${spec.title}完成：${output.headline}`);
    },
    [push, onToast],
  );

  /** 权限类异常：当前账号看不到问题里点到的区域。 */
  const pushPermissionError = useCallback(
    (regionName: string, visible: string[], question: string) => {
      const spec = specFor("query_scope", liveRef.current.state, baseCtx);
      push(
        { kind: "user", id: uid(), text: question },
        {
          kind: "agent",
          id: uid(),
          text: `你问的${regionName}不在当前账号的数据范围里。ADM 的权限校验直接拒绝了这次查询，我不会绕过它对其它区域取数。`,
          event: "tool_call_started",
        },
        {
          kind: "tool",
          id: uid(),
          spec,
          status: "error",
          event: "tool_call_completed",
          error: {
            code: "PERMISSION_DENIED",
            kind: "permission",
            userMessage: `当前账号是${actor.roleLabel}，只能查看${visible.join("、")}与全国任务；${regionName}的数据不会返回。`,
            modelMessage: `scope=${visible.join("|")} requested=${regionName}`,
            retryable: false,
            needUserInput: true,
          },
        },
        {
          kind: "agent",
          id: uid(),
          text: `可以改成问这些范围：${visible.join("、")}，或者让总部账号来看${regionName}。`,
        },
      );
    },
    [actor.roleLabel, baseCtx, push],
  );

  /** 用户提问入口：先判权限，再判条件是否齐全，最后执行计划。 */
  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || runningRef.current || pending) return;
      setInput("");
      const { state: current, week: currentWeek, today: currentToday, actor: currentActor } =
        liveRef.current;
      const initial = auditContext(current, currentActor, currentWeek, currentToday);
      const blocked = outOfScopeRegion(current, currentActor, question);
      if (blocked) {
        pushPermissionError(
          blocked.name,
          current.regions
            .filter((region) => initial.regionIds.includes(region.id))
            .map((region) => region.name),
          question,
        );
        return;
      }
      const ctx = planContext(current, initial, question);
      const toolIntent = toolIntentOf(question);
      if (toolIntent) {
        push({ kind: "user", id: uid(), text: question });
        await runTool(toolIntent, question);
        return;
      }
      const queue = clarificationsFor(current, ctx, question);
      if (queue.length) {
        push(
          { kind: "user", id: uid(), text: question },
          {
            kind: "clarify",
            id: uid(),
            clarification: queue[0],
            picks: [],
          },
        );
        setPending({ question, queue: queue.slice(1), ctx });
        return;
      }
      push({ kind: "user", id: uid(), text: question });
      await runPlan(question, ctx);
    },
    [pending, push, pushPermissionError, runPlan, runTool],
  );

  /** 补问作答：答完继续问下一条，问完就开跑。 */
  const answerClarify = useCallback(
    async (item: Extract<ConsoleItem, { kind: "clarify" }>, value: string, label: string) => {
      if (!pending) return;
      setItems((previous) =>
        previous.map((entry) =>
          entry.kind === "clarify" && entry.id === item.id
            ? { ...entry, answered: label, picks: [] }
            : entry,
        ),
      );
      const nextCtx = applyClarification(
        liveRef.current.state,
        pending.ctx,
        item.clarification.field,
        value,
      );
      if (pending.queue.length) {
        const [head, ...rest] = pending.queue;
        push({ kind: "clarify", id: uid(), clarification: head, picks: [] });
        setPending({ ...pending, queue: rest, ctx: nextCtx });
        return;
      }
      setPending(null);
      await runPlan(pending.question, nextCtx);
    },
    [pending, push, runPlan],
  );

  const togglePick = (id: string, value: string) => {
    setItems((previous) =>
      previous.map((entry) =>
        entry.kind === "clarify" && entry.id === id
          ? {
              ...entry,
              picks: entry.picks.includes(value)
                ? entry.picks.filter((item) => item !== value)
                : [...entry.picks, value],
            }
          : entry,
      ),
    );
  };

  /** 补问阶段允许直接打字：把文本对到选项上，对不上就说明能听懂什么。 */
  const answerByText = (item: Extract<ConsoleItem, { kind: "clarify" }>, text: string) => {
    const options = item.clarification.options;
    const hit = options.find(
      (option) => text.includes(option.label) || option.value === text,
    );
    if (hit) {
      void answerClarify(item, hit.value, hit.label);
      return;
    }
    if (item.clarification.field === "region") {
      const region = liveRef.current.state.regions.find(
        (entry) =>
          text.includes(entry.name) &&
          baseCtx.regionIds.includes(entry.id),
      );
      if (region) {
        void answerClarify(item, region.id, region.name);
        return;
      }
    }
    push({
      kind: "agent",
      id: uid(),
      text: `这一步我没听懂。可以点上面的选项，或者按这些说法回答：${options
        .map((option) => option.label)
        .join("、")}。`,
    });
  };

  const submit = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const live = items.find(
      (entry): entry is Extract<ConsoleItem, { kind: "clarify" }> =>
        entry.kind === "clarify" && !entry.answered,
    );
    if (live) {
      setInput("");
      answerByText(live, text);
      return;
    }
    void ask(text);
  };

  const restart = () => {
    runRef.current += 1;
    runningRef.current = false;
    setRunning(false);
    setPending(null);
    setItems([]);
  };

  const exportReport = (report: AuditReport) => {
    const lines = [
      report.title,
      `生成时间：${jakartaStamp(new Date().toISOString())} · 数据版本 v${state.revision} · 规则集 ${report.ruleVersion}`,
      `审计范围：${report.scope}`,
      "",
      `一、审计结论：${report.verdict}`,
      report.summary,
      "",
      "二、关键指标",
      ...report.metrics.map((metric) => `${metric.label}：${metric.value}`),
      "",
      `三、关键发现（${report.findings.length} 条）`,
      ...report.findings.flatMap((finding, index) => [
        `${index + 1}. [${LEVEL_LABELS[finding.level]} / ${finding.ruleId}] ${finding.title}`,
        `   原因：${finding.detail}`,
        `   证据：${finding.evidence}`,
        `   数据出处：${finding.source}`,
        `   涉及任务：${finding.taskIds
          .map((id) => state.tasks.find((task) => task.id === id)?.title ?? id)
          .join("、")}`,
      ]),
      "",
      "四、整改建议（不自动改任务）",
      ...report.actions.map((action, index) => `${index + 1}. ${action}`),
      "",
      "五、数据来源与口径",
      ...report.sources.map((source) => `- ${source}`),
      "",
      "六、Agent 工具调用记录（本次会话）",
      ...items
        .filter(
          (item): item is Extract<ConsoleItem, { kind: "tool" }> =>
            item.kind === "tool",
        )
        .map(
          (item) =>
            `${item.spec.name}（${item.spec.owner} · ${item.spec.permission}）· ${item.spec.params
              .map((param) => `${param.label}=${param.value}`)
              .join(" · ")}${item.output ? ` · ${item.output.traceId} · ${item.output.scanned} · ${item.output.ms}ms` : ""}`,
        ),
      "",
      "说明：本报告为原型演示数据；Agent 只输出结论与证据，不修改培训任务、人员、组织与成绩。",
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    const fileName = `审计报告-${report.id}.txt`;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    onToast(`报告已导出：${fileName}（浏览器默认下载目录）。`);
  };

  const empty = items.length === 0;
  const liveClarify = pending
    ? items.find(
        (entry): entry is Extract<ConsoleItem, { kind: "clarify" }> =>
          entry.kind === "clarify" && !entry.answered,
      )
    : undefined;

  return (
    <div className="rounded-xl bg-gradient-to-br from-secondary/70 to-card ring-1 ring-primary/15">
      <div className="flex flex-wrap items-start justify-between gap-2 p-3.5 pb-2">
        <SectionHeading
          title="数据审计 Agent"
          hint="Supervisor 工作台：先补齐条件，再按白名单工具取数、跑审计规则，最后给带来源的报告"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="bg-background text-muted-foreground ring-border">
            <Database size={11} /> {baseCtx.scopeLabel}
          </Chip>
          <Chip tone="bg-background text-muted-foreground ring-border">
            周期 {week}
          </Chip>
          <Chip tone="bg-primary/10 text-primary ring-primary/25">
            <Wrench size={11} /> {AUDIT_TOOL_LIST.length} 个工具
          </Chip>
          {items.length ? (
            <button type="button" className="inspection-button" onClick={restart}>
              重新开始
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-3.5 pt-1 lg:grid-cols-[minmax(0,1fr)_256px]">
        {/* 左：对话 + 条件补齐 + 工具轨迹 + 报告 */}
        <div className="grid min-w-0 gap-2">
          <div
            ref={listRef}
            className="grid max-h-[640px] content-start gap-2.5 overflow-y-auto pr-0.5"
          >
            {empty ? (
              <div className="grid gap-2.5 rounded-lg bg-background/70 p-3 ring-1 ring-foreground/10">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                  <Sparkles size={13} className="text-primary" />
                  问一个问题，或选一个现成的审计任务
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  我会先补齐条件（时间、地区、品类、关注方面），再确认可查范围，然后取培训概览、完成情况、区域与品类统计，
                  执行 A–G 审计规则，最后给出带数据出处和规则版本的报告。每一步工具调用、权限码、traceId 和返回值都会留在这里。
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {AUDIT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="grid gap-0.5 rounded-lg bg-secondary/70 px-2.5 py-2 text-left ring-1 ring-primary/15 transition hover:bg-primary/10"
                      onClick={() => void ask(preset.question)}
                    >
                      <span className="text-[11.5px] font-semibold text-foreground">
                        {preset.label}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground">
                        {preset.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {items.map((item) => {
              if (item.kind === "user")
                return (
                  <div key={item.id} className="flex justify-end">
                    <div className="grid max-w-[86%] gap-1 rounded-xl bg-primary px-3 py-2 text-[11.5px] leading-relaxed text-primary-foreground ring-1 ring-primary/30">
                      <span className="flex items-center gap-1.5 text-[10px] opacity-80">
                        <User size={10} /> 你
                      </span>
                      {item.text}
                    </div>
                  </div>
                );
              if (item.kind === "agent")
                return (
                  <div key={item.id} className="flex gap-2">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Bot size={13} />
                    </span>
                    <div className="grid max-w-[92%] gap-1 rounded-xl bg-background px-3 py-2 text-[11.5px] leading-relaxed text-foreground ring-1 ring-foreground/10">
                      {item.event ? <EventTag name={item.event} /> : null}
                      <span>{item.text}</span>
                    </div>
                  </div>
                );
              if (item.kind === "clarify") {
                const multi = item.clarification.field === "category";
                const active = liveClarify?.id === item.id;
                return (
                  <div key={item.id} className="flex gap-2">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <KeyRound size={13} />
                    </span>
                    <div className="grid max-w-[92%] gap-1.5 rounded-xl bg-background px-3 py-2 ring-1 ring-amber-200">
                      <EventTag name="clarification_required" />
                      <span className="text-[11.5px] leading-relaxed text-foreground">
                        {item.clarification.question}
                      </span>
                      {item.answered ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-semibold text-primary-foreground">
                          <Check size={10} /> {item.answered}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.clarification.options.map((option) => {
                            const selected = item.picks.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                title={option.hint}
                                disabled={!active}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] ring-1 transition disabled:opacity-50 ${
                                  selected
                                    ? "bg-primary text-primary-foreground ring-primary/30"
                                    : "bg-secondary text-secondary-foreground ring-primary/15 hover:bg-primary/10"
                                }`}
                                onClick={() =>
                                  multi
                                    ? togglePick(item.id, option.value)
                                    : void answerClarify(item, option.value, option.label)
                                }
                              >
                                {selected ? <Check size={10} /> : null}
                                {option.label}
                              </button>
                            );
                          })}
                          {multi ? (
                            <button
                              type="button"
                              disabled={!active || !item.picks.length}
                              className="rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-semibold text-primary-foreground disabled:opacity-50"
                              onClick={() =>
                                void answerClarify(
                                  item,
                                  item.picks.join(","),
                                  item.picks.join("、"),
                                )
                              }
                            >
                              下一步
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              if (item.kind === "tool")
                return (
                  <div key={item.id} className="flex gap-2 pl-8">
                    <div className="min-w-0 flex-1">
                      <ToolCallCard item={item} />
                    </div>
                  </div>
                );
              return (
                <div key={item.id} className="flex gap-2">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Bot size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <ReportCard
                      report={item.report}
                      onFocusTask={onFocusTask}
                      onExport={exportReport}
                      onRunTool={(id) => void runTool(id, undefined, item.ctx)}
                      busy={running}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={running}
              placeholder={
                liveClarify
                  ? "可以直接打字回答这一步，例如「上周」「南区」「全部品类」"
                  : "问点什么，例如：最近培训情况怎么样？哪个区域工时压力最大？"
              }
              className="min-h-[36px] min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-[12px] outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
            />
            {!empty && !liveClarify
              ? AUDIT_PRESETS.slice(1, 3).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="inspection-button hidden xl:inline-flex"
                    disabled={running}
                    onClick={() => void ask(preset.question)}
                  >
                    {preset.label}
                  </button>
                ))
              : null}
            <button
              type="submit"
              className="inspection-button primary"
              disabled={running || !input.trim()}
            >
              {running ? (
                <Loader2 size={13} className="inspection-spin" />
              ) : (
                <Send size={13} />
              )}
              {running ? "执行中" : "发送"}
            </button>
          </form>
        </div>

        {/* 右：工具白名单 + 口径 */}
        <div className="grid content-start gap-2">
          <div className="rounded-lg bg-background/80 p-2.5 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-semibold text-foreground">
                工具白名单
              </span>
              <span className="text-[10px] text-muted-foreground">
                点工具名可单独调用
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              只有登记过的工具可以被调用，没有「执行任意 SQL」这类入口。
            </p>
            <div className="mt-2 grid gap-1.5">
              {AUDIT_TOOL_LIST.map((tool) => {
                const count = callCounts.get(tool.id) ?? 0;
                const headline = latestHeadline.get(tool.id);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    disabled={running}
                    onClick={() => void runTool(tool.id)}
                    title={`${tool.desc}｜权限码 ${tool.permission}`}
                    className="grid gap-0.5 rounded-md bg-muted/40 px-2 py-1.5 text-left transition hover:bg-primary/10 disabled:opacity-60"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <code className="font-mono text-[10.5px] font-semibold text-foreground">
                        {tool.name}
                      </code>
                      <span
                        className={`rounded px-1 text-[9px] font-semibold ${
                          tool.owner === "adm"
                            ? "bg-primary/12 text-primary"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {tool.owner === "adm" ? "ADM" : "SUP"}
                      </span>
                      {count ? (
                        <span className="rounded-full bg-primary/12 px-1.5 text-[9.5px] font-semibold text-primary">
                          ×{count}
                        </span>
                      ) : (
                        <span className="text-[9.5px] text-muted-foreground">
                          未调用
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {tool.title}
                      {headline ? ` · ${headline}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg bg-background/80 p-2.5 ring-1 ring-foreground/10">
            <span className="text-[11.5px] font-semibold text-foreground">
              本次查询口径
            </span>
            <div className="mt-2 grid gap-1 text-[10.5px] leading-relaxed text-muted-foreground">
              <span className="flex justify-between gap-2">
                <span>数据出口</span>
                <span className="text-foreground">ADM（唯一出口）</span>
              </span>
              <span className="flex justify-between gap-2">
                <span>可见范围</span>
                <span className="text-foreground">{baseCtx.scopeLabel}</span>
              </span>
              <span className="flex justify-between gap-2">
                <span>规则集</span>
                <span className="text-foreground">
                  v{state.policy.version}（A–G）
                </span>
              </span>
              <span className="flex justify-between gap-2">
                <span>周容量基线</span>
                <span className="text-foreground">
                  {state.policy.weeklyCapacityMinutes} 分钟
                </span>
              </span>
              <span className="flex justify-between gap-2">
                <span>单日上限</span>
                <span className="text-foreground">
                  {state.policy.dailyLimitMinutes} 分钟
                </span>
              </span>
              <span className="flex justify-between gap-2">
                <span>数据版本</span>
                <span className="text-foreground">v{state.revision}</span>
              </span>
              <span className="flex justify-between gap-2">
                <span>最近审计</span>
                <span className="text-foreground">
                  {state.lastRunAt ? jakartaStamp(state.lastRunAt) : "尚未运行"}
                </span>
              </span>
            </div>
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50/70 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span>
                只读取业务数据并按规则找问题，不修改培训任务、人员、组织与成绩；飞书由 ADM 在发送前再校验接收人权限。
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-background/80 p-2.5 ring-1 ring-foreground/10">
            <span className="text-[11.5px] font-semibold text-foreground">
              可以这样问
            </span>
            <div className="mt-2 grid gap-1">
              {[
                ...AUDIT_PRESETS.map((preset) => preset.question),
                "把结论保存成审计记录",
                "每周一早上九点自动跑这个审计",
              ].map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={running}
                  className="inspection-link text-left disabled:opacity-60"
                  onClick={() => void ask(question)}
                >
                  <PlayCircle size={11} /> {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
