import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitBranch,
  Info,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  KIND_LABELS,
  RESOURCE_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  WEIGHT_LABELS,
  addDays,
  canActOnTask,
  canSeeTask,
  daysBetween,
  missingFields,
  regionAggregates,
  simulateTaskChange,
  taskAudienceIds,
  taskOccurrenceMinutes,
} from "../../lib/inspectionEngine";
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  RiskLevel,
  TaskKind,
  TaskPatch,
} from "../../lib/inspectionTypes";
import {
  Bar,
  Chip,
  EmptyState,
  KindBadge,
  LevelBadge,
  SectionHeading,
  WeightBadge,
  formatDay,
  riskStatusOf,
  weekdayOf,
} from "./shared";
import { RiskCard } from "./RiskCard";
import { SimulationResultView, TaskPatchEditor } from "./SimulatePanel";

const levelRank: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
  insufficient: 3,
};
const fieldClass =
  "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-medium text-foreground">{value}</span>
    </div>
  );
}

export function CheckupTab({
  state,
  actor,
  week,
  today,
  risks,
  selectedTaskId,
  onSelectTask,
  onDispose,
  onOpenTask,
}: {
  state: InspectionState;
  actor: InspectionActor;
  week: string;
  today: string;
  risks: InspectionRisk[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onDispose: (
    taskId: string,
    riskKey?: string,
    patch?: TaskPatch,
    action?: string,
  ) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<TaskKind | "all">("all");
  const [patch, setPatch] = useState<TaskPatch>({});

  const visibleTasks = useMemo(
    () =>
      state.tasks
        .filter((task) => canSeeTask(actor, task))
        .filter((task) => kind === "all" || task.kind === kind)
        .filter((task) =>
          `${task.title} ${task.audience.label} ${task.owners.hqOwnerName} ${task.owners.regionOwnerName}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
    [state.tasks, actor, kind, search],
  );

  const levelOfTask = (taskId: string) =>
    risks
      .filter((risk) => risk.taskIds.includes(taskId))
      .reduce<RiskLevel | null>(
        (worstLevel, risk) =>
          !worstLevel || levelRank[risk.level] < levelRank[worstLevel]
            ? risk.level
            : worstLevel,
        null,
      );
  const sortedTasks = useMemo(
    () =>
      [...visibleTasks].sort((a, b) => {
        const aLevel = levelOfTask(a.id);
        const bLevel = levelOfTask(b.id);
        const aRank = aLevel ? levelRank[aLevel] : 9;
        const bRank = bLevel ? levelRank[bLevel] : 9;
        return aRank - bRank || a.title.localeCompare(b.title);
      }),
    [visibleTasks, risks],
  );
  const selected =
    sortedTasks.find((task) => task.id === selectedTaskId) ?? sortedTasks[0];

  useEffect(() => {
    setPatch({});
  }, [selected?.id]);

  if (!selected)
    return <EmptyState title="没有可查看的任务" hint="换个筛选条件。" />;

  const taskRisks = risks
    .filter((risk) => risk.taskIds.includes(selected.id))
    .sort((a, b) => levelRank[a.level] - levelRank[b.level]);
  const worst = taskRisks[0];
  const audienceIds = taskAudienceIds(state, selected);
  const regionIds = selected.audience.regionIds.length
    ? selected.audience.regionIds
    : state.regions.map((region) => region.id);
  const aggregates = regionAggregates(state, week, today, regionIds);
  const people = aggregates.flatMap((region) => region.people);
  const assigned = audienceIds
    ? people.filter((person) => audienceIds.includes(person.personId))
    : people;
  const peakPerson = [...assigned].sort(
    (a, b) => b.dailyPeak - a.dailyPeak,
  )[0];
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const dayTotals = weekDays.map((day) =>
    assigned.reduce(
      (sum, person) =>
        sum +
        person.items
          .filter((item) => item.day === day)
          .reduce((total, item) => total + item.minutes, 0),
      0,
    ),
  );
  const maxDayTotal = Math.max(1, ...dayTotals);
  const distribution = selected.audience.regionIds.length
    ? state.regions.filter((region) => selected.audience.regionIds.includes(region.id))
    : state.regions;
  const roleCounts = new Map<string, number>();
  for (const personId of audienceIds ?? []) {
    const person = state.people.find((item) => item.id === personId);
    if (!person) continue;
    roleCounts.set(
      ROLE_LABELS[person.role],
      (roleCounts.get(ROLE_LABELS[person.role]) ?? 0) + 1,
    );
  }
  const related = state.tasks.filter(
    (task) =>
      task.id !== selected.id &&
      (selected.relations.sameSourceTaskIds.includes(task.id) ||
        selected.relations.prerequisiteTaskIds.includes(task.id) ||
        selected.relations.exclusiveTaskIds.includes(task.id) ||
        selected.relations.duplicateTaskIds.includes(task.id) ||
        task.resources.some((resource) =>
          selected.resources.some((item) => item.id === resource.id),
        )),
  );
  const sameDayTasks =
    peakPerson?.peakDay
      ? [
          ...new Set(
            (peakPerson.items ?? [])
              .filter((item) => item.day === peakPerson.peakDay)
              .map((item) => item.taskId),
          ),
        ]
      : [];
  const simulation = simulateTaskChange(state, selected.id, patch, {
    weeks: [week],
    today,
  });
  const gaps = missingFields(selected);
  const canAct = canActOnTask(actor, selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <SectionHeading
          title="任务清单"
          hint={`${visibleTasks.length} 项 · 按问题排序`}
        />
        <div className="mt-2.5 grid gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute top-2.5 left-2 text-muted-foreground"
            />
            <input
              className={`${fieldClass} w-full pl-6`}
              placeholder="搜索任务"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setKind("all")}
              className={`rounded-md px-2 py-1 text-[11px] ring-1 ring-inset ${kind === "all" ? "bg-primary/10 text-primary ring-primary/30" : "text-muted-foreground ring-border"}`}
            >
              全部
            </button>
            {(Object.keys(KIND_LABELS) as TaskKind[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                className={`rounded-md px-2 py-1 text-[11px] ring-1 ring-inset ${kind === item ? "bg-primary/10 text-primary ring-primary/30" : "text-muted-foreground ring-border"}`}
              >
                {KIND_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid max-h-[620px] gap-1.5 overflow-y-auto pr-0.5">
          {sortedTasks.map((task) => {
            const taskLevel = levelOfTask(task.id);
            const count = risks.filter((risk) =>
              risk.taskIds.includes(task.id),
            ).length;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask(task.id)}
                className={`grid gap-1 rounded-lg px-2.5 py-2 text-left ring-1 ring-inset transition ${
                  task.id === selected.id
                    ? "bg-secondary/70 ring-primary/30"
                    : "bg-background ring-border hover:bg-muted/60"
                }`}
              >
                <span className="flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1">
                    <KindBadge kind={task.kind} />
                    {task.origin === "source" ? (
                      <Chip tone="bg-violet-50 text-violet-700 ring-violet-200">
                        外部接入
                      </Chip>
                    ) : null}
                  </span>
                  {taskLevel ? (
                    <LevelBadge level={taskLevel} />
                  ) : (
                    <Chip tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
                      无风险
                    </Chip>
                  )}
                </span>
                <span className="text-[12px] font-medium text-foreground">
                  {task.title}
                </span>
                <span className="text-[10.5px] text-muted-foreground">
                  {task.status === "draft"
                    ? "草稿"
                    : task.status === "paused"
                      ? "已暂停"
                      : "执行中"}{" "}
                  · v{task.version} · 命中{" "}
                  {task.audience.resolvedPersonIds?.length ?? 0} 人
                  {count ? ` · ${count} 项风险` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-3.5 py-3 ring-1 ring-foreground/10">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <KindBadge kind={selected.kind} />
              <WeightBadge weight={selected.weight} />
              <Chip tone="bg-muted text-muted-foreground ring-border">
                {SCOPE_LABELS[selected.audience.scope]}
              </Chip>
              <Chip tone="bg-muted text-muted-foreground ring-border">
                v{selected.version}
              </Chip>
              {gaps.length ? (
                <Chip tone="bg-violet-50 text-violet-700 ring-violet-200">
                  缺 {gaps.length} 项字段
                </Chip>
              ) : (
                <Chip tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  字段齐全
                </Chip>
              )}
            </div>
            <h2 className="text-[15px] font-semibold text-foreground">
              {selected.title}
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenTask(selected.id)}
            >
              原任务
            </Button>
            <Button
              size="sm"
              disabled={!canAct}
              onClick={() =>
                onDispose(selected.id, worst?.key, patch, "adjust-task")
              }
            >
              <Sparkles size={13} /> 提交处置
            </Button>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Section title="1 · 基本信息" icon={<Info size={13} />}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="任务类型" value={KIND_LABELS[selected.kind]} />
              <Field
                label="任务权重"
                value={selected.weight ? WEIGHT_LABELS[selected.weight] : "未标注"}
              />
              <Field
                label="内容资源"
                value={
                  selected.resources.length
                    ? selected.resources
                        .map(
                          (resource) =>
                            `${resource.name}（${RESOURCE_LABELS[resource.type]}${resource.minutes === null ? "，时长缺失" : ` ${resource.minutes} 分钟`}）`,
                        )
                        .join("；")
                    : "未关联内容"
                }
              />
              <Field
                label="单次预计时长"
                value={
                  taskOccurrenceMinutes(selected) === null
                    ? "缺失"
                    : `${taskOccurrenceMinutes(selected)} 分钟（含附加题 ${selected.additionalMinutes} 分钟）`
                }
              />
              <Field
                label="负责人"
                value={`总部 ${selected.owners.hqOwnerName || "未配置"} · 区域 ${selected.owners.regionOwnerName || "未配置"}`}
              />
              <Field
                label="有效周期"
                value={`${selected.startsOn} ~ ${selected.endsOn}（${daysBetween(selected.startsOn, selected.endsOn) + 1} 天）`}
              />
              <Field
                label="时间规则"
                value={
                  selected.frequency
                    ? `${KIND_LABELS[selected.kind]} · ${selected.frequency.unit === "once" ? "一次性" : selected.frequency.unit === "daily" ? "每日" : "每周"} ${selected.frequency.count} 次`
                    : "缺少结构化频次"
                }
              />
              <Field
                label="发布与提醒"
                value={`${selected.publishedAt ?? "未发布"} · ${selected.reminder?.enabled ? `提前 ${selected.reminder.daysBefore} 天提醒` : "未启用提醒"}`}
              />
            </div>
          </Section>

          <Section title="2 · 人群" icon={<Users size={13} />}>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="bg-muted text-muted-foreground ring-border">
                  策略：{selected.audience.label}
                </Chip>
                <Chip tone="bg-muted text-muted-foreground ring-border">
                  预期 {selected.audience.expectedCount ?? "未配置"} 人
                </Chip>
                <Chip tone="bg-muted text-muted-foreground ring-border">
                  命中 {audienceIds?.length ?? 0} 人
                </Chip>
                <Chip tone="bg-muted text-muted-foreground ring-border">
                  名单 v{selected.audience.snapshotVersion}
                </Chip>
              </div>
              {distribution.map((region) => {
                const count = (audienceIds ?? []).filter(
                  (id) =>
                    state.people.find((person) => person.id === id)?.regionId ===
                    region.id,
                ).length;
                const eligible = state.people.filter(
                  (person) => person.active && person.regionId === region.id,
                ).length;
                return (
                  <div key={region.id} className="grid gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>{region.name}</span>
                      <span className="text-muted-foreground">
                        {count} / {eligible} 人
                      </span>
                    </div>
                    <Bar value={count} max={Math.max(1, eligible)} />
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-1">
                {[...roleCounts.entries()].map(([role, count]) => (
                  <Chip key={role} tone="bg-muted text-muted-foreground ring-border">
                    {`${role} ${count} 人`}
                  </Chip>
                ))}
              </div>
              {selected.audience.snapshotVersion < selected.version ? (
                <p className="text-[11px] text-amber-700">
                  员工名单由 v{selected.audience.snapshotVersion} 生成，任务已更新到 v
                  {selected.version}，需要按最新人群策略重新生成名单。
                </p>
              ) : null}
            </div>
          </Section>

          <Section title="3 · 时间与负荷" icon={<Clock size={13} />}>
            <div className="grid gap-2.5">
              <div className="grid gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>本周每日累计分钟（命中人群合计）</span>
                  <span className="text-muted-foreground">
                    峰值 {Math.max(...dayTotals)} 分钟
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day, index) => (
                    <div key={day} className="grid gap-1">
                      <div className="flex h-16 items-end rounded-md bg-muted/60">
                        <div
                          className={`w-full rounded-md ${dayTotals[index] > 0 ? "bg-primary/70" : ""}`}
                          style={{
                            height: `${Math.max(2, (dayTotals[index] / maxDayTotal) * 100)}%`,
                          }}
                          title={`${day}: ${dayTotals[index]} 分钟`}
                        />
                      </div>
                      <div className="text-center text-[10px] text-muted-foreground">
                        {formatDay(day)}
                        <div>周{weekdayOf(day)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field
                  label="区域人均预计分钟"
                  value={`${Math.round(
                    assigned.length
                      ? assigned.reduce((sum, person) => sum + person.plannedMinutes, 0) /
                          assigned.length
                      : 0,
                  )} 分钟`}
                />
                <Field
                  label="最高单人峰值"
                  value={
                    peakPerson
                      ? `${peakPerson.name} ${peakPerson.dailyPeak} 分钟（${peakPerson.peakDay ?? "—"}）`
                      : "—"
                  }
                />
                <Field
                  label="本周命中人数"
                  value={`${assigned.length} 人 · 名单 ${selected.audience.resolvedPersonIds?.length ?? 0} 人`}
                />
              </div>
              {peakPerson ? (
                <div className="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
                  峰值日构成：
                  {peakPerson.items
                    .filter((item) => item.day === peakPerson.peakDay)
                    .map(
                      (item) =>
                        `${item.taskTitle} ${Math.round(item.minutes)} 分钟`,
                    )
                    .join("、")}
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="4 · 关联任务" icon={<GitBranch size={13} />}>
            <div className="grid gap-2 text-[11.5px]">
              {related.length ? (
                related.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-muted/50 px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-1.5">
                      <KindBadge kind={task.kind} />
                      <span className="text-foreground">{task.title}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      {selected.relations.sameSourceTaskIds.includes(task.id) ? (
                        <Chip tone="bg-indigo-50 text-indigo-700 ring-indigo-200">
                          同源内容
                        </Chip>
                      ) : null}
                      {selected.relations.prerequisiteTaskIds.includes(task.id) ? (
                        <Chip tone="bg-sky-50 text-sky-700 ring-sky-200">
                          前置任务
                        </Chip>
                      ) : null}
                      {selected.relations.exclusiveTaskIds.includes(task.id) ? (
                        <Chip tone="bg-rose-50 text-rose-700 ring-rose-200">
                          互斥任务
                        </Chip>
                      ) : null}
                      {task.resources.some((resource) =>
                        selected.resources.some((item) => item.id === resource.id),
                      ) ? (
                        <Chip tone="bg-amber-50 text-amber-700 ring-amber-200">
                          内容重复
                        </Chip>
                      ) : null}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">未发现同源、前置或重复任务。</p>
              )}
              {sameDayTasks.length > 1 ? (
                <div className="rounded-lg bg-amber-50/70 p-2.5 text-amber-900 ring-1 ring-amber-200">
                  {peakPerson?.name} 在 {peakPerson?.peakDay} 同时有{" "}
                  {sameDayTasks.length} 项任务：
                  {sameDayTasks
                    .map(
                      (id) =>
                        state.tasks.find((task) => task.id === id)?.title ?? id,
                    )
                    .join("、")}
                </div>
              ) : null}
            </div>
          </Section>
        </div>

        <Section
          title="5 · 结论"
          icon={<CheckCircle2 size={13} />}
          extra={
            <div className="flex flex-wrap items-center gap-1.5">
              {worst ? (
                <>
                  <LevelBadge level={worst.level} />
                  <Chip tone="bg-muted text-muted-foreground ring-border">
                    {taskRisks.length} 项规则命中
                  </Chip>
                </>
              ) : (
                <Chip tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  通过
                </Chip>
              )}
            </div>
          }
        >
          {taskRisks.length ? (
            <div className="grid gap-2">
              {taskRisks.map((risk) => (
                <RiskCard
                  key={risk.key}
                  state={state}
                  actor={actor}
                  risk={risk}
                  status={riskStatusOf(state, risk)}
                  onSimulate={(item) =>
                    onDispose(item.taskIds[0] ?? selected.id, item.key, {}, "")
                  }
                  onDispose={(item) =>
                    onDispose(item.taskIds[0] ?? selected.id, item.key, {}, "")
                  }
                  onOpenTask={onOpenTask}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50/70 px-3 py-2.5 text-[12px] text-emerald-800 ring-1 ring-emerald-200">
              <CheckCircle2 size={14} /> 没发现问题。
            </div>
          )}
          {gaps.length ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-violet-50/70 px-3 py-2.5 text-[11.5px] text-violet-800 ring-1 ring-violet-200">
              <AlertTriangle size={14} className="mt-0.5" />
              <div>
                数据不足，暂不下结论：{gaps.map((gap) => gap.field).join("、")}
                <div className="mt-0.5 text-violet-700/80">
                  来源：{gaps.map((gap) => gap.ref).join("；")}
                </div>
              </div>
            </div>
          ) : null}
        </Section>

        <Section
          title="发布前模拟"
          icon={<Sparkles size={13} />}
          extra={
            <Chip tone="bg-secondary text-secondary-foreground ring-primary/20">
              修改人群 / 频次 / 截止 / 时长，立即重算
            </Chip>
          }
        >
          <div className="grid gap-4">
            <TaskPatchEditor
              state={state}
              task={selected}
              patch={patch}
              onChange={setPatch}
              actor={actor}
            />
            <SimulationResultView result={simulation} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-[11px] text-muted-foreground">
                {canAct ? "Agent 不改任务；确认处置后才写入新版本。" : "你只能查看，调整需负责人确认。"}
              </span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setPatch({})}>
                  重置
                </Button>
                <Button
                  size="sm"
                  disabled={!canAct}
                  onClick={() =>
                    onDispose(
                      selected.id,
                      worst?.key,
                      patch,
                      Object.keys(patch).length ? "adjust-task" : "mark-exception",
                    )
                  }
                >
                  提交处置
                </Button>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  extra,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}
