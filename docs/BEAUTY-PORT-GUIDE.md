# Beauty-AI 页面移植指南（React → Vue3）

本仓库已从 React 原型（`react-example`，React 19 + Tailwind v4）重构为 **Vue3 + Element Plus** 工程，
底座取自 `SalesBoost-vue`（yudao-ui-admin-vue3 的裁剪版）。

- 原型只读副本：`/Users/lee/Projects/SalesBoost/.beauty-react-ref/`（`src/pages/**`、`src/components/**`）
- 课件模块直接复用 `SalesBoost-vue@test` 的源码，**不在本次移植范围内**（`src/views/courseware/**`）
- 其它页面按本指南逐个把 React 组件改写为 Vue SFC，落在 `src/views/beauty/**`

## 一、页面映射表

| 目标文件 | 原型来源 |
| --- | --- |
| `beauty/dashboard/overview/index.vue` | `pages/SADashboard.tsx` |
| `beauty/dashboard/national/index.vue` | `pages/HTDashboard.tsx` |
| `beauty/dashboard/regional/index.vue` | `pages/Dashboard.tsx` + `pages/RTDashboard.tsx` + `pages/RTMDashboard.tsx`（按角色取不同视图） |
| `beauty/audit/index.vue` | `pages/TrainingInspection.tsx` + `pages/training-inspection/**` |
| `beauty/organization/index.vue` | `pages/OrganizationView.tsx` |
| `beauty/accounts/index.vue` | `pages/UsersManage.tsx` |
| `beauty/categories/index.vue` | `pages/CategoryManage.tsx` |
| `beauty/notifications/index.vue` | `pages/NotificationSettings.tsx` |
| `beauty/knowledge-graph/index.vue` | `pages/KnowledgeGraph.tsx` |
| `beauty/ba/avatars/index.vue` | `pages/BAAvatars.tsx` |
| `beauty/ba/scripts/index.vue` | `pages/BAScripts.tsx` + `pages/RTBAScripts.tsx` |
| `beauty/ba/quotes/index.vue` | `pages/BAQuotes.tsx` |
| `beauty/material-library/index.vue` | `pages/MaterialLibrary.tsx` |
| `beauty/exam/generate/index.vue` | `pages/ExamGenerate.tsx` |
| `beauty/exam/bank/index.vue` | `pages/ExamBank.tsx` |
| `beauty/exam/homework/index.vue` | `pages/ExamHomework.tsx` |
| `beauty/exam/assemble/index.vue` | `pages/ExamManage.tsx` |
| `beauty/tasks/study/index.vue` | `pages/StudyTaskManage.tsx` |
| `beauty/tasks/practice/index.vue` | `pages/PracticeTaskManage.tsx` |
| `beauty/tasks/media-collection/index.vue` | `pages/MediaCollectionTaskManage.tsx` |
| `beauty/tasks/photo-checkin/index.vue` | `pages/PhotoCheckinRecords.tsx` |
| `beauty/tasks/exam/index.vue` | `pages/ExamTaskManage.tsx` |
| `beauty/archives/stores/index.vue` | `pages/StoreArchive.tsx` |
| `beauty/archives/personnel/index.vue` | `pages/PersonnelArchive.tsx` |

`beauty/media-collection/index.vue`（超管「媒体与审计」）与 `beauty/tasks/media-collection/index.vue`
指向同一份实现，直接复用即可。

## 二、可直接复用的移植成果（**不要重写**）

| 能力 | 位置 | 说明 |
| --- | --- | --- |
| 业务纯逻辑（巡检引擎、题库、审计、素材、档案数据…） | `@/beauty/lib/*` | 与原型逐字一致的 TS 模块 |
| 领域类型 | `@/beauty/types` | 原型 `src/types.ts` |
| 多语言 | `@/beauty/composables` 的 `useBeautyI18n()` | `const { t, language } = useBeautyI18n()`，`t('中文原文')` |
| 巡检状态 | `useInspectionState()` | 返回 `{ state, storageError, setState, reset, refresh }`，`state` 是 `Ref` |
| 自定义巡检需求 | `useRequirements()` | 返回 `{ requirements, storageError, create, update, remove, markViewed, refresh }` |
| 题库 | `useQuestionBank()` | 返回 `{ questions, tags, addQuestions, updateQuestion, removeQuestion, bulkAddTags, bulkSetStatus, generateVariants, addTag, renameTag, deleteTag }` |

