import React from "react";
import { RefreshCw } from "lucide-react";
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  RiskLevel,
} from "../../lib/inspectionTypes";
import {
  addDays,
  canSeeRegion,
  formatCadence,
  regionAggregates,
  uniqueRisks,
} from "../../lib/inspectionEngine";
import {
  Chip,
  EmptyState,
  InfoTip,
  Metric,
  jakartaStamp,
  SectionHeading,
  formatDay,
  todayLabel,
} from "./shared";
import { AgentPanel } from "./AgentPanel";
import { AuditConsole } from "./AuditConsole";
import { RunTimeline } from "./RunTimeline";

/** 区域多时只列前两个，避免一行里堆满区域名。 */
function regionSummary(state: InspectionState, regionIds: string[]) {
  const names = regionIds.map(
    (id) => state.regions.find((item) => item.id === id)?.name ?? id,
  );
  if (!names.length) return "全局";
  if (names.length <= 2) return names.join("、");
  return `${names.slice(0, 2).join("、")} 等 ${names.length} 个区域`;
}

const LEVEL_RANK: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
  insufficient: 3,
};

/**
 * 结论区只讲任务对人的影响：先看哪些任务叠在同一个人身上、再把重复布置的点出来。
 * 风险等级计数不在这里出现，避免结论退化成「高中低 + 待补字段」的统计表。
 */
const IMPACT_GROUPS: { label: string; tone: string; rules: string[] }[] = [
  {
    label: "负荷叠加",
    tone: "bg-rose-50 text-rose-700 ring-rose-200",
    rules: ["A3", "A1", "A2", "A4"],
  },
  {
    label: "时间集中",
    tone: "bg-sky-50 text-sky-700 ring-sky-200",
    rules: ["A5", "B3"],
  },
  {
    label: "重复布置",
    tone: "bg-amber-50 text-amber-700 ring-amber-200",
    rules: ["C3", "C5", "D2"],
  },
  {
    label: "品类覆盖",
    tone: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    rules: ["G1"],
  },
];

