import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, CornerDownLeft, Loader2, Plus, User } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  AGENT_PRESET_QUESTIONS,
  answerInspectionQuestion,
  type AgentAnswer,
} from "../../lib/inspectionAgent";
import { addDays, canSeeRegion, inspectionDay } from "../../lib/inspectionEngine";
import {
  ASPECT_HINTS,
  ASPECT_LABELS,
  CADENCE_LABELS,
  CREATE_REQUIREMENT_PROMPT,
  REQUIREMENT_ASPECTS,
  REQUIREMENT_NAME_LIMIT,
  aspectLabelOf,
  defaultRequirementName,
  describeRequirement,
  matchRequirementIntent,
  normalizeRequirementName,
  parseAspectsFromText,
  parseCadenceFromText,
  parseCategoriesFromText,
  parsePeriodFromText,
  parseRegionFromText,
  parseReplyCommand,
  requirementCategories,
  type RequirementAspect,
  type RequirementCadence,
} from "../../lib/inspectionRequirements";
import { createRequirement } from "../../lib/requirementStore";
import { setInspectionState } from "../../lib/inspectionStore";
import type { InspectionActor, InspectionState } from "../../lib/inspectionTypes";
import { SectionHeading } from "./shared";

interface ChatOption {
  label: string;
  value: string;
  hint?: string;
}

type WizardStep =
  | "aspects"
  | "category"
  | "scope"
  | "cadence"
  | "period"
  | "confirm";
type PeriodPreset = "long" | "weeks4" | "custom";

interface WizardDraft {
  aspects: RequirementAspect[];
  categories: string[];
  regionId: string | null;
  cadence: RequirementCadence;
  period: PeriodPreset;
  startsOn: string;
  endsOn: string | null;
  name: string;
}

interface WizardState {
  step: WizardStep;
  draft: WizardDraft;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  answer?: AgentAnswer;
  pending?: boolean;
  /** 创建向导：这一步的可选按钮与步骤名。 */
  options?: ChatOption[];
  wizardStep?: WizardStep;
}

const ASPECT_QUESTION =
  "先确认这次审计要盯哪些方面？可以点下面的按钮多选，也可以直接打字说（例如「重复布置和时间集中」或「都要」）。";
const CATEGORY_QUESTION =
  "要看哪些品类？可以多选，也可以直接打字，例如「新品和敏感肌」或「都要」。";
const SCOPE_QUESTION =
  "审计范围定在哪里？可以点下面的区域，也可以直接打字，例如「南区」或「全国」。";
const CADENCE_QUESTION =
  "多久自动跑一次？每天 / 每周一 / 每月 1 日都可以，直接打字说也一样。";
const PERIOD_QUESTION =
  "从什么时候开始、跑到什么时候？可以选下面的，也可以直接打字，例如「从今天起连续 4 周」「9 月 20 日到 12 月 31 日」。";
const CONFIRM_QUESTION = "确认一下，没问题我现在就创建，回复「确认」也行。";

/** 每一步输入框的提示语：选项之外，用户也可以自己说。 */
const WIZARD_PLACEHOLDER: Record<WizardStep, string> = {
  aspects: "也可以打字：例如「重复布置和时间集中」或「都要」",
  category: "也可以打字：例如「新品」「敏感肌」「都要」",
  scope: "也可以打字：例如「南区」「全国」",
  cadence: "也可以打字：例如「每天」「每周一」「每月 1 日」",
  period: "也可以打字：例如「从今天起连续 4 周」「9 月 20 日到 12 月 31 日」",
  confirm: "回复「确认」直接创建，也可以说「返回修改」",
};

const ASPECT_OPTIONS: ChatOption[] = [
  ...REQUIREMENT_ASPECTS.map((aspect) => ({
    label: ASPECT_LABELS[aspect],
    value: aspect,
    hint: ASPECT_HINTS[aspect],
  })),
  { label: "以上都要", value: "all" },
];
const CADENCE_OPTIONS: ChatOption[] = (
  ["daily", "weekly", "monthly"] as RequirementCadence[]
).map((cadence) => ({ label: CADENCE_LABELS[cadence], value: cadence }));
const PERIOD_OPTIONS: ChatOption[] = [
  { label: "从今天开始 · 长期", value: "long" },
  { label: "从今天开始 · 连续 4 周", value: "weeks4" },
  { label: "自定义起止日期", value: "custom" },
];

