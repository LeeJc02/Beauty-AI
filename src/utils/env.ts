/**
 * 运行时环境变量读取
 *
 * 优先读 window.__RUNTIME_CONFIG__（由部署侧通过 ConfigMap 挂载的 /config.js 注入），
 * 为空时回退到 Vite 构建时烧入的 import.meta.env 值。
 *
 * 用途：同一镜像在不同集群间切换后端地址（如 demo 集群），
 * 无需为换域名重新构建。
 */
export const runtimeEnv = (key: string): string => {
  const runtime = (window as any).__RUNTIME_CONFIG__?.[key]
  return runtime || import.meta.env[key]
}
