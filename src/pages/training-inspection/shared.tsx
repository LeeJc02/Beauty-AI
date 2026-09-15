import React from "react";
import { Info } from "lucide-react";
import type { Role } from "../../types";
import {
  CATEGORY_LABELS,
  KIND_LABELS,
  LEVEL_LABELS,
  RESOURCE_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  WEIGHT_LABELS,
  percent,
} from "../../lib/inspectionEngine";

export const LEVEL_HELP: Record<RiskLevel, string> = {
  high: "阻断发布或要求总部确认",
  medium: "允许发布，但要求负责人确认",
  low: "提示优化",
  insufficient: "不做结论，只要求补齐字段",
};
import type {
  InspectionActor,
  InspectionRisk,
  InspectionState,
  RiskCategory,
  RiskLevel,
  RiskStatus,
  TaskKind,
  TaskWeight,
} from "../../lib/inspectionTypes";

/** React 19 允许 key 作为普通 prop，这里统一声明以便组件参与列表渲染。 */
export type WithKey = { key?: React.Key };

export const actorForRole = (role: Role): InspectionActor => {
  switch (role) {
    case "Super Admin":
    case "HQ Trainer":
      return {
        id: "sarah",
        name: "Sarah Lee",
        hq: true,
        roleLabel: "总部培训经理",
      };
    case "Regional Training Manager":
    case "Regional Trainer":
      return {
        id: "fitriani",
        name: "Fitriani",
        hq: false,
        regionId: "south",
        roleLabel: "南区培训主管",
      };
    default:
      return {
        id: "fitriani",
        name: "Fitriani",
        hq: false,
        regionId: "south",
        readOnly: true,
        roleLabel: "南区经理（只读）",
      };
  }
};

const LEVEL_TONE: Record<RiskLevel, string> = {
  high: "bg-rose-50 text-rose-700 ring-rose-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-sky-50 text-sky-700 ring-sky-200",
  insufficient: "bg-violet-50 text-violet-700 ring-violet-200",
};
const LEVEL_DOT: Record<RiskLevel, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
  insufficient: "bg-violet-500",
};
const STATUS_TONE: Record<RiskStatus, string> = {
  待处理: "bg-slate-100 text-slate-700 ring-slate-200",
  需确认: "bg-amber-50 text-amber-700 ring-amber-200",
  处理中: "bg-blue-50 text-blue-700 ring-blue-200",
  已解决: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  例外生效: "bg-teal-50 text-teal-700 ring-teal-200",
};

export function Chip({
  children,
  tone = "bg-muted text-muted-foreground ring-border",
  className = "",
}: {
  children: React.ReactNode;
  tone?: string;
  className?: string;
  key?: React.Key;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${tone} ${className}`}
    >
      {children}
    </span>
  );
}

export const LevelBadge = ({ level }: { level: RiskLevel; key?: React.Key }) => (
  <Chip tone={LEVEL_TONE[level]} className="font-semibold">
    <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[level]}`} />
    {LEVEL_LABELS[level]}
  </Chip>
);

export const StatusBadge = ({ status }: { status: RiskStatus; key?: React.Key }) => (
  <Chip tone={STATUS_TONE[status]}>{status}</Chip>
);

export const RuleChip = ({
  ruleId,
  category,
}: {
  ruleId: string;
  category: RiskCategory;
  key?: React.Key;
}) => (
  <Chip tone="bg-slate-50 text-slate-600 ring-slate-200">
    <span className="font-mono font-semibold">{ruleId}</span>
    {CATEGORY_LABELS[category]}
  </Chip>
);

export const KindBadge = ({ kind }: { kind: TaskKind; key?: React.Key }) => (
  <Chip
    tone={
      kind === "exam"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
        : kind === "practice"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : kind === "media"
            ? "bg-cyan-50 text-cyan-700 ring-cyan-200"
            : "bg-sky-50 text-sky-700 ring-sky-200"
    }
  >
    {KIND_LABELS[kind]}
  </Chip>
);

