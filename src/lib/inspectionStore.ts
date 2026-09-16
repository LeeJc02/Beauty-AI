/**
 * 培训审计 Agent · 本地存储与数据接入
 *
 * 状态保存在浏览器 localStorage；外部任务页（学习 / 练习 / 考试 / 采集）
 * 通过 syncInspectionSource 把原始任务摘要同步为审计任务，缺失字段标记为「数据不足」，
 * 不伪造人员分配与时长。
 */

import { useSyncExternalStore } from "react";
import { createInspectionState, INSPECTION_SEED_VERSION } from "./inspectionData";
import {
  clampAutoRunMinutes,
  inspectionDay,
  runInspection,
} from "./inspectionEngine";
import type {
  InspectionState,
  InspectionTask,
  TaskKind,
  TaskStatus,
} from "./inspectionTypes";

const key = "salesboost.training-inspection.v2";
let current: InspectionState | undefined;
let storageError = "";
/** 需要常驻展示的通知（例如旧存档被自动重置），不会因为下一次写入而被清空 */
let stickyNotice = "";
const listeners = new Set<() => void>();

/**
 * 存档结构校验。
 *
 * 旧版本写下的存档可能「顶层字段齐全、嵌套字段缺失」（例如审计记录里没有 taskResults），
 * 这种数据会在渲染时抛 `Cannot read properties of undefined (reading 'filter')` 直接白屏。
 * 这里逐条校验运行记录与风险项，任一项不完整就把整份存档视为不兼容并重置为演示数据。
 */
function isCompatible(saved: any): boolean {
  if (!saved || saved.schema !== 2 || saved.seedVersion !== INSPECTION_SEED_VERSION) return false;
  if (!saved.policy) return false;
  for (const field of [
    "tasks",
    "people",
    "regions",
    "risks",
    "exceptions",
    "dispositions",
  ])
    if (!Array.isArray(saved[field])) return false;
  if (saved.inspectionRuns != null && !Array.isArray(saved.inspectionRuns)) return false;

  const runFields = [
    "taskIds",
    "taskResults",
    "added",
    "resolved",
    "levelChanged",
  ];
  for (const run of saved.inspectionRuns ?? []) {
    if (!run || !run.snapshot) return false;
    if (runFields.some((field) => !Array.isArray(run[field]))) return false;
  }
  for (const risk of saved.risks) {
    if (!risk) return false;
    if (
      !Array.isArray(risk.taskIds) ||
      !Array.isArray(risk.personIds) ||
      !Array.isArray(risk.regionIds) ||
      !Array.isArray(risk.history)
    )
      return false;
  }
  return true;
}

function initial() {
  if (current) return current;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved?.schema === 2 && saved.seedVersion !== INSPECTION_SEED_VERSION)
        storageError = "演示数据已更新，已重新载入最新演示数据。";
      else if (saved && !isCompatible(saved))
        stickyNotice = "本地演示数据与当前版本不兼容，已自动重置为最新演示数据。";
      if (isCompatible(saved))
        current = runInspection(saved, new Date(), [], { record: "none" });
    }
  } catch {
    storageError = "本地记录读取失败，已载入演示数据。";
  }
  current ??= createInspectionState();
  return current;
}

export function getInspectionState() {
  return initial();
}

export function getInspectionStorageError() {
  return stickyNotice || storageError;
}

export function setInspectionState(
  update: InspectionState | ((previous: InspectionState) => InspectionState),
) {
  try {
    current = typeof update === "function" ? update(initial()) : update;
  } catch {
    // 兜底自愈：任何计算因数据不兼容失败时，退回演示数据而不是让整页崩溃
    stickyNotice = "本地演示数据与当前版本不兼容，已自动重置为最新演示数据。";
    current = createInspectionState();
    try {
      localStorage.removeItem(key);
    } catch {
      /* 存储不可用时忽略 */
    }
  }
  try {
    localStorage.setItem(key, JSON.stringify(current));
    storageError = "";
  } catch {
    storageError = "本地存储不可用，本次修改仅保留在当前会话。";
  }
  listeners.forEach((listener) => listener());
}

export function resetInspectionState() {
  stickyNotice = "";
  try {
    localStorage.removeItem(key);
  } catch {
    /* 忽略存储异常，直接重置内存状态 */
  }
  current = createInspectionState();
  listeners.forEach((listener) => listener());
}

export function useInspectionState() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getInspectionState);
}

/* ------------------------------------------------------- 外部任务接入 */

export interface LegacyInspectionTask {
  id: string;
  title: string;
  status?: string;
  publishTime?: string;
  startAt?: string;
  deadline?: string;
  scope?: string;
  region?: string;
  frequency?: string;
  target?: unknown;
  targetAudienceLabel?: string;
  progress?: number;
  targetCount?: number;
  completedCount?: number;
}

