import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import {
  ACTION_LABELS,
  KIND_LABELS,
  LEVEL_LABELS,
  ROLE_LABELS,
  addDays,
  canActOnTask,
  canApproveException,
  canSeeTask,
  simulateTaskChange,
  taskAudienceIds,
} from "../../lib/inspectionEngine";
import type {
  DispositionAction,
  DispositionInput,
  InspectionActor,
  InspectionState,
  RiskConfirmation,
  TaskPatch,
} from "../../lib/inspectionTypes";
import { Chip } from "./shared";
import { SimulationResultView, TaskPatchEditor } from "./SimulatePanel";

const fieldClass =
  "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const labelClass = "text-[11px] font-medium text-muted-foreground";

const ACTION_ORDER: DispositionAction[] = [
  "adjust-task",
  "adjust-audience",
  "adjust-deadline",
  "reduce-frequency",
  "merge-duplicates",
  "pause-publish",
  "mark-exception",
  "handover",
];

export function DispositionDialog({
  open,
  onOpenChange,
  state,
  actor,
  taskId,
  riskKey,
  initialAction,
  initialPatch,
  onSubmit,
  onDecideException,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: InspectionState;
  actor: InspectionActor;
  taskId: string | null;
  riskKey?: string;
  initialAction?: DispositionAction;
  initialPatch?: TaskPatch;
  onSubmit: (input: DispositionInput) => string;
  onDecideException?: (exceptionId: string, approve: boolean, note: string) => string;
}) {
  const task = state.tasks.find((item) => item.id === taskId) ?? null;
  const [action, setAction] = useState<DispositionAction>(
    initialAction ?? "adjust-task",
  );
  const [patch, setPatch] = useState<TaskPatch>(initialPatch ?? {});
  const [reason, setReason] = useState("");
  const [expiresOn, setExpiresOn] = useState(addDays(state.policy.observationStartedOn, 14));
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [handover, setHandover] = useState<RiskConfirmation | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setAction(initialAction ?? "adjust-task");
    setPatch(initialPatch ?? {});
    setReason("");
    setError("");
    setSuccess("");
    setDecisionNote("");
    setDecisionMessage("");
    setMergeIds([]);
    setHandover(null);
  }, [open, initialAction, initialPatch, taskId]);

  if (!open || !task) return null;

  const risk = state.risks.find((record) => record.key === riskKey);
  const pendingException =
    state.exceptions.find(
      (item) =>
        item.status === "pending" &&
        (item.taskId === task.id || (!!riskKey && item.riskKey === riskKey)),
    ) ?? null;
  const canApprove = canApproveException(actor);
  const requestedByName = pendingException
    ? (state.people.find((person) => person.id === pendingException.requestedBy)?.name ??
      state.regions.find((region) => region.ownerId === pendingException.requestedBy)
        ?.ownerName ??
      pendingException.requestedBy)
    : "";
  const relatedDuplicates = state.tasks.filter(
    (item) =>
      item.id !== task.id &&
      item.resources.some((resource) =>
        task.resources.some((own) => own.id === resource.id),
      ),
  );
  const preview =
    action === "mark-exception"
      ? null
      : simulateTaskChange(state, task.id, patch, { weeks: [task.endsOn] });
  const canAct = canActOnTask(actor, task);
  const exceptionOnly = action === "mark-exception" || action === "handover";
  const blocked = actor.readOnly || (!canAct && !exceptionOnly) || (exceptionOnly && !canSeeTask(actor, task));

  const submit = () => {
    try {
      const message = onSubmit({
        action,
        taskId: task.id,
        reason,
        patch: exceptionOnly ? {} : patch,
        mergeTaskIds: action === "merge-duplicates" ? mergeIds : undefined,
        handoverTo: action === "handover" ? handover : null,
        expectedImpact: preview?.summary,
        exception:
          action === "mark-exception"
            ? {
                riskKey: riskKey ?? "",
                ruleId: risk?.ruleId ?? "",
                expiresOn,
              }
            : undefined,
      });
      setSuccess(message);
      setError("");
    } catch (submitError) {
      setError((submitError as Error).message);
      setSuccess("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inspection-modal max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={16} /> 处置 · {task.title}
          </DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px]">
            <Chip tone="bg-background text-foreground ring-border">
              版本 v{task.version}
            </Chip>
            <Chip tone="bg-background text-foreground ring-border">
              {task.audience.label}
            </Chip>
            <Chip tone="bg-background text-foreground ring-border">
              负责人：{task.owners.hqOwnerName || "未配置"} /{" "}
              {task.owners.regionOwnerName || "未配置"}
            </Chip>
            {risk ? (
              <Chip tone="bg-secondary text-secondary-foreground ring-primary/20">
                {KIND_LABELS[task.kind]} · {LEVEL_LABELS[risk.level]}
              </Chip>
            ) : null}
          </div>

          {canApprove && (pendingException || decisionMessage) ? (
            <div className="grid gap-2 rounded-lg bg-teal-50/60 p-3 ring-1 ring-teal-200">
              <div className="text-[11.5px] text-teal-900">
                待审批例外：
                {pendingException
                  ? `${pendingException.id} · 规则 ${pendingException.ruleId} · 到期 ${pendingException.expiresOn} · 提交人 ${requestedByName}`
                  : "已处理"}
              </div>
              {pendingException ? (
                <>
                  <input
                    className={`${fieldClass} w-full`}
                    placeholder="审批备注（可选）"
                    value={decisionNote}
                    onChange={(event) => setDecisionNote(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      onClick={() =>
                        setDecisionMessage(
                          onDecideException?.(pendingException.id, true, decisionNote) ||
                            "已批准，风险状态更新为例外生效。",
                        )
                      }
                    >
                      批准
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDecisionMessage(
                          onDecideException?.(pendingException.id, false, decisionNote) ||
                            "已驳回，风险保持待处理。",
                        )
                      }
                    >
                      驳回
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-[11.5px] text-teal-900">{decisionMessage}</div>
              )}
            </div>
          ) : null}

          <div>
            <div className={labelClass}>处置动作</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ACTION_ORDER.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setAction(item);
                    setError("");
                    setSuccess("");
                    if (item === "adjust-deadline")
                      setPatch((current) => ({
                        ...current,
                        endsOn: addDays(task.endsOn, 7),
                      }));
                    if (item === "reduce-frequency" && task.frequency)
                      setPatch((current) => ({
                        ...current,
                        frequency: {
                          unit: task.frequency!.unit,
                          count: Math.max(1, task.frequency!.count - 2),
                        },
                      }));
                    if (item === "pause-publish")
                      setPatch((current) => ({ ...current, status: "paused" }));
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium ring-1 ring-inset transition ${
                    action === item
                      ? "bg-primary/10 text-primary ring-primary/30"
                      : "bg-background text-muted-foreground ring-border hover:bg-muted"
                  }`}
                >
                  {ACTION_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          {!exceptionOnly ? (
            <TaskPatchEditor
              state={state}
              task={task}
              patch={patch}
              onChange={setPatch}
              actor={actor}
            />
          ) : null}

          {action === "merge-duplicates" ? (
            <div>
              <div className={labelClass}>选择要合并并暂停的重复任务</div>
              <div className="mt-1.5 grid gap-1.5">
                {relatedDuplicates.length ? (
                  relatedDuplicates.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11.5px]"
                    >
                      <input
                        type="checkbox"
                        checked={mergeIds.includes(item.id)}
                        onChange={(event) =>
                          setMergeIds((current) =>
                            event.target.checked
                              ? [...current, item.id]
                              : current.filter((id) => id !== item.id),
                          )
                        }
                      />
                      <span className="text-foreground">{item.title}</span>
                      <span className="text-muted-foreground">
                        {item.audience.label} · 命中{" "}
                        {taskAudienceIds(state, item)?.length ?? 0} 人
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    未找到同源内容的其他任务。
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {action === "handover" ? (
            <div>
              <div className={labelClass}>转交给</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {handoverOptions(state, task).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setHandover(option)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11.5px] ring-1 ring-inset transition ${
                      handover?.id === option.id
                        ? "bg-primary/10 text-primary ring-primary/30"
                        : "bg-background text-muted-foreground ring-border hover:bg-muted"
                    }`}
                  >
                    {option.name} · {option.roleLabel}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {action === "mark-exception" ? (
            <div className="grid gap-2 rounded-lg bg-teal-50/60 p-3 ring-1 ring-teal-200">
              <div className="text-[11.5px] text-teal-900">
                例外只对这一条风险生效，到期自动恢复。
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <div>
                  <div className={labelClass}>例外到期日</div>
                  <input
                    className={`${fieldClass} w-full`}
                    type="date"
                    value={expiresOn}
                    onChange={(event) => setExpiresOn(event.target.value)}
                  />
                </div>
                <div className="text-[11px] text-teal-900">
                  {actor.hq
                    ? "总部提交后立即生效，保留审批人。"
                    : "区域提交后进入待总部审批，批准后生效。"}
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <div className={labelClass}>
              调整原因（必填）
            </div>
            <textarea
              className="mt-1.5 min-h-[70px] w-full rounded-lg border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              placeholder="写清楚为什么调整"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          {preview ? <SimulationResultView result={preview} /> : null}

          {error ? (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800 ring-1 ring-emerald-200">
              {success}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">
              {blocked
                ? "没有处置权限，可转交负责人或标记例外。"
                : "提交后保留版本、原因与复查结果。"}
            </span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button size="sm" disabled={blocked} onClick={submit}>
                提交处置
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function handoverOptions(
  state: InspectionState,
  task: { audience: { regionIds: string[] }; owners: { regionOwnerId: string | null; regionOwnerName: string | null } },
): RiskConfirmation[] {
  const options: RiskConfirmation[] = [
    { id: "sarah", name: "Sarah Lee", roleLabel: "总部培训经理" },
  ];
  const regionId = task.audience.regionIds[0];
  const region = state.regions.find((item) => item.id === regionId);
  if (region)
    options.push({
      id: region.ownerId,
      name: region.ownerName,
      roleLabel: `${region.name}负责人`,
    });
  const trainer = state.people.find(
    (person) => person.regionId === regionId && person.role === "trainer",
  );
  if (trainer)
    options.push({
      id: trainer.id,
      name: trainer.name,
      roleLabel: `${ROLE_LABELS[trainer.role]}（门店级）`,
    });
  return options;
}
