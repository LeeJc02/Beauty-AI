import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import {
  FREQUENCY_LABELS,
  LEVEL_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  WEIGHT_LABELS,
  simulateTaskChange,
  taskAudienceIds,
  taskOccurrenceMinutes,
} from "../../lib/inspectionEngine";
import type {
  AudienceScope,
  InspectionActor,
  InspectionState,
  InspectionTask,
  PersonRole,
  SimulationResult,
  TaskPatch,
  TaskWeight,
} from "../../lib/inspectionTypes";
import { Chip, LevelBadge, formatDay } from "./shared";

const fieldClass =
  "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const labelClass = "text-[11px] font-medium text-muted-foreground";

export function resolveAudience(
  state: InspectionState,
  input: {
    scope?: AudienceScope;
    regionIds?: string[];
    roles?: PersonRole[] | null;
  },
) {
  const scope = input.scope ?? "nationwide";
  const regionIds = input.regionIds ?? [];
  const roles = input.roles ?? null;
  return state.people
    .filter((person) => person.active)
    .filter((person) =>
      scope === "nationwide" || !regionIds.length
        ? true
        : regionIds.includes(person.regionId),
    )
    .filter((person) => (roles && roles.length ? roles.includes(person.role) : true))
    .map((person) => person.id);
}

const allRoles: PersonRole[] = [
  "ba",
  "new_ba",
  "store_manager",
  "trainer",
  "regional_manager",
];

