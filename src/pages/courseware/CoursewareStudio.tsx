import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Eye,
  FileSearch,
  FileSignature,
  HelpCircle,
  Info,
  Layers,
  LayoutList,
  LayoutTemplate,
  Lightbulb,
  LoaderCircle,
  NotebookPen,
  PenLine,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  User,
} from "lucide-react";
import {
  CW_OUTLINE_TYPES,
  CW_PAGE_STATES,
  CW_PART_STATES,
  CW_STEPS,
  NONE_ANSWER,
  answerText,
  coursewareFacts,
  defaultAnswers,
  isResultReady,
  isReviewingOutline,
  isTaskFailed,
  isWaitingForConfirmation,
  partSelectionPlan,
  resolveCoursewareTaskStatus,
  resolveProgress,
  resolveSeriesProgress,
  resolveStepIndex,
  waitingQuestions,
  type CwOutline,
  type CwQuestion,
  type CwTask,
} from "../../lib/coursewareStudio";

interface Draft {
  answers: Record<string, string>;
  notes: Record<string, string>;
  title: string;
  audience: string;
  objective: string;
  mustInclude: string;
  outlines: CwOutline[];
  selectedPartIndexes: number[];
}

const questionSignature = (questions: CwQuestion[]) =>
  questions.map((question) => `${question.id}:${question.question}`).join("|");

