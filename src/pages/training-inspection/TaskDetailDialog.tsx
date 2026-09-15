import React, { useEffect, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Mail,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  FREQUENCY_LABELS,
  KIND_LABELS,
  RESOURCE_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  WEIGHT_LABELS,
  missingFields,
  taskAudienceIds,
  taskOccurrenceMinutes,
  taskPeriods,
} from "../../lib/inspectionEngine";
import type {
  InspectionState,
  InspectionTask,
  TaskKind,
} from "../../lib/inspectionTypes";
import {
  buildAdjustmentSuggestion,
  type AdjustmentSuggestion,
} from "../../lib/adjustmentSuggestion";
import { Chip, KindBadge, jakartaStamp } from "./shared";

const dayLabel = (day: string) => day.slice(5).replace("-", "/");

const taskKindOf = (kind: TaskKind) => KIND_LABELS[kind];

const ownerText = (task: InspectionTask) => {
  const owners = [
    task.owners.hqOwnerName ? `总部 ${task.owners.hqOwnerName}` : "",
    task.owners.regionOwnerName ? `区域 ${task.owners.regionOwnerName}` : "",
    task.owners.storeOwnerName ? `门店 ${task.owners.storeOwnerName}` : "",
  ].filter(Boolean);
  return owners.length ? owners.join(" · ") : "未配置负责人";
};

