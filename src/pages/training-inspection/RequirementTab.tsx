import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { addDays, inspectionDay } from "../../lib/inspectionEngine";
import {
  ASPECT_LABELS,
  aspectLabelOf,
  aspectOfRule,
  describeRequirement,
  requirementIssueLabel,
  requirementIssues,
  requirementStatusOf,
  runRequirement,
  STATUS_LABELS,
  type InspectionRequirement,
  type RequirementAspect,
  type RequirementRun,
  type RequirementStatus,
} from "../../lib/inspectionRequirements";
import { deleteRequirement, updateRequirement } from "../../lib/requirementStore";
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
} from "../../lib/inspectionTypes";
import { Chip, EmptyState, Metric, SectionHeading } from "./shared";

const ASPECT_TONE: Record<RequirementAspect, string> = {
  duplicate: "bg-amber-50 text-amber-700 ring-amber-200",
  crowding: "bg-sky-50 text-sky-700 ring-sky-200",
  workload: "bg-rose-50 text-rose-700 ring-rose-200",
  category: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "data-gap": "bg-violet-50 text-violet-700 ring-violet-200",
};

const STATUS_TONE: Record<RequirementStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  paused: "bg-amber-50 text-amber-700 ring-amber-200",
  finished: "bg-slate-100 text-slate-600 ring-slate-200",
};

const dayLabel = (day: string) => day.slice(5).replace("-", "/");

