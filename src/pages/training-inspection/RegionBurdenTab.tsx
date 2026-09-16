import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Users,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  KIND_LABELS,
  ROLE_LABELS,
  addDays,
  inspectionDay,
} from "../../lib/inspectionEngine";
import {
  rankRegions,
  regionBurden,
  visibleRegionIds,
  weekDates,
  type BurdenPersonRow,
  type BurdenTaskRow,
  type RegionBurden,
} from "../../lib/inspectionBurden";
import type {
  DispositionAction,
  InspectionActor,
  InspectionState,
  TaskPatch,
} from "../../lib/inspectionTypes";
import { TaskDetailDialog } from "./TaskDetailDialog";
import {
  Bar,
  Chip,
  EmptyState,
  KindBadge,
  Metric,
  SectionHeading,
  WeightBadge,
  formatDay,
} from "./shared";

const dayLabel = (day: string) => day.slice(5).replace("-", "/");

/** 区域负担：区域对比 → 区域明细（任务 / 重复 / 超载的人）。 */
export function RegionBurdenTab({
  state,
  actor,
  week,
  today = inspectionDay(),
  selectedTaskId,
  onDispose,
  onOpenTask,
}: {
  state: InspectionState;
  actor: InspectionActor;
  week: string;
  today?: string;
  selectedTaskId?: string | null;
  onDispose: (
    taskId: string,
    riskKey?: string,
    patch?: TaskPatch,
    action?: DispositionAction,
  ) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const burdens = useMemo(
    () => regionBurden(state, week, today, visibleRegionIds(state, actor)),
    [state, week, today, actor],
  );
  const ranked = useMemo(() => rankRegions(burdens), [burdens]);
  const [openRegionId, setOpenRegionId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // 区域账号（非总部）没有对比需求，直接进自己的区域
  useEffect(() => {
    if (!actor.hq) setOpenRegionId(ranked[0]?.regionId ?? null);
  }, [actor, ranked]);

  // 从审计总览结论跳进来时定位到对应任务
  useEffect(() => {
    if (!selectedTaskId) return;
    const owner = ranked.find((item) =>
      item.tasks.some((task) => task.taskId === selectedTaskId),
    );
    if (!owner) return;
    setOpenRegionId(owner.regionId);
    setHighlight(selectedTaskId);
    const timer = window.setTimeout(() => setHighlight(null), 3200);
    return () => window.clearTimeout(timer);
  }, [selectedTaskId, ranked]);

  useEffect(() => {
    if (!highlight) return;
    document
      .querySelector(`[data-burden-task="${highlight}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight, openRegionId]);

  const region = ranked.find((item) => item.regionId === openRegionId) ?? null;
  const weekLabel = `${dayLabel(week)} – ${dayLabel(addDays(week, 6))}`;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          统计周期 {weekLabel} · 口径：区域容量
          {region
            ? `（${region.capacityMinutes} 分钟/人/周${region.capacityConfirmed ? "" : "，未确认用策略默认值"}）`
            : `（未确认的区域用策略 ${state.policy.weeklyCapacityMinutes} 分钟/人/周）`}
          · 单日超过 {state.policy.dailyLimitMinutes} 分钟记为单日过载
        </span>
        {region && actor.hq ? (
          <Button variant="outline" size="sm" onClick={() => setOpenRegionId(null)}>
            <ArrowLeft size={13} /> 返回区域对比
          </Button>
        ) : null}
      </div>

      {region ? (
        <RegionDetail
          region={region}
          state={state}
          week={week}
          highlight={highlight}
          onDispose={onDispose}
          onOpenTask={onOpenTask}
          onOpenDetail={setDetailTaskId}
        />
      ) : (
        <RegionTable regions={ranked} onOpen={setOpenRegionId} />
      )}

      <TaskDetailDialog
        open={!!detailTaskId}
        onOpenChange={(open) => !open && setDetailTaskId(null)}
        state={state}
        task={state.tasks.find((item) => item.id === detailTaskId) ?? null}
        week={week}
        onOpenSource={(taskId) => {
          setDetailTaskId(null);
          onOpenTask(taskId);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ 区域对比 */

function RegionTable({
  regions,
  onOpen,
}: {
  regions: RegionBurden[];
  onOpen: (regionId: string) => void;
}) {
  if (!regions.length)
    return <EmptyState title="没有可见区域" hint="当前账号没有可查看的区域。" />;

  return (
    <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <SectionHeading
        title="区域负担对比"
        hint="按超载比例排序；点一行看这个区域是哪些任务压人"
        extra={<Chip tone="bg-secondary text-secondary-foreground ring-primary/20">{regions.length} 个区域</Chip>}
      />
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-12 gap-2 px-2.5 pb-1.5 text-[10.5px] text-muted-foreground">
            <span className="col-span-3">区域</span>
            <span className="col-span-2">人均分钟 / 容量</span>
            <span className="col-span-2">超载人数</span>
            <span className="col-span-2">单日峰值</span>
            <span className="col-span-2">任务数</span>
            <span className="col-span-1 text-right">操作</span>
          </div>
          <div className="grid gap-1.5">
            {regions.map((region) => {
              const over = region.overCapacityCount > 0;
              const capacity = region.capacityMinutes;
              return (
                <div
                  key={region.regionId}
                  onClick={() => onOpen(region.regionId)}
                  className="grid w-full cursor-pointer grid-cols-12 items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-left transition-colors hover:bg-secondary/70"
                >
                  <span className="col-span-3 grid gap-0.5">
                    <span className="text-[12.5px] font-medium text-foreground">
                      {region.regionName}
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      负责人 {region.ownerName} · {region.knownHeadcount} 人
                      {region.unknownHeadcount
                        ? `（${region.unknownHeadcount} 人缺时长未计入）`
                        : ""}
                    </span>
                  </span>
                  <span className="col-span-2 grid gap-1">
                    {region.knownHeadcount ? (
                      <>
                        <span
                          className={`text-[12px] font-semibold ${over ? "text-rose-600" : "text-emerald-700"}`}
                        >
                          {region.meanMinutes} 分钟
                        </span>
                        <Bar
                          value={region.meanMinutes}
                          max={Math.max(capacity, region.meanMinutes, 1)}
                          tone={over ? "bg-rose-400" : "bg-emerald-400"}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          容量 {capacity}
                          {region.capacityConfirmed ? "" : "（默认）"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[12px] font-semibold text-muted-foreground">—</span>
                        <span className="text-[10px] text-muted-foreground">
                          全员缺预计时长，无法判定
                        </span>
                      </>
                    )}
                  </span>
                  <span className="col-span-2 grid gap-0.5">
                    {region.knownHeadcount ? (
                      <>
                        <span className="text-[12px]">
                          <span className={over ? "font-semibold text-rose-600" : "text-foreground"}>
                            {region.overCapacityCount}
                          </span>
                          <span className="text-muted-foreground"> / {region.knownHeadcount} 人</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          单日过载 {region.dailyOverloadCount} 人
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[12px] text-muted-foreground">—</span>
                        <span className="text-[10px] text-muted-foreground">
                          {region.unknownHeadcount} 人未计入
                        </span>
                      </>
                    )}
                  </span>
                  <span className="col-span-2 grid gap-0.5">
                    <span className="text-[12px] text-foreground">
                      {region.peakDayMinutes} 分钟
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {region.peakDay ? dayLabel(region.peakDay) : "—"}
                    </span>
                  </span>
                  <span className="col-span-2 flex flex-wrap items-center gap-1">
                    <span className="text-[12px] text-foreground">{region.taskCount} 项</span>
                    {(Object.keys(region.taskCountByKind) as (keyof typeof KIND_LABELS)[])
                      .filter((kind) => region.taskCountByKind[kind] > 0)
                      .map((kind) => (
                        <Chip key={kind} tone={KIND_TONES[kind]}>
                          {KIND_LABELS[kind]} {region.taskCountByKind[kind]}
                        </Chip>
                      ))}
                  </span>
                  <span className="col-span-1 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(region.regionId);
                      }}
                    >
                      点击查看
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const KIND_TONES: Record<string, string> = {
  study: "bg-sky-50 text-sky-700 ring-sky-200",
  practice: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  exam: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  media: "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

/* ------------------------------------------------------------ 区域明细 */

function RegionDetail({
  region,
  state,
  week,
  highlight,
  onDispose,
  onOpenTask,
  onOpenDetail,
}: {
  region: RegionBurden;
  state: InspectionState;
  week: string;
  highlight: string | null;
  onDispose: (taskId: string, riskKey?: string, patch?: TaskPatch, action?: DispositionAction) => void;
  onOpenTask: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
}) {
  const over = region.overCapacityCount > 0;
  return (
    <>
      <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <SectionHeading
          title={`${region.regionName} × 本周负担`}
          hint={`负责人 ${region.ownerName} · ${region.knownHeadcount} 人参与排期${
            region.unknownHeadcount ? `（另有 ${region.unknownHeadcount} 人缺时长，未计入判定）` : ""
          }`}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Metric
            label="人均分钟"
            value={region.knownHeadcount ? region.meanMinutes : "—"}
            unit={region.knownHeadcount ? "分钟" : undefined}
            hint={
              region.knownHeadcount
                ? `容量 ${region.capacityMinutes} 分钟/人/周${region.capacityConfirmed ? "" : "（默认口径）"}`
                : `${region.unknownHeadcount} 人全部缺预计时长，无法判定`
            }
            tone={over ? "text-rose-600" : "text-emerald-700"}
          />
          <Metric
            label="超载人数"
            value={region.overCapacityCount}
            unit={`/ ${region.knownHeadcount} 人`}
            hint={`单日过载 ${region.dailyOverloadCount} 人 · 单日阈值 ${state.policy.dailyLimitMinutes} 分钟`}
            tone={over ? "text-rose-600" : ""}
          />
          <Metric
            label="单日峰值"
            value={region.peakDayMinutes}
            unit="分钟"
            hint={region.peakDay ? `出现在 ${dayLabel(region.peakDay)}` : "本周没有排期"}
            tone={region.peakDayMinutes > state.policy.dailyLimitMinutes ? "text-amber-600" : ""}
          />
        </div>
        {region.taskCount ? (
          <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[12px] leading-relaxed text-foreground ring-1 ring-primary/15">
            占用最多的是
            {region.causes
              .map((task) => `「${task.title}」（人均 ${task.minutesPerPerson} 分钟）`)
              .join("、")}
            {region.missingMinutesTaskCount
              ? `；另有 ${region.missingMinutesTaskCount} 项任务缺预计时长，实际负担可能更高。`
              : "。"}
          </div>
        ) : null}
      </div>

      <TaskRows
        region={region}
        state={state}
        highlight={highlight}
        onDispose={onDispose}
        onOpenTask={onOpenTask}
        onOpenDetail={onOpenDetail}
      />

      <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <SectionHeading
          title="重复内容"
          hint="同一批人重复做相同内容，是最容易省下来的时间"
          extra={
            <Chip tone="bg-muted text-muted-foreground ring-border">
              {region.duplicates.length} 组
            </Chip>
          }
        />
        <div className="mt-3 grid gap-1.5">
          {region.duplicates.length ? (
            region.duplicates.map((pair) => (
              <div
                key={pair.key}
                className="grid gap-1 rounded-lg bg-muted/40 px-2.5 py-2"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                  <KindBadge kind={pair.a.kind} />
                  <span className="text-foreground">{pair.a.title}</span>
                  <span className="text-muted-foreground">↔</span>
                  <KindBadge kind={pair.b.kind} />
                  <span className="text-foreground">{pair.b.title}</span>
                  <Chip tone="bg-amber-50 text-amber-700 ring-amber-200">
                    {pair.reason}
                  </Chip>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {pair.overlapPeople} 人重叠 · 合并后每人可省约 {pair.savableMinutes} 分钟
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="没有发现重复内容" hint="本周任务之间没有重复要求。" />
          )}
        </div>
      </div>

      <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <SectionHeading
          title="超载的人"
          hint={`只列超出容量（${region.capacityMinutes} 分钟/人/周）的人`}
          extra={<Chip tone="bg-muted text-muted-foreground ring-border">{region.people.length} 人</Chip>}
        />
        <div className="mt-3 grid gap-1.5">
          {region.people.length ? (
            region.people.map((person) => (
              <PersonRow
                key={person.personId}
                person={person}
                dailyLimit={state.policy.dailyLimitMinutes}
                week={week}
              />
            ))
          ) : (
            <EmptyState
              title="没有人超出容量"
              hint={`本周人均 ${region.meanMinutes} 分钟，低于容量 ${region.capacityMinutes} 分钟。`}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ 任务行 */

function TaskRows({
  region,
  state,
  highlight,
  onDispose,
  onOpenTask,
  onOpenDetail,
}: {
  region: RegionBurden;
  state: InspectionState;
  highlight: string | null;
  onDispose: (taskId: string, riskKey?: string, patch?: TaskPatch, action?: DispositionAction) => void;
  onOpenTask: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
}) {
  return (
    <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <SectionHeading
        title="任务占用"
        hint="按人均分钟排序；覆盖人数 × 人均分钟 = 这个任务吃掉的时间"
        extra={<Chip tone="bg-muted text-muted-foreground ring-border">{region.taskCount} 项</Chip>}
      />
      <div className="mt-3 grid max-h-[420px] gap-1.5 overflow-y-auto pr-0.5">
        {region.tasks.length ? (
          region.tasks.map((task) => (
            <TaskRow
              key={task.taskId}
              task={task}
              state={state}
              highlighted={highlight === task.taskId}
              onDispose={onDispose}
              onOpenTask={onOpenTask}
              onOpenDetail={onOpenDetail}
            />
          ))
        ) : (
          <EmptyState title="本周没有排期任务" hint="这个区域下周才有任务。" />
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  state,
  highlighted,
  onDispose,
  onOpenTask,
  onOpenDetail,
}: {
  task: BurdenTaskRow;
  state: InspectionState;
  highlighted: boolean;
  onDispose: (taskId: string, riskKey?: string, patch?: TaskPatch, action?: DispositionAction) => void;
  onOpenTask: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  key?: React.Key;
}) {
  const source = state.tasks.find((item) => item.id === task.taskId);
  return (
    <div
      data-burden-task={task.taskId}
      className={`grid gap-1.5 rounded-lg px-2.5 py-2 ring-1 transition-colors ${
        highlighted ? "bg-primary/10 ring-primary/40" : "bg-muted/40 ring-transparent"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <KindBadge kind={task.kind} />
        <span className="text-[12.5px] font-medium text-foreground">{task.title}</span>
        {task.weight ? <WeightBadge weight={task.weight} /> : null}
        {task.missingMinutes ? (
          <Chip tone="bg-violet-50 text-violet-700 ring-violet-200">缺时长</Chip>
        ) : null}
        {task.duplicateWith.length ? (
          <Chip tone="bg-amber-50 text-amber-700 ring-amber-200">
            <AlertTriangle size={11} /> 内容重复 {task.duplicateWith.length}
          </Chip>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>覆盖 {task.peopleCount} 人</span>
        <span className="text-foreground">人均 {task.minutesPerPerson} 分钟</span>
        <span>本周 {task.occurrences} 次</span>
        <span>
          {task.busiestDay
            ? `最挤 ${dayLabel(task.busiestDay)}（人均 ${task.busiestMinutes} 分钟）`
            : "本周没有排期"}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            className="inspection-link"
            onClick={() => onOpenDetail(task.taskId)}
          >
            查看详情
          </button>
          {source?.origin === "source" ? (
            <button
              type="button"
              className="inspection-link"
              onClick={() => onOpenTask(task.taskId)}
            >
              原任务
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 人的明细 */

function PersonRow({
  person,
  dailyLimit,
  week,
}: {
  person: BurdenPersonRow;
  dailyLimit: number;
  week: string;
  key?: React.Key;
}) {
  const [open, setOpen] = useState(false);
  const days = weekDates(week);
  const peak = Math.max(...person.days.map((day) => day.minutes), 1);
  const activeDays = person.days.filter((day) => day.tasks.length);

  return (
    <div className="rounded-lg bg-muted/40">
      <button
        type="button"
        className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="grid flex-1 gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Users size={12} /> {person.name}
            </span>
            <span className="text-muted-foreground">
              {person.storeName} · {ROLE_LABELS[person.role]}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="text-foreground">本周 {person.plannedMinutes} 分钟</span>
            <span className="text-muted-foreground">{person.taskCount} 项任务</span>
            <span className="text-rose-600">超出容量 {person.excessMinutes} 分钟</span>
            {person.peakDay ? (
              <span className="text-muted-foreground">
                最忙 {dayLabel(person.peakDay)}（{person.dailyPeak} 分钟）
              </span>
            ) : null}
          </span>
        </span>
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-border/70 px-3 pb-3 pt-3">
          <div className="flex items-end gap-1.5">
            {person.days.map((day) => (
              <div key={day.day} className="grid flex-1 justify-items-center gap-1">
                <div className="flex h-16 w-full items-end rounded bg-background">
                  <div
                    className={`w-full rounded ${
                      day.minutes > dailyLimit ? "bg-rose-400" : "bg-primary/60"
                    }`}
                    style={{ height: `${Math.round((day.minutes / peak) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{dayLabel(day.day)}</span>
                <span className="text-[10px] font-medium text-foreground">{day.minutes}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-1">
            {activeDays.map((day) => (
              <div key={day.day} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground">{dayLabel(day.day)}</span>
                <span className="font-medium text-foreground">{day.minutes} 分钟</span>
                <span className="text-muted-foreground">
                  {day.tasks
                    .map((task) => `${task.title} ${task.minutes} 分钟`)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
