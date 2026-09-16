# 生成课件复刻 + 数据审计改版 · v0.5.0（2026-09-16）

**Scope**: `src/pages/courseware/`（新增：入口卡 / 课程共创工作台 / 结果页 / courseware.css）、`src/lib/coursewareStudio.ts`（VO + 演示帧）、`src/pages/CourseCreation.tsx`（改为委派）、`src/pages/training-inspection/AuditConsole.tsx` 与 `audit-console.css`（改成同款卡片式交互）。

**来源**：`SalesBoost-vue@test` 的 `src/views/courseware/create/`（index.vue 3804 行 + CoursewareStudio.vue 1500 行 + coursewareStudio.scss 2048 行 + generationTask/studioDraft）、`src/locales/modules/coursewareStudio.ts`、`SalesBoost-adm@test` 的 generation-task 契约。

**Checks**

- 入口卡：徽章「AI 课程共创工作区」+ 「把你的经验，变成一堂好课」+ 三步路线图 + 提示词（0/12000 计数）+ 3 个灵感示例 + 课程类型四选一 + 参考资料上传（点击即演示上传到 100%）+ 课程设置折叠 + 自动完成开关 + 课件语言 + 「开始共创课程」。截图 `qa/courseware-entry.png`。
- 卡片切换：入口卡只淡出（0.7s 不位移），工作台淡入并上浮 8px（0.9s），左右面板再错峰 140ms —— 对齐 `cw-swap` + `studio-expand-left`；`prefers-reduced-motion` 下动效归零。
- 课程共创工作台：顶部四段轨道（梳理目标 / 课程规划 / 确认大纲 / 生成课件）+ 课题胶囊 + 「进度已保存」+ 阶段标签；左栏教练条（结束本次制作 / 课程共创助手 / 第 1 轮）+ 用户气泡 + 反问卡（「为什么问」+ 选项 + 推荐「建议」徽章 + None·我自己填写 + 补充细节）；右栏空态三张蓝图卡。截图 `qa/courseware-interview.png`。
- 两轮反问 → 课程规划（8 章节，摘要可编辑，含尚待确认的假设）→ 大纲勾选（3 个子课件 6/8/5 页，勾选框 + 编号 + 类型徽章 + 描述片段 + 编辑）。截图 `qa/courseware-outline.png`。
- 逐页制作：状态卡「正在逐页制作 · 子课件 1/3 生成中」+ 呼吸 orb + 课件制作进度 14% + 离开提示 + 三个子课件进度（22% 制作中 / 0% 等待制作）；右栏页面制作列表按 PPT 分页签切换，含自动重试与媒体待处理提示、课后练习卡。截图 `qa/courseware-generating.png`。
- 完成：系列课件列表（3 张卡，三套封面色 + 第 N/3 部分 + 已完成 + 预计时长 + 下载/预览）→ 单课件只读预览（iframe 现场生成的讲解页 HTML，工具栏含返回列表 / 返回创建 / 下载课件 / 发布课件）。截图 `qa/courseware-preview.png`。
- 数据审计：初始简卡（“想让 Agent 查什么？”+ 示例 chip + 开始审计）→ 淡出后浮现审计工作台；顶部四段轨道「补齐条件 / 工具取数 / 规则审计 / 报告」走到第 4 段，左栏工具调用卡（ADM 徽章、`tool_call_completed`、traceId、权限码、实参、结论、指标、可展开明细表 / 口径 / 数据来源），右栏审计口径与工具白名单（调用次数 ×1 + 最近结论，可单独调用）。截图 `qa/audit-entry-card.png`、`qa/audit-tool-trajectory.png`、`qa/audit-report.png`。
- 移动端 390×844：两个页面 `document.documentElement.scrollWidth === innerWidth === 390`，无横向溢出；工作台切到「与 AI 共创 / 课程草稿」双 tab，审计页双栏纵向堆叠，教练条不换行。截图 `qa/courseware-mobile-390.png`、`qa/audit-mobile-390.png`。
- `npm run lint` 0 错误、`npm run test:inspection` 57/57、`npx vite build` 通过；控制台只有 favicon 404。

**Patches Made**

- 确认大纲后按钮会跳回上一步：`confirm()` 不再把 `partSelection.required` 置 false，交给生成阶段自己收掉。
- 预览页在小视口下溢出：`slidePreviewHtml()` 的幻灯片宽度改为 `min(1120px, 92vw, (100vh - 64px) * 16 / 9)`。
- 窄屏教练条换行：≤768px 时保持单行并收紧内边距。

**Follow-up Polish**

- 演示数据不连后端；真实接入时把 `buildFrames()` 换回 `generation-task` 轮询 + SSE 即可，组件层不用改。

final result: passed

---

