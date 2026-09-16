import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Database,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import type { Role } from "../types";
import {
  ACTION_LABELS,
  LEVEL_LABELS,
  addDays,
  applyDisposition,
  canSeeRegion,
  decideException,
  evaluateRisks,
  inspectionDay,
  missingFields,
  overviewSummary,
  runInspection,
  weekStart,
} from "../lib/inspectionEngine";
import {
  getInspectionStorageError,
  setInspectionState,
  useInspectionState,
} from "../lib/inspectionStore";
import type {
  DispositionAction,
  DispositionInput,
  InspectionRisk,
  TaskPatch,
} from "../lib/inspectionTypes";
import { RegionBurdenTab } from "./training-inspection/RegionBurdenTab";
import { RequirementTab } from "./training-inspection/RequirementTab";
import {
  requirementDue,
  requirementHasUnreadRun,
  requirementStatusOf,
  requirementVisibleTo,
  runRequirement,
  STATUS_LABELS,
  type InspectionRequirement,
} from "../lib/inspectionRequirements";
import {
  deleteRequirement,
  markRequirementViewed,
  updateRequirement,
  useRequirements,
} from "../lib/requirementStore";
import { DispositionDialog } from "./training-inspection/DispositionDialog";
import { OverviewTab } from "./training-inspection/OverviewTab";
import { SimulationDialog } from "./training-inspection/SimulatePanel";
import { Chip, actorForRole, scopeRisk } from "./training-inspection/shared";
import "./TrainingInspection.css";

const tabs = [
  { id: "overview", label: "审计工作台", icon: Activity },
  { id: "checkup", label: "区域工时审计", icon: Layers },
] as const;

const sourceTabs: Record<string, string> = {
  study: "study_task_manage",
  practice: "practice_task_manage",
  exam: "exam_task_manage",
  media: "media_collection_manage",
};

