import React from 'react';
import { safeStorage } from '../lib/safeStorage';

type Props = { children: React.ReactNode };
type State = { error: Error | null; componentStack: string };

const INSPECTION_KEY = 'salesboost.training-inspection.v2';

/**
 * 兜底错误边界：任何渲染期异常都以可读卡片呈现，而不是整页白屏。
 * 样式使用内联 style，确保即使 CSS 未加载 / 校验失败也能正常显示。
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 页面渲染失败:', error, info.componentStack);
    (this as any).setState({ componentStack: info?.componentStack || '' });
  }

  private reload = () => {
    (this as any).setState({ error: null });
    window.location.reload();
  };

  private resetDemoData = () => {
    safeStorage.removeItem(INSPECTION_KEY);
    try {
      window.localStorage.removeItem(INSPECTION_KEY);
    } catch {
      /* 存储不可用时忽略 */
    }
    window.location.reload();
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return (this as any).props.children;

    let storageInfo = '不可用';
    try {
      const raw = window.localStorage.getItem(INSPECTION_KEY);
      storageInfo = raw ? `存在，${raw.length} 字节` : '无存档（首次打开）';
    } catch {
      storageInfo = '被浏览器沙箱禁用';
    }

    const stack = (error.stack || '')
      .split('\n')
      .slice(0, 8)
      .join('\n')
      .replace(/https?:\/\/[^ )]+\//g, '');

    const componentPath = componentStack
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join('  ←  ');

    const pre: React.CSSProperties = {
      margin: '10px 0 0',
      padding: '10px 12px',
      background: '#f1f5f9',
      borderRadius: 10,
      fontSize: 12,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxHeight: 180,
      overflow: 'auto',
    };
    const button = (primary: boolean): React.CSSProperties => ({
      padding: '9px 16px',
      borderRadius: 10,
      border: primary ? 'none' : '1px solid #cbd5e1',
      background: primary ? '#0f172a' : '#fff',
      color: primary ? '#fff' : '#0f172a',
      fontSize: 14,
      cursor: 'pointer',
    });

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f8fafc',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
          color: '#0f172a',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '24px 28px',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            页面启动失败，已阻止白屏
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: '#475569' }}>
            把下面整块信息截图发给 Codex，即可定位问题；也可以先点「重置本地演示数据」试试。
          </div>

          <pre style={pre}>
            {error.name}: {error.message}
          </pre>

          {componentPath && (
            <>
              <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                出错组件
              </div>
              <pre style={pre}>{componentPath}</pre>
            </>
          )}

          {stack && (
            <>
              <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                代码位置
              </div>
              <pre style={pre}>{stack}</pre>
            </>
          )}

          <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.8, color: '#64748b' }}>
            本地存档：{storageInfo}
            <br />
            页面地址：{window.location.pathname + window.location.search + window.location.hash}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" onClick={this.reload} style={button(true)}>
              重新加载
            </button>
            <button type="button" onClick={this.resetDemoData} style={button(false)}>
              重置本地演示数据
            </button>
          </div>
        </div>
      </div>
    );
  }
}
