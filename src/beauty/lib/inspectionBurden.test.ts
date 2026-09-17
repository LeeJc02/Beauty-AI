import assert from "node:assert/strict";
import test from "node:test";
import { createInspectionState } from "./inspectionData";
import { rankRegions, regionBurden } from "./inspectionBurden";
import {
  inspectionDay,
  personItems,
  regionAggregates,
  taskOccurrenceMinutes,
  taskPeriods,
  weekStart,
} from "./inspectionEngine";
import type { InspectionState } from "./inspectionTypes";

const today = inspectionDay();
const week = weekStart(today);
const state = (): InspectionState => createInspectionState();
const burdenOf = (current: InspectionState, regionId: string) =>
  regionBurden(current, week, today).find((item) => item.regionId === regionId)!;

test("区域负担：容量取区域配置，未确认的区域用策略默认值", () => {
  const current = state();
  const south = burdenOf(current, "south");
  const north = burdenOf(current, "north");
  const bali = burdenOf(current, "bali");
  assert.equal(south.capacityMinutes, 90);
  assert.equal(south.capacityConfirmed, true);
  assert.equal(north.capacityMinutes, 120);
  assert.equal(bali.capacityConfirmed, false);
  assert.equal(bali.capacityMinutes, current.policy.weeklyCapacityMinutes);
});

test("区域负担：缺时长的员工不计入人均与超载判定", () => {
  const current = state();
  const south = burdenOf(current, "south");
  const surabaya = burdenOf(current, "surabaya");
  assert.equal(south.unknownHeadcount, 0);
  assert.equal(south.overCapacityCount, south.knownHeadcount);
  assert.ok(south.knownHeadcount > 0);
  // 泗水全员缺预计时长：没有可用样本，也就不会判成超载
  assert.equal(surabaya.knownHeadcount, 0);
  assert.equal(surabaya.unknownHeadcount, 8);
  assert.equal(surabaya.overCapacityCount, 0);
  assert.equal(surabaya.people.length, 0);
});

test("区域负担：人均分钟与每天分钟和引擎排期一致", () => {
  const current = state();
  const south = burdenOf(current, "south");
  const aggregate = regionAggregates(current, week, today, ["south"])[0];
  assert.equal(south.meanMinutes, aggregate.meanMinutes);
  const known = current.people.filter(
    (person) => person.regionId === "south" && person.active,
  );
  const manual = Math.round(
    known.reduce(
      (sum, person) =>
        sum +
        personItems(current, person.id, week).reduce(
          (minutes, item) => minutes + item.minutes,
          0,
        ),
      0,
    ) / known.length,
  );
  assert.equal(south.meanMinutes, manual);
  assert.equal(south.totalMinutes, south.meanMinutes * south.knownHeadcount);
});

test("区域负担：任务人均分钟 = 每人每天分钟之和 / 覆盖人数", () => {
  const current = state();
  const south = burdenOf(current, "south");
  const row = south.tasks[0];
  assert.ok(row);
  const task = current.tasks.find((item) => item.id === row.taskId)!;
  const people = current.people.filter(
    (person) => person.regionId === "south" && person.active,
  );
  const perPerson = people
    .map((person) =>
      personItems(current, person.id, week)
        .filter((item) => item.taskId === row.taskId)
        .reduce((sum, item) => sum + item.minutes, 0),
    )
    .filter((minutes) => minutes > 0);
  assert.equal(row.peopleCount, perPerson.length);
  assert.equal(
    row.minutesPerPerson,
    Math.round(perPerson.reduce((sum, value) => sum + value, 0) / perPerson.length),
  );
  assert.equal(
    row.occurrences,
    taskPeriods(task, week).reduce((sum, period) => sum + period.count, 0),
  );
  assert.equal(row.missingMinutes, taskOccurrenceMinutes(task) === null);
});

test("区域负担：重复内容来自关系声明 / 同源内容 / 资源重叠，且必须有人重叠", () => {
  const current = state();
  const rows = regionBurden(current, week, today);
  const withDuplicates = rows.filter((region) => region.duplicates.length > 0);
  assert.ok(withDuplicates.length > 0);
  for (const region of withDuplicates) {
    for (const pair of region.duplicates) {
      assert.ok(pair.overlapPeople > 0);
      assert.ok(pair.savableMinutes >= 0);
      assert.ok(
        region.tasks.some((task) => task.taskId === pair.a.taskId) &&
          region.tasks.some((task) => task.taskId === pair.b.taskId),
      );
      const declared = (id: string, otherId: string) => {
        const task = current.tasks.find((item) => item.id === id)!;
        const other = current.tasks.find((item) => item.id === otherId)!;
        return (
          task.relations.duplicateTaskIds.includes(otherId) ||
          task.relations.sameSourceTaskIds.includes(otherId) ||
          task.resources.some((resource) =>
            other.resources.some((item) => item.id === resource.id),
          )
        );
      };
      assert.ok(
        declared(pair.a.taskId, pair.b.taskId) ||
          declared(pair.b.taskId, pair.a.taskId),
      );
    }
    assert.ok(
      region.duplicateTaskCount <= region.tasks.length,
      "重复任务数不能超过任务总数",
    );
  }
});

test("区域负担：超载的人只含超出容量者，并按超额分钟降序", () => {
  const current = state();
  for (const region of regionBurden(current, week, today)) {
    for (const person of region.people) {
      assert.ok(person.plannedMinutes > region.capacityMinutes);
      assert.equal(person.excessMinutes, person.plannedMinutes - region.capacityMinutes);
      assert.equal(person.days.length, 7);
      assert.equal(
        person.days.reduce((sum, day) => sum + day.minutes, 0),
        person.plannedMinutes,
      );
    }
    const excess = region.people.map((person) => person.excessMinutes);
    assert.deepEqual(excess, [...excess].sort((a, b) => b - a));
  }
});

test("区域负担：排序按超载比例、再按人均超出分钟", () => {
  const current = state();
  const ranked = rankRegions(regionBurden(current, week, today));
  assert.equal(ranked.length, current.regions.length);
  for (let i = 1; i < ranked.length; i += 1) {
    const previous = ranked[i - 1];
    const next = ranked[i];
    assert.ok(
      previous.overCapacityRatio > next.overCapacityRatio ||
        (previous.overCapacityRatio === next.overCapacityRatio &&
          previous.excessMinutesPerPerson >= next.excessMinutesPerPerson),
    );
  }
});

test("区域负担：可以只统计指定区域（角色可见范围）", () => {
  const current = state();
  const rows = regionBurden(current, week, today, ["south"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].regionId, "south");
});
