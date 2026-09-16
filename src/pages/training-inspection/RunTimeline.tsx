import React, { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import type {
  InspectionActor,
  InspectionRunTaskResult,
  InspectionRunRecord,
  InspectionState,
  RiskLevel,
} from "../../lib/inspectionTypes";
import { LEVEL_LABELS } from "../../lib/inspectionEngine";
import { Chip, EmptyState, KindBadge, LevelBadge, SectionHeading } from "./shared";

const LEVEL_ORDER: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
  insufficient: 3,
};

const stamp = (iso: string) => iso.slice(5, 16).replace("T", " ");

/** 审计批次：只回答「这次有没有异常、异常任务是什么」，明细放进弹窗。 */
export function RunTimeline({
  state,
  actor,
  onFocusTask,
  onOpenTask,
}: {
  state: InspectionState;
  actor: InspectionActor;
  onFocusTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const runs = state.inspectionRuns;
  return (
    <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <SectionHeading
        title="审计工作记录"
        hint="每条只记有没有异常、异常的是哪些任务；结论没变就合并，只更新时间"
        extra={
          <Chip tone="bg-secondary text-secondary-foreground ring-primary/20">
            {runs.length} 个批次
          </Chip>
        }
      />
      <div className="mt-3 grid gap-2">
        {runs.length ? (
          [...runs]
            .reverse()
            .map((record) => (
              <RunRow
                key={record.id}
                record={record}
                state={state}
                actor={actor}
                onFocusTask={onFocusTask}
                onOpenTask={onOpenTask}
              />
            ))
        ) : (
          <EmptyState title="还没有审计记录" hint="点右上角「立即审计」开始。" />
        )}
      </div>
    </div>
  );
}

function RunRow({
  record,
  state,
  actor,
  onFocusTask,
  onOpenTask,
}: {
  record: InspectionRunRecord;
  state: InspectionState;
  actor: InspectionActor;
  onFocusTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  key?: React.Key;
}) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 当前账号能看到的任务：停用 / 已合并的不再出现，区域账号只看本区域
  const results = record.taskResults.filter((result) => {
    const task = state.tasks.find((item) => item.id === result.taskId);
    if (!task || task.status === "disabled" || task.mergedIntoId) return false;
    if (actor.hq) return true;
    const regionId = actor.regionId ?? "";
    return task.audience.regionIds.length
      ? task.audience.regionIds.includes(regionId)
      : true;
  });
  // 真正的异常：命中风险规则（高 / 中 / 低）。「数据不足」只代表字段缺失、无法判定，单独归类。
  const byName = (a: InspectionRunTaskResult, b: InspectionRunTaskResult) =>
    taskTitle(state, a.taskId).localeCompare(taskTitle(state, b.taskId), "zh");
  const anomalies = results
    .filter((result) => result.level && result.level !== "insufficient")
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.level as RiskLevel] - LEVEL_ORDER[b.level as RiskLevel] ||
        byName(a, b),
    );
  const unknown = results
    .filter((result) => result.level === "insufficient")
    .sort(byName);

  const ruleNames = new Map<string, string>();
  for (const risk of state.risks) ruleNames.set(risk.ruleId, risk.ruleName);
  for (const change of [...record.added, ...record.resolved])
    ruleNames.set(change.ruleId, change.ruleName);

  const affectedPeople = (result: InspectionRunTaskResult) => {
    const ids = new Set<string>();
    for (const risk of state.risks)
      if (result.ruleIds.includes(risk.ruleId) && risk.taskIds.includes(result.taskId))
        risk.personIds.forEach((id) => ids.add(id));
    return ids.size;
  };

  const changes = [
    ...record.added.map((change) => ({
      key: `+${change.key}`,
      tone: "bg-rose-50 text-rose-700 ring-rose-200",
      text: `新增异常 ${change.ruleName} · ${change.title}`,
    })),
    ...record.resolved.map((change) => ({
      key: `-${change.key}`,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      text: `异常解除 ${change.ruleName} · ${change.title}`,
    })),
    ...record.levelChanged.map((change) => ({
      key: `~${change.key}-${change.to}`,
      tone: "bg-amber-50 text-amber-700 ring-amber-200",
      text: `等级变化：${LEVEL_LABELS[change.from]} → ${LEVEL_LABELS[change.to]} · ${change.title}`,
    })),
  ];

  const preview = anomalies.slice(0, 3).map((result) => taskTitle(state, result.taskId));

  return (
    <div className="rounded-xl bg-background ring-1 ring-foreground/10">
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="mt-0.5 text-muted-foreground">
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
          <span className="grid flex-1 gap-1.5">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground">
                {stamp(record.at)}
              </span>
              <Chip
                tone={
                  record.trigger === "manual"
                    ? "bg-primary/10 text-primary ring-primary/25"
                    : "bg-muted text-muted-foreground ring-border"
                }
              >
                {record.trigger === "manual" ? "手动审计" : "自动审计"}
              </Chip>
              <Chip tone="bg-muted text-muted-foreground ring-border">
                覆盖 {results.length} 项任务
              </Chip>
              {anomalies.length ? (
                <Chip tone="bg-rose-50 text-rose-700 ring-rose-200" className="font-semibold">
                  <AlertTriangle size={11} /> {anomalies.length} 项任务异常
                </Chip>
              ) : (
                <Chip tone="bg-emerald-50 text-emerald-700 ring-emerald-200" className="font-semibold">
                  <ShieldCheck size={11} /> 本次无异常
                </Chip>
              )}
              {record.repeatCount > 1 ? (
                <Chip tone="bg-muted text-muted-foreground ring-border">
                  结论没变 · 连续 {record.repeatCount} 次
                </Chip>
              ) : null}
              {changes.length ? (
                <span className="text-[10.5px] text-muted-foreground">
                  较上次 {changes.length} 处变化
                </span>
              ) : null}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {anomalies.length
                ? `异常任务：${preview.join("、")}${
                    anomalies.length > preview.length ? ` 等 ${anomalies.length} 项` : ""
                  }`
                : "本次审计未发现异常任务。"}
            </span>
          </span>
        </button>
        {anomalies.length ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setDialogOpen(true)}
          >
            <AlertTriangle size={13} /> 查看异常任务
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="grid gap-3 border-t border-border/70 px-3.5 py-3 text-[11.5px]">
          <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <span className="inline-flex items-center gap-1">
              <UserCheck size={12} /> {record.actorName}（{record.roleLabel}）
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCw size={12} /> 最近 {stamp(record.lastSeenAt)} · 共{" "}
              {record.repeatCount} 次
            </span>
            <span className="inline-flex items-center gap-1">
              <ClipboardList size={12} /> 周期：
              {record.weeks.length > 1
                ? `本周 ${record.weeks[0].slice(5)} · 下周 ${record.weeks[1].slice(5)}`
                : record.weeks[0]?.slice(5)}
            </span>
          </div>

          {changes.length ? (
            <div className="grid gap-1.5">
              <div className="text-[11.5px] font-semibold text-foreground">
                较上次的变化
              </div>
              {changes.map((change) => (
                <div key={change.key} className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={change.tone}>{change.text}</Chip>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              较上次没有新增、解除或等级变化。
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>异常任务（{anomalies.length} 项）</DialogTitle>
            <p className="text-[11.5px] text-muted-foreground">
              批次 {stamp(record.at)} · 覆盖 {results.length} 项任务 · 点任务名进入任务体检
            </p>
          </DialogHeader>
          <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-0.5">
            {anomalies.map((result) => {
              const task = state.tasks.find((item) => item.id === result.taskId);
              if (!task) return null;
              const people = affectedPeople(result);
              return (
                <div
                  key={result.taskId}
                  className="grid gap-1.5 rounded-lg bg-muted/40 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <KindBadge kind={task.kind} />
                    <span className="text-[12.5px] font-medium text-foreground">
                      {task.title}
                    </span>
                    {result.level ? <LevelBadge level={result.level} /> : null}
                    {people ? (
                      <span className="text-[11px] text-muted-foreground">
                        影响 {people} 人
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    命中规则：
                    {result.ruleIds.length ? (
                      result.ruleIds.map((ruleId) => (
                        <Chip
                          key={ruleId}
                          tone="bg-background text-muted-foreground ring-border"
                        >
                          <span className="font-mono font-semibold">{ruleId}</span>
                          {ruleNames.get(ruleId) ?? ""}
                        </Chip>
                      ))
                    ) : (
                      <span>规则已不再命中</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="inspection-link"
                      onClick={() => {
                        setDialogOpen(false);
                        onFocusTask(task.id);
                      }}
                    >
                      任务体检
                    </button>
                    {task.origin === "source" ? (
                      <button
                        type="button"
                        className="inspection-link"
                        onClick={() => {
                          setDialogOpen(false);
                          onOpenTask(task.id);
                        }}
                      >
                        原任务
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {unknown.length ? (
              <div className="grid gap-1.5 rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="text-[11.5px] font-semibold text-muted-foreground">
                  数据不足，本次无法判定（{unknown.length} 项）
                </div>
                {unknown.map((result) => {
                  const task = state.tasks.find((item) => item.id === result.taskId);
                  if (!task) return null;
                  return (
                    <div
                      key={result.taskId}
                      className="flex flex-wrap items-center gap-1.5 text-[11.5px]"
                    >
                      <KindBadge kind={task.kind} />
                      <span className="text-muted-foreground">{task.title}</span>
                      <button
                        type="button"
                        className="inspection-link"
                        onClick={() => {
                          setDialogOpen(false);
                          onFocusTask(task.id);
                        }}
                      >
                        任务体检
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function taskTitle(state: InspectionState, taskId: string) {
  return state.tasks.find((task) => task.id === taskId)?.title ?? taskId;
}
