import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileWarning,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  RiskStatus,
} from "../../lib/inspectionTypes";
import {
  KIND_LABELS,
  WEIGHT_LABELS,
} from "../../lib/inspectionEngine";
import {
  KindBadge,
  LevelBadge,
  StatusBadge,
} from "./shared";

export function RiskCard({
  state,
  actor,
  risk,
  status,
  onSimulate,
  onDispose,
  onOpenTask,
  variant = "card",
}: {
  state: InspectionState;
  actor: InspectionActor;
  risk: InspectionRisk;
  status: RiskStatus;
  onSimulate: (risk: InspectionRisk) => void;
  onDispose: (risk: InspectionRisk) => void;
  onOpenTask: (taskId: string) => void;
  variant?: "card" | "row";
  key?: React.Key;
}) {
  const [open, setOpen] = useState(variant === "card");
  const tasks = risk.taskIds
    .map((id) => state.tasks.find((task) => task.id === id))
    .filter(Boolean);
  const regions = risk.regionIds
    .map((id) => state.regions.find((region) => region.id === id)?.name ?? id)
    .filter(Boolean);
  const canAct = !actor.readOnly && risk.ruleId !== "F1";
  const kinds = [...new Set(tasks.map((task) => task!.kind))];
  return (
    <div
      className={`rounded-xl bg-card ring-1 ring-foreground/10 ${
        status === "已解决" ? "opacity-70" : ""
      }`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span className="grid flex-1 gap-1.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={risk.level} />
            {kinds.map((kind) => (
              <KindBadge key={kind} kind={kind} />
            ))}
            <StatusBadge status={status} />
          </span>
          <span className="text-sm font-semibold text-foreground">
            {risk.title}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {tasks.slice(0, 3).map((task) => (
              <span key={task!.id}>
                {task!.title}（{KIND_LABELS[task!.kind]}
                {task!.weight ? `·${WEIGHT_LABELS[task!.weight]}` : ""}）
              </span>
            ))}
            {tasks.length > 3 ? `等 ${tasks.length} 项任务` : ""} · 影响{" "}
            {risk.impact.affectedPeople} 人 · {regions.join("、") || "全局"}
          </span>
        </span>
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-border/70 px-3.5 py-3">
          <div className="grid gap-2 text-[12px] leading-relaxed">
            <Field label="结论" value={risk.conclusion} />
            <Field label="原因" value={risk.reason} />
            <div className="grid grid-cols-[46px_1fr] gap-2">
              <span className="text-muted-foreground">证据</span>
              <ul className="grid gap-1">
                {risk.evidence.map((item) => (
                  <li key={item.text} className="grid gap-0.5">
                    <span>{item.text}</span>
                    <span className="text-[10.5px] text-muted-foreground">
                      来源：{item.ref}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Field label="建议" value={risk.suggestion} />
            <Field label="影响" value={risk.impact.text} />
            {risk.hypothesis ? (
              <Field label="待核实" value={risk.hypothesis} />
            ) : null}
            <Field
              label="需要确认"
              value={
                risk.confirmation
                  ? `${risk.confirmation.name}（${risk.confirmation.roleLabel}）`
                  : "无需额外确认"
              }
            />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-border/70 pt-2.5">
            <Button size="sm" variant="outline" onClick={() => onSimulate(risk)}>
              <Sparkles size={13} /> 调整
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!tasks.length}
              onClick={() => tasks[0] && onOpenTask(tasks[0].id)}
            >
              <ExternalLink size={13} /> 原任务
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!canAct || status === "已解决"}
              onClick={() => onDispose(risk)}
            >
              <ShieldCheck size={13} /> 处置
            </Button>
            {status === "已解决" ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                <FileWarning size={12} /> 已解除
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[46px_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