export function OverviewTab({
  state,
  actor,
  week,
  today,
  risks,
  showConsole = true,
  onOpenTask,
  onFocusTask,
  onCreatedRequirement,
  onToast,
}: {
  state: InspectionState;
  actor: InspectionActor;
  week: string;
  today: string;
  risks: InspectionRisk[];
  /** 归档视图不重复渲染 Agent 对话（那里已是一个独立视图）。 */
  showConsole?: boolean;
  onOpenTask: (taskId: string) => void;
  onFocusTask: (taskId: string) => void;
  onCreatedRequirement: (id: string) => void;
  onToast: (text: string) => void;
}) {
  const latest = state.inspectionRuns.at(-1);
  const openRisks = uniqueRisks(
    risks.filter(
      (risk) =>
        (state.risks.find((record) => record.key === risk.key)?.status ??
          "待处理") !== "已解决",
    ),
  );
  const groupOf = (ruleId: string) =>
    IMPACT_GROUPS.find((group) => group.rules.includes(ruleId));
  const sortedByImpact = (rules: string[]) =>
    openRisks
      .filter((risk) => rules.includes(risk.ruleId))
      .sort(
        (a, b) =>
          LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
          b.impact.affectedPeople - a.impact.affectedPeople,
      );
  // 每个分组先各留一条，保证「叠加」和「重复」都出现在结论里，再用剩余名额补影响面最大的。
  const impactPicks = IMPACT_GROUPS.map((group) => sortedByImpact(group.rules)[0]).filter(
    Boolean,
  ) as InspectionRisk[];
  const impactRisks = [
    ...impactPicks,
    ...sortedByImpact(IMPACT_GROUPS.flatMap((group) => group.rules)).filter(
      (risk) => !impactPicks.includes(risk),
    ),
  ].slice(0, 4);
  const overloadedPeople = new Set(
    openRisks
      .filter((risk) => IMPACT_GROUPS[0].rules.includes(risk.ruleId))
      .flatMap((risk) => risk.personIds),
  );
  /* 业务口径：对外只讲「哪几项任务有问题、压了多少人、要花多少时间」 */
  const hoursText = (minutes: number, digits = 1) => {
    const hours = minutes / 60;
    return (digits === 0 ? String(Math.round(hours)) : hours.toFixed(digits)).replace(
      /\.0$/,
      "",
    );
  };
  const problemTaskIds = new Set(openRisks.flatMap((risk) => risk.taskIds));
  const problemPeopleIds = new Set(openRisks.flatMap((risk) => risk.personIds));
  const problemRegionIds = new Set(openRisks.flatMap((risk) => risk.regionIds));
  const problemStoreIds = new Set(
    [...problemPeopleIds]
      .map((id) => state.people.find((person) => person.id === id)?.storeId)
      .filter(Boolean) as string[],
  );
  const problemGroups = IMPACT_GROUPS.map((group) => ({
    label: group.label,
    count: new Set(
      openRisks
        .filter((risk) => group.rules.includes(risk.ruleId))
        .flatMap((risk) => risk.taskIds),
    ).size,
  }));
  const scopeRegionIds = actor.hq
    ? undefined
    : state.regions
        .filter((region) => canSeeRegion(actor, region.id))
        .map((region) => region.id);
  const scopedPeople = regionAggregates(state, week, today, scopeRegionIds)
    .flatMap((region) => region.people)
    .filter((person) => person.unknownTaskCount === 0);
  const scopedActivePeople = state.people.filter(
    (person) =>
      person.active &&
      (!scopeRegionIds || scopeRegionIds.includes(person.regionId)),
  );
  const scopedTotalMinutes = scopedPeople.reduce(
    (sum, person) => sum + person.plannedMinutes,
    0,
  );
  const scopedMeanMinutes = scopedPeople.length
    ? Math.round(scopedTotalMinutes / scopedPeople.length)
    : 0;
  const peakPerson = [...scopedPeople].sort((a, b) => b.dailyPeak - a.dailyPeak)[0];
  const conflictRules = ["B3", "D2", "C3", "A4"];
  const crowdedTasks = openRisks.filter((risk) =>
    conflictRules.includes(risk.ruleId),
  ).length;
  const behindTasks = openRisks.filter((risk) => risk.ruleId === "E1");
  const behindPeople = new Set(behindTasks.flatMap((risk) => risk.personIds));
  const duplicatedTaskIds = new Set(
    openRisks
      .filter((risk) => IMPACT_GROUPS[2].rules.includes(risk.ruleId))
      .flatMap((risk) => risk.taskIds),
  );
  const taskTitleOf = (taskId: string) =>
    state.tasks.find((task) => task.id === taskId)?.title ?? taskId;
  const weekLabel = `${week.slice(5).replace("-", "/")} ~ ${addDays(week, 6)
    .slice(5)
    .replace("-", "/")}`;
  return (
    <div className="grid gap-4">
      {showConsole ? (
        <AuditConsole
          state={state}
          actor={actor}
          week={week}
          today={today}
          onFocusTask={onFocusTask}
          onToast={onToast}
        />
      ) : null}
      <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <SectionHeading
          title="最近一次审计"
          hint={`周期 ${weekLabel} · ${todayLabel(today)}`}
          extra={
            <div className="grid justify-items-end gap-1 text-[11px] text-muted-foreground">
              <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                {latest ? (
                  <>
                    <Chip
                      tone={
                        latest.trigger === "manual"
                          ? "bg-primary/10 text-primary ring-primary/25"
                          : "bg-muted text-muted-foreground ring-border"
                      }
                    >
                      {latest.trigger === "manual" ? "手动审计" : "自动审计"}
                    </Chip>
                    <span className="font-semibold text-foreground">
                      {jakartaStamp(latest.at)}
                    </span>
                    <span>
                      {latest.taskCount} 项任务 · {latest.actorName}
                      {latest.repeatCount > 1
                        ? ` · 结论没变，已连续 ${latest.repeatCount} 次`
                        : " · 有变化，已记新批次"}
                    </span>
                  </>
                ) : (
                  <span>还没有审计记录</span>
                )}
              </span>
              <span className="inline-flex flex-wrap items-center justify-end gap-1">
                <RefreshCw size={11} /> 每{" "}
                {formatCadence(state.policy.autoRunMinutes)}自动审计一次，有变化才记新批次
                <span className="text-muted-foreground/70">
                  （想改对 Agent 说「改成每 2 小时一次」）
                </span>
              </span>
            </div>
          }
        />
        {latest ? (
          <div className="mt-3 grid gap-2.5">
            <div className="rounded-lg bg-secondary/60 px-3 py-2.5 text-[12px] leading-relaxed ring-1 ring-primary/15">
              <span className="font-semibold text-foreground">主要结论：</span>
              {latest.taskCount} 项任务压在 {problemPeopleIds.size} 名 BA 身上，人均约{" "}
              {hoursText(scopedMeanMinutes)} 小时、最忙一天 {hoursText(peakPerson?.dailyPeak ?? 0)} 小时
              {overloadedPeople.size
                ? `；其中 ${overloadedPeople.size} 人的任务已经叠加到超出可用容量`
                : ""}
              {duplicatedTaskIds.size
                ? `，${duplicatedTaskIds.size} 项任务把相同内容重复布置给同一批人`
                : ""}
              。
            </div>
            {impactRisks.length ? (
              impactRisks.map((risk) => {
                const group = groupOf(risk.ruleId)!;
                const taskIds = [...new Set(risk.taskIds)];
                return (
                  <div
                    key={risk.key}
                    className="grid gap-1.5 rounded-lg bg-gradient-to-br from-secondary/80 to-card px-3 py-2.5 ring-1 ring-primary/15"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={group.tone}>{group.label}</Chip>
                      <span className="text-[12px] font-medium text-foreground">
                        {risk.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        影响 {risk.impact.affectedPeople} 人 ·{" "}
                        {regionSummary(state, risk.regionIds)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      涉及任务：
                      {taskIds.slice(0, 2).map((taskId) => (
                        <button
                          key={taskId}
                          type="button"
                          className="inspection-link"
                          onClick={() => onFocusTask(taskId)}
                        >
                          {taskTitleOf(taskId)}
                        </button>
                      ))}
                      {taskIds.length > 2 ? <span>等 {taskIds.length} 项</span> : null}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      建议：{risk.suggestion}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg bg-emerald-50/70 px-3 py-2 text-[11.5px] text-emerald-800 ring-1 ring-emerald-200">
                本周期没有发现任务叠加或重复布置，BA 的任务量在可承受范围内。
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="还没有审计记录" hint="点右上角「立即审计」开始。" />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="有问题的任务"
          value={problemTaskIds.size}
          unit="项"
          hint={problemGroups
            .map((group) => `${group.label} ${group.count}`)
            .join(" · ")}
          tone={problemTaskIds.size ? "text-rose-600" : ""}
        />
        <Metric
          label="受影响的 BA"
          value={problemPeopleIds.size}
          unit="人"
          hint={`本周任务命中问题的 BA · 分布在 ${problemRegionIds.size} 个区域、${problemStoreIds.size} 家门店`}
        />
        <Metric
          label={
            <>
              本周要花的时间
              <InfoTip
                text={
                  <>
                    本周要花的时间 = 任务资源的预计时长 × 本周应完成次数，按「时长字段完整」的 BA
                    累加，是计划排期时长而非实际耗时；缺预计时长的人和任务不计入
                    {scopedActivePeople.length - scopedPeople.length
                      ? `（本期有 ${scopedActivePeople.length - scopedPeople.length} 人因此未计入）`
                      : ""}
                    。受影响的 BA 按「任务命中问题」的人数统计，与排期口径不同。
                  </>
                }
              />
            </>
          }
          value={hoursText(scopedTotalMinutes, 0)}
          unit="小时"
          hint={`${scopedPeople.length} 名 BA 的排期合计 · 人均约 ${hoursText(
            scopedMeanMinutes,
          )} 小时 · 最忙一天约 ${hoursText(peakPerson?.dailyPeak ?? 0)} 小时${
            peakPerson?.peakDay ? `（${formatDay(peakPerson.peakDay)}）` : ""
          }`}
          tone="text-primary"
        />
        <Metric
          label="任务挤在一起"
          value={crowdedTasks}
          unit="项"
          hint={
            crowdedTasks && behindTasks.length
              ? `同几天到期或内容重复 · 另有 ${behindTasks.length} 项进度落后（${behindPeople.size} 人）`
              : crowdedTasks
                ? "集中在同几天到期，或被重复要求"
                : behindTasks.length
                  ? `没有挤在一起的任务 · 但有 ${behindTasks.length} 项进度落后（${behindPeople.size} 人）`
                  : "没有任务挤在同几天，也没有进度落后"
          }
          tone={crowdedTasks ? "text-amber-600" : ""}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <RunTimeline
          state={state}
          actor={actor}
          onFocusTask={onFocusTask}
          onOpenTask={onOpenTask}
        />
        <AgentPanel
          state={state}
          actor={actor}
          onFocusTask={onFocusTask}
          onCreatedRequirement={onCreatedRequirement}
        />
      </div>
    </div>
  );
}