export function CoursewareStudio({
  task,
  sourcePrompt,
  busy,
  onAnswer,
  onConfirm,
  onCancel,
  onPreviewPage,
}: {
  task: CwTask;
  sourcePrompt: string;
  busy: boolean;
  onAnswer: (
    questions: CwQuestion[],
    answers: Record<string, string>,
    notes: Record<string, string>,
  ) => void;
  onConfirm: (payload: {
    requirementEdits?: {
      title: string;
      audience: string;
      objective: string;
      mustInclude: string[];
      planningOutline: { id: string; title: string; description: string; keyPoints: string[] }[];
    };
    outlineEdits: CwOutline[];
    selectedPartIndexes: number[];
  }) => void;
  onCancel: () => void;
  onPreviewPage: (pageId: string, title: string) => void;
}) {
  const questions = waitingQuestions(task);
  const waitingForUser = questions.length > 0;
  const waitingForConfirmation = isWaitingForConfirmation(task);
  const reviewingOutline = isReviewingOutline(task);
  const plan = partSelectionPlan(task);
  const failed = isTaskFailed(resolveCoursewareTaskStatus(task.status));
  const stepIndex = resolveStepIndex(task);
  const progress = resolveProgress(task);
  const summary = task.promptEnhancement?.summary;
  const pages = task.generation?.pages ?? [];
  const showGeneratedPages = !waitingForConfirmation && pages.length > 0;
  const planningOutline = !plan;
  const facts = coursewareFacts(task);
  const seriesItems = task.series?.items ?? [];
  const allSeriesComplete =
    seriesItems.length > 0 &&
    seriesItems.every((item) => item.status === "SUCCEEDED" || item.status === "CANCELED");

  const [draft, setDraft] = useState<Draft>({
    answers: {},
    notes: {},
    title: "",
    audience: "",
    objective: "",
    mustInclude: "",
    outlines: [],
    selectedPartIndexes: [],
  });
  const [validation, setValidation] = useState("");
  const [editing, setEditing] = useState("");
  const [activePart, setActivePart] = useState(1);
  const [mobileTab, setMobileTab] = useState<"chat" | "draft">("chat");
  const prevFactKeys = useRef<Set<string>>(new Set());
  const updatedFactKeys = useMemo(() => {
    const keys = new Set(facts.map((fact) => fact.key));
    const fresh = new Set<string>();
    if (waitingForUser || waitingForConfirmation)
      keys.forEach((key) => {
        if (!prevFactKeys.current.has(key)) fresh.add(key);
      });
    return fresh;
  }, [facts, waitingForUser, waitingForConfirmation]);

  useEffect(() => {
    prevFactKeys.current = new Set(facts.map((fact) => fact.key));
  }, [facts]);

  /** 问题轮次：重新加载默认答案，保留已有选择。 */
  const signature = questionSignature(questions);
  useEffect(() => {
    if (!questions.length) return;
    setDraft((previous) => ({ ...previous, answers: { ...defaultAnswers(questions), ...previous.answers } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  /** 摘要出现后同步到可编辑草稿。 */
  useEffect(() => {
    if (!summary) return;
    setDraft((previous) => ({
      ...previous,
      title: previous.title || summary.title || "",
      audience: previous.audience || summary.audience || "",
      objective: previous.objective || summary.objective || "",
      mustInclude:
        previous.mustInclude || (summary.scope?.mustInclude ?? []).join("\n"),
      outlines: previous.outlines.length
        ? previous.outlines
        : (summary.planningOutline ?? []).map((item) => ({ ...item, type: "slide" as const })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.title, summary?.audience, summary?.objective]);

  /** 拆分方案出现后加载逐页大纲并默认全选。 */
  const partSignature = plan
    ? plan.parts.map((part) => `${part.partIndex}:${part.outlines?.length ?? 0}`).join("|")
    : "";
  useEffect(() => {
    if (!plan) return;
    setDraft((previous) => ({
      ...previous,
      outlines: plan.parts.flatMap((part) => part.outlines ?? []),
      selectedPartIndexes: previous.selectedPartIndexes.length
        ? previous.selectedPartIndexes
        : plan.parts.map((part) => part.partIndex),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partSignature]);

  const answersComplete =
    questions.length > 0 &&
    questions.every((question) => {
      if (!question.required) return true;
      const value = draft.answers[question.id];
      if (!value) return false;
      if (value === NONE_ANSWER)
        return (draft.answers[`${question.id}__text`] ?? "").trim().length > 0;
      return true;
    });

  const currentRound = task.promptEnhancement?.clarificationRound ?? 0;
  const history = task.promptEnhancement?.history ?? [];

  const submitAnswers = () => {
    if (!answersComplete) return;
    onAnswer(questions, draft.answers, draft.notes);
  };

  const confirm = () => {
    if (draft.selectedPartIndexes.length === 0 && reviewingOutline) {
      setValidation("请至少选择一个要生成的部分。");
      return;
    }
    if (!draft.title.trim() || !draft.audience.trim() || !draft.objective.trim()) {
      setValidation("请补充课程主题、目标学员和学习目标。");
      return;
    }
    if (reviewingOutline && draft.outlines.some((outline) => !outline.title.trim())) {
      setValidation("请补全每个章节的标题、讲解安排和内容要点。");
      return;
    }
    setValidation("");
    onConfirm({
      requirementEdits: {
        title: draft.title,
        audience: draft.audience,
        objective: draft.objective,
        mustInclude: draft.mustInclude.split("\n").filter(Boolean),
        planningOutline: draft.outlines
          .filter((outline) => outline.type === "slide")
          .map(({ id, title, description, keyPoints }) => ({ id, title, description, keyPoints })),
      },
      outlineEdits: draft.outlines,
      selectedPartIndexes: draft.selectedPartIndexes,
    });
  };

  const activePartIndex = plan?.parts.some((part) => part.partIndex === activePart)
    ? activePart
    : (plan?.parts[0]?.partIndex ?? 1);
  const activePages = pages.filter((page) => page.partIndex === activePartIndex);
  const draftTitle = showGeneratedPages
    ? "页面制作"
    : planningOutline
      ? "课程摘要"
      : draft.outlines.length
        ? "课程大纲"
        : "课程草稿";

  const pageIndex = (outlineId: string) =>
    draft.outlines.findIndex((outline) => outline.id === outlineId);

  return (
    <section className="studio">
      <header className="studio__header">
        <div className="studio__header-left">
          <div className="studio__identity">
            <span className="studio__identity-icon">
              <Sparkles size={16} />
            </span>
            <div className="studio__identity-info">
              <strong className="studio__brand-title">课程共创</strong>
              {task.title ? (
                <span className="studio__topic-pill" title={task.title}>
                  {task.title}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <ol className="studio__steps" aria-label="制作进度">
          {CW_STEPS.map((label, index) => (
            <li
              key={label}
              className={`studio__step-item ${index === stepIndex ? "active" : ""} ${
                index < stepIndex ? "complete" : ""
              }`}
            >
              <span className="studio__step-badge">{index + 1}</span>
              <span className="studio__step-label">{label}</span>
              {index < CW_STEPS.length - 1 ? (
                <span className="studio__step-divider" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>
        <div className="studio__header-right">
          <span className={`studio__saved ${busy ? "is-busy" : ""}`}>
            {busy ? <LoaderCircle size={13} className="cw-spin" /> : <ShieldCheck size={13} />}
            {busy ? "正在保存" : "进度已保存"}
          </span>
          <span className="studio__stage-tag">{CW_STEPS[stepIndex]}</span>
        </div>
      </header>

      <div className="studio__mobile-tabs" role="tablist" aria-label="制作工作区">
        <button
          type="button"
          className={mobileTab === "chat" ? "active" : ""}
          onClick={() => setMobileTab("chat")}
        >
          与 AI 共创
        </button>
        <button
          type="button"
          className={mobileTab === "draft" ? "active" : ""}
          onClick={() => setMobileTab("draft")}
        >
          课程草稿{draft.outlines.length ? ` (${draft.outlines.length})` : ""}
        </button>
      </div>

      <div className="studio__body">
        {/* ------------------------------------------------ 左：与 AI 共创 */}
        <div className={`studio__conversation ${mobileTab !== "chat" ? "mobile-hidden" : ""}`}>
          <div className="studio__coach-bar">
            <button type="button" className="studio__text-button studio__end-session" onClick={onCancel}>
              {failed ? "返回创建" : "结束本次制作"}
            </button>
            <div className="studio__coach-profile">
              <span className="studio__coach-avatar">
                <Sparkles size={14} />
              </span>
              <div className="studio__coach-meta">
                <span className="studio__coach-name">课程共创助手</span>
                <span className="studio__coach-status">
                  <span className="studio__pulse-dot" /> 与你一起梳理课程
                </span>
              </div>
            </div>
            {currentRound ? (
              <span className="studio__round-pill">第 {currentRound} 轮</span>
            ) : null}
          </div>

          <div className="studio__thread">
            {sourcePrompt ? (
              <div className="studio__user-bubble-wrap">
                <div className="studio__user-avatar">
                  <User size={13} />
                </div>
                <div className="studio__user-message">{sourcePrompt}</div>
              </div>
            ) : null}

            {history.map((round, index) => (
              <div key={`round-${index}`} className="studio__round">
                <div className="studio__coach-bubble-wrap">
                  <div className="studio__bubble-avatar">
                    <Sparkles size={13} />
                  </div>
                  <div className="studio__bubble-content">
                    <div className="studio__speaker">
                      <span>课程共创助手</span>
                      <span className="studio__round-tag">第 {index + 1} 轮</span>
                    </div>
                    {round.message ? <p className="studio__message">{round.message}</p> : null}
                    {round.questions.map((question) => {
                      const answer = round.answers.find((item) => item.questionId === question.id);
                      return (
                        <div key={question.id} className="studio__history-qa">
                          <div className="studio__history-question">
                            <HelpCircle size={14} className="studio__history-icon" />
                            <span>{question.question}</span>
                          </div>
                          {answer ? (
                            <div className="studio__user-bubble-wrap">
                              <div className="studio__user-avatar">
                                <User size={13} />
                              </div>
                              <div className="studio__user-message">
                                <span>{answerText(question, answer.value)}</span>
                                {answer.note ? (
                                  <p className="studio__history-note">
                                    <Info size={12} />
                                    {answer.note}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            <div className="studio__current">
              {waitingForUser ? (
                <>
                  <div className="studio__coach-bubble-wrap">
                    <div className="studio__bubble-avatar">
                      <Sparkles size={13} />
                    </div>
                    <div className="studio__bubble-content">
                      <div className="studio__speaker">
                        <span>课程共创助手</span>
                      </div>
                      <p className="studio__message">
                        {task.promptEnhancement?.message ??
                          "我们先把关键内容聊清楚。我会把你的回答整理在右侧，再一起确认课程大纲。"}
                      </p>
                    </div>
                  </div>
                  <form
                    className="studio__form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitAnswers();
                    }}
                  >
                    {questions.map((question) => (
                      <fieldset key={question.id} className="studio__question" disabled={busy}>
                        <div className="studio__question-card">
                          <div className="studio__question-header">
                            <span className="studio__question-badge">
                              <HelpCircle size={15} />
                            </span>
                            <h3 className="studio__question-title">{question.question}</h3>
                          </div>
                          {question.reason ? (
                            <div className="studio__why">
                              <Lightbulb size={14} className="studio__why-icon" />
                              <div>
                                <strong>为什么问:</strong> <span>{question.reason}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="studio__options">
                          {question.options.map((option) => {
                            const selected = draft.answers[question.id] === option.id;
                            return (
                              <label
                                key={option.id}
                                className={`studio__option ${selected ? "selected" : ""}`}
                              >
                                <input
                                  type="radio"
                                  name={question.id}
                                  checked={selected}
                                  onChange={() =>
                                    setDraft((previous) => ({
                                      ...previous,
                                      answers: { ...previous.answers, [question.id]: option.id },
                                    }))
                                  }
                                />
                                <span className="studio__option-body">
                                  <strong>{option.label}</strong>
                                  {option.description ? <small>{option.description}</small> : null}
                                </span>
                                {option.recommended ||
                                question.recommendedOptionId === option.id ? (
                                  <em className="studio__recommended-badge">
                                    <Star size={11} /> 建议
                                  </em>
                                ) : null}
                              </label>
                            );
                          })}
                          {question.allowCustom ? (
                            <label
                              className={`studio__option ${
                                draft.answers[question.id] === NONE_ANSWER ? "selected" : ""
                              }`}
                            >
                              <input
                                type="radio"
                                name={question.id}
                                checked={draft.answers[question.id] === NONE_ANSWER}
                                onChange={() =>
                                  setDraft((previous) => ({
                                    ...previous,
                                    answers: { ...previous.answers, [question.id]: NONE_ANSWER },
                                  }))
                                }
                              />
                              <span className="studio__option-body">
                                <strong>None · 我自己填写</strong>
                              </span>
                            </label>
                          ) : null}
                        </div>
                        {draft.answers[question.id] === NONE_ANSWER ? (
                          <label className="studio__input-label">
                            <span>
                              <PenLine size={13} /> 也可以说说你的想法
                            </span>
                            <textarea
                              rows={3}
                              maxLength={4000}
                              value={draft.answers[`${question.id}__text`] ?? ""}
                              placeholder="像和同事聊天一样，说说当时的情况、你的做法和结果。没有案例也可以告诉我。"
                              onChange={(event) =>
                                setDraft((previous) => ({
                                  ...previous,
                                  answers: {
                                    ...previous.answers,
                                    [`${question.id}__text`]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        ) : null}
                        {draft.answers[question.id] &&
                        draft.answers[question.id] !== NONE_ANSWER ? (
                          <details className="studio__note">
                            <summary>
                              <Plus size={13} /> 补充一个细节（可选）
                            </summary>
                            <textarea
                              rows={2}
                              maxLength={4000}
                              value={draft.notes[question.id] ?? ""}
                              placeholder="例如：要突出的方法、真实案例，或不希望涉及的内容。"
                              onChange={(event) =>
                                setDraft((previous) => ({
                                  ...previous,
                                  notes: { ...previous.notes, [question.id]: event.target.value },
                                }))
                              }
                            />
                          </details>
                        ) : null}
                      </fieldset>
                    ))}
                  </form>
                </>
              ) : null}
            </div>
          </div>

          {!waitingForUser ? (
            <div className="studio__status-dock">
              {waitingForConfirmation ? (
                <div className="studio__working-card studio__milestone-card">
                  <span className="studio__milestone-icon">
                    <LayoutTemplate size={24} />
                  </span>
                  <div className="studio__milestone-body">
                    <h3>{reviewingOutline ? "课程大纲已经准备好了" : "我们把课程方向理清了"}</h3>
                    <p className="studio__message">
                      {reviewingOutline
                        ? "右侧已整理完整的课程结构、各章节目标和内容要点。可以直接修改，确认后按这份大纲逐页制作课件。"
                        : "右侧是可编辑的课程规划。调整章节目标和内容后，生成正式逐页大纲；你确认逐页大纲后才会开始制作课件。"}
                    </p>
                    <div className="studio__checkpoint">
                      <ShieldCheck size={17} />
                      <span>
                        {reviewingOutline
                          ? "确认后会沿用这份大纲制作课件，保留你在这里的修改。"
                          : "下一步先生成大纲，你还可以逐页调整，再开始制作课件。"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="studio__text-button studio__show-draft"
                      onClick={() => setMobileTab("draft")}
                    >
                      查看并修改草稿 <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : failed ? (
                <div className="studio__error-card">
                  <span className="studio__error-icon">
                    <CircleAlert size={24} />
                  </span>
                  <div className="studio__error-body">
                    <h3>课件制作未完成</h3>
                    <p className="studio__message" role="alert">
                      {task.errorMessage ?? task.message ?? "本次制作未完成，请返回创建页重试。"}
                    </p>
                    <button type="button" className="cw-primary" style={{ marginTop: 12 }} onClick={onCancel}>
                      <RotateCw size={15} /> 返回创建
                    </button>
                  </div>
                </div>
              ) : (
                <div className="studio__working-card">
                  <span className="studio__living-orb">
                    <span className="studio__orb-pulse" />
                    <Sparkles size={22} className="cw-spin-slow" />
                  </span>
                  <h3>{task.generation ? task.generation.phase === "pages" ? "正在逐页制作" : "正在整合课件" : "正在理解你的课程目标"}</h3>
                  <p className="studio__message">
                    {task.message ?? "正在整理输入内容，寻找最值得进一步聊清楚的问题。"}
                  </p>
                  {task.generation?.retry?.retrying ? (
                    <p className="studio__why">已自动重试 {task.generation.retry.count} 次</p>
                  ) : null}
                  {task.sourcePreparation?.status === "running" ? (
                    <div className="studio__checkpoint">
                      <FileSearch size={15} />
                      <span>同时在阅读你上传的资料，已提供的信息不会再让你重复填写。</span>
                    </div>
                  ) : null}
                  {stepIndex === 3 ? (
                    <div className="studio__progress-layout">
                      <div className="studio__production">
                        <div className="studio__production-header">
                          <span>课件制作进度</span>
                          <strong>{progress}%</strong>
                        </div>
                        <progress className="studio__progress" value={progress} max={100} />
                        <p className="studio__leave-hint">
                          <Info size={13} />
                          完整课件制作可能需要较长时间。你可以离开此页去做其他事，稍后从任务历史返回查看进度和预览。
                        </p>
                      </div>
                      {seriesItems.length && !allSeriesComplete ? (
                        <div className="studio__series-progress">
                          {seriesItems.map((item) => (
                            <div key={item.childJobId} className="studio__series-progress-item">
                              <div className="studio__production-header">
                                <span>{item.title}</span>
                                <strong>
                                  {resolveSeriesProgress(item, !!task.generateHomeworkSync)}%
                                </strong>
                              </div>
                              <progress
                                className="studio__progress"
                                value={resolveSeriesProgress(item, !!task.generateHomeworkSync)}
                                max={100}
                              />
                              <small>{CW_PART_STATES[item.status]}</small>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {waitingForUser ? (
            <div className="studio__composer">
              {validation ? (
                <p className="studio__error" role="alert">
                  <AlertCircle size={14} />
                  <span>{validation}</span>
                </p>
              ) : null}
              <div className="studio__composer-actions">
                <span className="studio__shortcut-hint">按 ⌘/Ctrl + Enter 发送</span>
                <button
                  type="button"
                  className="cw-primary"
                  disabled={busy || !answersComplete}
                  onClick={submitAnswers}
                >
                  {busy ? (
                    <>
                      <LoaderCircle size={15} className="cw-spin" /> 正在保存
                    </>
                  ) : (
                    <>
                      继续 <ArrowUp size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------- 右：课程草稿 */}
        <aside className={`studio__draft ${mobileTab !== "draft" ? "mobile-hidden" : ""}`}>
          <header className="studio__draft-header">
            {showGeneratedPages && plan ? (
              <nav className="studio__part-tabs" aria-label="页面制作">
                {plan.parts.map((part) => {
                  const item = seriesItems.find((entry) => entry.partIndex === part.partIndex);
                  return (
                    <button
                      key={part.partIndex}
                      type="button"
                      className={part.partIndex === activePartIndex ? "is-active" : ""}
                      title={part.title}
                      onClick={() => setActivePart(part.partIndex)}
                    >
                      <Presentation size={15} />
                      PPT {part.partIndex}
                      {item ? (
                        <span className={`is-${item.status.toLowerCase()}`}>
                          {CW_PART_STATES[item.status]}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            ) : (
              <div className="studio__draft-title">
                <span className="studio__draft-icon">
                  {draft.outlines.length ? <LayoutList size={16} /> : <NotebookPen size={16} />}
                </span>
                <h2>{draftTitle}</h2>
              </div>
            )}
            {showGeneratedPages && !failed ? (
              <span className="studio__hint">
                <RefreshCw size={13} /> 完成后会在这里更新
              </span>
            ) : (
              <span className={`studio__canvas-badge ${waitingForConfirmation ? "is-editable" : ""}`}>
                {waitingForConfirmation ? "可直接修改" : "根据对话整理"}
              </span>
            )}
          </header>

          <div className="studio__document">
            {showGeneratedPages ? (
              <div className="studio__generated-pages">
                <h3>{plan?.parts.find((part) => part.partIndex === activePartIndex)?.title}</h3>
                <p className="studio__part-summary">
                  已完成 {activePages.filter((page) => page.status === "completed").length} /{" "}
                  {activePages.length} 页
                </p>
                {activePages.map((page) => (
                  <article key={page.id} className="studio__page">
                    <div className="studio__generated-page-heading">
                      <strong>
                        {page.partIndex}.{page.order} · {page.title}
                      </strong>
                      <div className="studio__page-heading-actions">
                        {page.status !== "completed" ? (
                          <span className={`studio__page-status is-${page.status}`}>
                            {CW_PAGE_STATES[page.status]}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="studio__text-button studio__preview-link"
                            onClick={() => onPreviewPage(page.id, page.title)}
                          >
                            <Eye size={15} /> 只读预览
                          </button>
                        )}
                      </div>
                    </div>
                    {page.summary ? (
                      <p className="studio__page-readonly-desc">{page.summary}</p>
                    ) : null}
                    {page.retryCount ? (
                      <p className="studio__why">已自动重试 {page.retryCount} 次</p>
                    ) : null}
                    {page.mediaPending && !failed ? (
                      <p className="studio__why">页面内容已完成，图片、视频或语音仍在制作中。</p>
                    ) : null}
                    {page.error ? (
                      <p className="studio__series-error" role="alert">
                        {page.error}
                      </p>
                    ) : null}
                  </article>
                ))}
                {task.generateHomeworkSync ? (
                  <article className="studio__page studio__quiz-card">
                    <div className="studio__generated-page-heading">
                      <strong>
                        <ClipboardCheck size={16} /> 课后练习
                      </strong>
                      <span className="studio__page-status">生成中</span>
                    </div>
                    <p className="studio__page-readonly-desc">
                      本子课件的其他页面完成后，将立即生成并追加课后练习。
                    </p>
                  </article>
                ) : null}
              </div>
            ) : draft.outlines.length ? (
              <>
                <div className="studio__document-title">
                  <div className="studio__doc-headline">
                    <Presentation size={18} color="#b25d49" />
                    <h3>{draft.title || task.title}</h3>
                  </div>
                  <p>
                    {planningOutline
                      ? `共 ${draft.outlines.length} 个章节`
                      : `共 ${draft.outlines.length} 页，展开可查看内容`}
                  </p>
                </div>

                {waitingForConfirmation ? (
                  <details className="studio__page" style={{ marginBottom: 20 }}>
                    <summary>
                      <span className="studio__page-number">1</span>
                      <div className="studio__page-summary">
                        <strong>课程目标与范围</strong>
                        <div className="studio__page-meta">
                          <span className="studio__page-desc-snippet">
                            课程主题 / 面向谁 / 学完能够做到什么 / 核心内容
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="studio__chevron" size={15} />
                    </summary>
                    <div className="studio__page-content">
                      <label className="studio__input-label">
                        <span>课程主题</span>
                        <input
                          value={draft.title}
                          maxLength={200}
                          disabled={busy}
                          onChange={(event) =>
                            setDraft((previous) => ({ ...previous, title: event.target.value }))
                          }
                        />
                      </label>
                      <label className="studio__input-label">
                        <span>面向谁</span>
                        <input
                          value={draft.audience}
                          maxLength={1000}
                          disabled={busy}
                          onChange={(event) =>
                            setDraft((previous) => ({ ...previous, audience: event.target.value }))
                          }
                        />
                      </label>
                      <label className="studio__input-label">
                        <span>学完能够做到什么</span>
                        <textarea
                          rows={3}
                          maxLength={4000}
                          value={draft.objective}
                          disabled={busy}
                          onChange={(event) =>
                            setDraft((previous) => ({ ...previous, objective: event.target.value }))
                          }
                        />
                      </label>
                      <label className="studio__input-label">
                        <span>核心内容（每行一条）</span>
                        <textarea
                          rows={4}
                          value={draft.mustInclude}
                          disabled={busy}
                          onChange={(event) =>
                            setDraft((previous) => ({
                              ...previous,
                              mustInclude: event.target.value,
                            }))
                          }
                        />
                      </label>
                      {summary?.assumptions?.length ? (
                        <div className="studio__assumptions">
                          <h4>
                            <HelpCircle size={13} /> 尚待确认的假设
                          </h4>
                          {summary.assumptions.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </details>
                ) : null}

                {(plan?.parts ?? [{ partIndex: 1, partCount: 1, title: "", outlines: draft.outlines }]).map(
                  (part) => {
                    const outlines = plan
                      ? (part.outlines ?? [])
                      : draft.outlines;
                    const excluded =
                      reviewingOutline && !draft.selectedPartIndexes.includes(part.partIndex);
                    return (
                      <div key={part.partIndex} className="studio__part">
                        {plan && plan.parts.length > 1 ? (
                          <label className="studio__part-title">
                            {reviewingOutline ? (
                              <input
                                type="checkbox"
                                checked={draft.selectedPartIndexes.includes(part.partIndex)}
                                disabled={busy}
                                onChange={(event) =>
                                  setDraft((previous) => ({
                                    ...previous,
                                    selectedPartIndexes: event.target.checked
                                      ? [...previous.selectedPartIndexes, part.partIndex]
                                      : previous.selectedPartIndexes.filter(
                                          (index) => index !== part.partIndex,
                                        ),
                                  }))
                                }
                              />
                            ) : null}
                            <Layers size={14} color="#b25d49" />
                            <strong>{part.title}</strong>
                            <span className="studio__part-count-badge">
                              共 {outlines.length} 页
                            </span>
                          </label>
                        ) : null}
                        {outlines.map((outline) => {
                          const index = pageIndex(outline.id);
                          const item = draft.outlines[index];
                          if (!item) return null;
                          return (
                            <details
                              key={outline.id}
                              className={`studio__page ${excluded ? "excluded" : ""}`}
                              open={planningOutline}
                            >
                              <summary>
                                <span className="studio__page-number">{index + 1}</span>
                                <div className="studio__page-summary">
                                  <strong>{item.title}</strong>
                                  <div className="studio__page-meta">
                                    {!planningOutline ? (
                                      <small className="studio__type-badge" data-type={outline.type}>
                                        {CW_OUTLINE_TYPES[outline.type]}
                                      </small>
                                    ) : null}
                                    {outline.description ? (
                                      <span className="studio__page-desc-snippet">
                                        {item.description}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <ChevronDown className="studio__chevron" size={15} />
                              </summary>
                              <div className="studio__page-content">
                                {waitingForConfirmation ? (
                                  <div className="studio__section-actions">
                                    <button
                                      type="button"
                                      className="studio__text-button"
                                      disabled={busy}
                                      onClick={() =>
                                        setEditing(editing === outline.id ? "" : outline.id)
                                      }
                                    >
                                      {editing === outline.id ? (
                                        <>
                                          <Check size={13} /> 完成编辑
                                        </>
                                      ) : (
                                        <>
                                          <Pencil size={13} /> 编辑
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ) : null}
                                {editing === outline.id || reviewingOutline ? (
                                  <>
                                    <label className="studio__input-label">
                                      <span>{planningOutline ? "章节标题" : "页面标题"}</span>
                                      <input
                                        value={item.title}
                                        maxLength={200}
                                        disabled={busy}
                                        onChange={(event) =>
                                          setDraft((previous) => ({
                                            ...previous,
                                            outlines: previous.outlines.map((entry, position) =>
                                              position === index
                                                ? { ...entry, title: event.target.value }
                                                : entry,
                                            ),
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="studio__input-label">
                                      <span>
                                        {planningOutline ? "学习目标与讲解安排" : "这一页要讲清什么"}
                                      </span>
                                      <textarea
                                        rows={2}
                                        maxLength={4000}
                                        value={item.description}
                                        disabled={busy}
                                        onChange={(event) =>
                                          setDraft((previous) => ({
                                            ...previous,
                                            outlines: previous.outlines.map((entry, position) =>
                                              position === index
                                                ? { ...entry, description: event.target.value }
                                                : entry,
                                            ),
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="studio__input-label">
                                      <span>内容要点（每行一条）</span>
                                      <textarea
                                        rows={4}
                                        value={item.keyPoints.join("\n")}
                                        disabled={busy}
                                        onChange={(event) =>
                                          setDraft((previous) => ({
                                            ...previous,
                                            outlines: previous.outlines.map((entry, position) =>
                                              position === index
                                                ? {
                                                    ...entry,
                                                    keyPoints: event.target.value.split("\n"),
                                                  }
                                                : entry,
                                            ),
                                          }))
                                        }
                                      />
                                    </label>
                                  </>
                                ) : (
                                  <>
                                    <p className="studio__page-readonly-desc">{item.description}</p>
                                    <ul className="studio__page-readonly-points">
                                      {item.keyPoints.map((point, position) => (
                                        <li key={`${position}-${point}`}>{point}</li>
                                      ))}
                                    </ul>
                                  </>
                                )}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    );
                  },
                )}
              </>
            ) : summary && waitingForConfirmation ? (
              <>
                <div className="studio__brief-header">
                  <FileSignature size={17} color="#b25d49" />
                  <p className="studio__document-note">
                    先确定教什么、教给谁。措辞和内容都可以直接修改。
                  </p>
                </div>
                <label className="studio__input-label">
                  <span>课程主题</span>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, title: event.target.value }))
                    }
                  />
                </label>
                <label className="studio__input-label">
                  <span>面向谁</span>
                  <input
                    value={draft.audience}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, audience: event.target.value }))
                    }
                  />
                </label>
                <label className="studio__input-label">
                  <span>学完能够做到什么</span>
                  <textarea
                    rows={3}
                    value={draft.objective}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, objective: event.target.value }))
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <div className="studio__canvas-status">
                  <span>已理解的内容</span>
                  <span>{facts.length} 项内容</span>
                </div>
                {facts.length ? (
                  <div className="studio__facts">
                    {facts.map((fact) => (
                      <section
                        key={fact.key}
                        className={`studio__fact-card ${
                          updatedFactKeys.has(fact.key) ? "is-updated" : ""
                        }`}
                      >
                        <div className="studio__fact-header">
                          <Target size={14} className="studio__fact-icon" />
                          <h3>{fact.label}</h3>
                          {updatedFactKeys.has(fact.key) ? (
                            <span className="studio__updated-pill">刚更新</span>
                          ) : null}
                        </div>
                        <p>{fact.value}</p>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="studio__empty">
                    <div>
                      <span className="studio__empty-icon-wrap">
                        <NotebookPen size={28} />
                      </span>
                      <div className="studio__empty-hero">
                        <h3>你的经验，会在这里成为课程</h3>
                        <p>随着对话推进，已理解的目标、案例和方法会逐步整理在这里。</p>
                      </div>
                    </div>
                    <div className="studio__blueprint-cards">
                      {[
                        {
                          icon: <Target size={15} />,
                          title: "目标学员与业务痛点",
                          desc: "明确谁在什么实际业务场景下需要掌握这门技能",
                        },
                        {
                          icon: <Lightbulb size={15} />,
                          title: "实战动作与应对策略",
                          desc: "从真实经历中提炼解决问题的具体动作与标准",
                        },
                        {
                          icon: <LayoutTemplate size={15} />,
                          title: "逐页讲解与互动设计",
                          desc: "将知识沉淀为层层递进的逐页大纲与配套习题",
                        },
                      ].map((card) => (
                        <div key={card.title} className="studio__blueprint-card">
                          <span className="studio__blueprint-icon">{card.icon}</span>
                          <div className="studio__blueprint-body">
                            <strong>{card.title}</strong>
                            <small>{card.desc}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {task.promptEnhancement?.assumptions?.length ? (
                  <div className="studio__assumptions">
                    <h4>
                      <HelpCircle size={13} /> 尚待确认的假设
                    </h4>
                    {task.promptEnhancement.assumptions.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            {!showGeneratedPages && seriesItems.length ? (
              <section className="studio__results">
                <h3>正在制作的课件</h3>
                {seriesItems.map((item) => (
                  <div key={item.childJobId} className="studio__series-item">
                    {item.status === "FAILED" ? (
                      <CircleAlert size={15} className="is-failed" />
                    ) : item.status === "SUCCEEDED" ? (
                      <Check size={15} className="is-ok" />
                    ) : (
                      <LoaderCircle size={15} className="cw-spin" />
                    )}
                    <span>{item.title}</span>
                    <strong>{CW_PART_STATES[item.status]}</strong>
                  </div>
                ))}
              </section>
            ) : null}
          </div>

          {waitingForConfirmation ? (
            <div className="studio__composer">
              {validation ? (
                <p className="studio__error" role="alert">
                  <AlertCircle size={14} />
                  <span>{validation}</span>
                </p>
              ) : null}
              <div className="studio__composer-actions studio__draft-actions">
                <span className="studio__confirmation-hint">
                  <ShieldCheck size={15} /> 确认前不会开始制作页面
                </span>
                <button type="button" className="cw-primary" disabled={busy} onClick={confirm}>
                  {busy ? (
                    <>
                      <LoaderCircle size={15} className="cw-spin" /> 正在保存
                    </>
                  ) : (
                    <>
                      {reviewingOutline ? "确认大纲，生成课件" : "生成课程大纲"}
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : isResultReady(task) ? (
            <div className="studio__composer">
              <div className="studio__composer-actions">
                <span className="studio__hint">全部制作已完成，可以预览或发布课件。</span>
              </div>
            </div>
          ) : (
            <div className="studio__composer">
              <div className="studio__composer-actions">
                <span className="studio__hint">
                  <LoaderCircle size={13} className="cw-spin" /> 完成后会在这里更新
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