export const WeightBadge = ({ weight }: { weight: TaskWeight | null; key?: React.Key }) =>
  weight ? (
    <Chip
      tone={
        weight === "must"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : weight === "makeup" || weight === "retraining"
            ? "bg-purple-50 text-purple-700 ring-purple-200"
            : "bg-muted text-muted-foreground ring-border"
      }
    >
      {WEIGHT_LABELS[weight]}
    </Chip>
  ) : (
    <Chip>未标注权重</Chip>
  );

/**
 * 口径说明：挂在指标后面，鼠标移上去 / 键盘聚焦时浮出来，不占页面排版。
 */
export function InfoTip({
  text,
  label = "口径说明",
}: {
  text: React.ReactNode;
  label?: string;
  key?: React.Key;
}) {
  return (
    <span className="group/info relative ml-1 inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Info size={12} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-[150%] left-1/2 z-30 hidden w-[300px] -translate-x-1/2 rounded-lg bg-foreground/95 px-2.5 py-2 text-left text-[11px] leading-relaxed font-normal text-background shadow-xl group-hover/info:block group-focus-within/info:block"
      >
        {text}
      </span>
    </span>
  );
}

export function Metric({
  label,
  value,
  unit,
  hint,
  tone,
  onClick,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  tone?: string;
  onClick?: () => void;
  key?: React.Key;
}) {
  return (
    <div
      className={`rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 ${onClick ? "cursor-pointer transition hover:ring-primary/40" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") onClick();
            }
          : undefined
      }
    >
      <div className="text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className={`text-[22px] leading-none font-semibold tabular-nums ${tone ?? ""}`}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function Bar({
  value,
  max,
  tone = "bg-primary",
}: {
  value: number;
  max: number;
  tone?: string;
  key?: React.Key;
}) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
  key?: React.Key;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  title,
  hint,
  extra,
}: {
  title: string;
  hint?: string;
  extra?: React.ReactNode;
  key?: React.Key;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {extra}
    </div>
  );
}

export const riskStatusOf = (
  state: InspectionState,
  risk: InspectionRisk,
): RiskStatus =>
  state.risks.find((record) => record.key === risk.key)?.status ?? "待处理";

export const isOpenRisk = (state: InspectionState, risk: InspectionRisk) =>
  riskStatusOf(state, risk) !== "已解决";

/** 区域角色只看得到自己的员工与区域，风险里的证据同步收窄。 */
export function scopeRisk(
  risk: InspectionRisk,
  actor: InspectionActor,
  state: InspectionState,
): InspectionRisk {
  if (actor.hq) return risk;
  const regionId = actor.regionId ?? "";
  const personIds = risk.personIds.filter(
    (id) => state.people.find((person) => person.id === id)?.regionId === regionId,
  );
  const visibleRegions = risk.regionIds.filter((id) => id === regionId);
  if (!visibleRegions.length && risk.regionIds.length) return risk;
  return {
    ...risk,
    personIds,
    regionIds: visibleRegions,
    impact: {
      ...risk.impact,
      affectedPeople: risk.personIds.length ? personIds.length : risk.impact.affectedPeople,
      affectedRegions: visibleRegions.length || risk.impact.affectedRegions,
    },
  };
}

/** 存档里是 UTC 时间，展示统一换成印尼时间。 */
export const jakartaStamp = (iso: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Jakarta",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export const formatDay = (day: string) => day.slice(5).replace("-", "/");
export const weekdayOf = (day: string) =>
  ["日", "一", "二", "三", "四", "五", "六"][
    new Date(`${day}T12:00:00Z`).getUTCDay()
  ];
export const todayLabel = (day: string) => `${formatDay(day)}（周${weekdayOf(day)}）`;
export const percentText = percent;

export {
  KIND_LABELS,
  LEVEL_LABELS,
  CATEGORY_LABELS,
  RESOURCE_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  WEIGHT_LABELS,
};
