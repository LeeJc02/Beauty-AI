import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  FileText,
  KeyRound,
  Lightbulb,
  ListChecks,
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
  AUDIT_STEP_NARRATION,
  AUDIT_TOOL_LIST,
  FOCUS_LABELS,
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
  type ClarifyField,
} from "../../lib/auditTools";
import { LEVEL_LABELS } from "../../lib/inspectionEngine";
import type {
  AuditRecord,
  AuditSchedule,
  InspectionActor,
  InspectionState,
  RiskLevel,
} from "../../lib/inspectionTypes";
import { jakartaStamp } from "./shared";
import "./audit-console.css";

/* ------------------------------------------------------------------ 类型 */

/** 查询过程里的一步：工具 + 旁白 + 结果。 */
interface TrailStep {
  id: string;
  spec: AuditToolSpec;
  narration: string;
  status: "running" | "done" | "error";
  output?: AuditToolOutput;
  error?: AuditError;
}

interface TrailItem {
  kind: "trail";
  id: string;
  steps: TrailStep[];
}

interface ClarifyItem {
  kind: "clarify";
  id: string;
  questions: Clarification[];
  /** 已答问题的可读答案，键是问题序号。 */
  answers: Record<number, string>;
  picks: string[];
  /** 当前正在问第几个问题；等于 questions.length 时表示问完了。 */
  index: number;
}

type ConsoleItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "agent"; id: string; text: string; event?: string; tone?: "note" | "confirm" | "error" }
  | ClarifyItem
  | TrailItem
  | { kind: "report"; id: string; report: AuditReport; ctx: AuditContext; question: string };

