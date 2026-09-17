/**
 * 培训审计 · 区域负担（时间视角）
 *
 * 只回答一件事：本周的任务排期，让不同区域的 BA 要花多少分钟、有多少人超出容量。
 * 全部复用审计引擎的排期口径（personItems / regionAggregates / taskPeriods），
 * 不另起一套算法，保证和审计结论、Agent 回答的数字一致。
 */

import {
  addDays,
  canSeeRegion,
  inspectionDay,
  regionAggregates,
  taskOccurrenceMinutes,
  taskPeriods,
} from "./inspectionEngine";
import type {
  InspectionActor,
  InspectionState,
  PersonRole,
  TaskKind,
  TaskWeight,
} from "./inspectionTypes";

export interface BurdenDayTask {
  taskId: string;
  title: string;
  minutes: number;
  count: number;
}

export interface BurdenDay {
  day: string;
  minutes: number;
  tasks: BurdenDayTask[];
}

/** 超出容量的员工，含本周每日构成。 */
export interface BurdenPersonRow {
  personId: string;
  name: string;
  storeName: string;
  role: PersonRole;
  plannedMinutes: number;
  capacityMinutes: number;
  excessMinutes: number;
  taskCount: number;
  peakDay: string | null;
  dailyPeak: number;
  days: BurdenDay[];
}

/** 区域里的一项任务占用情况。 */
export interface BurdenTaskRow {
  taskId: string;
  title: string;
  kind: TaskKind;
  weight: TaskWeight | null;
  peopleCount: number;
  minutesPerPerson: number;
  occurrences: number;
  busiestDay: string | null;
  busiestMinutes: number;
  duplicateWith: string[];
  missingMinutes: boolean;
}

export type DuplicateReason = "关系声明" | "同源内容" | "资源重叠";

export interface BurdenDuplicatePair {
  key: string;
  a: { taskId: string; title: string; kind: TaskKind };
  b: { taskId: string; title: string; kind: TaskKind };
  overlapPeople: number;
  savableMinutes: number;
  reason: DuplicateReason;
}

export interface RegionBurden {
  regionId: string;
  regionName: string;
  ownerName: string;
  capacityMinutes: number;
  capacityConfirmed: boolean;
  headcount: number;
  knownHeadcount: number;
  unknownHeadcount: number;
  meanMinutes: number;
  excessMinutesPerPerson: number;
  overCapacityCount: number;
  overCapacityRatio: number;
  dailyOverloadCount: number;
  peakDay: string | null;
  peakDayMinutes: number;
  taskCount: number;
  taskCountByKind: Record<TaskKind, number>;
  duplicateTaskCount: number;
  missingMinutesTaskCount: number;
  totalMinutes: number;
  tasks: BurdenTaskRow[];
  duplicates: BurdenDuplicatePair[];
  people: BurdenPersonRow[];
  causes: BurdenTaskRow[];
}

/** 当前账号能看到的区域。 */
export function visibleRegionIds(state: InspectionState, actor: InspectionActor) {
  return state.regions
    .filter((region) => canSeeRegion(actor, region.id))
    .map((region) => region.id);
}

/** 本周 7 天，用于每日分钟展示。 */
export const weekDates = (week: string) =>
  Array.from({ length: 7 }, (_, index) => addDays(week, index));

const duplicateReasonOf = (
  state: InspectionState,
  taskId: string,
  otherId: string,
): DuplicateReason | null => {
  const task = state.tasks.find((item) => item.id === taskId);
  const other = state.tasks.find((item) => item.id === otherId);
  if (!task || !other) return null;
  if (task.relations.duplicateTaskIds.includes(otherId)) return "关系声明";
  if (task.relations.sameSourceTaskIds.includes(otherId)) return "同源内容";
  if (
    task.resources.some((resource) =>
      other.resources.some((item) => item.id === resource.id),
    )
  )
    return "资源重叠";
  return null;
};

/**
 * 按区域汇总本周的时间负担。
 * 缺预计时长的任务按 0 分钟计入并单独标记；缺时长的员工不计入人均与超载判定。
 */
