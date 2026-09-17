/**
 * 培训审计 Agent · 本地存储与数据接入
 *
 * 状态保存在浏览器 localStorage；外部任务页（学习 / 练习 / 考试 / 采集）
 * 通过 syncInspectionSource 把原始任务摘要同步为审计任务，缺失字段标记为「数据不足」，
 * 不伪造人员分配与时长。
 */

import { createInspectionState, INSPECTION_SEED_VERSION } from "./inspectionData";
import type { MediaCollectionTask } from "../types";
import {
  clampAutoRunMinutes,
  inspectionDay,
  runInspection,
} from "./inspectionEngine";
import type {
  InspectionState,
  InspectionTask,
  TaskFrequency,
  TaskKind,
  TaskResource,
  TaskStatus,
  TaskWeight,
  InspectionSourceFacts,
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
  if (saved.auditRecords != null && !Array.isArray(saved.auditRecords)) return false;
  if (saved.auditSchedules != null && !Array.isArray(saved.auditSchedules)) return false;
  for (const record of saved.auditRecords ?? []) {
    if (!record || typeof record.id !== "string" || !Array.isArray(record.traceIds)) return false;
  }
  for (const schedule of saved.auditSchedules ?? []) {
    if (!schedule || typeof schedule.id !== "string" || typeof schedule.active !== "boolean") return false;
  }

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
        current = runInspection(
          {
            ...saved,
            // 兼容在审计动作落库前创建的本地快照。
            auditRecords: Array.isArray(saved.auditRecords) ? saved.auditRecords : [],
            auditSchedules: Array.isArray(saved.auditSchedules) ? saved.auditSchedules : [],
          },
          new Date(),
          [],
          { record: "none" },
        );
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

/**
 * 订阅审计状态变更（原 React 版 `useSyncExternalStore` 的 subscribe 参数）。
 * Vue 侧由 `@/beauty/composables/useInspectionState` 的 `useInspectionState()` 消费。
 * 返回值是取消订阅函数。
 */
export function subscribeInspectionState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
  frequency?: string | TaskFrequency;
  target?: unknown;
  targetAudienceLabel?: string;
  progress?: number;
  targetCount?: number;
  completedCount?: number;
  /** ADM SbTaskRespVO 可直接映射的结构化字段。 */
  categories?: string[];
  resources?: TaskResource[];
  additionalMinutes?: number;
  weight?: TaskWeight;
  version?: number;
  createdByName?: string;
  resolvedPersonIds?: string[];
  resolvedAt?: string;
  snapshotVersion?: number;
  ownerNames?: {
    hq?: string;
    region?: string;
    store?: string;
  };
  results?: InspectionTask["results"];
  reminder?: InspectionTask["reminder"];
  reviewCadenceDays?: number;
  relations?: InspectionTask["relations"];
  sourceFacts?: InspectionSourceFacts;
}

/** 把 ADM 采集任务的「任务 / 提交 / 分析」三层状态转换成审计输入。 */
export function toMediaInspectionTask(task: MediaCollectionTask): LegacyInspectionTask {
  return {
    ...task,
    publishTime: task.startAt,
    createdByName: task.creatorName,
    ownerNames: task.scope === "全国" ? { hq: task.creatorName } : { region: task.creatorName },
    sourceFacts: {
      taskStatus: task.status,
      media: {
        totalSubmissions: task.submittedCount,
        enabledSubmissions: task.submissions.filter((item) => !item.mediaDeleted).length,
        disabledSubmissions: task.submissions.filter((item) => item.mediaDeleted).length,
        analysisCompleted: task.submissions.filter((item) => item.analysisStatus === "completed").length,
        analysisProcessing: task.submissions.filter((item) => item.analysisStatus === "processing").length,
        analysisNeedsAttention: task.submissions.filter((item) => item.analysisStatus === "needs_attention").length,
        analysisFailed: task.submissions.filter((item) => item.analysisStatus === "failed").length,
        activeMaterials: 0,
      },
    },
  };
}

const regionIdOf = (region?: string) => {
  if (!region) return undefined;
  if (region.includes("南")) return "south";
  if (region.includes("北")) return "north";
  if (region.includes("巴厘")) return "bali";
  if (region.includes("泗水")) return "surabaya";
  return undefined;
};