export function TaskPatchEditor({
  state,
  task,
  patch,
  onChange,
  actor,
}: {
  state: InspectionState;
  task: InspectionTask;
  patch: TaskPatch;
  onChange: (patch: TaskPatch) => void;
  actor: InspectionActor;
}) {
  const scope = patch.audience?.scope ?? task.audience.scope;
  const regionIds = patch.audience?.regionIds ?? task.audience.regionIds;
  const roles =
    patch.audience?.roles === undefined
      ? task.audience.roles
      : patch.audience.roles;
  const expectedCount =
    patch.audience?.expectedCount === undefined
      ? task.audience.expectedCount
      : patch.audience.expectedCount;
  const resolvedCount = (
    patch.audience?.resolvedPersonIds ?? task.audience.resolvedPersonIds ?? []
  ).length;
  const frequency = patch.frequency ?? task.frequency;
  const frequencyChanged = patch.frequency !== undefined;
  const visibleRegions = state.regions.filter(
    (region) => actor.hq || region.id === actor.regionId,
  );

  const updateAudience = (
    next: Partial<NonNullable<TaskPatch["audience"]>>,
  ) =>
    onChange({
      ...patch,
      audience: { ...patch.audience, ...next },
    });

  const toggleRegion = (regionId: string) => {
    const next = regionIds.includes(regionId)
      ? regionIds.filter((id) => id !== regionId)
      : [...regionIds, regionId];
    updateAudience({ regionIds: next });
  };

  const toggleRole = (role: PersonRole) => {
    const current = roles ?? allRoles;
    const next = current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role];
    updateAudience({ roles: next.length ? next : allRoles });
  };

  return (
    <div className="grid gap-3.5">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className={labelClass}>分发范围</span>
          <Chip tone="bg-muted text-muted-foreground ring-border">
            当前命中 {resolvedCount} 人
          </Chip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SCOPE_LABELS) as AudienceScope[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => updateAudience({ scope: item })}
              className={`rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition ${
                scope === item
                  ? "bg-primary/10 text-primary ring-primary/30"
                  : "bg-background text-muted-foreground ring-border hover:bg-muted"
              }`}
            >
              {SCOPE_LABELS[item]}
            </button>
          ))}
        </div>
        {scope !== "nationwide" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleRegions.map((region) => (
              <button
                key={region.id}
                type="button"
                onClick={() => toggleRegion(region.id)}
                className={`rounded-md px-2 py-1 text-[11px] ring-1 ring-inset transition ${
                  regionIds.includes(region.id)
                    ? "bg-secondary text-secondary-foreground ring-primary/30"
                    : "bg-background text-muted-foreground ring-border hover:bg-muted"
                }`}
              >
                {region.name}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allRoles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={`rounded-md px-2 py-1 text-[11px] ring-1 ring-inset transition ${
                (roles ?? allRoles).includes(role)
                  ? "bg-secondary text-secondary-foreground ring-primary/30"
                  : "bg-background text-muted-foreground ring-border hover:bg-muted"
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            className={`${fieldClass} max-w-[120px]`}
            type="number"
            min={0}
            value={expectedCount ?? ""}
            placeholder="预期人数"
            onChange={(event) =>
              updateAudience({
                expectedCount:
                  event.target.value === ""
                    ? null
                    : Number(event.target.value),
              })
            }
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateAudience({
                resolvedPersonIds: resolveAudience(state, {
                  scope,
                  regionIds,
                  roles,
                }),
              })
            }
          >
            按范围重算人员
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <div className={labelClass}>频次单位</div>
          <select
            className={`${fieldClass} w-full`}
            value={frequency?.unit ?? "once"}
            onChange={(event) =>
              onChange({
                ...patch,
                frequency: {
                  unit: event.target.value as "once" | "daily" | "weekly",
                  count: frequency?.count ?? 1,
                },
              })
            }
          >
            {(Object.keys(FREQUENCY_LABELS) as ("once" | "daily" | "weekly")[]).map(
              (unit) => (
                <option key={unit} value={unit}>
                  {FREQUENCY_LABELS[unit]}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <div className={labelClass}>次数</div>
          <input
            className={`${fieldClass} w-full`}
            type="number"
            min={1}
            max={100}
            value={frequency?.count ?? 1}
            onChange={(event) =>
              onChange({
                ...patch,
                frequency: {
                  unit: frequency?.unit ?? "once",
                  count: Number(event.target.value) || 1,
                },
              })
            }
          />
        </div>
        <div>
          <div className={labelClass}>开始时间</div>
          <input
            className={`${fieldClass} w-full`}
            type="date"
            value={patch.startsOn ?? task.startsOn}
            onChange={(event) =>
              onChange({ ...patch, startsOn: event.target.value })
            }
          />
        </div>
        <div>
          <div className={labelClass}>截止时间</div>
          <input
            className={`${fieldClass} w-full`}
            type="date"
            value={patch.endsOn ?? task.endsOn}
            onChange={(event) => onChange({ ...patch, endsOn: event.target.value })}
          />
        </div>
        <div>
          <div className={labelClass}>单次预计时长（分钟）</div>
          <input
            className={`${fieldClass} w-full`}
            type="number"
            min={1}
            max={1440}
            value={
              patch.minutes === undefined
                ? (taskOccurrenceMinutes(task) ?? "")
                : (patch.minutes ?? "")
            }
            onChange={(event) =>
              onChange({
                ...patch,
                minutes:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
        </div>
        <div>
          <div className={labelClass}>任务权重</div>
          <select
            className={`${fieldClass} w-full`}
            value={patch.weight ?? task.weight ?? "optional"}
            onChange={(event) =>
              onChange({ ...patch, weight: event.target.value as TaskWeight })
            }
          >
            {(Object.keys(WEIGHT_LABELS) as TaskWeight[]).map((weight) => (
              <option key={weight} value={weight}>
                {WEIGHT_LABELS[weight]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelClass}>任务状态</div>
          <select
            className={`${fieldClass} w-full`}
            value={patch.status ?? task.status}
            onChange={(event) =>
              onChange({
                ...patch,
                status: event.target.value as InspectionTask["status"],
              })
            }
          >
            <option value="active">执行中</option>
            <option value="draft">草稿（待发布）</option>
            <option value="paused">已暂停</option>
          </select>
        </div>
        <div>
          <div className={labelClass}>到期提醒</div>
          <select
            className={`${fieldClass} w-full`}
            value={
              patch.reminder === undefined
                ? task.reminder?.enabled
                  ? "on"
                  : "off"
                : patch.reminder?.enabled
                  ? "on"
                  : "off"
            }
            onChange={(event) =>
              onChange({
                ...patch,
                reminder:
                  event.target.value === "on"
                    ? {
                        enabled: true,
                        daysBefore: task.reminder?.daysBefore ?? 1,
                        channels: task.reminder?.channels ?? ["站内消息"],
                      }
                    : null,
              })
            }
          >
            <option value="on">启用（提前 1 天）</option>
            <option value="off">未启用</option>
          </select>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        只做推演，不改任务；确认后才写入处置记录
        {frequencyChanged ? "（已调整频次）" : ""}。
      </p>
    </div>
  );
}

export function SimulationResultView({ result }: { result: SimulationResult }) {
  return (
    <div className="grid gap-3">
      <div className="rounded-xl bg-secondary/60 p-3 ring-1 ring-primary/15">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
          <Sparkles size={13} /> 模拟结果
        </div>
        <div className="mt-1.5 text-sm font-medium text-foreground">
          {result.summary}
        </div>
        <ul className="mt-1.5 grid gap-0.5 text-[11px] text-muted-foreground">
          {result.reasons.map((reason) => (
            <li key={reason}>· {reason}</li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: "受影响人数", before: result.peopleBefore, after: result.peopleAfter, unit: "人" },
          { label: "人均分钟", before: result.meanBefore, after: result.meanAfter, unit: "分钟" },
          { label: "最高单人", before: result.maxBefore, after: result.maxAfter, unit: "分钟" },
          { label: "单日峰值", before: result.peakBefore, after: result.peakAfter, unit: "分钟" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg bg-card p-2.5 ring-1 ring-foreground/10"
          >
            <div className="text-[11px] text-muted-foreground">{item.label}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
              <span className="text-muted-foreground">{item.before}</span>
              <ArrowRight size={12} className="text-muted-foreground" />
              <span
                className={
                  item.after < item.before
                    ? "text-emerald-600"
                    : item.after > item.before
                      ? "text-rose-600"
                      : "text-foreground"
                }
              >
                {item.after}
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {item.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <table className="w-full text-[11px]">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-2.5 py-1.5 text-left font-medium">区域</th>
              <th className="px-2.5 py-1.5 text-right font-medium">命中人数</th>
              <th className="px-2.5 py-1.5 text-right font-medium">人均分钟</th>
              <th className="px-2.5 py-1.5 text-right font-medium">超容量人数</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.regionId} className="border-t border-border/60">
                <td className="px-2.5 py-1.5">{row.name}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">
                  {row.peopleBefore} → {row.peopleAfter}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">
                  {row.meanBefore} → {row.meanAfter}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">
                  {row.overBefore} → {row.overAfter}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded-lg bg-emerald-50/70 p-2.5 ring-1 ring-emerald-200">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={12} /> 解除 {result.resolved.length}
          </div>
          <ul className="mt-1 grid gap-0.5 text-[11px] text-emerald-900/80">
            {result.resolved.length ? (
              result.resolved.map((risk) => (
                <li key={risk.key}>
                  {risk.ruleId} · {risk.title}
                </li>
              ))
            ) : (
              <li>无</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg bg-amber-50/70 p-2.5 ring-1 ring-amber-200">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle size={12} /> 仍命中 {result.levelChanged.length}
          </div>
          <ul className="mt-1 grid gap-0.5 text-[11px] text-amber-900/80">
            {result.levelChanged.length ? (
              result.levelChanged.map((change) => (
                <li key={change.key}>
                  {change.title}：{LEVEL_LABELS[change.from]} →{" "}
                  {LEVEL_LABELS[change.to]}
                </li>
              ))
            ) : (
              <li>无</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg bg-rose-50/70 p-2.5 ring-1 ring-rose-200">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-700">
            <AlertTriangle size={12} /> 新增 {result.added.length}
          </div>
          <ul className="mt-1 grid gap-0.5 text-[11px] text-rose-900/80">
            {result.added.length ? (
              result.added.map((risk) => (
                <li key={risk.key}>
                  <LevelBadge level={risk.level} /> {risk.ruleId} · {risk.title}
                </li>
              ))
            ) : (
              <li>无</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SimulationDialog({
  open,
  onOpenChange,
  state,
  actor,
  task,
  week,
  today,
  initialPatch,
  onOpenDisposition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: InspectionState;
  actor: InspectionActor;
  task: InspectionTask;
  week: string;
  today: string;
  initialPatch?: TaskPatch;
  onOpenDisposition: (patch: TaskPatch, summary: string) => void;
}) {
  const [patch, setPatch] = useState<TaskPatch>(initialPatch ?? {});
  const result = useMemo(
    () =>
      simulateTaskChange(state, task.id, patch, {
        weeks: [week],
        today,
      }),
    [state, task.id, patch, week, today],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inspection-modal max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} /> 发布前模拟 · {task.title}
          </DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
          <TaskPatchEditor
            state={state}
            task={task}
            patch={patch}
            onChange={setPatch}
            actor={actor}
          />
          <SimulationResultView result={result} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">
              {taskAudienceIds(state, task)?.length ?? 0} 人 · 截止{" "}
              {formatDay(task.endsOn)} · 当前版本 v{task.version}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPatch({})}>
                重置
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onOpenDisposition(patch, result.summary);
                }}
              >
                进入处置并填写原因
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