export function regionBurden(
  state: InspectionState,
  week: string,
  today = inspectionDay(),
  regionIds?: string[],
): RegionBurden[] {
  const regions = state.regions.filter(
    (region) => !regionIds || regionIds.includes(region.id),
  );
  const aggregates = regionAggregates(
    state,
    week,
    today,
    regions.map((region) => region.id),
  );
  const days = weekDates(week);

  return aggregates.map((aggregate) => {
    const region = regions.find((item) => item.id === aggregate.regionId)!;
    const known = aggregate.people.filter(
      (person) => person.unknownTaskCount === 0,
    );
    const capacity = aggregate.capacityMinutes;

    // 任务维度聚合：按人、按天累计
    const acc = new Map<
      string,
      {
        people: Set<string>;
        perPerson: Map<string, number>;
        dayTotals: Map<string, number>;
      }
    >();
    for (const person of known)
      for (const item of person.items) {
        const entry =
          acc.get(item.taskId) ??
          { people: new Set<string>(), perPerson: new Map(), dayTotals: new Map() };
        entry.people.add(person.personId);
        entry.perPerson.set(
          person.personId,
          (entry.perPerson.get(person.personId) ?? 0) + item.minutes,
        );
        entry.dayTotals.set(
          item.day,
          (entry.dayTotals.get(item.day) ?? 0) + item.minutes,
        );
        acc.set(item.taskId, entry);
      }

    const tasks: BurdenTaskRow[] = [...acc.entries()]
      .map(([taskId, entry]) => {
        const task = state.tasks.find((item) => item.id === taskId);
        const totals = [...entry.perPerson.values()];
        const minutesPerPerson = totals.length
          ? Math.round(
              totals.reduce((sum, value) => sum + value, 0) / totals.length,
            )
          : 0;
        const busiest = [...entry.dayTotals.entries()].sort(
          (a, b) => b[1] - a[1],
        )[0];
        return {
          taskId,
          title: task?.title ?? taskId,
          kind: task?.kind ?? "study",
          weight: task?.weight ?? null,
          peopleCount: entry.people.size,
          minutesPerPerson,
          occurrences: task
            ? taskPeriods(task, week).reduce((sum, period) => sum + period.count, 0)
            : 0,
          busiestDay: busiest?.[0] ?? null,
          busiestMinutes: busiest
            ? Math.round(busiest[1] / Math.max(1, entry.people.size))
            : 0,
          duplicateWith: [] as string[],
          missingMinutes: task ? taskOccurrenceMinutes(task) === null : false,
        };
      })
      .sort(
        (a, b) =>
          b.minutesPerPerson - a.minutesPerPerson ||
          b.peopleCount - a.peopleCount ||
          a.title.localeCompare(b.title, "zh"),
      );

    // 重复内容：关系声明 / 同源内容 / 资源重叠
    const duplicates: BurdenDuplicatePair[] = [];
    for (let i = 0; i < tasks.length; i += 1)
      for (let j = i + 1; j < tasks.length; j += 1) {
        const a = tasks[i];
        const b = tasks[j];
        const reason =
          duplicateReasonOf(state, a.taskId, b.taskId) ??
          duplicateReasonOf(state, b.taskId, a.taskId);
        if (!reason) continue;
        const peopleA = acc.get(a.taskId)!.people;
        const peopleB = acc.get(b.taskId)!.people;
        const overlapPeople = [...peopleA].filter((id) => peopleB.has(id)).length;
        if (!overlapPeople) continue;
        duplicates.push({
          key: `${a.taskId}~${b.taskId}`,
          a: { taskId: a.taskId, title: a.title, kind: a.kind },
          b: { taskId: b.taskId, title: b.title, kind: b.kind },
          overlapPeople,
          savableMinutes: Math.min(a.minutesPerPerson, b.minutesPerPerson),
          reason,
        });
      }
    duplicates.sort((a, b) => b.overlapPeople - a.overlapPeople);

    const duplicateIds = new Set<string>();
    for (const pair of duplicates) {
      duplicateIds.add(pair.a.taskId);
      duplicateIds.add(pair.b.taskId);
      const rowA = tasks.find((row) => row.taskId === pair.a.taskId);
      const rowB = tasks.find((row) => row.taskId === pair.b.taskId);
      if (rowA) rowA.duplicateWith.push(pair.b.taskId);
      if (rowB) rowB.duplicateWith.push(pair.a.taskId);
    }

    const storeNameOf = (storeId: string) =>
      state.stores.find((store) => store.id === storeId)?.name ?? "未配置门店";

    const people: BurdenPersonRow[] = known
      .filter((person) => person.plannedMinutes > capacity)
      .sort(
        (a, b) =>
          b.plannedMinutes - capacity - (a.plannedMinutes - capacity),
      )
      .map((person) => ({
        personId: person.personId,
        name: person.name,
        storeName: storeNameOf(person.storeId),
        role: person.role,
        plannedMinutes: person.plannedMinutes,
        capacityMinutes: capacity,
        excessMinutes: person.plannedMinutes - capacity,
        taskCount: person.taskCount,
        peakDay: person.peakDay,
        dailyPeak: person.dailyPeak,
        days: days.map((day) => {
          const items = person.items.filter((item) => item.day === day);
          return {
            day,
            minutes: items.reduce((sum, item) => sum + item.minutes, 0),
            tasks: items.map((item) => ({
              taskId: item.taskId,
              title: item.taskTitle,
              minutes: item.minutes,
              count: item.count,
            })),
          };
        }),
      }));

    const taskCountByKind: Record<TaskKind, number> = {
      study: 0,
      practice: 0,
      exam: 0,
      media: 0,
    };
    for (const task of tasks) taskCountByKind[task.kind] += 1;

    return {
      regionId: region.id,
      regionName: region.name,
      ownerName: region.ownerName,
      capacityMinutes: capacity,
      capacityConfirmed: aggregate.capacityConfirmed,
      headcount: aggregate.headcount,
      knownHeadcount: known.length,
      unknownHeadcount: aggregate.headcount - known.length,
      meanMinutes: aggregate.meanMinutes,
      excessMinutesPerPerson: aggregate.meanMinutes - capacity,
      overCapacityCount: people.length,
      overCapacityRatio: known.length ? people.length / known.length : 0,
      dailyOverloadCount: known.filter(
        (person) => person.dailyPeak > state.policy.dailyLimitMinutes,
      ).length,
      peakDay: aggregate.peakDay,
      peakDayMinutes: aggregate.peakDayMinutes,
      taskCount: tasks.length,
      taskCountByKind,
      duplicateTaskCount: duplicateIds.size,
      missingMinutesTaskCount: tasks.filter((task) => task.missingMinutes).length,
      totalMinutes: known.reduce((sum, person) => sum + person.plannedMinutes, 0),
      tasks,
      duplicates,
      people,
      causes: tasks.slice(0, 3),
    };
  });
}

/** 负担排序：超载比例 → 人均超出分钟 → 人均分钟。 */
export function rankRegions(burdens: RegionBurden[]) {
  return [...burdens].sort(
    (a, b) =>
      b.overCapacityRatio - a.overCapacityRatio ||
      b.excessMinutesPerPerson - a.excessMinutesPerPerson ||
      b.meanMinutes - a.meanMinutes ||
      a.regionName.localeCompare(b.regionName, "zh"),
  );
}
