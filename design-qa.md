# 数据审计 AI 员工 + 课件增量对齐 · v0.6.0（2026-09-16）

**Scope**：`src/pages/training-inspection/AuditConsole.tsx`（重写）、`src/pages/training-inspection/audit-console.css`、`src/pages/TrainingInspection.tsx`（视图拆分）、`src/pages/training-inspection/OverviewTab.tsx`、`src/lib/auditTools.ts`（汇报文案 / 图表数据 / 阶段旁白）、`src/lib/coursewareUpload.ts`（新增）、`src/pages/courseware/CoursewareEntry.tsx`、`CoursewareStudio.tsx`、`CoursewareResult.tsx`、`CoursewareCreateFlow.tsx`、`courseware.css`、`src/lib/coursewareStudio.ts`。

**来源**：`SalesBoost-vue@test` 的 `src/views/courseware/create/`（截至 `5e1024310`）；数据审计侧来自 `Supervisor/` 两份设计文档。

**Checks**

数据审计（AI 员工）
- 首屏只剩：徽章 + 「想问什么，直接说。」+ 输入框 + 5 个示例 chip + 三步路线 + 范围 / 周期 / 工具数 chip + 开始审计（无页面标题栏、无工具条、无平级 tab）。截图 `qa/audit-agent-entry.png`。
- 澄清：一张卡里按顺序问（时间 / 地区 / 关注方面），答完一条展开下一条并收成「✓ 本周」，可点选项、可直接打字、可「先跳过」用默认值，计数「需要你确认 · 1/3」。截图 `qa/audit-agent-clarify.png`、`audit-agent-clarify-3.png`。
- 过程：轨迹里每步是一句人话旁白 + 工具名 + 一行结果，可展开看结论 / 指标 / 明细表 / 口径 / 数据来源 / 权限码 / traceId / 耗时；右栏「已经拿到的数据」随执行追加关键数字。截图 `qa/audit-agent-running.png`。
- 汇报：一段话结论（26 项任务 / 覆盖 36 名 BA / 人均 221 分钟 / 南区最重 264 分钟 / 44 条结论里高风险 12 条 / 28 人超容量 / 7 项重复布置 / 09-20 单人 181 分钟超过 60 分钟承受线 / 建议先做哪一步）+ 6 个数字 + 各区域人均排期图 + 每天最忙图 + 需要你知道的 5 件事 + 建议 + 两处折叠（汇报背后的数据 / 这次怎么查的）+ 四个动作。截图 `qa/audit-agent-report-top.png`、`audit-agent-charts.png`、`audit-agent-report.png`。
- 双栏可交换（顺序记忆），窄屏自动隐藏；审计档案视图可回退到对话且不丢上下文。截图 `qa/audit-agent-swapped.png`、`qa/audit-archive.png`。
- 权限越界仍走「权限被拒绝」轨迹（`PERMISSION_DENIED`），不绕过 ADM 校验。

生成课件（与 vue 增量对齐）
- 上传框保留原样，文件状态在框内切换：进度条 + 暂停 / 继续 / 重试 / 移除；断点续传横幅（已上传 34% · 更新于 09/16 14:47 + 继续上传 / 丢弃）；187MB 文件在 80% 失败并给出「网络中断…」文案与重试；ZIP 走校验失败提示。截图 `qa/courseware-entry-upload.png`、`courseware-upload-progress.png`、`courseware-upload-resume.png`、`courseware-upload-failed.png`。
- 双栏中间交换按钮；⌘/Ctrl+Enter；开启「直接完成」后两轮反问与两次确认自动推进。
- 生成阶段按 generating_children → media → tts → persisting 递进；课后题失败卡给出「重试附加题」并只重跑附加题，随后进入结果页。
- 结果页：卡片可键盘触发、不可用卡降级、发布带「发布中」、预览 iframe 有加载遮罩；修掉 iframe 高度塌成 150px 的问题。截图 `qa/courseware-homework-failed.png`、`courseware-series.png`、`courseware-preview-page.png`。

通用
- `npm run lint` 0 错误、`npm run test:inspection` 57/57、`npx vite build` 通过。
- 390×844：`document.documentElement.scrollWidth === innerWidth === 390`，无横向溢出。截图 `qa/audit-agent-mobile-390.png`。

**Patches Made**

- 审计工作台的新内容不再依赖容器内滚动：改滚底部哨兵，页面滚动容器在 `main` 上也能自动跟随。
- 汇报段落里的数字与卡片统一口径（覆盖人数 vs 可计工时人数分开说），避免「28 人 / 36 人」打架。
- 日曲线标签从「17」改成「周三 17」，区域 0 任务改成「本期无任务」。
- 轨迹行排版：旁白一行、工具名与结果一行，窄屏把结果放到第二行占满宽度（原来被挤到十几个像素）。
- 结果页预览 iframe 高度塌陷（`height:100%` 在 flex 子项里不生效）改为 `position:absolute; inset:0`。

**Follow-up Polish**

- vue 侧仍在迭代（`5e1024310` 之后可能还有新的上传 / 大纲交互），再同步时优先看 `CoursewareStudio.vue` 与 `index.vue` 的上传区和面板区。
- 课程设置的分类级联、真实音色列表、真实封面 / 下载 / 发布仍是原型取舍，见 `COURSEWARE_STUDIO.md`「仍未对齐的地方」。

final result: passed