const regionIdOf = (region?: string) => {
  if (!region) return undefined;
  if (region.includes("南")) return "south";
  if (region.includes("北")) return "north";
  if (region.includes("巴厘")) return "bali";
  if (region.includes("泗水")) return "surabaya";
  return undefined;
};

const statusOf = (status?: string): TaskStatus =>
  /停用|结束|复核结束/.test(status ?? "") ? "disabled" : "active";

function mapSourceTask(
  kind: TaskKind,
  sourceId: string,
  record: LegacyInspectionTask,
): InspectionTask {
  const regionId = regionIdOf(record.region);
  const regional = record.scope === "区域" || !!regionId;
  const gaps = ["预计时长", "逐人分配", "任务负责人", "任务版本"];
  if (!record.frequency) gaps.push("结构化频次");
  if (!record.deadline) gaps.push("截止时间");
  return {
    id: `source:${kind}:${record.id}`,
    title: record.title,
    kind,
    categories: [],
    origin: "source",
    sourceId,
    status: statusOf(record.status),
    version: 0,
    createdAt: record.publishTime ?? record.startAt ?? "",
    createdByName: "",
    publishedAt: record.publishTime?.slice(0, 10) ?? null,
    startsOn: (record.startAt ?? record.publishTime ?? "").slice(0, 10),
    endsOn: (record.deadline ?? "").slice(0, 10),
    frequency: null,
    targetCount: record.targetCount ?? null,
    resources: [],
    additionalMinutes: 0,
    weight: null,
    audience: {
      scope: regional ? "region" : "nationwide",
      label:
        record.targetAudienceLabel ??
        (typeof record.target === "string" ? record.target : undefined) ??
        record.region ??
        "未解析",
      regionIds: regionId ? [regionId] : [],
      storeIds: [],
      roles: null,
      expectedCount: record.targetCount ?? null,
      resolvedPersonIds: null,
      resolvedAt: null,
      snapshotVersion: 0,
    },
    owners: {
      hqOwnerId: "",
      hqOwnerName: "",
      regionOwnerId: null,
      regionOwnerName: null,
      storeOwnerId: null,
      storeOwnerName: null,
    },
    relations: {
      sameSourceTaskIds: [],
      prerequisiteTaskIds: [],
      exclusiveTaskIds: [],
      duplicateTaskIds: [],
      sequenceDefined: false,
    },
    reminder: null,
    reviewCadenceDays: null,
    results: {
      completed: {},
      scores: {},
      returnedAt: null,
      pushedAt: null,
    },
    dataGaps: gaps,
    mergedIntoId: null,
    exceptionNote: "外部任务接入，字段待补齐",
  };
}

/** 任务页创建或停用后调用；只有摘要真正变化时才写入审计状态。 */
export function syncInspectionSource(
  kind: TaskKind,
  sourceId: string,
  records: LegacyInspectionTask[],
) {
  const state = getInspectionState();
  const mapped = records
    .filter((record) => record && record.id && record.title)
    .map((record) => mapSourceTask(kind, sourceId, record));
  const existing = state.tasks.filter(
    (task) => task.origin === "source" && task.kind === kind,
  );
  if (JSON.stringify(existing) === JSON.stringify(mapped)) return;
  setInspectionState((previous) =>
    runInspection({
      ...previous,
      revision: previous.revision + 1,
      tasks: [
        ...previous.tasks.filter(
          (task) => task.origin !== "source" || task.kind !== kind,
        ),
        ...mapped,
      ],
      sourceSyncedAt: {
        ...previous.sourceSyncedAt,
        [kind]: new Date().toISOString(),
      },
    }),
  );
}

/* ----------------------------------------------------------- 定时审计 */

let timer: ReturnType<typeof setTimeout> | undefined;

/** 自动审计间隔按策略走（默认 30 分钟），Agent 改了频率下一轮就生效。 */
const scheduleNext = () => {
  const minutes = clampAutoRunMinutes(
    getInspectionState().policy.autoRunMinutes,
  );
  timer = setTimeout(() => {
    setInspectionState((previous) => runInspection(previous));
    scheduleNext();
  }, minutes * 60_000);
};

export function startInspectionScheduler() {
  if (timer) return () => {};
  const scan = () =>
    setInspectionState((previous) => runInspection(previous));
  scheduleNext();
  const visibility = () => {
    if (
      document.visibilityState === "visible" &&
      getInspectionState().lastRunAt?.slice(0, 10) !== inspectionDay()
    )
      scan();
  };
  document.addEventListener("visibilitychange", visibility);
  return () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    document.removeEventListener("visibilitychange", visibility);
  };
}
