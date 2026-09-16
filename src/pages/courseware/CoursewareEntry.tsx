import React, { useEffect } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FileText,
  Languages,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Sparkles,
  SlidersHorizontal,
  Trash2,
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
  /** 演示用的上传：点一下就往列表里放一个文件，并把进度推到 100%。 */
  const uploading = form.files.some((file) => file.status === "uploading");

  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => {
      setForm((previous) => ({
        ...previous,
        files: previous.files.map((file) =>
          file.status !== "uploading"
            ? file
            : file.progress >= 100
              ? { ...file, progress: 100, status: "success" }
              : { ...file, progress: Math.min(100, file.progress + 14) },
        ),
      }));
    }, 180);
    return () => window.clearInterval(timer);
  }, [uploading, setForm]);

  const addMockFile = () => {
    if (form.files.length) return;
    fileSeed += 1;
    const file: CwUploadItem = {
      uid: `upload-${fileSeed}`,
      name: "Y.O.U_BarrierShield_门店培训材料.pptx",
      extension: "pptx",
      size: 53.7 * 1024 * 1024,
      progress: 6,
      status: "uploading",
    };
    setForm((previous) => ({ ...previous, files: [file] }));
  };

  const removeFile = (uid: string) =>
    setForm((previous) => ({
      ...previous,
      files: previous.files.filter((file) => file.uid !== uid),
    }));

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
            {form.files.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {form.files.map((file) => (
                  <div key={file.uid} className="cw-upload-item">
                    <FileText size={16} color="#f97316" style={{ flex: "none" }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="cw-upload-item__name">{file.name}</span>
                        <span style={{ color: "#9a9396", fontSize: 11, textTransform: "uppercase" }}>
                          {file.extension}
                        </span>
                      </div>
                      {file.status !== "success" ? (
                        <div className="cw-bar">
                          <span style={{ width: `${file.progress}%` }} />
                        </div>
                      ) : (
                        <small style={{ color: "#3b8f72", fontSize: 11 }}>
                          已上传完成，生成时会一并解析
                        </small>
                      )}
                    </div>
                    <button
                      type="button"
                      className="studio__text-button"
                      onClick={() => removeFile(file.uid)}
                      aria-label="移除文件"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button type="button" className="cw-upload-area" onClick={addMockFile}>
                <span className="cw-upload-icon">
                  <UploadCloud size={22} />
                </span>
                <span className="cw-upload-area__text">
                  <strong>拖拽 PDF、Word 或 PPT 文件至此或点击上传</strong>
                  <small>支持 PDF、Word、PPT，参考资料只保留一个文件</small>
                </span>
              </button>
            )}

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