/** 只读的任务详情：把任务本身的信息（含本周排期与执行情况）摊开给人看。 */
export function TaskDetailDialog({
  open,
  onOpenChange,
  state,
  task,
  week,
  onOpenSource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: InspectionState;
  task: InspectionTask | null;
  week: string;
  onOpenSource: (taskId: string) => void;
}) {
  /**
   * 调整建议流程（演示）：点「向创建者发送调整建议」→ 模拟模型生成站内信草稿
   * → 确认发送 → 展示「已发送」。真实接入时把生成换成模型调用、发送换成站内信接口。
   */
  type SendState = "idle" | "generating" | "preview" | "sent";
  const [sendState, setSendState] = useState<SendState>("idle");
  const [suggestion, setSuggestion] = useState<AdjustmentSuggestion | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setSendState("idle");
    setSuggestion(null);
    setSentAt(null);
  }, [open, task?.id]);

  const generateSuggestion = () => {
    if (!task) return;
    setSendState("generating");
    window.setTimeout(() => {
      setSuggestion(buildAdjustmentSuggestion(state, task, week));
      setSendState("preview");
    }, 650);
  };

  if (!task) return null;

  const periods = taskPeriods(task, week);
  const audience = taskAudienceIds(state, task) ?? [];
  const occurrenceMinutes = taskOccurrenceMinutes(task);
  const gaps = missingFields(task);
  const related = (ids: string[]) =>
    ids
      .map((id) => state.tasks.find((item) => item.id === id)?.title ?? id)
      .join("、");
  const relationRows = [
    { label: "同源内容", ids: task.relations.sameSourceTaskIds },
    { label: "前置任务", ids: task.relations.prerequisiteTaskIds },
    { label: "互斥任务", ids: task.relations.exclusiveTaskIds },
    { label: "重复任务", ids: task.relations.duplicateTaskIds },
  ].filter((row) => row.ids.length);
  const required = periods.reduce((sum, period) => sum + period.count, 0) * audience.length;
  const done = periods.reduce(
    (sum, period) =>
      sum +
      audience.reduce(
        (inner, personId) =>
          inner + Math.min(period.count, task.results.completed[personId]?.[period.key] ?? 0),
        0,
      ),
    0,
  );
  const completion = required ? Math.round((done / required) * 100) : null;
  const snapshotStale = task.audience.snapshotVersion < task.version;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inspection-modal max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <KindBadge kind={task.kind} />
            <span>{task.title}</span>
            <Chip tone="bg-muted text-muted-foreground ring-border">v{task.version}</Chip>
            {task.weight ? (
              <Chip tone="bg-secondary text-secondary-foreground ring-primary/20">
                {WEIGHT_LABELS[task.weight]}
              </Chip>
            ) : null}
            <Chip tone="bg-muted text-muted-foreground ring-border">
              {task.status === "active"
                ? "进行中"
                : task.status === "draft"
                  ? "草稿"
                  : task.status === "paused"
                    ? "已暂停"
                    : "已停用"}
            </Chip>
            {task.origin === "source" ? (
              <Chip tone="bg-sky-50 text-sky-700 ring-sky-200">外部接入</Chip>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[68vh] gap-3 overflow-y-auto pr-1 text-[12px]">
          {task.categories?.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">品类</span>
              {task.categories.map((category) => (
                <Chip
                  key={category}
                  tone="bg-indigo-50 text-indigo-700 ring-indigo-200"
                >
                  {category}
                </Chip>
              ))}
            </div>
          ) : null}

          {gaps.length ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-2 text-violet-800 ring-1 ring-violet-200">
              <span className="font-medium">这条任务缺信息：</span>
              {gaps.map((gap) => (
                <Chip key={gap.field} tone="bg-white text-violet-700 ring-violet-200">
                  {gap.field}
                </Chip>
              ))}
              <span>缺字段的部分只标「数据不足」，不参与负荷判定。</span>
            </div>
          ) : null}

          <div className="grid gap-2 rounded-lg bg-muted/40 px-3 py-2.5 sm:grid-cols-2">
            <Info label="任务类型" value={taskKindOf(task.kind)} />
            <Info label="负责人" value={ownerText(task)} />
            <Info
              label="开始 / 截止"
              value={`${task.startsOn || "未设置"} → ${task.endsOn || "未设置"}`}
            />
            <Info
              label="频次"
              value={
                task.frequency
                  ? `${FREQUENCY_LABELS[task.frequency.unit]} ${task.frequency.count} 次`
                  : "未配置"
              }
            />
            <Info
              label="单次时长"
              value={
                occurrenceMinutes === null
                  ? "缺预计时长"
                  : `${occurrenceMinutes} 分钟${
                      task.additionalMinutes ? `（含附加 ${task.additionalMinutes} 分钟）` : ""
                    }`
              }
            />
            <Info
              label="创建 / 发布"
              value={`${task.createdAt ? jakartaStamp(task.createdAt) : "—"} / ${
                task.publishedAt ? jakartaStamp(task.publishedAt) : "未发布"
              }`}
            />
            <Info
              label="下发范围"
              value={`${SCOPE_LABELS[task.audience.scope]} · ${task.audience.label}`}
            />
            <Info
              label="命中人数"
              value={`${audience.length} 人${
                task.audience.expectedCount !== null
                  ? `（预期 ${task.audience.expectedCount} 人）`
                  : ""
              }`}
            />
          </div>

          <section className="grid gap-1.5">
            <Title>本周排期</Title>
            {periods.length ? (
              <div className="flex flex-wrap gap-1.5">
                {periods.map((period) => (
                  <Chip
                    key={`${period.key}-${period.day}`}
                    tone="bg-muted text-muted-foreground ring-border"
                  >
                    {dayLabel(period.day)} · {period.count} 次 ·{" "}
                    {occurrenceMinutes === null
                      ? "缺时长"
                      : `${occurrenceMinutes * period.count} 分钟`}
                  </Chip>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">这一周没有排期。</span>
            )}
          </section>

          <section className="grid gap-1.5">
            <Title>内容资源</Title>
            {task.resources.length ? (
              <div className="grid gap-1">
                {task.resources.map((resource) => (
                  <div key={resource.id} className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="bg-muted text-muted-foreground ring-border">
                      {RESOURCE_LABELS[resource.type]}
                    </Chip>
                    <span>{resource.name}</span>
                    <span className="text-muted-foreground">
                      {resource.minutes === null
                        ? "缺预计时长"
                        : `${resource.minutes} 分钟`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">没有关联内容资源。</span>
            )}
          </section>

          <section className="grid gap-1.5">
            <Title>关联任务</Title>
            {relationRows.length ? (
              <div className="grid gap-1">
                {relationRows.map((row) => (
                  <div key={row.label} className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="bg-muted text-muted-foreground ring-border">
                      {row.label}
                    </Chip>
                    <span>{related(row.ids)}</span>
                  </div>
                ))}
                {!task.relations.sequenceDefined ? (
                  <span className="text-muted-foreground">
                    没有声明完成顺序。
                  </span>
                ) : (
                  <span className="text-muted-foreground">已声明完成顺序。</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">没有关联任务。</span>
            )}
          </section>

          <section className="grid gap-1.5">
            <Title>执行情况</Title>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              <span>
                本周应完成 {required} 次 · 已完成 {done} 次
                {completion !== null ? `（${completion}%）` : ""}
              </span>
              <span>
                完成回传：
                {task.results.returnedAt
                  ? jakartaStamp(task.results.returnedAt)
                  : "没有回传"}
              </span>
              <span>
                推送记录：
                {task.results.pushedAt ? jakartaStamp(task.results.pushedAt) : "没有推送"}
              </span>
              {task.kind === "exam" ? (
                <span>
                  成绩：{Object.keys(task.results.scores).length
                    ? `${Object.keys(task.results.scores).length} 人有成绩`
                    : "暂无成绩"}
                </span>
              ) : null}
            </div>
          </section>

          <section className="grid gap-1.5">
            <Title>人员名单</Title>
            {audience.length ? (
              <span className="text-muted-foreground">
                {audience.slice(0, 8).map((id) => personNameOf(state, id)).join("、")}
                {audience.length > 8 ? ` 等 ${audience.length} 人` : ""}
                {snapshotStale
                  ? ` · 名单是 v${task.audience.snapshotVersion} 生成的，任务已经是 v${task.version}`
                  : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">没有逐人分配，只按人群策略下发。</span>
            )}
          </section>

          {sendState === "generating" ? (
            <section className="grid gap-1.5 rounded-lg bg-secondary/60 px-3 py-2.5 ring-1 ring-primary/15">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Loader2 size={13} className="animate-spin" /> Agent 正在根据巡检结论生成调整建议…
              </span>
              <span className="text-[11px] text-muted-foreground">
                会带上这项任务当前的问题、建议动作和影响范围。
              </span>
            </section>
          ) : null}

          {sendState === "preview" && suggestion ? (
            <section className="grid gap-2 rounded-lg bg-secondary/60 px-3 py-2.5 ring-1 ring-primary/15">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground">
                  <Sparkles size={13} /> 站内信草稿（点发送后走「消息中心 › 我的消息」）
                </span>
                <Chip tone="bg-white text-secondary-foreground ring-primary/20">
                  收件人 {suggestion.recipient.name}（{suggestion.recipient.roleLabel}）
                </Chip>
              </div>
              <span className="text-[12px] font-medium text-foreground">
                {suggestion.title}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                {suggestion.intro}
              </span>
              <ul className="grid gap-1 text-[11.5px]">
                {suggestion.problems.map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <span className="text-[11.5px] font-medium text-foreground">
                建议动作
              </span>
              <ul className="grid gap-1 text-[11.5px]">
                {suggestion.actions.map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <span className="text-[11px] text-muted-foreground">
                {suggestion.impact} · {suggestion.note}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Button size="sm" onClick={() => {
                  setSentAt(new Date().toISOString());
                  setSendState("sent");
                }}>
                  <Send size={13} /> 发送站内信
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSuggestion(null);
                    setSendState("idle");
                  }}
                >
                  先不发
                </Button>
              </span>
            </section>
          ) : null}

          {sendState === "sent" && suggestion && sentAt ? (
            <section className="grid gap-1.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-emerald-900 ring-1 ring-emerald-200">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                <Mail size={13} /> 已发送站内信给 {suggestion.recipient.name}（
                {suggestion.recipient.roleLabel}）· {jakartaStamp(sentAt)}
              </span>
              <span className="text-[11.5px]">
                「{suggestion.title}」已进入「消息中心 › 我的消息」（原型演示，不真的发送）。
              </span>
              <span className="flex items-center gap-1.5 pt-0.5">
                <Button size="sm" variant="outline" onClick={() => setSendState("idle")}>
                  知道了
                </Button>
              </span>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
            <span className="text-[11px] text-muted-foreground">
              {task.origin === "source"
                ? `来源：${task.sourceId}`
                : "来源：演示任务"}
            </span>
            <span className="flex items-center gap-1.5">
              {task.origin === "source" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenSource(task.id)}
                >
                  <ExternalLink size={13} /> 打开原任务
                </Button>
              ) : null}
              {sendState === "idle" ? (
                <Button size="sm" onClick={generateSuggestion}>
                  <Send size={13} /> 向创建者发送调整建议
                </Button>
              ) : null}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const personNameOf = (state: InspectionState, personId: string) => {
  const person = state.people.find((item) => item.id === personId);
  if (!person) return personId;
  const store = state.stores.find((item) => item.id === person.storeId)?.name;
  return `${person.name}（${ROLE_LABELS[person.role]}${store ? ` · ${store}` : ""}）`;
};

function Title({ children }: { children: React.ReactNode; key?: React.Key }) {
  return <div className="text-[11.5px] font-semibold text-foreground">{children}</div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode; key?: React.Key }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
