/**
 * 培训审计 Agent · 本地演示数据
 *
 * 全部为演示数据，保存在 localStorage。所有判断口径来自 inspectionEngine 的规则，
 * 数据本身不预设结论：风险由规则从任务字段、人员快照与完成回传中推导。
 */

import {
  addDays,
  compareRisks,
  daysBetween,
  evaluateRisks,
  inspectionDay,
  inspectedTaskIds,
  missingFields,
  runInspection,
  weekStart,
} from "./inspectionEngine";
import type {
  InspectionPerson,
  InspectionRegion,
  InspectionRisk,
  InspectionRunChange,
  InspectionRunRecord,
  InspectionRunSnapshot,
  InspectionState,
  InspectionStore,
  InspectionTask,
  PersonRole,
  TaskAudience,
  TaskResource,
} from "./inspectionTypes";

/** 修改演示数据时递增，浏览器预览会自动载入新版演示数据。 */
export const INSPECTION_SEED_VERSION = 4;

const CONTENT = {
  c1: { id: "c1", name: "双萃系列核心卖点课件", type: "courseware", minutes: 30 },
  c2: { id: "c2", name: "敏感肌换季护理课件", type: "courseware", minutes: 30 },
  c3: { id: "c3", name: "服务跟进标准课件", type: "courseware", minutes: 20 },
  c4: { id: "c4", name: "断货应对微课（时长待补）", type: "courseware", minutes: null },
  s1: { id: "s1", name: "新品推荐场景剧本", type: "script", minutes: 10 },
  s2: { id: "s2", name: "顾客异议处理场景剧本", type: "script", minutes: 5 },
  av1: { id: "av1", name: "数字人顾客·价格异议", type: "avatar", minutes: 8 },
  q1: { id: "q1", name: "金句·破冰三连", type: "quote", minutes: 3 },
  paper1: { id: "paper1", name: "新品通关试卷", type: "paper", minutes: 30 },
  paper2: { id: "paper2", name: "敏感肌知识试卷", type: "paper", minutes: 20 },
  media1: { id: "media1", name: "门店服务录音采集", type: "media", minutes: null },
} satisfies Record<string, TaskResource>;

const nameParts = ["Siti", "Ayu", "Maya", "Rizky", "Lia", "Nadia", "Budi", "Dimas"];
const surnames: Record<string, string> = {
  south: "Aminah",
  north: "Lestari",
  bali: "Wijaya",
  surabaya: "Santoso",
};

