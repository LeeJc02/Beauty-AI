/**
 * 培训巡检 · 自定义巡检需求 · 本地存储
 *
 * 和主巡检存档分开存（独立 key），互不影响：
 * 主存档升级演示数据时，用户自己建的需求不该被重置掉。
 * 单条记录缺字段就跳过，不让整页白屏。
 */

import { useSyncExternalStore } from "react";
import {
  MAX_REQUIREMENTS,
  VALID_ASPECTS,
  normalizeRequirementName,
  refreshRequirement,
  type InspectionRequirement,
  type RequirementAspect,
  type RequirementCadence,
  type RequirementDraft,
  type RequirementStatus,
} from "./inspectionRequirements";

const key = "salesboost.training-inspection.requirements.v1";
const SCHEMA = 1;

let current: InspectionRequirement[] | undefined;
let storageError = "";
const listeners = new Set<() => void>();

const CADENCES: RequirementCadence[] = ["daily", "weekly", "monthly"];
const STATUSES: RequirementStatus[] = ["active", "paused", "finished"];

/** 逐条校验：只认结构完整的记录，坏的直接跳过。 */
function isRequirement(value: any): value is InspectionRequirement {
  if (!value || typeof value !== "object") return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (typeof value.name !== "string" || !value.name) return false;
  if (!Array.isArray(value.aspects) || !value.aspects.length) return false;
  if (!value.aspects.every((item: unknown) => VALID_ASPECTS.includes(item as RequirementAspect)))
    return false;
  if (value.categories != null && !Array.isArray(value.categories)) return false;
  if (value.regionId != null && typeof value.regionId !== "string") return false;
  if (!CADENCES.includes(value.cadence)) return false;
  if (typeof value.startsOn !== "string" || !value.startsOn) return false;
  if (value.endsOn != null && typeof value.endsOn !== "string") return false;
  if (!STATUSES.includes(value.status)) return false;
  if (typeof value.createdAt !== "string") return false;
  if (!Array.isArray(value.runs)) return false;
  for (const run of value.runs) {
    if (!run || typeof run.at !== "string" || typeof run.lastSeenAt !== "string") return false;
    if (typeof run.repeatCount !== "number") return false;
    if (typeof run.taskCount !== "number" || typeof run.issueCount !== "number")
      return false;
    if (!Array.isArray(run.issueIndex) || !Array.isArray(run.taskLines))
      return false;
    if (!run.issuesByAspect || typeof run.issuesByAspect !== "object") return false;
  }
  return true;
}

function initial(): InspectionRequirement[] {
  if (current) return current;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw);
      const list = Array.isArray(saved?.requirements) ? saved.requirements : [];
      const valid = list.filter(isRequirement);
      if (valid.length !== list.length)
        storageError = "有几条自定义巡检的记录不完整，已跳过。";
      current = valid.map((item) =>
        refreshRequirement({
          ...item,
          categories: Array.isArray(item.categories)
            ? item.categories.filter((name) => typeof name === "string")
            : [],
        }),
      );
    }
  } catch {
    storageError = "自定义巡检的本地记录读取失败，已跳过。";
  }
  current ??= [];
  return current;
}

function persist() {
  try {
    localStorage.setItem(key, JSON.stringify({ schema: SCHEMA, requirements: current }));
    storageError = "";
  } catch {
    storageError = "本地存储不可用，这次创建只在当前会话有效。";
  }
}

function write(next: InspectionRequirement[]) {
  current = next;
  persist();
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function getRequirements() {
  return initial();
}

export function getRequirementStorageError() {
  initial();
  return storageError;
}

export function useRequirements() {
  return useSyncExternalStore(subscribe, getRequirements, getRequirements);
}

export interface CreateRequirementResult {
  ok: boolean;
  requirement: InspectionRequirement | null;
  error: string | null;
}

/** 新建一条需求；超过上限时返回可读的原因。 */
export function createRequirement(
  draft: RequirementDraft,
  now = new Date(),
): CreateRequirementResult {
  const existing = initial();
  if (existing.length >= MAX_REQUIREMENTS)
    return {
      ok: false,
      requirement: null,
      error: `最多同时保留 ${MAX_REQUIREMENTS} 个自定义巡检，请先在标签页上关掉不用的。`,
    };
  const requirement = refreshRequirement(
    {
      id: `req-${now.getTime()}-${existing.length}`,
      name: normalizeRequirementName(draft.name) || "自定义巡检",
      aspects: draft.aspects,
      categories: draft.categories.filter((item) => !!item),
      regionId: draft.regionId,
      cadence: draft.cadence,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      status: "active",
      createdAt: now.toISOString(),
      createdBy: draft.createdBy,
      nextRunAt: null,
      lastRunAt: null,
      lastViewedAt: now.toISOString(),
      lastAutoDay: null,
      runs: [],
    },
    now,
  );
  write([...existing, requirement]);
  return { ok: true, requirement, error: null };
}

export function updateRequirement(next: InspectionRequirement, now = new Date()) {
  const refreshed = refreshRequirement(next, now);
  write(
    initial().map((item) => (item.id === refreshed.id ? refreshed : item)),
  );
}

export function deleteRequirement(id: string) {
  write(initial().filter((item) => item.id !== id));
}

/** 打开这个 tab 就算看过了，圆点消失；没有新记录时不写存档。 */
export function markRequirementViewed(id: string, at = new Date().toISOString()) {
  const list = initial();
  const target = list.find((item) => item.id === id);
  if (!target) return;
  const latest = target.runs.at(-1);
  if (!latest) return;
  if (latest.lastSeenAt <= (target.lastViewedAt ?? "")) return;
  write(
    list.map((item) => (item.id === id ? { ...item, lastViewedAt: at } : item)),
  );
}