export function TrainingInspection({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate: (tab: string) => void;
}) {
  const state = useInspectionState();
  const actor = useMemo(() => actorForRole(role), [role]);
  const today = inspectionDay();
  const currentWeek = weekStart(today);
  /** 固定两个 tab，加上用户自己创建的自定义审计 tab（id 就是需求 id）。 */
  const [tab, setTab] = useState<string>("overview");
  const requirements = useRequirements();
  const [removeRequirement, setRemoveRequirement] =
    useState<InspectionRequirement | null>(null);
  const [week, setWeek] = useState(currentWeek);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [simulateTask, setSimulateTask] = useState<{
    taskId: string;
    patch?: TaskPatch;
  } | null>(null);
  const [dispose, setDispose] = useState<{
    taskId: string;
    riskKey?: string;
    patch?: TaskPatch;
    action?: DispositionAction;
  } | null>(null);
  const [dataGapsOpen, setDataGapsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedTaskId(null);
  }, [actor]);

  /** 当前账号看得到的自定义审计：总部看全部，区域账号看本区域与全国需求。 */
  const visibleRequirements = useMemo(
    () => requirements.filter((item) => requirementVisibleTo(item, actor)),
    [requirements, actor],
  );

  /** 到点自动补跑一期：打开页面时执行一次，同一天不会重复记账。 */
  useEffect(() => {
    const now = new Date();
    for (const requirement of requirements) {
      if (requirementDue(requirement, now))
        updateRequirement(runRequirement(state, requirement, now, "auto"));
    }
  }, [requirements, state]);

  /** 打开自定义审计 tab 就算看过了，小圆点消失。 */
  useEffect(() => {
    if (tab === "overview" || tab === "checkup") return;
    const target = visibleRequirements.find((item) => item.id === tab);
    if (!target) return;
    const latest = target.runs.at(-1);
    if (latest) markRequirementViewed(target.id, latest.lastSeenAt);
  }, [tab, visibleRequirements]);

  /** 需求被删掉或角色切换看不到时，回到审计总览。 */
  useEffect(() => {
    if (tab === "overview" || tab === "checkup") return;
    if (!visibleRequirements.some((item) => item.id === tab)) setTab("overview");
  }, [tab, visibleRequirements]);

  useEffect(() => {
    setInspectionState((previous) =>
      runInspection(previous, new Date(), [week], {
        record: "auto",
        actorName: actor.name,
        roleLabel: actor.roleLabel,
      }),
    );
  }, [week, actor]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  /** 当前角色可见的审计结论，不做界面筛选（筛选在各区块内完成）。 */
  const risks = useMemo(() => {
    return evaluateRisks(state, [week], today)
      .map((risk) => scopeRisk(risk, actor, state))
      .filter((risk) =>
        risk.regionIds.length
          ? risk.regionIds.some((id) => canSeeRegion(actor, id))
          : true,
      );
  }, [state, week, today, actor]);

  const summary = useMemo(
    () => overviewSummary(state, week, today),
    [state, week, today],
  );

  const scan = () => {
    setBusy(true);
    window.setTimeout(() => {
      setInspectionState((previous) =>
        runInspection(previous, new Date(), [week], {
          record: "manual",
          actorName: actor.name,
          roleLabel: actor.roleLabel,
        }),
      );
      setBusy(false);
      setMessage("审计完成，已写入一条新记录。");
    }, 320);
  };

  const openSimulate = (risk: InspectionRisk, patch?: TaskPatch) => {
    const taskId = risk.taskIds[0];
    if (!taskId) {
      setMessage("这条结论没有对应任务，请到区域负担里选。");
      return;
    }
    setSimulateTask({ taskId, patch });
  };

  const openDisposition = (
    taskId: string,
    riskKey?: string,
    patch?: TaskPatch,
    action?: DispositionAction,
  ) => {
    setDispose({ taskId, riskKey, patch, action });
  };

  const submitDisposition = (input: DispositionInput) => {
    const updated = applyDisposition(state, actor, input);
    setInspectionState(updated);
    const record = updated.dispositions.at(-1)!;
    setMessage(
      `处置已记录：${record.actorName} · ${ACTION_LABELS[record.action]} · 任务 v${record.taskVersionBefore} → v${record.taskVersionAfter}；${record.recheck.summary}`,
    );
    return `${record.recheck.summary}（操作人 ${record.actorName}，原始版本 v${record.taskVersionBefore}）`;
  };

  const decide = (exceptionId: string, approve: boolean, note: string) => {
    try {
      setInspectionState(decideException(state, actor, exceptionId, approve, note));
      setMessage(approve ? "例外已批准，风险状态更新为例外生效。" : "例外已驳回。");
      return "";
    } catch (error) {
      setMessage((error as Error).message);
      return (error as Error).message;
    }
  };

  const openSourceTask = (taskId: string) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const target = sourceTabs[task.kind];
    if (target) {
      onNavigate(target);
      setMessage(`已打开「${task.title}」原任务页。`);
    }
  };

  /** 打开「区域负担」里对应的任务：切到该页并自动定位、高亮。 */
  const focusTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setTab("checkup");
  };

  const exportBrief = () => {
    const latest = state.inspectionRuns.at(-1);
    const openRisks = risks.filter(
      (risk) =>
        (state.risks.find((record) => record.key === risk.key)?.status ??
          "待处理") !== "已解决",
    );
    const taskLevelOf = (taskId: string) => {
      const hit = risks.filter((risk) => risk.taskIds.includes(taskId));
      if (!hit.length) return "未命中规则";
      const worst = hit.sort(
        (a, b) =>
          ["high", "medium", "low", "insufficient"].indexOf(a.level) -
          ["high", "medium", "low", "insufficient"].indexOf(b.level),
      )[0];
      return `${LEVEL_LABELS[worst.level]}（${hit
        .map((risk) => risk.ruleId)
        .join("、")}）`;
    };
    const lines = [
      `SalesBoost AI 数据审计留档（模拟数据）`,
      `生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Jakarta" })} · 周期 ${week} ~ ${addDays(week, 6)}`,
      `策略 v${state.policy.version} · 数据 v${state.revision} · 批次 ${state.inspectionRuns.length} 条`,
      "",
      `一、最近一次审计`,
      latest
        ? `${latest.at.slice(0, 16).replace("T", " ")} ${latest.trigger === "manual" ? "手动审计" : "自动审计"} · 覆盖 ${latest.taskCount} 项任务 · 高风险 ${latest.snapshot.high}、中风险 ${latest.snapshot.medium}、低风险 ${latest.snapshot.low}、数据不足 ${latest.snapshot.insufficient}${
            latest.repeatCount > 1 ? ` · 结论未变化，连续审计 ${latest.repeatCount} 次` : ""
          }`
        : "尚未产生审计批次",
      "",
      `二、审计批次记录`,
      ...(state.inspectionRuns.length
        ? [...state.inspectionRuns].reverse().flatMap((record) => [
            `${record.at.slice(0, 16).replace("T", " ")} ${record.trigger === "manual" ? "手动审计" : "自动审计"}（${record.actorName} / ${record.roleLabel}）· 覆盖 ${record.taskCount} 项任务 · 风险 高${record.snapshot.high}/中${record.snapshot.medium}/低${record.snapshot.low}/数据不足${record.snapshot.insufficient}`,
            `   新增 ${record.added.length} 项、解除 ${record.resolved.length} 项、等级变化 ${record.levelChanged.length} 项`,
            ...record.added.map((change) => `   + ${change.ruleId} ${change.ruleName}：${change.title}`),
            ...record.resolved.map((change) => `   - ${change.ruleId} ${change.ruleName}：${change.title}`),
            ...record.levelChanged.map(
              (change) => `   ~ ${change.ruleId}：${LEVEL_LABELS[change.from]} → ${LEVEL_LABELS[change.to]}：${change.title}`,
            ),
          ])
        : ["暂无审计批次"]),
      "",
      `三、任务覆盖清单`,
      ...state.tasks
        .filter((task) => task.status !== "disabled" && !task.mergedIntoId)
        .map(
          (task) =>
            `${task.title}（${task.origin === "source" ? "外部接入" : "演示任务"}·v${task.version}）· 负责人 ${task.owners.regionOwnerName || task.owners.hqOwnerName || "未配置"} · 结论 ${taskLevelOf(task.id)}${missingFields(task).length ? ` · 缺少${missingFields(task).map((gap) => gap.field).join("、")}` : ""}`,
        ),
      "",
      `四、风险明细（按优先级）`,
      ...(openRisks.length
        ? openRisks.map(
            (risk, index) =>
              `${index + 1}. [${LEVEL_LABELS[risk.level]} / ${risk.ruleId} ${risk.ruleName}] ${risk.title}\n   结论：${risk.conclusion}\n   原因：${risk.reason}\n   证据：${risk.evidence.map((item) => `${item.text}（${item.ref}）`).join("；")}\n   建议：${risk.suggestion}\n   影响：${risk.impact.text}\n   需要确认：${risk.confirmation ? `${risk.confirmation.name}（${risk.confirmation.roleLabel}）` : "无"}`,
          )
        : ["本周期没有命中风险规则"]),
      "",
      `五、数据完整度`,
      ...(summary.missingGroups.length
        ? summary.missingGroups.map(
            (group) => `缺少${group.field}：${group.tasks} 项任务`,
          )
        : ["所有任务字段齐全"]),
      "",
      `六、处置记录（附）`,
      ...(state.dispositions.length
        ? state.dispositions.map(
            (record) =>
              `${record.id} ${record.at.slice(0, 16).replace("T", " ")} ${record.actorName} ${ACTION_LABELS[record.action]} ${record.taskTitle} v${record.taskVersionBefore}→v${record.taskVersionAfter}：${record.reason}｜预期影响 ${record.expectedImpact}｜复查 ${record.recheck.summary}`,
          )
        : ["暂无处置记录"]),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    const fileName = `数据审计留档-${week}.txt`;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`工作记录已导出：${fileName}（浏览器默认下载目录）。`);
  };

  const weekLabel = `${week.slice(5).replace("-", "/")} - ${addDays(week, 6).slice(5).replace("-", "/")}`;
  const sourceTasks = state.tasks.filter((task) => task.origin === "source");

  return (
    <div className="inspection-workspace" data-i18n-skip="true">
      <div className="inspection-heading">
        <div>
          <div className="inspection-eyebrow">
            <ShieldCheck size={14} /> DATA AUDIT AGENT
          </div>
          <h1>数据审计</h1>
          <p>
            Agent 用工具核对任务、人群、工时与规则口径，每条结论都带数据出处；有疑问直接在下面问它。
          </p>
        </div>
        <div className="inspection-actions wrap">
          <div className="inspection-actions">
            <span className="inspection-actions-label" title="总览与区域负担的数字都按这一周统计">
              统计周期
            </span>
            <button
              type="button"
              className="inspection-icon"
              onClick={() => setWeek(addDays(week, -7))}
              aria-label="上一周"
              title="看上一周"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              className="inspection-button"
              onClick={() => setWeek(currentWeek)}
              title="结论文数与分钟都按这一周统计；点一下回到本周"
            >
              <CalendarDays size={14} /> {weekLabel}
            </button>
            <button
              type="button"
              className="inspection-icon"
              onClick={() => setWeek(addDays(week, 7))}
              aria-label="下一周"
              title="看下一周"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            type="button"
            className="inspection-button"
            onClick={() => setDataGapsOpen(true)}
            title="这些数据从学习 / 练习 / 考试 / 采集任务页同步过来；缺哪些字段、去哪个页面补齐都列在里面，缺字段只标「数据不足」，不算违规"
          >
            <Database size={14} /> 数据源与口径
          </button>
          <button
            type="button"
            className="inspection-button"
            onClick={exportBrief}
            title="把这一周的审计留档（批次、任务清单、结论明细、处置记录）下载成 txt 文件"
          >
            <Download size={14} /> 导出审计留档
          </button>
          <button
            type="button"
            className="inspection-button primary"
            onClick={scan}
            disabled={busy}
          >
            <RefreshCw size={14} className={busy ? "inspection-spin" : ""} />
            {busy ? "审计中" : "运行审计"}
          </button>
        </div>
      </div>

      {/* 最近审计信息在「最近一次审计」卡片右上角；这里只在本地存档异常时提醒 */}
      {getInspectionStorageError() ? (
        <div className="inspection-runbar">
          <span>
            <span className="inspection-live" />
            <Chip tone="bg-amber-50 text-amber-700 ring-amber-200">
              {getInspectionStorageError()}
            </Chip>
          </span>
        </div>
      ) : null}

      <div className="inspection-tabs" role="tablist">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`inspection-tab ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
        {visibleRequirements.map((item) => {
          const active = tab === item.id;
          const unread = requirementHasUnreadRun(item);
          const status = requirementStatusOf(item);
          return (
            <span
              key={item.id}
              className={`inspection-tab-group ${active ? "active" : ""}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={`inspection-tab inspection-tab-custom ${active ? "active" : ""}`}
                title={`${item.name} · ${STATUS_LABELS[status]}`}
                onClick={() => setTab(item.id)}
              >
                <Sparkles size={14} />
                {item.name}
                {unread ? (
                  <span className="inspection-tab-dot" aria-label="有新记录" />
                ) : null}
              </button>
              <button
                type="button"
                className="inspection-tab-close"
                aria-label={`关闭 ${item.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setRemoveRequirement(item);
                }}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      {message ? <div className="inspection-toast">{message}</div> : null}

      <div className="inspection-body">
        {tab === "overview" ? (
          <OverviewTab
            state={state}
            actor={actor}
            week={week}
            today={today}
            risks={risks}
            onOpenTask={openSourceTask}
            onFocusTask={focusTask}
            onCreatedRequirement={(id) => setTab(id)}
            onToast={setMessage}
          />
        ) : null}
        {visibleRequirements.map((item) =>
          tab === item.id ? (
            <RequirementTab
              key={item.id}
              state={state}
              actor={actor}
              requirement={item}
              week={week}
              today={today}
              onFocusTask={focusTask}
              onOpenTask={openSourceTask}
              onDeleted={() => {
                setTab("overview");
                setMessage(`已删除自定义审计「${item.name}」。`);
              }}
            />
          ) : null,
        )}
        {tab === "checkup" ? (
          <RegionBurdenTab
            state={state}
            actor={actor}
            week={week}
            today={today}
            selectedTaskId={selectedTaskId}
            onDispose={openDisposition}
            onOpenTask={openSourceTask}
          />
        ) : null}
      </div>

      {simulateTask ? (
        <SimulationDialog
          open
          onOpenChange={(open) => !open && setSimulateTask(null)}
          state={state}
          actor={actor}
          task={state.tasks.find((task) => task.id === simulateTask.taskId)!}
          week={week}
          today={today}
          initialPatch={simulateTask.patch}
          onOpenDisposition={(patch, summary) => {
            setDispose({
              taskId: simulateTask.taskId,
              patch,
              action: "adjust-task",
            });
            setMessage(`模拟完成：${summary} · 请填写调整原因后提交处置。`);
          }}
        />
      ) : null}

      <DispositionDialog
        open={!!dispose}
        onOpenChange={(open) => !open && setDispose(null)}
        state={state}
        actor={actor}
        taskId={dispose?.taskId ?? null}
        riskKey={dispose?.riskKey}
        initialAction={dispose?.action}
        initialPatch={dispose?.patch}
        onSubmit={submitDisposition}
        onDecideException={decide}
      />

      <Dialog
        open={!!removeRequirement}
        onOpenChange={(open) => !open && setRemoveRequirement(null)}
      >
        <DialogContent className="inspection-modal max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} /> 关掉这个审计？
            </DialogTitle>
          </DialogHeader>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            关闭后「{removeRequirement?.name}」的标签页会消失，运行记录一起删掉。
            如果只是想让它先别跑，点进这个 tab 用「暂停」更合适。
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="inspection-button"
              onClick={() => setRemoveRequirement(null)}
            >
              先留着
            </button>
            <button
              type="button"
              className="inspection-button primary"
              onClick={() => {
                if (removeRequirement) {
                  deleteRequirement(removeRequirement.id);
                  setMessage(`已删除自定义审计「${removeRequirement.name}」。`);
                  if (tab === removeRequirement.id) setTab("overview");
                }
                setRemoveRequirement(null);
              }}
            >
              删除这个审计
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dataGapsOpen} onOpenChange={setDataGapsOpen}>
        <DialogContent className="inspection-modal max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database size={16} /> 数据来源
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[64vh] gap-3 overflow-y-auto pr-1 text-[12px]">
            <p className="text-muted-foreground">
              任务页新建或修改后会自动同步到这里；下面列出同步过来的任务和缺的字段，缺字段只提示「数据不足」，不算违规。
            </p>
            <div className="grid gap-2">
              {sourceTasks.length ? (
                sourceTasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid gap-1 rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {task.title}
                      </span>
                      <button
                        type="button"
                        className="inspection-link"
                        onClick={() => {
                          setDataGapsOpen(false);
                          openSourceTask(task.id);
                        }}
                      >
                        打开原任务
                      </button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      缺少：{missingFields(task).map((gap) => gap.field).join("、")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
                  没有外部接入任务。
                </div>
              )}
            </div>
            <div className="grid gap-1.5 rounded-lg bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
              <span>缺字段的任务会在「区域负担」里标成「缺时长」，不计入判定。</span>
              <span>口径：预计分钟 = 内容时长 × 次数。</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
