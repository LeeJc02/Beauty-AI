/**
 * 受限环境下的安全存储封装
 *
 * Codex 内置浏览器 / 沙箱 iframe 等受限环境里，访问 window.localStorage 会直接抛出
 * SecurityError（即使只是读取）。首屏渲染阶段一旦抛出且没人捕获，React 会整体卸载，
 * 表现就是「纯白屏」而控制台之外什么提示都没有。
 *
 * 这里统一做降级：能持久化就用 localStorage，被禁用就退回内存存储，
 * 保证页面照常渲染，只是刷新后不再保留选择。
 */

let resolved: Storage | null | undefined;
const memory = new Map<string, string>();

function storage(): Storage | null {
  if (resolved !== undefined) return resolved;
  try {
    const store = window.localStorage;
    const probe = '__salesboost-storage-probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    resolved = store;
  } catch {
    resolved = null;
  }
  return resolved;
}

export const safeStorage = {
  /** 当前环境是否支持持久化存储 */
  get persistent() {
    return storage() !== null;
  },
  getItem(key: string): string | null {
    const store = storage();
    if (store) {
      try {
        return store.getItem(key);
      } catch {
        /* 读取失败时回退到内存 */
      }
    }
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  setItem(key: string, value: string): void {
    const store = storage();
    if (store) {
      try {
        store.setItem(key, value);
        return;
      } catch {
        /* 写入失败（如配额、隐私模式）时回退到内存 */
      }
    }
    memory.set(key, value);
  },
  removeItem(key: string): void {
    const store = storage();
    if (store) {
      try {
        store.removeItem(key);
      } catch {
        /* 忽略 */
      }
    }
    memory.delete(key);
  },
};
