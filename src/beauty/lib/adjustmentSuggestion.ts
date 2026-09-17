/**
 * 培训审计 · 任务调整建议（站内信草稿）
 *
 * 审计只给建议、不直接改任务：根据当前周期的审计结论和排期，
 * 生成一封发给任务创建者的站内信草稿。这里用本地规则模拟「模型生成」，
 * 接入真实模型时只替换 buildAdjustmentSuggestion 的实现。
 */

import {
  ROLE_LABELS,
  evaluateRisks,
  inspectionDay,
  taskOccurrenceMinutes,
  taskPeriods,
  weekStart,
} from "./inspectionEngine";
import { issuePhraseOf } from "./inspectionRequirements";
import type {
  InspectionRisk,
  InspectionState,
  InspectionTask,
} from "./inspectionTypes";

export interface AdjustmentRecipient {
  name: string;
  roleLabel: string;
}

export interface AdjustmentSuggestion {
  recipient: AdjustmentRecipient;
  title: string;
  intro: string;
  problems: string[];
  actions: string[];
  impact: string;
  note: string;
}

/** 收件人优先取任务创建人，其次落到对应层级的负责人。 */
export function taskCreatorOf(
  state: InspectionState,
  task: InspectionTask,
): AdjustmentRecipient {
  const created = task.createdByName
    ? state.people.find((person) => person.name === task.createdByName)
    : undefined;
  if (created)
    return {
      name: created.name,
      roleLabel: `${ROLE_LABELS[created.role]} · 任务创建者`,
    };
  if (task.createdByName) {
    const region = state.regions.find(
      (item) => item.ownerName === task.createdByName,
    );
    return {
      name: task.createdByName,
      roleLabel: region
        ? `${region.name}负责人 · 任务创建者`
        : "任务创建者",
    };
  }
  const owner =
    state.people.find((person) => person.id === task.owners.hqOwnerId) ??
    state.people.find((person) => person.id === task.owners.regionOwnerId);
  if (owner)
    return {
      name: owner.name,
      roleLabel: `${ROLE_LABELS[owner.role]} · 任务负责人`,
    };
  const fallback =
    task.owners.hqOwnerName || task.owners.regionOwnerName || "任务负责人";
  return { name: fallback, roleLabel: "任务负责人" };
}

/** 结论里的日期统一写成 09/20，避免出现「2026-09-20 单日负荷超过 …」。 */
const shortDates = (text: string) =>
  text.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$2/$3");

/** 规则标题 + 业务说法拼成一句人话；两段重复时只留一份。 */
function describeProblem(risk: InspectionRisk, phrase: string): string {
  const title = shortDates(risk.title);
  if (!phrase) return title;
  if (!title) return phrase;
  if (title.includes(phrase) || phrase.includes(title)) return title.length >= phrase.length ? title : phrase;
  return `${title} · ${phrase}`;
}

/** 按当前周期的结论生成一封调整建议（站内信草稿）。 */
export function buildAdjustmentSuggestion(
  state: InspectionState,
  task: InspectionTask,
  week = weekStart(inspectionDay()),
  today = inspectionDay(),
): AdjustmentSuggestion {
  const risks = evaluateRisks(state, [week], today)
    .filter((risk) => risk.taskIds.includes(task.id))
    .filter(
      (risk) =>
        (state.risks.find((record) => record.key === risk.key)?.status ??
          "待处理") !== "已解决",
    );
  const recipient = taskCreatorOf(state, task);

  const occurrences = taskPeriods(task, week);
  const occurrenceMinutes = taskOccurrenceMinutes(task);
  const weeklyMinutes =
    occurrenceMinutes === null
      ? null
      : occurrenceMinutes *
        occurrences.reduce((sum, period) => sum + period.count, 0);
  const affected = risks.reduce(
    (max, risk) => Math.max(max, risk.impact.affectedPeople),
    0,
  );

  // 同一类问题（例如都是「任务量超了」）只留最靠前的一条，避免车轱辘话
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const risk of risks) {
    const phrase = issuePhraseOf(risk);
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    problems.push(describeProblem(risk, phrase));
    if (problems.length === 3) break;
  }
  const actions = [
    ...new Set(risks.map((risk) => risk.suggestion).filter(Boolean)),
  ].slice(0, 3);
  if (!problems.length) problems.push("这一周没有命中问题，排期安排正常。");
  if (!actions.length)
    actions.push(
      "可以先保持现在的安排；下次审计如果发现问题再调整。",
    );

  const impactParts = [
    weeklyMinutes === null
      ? "缺预计时长，暂时算不出本周要花多少分钟"
      : `本周每人要做 ${weeklyMinutes} 分钟`,
    affected ? `涉及 ${affected} 人` : "",
  ].filter(Boolean);

  return {
    recipient,
    title: `关于「${task.title}」的调整建议`,
    intro: `审计发现这项任务${
      risks.length ? `有 ${risks.length} 个问题` : "本周没有问题"
    }，建议这样处理：`,
    problems,
    actions,
    impact: impactParts.join(" · "),
    note: "由审计 Agent 生成，供创建者参考；是否调整由创建者决定。",
  };
}