const uid = () => `audit-${Math.random().toString(36).slice(2, 9)}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 四个阶段，与「生成课件」的轨道同构：理解 → 确认 → 取数 → 汇报。 */
export const AUDIT_STEPS = ["理解需求", "确认口径", "取数核对", "汇报结论"] as const;

/** 补问的默认答案：老板点「先跳过」时按这个口径继续。 */
const CLARIFY_DEFAULT: Record<ClarifyField, { value: string; label: string }> = {
  time: { value: "this-week", label: "本周" },
  region: { value: "__all__", label: "全国" },
  category: { value: "__all__", label: "全部品类" },
  focus: { value: "all", label: "全部方面" },
};

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

/** 旁白下面的结果摘要：只留第一句话，避免卡片被长句子撑开。 */
function shortHeadline(text: string) {
  const cut = text.split(/[。；]/)[0] ?? text;
  return cut.length > 46 ? `${cut.slice(0, 46)}…` : cut;
}

const scopeText = (ctx: AuditContext) =>
  `${ctx.scopeLabel} · ${ctx.weeks.length > 1 ? `${ctx.weeks.length} 个周期` : `周期 ${ctx.week.slice(5)}`} · ${FOCUS_LABELS[ctx.focus]}${
    ctx.categories.length ? ` · 品类 ${ctx.categories.join("、")}` : ""
  }`;

/* ------------------------------------------------------------ 小元件 */

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

function StatusDot({ status }: { status: TrailStep["status"] }) {
  if (status === "running")
    return (
      <span className="audit-step__dot is-running">
        <Loader2 size={11} className="cw-spin" />
      </span>
    );
  if (status === "error")
    return (
      <span className="audit-step__dot is-error">
        <AlertTriangle size={11} />
      </span>
    );
  return (
    <span className="audit-step__dot is-done">
      <Check size={11} />
    </span>
  );
}

/* ------------------------------------------------------ 一次调用的细节 */

function CallDetail({ step }: { step: TrailStep }) {
  const { spec, output } = step;
  if (step.error)
    return (
      <div className="audit-detail">
        <div className={`audit-error ${ERROR_CLASS[step.error.kind]}`}>
          <strong>
            {ERROR_LABEL[step.error.kind]} · {step.error.code}
          </strong>
          <span>{step.error.userMessage}</span>
          <span className="audit-meta">
            {step.error.retryable ? "可重试" : "不可重试"} ·{" "}
            {step.error.needUserInput ? "需要补充信息" : "无需补充信息"}
          </span>
        </div>
        <div className="audit-tech">
          <span>权限码 {spec.permission}</span>
          <span>模型可见 {step.error.modelMessage}</span>
        </div>
      </div>
    );
  if (!output) return null;
  return (
    <div className="audit-detail">
      <p className="audit-headline" style={{ margin: 0 }}>
        {output.headline}
      </p>
      {output.facts.length ? (
        <div className="audit-facts">
          {output.facts.map((fact) => (
            <div key={fact.label} className="audit-fact" title={fact.hint}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
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
        {output.notes.map((note) => (
          <div key={note} className="audit-notes__row">
            <span />
            <span>{note}</span>
          </div>
        ))}
      </div>
      <div className="audit-section-title">数据来源</div>
      <div className="audit-sources">
        {output.sources.map((source) => (
          <Chip key={source}>{source}</Chip>
        ))}
      </div>
      <div className="audit-tech">
        <span className="audit-mono">{spec.name}</span>
        <span>{spec.owner === "adm" ? "ADM" : "Supervisor"}</span>
        <span>权限码 {spec.permission}</span>
        {spec.params.map((param) => (
          <span key={`${param.label}-${param.value}`}>
            {param.label}={param.value}
          </span>
        ))}
        <span className="audit-mono">{output.traceId}</span>
        <span>{output.scanned}</span>
        <span>{output.ms}ms</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- 查询过程卡 */

function TrailCard({ item, live }: { item: TrailItem; live: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const done = item.steps.filter((step) => step.status !== "running").length;
  return (
    <div className={`audit-trail ${live ? "is-live" : ""}`}>
      <div className="audit-trail__head">
        <span className="audit-trail__title">
          <ListChecks size={12} /> 查询过程
        </span>
        <span className="audit-meta">
          {done}/{item.steps.length} 步完成
        </span>
      </div>
      {item.steps.map((step) => (
        <div key={step.id} className={`audit-step is-${step.status}`}>
          <div className="audit-step__row">
            <StatusDot status={step.status} />
            <span className="audit-step__text">
              <span className="audit-step__narration">{step.narration}</span>
              <span className="audit-step__meta">
                <span className="audit-step__tool audit-mono">{step.spec.name}</span>
                <span className="audit-step__result">
                  {step.status === "running"
                    ? "查询中…"
                    : step.status === "error"
                      ? "权限被拒绝"
                      : shortHeadline(step.output?.headline ?? "")}
                </span>
              </span>
            </span>
            {step.output?.table || step.error ? (
              <button
                type="button"
                className="audit-step__more"
                onClick={() => setOpen((value) => ({ ...value, [step.id]: !value[step.id] }))}
              >
                {open[step.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {open[step.id] ? "收起" : "看数据"}
              </button>
            ) : null}
          </div>
          {open[step.id] ? <CallDetail step={step} /> : null}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ 图表 */

/** 区域人均排期：横向条 + 容量基线刻度，超容量的区域标红。 */
function RegionChart({ report }: { report: AuditReport }) {
  if (!report.regions.length) return null;
  const scale = Math.max(
    1,
    ...report.regions.map((region) => Math.max(region.meanMinutes, region.capacityMinutes)),
  );
  return (
    <div className="audit-chart">
      <div className="audit-chart__head">
        <span className="audit-section-title">
          <BarChart3 size={12} /> 各区域人均排期
        </span>
        <span className="audit-meta">竖线 = 该区域容量基线 · 红条 = 已有人超容量</span>
      </div>
      {report.regions.map((region) => (
        <div key={region.regionId} className="audit-chart__row">
          <span className="audit-chart__label" title={region.name}>
            {region.name}
          </span>
          <span className="audit-chart__track">
            <span
              className={`audit-chart__bar ${
                region.overCapacityCount ? "is-over" : ""
              }`}
              style={{ width: `${Math.max((region.meanMinutes / scale) * 100, 1.5)}%` }}
            />
            <span
              className="audit-chart__base"
              style={{ left: `${(region.capacityMinutes / scale) * 100}%` }}
              title={`容量基线 ${region.capacityMinutes} 分钟`}
            />
          </span>
          <span className="audit-chart__value">
            {region.taskCount === 0 ? "本期无任务" : `${region.meanMinutes} 分`}
            {region.overCapacityCount ? (
              <em>· {region.overCapacityCount} 人超</em>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 这一周每天最忙的人：找出「时间集中」到底挤在哪一天。 */
function DayChart({ report }: { report: AuditReport }) {
  if (!report.days.length) return null;
  const scale = Math.max(
    1,
    ...report.days.map((day) => day.peakMinutes),
    report.dailyLimitMinutes,
  );
  /** 日期标签带上星期：老板读「周三」比读「17」快。 */
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const labelOf = (day: string) => {
    const date = new Date(`${day}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? day.slice(8)
      : `周${WEEKDAYS[date.getUTCDay()]} ${day.slice(8)}`;
  };
  return (
    <div className="audit-chart">
      <div className="audit-chart__head">
        <span className="audit-section-title">
          <BarChart3 size={12} /> 这一周每天最忙的人
        </span>
        <span className="audit-meta">虚线 = 每天 {report.dailyLimitMinutes} 分钟承受线</span>
      </div>
      <div className="audit-days">
        {report.days.map((day) => (
          <div
            key={day.day}
            className="audit-days__col"
            title={`${day.day.slice(5)} · 最忙 ${day.peakMinutes} 分钟 · 人均 ${day.meanMinutes} 分钟`}
          >
            <span className="audit-days__track">
              <span
                className={`audit-days__bar ${
                  day.peakMinutes > report.dailyLimitMinutes ? "is-over" : ""
                }`}
                style={{ height: `${(day.peakMinutes / scale) * 100}%` }}
              />
              <span
                className="audit-days__limit"
                style={{ bottom: `${(report.dailyLimitMinutes / scale) * 100}%` }}
              />
            </span>
            <span className="audit-days__value">{day.peakMinutes}</span>
            <span className="audit-days__label">{labelOf(day.day)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 汇报卡 */

function BriefingCard({
  report,
  steps,
  busy,
  taskTitleOf,
  onFocusTask,
  onExport,
  onRunTool,
}: {
  report: AuditReport;
  steps: TrailStep[];
  busy: boolean;
  taskTitleOf: (taskId: string) => string;
  onFocusTask: (taskId: string) => void;
  onExport: (report: AuditReport) => void;
  onRunTool: (id: AuditToolId) => void;
}) {
  const [open, setOpen] = useState<"none" | "data" | "tech">("none");
  const [acked, setAcked] = useState(false);
  const tables = steps.filter((step) => step.output?.table);
  const sources = [...new Set(steps.flatMap((step) => step.output?.sources ?? []))];
  const toggle = (next: "data" | "tech") =>
    setOpen((value) => (value === next ? "none" : next));
  return (
    <div className="audit-card audit-card--report">
      <div className="audit-card__head">
        <span className="audit-report__icon">
          <FileText size={12} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{report.title}</span>
        <Chip tone={VERDICT_CLASS[report.verdict]}>{report.verdict}</Chip>
        <span className="audit-meta audit-mono">规则集 {report.ruleVersion}</span>
      </div>

      <p className="audit-briefing">{report.briefing}</p>

      <div className="audit-report__metrics">
        {report.metrics.map((metric) => (
          <div key={metric.label} className="audit-fact" title={metric.hint}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <RegionChart report={report} />
      <DayChart report={report} />

      {report.findings.length ? (
        <>
          <div className="audit-section-title">
            需要你知道的 {report.findings.length} 件事
          </div>
          {report.findings.map((finding, index) => (
            <div key={`${index}-${finding.ruleId}`} className="audit-finding">
              <div className="audit-card__head">
                <Chip tone={LEVEL_CLASS[finding.level]}>
                  {LEVEL_LABELS[finding.level]}
                </Chip>
                <span className="audit-tool-name">{finding.ruleId}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{finding.title}</span>
              </div>
              <div className="audit-finding__detail">{finding.detail}</div>
              <div className="audit-finding__evidence">
                证据：{finding.evidence}
                <span className="audit-meta"> · 出处 {finding.source}</span>
              </div>
              {finding.taskIds.length ? (
                <div className="audit-options">
                  {finding.taskIds.slice(0, 3).map((taskId) => (
                    <button
                      key={taskId}
                      type="button"
                      className="audit-option audit-option--task"
                      title={taskTitleOf(taskId)}
                      onClick={() => onFocusTask(taskId)}
                    >
                      看「{taskTitleOf(taskId)}」
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </>
      ) : (
        <div className="audit-ok-note">
          <CheckCircle2 size={12} /> 本期没有命中审计规则，按现在的排期继续即可。
        </div>
      )}

      {report.actions.length ? (
        <>
          <div className="audit-section-title">
            <Lightbulb size={12} /> 建议怎么做（不会自动改任务）
          </div>
          <div className="audit-notes">
            {report.actions.map((action, index) => (
              <div key={action} className="audit-notes__row">
                <span style={{ marginTop: 6 }} />
                <span style={{ color: "var(--cw-ink2)", fontSize: 11.5 }}>
                  {index + 1}. {action}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="audit-actions audit-actions--toggles">
        <button
          type="button"
          className={`audit-toggle ${open === "data" ? "is-open" : ""}`}
          onClick={() => toggle("data")}
        >
          <Database size={12} /> 汇报背后的数据（{tables.length} 张表）
        </button>
        <button
          type="button"
          className={`audit-toggle ${open === "tech" ? "is-open" : ""}`}
          onClick={() => toggle("tech")}
        >
          <Wrench size={12} /> 这次怎么查的（{steps.length} 步）
        </button>
      </div>

      {open === "data" ? (
        <div className="audit-detail">
          {tables.map((step, index) => (
            <div key={step.id} className="audit-detail__block">
              <div className="audit-section-title">
                {index + 1}. {step.spec.title}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="audit-table">
                  <thead>
                    <tr>
                      {step.output!.table!.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {step.output!.table!.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="audit-section-title">数据来源与口径</div>
          <div className="audit-sources">
            {sources.map((source) => (
              <Chip key={source}>{source}</Chip>
            ))}
          </div>
          <div className="audit-meta">{report.scope}</div>
        </div>
      ) : null}

      {open === "tech" ? (
        <div className="audit-detail">
          {steps.map((step) => (
            <div key={step.id} className="audit-tech audit-tech--block">
              <span className="audit-mono">{step.spec.name}</span>
              <span>{step.spec.owner === "adm" ? "ADM" : "Supervisor"}</span>
              <span>权限码 {step.spec.permission}</span>
              {step.spec.params.map((param) => (
                <span key={`${param.label}-${param.value}`}>
                  {param.label}={param.value}
                </span>
              ))}
              {step.output ? (
                <>
                  <span className="audit-mono">{step.output.traceId}</span>
                  <span>{step.output.scanned}</span>
                  <span>{step.output.ms}ms</span>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="audit-actions audit-actions--footer">
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
    </div>
  );
}

/* ------------------------------------------------------------ 补问卡 */

function ClarifyCard({
  item,
  live,
  onAnswer,
  onPick,
  onSkip,
}: {
  item: ClarifyItem;
  live: boolean;
  onAnswer: (
    item: ClarifyItem,
    index: number,
    value: string,
    label: string,
  ) => void;
  onPick: (id: string, value: string) => void;
  onSkip: (item: ClarifyItem, index: number) => void;
}) {
  return (
    <div className="audit-card audit-card--clarify">
      <div className="audit-card__head">
        <Chip tone="audit-chip--accent">
          <KeyRound size={9} /> 需要你确认 · {Object.keys(item.answers).length}/{item.questions.length}
        </Chip>
        <span className="audit-meta">
          点选项就行，也可以在下方的输入框里直接打字；不确定的点「先跳过」
        </span>
      </div>
      {item.questions.map((question, index) => {
        const answered = item.answers[index];
        const active = live && index === item.index;
        const multi = question.field === "category";
        return (
          <div key={`${question.field}-${index}`} className={`audit-ask ${active ? "is-active" : ""}`}>
            <div className="audit-ask__head">
              <span className="audit-ask__no">{index + 1}</span>
              <span className="audit-ask__q">{question.question}</span>
              {answered ? (
                <Chip tone="audit-chip--ok">
                  <Check size={9} /> {answered}
                </Chip>
              ) : null}
            </div>
            {active ? (
              <div className="audit-options">
                {question.options.map((option) => {
                  const selected = item.picks.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      title={option.hint}
                      className={`audit-option ${selected ? "selected" : ""}`}
                      onClick={() =>
                        multi
                          ? onPick(item.id, option.value)
                          : onAnswer(item, index, option.value, option.label)
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
                    className="cw-primary audit-option--go"
                    disabled={!item.picks.length}
                    onClick={() =>
                      onAnswer(item, index, item.picks.join(","), item.picks.join("、"))
                    }
                  >
                    下一步
                  </button>
                ) : null}
                <button
                  type="button"
                  className="audit-skip"
                  onClick={() => onSkip(item, index)}
                >
                  先跳过（按 {CLARIFY_DEFAULT[question.field].label}）
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
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
  onOpenArchive,
  onSaveAuditRecord,
  onSaveAuditSchedule,
}: {
  state: InspectionState;
  actor: InspectionActor;
  week: string;
  today: string;
  onFocusTask: (taskId: string) => void;
  onToast: (text: string) => void;
  /** 跳到「审计档案」（指标、审计记录、区域工时等留档视图）。 */
  onOpenArchive?: () => void;
  /** 把 Agent 的“保存”动作交给页面容器，统一写入审计状态。 */
  onSaveAuditRecord?: (record: AuditRecord) => void;
  onSaveAuditSchedule?: (schedule: AuditSchedule) => void;
}) {
  const [items, setItems] = useState<ConsoleItem[]>([]);
  const [input, setInput] = useState("");
  const [entryText, setEntryText] = useState("");
  const [running, setRunning] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [savedScheduleId, setSavedScheduleId] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "context">("chat");
  /** 左右面板交换：和「生成课件」同一套交互，顺序记在 localStorage。 */
  const [panelsSwapped, setPanelsSwapped] = useState(
    () => window.localStorage.getItem("audit-console-panels-swapped") === "true",
  );
  const togglePanelsSwapped = useCallback(() => {
    setPanelsSwapped((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem("audit-console-panels-swapped", String(next));
      } catch {
        /* 隐私模式下只影响本次演示 */
      }
      return next;
    });
  }, []);
  const [toolsOpen, setToolsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  /** 新内容出现时把底部哨兵滚进视野：页面滚动容器在 main 上，滚动哨兵比滚容器更可靠。 */
  const endRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);
  const runningRef = useRef(false);
  const liveRef = useRef({ state, week, today, actor });
  liveRef.current = { state, week, today, actor };
  /** 补问进行中：question 是老板最初那句话，ctx 是已经确认的口径。 */
  const [pending, setPending] = useState<{
    question: string;
    ctx: AuditContext;
  } | null>(null);

  const baseCtx = useMemo(
    () => auditContext(state, actor, week, today),
    [state, actor, week, today],
  );

  const trails = useMemo(
    () => items.filter((item): item is TrailItem => item.kind === "trail"),
    [items],
  );
  const lastTrail = trails.at(-1);
  const latestReport = useMemo(() => {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.kind === "report") return item;
    }
    return null;
  }, [items]);
  /** 正在生效的口径：已经出过汇报就用那次汇报的口径，否则用页面当前周期。 */
  const activeCtx = latestReport?.ctx ?? baseCtx;
  const liveClarify = items.find(
    (item): item is ClarifyItem => item.kind === "clarify" && item.index < item.questions.length,
  );
  const callCounts = useMemo(() => {
    const counts = new Map<AuditToolId, number>();
    for (const trail of trails)
      for (const step of trail.steps)
        counts.set(step.spec.id, (counts.get(step.spec.id) ?? 0) + 1);
    return counts;
  }, [trails]);
  /** 右栏「已经拿到的数据」：按完成顺序列出每次取数的关键指标。 */
  const dataPoints = useMemo(
    () =>
      trails.flatMap((trail) =>
        trail.steps
          .filter((step) => step.status === "done" && step.output)
          .map((step) => ({
            id: step.id,
            title: step.spec.title,
            headline: shortHeadline(step.output!.headline),
            facts: step.output!.facts.slice(0, 2),
          })),
      ),
    [trails],
  );

  useEffect(() => {
    if (items.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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

  const stepIndex = latestReport
    ? 3
    : trails.length
      ? 2
      : liveClarify
        ? 1
        : 0;

  /** 按计划执行：一次「查数据 → 汇报」的完整流程。 */
  const runPlan = useCallback(
    async (question: string, ctx: AuditContext) => {
      const token = (runRef.current += 1);
      runningRef.current = true;
      setRunning(true);
      const { state: current } = liveRef.current;
      const plan = planFor(current, ctx, question);
      const trailId = uid();
      push({
        kind: "agent",
        id: uid(),
        text: `好，按这个口径查：${scopeText(ctx)}。我边查边跟你说结果。`,
        tone: "confirm",
        event: "run_started",
      });
      push({ kind: "trail", id: trailId, steps: [] });
      let steps: TrailStep[] = [];
      const patch = (next: TrailStep[]) =>
        setItems((previous) =>
          previous.map((item) =>
            item.kind === "trail" && item.id === trailId ? { ...item, steps: next } : item,
          ),
        );
      for (const stepId of plan.steps) {
        if (token !== runRef.current) return;
        const spec = specFor(stepId, current, ctx, question);
        steps = [
          ...steps,
          {
            id: uid(),
            spec,
            narration: AUDIT_STEP_NARRATION[stepId],
            status: "running" as const,
          },
        ];
        patch(steps);
        await sleep(220 + spec.params.length * 60);
        if (token !== runRef.current) return;
        const output = runAuditTool(stepId, current, ctx, question);
        steps = steps.map((step, index) =>
          index === steps.length - 1
            ? { ...step, status: "done" as const, output }
            : step,
        );
        patch(steps);
        await sleep(90);
      }
      if (token !== runRef.current) return;
      push({
        kind: "agent",
        id: uid(),
        text: "查完了，先给结论：",
        event: "report_completed",
      });
      push({
        kind: "report",
        id: uid(),
        report: buildAuditReport(current, ctx),
        ctx,
        question,
      });
      runningRef.current = false;
      setRunning(false);
    },
    [push],
  );

  /** 单独跑一个工具：用于「保存审计记录 / 每周自动审计」这类动作。 */
  const runTool = useCallback(
    async (id: AuditToolId, question?: string, override?: AuditContext) => {
      if (runningRef.current) return;
      const { state: current, week: currentWeek, today: currentToday, actor: currentActor } =
        liveRef.current;
      const ctx = override ?? auditContext(current, currentActor, currentWeek, currentToday);
      const spec = specFor(id, current, ctx, question);
      const token = (runRef.current += 1);
      runningRef.current = true;
      setRunning(true);
      const trailId = uid();
      if (id !== "save_inspection_record" && id !== "save_schedule") {
        push(
          { kind: "user", id: uid(), text: manualToolQuestion(id) },
          { kind: "trail", id: trailId, steps: [] },
        );
      } else {
        push({ kind: "trail", id: trailId, steps: [] });
      }
      const step: TrailStep = {
        id: uid(),
        spec,
        narration: AUDIT_STEP_NARRATION[id],
        status: "running",
      };
      const patch = (nextStep: TrailStep) =>
        setItems((previous) =>
          previous.map((item) =>
            item.kind === "trail" && item.id === trailId ? { ...item, steps: [nextStep] } : item,
          ),
        );
      patch(step);
      await sleep(300);
      if (token !== runRef.current) return;
      const output = runAuditTool(id, current, ctx, question);
      patch({ ...step, status: "done", output });

      // 报告卡上的动作必须真正进入审计状态；否则刷新后会出现“已保存”但记录消失的断链。
      const now = new Date().toISOString();
      if (id === "save_inspection_record") {
        const report = latestReport?.report ?? buildAuditReport(current, ctx);
        const record: AuditRecord = {
          id: `audit-record-${Date.now()}`,
          question: question ?? latestReport?.question ?? "本次数据审计",
          createdAt: now,
          actorId: currentActor.id,
          actorName: currentActor.name,
          roleLabel: currentActor.roleLabel,
          weeks: [...ctx.weeks],
          scopeLabel: ctx.scopeLabel,
          focus: ctx.focus,
          categories: [...ctx.categories],
          reportId: report.id,
          reportTitle: report.title,
          verdict: report.verdict,
          findingCount: report.findings.length,
          taskCount: current.tasks.filter((task) => task.status !== "disabled").length,
          ruleVersion: report.ruleVersion,
          traceIds: [
            ...new Set([
              ...trails.flatMap((trail) =>
                trail.steps.flatMap((trailStep) =>
                  trailStep.output ? [trailStep.output.traceId] : [],
                ),
              ),
              output.traceId,
            ]),
          ],
        };
        onSaveAuditRecord?.(record);
        setSavedRecordId(record.id);
      }
      if (id === "save_schedule") {
        const existing = (current.auditSchedules ?? []).find(
          (schedule) =>
            schedule.actorId === currentActor.id &&
            schedule.scopeLabel === ctx.scopeLabel &&
            schedule.focus === ctx.focus &&
            schedule.categories.join(",") === ctx.categories.join(","),
        );
        const schedule: AuditSchedule = {
          id: existing?.id ?? `audit-schedule-${Date.now()}`,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          actorId: currentActor.id,
          actorName: currentActor.name,
          roleLabel: currentActor.roleLabel,
          active: true,
          cadence: "weekly",
          weekday: 1,
          time: "09:00",
          timezone: "Asia/Jakarta",
          weeks: [...ctx.weeks],
          scopeLabel: ctx.scopeLabel,
          focus: ctx.focus,
          categories: [...ctx.categories],
          ruleVersion: current.policy.version.toString(),
        };
        onSaveAuditSchedule?.(schedule);
        setSavedScheduleId(schedule.id);
      }

      runningRef.current = false;
      setRunning(false);
      onToast(`${spec.title}完成：${output.headline}`);
    },
    [latestReport, onSaveAuditRecord, onSaveAuditSchedule, onToast, push, trails],
  );

  const pushPermissionError = useCallback(
    (regionName: string, visible: string[], question: string) => {
      const spec = specFor("query_scope", liveRef.current.state, baseCtx);
      push(
        { kind: "user", id: uid(), text: question },
        {
          kind: "agent",
          id: uid(),
          text: `你问的${regionName}不在当前账号的数据范围里，ADM 的权限校验直接拒了这次查询，我不会绕过去取数。可以问${visible.join("、")}，或者换总部账号看${regionName}。`,
          event: "tool_call_completed",
          tone: "error",
        },
        {
          kind: "trail",
          id: uid(),
          steps: [
            {
              id: uid(),
              spec,
              narration: AUDIT_STEP_NARRATION.query_scope,
              status: "error",
              error: {
                code: "PERMISSION_DENIED",
                kind: "permission",
                userMessage: `当前账号是${actor.roleLabel}，只能查看${visible.join("、")}与全国任务；${regionName}的数据不会返回。`,
                modelMessage: `scope=${visible.join("|")} requested=${regionName}`,
                retryable: false,
                needUserInput: true,
              },
            },
          ],
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
        await runTool(toolIntent, question, ctx);
        return;
      }
      const questions = clarificationsFor(current, ctx, question);
      if (questions.length) {
        push(
          { kind: "user", id: uid(), text: question },
          {
            kind: "agent",
            id: uid(),
            text: "明白，开始查之前先跟你对一下口径——就差这几件事：",
            tone: "note",
          },
          {
            kind: "clarify",
            id: uid(),
            questions,
            answers: {},
            picks: [],
            index: 0,
          },
        );
        setPending({ question, ctx });
        return;
      }
      push({ kind: "user", id: uid(), text: question });
      await runPlan(question, ctx);
    },
    [pending, push, pushPermissionError, runPlan, runTool],
  );

  const answerClarify = useCallback(
    async (item: ClarifyItem, index: number, value: string, label: string) => {
      if (!pending) return;
      const question = item.questions[index];
      const nextCtx = applyClarification(
        liveRef.current.state,
        pending.ctx,
        question.field,
        value,
      );
      const nextIndex = index + 1;
      setItems((previous) =>
        previous.map((entry) =>
          entry.kind === "clarify" && entry.id === item.id
            ? {
                ...entry,
                answers: { ...entry.answers, [index]: label },
                picks: [],
                index: nextIndex,
              }
            : entry,
        ),
      );
      if (nextIndex < item.questions.length) {
        setPending({ question: pending.question, ctx: nextCtx });
        return;
      }
      setPending(null);
      await runPlan(pending.question, nextCtx);
    },
    [pending, runPlan],
  );

  const skipClarify = useCallback(
    (item: ClarifyItem, index: number) => {
      const fallback = CLARIFY_DEFAULT[item.questions[index].field];
      void answerClarify(item, index, fallback.value, fallback.label);
    },
    [answerClarify],
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

  const answerByText = (item: ClarifyItem, text: string) => {
    const question = item.questions[item.index];
    if (!question) return;
    const hit = question.options.find(
      (option) => text.includes(option.label) || option.value === text,
    );
    if (hit) {
      void answerClarify(item, item.index, hit.value, hit.label);
      return;
    }
    if (question.field === "region") {
      const region = liveRef.current.state.regions.find(
        (entry) => text.includes(entry.name) && baseCtx.regionIds.includes(entry.id),
      );
      if (region) {
        void answerClarify(item, item.index, region.id, region.name);
        return;
      }
    }
    push({
      kind: "agent",
      id: uid(),
      text: `这一步我没接住。可以点上面的选项，或者按这些说法回答：${question.options
        .map((option) => option.label)
        .join("、")}。`,
      tone: "note",
    });
  };

  const submit = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    if (liveClarify) {
      setInput("");
      answerByText(liveClarify, text);
      return;
    }
    void ask(text);
  };

  const startAudit = async (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    // 左侧交互台始终保留，只把内容从入口平滑切换为对话流；右侧产物独立换场。
    setEntered(true);
    await ask(question);
  };

  const restart = () => {
    runRef.current += 1;
    runningRef.current = false;
    setRunning(false);
    setPending(null);
    setItems([]);
    setSavedRecordId(null);
    setSavedScheduleId(null);
    setEntered(false);
    setEntryText("");
    setInput("");
    setMobileTab("chat");
  };

  const exportReport = (report: AuditReport) => {
    const steps = lastTrail?.steps ?? [];
    const lines = [
      `${report.title}（SalesBoost AI 数据审计）`,
      `生成时间：${jakartaStamp(new Date().toISOString())} · 数据版本 v${state.revision} · 规则集 ${report.ruleVersion}`,
      `审计范围：${report.scope}`,
      "",
      `一、结论：${report.verdict}`,
      report.briefing,
      report.summary,
      "",
      "二、关键指标",
      ...report.metrics.map((metric) => `${metric.label}：${metric.value}`),
      "",
      "三、各区域人均排期",
      ...report.regions.map(
        (region) =>
          `${region.name}：人均 ${region.meanMinutes} 分钟 · 容量基线 ${region.capacityMinutes} 分钟 · ${region.overCapacityCount} 人超容量 · ${region.taskCount} 项任务`,
      ),
      "",
      "四、这一周每天最忙的人",
      ...report.days.map((day) => `${day.day}：最忙 ${day.peakMinutes} 分钟 · 人均 ${day.meanMinutes} 分钟`),
      "",
      `五、需要你知道的 ${report.findings.length} 件事`,
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
      "六、建议怎么做（不自动改任务）",
      ...report.actions.map((action, index) => `${index + 1}. ${action}`),
      "",
      "七、汇报背后的数据",
      ...steps.flatMap((step) =>
        step.output?.table
          ? [
              `【${step.spec.title}】`,
              step.output.table.columns.join(" | "),
              ...step.output.table.rows.map((row) => row.join(" | ")),
              "",
            ]
          : [],
      ),
      "八、这次怎么查的",
      ...steps.map(
        (step) =>
          `${step.spec.name}（${step.spec.owner} · ${step.spec.permission}）· ${step.spec.params
            .map((param) => `${param.label}=${param.value}`)
            .join(" · ")}${step.output ? ` · ${step.output.traceId} · ${step.output.scanned} · ${step.output.ms}ms` : ""}`,
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

  /* ------------------------------------------------------------ 工作台 */

  return (
    <div className="cw-root audit-console-root" data-i18n-skip="true">
      <div className={`studio ${leaving ? "cw-swap-out" : "cw-swap-in"}`}>
        <header className="studio__header">
          <div className="studio__header-left">
            <div className="studio__identity">
              <span className="studio__identity-icon">
                <ShieldCheck size={16} />
              </span>
              <div className="studio__identity-info">
                <strong className="studio__brand-title">数据审计</strong>
                <span className="studio__topic-pill" title={scopeText(activeCtx)}>
                  {activeCtx.scopeLabel} · {activeCtx.week.slice(5)}
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
              {running
                ? "执行中"
                : savedRecordId
                  ? "结论已留痕"
                  : savedScheduleId
                    ? "定时已保存"
                    : latestReport
                      ? "待保存"
                      : "等待提问"}
            </span>
            {onOpenArchive ? (
              <button type="button" className="cw-ghost" onClick={onOpenArchive}>
                <Archive size={13} /> 审计档案
              </button>
            ) : null}
            <button type="button" className="cw-ghost" onClick={restart}>
              重新开始
            </button>
          </div>
        </header>

        <div className="studio__mobile-tabs" role="tablist" aria-label="审计工作区">
          <button
            type="button"
            className={mobileTab === "chat" ? "active" : ""}
            onClick={() => setMobileTab("chat")}
          >
            与 Agent 对话
          </button>
          <button
            type="button"
            className={mobileTab === "context" ? "active" : ""}
            onClick={() => setMobileTab("context")}
          >
            审计依据
          </button>
        </div>

        <div className="studio__body">
          <div
            className={`studio__conversation ${mobileTab !== "chat" ? "mobile-hidden" : ""} ${
              panelsSwapped ? "is-swapped" : ""
            }`}
          >
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
              {!entered ? (
                <div className="audit-entry-inline">
                  <span className="cw-entry-badge"><ShieldCheck size={14} /> 数据审计 Agent</span>
                  <h1>想问什么，直接说。</h1>
                  <p>我会先跟你确认查什么、哪个范围、哪段时间，再去取数，最后给你一段带数据出处的汇报。</p>
                  <textarea
                    className="cw-textarea"
                    value={entryText}
                    onChange={(event) => setEntryText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) void startAudit(entryText); }}
                    placeholder="例如：最近培训情况怎么样？哪个区域工时压力最大？"
                  />
                  <div className="audit-entry-examples">
                    <span className="cw-entry-examples-label"><Sparkles size={13} /> 可以这样问:</span>
                    {AUDIT_PRESETS.map((preset) => (
                      <button key={preset.id} type="button" className="cw-entry-example-btn" onClick={() => void startAudit(preset.question)}>
                        {preset.label}<ArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                  <div className="audit-entry-actions">
                    <div className="audit-card__head"><Chip><Database size={11} /> {baseCtx.scopeLabel}</Chip><Chip>周期 {week.slice(5)}</Chip></div>
                    <button type="button" className="cw-primary" disabled={!entryText.trim() || leaving} onClick={() => void startAudit(entryText)}>
                      <Sparkles size={15} /> 开始审计 <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              ) : null}
              {entered ? items.map((item) => {
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
                    <div
                      key={item.id}
                      className={`studio__coach-bubble-wrap ${item.tone ? `is-${item.tone}` : ""}`}
                    >
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
                if (item.kind === "clarify")
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
                        <ClarifyCard
                          item={item}
                          live={liveClarify?.id === item.id && !!pending}
                          onAnswer={(entry, index, value, label) =>
                            void answerClarify(entry, index, value, label)
                          }
                          onPick={togglePick}
                          onSkip={skipClarify}
                        />
                      </div>
                    </div>
                  );
                if (item.kind === "trail")
                  return (
                    <div key={item.id} className="studio__coach-bubble-wrap">
                      <div className="studio__bubble-avatar">
                        <Wrench size={13} />
                      </div>
                      <div className="studio__bubble-content">
                        <TrailCard item={item} live={running && item === lastTrail} />
                      </div>
                    </div>
                  );
                return (
                  <div key={item.id} className="studio__coach-bubble-wrap">
                    <div className="studio__bubble-avatar">
                      <FileText size={13} />
                    </div>
                    <div className="studio__bubble-content">
                      <BriefingCard
                        report={item.report}
                        steps={lastTrail?.steps ?? []}
                        busy={running}
                        taskTitleOf={(taskId) =>
                          liveRef.current.state.tasks.find((task) => task.id === taskId)
                            ?.title ?? taskId
                        }
                        onFocusTask={onFocusTask}
                        onExport={exportReport}
                        onRunTool={(id) => void runTool(id, undefined, item.ctx)}
                      />
                    </div>
                  </div>
                );
              }) : null}
              <div ref={endRef} />
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
                      ? "也可以直接打字回答这一步，例如「上周」「南区」「全部品类」"
                      : "继续追问，例如：那南区呢？哪个区域压力最大？"
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

          {/* 中间：交换左右面板（顺序会被记住，窄屏双栏叠起来时不显示） */}
          <button
            type="button"
            className="studio__swap-panels"
            aria-label="交换左右面板"
            title="交换左右面板"
            onClick={togglePanelsSwapped}
          >
            <ArrowLeftRight size={16} />
          </button>

          <aside
            className={`studio__draft ${mobileTab !== "context" ? "mobile-hidden" : ""} ${
              panelsSwapped ? "is-swapped" : ""
            }`}
          >
            <header className="studio__draft-header">
              <div className="studio__draft-title">
                <span className="studio__draft-icon">
                  <Database size={15} />
                </span>
                <h2>审计依据</h2>
              </div>
              <span className="studio__canvas-badge">只读</span>
            </header>
            <div
              key={`${entered ? "entered" : "welcome"}-${latestReport?.report.id ?? dataPoints.length}`}
              className="studio__document audit-artifact-stage"
            >
              <div className="audit-rail-block">
                <span className="audit-section-title">这次查了什么</span>
                <div className="audit-rail-row">
                  <span>范围</span>
                  <strong>{activeCtx.scopeLabel}</strong>
                </div>
                <div className="audit-rail-row">
                  <span>周期</span>
                  <strong>{activeCtx.week.slice(5)} 起 7 天</strong>
                </div>
                <div className="audit-rail-row">
                  <span>关注方面</span>
                  <strong>{latestReport ? FOCUS_LABELS[activeCtx.focus] : "待确认"}</strong>
                </div>
                <div className="audit-rail-row">
                  <span>品类</span>
                  <strong>
                    {activeCtx.categories.length ? activeCtx.categories.join("、") : "全部品类"}
                  </strong>
                </div>
                <div className="audit-rail-row">
                  <span>数据版本</span>
                  <strong>v{state.revision}</strong>
                </div>
                <div className="audit-rail-row">
                  <span>规则集</span>
                  <strong>v{state.policy.version}（A–G）</strong>
                </div>
                <div className="audit-rail-row">
                  <span>单日承受线</span>
                  <strong>{state.policy.dailyLimitMinutes} 分钟</strong>
                </div>
                <div className="audit-rail-row">
                  <span>最近审计</span>
                  <strong>{state.lastRunAt ? jakartaStamp(state.lastRunAt) : "尚未运行"}</strong>
                </div>
              </div>

              <div className="audit-rail-block" style={{ marginTop: 12 }}>
                <span className="audit-section-title">已经拿到的数据</span>
                {dataPoints.length ? (
                  dataPoints.map((point) => (
                    <div key={point.id} className="audit-datapoint">
                      <span className="audit-datapoint__title">{point.title}</span>
                      <span className="audit-datapoint__facts">
                        {point.facts.map((fact) => (
                          <Chip key={fact.label} title={fact.hint}>
                            {fact.label} {fact.value}
                          </Chip>
                        ))}
                      </span>
                      <span className="audit-datapoint__headline">{point.headline}</span>
                    </div>
                  ))
                ) : (
                  <span className="audit-tool-row__desc">
                    还没有取数。Agent 每查完一步，关键数字会出现在这里。
                  </span>
                )}
              </div>

              <div className="audit-rail-block" style={{ marginTop: 12 }}>
                <span className="audit-section-title">可以接着问</span>
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
                    disabled={running || !!pending}
                    onClick={() => void ask(question)}
                  >
                    <PlayCircle size={12} /> {question}
                  </button>
                ))}
              </div>

              <div className="audit-rail-block" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="audit-rail-toggle"
                  onClick={() => setToolsOpen((value) => !value)}
                >
                  <span className="audit-section-title">白名单工具（{AUDIT_TOOL_LIST.length}）</span>
                  {toolsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                {toolsOpen ? (
                  <>
                    <span className="audit-tool-row__desc">
                      只有登记过的工具可以被调用，没有「执行任意 SQL」这类入口。
                    </span>
                    {AUDIT_TOOL_LIST.map((tool) => {
                      const count = callCounts.get(tool.id) ?? 0;
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
                            {count ? <Chip tone="audit-chip--accent">×{count}</Chip> : null}
                          </span>
                          <span className="audit-tool-row__desc">{tool.title}</span>
                        </button>
                      );
                    })}
                  </>
                ) : null}
              </div>

              <div className="audit-error audit-error--permission" style={{ marginTop: 12 }}>
                <AlertTriangle size={11} />
                <span>
                  Agent 只读业务数据并按规则找问题，不修改培训任务、人员、组织与成绩；飞书由 ADM
                  在发送前再校验接收人权限。
                </span>
              </div>
            </div>
            <div className="studio__composer">
              <div className="studio__composer-actions">
                <span className="studio__hint">
                  <ShieldCheck size={13} /> 结论都能追到规则编号与数据出处，处置需要人工确认。
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
