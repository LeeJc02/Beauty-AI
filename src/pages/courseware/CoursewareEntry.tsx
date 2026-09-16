import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FileClock,
  FileText,
  Languages,
  Lightbulb,
  ListChecks,
  MessageSquare,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import {
  CW_COURSE_KINDS,
  CW_EXAMPLES,
  CW_LANGUAGES,
  CW_NARRATORS,
  type CwForm,
  type CwUploadItem,
} from "../../lib/coursewareStudio";
import {
  DEMO_UPLOAD_FILES,
  UPLOAD_ACCEPT,
  UPLOAD_FLAKY_THRESHOLD_BYTES,
  UPLOAD_MAX_SIZE_MB,
  formatFileSize,
  loadResumeTasks,
  matchesResumeFile,
  progressStep,
  removeResumeTask,
  upsertResumeTask,
  validateUploadFile,
  type CoursewareResumeTask,
} from "../../lib/coursewareUpload";

const KIND_ICONS: Record<string, React.ReactNode> = {
  sparkles: <Sparkles size={15} />,
  "message-square": <MessageSquare size={15} />,
  "list-checks": <ListChecks size={15} />,
  "book-open": <BookOpen size={15} />,
};

const ROADMAP = [
  { num: "01", title: "聊聊你的经验", desc: "结构化提炼一线真实业务经验" },
  { num: "02", title: "一起打磨大纲", desc: "提炼核心要点，自由调整教学逻辑" },
  { num: "03", title: "制作可学习的课程", desc: "将确认的内容制作成课件" },
];

let fileSeed = 0;

