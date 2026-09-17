# SalesBoost AI（Beauty-AI）

面向总部培训团队、区域培训负责人和门店管理者的培训管理后台。
围绕「内容建设 → 任务分发 → 学习与考核 → 问题识别 → 整改复盘」组织工作，
覆盖课件、题库、AI 陪练、媒体素材、组织档案与数据审计。

> 本仓库是**可运行的前端演示原型**：没有真实后端，所有接口都由浏览器内的本地 mock 提供，
> 任务、人员、AI 分析与管理指标以演示数据为主（课件生成链路按真实接口协议完整复现）。

## 技术栈

| 项 | 选型 |
| --- | --- |
| 框架 | Vue 3.5 + TypeScript（`<script setup>`）+ Vite 5 |
| UI | Element Plus 2.11 + UnoCSS（原子类）+ SCSS |
| 状态/路由 | Pinia（persist）+ Vue Router 4 |
| 国际化 | vue-i18n（框架层）+ 原型自带字典（`zh / en / id`，见 `src/beauty/lib/i18n.ts`） |
| 图表 | ECharts（`src/components/Echart`） |

工程底座取自 `SalesBoost-vue`（yudao-ui-admin-vue3）的裁剪版：保留布局、菜单、权限指令、
多语言、主题与常用组件，剔除与业务无关的模块（bpm / erp / mall / mp / mes / crm / iot / pay / points 等）。

## 快速开始

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

登录：用户名任意（`admin` / `hq_trainer` / `regional_tm` / `regional_trainer` / `regional_manager`），密码任意。
顶部工具条右侧的「角色切换」可以在 5 个演示角色之间切换，菜单与数据范围随之变化。

| 角色 | 入口 |
| --- | --- |
| 超级管理员 | 运行概览 / 组织架构 / 账号管理 / 品类设置 / 通知设置 / 媒体与审计 / BA打卡记录 / 素材库 / 知识图谱 |
| 总部培训 | 全国数据 / 数据审计 / 在线课件 / AI陪练 / 题目与考试 / 周期任务 / 组织与档案 |
| 区域培训负责人、区域培训师 | 区域数据 / 数据审计 / 区域补充内容 / 周期任务（培训负责人另有组织与档案） |
| 区域经理 | 区域数据 / 数据审计 / 周期任务监控 / 组织与档案 |

## 本地 mock（没有后端）

`src/mock/` 是一个装在 axios adapter 上的假后端：

- 请求/响应仍是 yudao 的 `{ code, data, msg }` 形态，所以**复制的业务页面不需要任何改动**；
- 演示数据与「生成任务」状态机存在 `localStorage`（键：`beauty-ai:mock-courseware-store`），刷新不丢；
- 需要排查接口时执行 `localStorage.setItem('beauty-ai:mock-log','1')` 再刷新，控制台会打印每个请求；
- 覆盖范围：登录/权限菜单/字典/站内信、课件（生成任务全套 + 课件库 + 品牌品类产品 + 上传会话 + 音色）、资源区域。

## 目录约定

```
src/
├── api/                 # 接口定义（courseware 为原样复用 SalesBoost-vue 的源码）
├── beauty/              # 原型业务资产
│   ├── lib/             # 与原型逐字一致的纯逻辑（巡检引擎、题库、审计、素材、档案…）
│   ├── composables/     # Vue 组合式函数（useBeautyI18n / useInspectionState / useRequirements / useQuestionBank）
│   └── types.ts
├── components/          # 通用组件（Icon / ContentWrap / Echart / UploadFile / CoursewareGenerationPrompt…）
├── layout/              # 布局、菜单、标签页、角色切换器
├── locales/             # 框架与菜单的多语言
├── mock/                # 浏览器内假后端（adapter + 路由表 + 演示数据）
├── views/
│   ├── courseware/      # 课件模块：直接复用 SalesBoost-vue@test 的源码（生成/管理/音色）
│   └── beauty/          # 原型页面移植（看板、数据审计、任务、考试、AI 陪练、素材、档案…）
└── styles/              # 设计令牌（--beauty-*）与全局样式
```

页面移植规范见 [`docs/BEAUTY-PORT-GUIDE.md`](docs/BEAUTY-PORT-GUIDE.md)。

## 常用命令

```bash
pnpm dev                # 开发服务器
pnpm build              # 构建（等价 build:dev）
pnpm ts:check           # vue-tsc --noEmit（需要 8G 堆）
pnpm test:beauty        # 原型逻辑库的单元测试（node:test，57 个用例）
pnpm test:unit          # vitest（框架层用例）
pnpm lint:eslint        # eslint
pnpm lint:format        # prettier
```

> `src/types/auto-imports.d.ts` 与 `auto-components.d.ts` 由构建/开发服务器自动生成（未纳入版本管理）。
> 首次拉代码后先跑一次 `pnpm dev` 或 `pnpm build`，再执行 `pnpm ts:check`，否则会出现「找不到 ElMessage」这类假报错。

## 原型文档

React 原型留下的产品与验证记录仍在仓库里，可作为业务口径参考：

- `CHANGELOG.md`、`PRODUCT_NOTES.md`、`TRAINING_INSPECTION.md`、`COURSEWARE_STUDIO.md`、`design-qa.md`
- `qa/`：原型各页面的验收截图
- 原型源码只读副本：`/Users/lee/Projects/SalesBoost/.beauty-react-ref`（本仓库的 git worktree）

## 部署

- 构建产物为纯静态资源（`dist/`），可直接放到静态服务器/对象存储；
- 后端地址支持运行时注入：`public/config.js` 的 `window.__RUNTIME_CONFIG__.VITE_BASE_URL`；
- 容器化：`Dockerfile.ci` + `nginx.conf`（把 `dist/` 拷进 nginx 镜像即可）。
