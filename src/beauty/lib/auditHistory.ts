/**
 * 数据审计 · 历史周期视图
 *
 * 演示数据只排了「当前一周」，直接审计上周 / 近 4 周只会得到空结果，看不出产品效果。
 * 这里按「整份任务前移 N 周 + 补上完成回传与考试成绩」生成历史副本，
 * 让上周、近 4 周、本月的审计与定时汇报都能演示出真实观感。
 *
 * 只做只读派生：不写回种子数据、不动当前周期的任何数字。
 */
import type { InspectionState, InspectionTask, TaskKind } from "./inspectionTypes";
import { addDays, daysBetween, taskPeriods, weekStart } from "./inspectionEngine";

const DAY_MS = 24 * 60 * 60 * 1000;

const hash = (text: string) => {
  let value = 0;
  for (let index = 0; index < text.length; index += 1)
    value = (value * 31 + text.charCodeAt(index)) % 99991;
  return value;
};

const shiftIso = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();

const shiftDay = (day: string, days: number) => addDays(day.slice(0, 10), days);

/** 历史周期的完成率基线：练习和媒体采集偏低，长期任务明显偏低，便于演示「完成风险」。 */
const PASS_RATE: Record<TaskKind, number> = {
  study: 0.88,
  practice: 0.72,
  exam: 0.82,
  media: 0.6,
};

const passRateOf = (task: InspectionTask) => {
  if (/longterm|long-term/.test(task.id)) return 0.42;
  return PASS_RATE[task.kind];
};

/**
 * 把一条任务整体前移若干天，并补上历史周期应有的完成回传。
 * 副本 id 加后缀，避免和当前周期任务冲突；任务关系一起重指向副本。
 */
function shiftTask(
  task: InspectionTask,
  days: number,
  week: string,
  suffix: string,
): InspectionTask {
  const remap = (id: string) => `${id}${suffix}`;
  const shifted: InspectionTask = {
    ...task,
    id: remap(task.id),
    startsOn: shiftDay(task.startsOn, days),
    endsOn: shiftDay(task.endsOn, days),
    createdAt: shiftDay(task.createdAt, days),
    publishedAt: task.publishedAt
      ? shiftDay(task.publishedAt, days)
      : shiftDay(task.startsOn, days - 3),
    status: task.status === "draft" ? "draft" : "active",
    audience: {
      ...task.audience,
      resolvedAt: task.audience.resolvedAt
        ? shiftIso(task.audience.resolvedAt, days)
        : null,
    },
    relations: {
      sameSourceTaskIds: task.relations.sameSourceTaskIds.map(remap),
      prerequisiteTaskIds: task.relations.prerequisiteTaskIds.map(remap),
      exclusiveTaskIds: task.relations.exclusiveTaskIds.map(remap),
      duplicateTaskIds: task.relations.duplicateTaskIds.map(remap),
      sequenceDefined: task.relations.sequenceDefined,
    },
    mergedIntoId: task.mergedIntoId ? remap(task.mergedIntoId) : null,
    results: {
      completed: {},
      scores: {},
      // 历史周期已经回传，才能算完成率与逾期率
      returnedAt: task.results.returnedAt
        ? shiftIso(task.results.returnedAt, days)
        : `${shiftDay(task.endsOn, days)}T18:00:00.000Z`,
      pushedAt: task.results.pushedAt
        ? shiftIso(task.results.pushedAt, days)
        : `${shiftDay(task.startsOn, days)}T01:00:00.000Z`,
    },
  };
  const rate = passRateOf(task);
  for (const personId of shifted.audience.resolvedPersonIds ?? []) {
    const bucket: Record<string, number> = {};
    for (const period of taskPeriods(shifted, week)) {
      const roll = (hash(`${task.id}|${personId}|${period.key}`) % 100) / 100;
      const done =
        roll < rate
          ? period.count
          : Math.max(0, Math.round(period.count * (roll - rate) * 2));
      bucket[period.key] = Math.min(period.count, done);
    }
    if (Object.keys(bucket).length) shifted.results.completed[personId] = bucket;
    if (task.kind === "exam")
      shifted.results.scores[personId] = 55 + (hash(`${personId}|${task.id}`) % 40);
  }
  return shifted;
}

let cache: { key: string; value: InspectionState } | null = null;

/**
 * 审计用的数据视图：
 * - 周期全部落在当前周 → 直接用原状态；
 * - 含历史周期 → 用「历史副本」替换掉原任务（含当前周时才保留原任务），
 *   副本会按审计周裁剪起止时间，避免长期任务在两个周期里重复计入。
 * 按数据版本 + 周期集合缓存。
 */
export function auditView(
  state: InspectionState,
  weeks: string[],
  today: string,
): InspectionState {
  const current = weekStart(today);
  const past = [...new Set(weeks)].filter((week) => week < current);
  if (!past.length) return state;
  const key = `${state.revision}|${state.seedVersion}|${past.join(",")}|${weeks.includes(current) ? "cur" : "past"}`;
  if (cache?.key === key) return cache.value;
  const extra: InspectionTask[] = [];
  for (const week of past) {
    const offset = Math.round(daysBetween(week, current) / 7);
    const days = -offset * 7;
    const suffix = `-h${offset}`;
    const weekEnd = addDays(week, 6);
    for (const task of state.tasks) {
      if (task.origin !== "demo") continue;
      const copy = shiftTask(task, days, week, suffix);
      copy.startsOn = copy.startsOn < week ? week : copy.startsOn;
      copy.endsOn = copy.endsOn > weekEnd ? weekEnd : copy.endsOn;
      if (copy.endsOn < copy.startsOn) continue;
      if (taskPeriods(copy, week).length === 0) continue;
      extra.push(copy);
    }
  }
  const keep = weeks.includes(current)
    ? state.tasks
    : state.tasks.filter((task) => task.origin !== "demo");
  const value: InspectionState = { ...state, tasks: [...keep, ...extra] };
  cache = { key, value };
  return value;
}

/** 历史副本的 id 带 -hN 后缀，对外展示时还原成原任务 id。 */
export const originalTaskId = (id: string) => id.replace(/-h\d+$/, "");

/** 该任务在本次审计周期里有没有排期：没有排期的任务不参与结论。 */
export function scheduledIn(task: InspectionTask, weeks: string[]) {
  return weeks.some((week) => taskPeriods(task, week).length > 0);
}