/** 存档里是 UTC 时间，展示统一换成印尼时间（业务口径）。 */
const stamp = (iso: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Jakarta",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

/** 自定义巡检需求：状态摘要 + 现在关注的问题 + 运行记录。 */
export function RequirementTab({
  state,
  actor,
  requirement,
  week,
  today = inspectionDay(),
  onFocusTask,
  onOpenTask,
  onDeleted,
}: {
  state: InspectionState;
  actor: InspectionActor;
  requirement: InspectionRequirement;
  week: string;
  today?: string;
  onFocusTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  onDeleted: () => void;
  key?: React.Key;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const status = requirementStatusOf(requirement);
  const issues = useMemo(
    () => requirementIssues(state, requirement, actor, week, today),
    [state, requirement, actor, week, today],
  );
  const latest = requirement.runs.at(-1) ?? null;
  const weekLabel = `${dayLabel(week)} – ${dayLabel(addDays(week, 6))}`;
  const canResume = !requirement.endsOn || requirement.endsOn >= today;

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const runNow = () => {
    setBusy(true);
    window.setTimeout(() => {
      const next = runRequirement(state, requirement, new Date(), "manual", week);
      updateRequirement(next);
      setBusy(false);
      const run = next.runs.at(-1)!;
      setMessage(
        run.repeatCount > 1
          ? `巡检完成：扫了 ${run.taskCount} 项任务，结论和上次一样。`
          : `巡检完成：扫了 ${run.taskCount} 项任务，看到 ${run.issueCount} 项问题。`,
      );
    }, 320);
  };

  const toggleStatus = () => {
    const next = status === "paused" && canResume ? "active" : "paused";
    updateRequirement({ ...requirement, status: next });
    setMessage(
      next === "active"
        ? "已继续，到下次周期时间自动运行。"
        : "已暂停，不再自动运行，记录都保留着。",
    );
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          统计周期 {weekLabel} · {describeRequirement(state, requirement)}
          {requirement.nextRunAt && status === "active"
            ? ` · 下次运行 ${stamp(requirement.nextRunAt)}`
            : ""}
        </span>
        <span>口径：任务「预计时长 × 本周次数」，缺预计时长的人不计入</span>
      </div>

      <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {requirement.name}
              </h3>
              <Chip tone={STATUS_TONE[status]}>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === "active"
                      ? "bg-emerald-500"
                      : status === "paused"
                        ? "bg-amber-500"
                        : "bg-slate-400"
                  }`}
                />
                {STATUS_LABELS[status]}
              </Chip>
              <Chip tone="bg-secondary text-secondary-foreground ring-primary/20">
                Agent 创建
              </Chip>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              关注：{aspectLabelOf(requirement.aspects, requirement.categories)} · 创建于{" "}
              {stamp(requirement.createdAt)} · 创建人 {requirement.createdBy}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={runNow} disabled={busy}>
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              {busy ? "巡检中" : "立即巡检"}
            </Button>
            {status === "active" ? (
              <Button variant="outline" size="sm" onClick={toggleStatus}>
                <Pause size={13} /> 暂停
              </Button>
            ) : null}
            {status === "paused" && canResume ? (
              <Button variant="outline" size="sm" onClick={toggleStatus}>
                <Play size={13} /> 继续
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 size={13} /> 删除
            </Button>
          </div>
        </div>
        {message ? (
          <div className="mt-2 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] text-secondary-foreground">
            {message}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="发现的问题"
          value={issues.length}
          unit="项"
          hint={`只看${aspectLabelOf(requirement.aspects, requirement.categories)} · 已解决的自动去掉`}
          tone={issues.length ? "text-rose-600" : "text-emerald-700"}
        />
        <Metric
          label="受影响的 BA"
          value={latest ? latest.peopleCount : "—"}
          unit={latest ? "人" : undefined}
          hint={
            latest
              ? latest.unknownPeople
                ? `另有 ${latest.unknownPeople} 人缺预计时长，不计入`
                : "按问题命中的人去重"
              : "还没跑过，点「立即巡检」看看"
          }
        />
        <Metric
          label="人均分钟"
          value={latest ? latest.meanMinutes : "—"}
          unit={latest ? "分钟" : undefined}
          hint="关注任务里，这些 BA 本周人均要花的计划时间"
        />
        <Metric
          label="最近一次运行"
          value={latest ? stamp(latest.lastSeenAt) : "—"}
          hint={
            latest
              ? `${
                  latest.repeatCount > 1
                    ? `结论没变 · 连续 ${latest.repeatCount} 次`
                    : latest.added.length
                      ? `新增 ${latest.added.length} 项 · 已解决 ${latest.resolved.length} 项`
                      : "首次运行"
                } · 扫了 ${latest.taskCount} 项任务`
              : "到点会自动运行，也可以手动跑"
          }
        />
      </div>

      <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <SectionHeading
          title="现在关注到的问题"
          hint="只讲这些任务对人的影响；点「看任务」跳到区域负担定位"
          extra={
            <Chip tone="bg-muted text-muted-foreground ring-border">
              {issues.length} 项
            </Chip>
          }
        />
        <div className="mt-3 grid gap-1.5">
          {issues.length ? (
            issues.map((risk) => (
              <IssueRow
                key={risk.key}
                state={state}
                risk={risk}
                onFocusTask={onFocusTask}
                onOpenTask={onOpenTask}
              />
            ))
          ) : (
            <EmptyState
              title="这个巡检目前没有问题"
              hint={`${aspectLabelOf(requirement.aspects, requirement.categories)}这一类，当前周期都没命中。`}
            />
          )}
        </div>
      </div>

      <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <SectionHeading
          title="运行记录"
          hint="每次只记扫了多少任务、看到几项问题；结论没变就合并成一条"
          extra={
            <Chip tone="bg-muted text-muted-foreground ring-border">
              {requirement.runs.length} 个批次
            </Chip>
          }
        />
        <div className="mt-3 grid max-h-[460px] gap-1.5 overflow-y-auto pr-0.5">
          {requirement.runs.length ? (
            [...requirement.runs].reverse().map((run) => (
              <RunRow key={run.id} run={run} />
            ))
          ) : (
            <EmptyState
              title="还没有运行记录"
              hint="到下次周期时间会自动跑，也可以现在点「立即巡检」。"
            />
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="inspection-modal max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} /> 关掉这个巡检？
            </DialogTitle>
          </DialogHeader>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            关闭后「{requirement.name}」的标签页会消失，运行记录一起删掉。
            如果只是想让它先别跑，点「暂停」更合适。
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              先留着
            </Button>
            <Button
              size="sm"
              onClick={() => {
                deleteRequirement(requirement.id);
                setConfirmOpen(false);
                onDeleted();
              }}
            >
              删除这个巡检
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------ 问题行 */

function IssueRow({
  state,
  risk,
  onFocusTask,
  onOpenTask,
}: {
  state: InspectionState;
  risk: InspectionRisk;
  onFocusTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  key?: React.Key;
}) {
  const aspect = aspectOfRule(risk.ruleId);
  const taskId = risk.taskIds[0] ?? null;
  const titles = risk.taskIds
    .map((id) => state.tasks.find((task) => task.id === id)?.title)
    .filter(Boolean)
    .slice(0, 3)
    .join("、");
  const source = taskId
    ? state.tasks.find((task) => task.id === taskId)?.origin === "source"
    : false;
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
      <span className="grid gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {aspect ? (
            <Chip tone={ASPECT_TONE[aspect]}>{ASPECT_LABELS[aspect]}</Chip>
          ) : null}
          <span className="text-[12.5px] font-medium text-foreground">
            {requirementIssueLabel(state, risk)}
          </span>
        </span>
        <span className="text-[10.5px] text-muted-foreground">
          {titles ? `任务：${titles}` : "覆盖这类问题的全部任务"}
        </span>
      </span>
      <span className="flex items-center gap-2">
        {taskId ? (
          <button
            type="button"
            className="inspection-link"
            onClick={() => onFocusTask(taskId)}
          >
            看任务
          </button>
        ) : null}
        {source && taskId ? (
          <button
            type="button"
            className="inspection-link"
            onClick={() => onOpenTask(taskId)}
          >
            原任务
          </button>
        ) : null}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ 运行记录行 */

function RunRow({ run }: { run: RequirementRun; key?: React.Key }) {
  const [open, setOpen] = useState(false);
  const changes = [
    run.added.length ? `新增 ${run.added.length} 项` : "",
    run.resolved.length ? `已解决 ${run.resolved.length} 项` : "",
  ].filter(Boolean);
  return (
    <div className="rounded-lg bg-muted/40">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="grid flex-1 gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
            <span className="font-medium text-foreground">
              {stamp(run.lastSeenAt)}
            </span>
            <Chip
              tone={
                run.trigger === "manual"
                  ? "bg-secondary text-secondary-foreground ring-primary/20"
                  : "bg-muted text-muted-foreground ring-border"
              }
            >
              <Clock size={10} />
              {run.trigger === "manual" ? "手动巡检" : "自动巡检"}
            </Chip>
            <span className="text-muted-foreground">
              扫了 {run.taskCount} 项任务 · 看到 {run.issueCount} 项问题 · 影响{" "}
              {run.peopleCount} 人
            </span>
          </span>
          <span className="text-[10.5px] text-muted-foreground">
            {run.repeatCount > 1
              ? `结论没变，连续巡检 ${run.repeatCount} 次（首次 ${stamp(run.at)}）`
              : changes.length
                ? `${changes.join(" · ")}；结论有变化`
                : "首次运行"}
          </span>
        </span>
      </button>
      {open ? (
        <div className="grid gap-1.5 border-t border-border/70 px-2.5 py-2 text-[11px]">
          <span className="text-muted-foreground">
            这次统计的是 {dayLabel(run.week)} 那一周 · 人均 {run.meanMinutes} 分钟
            {run.unknownPeople ? ` · 另有 ${run.unknownPeople} 人缺预计时长` : ""}
          </span>
          {run.taskLines.length ? (
            <ul className="grid gap-1">
              {run.taskLines.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {run.added.length ? (
            <span className="text-emerald-700">
              新增：{run.added.map((item) => item.label).join("；")}
            </span>
          ) : null}
          {run.resolved.length ? (
            <span className="text-muted-foreground">
              已解决：{run.resolved.map((item) => item.label).join("；")}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