**Ref 语义**：这些组合式函数返回的 `Ref` 在**模板里自动解包**（模板写 `state.tasks`），
在 `<script setup>` 里需要 `.value`（脚本写 `state.value.tasks`）。

原型的 `lib/i18n.tsx` 自带「DOM 翻译运行时」，已在 `App.vue` 全局启动：
页面上写中文原文即可，切换语言时会自动替换（需要跳过的节点加 `data-i18n-skip="true"`）。

## 三、技术约定

1. 组件写法：`<script setup lang="ts">` + `defineOptions({ name: 'BeautyXxx' })`，模板用 Element Plus + unocss 原子类。
2. 图标：原型用 `lucide-react`，这里统一用 yudao 的全局组件 `<Icon icon="lucide:shield-check" :size="16" />`
   （图标名 = lucide 组件名的 kebab-case；也可用 `ep:` 前缀的 Element Plus 图标）。
3. 样式：
   - 优先用 unocss 原子类（和 Tailwind 基本同名：`flex items-center gap-3 rounded-xl bg-[#171518] text-[13px]`）。
   - 设计令牌直接复用 `src/styles/var.css` 里的 `--beauty-*` 变量（如 `bg-[var(--beauty-card-bg)]`）。
   - 复杂样式写 `<style lang="scss" scoped>`，**类名语义与原型一致**，数值原样搬。
   - unocss 不支持的 Tailwind 写法（如 `space-x-*`、`divide-*`、`group-hover:` 之外的变体）改用显式 margin/边框或 scoped scss。
4. 交互控件：
   - 按钮 `el-button`（主按钮 `type="primary"`），弹窗 `el-dialog`/`el-drawer`，表格 `el-table`，
     标签页 `el-tabs`，下拉 `el-select`，开关 `el-switch`，日期 `el-date-picker`，提示 `ElMessage`。
   - 原型的自定义卡片/徽标/进度条等**保留 DOM 结构与样式**，不要硬套 Element Plus 组件（以免视觉跑偏）。
5. 图表：原型只有 `ExamTaskManage.tsx` 用了 recharts，改写为 yudao 的
   `<Echart :options="option" height="260px" />`（`options` 是 echarts `EChartsOption`）。
6. 数据：**全部来自 `@/beauty/lib/*` 的演示数据与 localStorage 持久化**，不要新增 mock 接口
   （课件模块除外，它有自己的 mock）。
7. 类型：`vue-tsc --noEmit` 必须 0 错误；不要用 `any` 绕过（确实需要时加注释说明）。
8. 注释与文案：注释用中文；界面文案保持原型中文原文（交给 `useBeautyI18n` 翻译）。

## 四、边界（重要）

- 只改自己负责的 `src/views/beauty/**` 下的文件；需要拆子组件时放在同目录 `components/` 下。
- **不要修改** `src/mock/**`、`src/beauty/lib/**`、`src/beauty/composables/**`、`src/layout/**`、
  `src/router/**`、`src/locales/**`、`src/components/**`、`package.json`、`vite.config.ts`、`tsconfig.json`。
- 如果确实需要改共享文件，请在交付说明里写清楚原因，不要直接改。

## 五、完成标准

1. 页面在 `http://localhost:3001` 下（用 `admin` / 任意密码登录，顶部可切换演示角色）能打开、无控制台报错。
2. 与原型的**信息层级、区块顺序、关键文案、交互路径**一致；同一角色下的菜单入口保持不变。
3. 页面内的增删改（如新建任务、批量打标签、导出、切换筛选）在本地演示数据上行为等价。
4. `npx vue-tsc --noEmit` 无新增错误；`npx eslint --ext .vue,.ts src/views/beauty/<你的目录>` 无 error。
5. 交付说明里列出：目标文件、原型来源、做了哪些取舍（例如 recharts → echarts、自定义图表保留等）。
