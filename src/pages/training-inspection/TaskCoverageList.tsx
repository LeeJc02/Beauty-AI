import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardCheck, Search } from "lucide-react";
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  RiskLevel,
} from "../../lib/inspectionTypes";
import {
  KIND_LABELS,
  LEVEL_LABELS,
  canSeeTask,
  missingFields,
} from "../../lib/inspectionEngine";
import {
  Chip,
  EmptyState,
  KindBadge,
  LevelBadge,
  SectionHeading,
  WeightBadge,
  riskStatusOf,
} from "./shared";
import { RiskCard } from "./RiskCard";

const levelRank: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
  insufficient: 3,
};
const fieldClass =
  "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

type Conclusion = RiskLevel | "pass";

/** 任务覆盖清单：每个任务一行，说明最近审计时间、结论、命中规则与影响范围。 */
export function TaskCoverageList({
  state,
  actor,
  risks,
  onSimulate,
  onDispose,
  onOpenTask,
  onFocusTask,
}: {
  state: InspectionState;
  actor: InspectionActor;
  risks: InspectionRisk[];
  onSimulate: (risk: InspectionRisk) => void;
  onDispose: (risk: InspectionRisk) => void;
  onOpenTask: (taskId: string) => void;
  onFocusTask: (taskId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [conclusion, setConclusion] = useState<Conclusion | "all">("all");
  const [region, setRegion] = useState("all");
  const [hitOnly, setHitOnly] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const latest = state.inspectionRuns.at(-1);
  const lastSeenOf = (taskId: string) => {
    if (!latest) return null;
    return latest.taskResults.some((result) => result.taskId === taskId)
      ? latest.lastSeenAt
      : null;
  };

  const rows = useMemo(() => {
    return state.tasks
      .filter((task) => task.status !== "disabled" && !task.mergedIntoId)
      .filter((task) => canSeeTask(actor, task))
      .map((task) => {
        const taskRisks = risks
          .filter((risk) => risk.taskIds.includes(task.id))
          .sort((a, b) => levelRank[a.level] - levelRank[b.level]);
        const worst = taskRisks[0];
        const regionIds = task.audience.regionIds.length
          ? task.audience.regionIds
          : state.regions.map((item) => item.id);
        return {
          task,
          taskRisks,
          worst,
          state: worst ? (worst.level as Conclusion) : ("pass" as Conclusion),
          regionIds,
          people: new Set(taskRisks.flatMap((risk) => risk.personIds)),
        };
      })
      .filter((row) => (hitOnly ? row.taskRisks.length > 0 : true))
      .filter((row) => kind === "all" || row.task.kind === kind)
      .filter((row) => conclusion === "all" || row.state === conclusion)
      .filter((row) => region === "all" || row.regionIds.includes(region))
      .filter((row) => {
        if (!search) return true;
        const haystack = [
          row.task.title,
          row.task.audience.label,
          row.task.owners.hqOwnerName,
          row.task.owners.regionOwnerName,
          ...row.taskRisks.map((risk) => `${risk.ruleId} ${risk.ruleName} ${risk.reason}`),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const aRank = a.worst ? levelRank[a.worst.level] : 9;
        const bRank = b.worst ? levelRank[b.worst.level] : 9;
        return aRank - bRank || a.task.title.localeCompare(b.task.title);
      });
  }, [state, actor, risks, hitOnly, kind, conclusion, region, search]);

  const counts = useMemo(() => {
    const all = state.tasks.filter(
      (task) =>
        task.status !== "disabled" &&
        !task.mergedIntoId &&
        canSeeTask(actor, task),
    );
    const hit = all.filter((task) =>
      risks.some((risk) => risk.taskIds.includes(task.id)),
    );
    const gaps = all.filter((task) => missingFields(task).length > 0);
    return { all: all.length, hit: hit.length, gaps: gaps.length };
  }, [state.tasks, actor, risks]);

  const visibleRegions = state.regions.filter(
    (item) => actor.hq || item.id === actor.regionId,
  );

  return (
    <div className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <SectionHeading
        title="审计过的任务"
        hint={`${counts.all} 项任务 · ${counts.gaps} 项待补字段`}
        extra={
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={hitOnly}
              onChange={(event) => setHitOnly(event.target.checked)}
            />
            只看有问题的
          </label>
        }
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <Search size={13} className="absolute top-2.5 left-2 text-muted-foreground" />
          <input
            className={`${fieldClass} w-48 pl-6`}
            placeholder="搜索任务或规则"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className={`${fieldClass} w-24`}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="all">全部类型</option>
          {(Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).map((item) => (
            <option key={item} value={item}>
              {KIND_LABELS[item]}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} w-28`}
          value={conclusion}
          onChange={(event) => setConclusion(event.target.value as Conclusion | "all")}
        >
          <option value="all">全部结论</option>
          {(Object.keys(LEVEL_LABELS) as RiskLevel[]).map((item) => (
            <option key={item} value={item}>
              {LEVEL_LABELS[item]}
            </option>
          ))}
          <option value="pass">未命中规则</option>
        </select>
        {actor.hq ? (
          <select
            className={`${fieldClass} w-32`}
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            <option value="all">全部区域</option>
            {visibleRegions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <Chip tone="bg-muted text-muted-foreground ring-border">
            {actor.roleLabel}
          </Chip>
        )}
        <span className="text-[11px] text-muted-foreground">
          高 {risks.filter((risk) => risk.level === "high").length} · 中{" "}
          {risks.filter((risk) => risk.level === "medium").length} · 低{" "}
          {risks.filter((risk) => risk.level === "low").length} · 数据不足{" "}
          {risks.filter((risk) => risk.level === "insufficient").length}
        </span>
      </div>

      <div className="mt-2.5 grid gap-1.5">
        {rows.length ? (
          rows.map((row) => {
            const open = openTaskId === row.task.id;
            const gaps = missingFields(row.task);
            const lastSeen = lastSeenOf(row.task.id);
            return (
              <div
                key={row.task.id}
                className="rounded-xl bg-background ring-1 ring-foreground/10"
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
                  onClick={() => setOpenTaskId(open ? null : row.task.id)}
                >
                  <span className="mt-0.5 text-muted-foreground">
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </span>
                  <span className="grid flex-1 gap-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <KindBadge kind={row.task.kind} />
                      <WeightBadge weight={row.task.weight} />
                      <span className="text-[12.5px] font-semibold text-foreground">
                        {row.task.title}
                      </span>
                      {row.worst ? (
                        <LevelBadge level={row.worst.level} />
                      ) : gaps.length ? (
                        <Chip tone="bg-violet-50 text-violet-700 ring-violet-200">
                          数据不足
                        </Chip>
                      ) : (
                        <Chip tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
                          没问题
                        </Chip>
                      )}
                      <Chip tone="bg-muted text-muted-foreground ring-border">
                        v{row.task.version}
                      </Chip>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-muted-foreground">
                      <span>
                        审计 {lastSeen ? lastSeen.slice(5, 16).replace("T", " ") : "—"}
                      </span>
                      <span>
                        {row.task.owners.regionOwnerName ||
                          row.task.owners.hqOwnerName ||
                          "未配置"}
                      </span>
                      <span>
                        {row.people.size} 人 ·{" "}
                        {row.regionIds
                          .map(
                            (id) =>
                              state.regions.find((item) => item.id === id)?.name ?? id,
                          )
                          .join("、") || "全局"}
                      </span>
                      {gaps.length ? <span>缺少{gaps.map((gap) => gap.field).join("、")}</span> : null}
                    </span>
                    {row.worst ? (
                      <span className="flex flex-wrap items-center gap-1">
                        {[...new Set(row.taskRisks.map((risk) => risk.ruleId))].map(
                          (ruleId) => (
                            <Chip
                              key={ruleId}
                              tone="bg-muted text-muted-foreground ring-border"
                            >
                              {ruleId}
                            </Chip>
                          ),
                        )}
                        <span className="text-[10.5px] text-muted-foreground">
                          {row.worst.conclusion} · {row.worst.ruleName}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </button>
                {open ? (
                  <div className="grid gap-2 border-t border-border/70 px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ClipboardCheck size={12} />
                      <button
                        type="button"
                        className="inspection-link"
                        onClick={() => onFocusTask(row.task.id)}
                      >
                        任务体检
                      </button>
                      {row.task.origin === "source" ? (
                        <button
                          type="button"
                          className="inspection-link"
                          onClick={() => onOpenTask(row.task.id)}
                        >
                          原任务
                        </button>
                      ) : null}
                    </div>
                    {row.taskRisks.length ? (
                      row.taskRisks.map((risk) => (
                        <RiskCard
                          key={risk.key}
                          state={state}
                          actor={actor}
                          risk={risk}
                          status={riskStatusOf(state, risk)}
                          onSimulate={onSimulate}
                          onDispose={onDispose}
                          onOpenTask={onOpenTask}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg bg-emerald-50/70 px-3 py-2 text-[11.5px] text-emerald-800 ring-1 ring-emerald-200">
                        这项没发现问题
                        {gaps.length
                          ? `；缺${gaps.map((gap) => gap.field).join("、")}，补齐后再看。`
                          : "。"}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <EmptyState title="没有符合条件的任务" hint="换个筛选条件试试。" />
        )}
      </div>
    </div>
  );
}