export function createInspectionState(): InspectionState {
  const today = inspectionDay();
  const week = weekStart(today);
  const nextWeek = addDays(week, 7);

  const regions: InspectionRegion[] = [
    {
      id: "south",
      name: "雅加达南区",
      ownerId: "fitriani",
      ownerName: "Fitriani",
      capacityMinutes: 90,
      history: [75, 80, 85, 80],
      trainerPendingReviews: 42,
      completionReporting: true,
    },
    {
      id: "north",
      name: "雅加达北区",
      ownerId: "dewi",
      ownerName: "Dewi",
      capacityMinutes: 120,
      history: [80, 90, 85, 85],
      trainerPendingReviews: 14,
      completionReporting: true,
    },
    {
      id: "bali",
      name: "巴厘岛区",
      ownerId: "putri",
      ownerName: "Putri",
      capacityMinutes: null,
      history: [35, 40, 40, 45],
      trainerPendingReviews: 9,
      completionReporting: true,
    },
    {
      id: "surabaya",
      name: "泗水区",
      ownerId: "rina",
      ownerName: "Rina",
      capacityMinutes: null,
      history: [60, 65],
      trainerPendingReviews: 7,
      completionReporting: true,
    },
  ];

  const stores: InspectionStore[] = [
    { id: "south-store-1", name: "Grand Indonesia", regionId: "south", city: "雅加达" },
    { id: "south-store-2", name: "Plaza Senayan", regionId: "south", city: "雅加达" },
    { id: "south-store-3", name: "Pondok Indah Mall", regionId: "south", city: "雅加达" },
    { id: "north-store-1", name: "Kelapa Gading", regionId: "north", city: "雅加达" },
    { id: "north-store-2", name: "Central Park", regionId: "north", city: "雅加达" },
    { id: "bali-store-1", name: "Beachwalk", regionId: "bali", city: "巴厘岛" },
    { id: "bali-store-2", name: "Seminyak Village", regionId: "bali", city: "巴厘岛" },
    { id: "surabaya-store-1", name: "Tunjungan Plaza", regionId: "surabaya", city: "泗水" },
    { id: "surabaya-store-2", name: "Pakuwon Mall", regionId: "surabaya", city: "泗水" },
  ];

  const headcount: Record<string, number> = {
    south: 12,
    north: 8,
    bali: 8,
    surabaya: 8,
  };
  const storeIdsOf = (regionId: string) =>
    stores.filter((store) => store.regionId === regionId).map((store) => store.id);
  const people: InspectionPerson[] = regions.flatMap((region) =>
    Array.from({ length: headcount[region.id] }, (_, index) => {
      const storeId = storeIdsOf(region.id)[Math.floor(index / 4)] ?? storeIdsOf(region.id)[0];
      const role: PersonRole =
        index === 0 ? "store_manager" : index === 1 ? "trainer" : index === 2 ? "new_ba" : "ba";
      return {
        id: `${region.id}-${index + 1}`,
        name: `${nameParts[index % nameParts.length]} ${surnames[region.id]} ${index + 1}`,
        regionId: region.id,
        storeId,
        role,
        active: true,
        joinedOn: role === "new_ba" ? addDays(today, -18) : "2024-02-01",
      } satisfies InspectionPerson;
    }),
  );

  const ids = (regionId: string) =>
    people.filter((person) => person.regionId === regionId).map((person) => person.id);
  const all = people.map((person) => person.id);
  const south = ids("south");
  const north = ids("north");
  const bali = ids("bali");
  const surabaya = ids("surabaya");

  const audience = (
    input: Partial<TaskAudience> & Pick<TaskAudience, "resolvedPersonIds">,
  ): TaskAudience => ({
    scope: "nationwide",
    label: "全国直营门店 BA",
    regionIds: [],
    storeIds: [],
    roles: null,
    expectedCount: input.resolvedPersonIds?.length ?? null,
    resolvedAt: new Date().toISOString(),
    snapshotVersion: 1,
    ...input,
  });

  const completedOf = (list: string[]): Record<string, Record<string, number>> =>
    Object.fromEntries(list.map((personId) => [personId, { once: 1 }]));

  const tasks: InspectionTask[] = [];
  const add = (
    input: Partial<InspectionTask> & Pick<InspectionTask, "id" | "title" | "kind">,
  ) => {
    const base: Omit<InspectionTask, "id" | "title" | "kind"> = {
      categories: [],
      origin: "demo",
      sourceId: "training_inspection",
      status: "active",
      version: 1,
      createdAt: addDays(week, -7),
      createdByName: "Sarah Lee",
      publishedAt: addDays(week, -3),
      startsOn: week,
      endsOn: addDays(week, 4),
      frequency: { unit: "once", count: 1 },
      targetCount: null,
      resources: [CONTENT.c1],
      additionalMinutes: 0,
      weight: "optional",
      audience: audience({ resolvedPersonIds: all }),
      owners: {
        hqOwnerId: "sarah",
        hqOwnerName: "Sarah Lee",
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
      reminder: { enabled: true, daysBefore: 1, channels: ["站内消息"] },
      reviewCadenceDays: null,
      results: {
        completed: {},
        scores: {},
        returnedAt: new Date().toISOString(),
        pushedAt: addDays(week, -3),
      },
      dataGaps: [],
      mergedIntoId: null,
      exceptionNote: "",
    };
    tasks.push({ ...base, ...input });
  };

  /* 总部任务：新品必修 + 每周练习，叠加在南区形成超容量 */
  add({
    id: "hq-product",
    categories: ["新品", "护肤"],
    title: "新品核心卖点与附加题",
    kind: "study",
    weight: "must",
    resources: [CONTENT.c1],
    additionalMinutes: 5,
    audience: audience({
      label: "全国直营门店 BA（北区 5 号店除外）",
      resolvedPersonIds: all.filter((id) => !north.slice(4).includes(id)),
      expectedCount: all.length,
    }),
    endsOn: addDays(week, 4),
    relations: {
      sameSourceTaskIds: ["south-study", "north-makeup"],
      prerequisiteTaskIds: [],
      exclusiveTaskIds: [],
      duplicateTaskIds: [],
      sequenceDefined: false,
    },
    results: {
      completed: completedOf([
        ...south,
        ...north.slice(0, 6),
        ...bali.slice(0, 6),
        ...surabaya.slice(0, 3),
      ]),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -3),
    },
  });

  add({
    id: "hq-practice",
    categories: ["新品", "护肤"],
    title: "全国新品场景每周通关",
    kind: "practice",
    weight: "must",
    resources: [CONTENT.s1],
    frequency: { unit: "weekly", count: 3 },
    startsOn: week,
    endsOn: addDays(nextWeek, 6),
    publishedAt: addDays(week, 2),
    audience: audience({ label: "全国直营门店 BA", resolvedPersonIds: all }),
    results: {
      completed: Object.fromEntries(all.map((id) => [id, { once: 2, [week]: 2 }])),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, 2),
    },
  });

  add({
    id: "hq-quote",
    categories: ["销售话术"],
    title: "金句·破冰三连每日背诵",
    kind: "practice",
    weight: "optional",
    resources: [CONTENT.q1],
    frequency: { unit: "daily", count: 1 },
    endsOn: addDays(week, 6),
    audience: audience({
      label: "全国门店服务岗",
      resolvedPersonIds: all,
    }),
    results: {
      completed: Object.fromEntries(
        all.map((id, index) => [
          id,
          Object.fromEntries([
            ...Array.from({ length: Math.max(0, daysBetween(week, today)) }, (_, day) => [
              addDays(week, day),
              1,
            ]),
            [today, index % 5 === 0 ? 0 : 1],
          ]),
        ]),
      ),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -3),
    },
  });

  add({
    id: "hq-exam-sensitive",
    categories: ["敏感肌", "护肤"],
    title: "敏感肌知识考试",
    kind: "exam",
    weight: "must",
    resources: [CONTENT.paper2],
    startsOn: week,
    endsOn: addDays(week, 2),
    audience: audience({
      label: "全国直营门店 BA",
      resolvedPersonIds: all,
      expectedCount: all.length,
    }),
    relations: {
      sameSourceTaskIds: ["next-hq"],
      prerequisiteTaskIds: [],
      exclusiveTaskIds: [],
      duplicateTaskIds: [],
      sequenceDefined: false,
    },
    results: {
      completed: completedOf(all.filter((_, index) => index % 5 !== 0)),
      scores: Object.fromEntries(
        all
          .filter((_, index) => index % 5 !== 0)
          .map((id, index) => [id, 70 + index]),
      ),
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -3),
    },
  });

  add({
    id: "hq-longterm",
    categories: ["服务力"],
    title: "服务力长期提升计划",
    kind: "study",
    weight: "optional",
    resources: [CONTENT.c3],
    frequency: { unit: "weekly", count: 2 },
    startsOn: week,
    endsOn: addDays(week, 120),
    audience: audience({ label: "全国直营门店 BA", resolvedPersonIds: all }),
    results: {
      completed: Object.fromEntries(
        all.map((id, index) => [id, { [week]: index % 3 === 0 ? 1 : 2 }]),
      ),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -3),
    },
  });

  /* 南区：与总部必修同源，叠加出超容量与重复安排 */
  add({
    id: "south-study",
    createdByName: "Fitriani",
    categories: ["新品", "护肤"],
    title: "南区新品卖点巩固",
    kind: "study",
    weight: "optional",
    resources: [CONTENT.c1],
    audience: audience({
      scope: "region",
      label: "南区所有门店 BA",
      regionIds: ["south"],
      resolvedPersonIds: [...south.slice(0, 9), north[0], north[1]],
      expectedCount: south.length,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "fitriani",
      regionOwnerName: "Fitriani",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    endsOn: addDays(week, 3),
    results: {
      completed: completedOf([...south.slice(0, 6), north[0]]),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -2),
    },
  });

  add({
    id: "south-exam",
    createdByName: "Fitriani",
    categories: ["新品", "护肤"],
    title: "南区新品通关考核",
    kind: "exam",
    weight: "must",
    resources: [CONTENT.paper1],
    version: 3,
    audience: audience({
      scope: "region",
      label: "南区所有门店 BA",
      regionIds: ["south"],
      // 第 3 版新增 2 名店员后名单没有重新生成，仍是第 2 版的 10 人。
      resolvedPersonIds: south.slice(0, 10),
      expectedCount: south.length,
      snapshotVersion: 2,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "fitriani",
      regionOwnerName: "Fitriani",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    endsOn: addDays(week, 3),
    relations: {
      sameSourceTaskIds: ["hq-product"],
      prerequisiteTaskIds: ["hq-product"],
      exclusiveTaskIds: [],
      duplicateTaskIds: [],
      sequenceDefined: true,
    },
    results: {
      completed: completedOf(south.slice(0, 4)),
      scores: Object.fromEntries(south.slice(0, 4).map((id, index) => [id, 78 + index])),
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -2),
    },
  });

  add({
    id: "south-drill",
    createdByName: "Fitriani",
    categories: ["异议处理"],
    title: "南区数字人剧本通关冲刺",
    kind: "practice",
    weight: "optional",
    resources: [CONTENT.av1],
    frequency: { unit: "weekly", count: 6 },
    audience: audience({
      scope: "region",
      label: "南区门店 BA",
      regionIds: ["south"],
      resolvedPersonIds: south,
      expectedCount: south.length,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "fitriani",
      regionOwnerName: "Fitriani",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    endsOn: addDays(week, 6),
    results: {
      completed: Object.fromEntries(
        south.map((id, index) => [id, { once: 6, [week]: index % 5 === 0 ? 4 : 6 }]),
      ),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -2),
    },
  });

  add({
    id: "south-vip",
    createdByName: "Fitriani",
    categories: ["异议处理", "新品"],
    title: "南区 VIP 顾客练习冲刺",
    kind: "practice",
    weight: "optional",
    resources: [CONTENT.s1],
    frequency: { unit: "weekly", count: 5 },
    audience: audience({
      scope: "region",
      label: "南区 VIP 顾客服务岗",
      regionIds: ["south"],
      resolvedPersonIds: south.slice(0, 3),
      expectedCount: 3,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "fitriani",
      regionOwnerName: "Fitriani",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    endsOn: addDays(week, 6),
    results: {
      completed: Object.fromEntries(south.slice(0, 3).map((id) => [id, { once: 3, [week]: 3 }])),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -2),
    },
  });

  add({
    id: "south-draft",
    createdByName: "Fitriani",
    categories: ["异议处理", "新品"],
    title: "南区新品直播演练",
    kind: "practice",
    weight: "optional",
    status: "draft",
    resources: [CONTENT.s2],
    frequency: { unit: "weekly", count: 2 },
    publishedAt: null,
    audience: audience({
      scope: "region",
      label: "南区所有门店 BA",
      regionIds: ["south"],
      resolvedPersonIds: south,
      expectedCount: south.length,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "fitriani",
      regionOwnerName: "Fitriani",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    endsOn: addDays(week, 6),
    results: { completed: {}, scores: {}, returnedAt: null, pushedAt: null },
  });

  /* 北区：补训、覆盖缺口与冲刺周练 */
  add({
    id: "north-makeup",
    createdByName: "Dewi",
    categories: ["新品", "彩妆"],
    title: "北区补训·新品卖点",
    kind: "study",
    weight: "makeup",
    resources: [CONTENT.c1],
    audience: audience({
      scope: "region",
      label: "北区新品达标补训",
      regionIds: ["north"],
      resolvedPersonIds: north.slice(0, 3),
      expectedCount: north.length,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "dewi",
      regionOwnerName: "Dewi",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    endsOn: addDays(week, 5),
    results: {
      completed: completedOf([north[0], north[1]]),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -1),
    },
  });

  add({
    id: "north-sprint",
    createdByName: "Dewi",
    categories: ["异议处理"],
    title: "北区冲刺周练",
    kind: "practice",
    weight: "optional",
    resources: [CONTENT.s2],
    frequency: { unit: "weekly", count: 6 },
    startsOn: addDays(week, 2),
    endsOn: addDays(week, 6),
    owners: {
      hqOwnerId: "",
      hqOwnerName: "",
      regionOwnerId: null,
      regionOwnerName: null,
      storeOwnerId: null,
      storeOwnerName: null,
    },
    audience: audience({
      scope: "region",
      label: "北区门店 BA 冲刺组",
      regionIds: ["north"],
      resolvedPersonIds: north.slice(3),
      expectedCount: north.length,
    }),
    reminder: null,
    results: {
      completed: Object.fromEntries(north.slice(3).map((id) => [id, { once: 4, [week]: 4 }])),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, 2),
    },
  });

  /* 巴厘岛：每日练习 + 资源类型不一致 */
  add({
    id: "bali-daily",
    createdByName: "Putri",
    categories: ["异议处理"],
    title: "巴厘岛顾客异议每日练习",
    kind: "practice",
    weight: "optional",
    resources: [CONTENT.s2],
    frequency: { unit: "daily", count: 1 },
    startsOn: week,
    endsOn: addDays(nextWeek, 6),
    audience: audience({
      scope: "region",
      label: "巴厘岛门店 BA",
      regionIds: ["bali"],
      resolvedPersonIds: bali,
      expectedCount: bali.length,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "putri",
      regionOwnerName: "Putri",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    results: {
      completed: Object.fromEntries(
        bali.map((id, index) => [
          id,
          Object.fromEntries(
            Array.from({ length: 7 }, (_, day) => [addDays(week, day), day < 6 - (index % 3 === 0 ? 1 : 0) ? 1 : 0]),
          ),
        ]),
      ),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -3),
    },
  });

  add({
    id: "bali-exam-prep",
    createdByName: "Putri",
    categories: ["新品", "护肤"],
    title: "巴厘岛考核前学习",
    kind: "study",
    weight: "optional",
    resources: [CONTENT.paper1],
    audience: audience({
      scope: "region",
      label: "巴厘岛门店 BA",
      regionIds: ["bali"],
      resolvedPersonIds: bali,
      expectedCount: bali.length,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "putri",
      regionOwnerName: "Putri",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    reminder: null,
    results: {
      completed: completedOf(bali.slice(0, 4)),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(week, -2),
    },
  });

  /* 泗水：缺少时长与频次的外部任务、剩余时间不足、完成率异常 */
  add({
    id: "surabaya-media",
    createdByName: "Rina",
    categories: ["服务力"],
    title: "泗水门店服务录音采集",
    kind: "media",
    weight: "makeup",
    resources: [CONTENT.media1],
    frequency: { unit: "weekly", count: 2 },
    audience: audience({
      scope: "region",
      label: "泗水门店 BA",
      regionIds: ["surabaya"],
      resolvedPersonIds: surabaya,
      expectedCount: surabaya.length,
    }),
    owners: {
      hqOwnerId: "",
      hqOwnerName: "",
      regionOwnerId: "rina",
      regionOwnerName: "Rina",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    results: { completed: {}, scores: {}, returnedAt: null, pushedAt: null },
  });

  add({
    id: "surabaya-practice",
    createdByName: "Rina",
    categories: ["异议处理"],
    title: "泗水每日异议打卡",
    kind: "practice",
    weight: "must",
    resources: [CONTENT.s2],
    frequency: { unit: "daily", count: 1 },
    targetCount: 14,
    startsOn: addDays(today, -5),
    endsOn: addDays(today, 1),
    audience: audience({
      scope: "region",
      label: "泗水门店 BA",
      regionIds: ["surabaya"],
      resolvedPersonIds: surabaya,
      expectedCount: surabaya.length,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "rina",
      regionOwnerName: "Rina",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    results: {
      completed: Object.fromEntries(
        surabaya.map((id, index) => [
          id,
          Object.fromEntries(
            [addDays(today, -1), today].map((day) => [day, index < 3 ? 1 : 0]),
          ),
        ]),
      ),
      scores: {},
      returnedAt: new Date().toISOString(),
      pushedAt: addDays(today, -6),
    },
  });

  /* 下周计划：发布前体检对象 */
  add({
    id: "next-hq",
    categories: ["敏感肌", "新品", "护肤"],
    title: "下周敏感肌新品必修",
    kind: "study",
    weight: "must",
    resources: [CONTENT.c2],
    startsOn: nextWeek,
    endsOn: addDays(nextWeek, 4),
    publishedAt: null,
    audience: audience({
      label: "全国直营门店 BA",
      resolvedPersonIds: all,
      expectedCount: all.length,
    }),
    reminder: null,
    results: { completed: {}, scores: {}, returnedAt: null, pushedAt: null },
  });

  add({
    id: "next-south",
    createdByName: "Fitriani",
    categories: ["服务力"],
    title: "下周南区服务跟进",
    kind: "study",
    weight: "optional",
    resources: [CONTENT.c3],
    startsOn: nextWeek,
    endsOn: addDays(nextWeek, 4),
    publishedAt: null,
    audience: audience({
      scope: "region",
      label: "南区所有门店 BA",
      regionIds: ["south"],
      resolvedPersonIds: south,
      expectedCount: south.length,
    }),
    owners: {
      hqOwnerId: "sarah",
      hqOwnerName: "Sarah Lee",
      regionOwnerId: "fitriani",
      regionOwnerName: "Fitriani",
      storeOwnerId: null,
      storeOwnerName: null,
    },
    results: { completed: {}, scores: {}, returnedAt: null, pushedAt: null },
  });

  const base: InspectionState = {
    schema: 2,
    seedVersion: INSPECTION_SEED_VERSION,
    revision: 1,
    regions,
    people,
    stores,
    tasks,
    policy: {
      version: 1,
      autoRunMinutes: 30,
      weeklyCapacityMinutes: 90,
      dailyLimitMinutes: 60,
      p90Ratio: 1.1,
      p90GapMinutes: 30,
      taskWeeklyLimitMinutes: 45,
      deadlineWindowDays: 4,
      deadlineTaskCount: 3,
      requiredCountPerDay: 1,
      audienceDeviationRatio: 0.2,
      completionRiskHours: 48,
      lowCompletionRate: 0.7,
      regionGapRatio: 1.3,
      longRunningDays: 90,
      concentrationRatio: 0.6,
      historyMultiplier: 1.5,
      observeOnly: true,
      observationStartedOn: today,
    },
    risks: [],
    exceptions: [],
    dispositions: [],
    inspectionRuns: [],
    auditRecords: [],
    auditSchedules: [],
    lastRunAt: null,
    sourceSyncedAt: {},
  };
  const scanned = runInspection(base, new Date(), [], { record: "none" });
  scanned.inspectionRuns = seedInspectionRuns(scanned);
  return scanned;
}

/* ------------------------------------------------------- 演示工作记录 */

/** 已解除的历史条目：演示「Agent 发现过、现在已经修好」的问题。 */
const SEED_RESOLVED: (InspectionRunChange & { taskId: string })[] = [
  {
    key: "seed:B4:north-makeup",
    ruleId: "B4",
    ruleName: "发布时间晚于有效周期起点",
    level: "medium",
    title: "北区补训·新品卖点 发布时间晚于周期起点",
    taskIds: ["north-makeup"],
    taskId: "north-makeup",
  },
  {
    key: "seed:E4:surabaya-practice",
    ruleId: "E4",
    ruleName: "已发布任务缺少提醒策略",
    level: "low",
    title: "泗水每日异议打卡 缺少提醒策略",
    taskIds: ["surabaya-practice"],
    taskId: "surabaya-practice",
  },
];

const snapshotOfRun = (risks: InspectionRisk[]): InspectionRunSnapshot => ({
  high: risks.filter((risk) => risk.level === "high").length,
  medium: risks.filter((risk) => risk.level === "medium").length,
  low: risks.filter((risk) => risk.level === "low").length,
  insufficient: risks.filter((risk) => risk.level === "insufficient").length,
});

const taskResultsOfRun = (risks: InspectionRisk[], taskIds: string[]) =>
  taskIds.map((taskId) => {
    const hit = risks
      .filter((risk) => risk.taskIds.includes(taskId))
      .sort(compareRisks);
    return {
      taskId,
      level: hit[0]?.level ?? null,
      ruleIds: [...new Set(hit.map((risk) => risk.ruleId))],
    };
  });

const changeOfRun = (risk: InspectionRisk): InspectionRunChange => ({
  key: risk.key,
  ruleId: risk.ruleId,
  ruleName: risk.ruleName,
  level: risk.level,
  title: risk.title,
  taskIds: risk.taskIds,
});

/**
 * 预置近 7 天的审计批次，让管理者打开页面就能看到 Agent 陆续审计了哪些任务。
 * 批次按时间顺序累积：后续批次的快照包含此前发现且仍未解除的问题。
 */
export function seedInspectionRuns(state: InspectionState): InspectionRunRecord[] {
  const today = inspectionDay();
  const week = weekStart(today);
  const risks = [
    ...evaluateRisks(state, [week, addDays(week, 7)], today),
  ].sort(compareRisks);
  const taskIds = inspectedTaskIds(state);
  const dataGapTaskCount = state.tasks.filter(
    (task) =>
      task.status !== "disabled" &&
      !task.mergedIntoId &&
      missingFields(task).length > 0,
  ).length;
  const at = (daysAgo: number, clock: string) =>
    new Date(`${addDays(today, -daysAgo)}T${clock}:00+07:00`).toISOString();
  const batches = [
    { daysAgo: 6, clock: "09:12", take: 3, resolved: [], escalated: false },
    { daysAgo: 4, clock: "09:05", take: 2, resolved: [], escalated: false },
    { daysAgo: 2, clock: "14:30", take: 1, resolved: [SEED_RESOLVED[0]], escalated: false },
    { daysAgo: 1, clock: "09:03", take: 1, resolved: [], escalated: true },
  ];
  let taken = 0;
  const seen = new Set<string>();
  return batches.map((batch, index) => {
    const added = risks
      .slice(taken, taken + batch.take)
      .map(changeOfRun)
      .filter((change) => {
        // 同一结论同时命中本周与下周时只记一条
        const signature = `${change.ruleId}|${change.title}`;
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
    const known = risks.slice(0, taken + batch.take);
    const resolved: InspectionRunChange[] = batch.resolved.map((item) => ({
      key: item.key,
      ruleId: item.ruleId,
      ruleName: item.ruleName,
      level: item.level,
      title: item.title,
      taskIds: item.taskIds,
    }));
    const snapshot = snapshotOfRun(known);
    taken += batch.take;
    const top = escalatedTopRisk(risks, batch.escalated);
    return {
      id: `seed-run-${index + 1}`,
      at: at(batch.daysAgo, batch.clock),
      lastSeenAt: at(batch.daysAgo, "18:20"),
      repeatCount: index === batches.length - 1 ? 5 : 12 - index * 3,
      trigger: "auto" as const,
      weeks: (() => {
        const batchWeek = weekStart(addDays(today, -batch.daysAgo));
        return [batchWeek, addDays(batchWeek, 7)];
      })(),
      taskIds,
      taskCount: taskIds.length,
      dataGapTaskCount,
      snapshot,
      taskResults: taskResultsOfRun(known, taskIds),
      added,
      resolved,
      levelChanged: top ? [top] : [],
      actorName: "审计 Agent",
      roleLabel: "自动审计",
    };
  });
}

function escalatedTopRisk(risks: InspectionRisk[], enabled: boolean) {
  if (!enabled) return null;
  const top = risks[0];
  if (!top || top.level === "medium") return null;
  return {
    key: top.key,
    ruleId: top.ruleId,
    title: top.title,
    from: "medium" as const,
    to: top.level,
  };
}