const statusOf = (status?: string): TaskStatus => {
  if (/草稿|DRAFT/i.test(status ?? "")) return "draft";
  if (/暂停|PAUSED/i.test(status ?? "")) return "paused";
  if (/停用|结束|复核结束|ENDED|CANCELLED|WITHDRAWN/i.test(status ?? ""))
    return "disabled";
  return "active";
};

const dateOf = (value?: string) => value?.slice(0, 10) ?? "";

/** 把旧页面的可读频次与 ADM 的结构化 frequencyType 统一成审计口径。 */
const frequencyOf = (value?: string | TaskFrequency): TaskFrequency | null => {
  if (!value) return null;
  if (typeof value !== "string") return value;
  if (/一次|once/i.test(value)) return { unit: "once", count: 1 };
  const count = Number(value.match(/(\d+)/)?.[1] ?? 1);
  if (/每日|每天|daily/i.test(value)) return { unit: "daily", count };
  if (/每周|weekly/i.test(value)) return { unit: "weekly", count };
  return null;
};

function mapSourceTask(
  kind: TaskKind,
  sourceId: string,
  record: LegacyInspectionTask,
): InspectionTask {
  const regionId = regionIdOf(record.region);
  const regional = record.scope === "区域" || !!regionId;
  const frequency = frequencyOf(record.frequency);
  const resources = record.resources ?? [];
  const ownerNames = record.ownerNames ?? {};
  const results = record.results ?? {
    completed: {},
    scores: {},
    returnedAt: null,
    pushedAt: null,
  };
  const gaps = new Set<string>();
  if (!resources.length || resources.some((resource) => resource.minutes == null))
    gaps.add("预计时长");
  if (!record.resolvedPersonIds) gaps.add("逐人分配");
  if (!ownerNames.hq && !ownerNames.region && !ownerNames.store) gaps.add("任务负责人");
  if (!record.version || record.version < 1) gaps.add("任务版本");
  if (!frequency) gaps.add("结构化频次");
  if (!record.deadline) gaps.add("截止时间");
  if (record.publishTime && !results.pushedAt) gaps.add("推送记录");
  if (record.publishTime && !results.returnedAt) gaps.add("完成回传");
  return {
    id: `source:${kind}:${record.id}`,
    title: record.title,
    kind,
    categories: record.categories ?? [],
    origin: "source",
    sourceId,
    sourceFacts: record.sourceFacts,
    status: statusOf(record.status),
    version: record.version ?? 0,
    createdAt: record.publishTime ?? record.startAt ?? "",
    createdByName: record.createdByName ?? "",
    publishedAt: dateOf(record.publishTime) || null,
    startsOn: dateOf(record.startAt ?? record.publishTime),
    endsOn: dateOf(record.deadline),
    frequency,
    targetCount: record.targetCount ?? null,
    resources,
    additionalMinutes: record.additionalMinutes ?? 0,
    weight: record.weight ?? null,
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
      resolvedPersonIds: record.resolvedPersonIds ?? null,
      resolvedAt: record.resolvedAt ?? null,
      snapshotVersion: record.snapshotVersion ?? record.version ?? 0,
    },
    owners: {
      hqOwnerId: ownerNames.hq ? `source:${sourceId}:hq` : "",
      hqOwnerName: ownerNames.hq ?? "",
      regionOwnerId: ownerNames.region ? `source:${sourceId}:region` : null,
      regionOwnerName: ownerNames.region ?? null,
      storeOwnerId: ownerNames.store ? `source:${sourceId}:store` : null,
      storeOwnerName: ownerNames.store ?? null,
    },
    relations: record.relations ?? {
      sameSourceTaskIds: [],
      prerequisiteTaskIds: [],
      exclusiveTaskIds: [],
      duplicateTaskIds: [],
      sequenceDefined: false,
    },
    reminder: record.reminder ?? null,
    reviewCadenceDays: record.reviewCadenceDays ?? null,
    results,
    dataGaps: [...gaps],
    mergedIntoId: null,
    exceptionNote: gaps.size ? "外部任务接入，字段待补齐" : "",
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
