import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  buildFrames,
  createCoursewareForm,
  createTask,
  isResultReady,
  slidePreviewHtml,
  type CwForm,
  type CwOutline,
  type CwQuestion,
  type CwTask,
} from "../../lib/coursewareStudio";
import { CoursewareEntry } from "./CoursewareEntry";
import { CoursewareStudio } from "./CoursewareStudio";
import { CoursewareResult } from "./CoursewareResult";
import "./courseware.css";

type View = "entry" | "studio" | "result";

/**
 * 演示用的生成任务：用一串「帧」把后端的轮询结果演出来。
 * gate 帧会停在原地等用户操作（回答反问 / 确认摘要 / 勾选子课件），
 * 其余帧按 delayMs 自动推进，节奏与真实链路一致但快很多。
 */
function useCoursewareSimulator() {
  const [form, setForm] = useState<CwForm>(() => createCoursewareForm());
  const [task, setTask] = useState<CwTask | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [awaiting, setAwaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const frames = useMemo(() => buildFrames(form), [form]);
  const framesRef = useRef(frames);
  framesRef.current = frames;

  useEffect(() => {
    if (!task || awaiting) return;
    const frame = framesRef.current[frameIndex];
    if (!frame) return;
    const timer = window.setTimeout(
      () => {
        setTask((previous) => (previous ? frame.build(previous) : previous));
        setFrameIndex((index) => index + 1);
        if (frame.gate) setAwaiting(true);
      },
      frame.gate ? 260 : frame.delayMs,
    );
    return () => window.clearTimeout(timer);
  }, [frameIndex, awaiting, task]);

  const start = useCallback(() => {
    if (form.files.some((file) => file.status === "uploading")) {
      setError("文件上传未完成，请稍后再开始生成");
      return false;
    }
    if (!form.prompt.trim() && !form.files.length) {
      setError("请上传 PDF、Word、PPT 资料，或填写生成提示词");
      return false;
    }
    setError("");
    setTask(createTask(form));
    setFrameIndex(0);
    setAwaiting(false);
    setBusy(false);
    return true;
  }, [form]);

  const reset = useCallback(() => {
    setTask(null);
    setFrameIndex(0);
    setAwaiting(false);
    setBusy(false);
    setError("");
  }, []);

  const release = useCallback((delay: number) => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setAwaiting(false);
    }, delay);
  }, []);

  /**
   * 重试附加题（对齐 vue 的 handleRetryHomework）：课件本体不动，
   * 只把课后题重新排一遍，完成后继续走后面的帧（直接进结果页）。
   */
  const retryHomework = useCallback(() => {
    setTask((previous) =>
      previous
        ? {
            ...previous,
            status: 20,
            errorMessage: undefined,
            homeworkGenerationStatus: "running",
            homeworkGenerationMessage: "正在重新生成 10 道课后题",
            series: previous.series
              ? {
                  ...previous.series,
                  items: previous.series.items.map((item) =>
                    item.status === "SUCCEEDED"
                      ? { ...item, homeworkGenerationStatus: "running" }
                      : item,
                  ),
                }
              : previous.series,
          }
        : previous,
    );
    release(1600);
  }, [release]);

  const answer = useCallback(
    (questions: CwQuestion[], answers: Record<string, string>, notes: Record<string, string>) => {
      setTask((previous) => {
        if (!previous) return previous;
        const round = {
          message: previous.promptEnhancement?.message,
          questions,
          answers: questions.map((question) => ({
            questionId: question.id,
            value: answers[question.id] ?? "",
            note: notes[question.id] || undefined,
          })),
        };
        return {
          ...previous,
          promptEnhancement: {
            ...previous.promptEnhancement,
            history: [...(previous.promptEnhancement?.history ?? []), round],
            questions: [],
          },
        };
      });
      release(900);
    },
    [release],
  );

  const confirm = useCallback(
    (payload: {
      requirementEdits?: {
        title: string;
        audience: string;
        objective: string;
        mustInclude: string[];
        planningOutline: { id: string; title: string; description: string; keyPoints: string[] }[];
      };
      outlineEdits: CwOutline[];
      selectedPartIndexes: number[];
    }) => {
      setTask((previous) => {
        if (!previous) return previous;
        const edits = payload.requirementEdits;
        return {
          ...previous,
          title: edits?.title || previous.title,
          promptEnhancement: {
            ...previous.promptEnhancement,
            summary: previous.promptEnhancement?.summary
              ? {
                  ...previous.promptEnhancement.summary,
                  title: edits?.title ?? previous.promptEnhancement.summary.title,
                  audience: edits?.audience ?? previous.promptEnhancement.summary.audience,
                  objective: edits?.objective ?? previous.promptEnhancement.summary.objective,
                  scope: {
                    ...previous.promptEnhancement.summary.scope,
                    mustInclude:
                      edits?.mustInclude?.length
                        ? edits.mustInclude
                        : previous.promptEnhancement.summary.scope?.mustInclude,
                  },
                }
              : previous.promptEnhancement?.summary,
          },
          /** 只记用户勾选的子课件；required 由生成阶段自己收掉，避免确认后按钮跳回上一步。 */
          partSelection: previous.partSelection
            ? { ...previous.partSelection, selectedPartIndexes: payload.selectedPartIndexes }
            : previous.partSelection,
        };
      });
      release(1200);
    },
    [release],
  );

  return { form, setForm, task, busy, error, setError, start, reset, answer, confirm, retryHomework };
}