/**
 * 首屏对话 Agent：普通问答走 answerInspectionQuestion；
 * 「新建一个审计需求」进入选项式反问向导，四步问完就能建 tab。
 */
export function AgentPanel({
  state,
  actor,
  onFocusTask,
  onCreatedRequirement,
}: {
  state: InspectionState;
  actor: InspectionActor;
  onFocusTask: (taskId: string) => void;
  onCreatedRequirement: (id: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  /** 数据里出现过的品类，作为「包含特定品类」那一步的选项。 */
  const categoryOptions = useMemo<ChatOption[]>(
    () =>
      requirementCategories(state, actor).map((item) => ({
        label: item.name,
        value: item.name,
        hint: `${item.taskCount} 项任务涉及这个品类`,
      })),
    [state, actor],
  );

  const visibleRegions = useMemo(
    () => state.regions.filter((region) => canSeeRegion(actor, region.id)),
    [state.regions, actor],
  );

  /**
   * 这一步之后还有哪些步骤：选了「包含特定品类」就多问一步品类；
   * 总部才问范围，区域账号只看得到本区域，范围直接定死。
   */
  const stepsFor = (draft: WizardDraft): WizardStep[] => {
    const steps: WizardStep[] = ["aspects"];
    if (draft.aspects.includes("category") && categoryOptions.length)
      steps.push("category");
    if (actor.hq) steps.push("scope");
    steps.push("cadence", "period");
    return steps;
  };

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const pushUser = (text: string) =>
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}-${current.length}`, role: "user", text },
    ]);

  const pushAgent = (text: string) =>
    setMessages((current) => [
      ...current,
      { id: `agent-${Date.now()}-${current.length}`, role: "agent", text },
    ]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    // 创建向导进行中：把用户打的字当成这一步的回答，先用本地规则解析
    if (wizard) {
      handleWizardText(text);
      return;
    }
    // 说「新建 / 创建一个审计」就进创建向导，其他问题照旧走问答
    if (
      text === CREATE_REQUIREMENT_PROMPT ||
      matchRequirementIntent(text)
    ) {
      startWizard(text);
      return;
    }
    setBusy(true);
    setAsked(true);
    setInput("");
    const pendingId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text },
      { id: pendingId, role: "agent", text: "正在查看审计记录…", pending: true },
    ]);
    const history = messages
      .filter((message) => !message.pending)
      .map((message) => ({
        role: message.role,
        text: message.role === "agent" ? (message.answer?.title ?? message.text) : message.text,
      }));
    const answer = await answerInspectionQuestion(state, actor, text, history);
    // Agent 只能「提议」写操作：改自动审计频次由界面落到策略上
    if (answer.action?.type === "set-cadence") {
      const minutes = answer.action.minutes;
      setInspectionState((previous) => ({
        ...previous,
        policy: { ...previous.policy, autoRunMinutes: minutes },
      }));
    }
    setMessages((current) =>
      current.map((message) =>
        message.id === pendingId
          ? { ...message, text: answer.title, answer, pending: false }
          : message,
      ),
    );
    setBusy(false);
  };

  /* ------------------------------------------------------------ 创建向导 */

  const startWizard = (text: string) => {
    const today = inspectionDay();
    const regionName = actor.regionId
      ? (state.regions.find((region) => region.id === actor.regionId)?.name ?? "")
      : "";
    const draft: WizardDraft = {
      aspects: [],
      categories: [],
      regionId: actor.hq ? null : (actor.regionId ?? null),
      cadence: "weekly",
      period: "long",
      startsOn: today,
      endsOn: null,
      name: "",
    };
    setAsked(true);
    setWizard({ step: "aspects", draft });
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text },
      {
        id: `wizard-aspects-${Date.now()}`,
        role: "agent",
        text: actor.hq
          ? ASPECT_QUESTION
          : `你的账号只看得到${regionName}，范围就按这个来。${ASPECT_QUESTION}`,
        options: ASPECT_OPTIONS,
        wizardStep: "aspects",
      },
    ]);
  };

  const askNext = (from: WizardStep, draft: WizardDraft) => {
    const steps = stepsFor(draft);
    const index = steps.indexOf(from);
    const next = steps[index + 1];
    if (!next) {
      setWizard({ step: "confirm", draft });
      pushAgent(CONFIRM_QUESTION);
      setMessages((current) =>
        current.map((message, position) =>
          position === current.length - 1
            ? { ...message, wizardStep: "confirm" }
            : message,
        ),
      );
      return;
    }
    const question =
      next === "category"
        ? CATEGORY_QUESTION
        : next === "scope"
          ? SCOPE_QUESTION
          : next === "cadence"
            ? CADENCE_QUESTION
            : PERIOD_QUESTION;
    const options =
      next === "category"
        ? [...categoryOptions, { label: "以上都要", value: "all" }]
        : next === "scope"
          ? [
              { label: "全国（我可见的全部区域）", value: "__all__" },
              ...visibleRegions.map((region) => ({
                label: region.name,
                value: region.id,
              })),
            ]
          : next === "cadence"
            ? CADENCE_OPTIONS
            : PERIOD_OPTIONS;
    setWizard({ step: next, draft });
    setMessages((current) => [
      ...current,
      {
        id: `wizard-${next}-${Date.now()}`,
        role: "agent",
        text: question,
        options,
        wizardStep: next,
      },
    ]);
  };

  /**
   * 向导里用户直接打字：先用本地规则解析成这一步的答案；
   * 解析不出来就说明白能听懂什么，不让对话卡住。
   */
  const handleWizardText = (text: string) => {
    if (!wizard) return;
    const draft = wizard.draft;
    setInput("");

    if (wizard.step === "confirm") {
      const command = parseReplyCommand(text);
      pushUser(text);
      if (command === "confirm") {
        confirmCreate();
        return;
      }
      if (command === "cancel") {
        cancelWizard();
        return;
      }
      if (command === "back") {
        setWizard({ ...wizard, step: "aspects" });
        pushAgent("好，那我们从头再确认一遍。");
        return;
      }
      pushAgent("现在可以直接回复「确认」创建，或者点「返回修改」回去改前面的选择。");
      return;
    }

    if (wizard.step === "aspects") {
      const aspects = parseAspectsFromText(text);
      if (!aspects.length) {
        pushUser(text);
        pushAgent(
          "这一层我只盯四类问题：重复布置、时间集中、任务量超了、数据不全。点上面的按钮选，或者说「都要」。",
        );
        return;
      }
      pushUser(text);
      askNext("aspects", { ...draft, aspects });
      return;
    }

    if (wizard.step === "category") {
      const categories = parseCategoriesFromText(state, actor, text);
      if (!categories.length) {
        pushUser(text);
        pushAgent(
          `品类只认数据里出现过的：${categoryOptions
            .map((item) => item.value)
            .join("、")}。直接点上面的按钮，或者说「都要」。`,
        );
        return;
      }
      pushUser(text);
      askNext("category", { ...draft, categories });
      return;
    }

    if (wizard.step === "scope") {
      const parsed = parseRegionFromText(state, actor, text);
      if (!parsed) {
        pushUser(text);
        pushAgent(
          `没认出是哪个区域。可以说${visibleRegions.map((region) => region.name).join("、")}，或者「全国」。`,
        );
        return;
      }
      pushUser(text);
      askNext("scope", { ...draft, regionId: parsed.regionId });
      return;
    }

    if (wizard.step === "cadence") {
      const cadence = parseCadenceFromText(text);
      if (!cadence) {
        pushUser(text);
        pushAgent(
          "周期只有三种：每天、每周一、每月 1 日（都是早上 8 点跑）。直接点按钮，或者说「每天」。",
        );
        return;
      }
      pushUser(text);
      askNext("cadence", { ...draft, cadence });
      return;
    }

    // 起止时间
    const today = inspectionDay();
    const parsed = parsePeriodFromText(text, today);
    if (!parsed) {
      pushUser(text);
      pushAgent(
        "时间没太看懂。可以说「长期」「连续 4 周」「从今天到 10 月 20 日」，或者在下面选自定义日期。",
      );
      return;
    }
    const period: PeriodPreset = !parsed.endsOn
      ? "long"
      : parsed.startsOn === today && parsed.endsOn === addDays(today, 27)
        ? "weeks4"
        : "custom";
    pushUser(text);
    askNext("period", {
      ...draft,
      period,
      startsOn: parsed.startsOn,
      endsOn: parsed.endsOn,
    });
  };

  const chooseOption = (message: ChatMessage, option: ChatOption) => {
    if (!wizard || wizard.step !== message.wizardStep) return;

    if (message.wizardStep === "aspects") {
      const draft = wizard.draft;
      if (option.value === "all") {
        setWizard({
          ...wizard,
          draft: { ...draft, aspects: [...REQUIREMENT_ASPECTS] },
        });
        return;
      }
      if (option.value === "next") {
        if (!draft.aspects.length) return;
        pushUser(aspectLabelOf(draft.aspects));
        askNext("aspects", draft);
        return;
      }
      const aspect = option.value as RequirementAspect;
      const aspects = draft.aspects.includes(aspect)
        ? draft.aspects.filter((item) => item !== aspect)
        : [...draft.aspects, aspect];
      setWizard({
        ...wizard,
        draft: {
          ...draft,
          aspects,
          // 不再盯品类时，把之前选过的品类一起清掉
          categories: aspects.includes("category") ? draft.categories : [],
        },
      });
      return;
    }

    if (message.wizardStep === "category") {
      const draft = wizard.draft;
      if (option.value === "all") {
        setWizard({
          ...wizard,
          draft: {
            ...draft,
            categories: categoryOptions.map((item) => item.value),
          },
        });
        return;
      }
      if (option.value === "next") {
        if (!draft.categories.length) return;
        pushUser(draft.categories.join("、"));
        askNext("category", draft);
        return;
      }
      const categories = draft.categories.includes(option.value)
        ? draft.categories.filter((item) => item !== option.value)
        : [...draft.categories, option.value];
      setWizard({ ...wizard, draft: { ...draft, categories } });
      return;
    }

    if (message.wizardStep === "scope") {
      const regionId = option.value === "__all__" ? null : option.value;
      pushUser(option.label);
      askNext("scope", { ...wizard.draft, regionId });
      return;
    }

    if (message.wizardStep === "cadence") {
      const cadence = option.value as RequirementCadence;
      pushUser(option.label);
      askNext("cadence", { ...wizard.draft, cadence });
      return;
    }

    if (message.wizardStep === "period") {
      const today = inspectionDay();
      if (option.value === "custom") {
        setWizard({
          ...wizard,
          draft: {
            ...wizard.draft,
            period: "custom",
            startsOn: wizard.draft.startsOn,
            endsOn: wizard.draft.endsOn ?? addDays(today, 27),
          },
        });
        return;
      }
      const endsOn =
        option.value === "weeks4" ? addDays(today, 27) : null;
      pushUser(option.label);
      askNext("period", {
        ...wizard.draft,
        period: option.value as PeriodPreset,
        startsOn: today,
        endsOn,
      });
    }
  };

  const confirmCustomPeriod = () => {
    if (!wizard) return;
    const { startsOn, endsOn } = wizard.draft;
    if (!endsOn || endsOn < startsOn) return;
    pushUser(`${startsOn.slice(5)} 起，${endsOn.slice(5)} 止`);
    askNext("period", { ...wizard.draft, period: "custom" });
  };

  const defaultName = wizard
    ? defaultRequirementName(state, wizard.draft)
    : "";

  const confirmCreate = () => {
    if (!wizard) return;
    const draft = wizard.draft;
    const result = createRequirement({
      name: normalizeRequirementName(draft.name) || defaultName,
      aspects: draft.aspects,
      categories: draft.categories,
      regionId: draft.regionId,
      cadence: draft.cadence,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      createdBy: actor.name,
    });
    setWizard(null);
    if (!result.ok || !result.requirement) {
      pushAgent(`这次没创建成功：${result.error ?? "未知原因"}`);
      return;
    }
    const requirement = result.requirement;
    pushAgent(
      `已经建好了：「${requirement.name}」。${describeRequirement(state, requirement)}。` +
        `标签页已经切过去了，之后点它就能看这个审计跑得怎么样。`,
    );
    onCreatedRequirement(requirement.id);
  };

  const cancelWizard = () => {
    setWizard(null);
    pushAgent("已取消。需要的时候再点「新建一个审计需求」。");
  };

  /* -------------------------------------------------------------- 渲染 */

  const wizardStepLabel = (() => {
    if (!wizard) return "";
    if (wizard.step === "confirm") return "最后一步";
    const steps = stepsFor(wizard.draft);
    return `第 ${steps.indexOf(wizard.step) + 1} 步 / 共 ${steps.length} 步`;
  })();

  const optionSelected = (option: ChatOption) => {
    if (!wizard) return false;
    const draft = wizard.draft;
    if (option.value === "all")
      return draft.aspects.length === REQUIREMENT_ASPECTS.length;
    if (option.value === "next") return false;
    if ((REQUIREMENT_ASPECTS as string[]).includes(option.value) && wizard.step === "aspects")
      return draft.aspects.includes(option.value as RequirementAspect);
    if (wizard.step === "category")
      return option.value === "all"
        ? draft.categories.length === categoryOptions.length
        : draft.categories.includes(option.value);
    if (wizard.step === "scope")
      return (draft.regionId ?? "__all__") === option.value;
    if (wizard.step === "cadence") return draft.cadence === option.value;
    if (wizard.step === "period") return draft.period === option.value;
    return false;
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-secondary/70 to-card p-3.5 ring-1 ring-primary/15">
      <SectionHeading title="和审计Agent对话" />

      <div
        ref={listRef}
        className="mt-3 grid max-h-[360px] gap-2.5 overflow-y-auto pr-0.5"
      >
        {messages.length
          ? messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : ""}`}
              >
                {message.role === "agent" ? (
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Bot size={13} />
                  </span>
                ) : null}
                <div
                  className={`grid max-w-[92%] gap-1.5 rounded-xl px-3 py-2 text-[12px] leading-relaxed ring-1 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground ring-primary/30"
                      : "bg-background text-foreground ring-foreground/10"
                  }`}
                >
                  {message.pending ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 size={13} className="animate-spin" /> {message.text}
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold">{message.text}</span>
                      {message.answer?.paragraphs.map((paragraph, index) => (
                        <span
                          key={`${index}-${paragraph}`}
                          className="text-[11.5px] text-muted-foreground"
                        >
                          {paragraph}
                        </span>
                      ))}
                      {message.answer?.bullets.length ? (
                        <ul className="grid gap-1 text-[11.5px]">
                          {message.answer.bullets.map((bullet, index) => (
                            <li key={`${index}-${bullet}`} className="flex gap-1.5">
                              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {message.answer?.citations.length ? (
                        <div className="grid gap-1 border-t border-border/70 pt-1.5">
                          {message.answer.citations.slice(0, 6).map((citation, index) => (
                            <div
                              key={`${index}-${citation.label}-${citation.ref}`}
                              className="flex flex-wrap items-center justify-between gap-1 text-[10.5px] text-muted-foreground"
                            >
                              <span>
                                {citation.label}
                                <span className="ml-1 text-[10px]">
                                  来源：{citation.ref}
                                </span>
                              </span>
                              {citation.taskId ? (
                                <button
                                  type="button"
                                  className="inspection-link"
                                  onClick={() => onFocusTask(citation.taskId!)}
                                >
                                  看任务体检
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {message.answer?.followUps.length ? (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {message.answer.followUps.slice(0, 4).map((followUp) => (
                            <button
                              key={followUp}
                              type="button"
                              className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] text-secondary-foreground ring-1 ring-primary/15 hover:bg-primary/10"
                              onClick={() => void ask(followUp)}
                            >
                              {followUp}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {wizard &&
                      wizard.step === message.wizardStep &&
                      (message.options?.length ||
                        message.wizardStep === "confirm") ? (
                        <div className="grid gap-1.5 border-t border-border/70 pt-1.5">
                          {message.options?.length ? (
                            <span className="text-[10px] text-muted-foreground">
                              {wizardStepLabel}
                            </span>
                          ) : null}
                          {message.options?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {message.options.map((option) => {
                              const selected = optionSelected(option);
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  title={option.hint}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] ring-1 ${
                                    selected
                                      ? "bg-primary text-primary-foreground ring-primary/30"
                                      : "bg-secondary text-secondary-foreground ring-primary/15 hover:bg-primary/10"
                                  }`}
                                  onClick={() => chooseOption(message, option)}
                                >
                                  {selected ? <Check size={10} /> : null}
                                  {option.label}
                                </button>
                              );
                            })}
                            {message.wizardStep === "category" ? (
                              <button
                                type="button"
                                className="rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-semibold text-primary-foreground disabled:opacity-50"
                                disabled={!wizard.draft.categories.length}
                                onClick={() =>
                                  chooseOption(message, { label: "下一步", value: "next" })
                                }
                              >
                                下一步
                              </button>
                            ) : null}
                            {message.wizardStep === "aspects" ? (
                              <button
                                type="button"
                                className="rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-semibold text-primary-foreground disabled:opacity-50"
                                disabled={!wizard.draft.aspects.length}
                                onClick={() =>
                                  chooseOption(message, { label: "下一步", value: "next" })
                                }
                              >
                                下一步
                              </button>
                            ) : null}
                          </div>
                          ) : null}

                          {message.options?.length &&
                          message.wizardStep === "period" &&
                          wizard.draft.period === "custom" ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
                              <input
                                type="date"
                                className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px]"
                                value={wizard.draft.startsOn}
                                min={inspectionDay()}
                                onChange={(event) =>
                                  setWizard({
                                    ...wizard,
                                    draft: {
                                      ...wizard.draft,
                                      startsOn: event.target.value,
                                    },
                                  })
                                }
                              />
                              <span>到</span>
                              <input
                                type="date"
                                className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px]"
                                value={wizard.draft.endsOn ?? ""}
                                min={wizard.draft.startsOn}
                                onChange={(event) =>
                                  setWizard({
                                    ...wizard,
                                    draft: {
                                      ...wizard.draft,
                                      endsOn: event.target.value,
                                    },
                                  })
                                }
                              />
                              <button
                                type="button"
                                className="rounded-full bg-primary px-2.5 py-0.5 font-semibold text-primary-foreground disabled:opacity-50"
                                disabled={
                                  !wizard.draft.endsOn ||
                                  wizard.draft.endsOn < wizard.draft.startsOn
                                }
                                onClick={confirmCustomPeriod}
                              >
                                确定时间
                              </button>
                            </div>
                          ) : null}

                          {message.wizardStep === "confirm" ? (
                            <div className="grid gap-2 rounded-lg bg-muted/50 p-2">
                              <label className="grid gap-1 text-[10.5px] text-muted-foreground">
                                审计名称（最多 {REQUIREMENT_NAME_LIMIT} 字）
                                <input
                                  className="h-8 rounded-md border border-input bg-background px-2 text-[12px] text-foreground outline-none focus-visible:border-ring"
                                  placeholder={defaultName}
                                  maxLength={REQUIREMENT_NAME_LIMIT}
                                  value={wizard.draft.name}
                                  onChange={(event) =>
                                    setWizard({
                                      ...wizard,
                                      draft: {
                                        ...wizard.draft,
                                        name: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <span className="text-[11px] text-muted-foreground">
                                {describeRequirement(state, wizard.draft)}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                <Button size="sm" onClick={confirmCreate}>
                                  确认创建
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setWizard({
                                      ...wizard,
                                      step: "aspects",
                                      draft: { ...wizard.draft },
                                    })
                                  }
                                >
                                  返回修改
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelWizard}>
                                  取消
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                {message.role === "user" ? (
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <User size={13} />
                  </span>
                ) : null}
              </div>
            ))
          : null}
      </div>

      {wizard ? (
        <div className="mt-2 flex justify-end">
          <button type="button" className="inspection-link" onClick={cancelWizard}>
            取消创建
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/25 hover:bg-primary/20 disabled:opacity-60"
              disabled={busy}
              onClick={() => void ask(CREATE_REQUIREMENT_PROMPT)}
            >
              <Plus size={11} /> {CREATE_REQUIREMENT_PROMPT}
            </button>
            {(asked ? AGENT_PRESET_QUESTIONS.slice(3) : AGENT_PRESET_QUESTIONS).map(
              (question) => (
                <button
                  key={question}
                  type="button"
                  className="rounded-full bg-background px-2.5 py-1 text-[11px] text-foreground ring-1 ring-border hover:bg-secondary disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void ask(question)}
                >
                  {question}
                </button>
              ),
          )}
        </div>
      )}

      <form
        className="mt-2.5 flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
      >
        <input
          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-[12px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder={
            wizard
              ? WIZARD_PLACEHOLDER[wizard.step]
              : "问点什么…例如：南区现在什么情况？"
          }
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={busy || !input.trim()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <CornerDownLeft size={13} />}
          {wizard ? "发送" : "提问"}
        </Button>
      </form>
    </div>
  );
}
