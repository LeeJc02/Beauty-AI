import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Download,
  Layers3,
  LoaderCircle,
  Presentation,
  Send,
} from "lucide-react";
import {
  resolvePartState,
  resolveResultState,
  slidePreviewHtml,
  type CwTask,
} from "../../lib/coursewareStudio";

export function CoursewareResult({
  task,
  onRestart,
}: {
  task: CwTask;
  onRestart: () => void;
}) {
  const state = resolveResultState(task);
  const [current, setCurrent] = useState<number | null>(null);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  /** 演示发布：转一下再置为已发布（真实链路是调发布接口）。 */
  const publish = () => {
    if (publishing || published) return;
    setPublishing(true);
    window.setTimeout(() => {
      setPublishing(false);
      setPublished(true);
    }, 900);
  };

  if (state.mode === "none") return null;

  const items = state.items;
  const single = current !== null ? items.find((item) => item.partIndex === current) : null;

  if (state.mode === "preview" || single) {
    const target = single ?? (state.mode === "preview" ? state.current : null);
    const index = target?.partIndex ?? 1;
    const title = target?.title ?? "课件预览";
    return (
      <div className="cw-series" style={{ background: "#f8f5f3" }}>
        <div className="cw-preview-bar">
          {items.length > 1 ? (
            <button
              type="button"
              className="cw-ghost"
              onClick={() => {
                setCurrent(null);
                setIframeLoading(true);
              }}
            >
              <ArrowLeft size={14} /> 返回列表
            </button>
          ) : null}
          <button type="button" className="cw-ghost" onClick={onRestart}>
            <Layers3 size={14} /> 返回创建
          </button>
          <button
            type="button"
            className="cw-ghost"
            title="演示环境：下载会拉取课件的 pptx 导出包"
            onClick={() => window.alert("演示环境：下载会拉取课件的 pptx 导出包。")}
          >
            <Download size={14} /> 下载课件
          </button>
          <button
            type="button"
            className="cw-primary"
            disabled={published || publishing || iframeLoading}
            onClick={publish}
          >
            {published ? (
              <>
                <Check size={15} /> 已发布
              </>
            ) : publishing ? (
              <>
                <LoaderCircle size={15} className="cw-spin" /> 发布中
              </>
            ) : (
              <>
                <Send size={15} /> 发布课件
              </>
            )}
          </button>
        </div>
        <div className="cw-preview-stage">
          <iframe
            title={title}
            srcDoc={slidePreviewHtml(title, index, 1)}
            sandbox="allow-scripts"
            onLoad={() => setIframeLoading(false)}
          />
          {iframeLoading ? (
            <div className="cw-preview-loading" role="status">
              <LoaderCircle size={20} className="cw-spin" />
              <span>正在加载课件…</span>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="cw-series">
      <div className="cw-series__content">
        <header className="cw-series__header">
          <div>
            <h2 className="cw-series__title">
              {task.series?.title ?? task.title ?? "系列课件"}
            </h2>
            <p className="cw-series__description">
              已智能拆分为 {items.length} 个子课件，可按顺序预览或下载。
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="cw-series__summary">
              <Layers3 size={16} />
              <strong>{items.length}</strong>
              <span>个子课件</span>
            </span>
            <button type="button" className="cw-ghost" onClick={onRestart}>
              <ArrowLeft size={14} /> 返回创建
            </button>
          </div>
        </header>

        <div className="cw-series__grid">
          {items.map((item) => {
            const part = resolvePartState(item);
            const available = part.state === "SUCCEEDED";
            const openPreview = () => {
              if (!available) return;
              setIframeLoading(true);
              setCurrent(item.partIndex);
            };
            return (
              <article
                key={item.childJobId}
                className={`cw-series-card ${available ? "" : "is-unavailable"}`}
                role={available ? "button" : undefined}
                tabIndex={available ? 0 : -1}
                aria-disabled={available ? undefined : true}
                title={available ? "打开只读预览" : part.note ?? part.label}
                onClick={openPreview}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openPreview();
                  }
                }}
              >
                <div className="cw-series-card__cover">
                  <div className="cw-series-card__fallback">
                    <span>{String(item.partIndex).padStart(2, "0")}</span>
                    <Presentation size={30} />
                  </div>
                  <div className="cw-series-card__cover-meta">
                    <span className="cw-series-card__part">
                      第 {item.partIndex}/{item.partCount} 部分
                    </span>
                    <span
                      className={`cw-series-card__status is-${part.state.toLowerCase()}`}
                    >
                      {part.label}
                    </span>
                  </div>
                </div>
                <div className="cw-series-card__body">
                  <h3>{item.title}</h3>
                  {item.estimatedDurationSeconds ? (
                    <div className="cw-series-card__duration">
                      <Clock3 size={14} />
                      预计 {Math.max(1, Math.round(item.estimatedDurationSeconds / 60))} 分钟
                    </div>
                  ) : null}
                  {part.note ? <p className="cw-series-card__note">{part.note}</p> : null}
                  {item.error ? <p className="cw-series-card__error">{item.error}</p> : null}
                </div>
                <div className="cw-series-card__actions">
                  <button
                    type="button"
                    className="cw-ghost"
                    disabled={!available}
                    title="演示环境：下载该子课件的 pptx 导出包"
                    onClick={(event) => {
                      event.stopPropagation();
                      window.alert("演示环境：下载该子课件的 pptx 导出包。");
                    }}
                  >
                    <Download size={14} /> 下载
                  </button>
                  <button
                    type="button"
                    className="cw-primary"
                    disabled={!available}
                    onClick={(event) => {
                      event.stopPropagation();
                      openPreview();
                    }}
                  >
                    预览 <ArrowRight size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