export function CoursewareCreateFlow() {
  const { form, setForm, task, busy, error, start, reset, answer, confirm, retryHomework } =
    useCoursewareSimulator();
  const [view, setView] = useState<View>("entry");
  const [leaving, setLeaving] = useState(false);
  const [preview, setPreview] = useState<{ title: string; partIndex: number; order: number } | null>(
    null,
  );

  const swapTo = useCallback((next: View) => {
    setLeaving(true);
    window.setTimeout(() => {
      setView(next);
      setLeaving(false);
    }, 700);
  }, []);

  useEffect(() => {
    if (!task) return;
    const ready = isResultReady(task);
    if (ready && view !== "result") swapTo("result");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status, task?.done, task?.homeworkGenerationStatus]);

  const handleStart = () => {
    // 校验不通过就留在入口卡（否则会进到工作台一直显示「正在建立课程…」）
    if (!start()) return;
    swapTo("studio");
  };

  const handleRestart = () => {
    reset();
    swapTo("entry");
  };

  return (
    <div className="cw-root" data-i18n-skip="true">
      <div
        key={view}
        className={leaving ? "cw-swap-out" : "cw-swap-in"}
        style={{ display: "flex", minHeight: 0, flex: 1, flexDirection: "column" }}
      >
        {view === "entry" ? (
          <CoursewareEntry
            form={form}
            setForm={setForm}
            onStart={handleStart}
            submitting={busy}
            error={error}
          />
        ) : null}

        {view === "studio" && task ? (
          <CoursewareStudio
            task={task}
            sourcePrompt={form.prompt}
            busy={busy}
            autoConfirm={form.autoConfirm}
            onAnswer={answer}
            onConfirm={confirm}
            onCancel={handleRestart}
            onRetryHomework={retryHomework}
            onPreviewPage={(pageId, title) => {
              const page = task.generation?.pages.find((item) => item.id === pageId);
              setPreview({
                title,
                partIndex: page?.partIndex ?? 1,
                order: page?.order ?? 1,
              });
            }}
          />
        ) : null}

        {view === "result" && task ? (
          <CoursewareResult task={task} onRestart={handleRestart} />
        ) : null}

        {view === "studio" && !task ? (
          <div className="studio__stage-loading">正在建立课程…</div>
        ) : null}
      </div>

      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgb(28 25 23 / 45%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(1080px, 94vw)",
              height: "min(680px, 84vh)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 18,
              background: "#fff",
              boxShadow: "0 24px 60px -20px rgb(28 25 23 / 45%)",
            }}
          >
            <div className="cw-preview-bar" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                只读预览 · {preview.title}
              </span>
              <button
                type="button"
                className="cw-ghost"
                onClick={() => setPreview(null)}
                aria-label="关闭预览"
              >
                <X size={14} /> 关闭
              </button>
            </div>
            <div className="cw-preview-stage" style={{ background: "#f6f2ef" }}>
              <iframe
                title={preview.title}
                srcDoc={slidePreviewHtml(preview.title, preview.partIndex, preview.order)}
                sandbox="allow-scripts"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
