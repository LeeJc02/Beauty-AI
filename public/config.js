// 运行时配置：部署侧可用 ConfigMap 覆盖此文件切换后端地址。
// 留空 = 使用构建时烧入的默认值（各环境 .env.[mode]）。
window.__RUNTIME_CONFIG__ = {
  VITE_BASE_URL: ''
}
