import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
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
  type AuditContext,
  type AuditError,
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
import { jakartaStamp } from "./shared";
import "./audit-console.css";

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
      ctx: AuditContext;
    };

const uid = () => `audit-${Math.random().toString(36).slice(2, 9)}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 审计步骤：与「生成课件」一样用四段轨道表达进度。 */
export const AUDIT_STEPS = ["补齐条件", "工具取数", "规则审计", "报告"] as const;

function auditStepIndex(items: ConsoleItem[], pending: boolean) {
  if (pending) return 0;
  if (items.some((item) => item.kind === "report")) return 3;
  if (items.some((item) => item.kind === "tool" && item.spec.id === "run_inspection_rules"))
    return 2;
  if (items.some((item) => item.kind === "tool")) return 1;
  return 0;
}

const LEVEL_CLASS: Record<RiskLevel, string> = {
  high: "audit-chip--high",
  medium: "audit-chip--medium",
  low: "audit-chip--low",
  insufficient: "audit-chip--insufficient",
};

const VERDICT_CLASS: Record<AuditReport["verdict"], string> = {
  阻断: "audit-chip--high",
  需关注: "audit-chip--medium",
  提示优化: "audit-chip--low",
  通过: "audit-chip--ok",
};

const ERROR_CLASS: Record<AuditError["kind"], string> = {
  permission: "audit-error--permission",
  data: "audit-error--data",
  system: "audit-error--system",
};

const ERROR_LABEL: Record<AuditError["kind"], string> = {
  permission: "权限问题",
  data: "业务数据问题",
  system: "系统问题",
};

const toolIntentOf = (text: string): AuditToolId | null => {
  if (/保存.*记录|存成?记录|留档|归档/.test(text)) return "save_inspection_record";
  if (/每周|定时|订阅|自动跑|自动审计|自动巡检|定期/.test(text)) return "save_schedule";
  return null;
};

function Chip({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone?: string;
  title?: string;
  key?: React.Key;
}) {
  return (
    <span className={`audit-chip ${tone ?? ""}`} title={title}>
      {children}
    </span>
  );
}

function EventTag({ name }: { name: string }) {
  return (
    <span className="audit-chip audit-chip--event">
      <Terminal size={9} />
      {name}
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
      className={`audit-card audit-card--tool ${
        failed ? "audit-card--error" : ""
      }`}
    >
      <div className="audit-card__head">
        <span
          style={{
            display: "inline-flex",
            height: 20,
            width: 20,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            color: failed ? "#b45309" : done ? "#047857" : "var(--cw-accent)",
            background: failed ? "#fff8ed" : done ? "#ecfdf5" : "var(--cw-accent-subtle)",
            flex: "none",
          }}
        >
          {failed ? (
            <AlertTriangle size={11} />
          ) : done ? (
            <Check size={11} />
          ) : (
            <Loader2 size={11} className="cw-spin" />
          )}
        </span>
        <span className="audit-tool-name">{item.spec.name}</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--cw-ink)" }}>
          {item.spec.title}
        </span>
        <Chip tone={item.spec.owner === "adm" ? "audit-chip--accent" : undefined}>
          {item.spec.owner === "adm" ? "ADM" : "Supervisor"}
        </Chip>
        <EventTag name={item.event} />
        {done && output ? (
          <span className="audit-meta audit-mono">
            {output.traceId} · {output.scanned} · {output.ms}ms
          </span>
        ) : failed ? (
          <span className="audit-meta audit-mono">{item.error?.code}</span>
        ) : (
          <span className="audit-meta">调用中…</span>
        )}
      </div>

      <div className="audit-card__head">
        <Chip title="ADM 在执行工具前再次校验权限码与参数">
          <KeyRound size={9} />
          {item.spec.permission}
        </Chip>
        {item.spec.params.map((param) => (
          <Chip key={`${param.label}-${param.value}`}>
            <span style={{ color: "var(--cw-muted)" }}>{param.label}</span>
            {param.value}
          </Chip>
        ))}
      </div>

      {!done && !failed ? (
        <div className="cw-bar" style={{ marginTop: 2 }}>
          <span style={{ width: "36%" }} />
        </div>
      ) : null}

      {failed && item.error ? (
        <div className={`audit-error ${ERROR_CLASS[item.error.kind]}`}>
          <strong>
            {ERROR_LABEL[item.error.kind]} · {item.error.code}
          </strong>
          <span>{item.error.userMessage}</span>
          <span className="audit-meta audit-mono">模型可见：{item.error.modelMessage}</span>
          <span className="audit-meta">{item.error.retryable ? "可重试" : "不可重试"}</span>
          <span className="audit-meta">
            {item.error.needUserInput ? "需要用户补充信息" : "无需用户补充"}
          </span>
        </div>
      ) : null}

      {done && output ? (
        <>
          <div className="audit-headline">{output.headline}</div>
          {output.facts.length ? (
            <div className="audit-facts">
              {output.facts.map((fact, index) => (
                <div key={`${index}-${fact.label}`} className="audit-fact" title={fact.hint}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
          {output.error ? (
            <div className={`audit-error ${ERROR_CLASS[output.error.kind]}`}>
              <strong>
                {ERROR_LABEL[output.error.kind]} · {output.error.code}
              </strong>
              <span>{output.error.userMessage}</span>
            </div>
          ) : null}
          <button
            type="button"
            className="studio__text-button"
            style={{ width: "fit-content", paddingLeft: 0 }}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {open ? "收起工具返回" : "展开工具返回"}
          </button>
          {open ? (
            <div className="audit-detail">
              {output.table ? (
                <div style={{ overflowX: "auto" }}>
                  <table className="audit-table">
                    <thead>
                      <tr>
                        {output.table.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {output.table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="audit-section-title">口径说明</div>
              <div className="audit-notes">
                {output.notes.map((note, index) => (
                  <div key={`${index}-${note}`} className="audit-notes__row">
                    <span />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
              <div className="audit-section-title">数据来源</div>
              <div className="audit-sources">
                {output.sources.map((source, index) => (
                  <span key={`${index}-${source}`} className="audit-chip">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- 报告卡 */

function ReportCard({
  report,
  busy,
  onFocusTask,
  onExport,
  onRunTool,
}: {
  report: AuditReport;
  busy: boolean;
  onFocusTask: (taskId: string) => void;
  onExport: (report: AuditReport) => void;
  onRunTool: (id: AuditToolId) => void;
}) {
  const [acked, setAcked] = useState(false);
  return (
    <div className="audit-card audit-card--report">
      <div className="audit-card__head">
        <span
          style={{
            display: "inline-flex",
            height: 20,
            width: 20,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: "var(--cw-accent)",
            color: "#fff",
            flex: "none",
          }}
        >
          <FileText size={11} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{report.title}</span>
        <Chip tone={VERDICT_CLASS[report.verdict]}>{report.verdict}</Chip>
        <EventTag name="report_completed" />
        <span className="audit-meta audit-mono">规则集 {report.ruleVersion}</span>
      </div>

      <p className="audit-headline" style={{ margin: 0 }}>
        {report.summary}
      </p>

      <div className="audit-report__metrics">
        {report.metrics.map((metric, index) => (
          <div key={`${index}-${metric.label}`} className="audit-fact">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      {report.findings.length ? (
        <>
          <div className="audit-section-title">关键发现（{report.findings.length}）</div>
          {report.findings.map((finding, index) => (
            <div key={`${index}-${finding.ruleId}`} className="audit-finding">
              <div className="audit-card__head">
                <Chip tone={LEVEL_CLASS[finding.level]}>{LEVEL_LABELS[finding.level]}</Chip>
                <span className="audit-tool-name">{finding.ruleId}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{finding.title}</span>
              </div>
              <div className="audit-finding__detail">{finding.detail}</div>
              <div className="audit-finding__evidence">证据：{finding.evidence}</div>
              {finding.taskIds.length ? (
                <div className="audit-options">
                  {finding.taskIds.slice(0, 3).map((taskId) => (
                    <button
                      key={taskId}
                      type="button"
                      className="audit-option"
                      onClick={() => onFocusTask(taskId)}
                    >
                      看任务详情
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      {report.actions.length ? (
        <>
          <div className="audit-section-title">整改建议（不自动改任务）</div>
          <div className="audit-notes">
            {report.actions.map((action, index) => (
              <div key={`${index}-${action}`} className="audit-notes__row">
                <span style={{ marginTop: 6 }} />
                <span style={{ color: "var(--cw-ink2)", fontSize: 11.5 }}>
                  {index + 1}. {action}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="audit-detail">
        <div className="audit-section-title">数据来源与口径</div>
        <div className="audit-sources">
          {report.sources.map((source, index) => (
            <span key={`${index}-${source}`} className="audit-chip">
              {source}
            </span>
          ))}
        </div>
        <div className="audit-meta">{report.scope}</div>
      </div>

      <div className="audit-actions" style={{ borderTop: "1px solid var(--cw-border-subtle)", paddingTop: 10 }}>
        <button
          type="button"
          className="cw-primary"
          disabled={busy}
          onClick={() => onRunTool("save_inspection_record")}
        >
          <ShieldCheck size={14} /> 保存审计记录
        </button>
        <button
          type="button"
          className="cw-ghost"
          disabled={busy}
          onClick={() => onRunTool("save_schedule")}
        >
          <Sparkles size={13} /> 每周一自动审计
        </button>
        <button type="button" className="cw-ghost" onClick={() => onExport(report)}>
          <Download size={13} /> 导出报告
        </button>
        <button
          type="button"
          className="cw-ghost"
          disabled={acked}
          onClick={() => setAcked(true)}
        >
          <Check size={13} /> {acked ? "已确认" : "标记已确认"}
        </button>
      </div>

      {acked ? (
        <div className="audit-error audit-error--data" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" }}>
          已记录「{report.title}」确认结果（原型演示）。Agent 只给结论与证据，不修改培训任务、人员、组织与成绩。
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
  const [entryText, setEntryText] = useState("");
  const [running, setRunning] = useState(false);
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);
  const runningRef = useRef(false);
  const liveRef = useRef({ state, week, today, actor });
  liveRef.current = { state, week, today, actor };
  const [pending, setPending] = useState<{
    question: string;
    queue: Clarification[];
    ctx: AuditContext;
  } | null>(null);

  const baseCtx = useMemo(
    () => auditContext(state, actor, week, today),
    [state, actor, week, today],
  );

  const callCounts = useMemo(() => {
    const counts = new Map<AuditToolId, number>();
    for (const item of items)
      if (item.kind === "tool") counts.set(item.spec.id, (counts.get(item.spec.id) ?? 0) + 1);
    return counts;
  }, [items]);

  const latestHeadline = useMemo(() => {
    const map = new Map<AuditToolId, string>();
    for (const item of items)
      if (item.kind === "tool" && item.output) map.set(item.spec.id, item.output.headline);
    return map;
  }, [items]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
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

  const runPlan = useCallback(
    async (question: string, ctx: AuditContext) => {
      const token = (runRef.current += 1);
      runningRef.current = true;
      setRunning(true);
      const { state: current } = liveRef.current;
      const plan = planFor(current, ctx, question);
      push({ kind: "agent", id: uid(), text: plan.intro, event: "run_started" });
      for (const step of plan.steps) {
        if (token !== runRef.current) return;
        const spec = specFor(step, current, ctx, question);
        const itemId = uid();
        push({
          kind: "tool",
          id: itemId,
          spec,
          status: "running",
          event: step === "run_inspection_rules" ? "inspection_started" : "tool_call_started",
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
                    step === "run_inspection_rules" ? "finding_created" : "tool_call_completed",
                }
              : item,
          ),
        );
        await sleep(110);
      }
      if (token !== runRef.current) return;
      push({ kind: "report", id: uid(), report: buildAuditReport(current, ctx), ctx });
      runningRef.current = false;
      setRunning(false);
    },
    [push],
  );

  const runTool = useCallback(
    async (id: AuditToolId, question?: string, override?: AuditContext) => {
      if (runningRef.current) return;
      const { state: current, week: currentWeek, today: currentToday, actor: currentActor } =
        liveRef.current;
      const ctx = override ?? auditContext(current, currentActor, currentWeek, currentToday);
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
          { kind: "tool", id: uid(), spec, status: "running", event: "tool_call_started" },
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
      runningRef.current = true;
      setRunning(true);
      const itemId = uid();
      push({ kind: "tool", id: itemId, spec, status: "running", event: "tool_call_started" });
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

  const answerClarify = useCallback(
    async (
      item: Extract<ConsoleItem, { kind: "clarify" }>,
      value: string,
      label: string,
    ) => {
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

  const answerByText = (
    item: Extract<ConsoleItem, { kind: "clarify" }>,
    text: string,
  ) => {
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
        (entry) => text.includes(entry.name) && baseCtx.regionIds.includes(entry.id),
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

  const startAudit = async (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    setLeaving(true);
    await sleep(680);
    setEntered(true);
    setLeaving(false);
    await ask(question);
  };

  const restart = () => {
    runRef.current += 1;
    runningRef.current = false;
    setRunning(false);
    setPending(null);
    setItems([]);
    setEntered(false);
    setEntryText("");
  };

  const exportReport = (report: AuditReport) => {
    const lines = [
      report.title,
      `生成时间：${jakartaStamp(new Date().toISOString())} · 数据版本 v${state.revision} · 规则集 ${report.ruleVersion}`,
      `审计范围：${report.scope}`,
      "",
      `一、巡检结论：${report.verdict}`,
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
          (item): item is Extract<ConsoleItem, { kind: "tool" }> => item.kind === "tool",
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

  const liveClarify = pending
    ? items.find(
        (entry): entry is Extract<ConsoleItem, { kind: "clarify" }> =>
          entry.kind === "clarify" && !entry.answered,
      )
    : undefined;
  const stepIndex = auditStepIndex(items, !!liveClarify);
  const visibleItems = items.length
    ? items
    : ([
        {
          kind: "agent" as const,
          id: "idle",
          text: "Agent 会用白名单工具核对任务、人群、工时与规则口径，结论都带数据出处。先说说你想审计什么。",
        },
      ] as ConsoleItem[]);

  if (!entered)
    return (
      <div className="cw-root" data-i18n-skip="true">
        <div className={`cw-entry-flow ${leaving ? "cw-swap-out" : "cw-swap-in"}`}>
          <div className="cw-entry-card audit-entry-card">
            <div className="audit-entry-body">
              <span className="cw-entry-badge">
                <ShieldCheck size={14} /> 数据审计 Agent
              </span>
              <h1 className="audit-entry-title">想让 Agent 查什么？</h1>
              <p className="audit-entry-hint">
                说一句话就够了。Agent 会先补齐条件（时间、地区、品类、关注方面），再确认可查范围，
                然后取概览、完成情况、区域与品类统计，执行 A–G 审计规则，最后给出带数据出处和规则版本的报告。
              </p>
              <textarea
                className="cw-textarea"
                style={{ minHeight: 96 }}
                value={entryText}
                onChange={(event) => setEntryText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                    void startAudit(entryText);
                }}
                placeholder="例如：最近培训情况怎么样？哪个区域工时压力最大？哪些任务数据不全？"
              />
              <div className="audit-entry-examples">
                <span className="cw-entry-examples-label">
                  <Sparkles size={13} /> 可以这样问:
                </span>
                {AUDIT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="cw-entry-example-btn"
                    title={preset.hint}
                    onClick={() => void startAudit(preset.question)}
                  >
                    {preset.label}
                    <ArrowRight size={12} />
                  </button>
                ))}
              </div>
              <div className="audit-entry-actions">
                <div className="audit-card__head">
                  <Chip>
                    <Database size={11} /> {baseCtx.scopeLabel}
                  </Chip>
                  <Chip>周期 {week}</Chip>
                  <Chip tone="audit-chip--accent">
                    <Wrench size={11} /> {AUDIT_TOOL_LIST.length} 个白名单工具
                  </Chip>
                </div>
                <button
                  type="button"
                  className="cw-primary"
                  disabled={!entryText.trim() || leaving}
                  onClick={() => void startAudit(entryText)}
                >
                  <Sparkles size={15} /> 开始审计 <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="cw-root" data-i18n-skip="true">
      <div className={`studio ${leaving ? "cw-swap-out" : "cw-swap-in"}`}>
        <header className="studio__header">
          <div className="studio__header-left">
            <div className="studio__identity">
              <span className="studio__identity-icon">
                <ShieldCheck size={16} />
              </span>
              <div className="studio__identity-info">
                <strong className="studio__brand-title">数据审计</strong>
                <span className="studio__topic-pill" title={baseCtx.scopeLabel}>
                  {baseCtx.scopeLabel} · {week}
                </span>
              </div>
            </div>
          </div>
          <ol className="studio__steps" aria-label="审计进度">
            {AUDIT_STEPS.map((label, index) => (
              <li
                key={label}
                className={`studio__step-item ${index === stepIndex ? "active" : ""} ${
                  index < stepIndex ? "complete" : ""
                }`}
              >
                <span className="studio__step-badge">{index + 1}</span>
                <span className="studio__step-label">{label}</span>
                {index < AUDIT_STEPS.length - 1 ? (
                  <span className="studio__step-divider" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>
          <div className="studio__header-right">
            <span className={`studio__saved ${running ? "is-busy" : ""}`}>
              {running ? <Loader2 size={13} className="cw-spin" /> : <ShieldCheck size={13} />}
              {running ? "执行中" : "结论已留痕"}
            </span>
            <button type="button" className="cw-ghost" onClick={restart}>
              重新开始
            </button>
          </div>
        </header>

        <div className="studio__body">
          <div className="studio__conversation">
            <div className="studio__coach-bar">
              <div className="studio__coach-profile">
                <span className="studio__coach-avatar">
                  <Bot size={14} />
                </span>
                <div className="studio__coach-meta">
                  <span className="studio__coach-name">审计 Agent</span>
                  <span className="studio__coach-status">
                    <span className="studio__pulse-dot" /> 只读业务数据 · 不改任务
                  </span>
                </div>
              </div>
              <span className="studio__round-pill">{AUDIT_STEPS[stepIndex]}</span>
            </div>

            <div className="audit-thread" ref={listRef}>
              {visibleItems.map((item) => {
                if (item.kind === "user")
                  return (
                    <div key={item.id} className="audit-user-bubble">
                      <div className="studio__user-bubble-wrap" style={{ width: "100%" }}>
                        <div className="studio__user-avatar">
                          <User size={13} />
                        </div>
                        <div className="studio__user-message">{item.text}</div>
                      </div>
                    </div>
                  );
                if (item.kind === "agent")
                  return (
                    <div key={item.id} className="studio__coach-bubble-wrap">
                      <div className="studio__bubble-avatar">
                        <Sparkles size={13} />
                      </div>
                      <div className="studio__bubble-content">
                        <div className="studio__speaker">
                          <span>审计 Agent</span>
                          {item.event ? <EventTag name={item.event} /> : null}
                        </div>
                        <p className="studio__message">{item.text}</p>
                      </div>
                    </div>
                  );
                if (item.kind === "clarify") {
                  const multi = item.clarification.field === "category";
                  const active = liveClarify?.id === item.id;
                  return (
                    <div key={item.id} className="studio__coach-bubble-wrap">
                      <div className="studio__bubble-avatar">
                        <KeyRound size={13} />
                      </div>
                      <div className="studio__bubble-content">
                        <div className="studio__speaker">
                          <span>审计 Agent</span>
                          <EventTag name="clarification_required" />
                        </div>
                        <div className="audit-card audit-card--clarify">
                          <div className="audit-headline">{item.clarification.question}</div>
                          {item.answered ? (
                            <div className="audit-options">
                              <span className="audit-option selected">
                                <Check size={11} /> {item.answered}
                              </span>
                            </div>
                          ) : (
                            <div className="audit-options">
                              {item.clarification.options.map((option) => {
                                const selected = item.picks.includes(option.value);
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    title={option.hint}
                                    disabled={!active}
                                    className={`audit-option ${selected ? "selected" : ""}`}
                                    onClick={() =>
                                      multi
                                        ? togglePick(item.id, option.value)
                                        : void answerClarify(item, option.value, option.label)
                                    }
                                  >
                                    {selected ? <Check size={11} /> : null}
                                    {option.label}
                                  </button>
                                );
                              })}
                              {multi ? (
                                <button
                                  type="button"
                                  className="cw-primary"
                                  style={{ minHeight: 30, padding: "4px 14px", fontSize: 12 }}
                                  disabled={!active || !item.picks.length}
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
                    </div>
                  );
                }
                if (item.kind === "tool")
                  return (
                    <div key={item.id} className="studio__coach-bubble-wrap">
                      <div className="studio__bubble-avatar">
                        <Wrench size={13} />
                      </div>
                      <div className="studio__bubble-content">
                        <ToolCallCard item={item} />
                      </div>
                    </div>
                  );
                return (
                  <div key={item.id} className="studio__coach-bubble-wrap">
                    <div className="studio__bubble-avatar">
                      <FileText size={13} />
                    </div>
                    <div className="studio__bubble-content">
                      <ReportCard
                        report={item.report}
                        busy={running}
                        onFocusTask={onFocusTask}
                        onExport={exportReport}
                        onRunTool={(id) => void runTool(id, undefined, item.ctx)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="audit-composer">
              <div className="audit-composer__row">
                <input
                  className="audit-input"
                  value={input}
                  disabled={running}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submit(input);
                  }}
                  placeholder={
                    liveClarify
                      ? "可以直接打字回答这一步，例如「上周」「南区」「全部品类」"
                      : "继续追问，例如：哪个区域工时压力最大？"
                  }
                />
                <button
                  type="button"
                  className="cw-primary"
                  disabled={running || !input.trim()}
                  onClick={() => submit(input)}
                >
                  {running ? <Loader2 size={14} className="cw-spin" /> : <Send size={14} />}
                  {running ? "执行中" : "发送"}
                </button>
              </div>
            </div>
          </div>

          <aside className="studio__draft">
            <header className="studio__draft-header">
              <div className="studio__draft-title">
                <span className="studio__draft-icon">
                  <Database size={15} />
                </span>
                <h2>审计口径与工具</h2>
              </div>
              <span className="studio__canvas-badge">只读</span>
            </header>
            <div className="studio__document">
              <div className="audit-rail-block">
                <span className="audit-section-title">本次查询口径</span>
                <div className="audit-rail-row">
                  <span>数据出口</span>
                  <strong>ADM（唯一出口）</strong>
                </div>
                <div className="audit-rail-row">
                  <span>可见范围</span>
                  <strong>{baseCtx.scopeLabel}</strong>
                </div>
                <div className="audit-rail-row">
                  <span>规则集</span>
                  <strong>v{state.policy.version}（A–G）</strong>
                </div>
                <div className="audit-rail-row">
                  <span>周容量基线</span>
                  <strong>{state.policy.weeklyCapacityMinutes} 分钟</strong>
                </div>
                <div className="audit-rail-row">
                  <span>单日上限</span>
                  <strong>{state.policy.dailyLimitMinutes} 分钟</strong>
                </div>
                <div className="audit-rail-row">
                  <span>数据版本</span>
                  <strong>v{state.revision}</strong>
                </div>
                <div className="audit-rail-row">
                  <span>最近审计</span>
                  <strong>{state.lastRunAt ? jakartaStamp(state.lastRunAt) : "尚未运行"}</strong>
                </div>
                <div className="audit-error audit-error--permission" style={{ marginTop: 4 }}>
                  <AlertTriangle size={11} />
                  <span>
                    只读业务数据并按规则找问题，不修改培训任务、人员、组织与成绩；飞书由 ADM 在发送前再校验接收人权限。
                  </span>
                </div>
              </div>

              <div className="audit-rail-block" style={{ marginTop: 12 }}>
                <span className="audit-section-title">工具白名单</span>
                <span className="audit-tool-row__desc">
                  只有登记过的工具可以被调用，没有「执行任意 SQL」这类入口；点工具名可单独调用。
                </span>
                {AUDIT_TOOL_LIST.map((tool) => {
                  const count = callCounts.get(tool.id) ?? 0;
                  const headline = latestHeadline.get(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className="audit-tool-row"
                      disabled={running}
                      title={`${tool.desc}｜权限码 ${tool.permission}`}
                      onClick={() => void runTool(tool.id)}
                    >
                      <span className="audit-tool-row__head">
                        <span className="audit-tool-name">{tool.name}</span>
                        <Chip tone={tool.owner === "adm" ? "audit-chip--accent" : undefined}>
                          {tool.owner === "adm" ? "ADM" : "SUP"}
                        </Chip>
                        {count ? (
                          <Chip tone="audit-chip--accent">×{count}</Chip>
                        ) : (
                          <span className="audit-meta">未调用</span>
                        )}
                      </span>
                      <span className="audit-tool-row__desc">
                        {tool.title}
                        {headline ? ` · ${headline}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="audit-rail-block" style={{ marginTop: 12 }}>
                <span className="audit-section-title">可以这样问</span>
                {[
                  ...AUDIT_PRESETS.map((preset) => preset.question),
                  "把结论保存成审计记录",
                  "每周一早上九点自动跑这个审计",
                ].map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="studio__text-button"
                    style={{ paddingLeft: 0, textAlign: "left" }}
                    disabled={running}
                    onClick={() => void ask(question)}
                  >
                    <PlayCircle size={12} /> {question}
                  </button>
                ))}
              </div>
            </div>
            <div className="studio__composer">
              <div className="studio__composer-actions">
                <span className="studio__hint">
                  <ShieldCheck size={13} /> 报告只复述工具结果，处置需要人工确认后才写入新版本。
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