/** 断点续传记录里的时间显示：雅加达时区的「09/16 14:05」。 */
function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Jakarta",
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CoursewareEntry({
  form,
  setForm,
  onStart,
  submitting,
  error,
}: {
  form: CwForm;
  setForm: React.Dispatch<React.SetStateAction<CwForm>>;
  onStart: () => void;
  submitting: boolean;
  error: string;
}) {
  const uploading = form.files.some((file) => file.status === "uploading");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  /** 校验 / 上传失败的提示，等价于 vue 里的 message.error。 */
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [resumeTasks, setResumeTasks] = useState<CoursewareResumeTask[]>([]);
  const pendingResumeRef = useRef<CoursewareResumeTask | null>(null);

  useEffect(() => {
    setResumeTasks(loadResumeTasks());
  }, []);

  /**
   * 上传进度推进（原型代替分片上传）：
   * 大文件走得慢，≥100MB 的文件第一次会在 80% 处模拟一次网络中断，
   * 这样「暂停 / 继续 / 失败 / 重试」四个分支都能在演示里走到。
   */
  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => {
      setForm((previous) => ({
        ...previous,
        files: previous.files.map((file) => {
          if (file.status !== "uploading") return file;
          const next = Math.min(100, file.progress + progressStep(file.size));
          const flaky =
            file.size >= UPLOAD_FLAKY_THRESHOLD_BYTES && (file.attempts ?? 1) <= 1;
          if (flaky && next >= 80)
            return {
              ...file,
              progress: 80,
              status: "failed",
              error: `网络中断，文件 ${file.name} 上传失败，请检查网络后重试`,
            };
          return next >= 100
            ? { ...file, progress: 100, status: "success", error: undefined }
            : { ...file, progress: next };
        }),
      }));
    }, 240);
    return () => window.clearInterval(timer);
  }, [uploading, setForm]);

  /** 上传成功后清掉对应的断点续传记录。 */
  const finishedSignature = form.files
    .filter((file) => file.status === "success")
    .map((file) => `${file.name}|${file.size}`)
    .join(",");
  useEffect(() => {
    if (!finishedSignature) return;
    const done = finishedSignature.split(",");
    const current = loadResumeTasks();
    const stale = current.filter((task) => done.includes(`${task.fileName}|${task.fileSize}`));
    if (!stale.length) return;
    for (const task of stale) removeResumeTask(task.id);
    setResumeTasks(loadResumeTasks());
  }, [finishedSignature]);

  const patchFile = (uid: string, patch: Partial<CwUploadItem>) =>
    setForm((previous) => ({
      ...previous,
      files: previous.files.map((file) =>
        file.uid === uid ? { ...file, ...patch } : file,
      ),
    }));

  /** 选文件 / 拖文件 / 点演示文件都走这里：先校验，再进上传队列。 */
  const addFile = (name: string, size: number) => {
    const checked = validateUploadFile(name, size);
    if (!checked.ok) {
      setNotice(checked.error ?? "文件校验失败");
      return;
    }
    if (form.files.length) {
      setNotice("参考资料仅支持一个文件，请先移除已上传的文件");
      return;
    }
    setNotice("");
    fileSeed += 1;
    const file: CwUploadItem = {
      uid: `upload-${fileSeed}`,
      name,
      extension: checked.extension,
      size,
      progress: 4,
      status: "uploading",
      attempts: 1,
    };
    setForm((previous) => ({ ...previous, files: [file] }));
  };

  /** 继续上传：重选原文件，文件名与大小都对得上才从断点接着传。 */
  const applyResume = (task: CoursewareResumeTask, name: string, size: number) => {
    if (form.files.length) {
      setNotice("参考资料仅支持一个文件，请先移除已上传的文件");
      return;
    }
    if (!matchesResumeFile(task, name, size)) {
      setNotice("请选择原始文件继续上传，文件名、大小或修改时间不匹配。");
      return;
    }
    const checked = validateUploadFile(name, size);
    if (!checked.ok) {
      setNotice(checked.error ?? "文件校验失败");
      return;
    }
    setNotice("");
    fileSeed += 1;
    const file: CwUploadItem = {
      uid: `upload-${fileSeed}`,
      name,
      extension: checked.extension,
      size,
      progress: task.progress,
      status: "uploading",
      attempts: 2,
    };
    setForm((previous) => ({ ...previous, files: [file] }));
    setResumeTasks(removeResumeTask(task.id));
  };

  const pickFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const pending = pendingResumeRef.current;
    if (pending) {
      pendingResumeRef.current = null;
      applyResume(pending, file.name, file.size);
      return;
    }
    addFile(file.name, file.size);
  };

  const chooseResumeFile = (task: CoursewareResumeTask) => {
    pendingResumeRef.current = task;
    if (resumeInputRef.current) {
      resumeInputRef.current.value = "";
      resumeInputRef.current.click();
    }
  };

  const discardResume = (task: CoursewareResumeTask) => {
    setResumeTasks(removeResumeTask(task.id));
    setNotice(`已丢弃「${task.fileName}」的未完成上传。`);
  };

  const pauseFile = (file: CwUploadItem) => patchFile(file.uid, { status: "paused" });
  const resumeFile = (file: CwUploadItem) => patchFile(file.uid, { status: "uploading" });
  const retryFile = (file: CwUploadItem) =>
    patchFile(file.uid, {
      status: "uploading",
      error: undefined,
      attempts: (file.attempts ?? 1) + 1,
    });

  /** 移除未完成的上传时留一条恢复记录，回到页面就能看到「可恢复的上传」。 */
  const removeFile = (file: CwUploadItem) => {
    if (file.progress > 0 && file.progress < 100)
      setResumeTasks(
        upsertResumeTask({
          id: file.uid,
          fileName: file.name,
          fileSize: file.size,
          extension: file.extension,
          progress: file.progress,
          updatedAt: new Date().toISOString(),
        }),
      );
    setForm((previous) => ({
      ...previous,
      files: previous.files.filter((item) => item.uid !== file.uid),
    }));
  };

  return (
    <div className="cw-entry-flow">
      <div className="cw-entry-card">
        <div className="cw-entry-scroll cw-entry-layout">
          <aside className="cw-entry-story">
            <span className="cw-entry-badge">
              <Sparkles size={14} /> AI 课程共创工作区
            </span>
            <div className="cw-entry-intro">
              <h1>把你的经验，变成一堂好课</h1>
              <p>
                说说你想教什么。课程助手会帮你梳理关键内容，再一起打磨大纲。
              </p>
            </div>
            <div className="cw-entry-roadmap">
              {ROADMAP.map((step) => (
                <div key={step.num} className="cw-entry-roadmap__step">
                  <span className="cw-entry-roadmap__num">{step.num}</span>
                  <div className="cw-entry-roadmap__info">
                    <strong>{step.title}</strong>
                    <small>{step.desc}</small>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="cw-entry-editor">
            <div className="cw-entry-prompt-header">
              <label htmlFor="cw-prompt">这次想做一堂什么课？</label>
              <span className="cw-entry-limit">{form.prompt.length}/12000</span>
            </div>
            <textarea
              id="cw-prompt"
              className="cw-textarea"
              maxLength={12000}
              value={form.prompt}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, prompt: event.target.value }))
              }
              placeholder="例如：给门店新人做一堂客户异议处理课，重点是客户说“太贵了”时怎么回应。"
            />

            <div className="cw-entry-examples">
              <span className="cw-entry-examples-label">
                <Lightbulb size={13} /> 灵感参考:
              </span>
              {CW_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="cw-entry-example-btn"
                  onClick={() => setForm((previous) => ({ ...previous, prompt: example }))}
                >
                  {example}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>

            <fieldset className="cw-entry-types">
              <legend>这堂课更侧重</legend>
              <div className="cw-entry-types-grid">
                {CW_COURSE_KINDS.map((kind) => (
                  <button
                    key={kind.value}
                    type="button"
                    className={`cw-entry-type-chip ${form.kind === kind.value ? "selected" : ""}`}
                    onClick={() => setForm((previous) => ({ ...previous, kind: kind.value }))}
                  >
                    {KIND_ICONS[kind.icon]}
                    {kind.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="cw-entry-file-label">添加参考资料（可选）</p>
            {/* 与 vue 一致：上传框始终保留，文件状态在框内切换 */}
            <div
              className={`cw-upload-area cw-upload-area--stable ${
                dragging ? "is-dragging" : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                pickFiles(event.dataTransfer.files);
              }}
            >
              {form.files.length ? (
                <div className="cw-upload-status">
                  {form.files.map((file) => (
                    <div key={file.uid} className="cw-upload-item">
                      <FileText size={16} color="#f97316" style={{ flex: "none" }} />
                      <div className="cw-upload-item__body">
                        <div className="cw-upload-item__line">
                          <span className="cw-upload-item__name">{file.name}</span>
                          <span className="cw-upload-item__ext">{file.extension}</span>
                        </div>
                        {file.status !== "ready" ? (
                          <div
                            className={`cw-bar ${
                              file.status === "failed"
                                ? "is-failed"
                                : file.status === "success"
                                  ? "is-success"
                                  : ""
                            }`}
                          >
                            <span style={{ width: `${file.progress}%` }} />
                          </div>
                        ) : null}
                        {file.status === "failed" && file.error ? (
                          <small className="cw-upload-item__error">{file.error}</small>
                        ) : null}
                        {file.status === "paused" ? (
                          <small className="cw-upload-item__meta">
                            已暂停 · 已上传 {file.progress}%
                          </small>
                        ) : null}
                        {file.status === "success" ? (
                          <small className="cw-upload-item__ok">
                            已上传完成，生成时会一并解析
                          </small>
                        ) : null}
                      </div>
                      {file.status === "uploading" ? (
                        <button
                          type="button"
                          className="cw-upload-action"
                          onClick={() => pauseFile(file)}
                        >
                          暂停
                        </button>
                      ) : null}
                      {file.status === "paused" ? (
                        <button
                          type="button"
                          className="cw-upload-action"
                          onClick={() => resumeFile(file)}
                        >
                          继续
                        </button>
                      ) : null}
                      {file.status === "failed" ? (
                        <button
                          type="button"
                          className="cw-upload-action is-primary"
                          onClick={() => retryFile(file)}
                        >
                          <RotateCcw size={13} /> 重试
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="cw-upload-action is-danger"
                        aria-label="移除文件"
                        title="移除（未完成的上传会写成可恢复记录）"
                        onClick={() => removeFile(file)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="cw-upload-placeholder"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="cw-upload-icon">
                    <UploadCloud size={22} />
                  </span>
                  <span className="cw-upload-area__text">
                    <strong>拖拽 PDF、Word 或 PPT 文件至此或点击上传</strong>
                    <small>支持 PDF、Word、PPT，每个文件不超过 {UPLOAD_MAX_SIZE_MB}MB</small>
                  </span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              style={{ display: "none" }}
              onChange={(event) => {
                pickFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={resumeInputRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              style={{ display: "none" }}
              onChange={(event) => {
                pickFiles(event.target.files);
                event.target.value = "";
              }}
            />

            {/* 演示辅助：点一下就走完整条上传链路，含一次失败重试与一次校验失败 */}
            <div className="cw-upload-demo">
              <span className="cw-upload-demo__label">演示：</span>
              {DEMO_UPLOAD_FILES.map((demo) => (
                <button
                  key={demo.name}
                  type="button"
                  className="cw-upload-demo__chip"
                  title={demo.hint}
                  onClick={() => addFile(demo.name, demo.size)}
                >
                  {demo.name.split(".").pop()?.toUpperCase()} · {formatFileSize(demo.size)}
                </button>
              ))}
              <label
                className="cw-upload-demo__check"
                title="走到生成末尾时停在「课件已完成、课后题失败」，用于演示重试附加题"
              >
                <input
                  type="checkbox"
                  checked={form.demoHomeworkFailure}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      demoHomeworkFailure: event.target.checked,
                    }))
                  }
                />
                课后题失败分支
              </label>
            </div>

            {notice ? (
              <p className="cw-upload-notice" role="alert">
                {notice}
              </p>
            ) : null}

            {!form.files.length && resumeTasks.length ? (
              <div className="cw-resume">
                <div className="cw-resume__head">
                  <strong>可恢复的上传</strong>
                  <span>选择原始本地文件后，可继续未完成的上传。</span>
                </div>
                {resumeTasks.map((task) => (
                  <div key={task.id} className="cw-resume__item">
                    <FileClock size={16} color="#d97706" style={{ flex: "none" }} />
                    <div className="cw-upload-item__body">
                      <div className="cw-upload-item__line">
                        <span className="cw-upload-item__name">{task.fileName}</span>
                        <span className="cw-upload-item__ext">
                          {formatFileSize(task.fileSize)}
                        </span>
                      </div>
                      <small className="cw-upload-item__meta">
                        已上传 {task.progress}% · 更新于 {formatStamp(task.updatedAt)}
                      </small>
                      <div className="cw-bar">
                        <span style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cw-upload-action is-primary"
                      onClick={() => chooseResumeFile(task)}
                    >
                      继续上传
                    </button>
                    <button
                      type="button"
                      className="cw-upload-action is-danger"
                      onClick={() => discardResume(task)}
                    >
                      丢弃
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <details className="cw-entry-settings">
              <summary>
                <SlidersHorizontal size={14} color="#b25d49" />
                <span>课程设置</span>
                <span className="hint">分类、讲解声音和生成选项</span>
              </summary>
              <div className="cw-settings-block">
                <div className="cw-settings-row">
                  <span style={{ color: "#78716c" }}>产品分类</span>
                  <strong style={{ fontWeight: 600 }}>{form.catalogLabel}</strong>
                </div>
                <div className="cw-settings-row">
                  <label className="cw-check">
                    <input
                      type="checkbox"
                      checked={form.generateHomeworkSync}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          generateHomeworkSync: event.target.checked,
                        }))
                      }
                    />
                    同步生成十道题
                  </label>
                  <label className="cw-check">
                    <input
                      type="checkbox"
                      checked={form.enableImageGeneration}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          enableImageGeneration: event.target.checked,
                        }))
                      }
                    />
                    AI 生图
                  </label>
                  <label className="cw-check">
                    <input
                      type="checkbox"
                      checked={form.outlineEnhancement}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          outlineEnhancement: event.target.checked,
                        }))
                      }
                    />
                    拆分优化
                  </label>
                </div>
                <div className="cw-settings-row">
                  <span style={{ color: "#78716c" }}>讲解角色</span>
                  <select
                    value={form.narratorVoiceId}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        narratorVoiceId: event.target.value,
                      }))
                    }
                    style={{
                      minHeight: 32,
                      minWidth: 240,
                      borderRadius: 8,
                      border: "1px solid #e7e2df",
                      background: "#fff",
                      padding: "0 8px",
                      fontSize: 12.5,
                    }}
                  >
                    {CW_NARRATORS.map((voice) => (
                      <option key={voice.voiceId} value={voice.voiceId}>
                        {voice.voiceName} · {voice.gender}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cw-mode-switch">
                  <div className="cw-mode-switch__grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <button
                      type="button"
                      className={`cw-mode-button ${form.mode === "ai-courseware" ? "selected" : ""}`}
                      onClick={() =>
                        setForm((previous) => ({ ...previous, mode: "ai-courseware" }))
                      }
                    >
                      <Wand2 size={15} /> 使用 AI 智能生成课件
                    </button>
                    <button
                      type="button"
                      disabled={!form.files.length}
                      className={`cw-mode-button ${form.mode === "script-only" ? "selected" : ""}`}
                      onClick={() => setForm((previous) => ({ ...previous, mode: "script-only" }))}
                      style={!form.files.length ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                    >
                      <FileText size={15} /> 保留原始课件，仅生成讲解
                    </button>
                  </div>
                </div>
              </div>
            </details>

            {error ? (
              <p className="studio__error" role="alert" style={{ marginTop: 12 }}>
                {error}
              </p>
            ) : null}

            <div className="cw-entry-actions">
              <label className="cw-check" style={{ fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={form.autoConfirm}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, autoConfirm: event.target.checked }))
                  }
                />
                直接完成（自动继续全流程）
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#78716c",
                    fontSize: 12.5,
                  }}
                >
                  <Languages size={14} />
                  课件语言
                  <select
                    value={form.language}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        language: event.target.value as CwForm["language"],
                      }))
                    }
                    style={{
                      minHeight: 32,
                      borderRadius: 8,
                      border: "1px solid #e7e2df",
                      background: "#fff",
                      padding: "0 8px",
                      fontSize: 12.5,
                    }}
                  >
                    {CW_LANGUAGES.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="cw-primary"
                  onClick={onStart}
                  disabled={submitting || uploading}
                >
                  <Wand2 size={16} />
                  {uploading ? "文件上传中…" : "开始共创课程"}
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
