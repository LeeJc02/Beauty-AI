# 自定义巡检需求（Agent 创建）· v0.3.2（2026-09-14）

**Scope**: `src/pages/training-inspection/AgentPanel.tsx`（创建向导）、`src/pages/training-inspection/RequirementTab.tsx`（专属标签页）、`src/lib/inspectionRequirements.ts` 与 `src/lib/requirementStore.ts`（计算与存储）、`src/pages/TrainingInspection.tsx`（标签页接线）。

**Checks**

- 向导主流程：点「新建一个巡检需求」→ 关注方面多选（重复布置 + 时间集中）→ 范围（雅加达南区）→ 周期（每周一 08:00）→ 起止（连续 4 周）→ 确认页显示默认名称并可改 → 创建成功自动切到新标签页；截图 `qa/requirement-wizard-aspects.png`、`qa/requirement-wizard-confirm.png`。
- 选项与打字并行：四步全程保留输入框且提示语跟着步骤变（「也可以打字：……」）。整条流程只用打字跑一遍——「重复布置和时间集中都要盯」→「南区」→「看心情」（认不出 → 提示周期只有三种并留在原步骤）→「每周一」→「从今天起连续 4 周」→「确认」，创建结果与点按钮一致（`aspects=[duplicate,crowding]`、`regionId=south`、`cadence=weekly`、`09/14–10/11`）；截图 `qa/requirement-wizard-typing.png`、`qa/requirement-tab-from-typing.png`。
- 自定义日期：数据不全 · 全国 · 每月 1 日 · 09/20–12/31，创建后顶部显示「下次运行 10/01 08:00」，开始日期之前没有批次；截图 `qa/requirement-wizard-custom-dates.png`。
- 标签页：`巡检总览 | 区域负担 | 雅加达南区综合每周巡检`，内容为状态摘要（发现的问题 / 受影响的 BA / 人均分钟 / 最近一次运行）→ 现在关注到的问题 → 运行记录；截图 `qa/requirement-tab.png`、`qa/requirement-run-records.png`。
- 运行：周一 08:00 已过点，打开页面自动补跑一条批次（`lastAutoDay` 记录当天，刷新不会重复）；再点「立即巡检」结论没变，只合并成一条并提示「结论和上次一样」。
- 暂停 / 继续、切换统计周（周期行与问题清单跟着变）均正常。
- 区域账号：切到南区培训主管后向导不再问范围，直接提示「你的账号只看得到雅加达南区」，创建结果 `regionId = south`，人数按南区收窄（12 人，而不是全国口径的 36 人）；截图 `qa/requirement-tab-region.png`。
- 「看任务」跳到区域负担并定位对应任务行；截图 `qa/requirement-focus-task.png`。
- 关闭：tab 上的 × 与 tab 内的「删除」都先弹二次确认，确认后标签页与本地记录一起删除；截图 `qa/requirement-delete-confirm.png`。
- 数量上限：预置 6 条后再创建，Agent 回复「最多同时保留 6 个自定义巡检，请先在标签页上关掉不用的」，本地记录仍为 6 条；截图 `qa/requirement-limit.png`。
- 刷新后标签页、运行记录与暂停状态都保留（`salesboost.training-inspection.requirements.v1`）。
- 「包含特定品类」：关注方面里第 4 项已改为「包含特定品类」（原来的「数据不全」下线，历史存档仍兼容）。只选它时向导多问一步「要看哪些品类？」，选项来自数据里真实出现的品类（新品 / 护肤 / 异议处理 / 服务力 / 敏感肌 / 彩妆 / 销售话术 + 以上都要 + 下一步），步骤计数显示「第 2 步 / 共 5 步」；打字「新品和敏感肌」也能识别。建成后标签页显示「关注：包含特定品类（新品、敏感肌）」，问题清单只保留这些品类任务上的结论（31 项，按任务名可核对）；截图 `qa/requirement-wizard-category.png`、`qa/requirement-tab-category.png`。
- 演示结论口径：总览结论区现在是四条——负荷叠加（南区人均负荷超过容量）· 时间集中（必修与考试在 4 天内叠加）· 重复布置（同源内容重复安排）· **品类覆盖（「彩妆」在 3 个区域没有任务，影响 28 人 · 雅加达南区、巴厘岛区 等 3 个区域）**；「角色不适用」不再出现（页面上搜不到「不适用角色」）。截图 `qa/inspection-conclusions-mock.png`。
- Agent 回答：问「现在有哪些任务需要我处理？」时，每条建议带上区域前缀、任务名超过 3 个折成「等 N 项」，同一说法不再重复刷屏；截图 `qa/inspection-mock-realism.png`。
- 对话面板标题改为「和巡检Agent对话」；「最近一次巡检」右上角显示真实频次「每 30 分钟自动巡检一次，有变化才记新批次（想改对 Agent 说「改成每 2 小时一次」）」。
- 区域负担任务行：「调整」已改成「查看详情」，点击弹出只读任务详情（练习 · 南区 VIP 顾客练习冲刺 · v1 · 选修 · 进行中；品类 异议处理/新品；任务类型 / 负责人 / 开始截止 / 频次 / 单次时长 / 创建发布 / 下发范围 / 命中人数；本周排期 09/20 · 5 次 · 50 分钟；内容资源；关联任务；执行情况 15 次应完成/9 次已完成 60%；人员名单），右下角「调整任务」能接着打开处置弹窗（实测弹窗标题「处置 · 南区 VIP 顾客练习冲刺」）。行内不再出现「调整」。截图 `qa/task-detail-dialog.png`。
- 顶部操作自解释：「统计周期」标签 + 三个控件的悬停说明；导出按钮改名「导出工作记录」并实测下载成功（`培训巡检工作记录-2026-09-14.txt`，约 23.6k 字符，含最近批次 / 批次记录 / 任务清单 / 结论明细 / 数据完整度 / 处置记录），toast 提示文件名与去向；入口改名「数据来源」，弹窗列出同步过来的任务与缺字段，可跳原任务。截图 `qa/inspection-header-clarified.png`、`qa/inspection-data-intake.png`。
- 去掉重复的状态行：顶部「最近巡检 09/14 …（自动）· 26 项任务 · 9 个批次 · 本周期 26 项任务有问题」已删除（`.inspection-runbar` 只在本地存档异常时出现），最近一次的「自动巡检 / 时间 / 任务数 / 执行人 / 结论没变，已连续 N 次」移到「最近一次巡检」卡片右上角，与频次提示同排；卡片正文只剩主要结论与四条结论，不再重复。截图 `qa/inspection-runsbar-cleaned.png`。
- 口径文案收进指标卡：「本周要花的时间」下面那行口径段落已删除，改成指标名后面的 ⓘ；悬停浮出 300px 宽的口径浮层（内容含「本期有 8 人因此未计入」），键盘聚焦也能触发；截图 `qa/inspection-metric-infotip.png`、未悬停态 `qa/inspection-metric-infotip-before.png`。
- 频次对话：预设「自动巡检多久跑一次？」回答当前设置；输入「把巡检频率改成每 2 小时一次」当场生效——卡片提示变成「每 2 小时自动巡检一次」，本地存档 `policy.autoRunMinutes = 120`，刷新后仍是 2 小时；截图 `qa/inspection-cadence.png`。
- 移动端 390px：标签横向滚动、指标卡纵向堆叠，`scrollWidth === innerWidth`（无横向溢出）；截图 `qa/requirement-tab-mobile.png`。
- 浏览器控制台无本次功能相关报错。

**Patches Made**

- 修复向导最后一步不渲染：确认卡片此前被挂在「当前步骤有选项按钮」的条件下。
- `uniqueRisks()`：C3 同源重复会产出同 key 的双向记录，渲染与计数前按 key 去重，避免重复行与重复计数。
- `narrowToRegion()`：区域需求的「影响 N 人」只统计本区域，不再带入全国人数。
- 任务模型补 `categories`（演示数据 18 项任务都带品类），`INSPECTION_SEED_VERSION` 升到 4；空的关注方面不再产出「全部结论」，避免误报。
- 定时器从写死 60 秒改成按 `policy.autoRunMinutes` 递归排期；「每分钟自动巡检」这类与策略不符的文案全部换掉。
- 引擎删除 C4「角色不适用」；新增 G 类规则 G1「品类覆盖不完整」，并接入总览结论分组、Agent 说法（「N 人所在的区域这期没排到这个品类」）与自定义巡检的问题清单。
- 时间展示统一按 `Asia/Jakarta` 格式化，不再直接显示存档里的 UTC 时间。

**Follow-up Polish**

- None required for this scope.

final result: passed

---

**Comparison Target**

- Source visual truth: `/var/folders/g4/ht9bz9v97_9f7yddvbhsd2kw0000gn/T/codex-clipboard-14a6c597-d6dc-4ed6-ab2e-5f1c7c8db2db.png`
- Implementation screenshot: `/Users/yangmeng/Agent工作区/SalesBoost AI/qa/task-monitor-desktop.png`
- Full-view comparison: `/Users/yangmeng/Agent工作区/SalesBoost AI/qa/task-monitor-comparison.png`
- Focused comparison: `/Users/yangmeng/Agent工作区/SalesBoost AI/qa/task-monitor-focus-comparison.png`
- Viewport: 1280 x 720 desktop; supplementary responsive check at 390 x 844
- State: National task monitoring dialog open, July 2026, all three task types enabled

**Findings**

- No actionable P0, P1, or P2 mismatches remain.
- Fonts and typography: the added controls use the existing Geist type scale and weights. Labels, counts, dates, and badges remain readable at both checked viewports with no truncation or overlap.
- Spacing and layout rhythm: the filter toolbar preserves the dialog's existing border, padding, radius, and compact density. The task list remains independently scrollable after the added controls and date rows.
- Colors and visual tokens: selected filters use the existing rose accent and neutral borders; task cards continue using the existing progress/status tones.
- Image quality and asset fidelity: no new raster assets are required. All added icons come from the app's existing Lucide icon system.
- Copy and content: the three task types, localized month label, visible result count, empty state, and start/end timestamps are present and consistent with the filtered list.

**Interaction Evidence**

- Turning off Learning Tasks removed the learning card and updated the result count from 4 to 3.
- Selecting September 2026 while Learning Tasks was off produced the correct zero-result empty state.
- At 390 px width, filter buttons wrap without horizontal overflow and start/end timestamps stack cleanly.
- Browser console reported no errors.

**Patches Made**

- Formatted the selected month as a localized month label instead of a raw `YYYY-MM` value.
- Remounted dynamic count nodes so the existing DOM translation layer cannot preserve stale filter counts.
- Verified responsive wrapping for the filter group and time metadata.

**Follow-up Polish**

- None required for this scope.

final result: passed

---

# 培训巡检工作台 v0.2.0（2026-09-10）

**Scope**: `src/pages/TrainingInspection.tsx` 与 `src/pages/training-inspection/`（巡检总览 / 任务体检 / 影响分析 / 处置中心 / 风险卡 / 模拟面板）。

**Checks**

- 桌面 1440px：四个标签页、总览六项指标、风险卡固定格式（结论 / 原因 / 证据 / 建议 / 影响 / 需要确认）与证据展开均正常渲染。
- 发布前模拟：修改频次后立即重算受影响人数、区域人均、P90、单日峰值与风险增减；进入处置后复查结果写入处置记录。
- 权限：区域培训主管只看到本区域与全国任务（北区任务不可见），全国任务的处置按钮禁用；区域经理为只读。
- 移动端 390px：无横向溢出（`scrollWidth === innerWidth`），标签横向滚动、指标卡与结论条纵向堆叠。
- 浏览器控制台无错误。

**Patches Made**

- 修复筛选控件被 `w-full` 覆盖、弹窗宽度被基础 `sm:max-w-sm` 覆盖的问题（改为显式宽度与工作台局部样式）。
- 模拟只统计与该任务相关的风险，避免把其他区域的风险计入“高风险 N → N”。
- 处置后人员快照版本随任务版本同步，消除“任务修改后仍有员工处于旧版本”的误报。
- 任务体检默认选中按风险排序后的第一项。

**Follow-up Polish**

- 真实后端接入后，可把一个周期的风险评估拆到服务端增量计算，浏览器定时器仅做展示刷新。

**Review Adjustments（2026-09-10 预览批注）**

- 「模拟调整」按钮统一改为「调整」；结论条标签「下一步怎么处理」改为「下一步处理建议」。
- 风险卡与结论条用任务类型胶囊替换规则分类胶囊；风险卡任务行改为纯文本、去掉规则参数明细，减少胶囊数量。
- 移除总览的「数据完整度」指标卡，指标卡由六项变为五项；数据完整度仍在下方明细卡与「数据来源」弹窗中查看。

**Review Adjustments（第二轮）**

- 「人员快照仍是旧版本」改为「改版后没有重新生成员工名单」，原因与证据直接写明「策略应命中 12 人 / 名单 10 人」；界面统一改用「员工名单 / 名单版本」。
- 移除演示数据中的「考核与学习任务未声明顺序」风险：该考核已在数据中声明前置学习任务；同时收紧 D1 规则，只把同一批人共享内容的同源任务计入证据，避免出现跨区域无关任务。
- 演示数据新增 `seedVersion`，本地旧演示数据打开时自动重建并提示，验证覆盖旧数据升级路径。

**Review Adjustments（第三轮 · 影响分析）**

- 员工列表按区域分组并加区域名组头（人数 / 人均分钟），员工行去掉职位信息。
- 员工详情卡片：`预计分钟` → `本周期预计分钟数`，移除 `必修任务数`。
- 顶部状态条移除角色胶囊、「本地演示数据」标记与「重置演示数据」按钮，仅保留巡检时间与风险计数，本地存储异常时才显示提示。

**Review Adjustments（第四轮 · 术语可读性）**

- 界面与导出不再出现 P90：总览负荷卡显示「人均 X 分钟 · 单日峰值 Y 分钟」，区域视图去掉 P90 列并改为人均 / 容量 / 超容量人数，模拟结果把「P90 负荷」换成「最高单人」。
- A2 规则改名为「少数员工负荷明显高于区域平均」，原因与证据用「高负荷人群人均」表述；引擎仍按前 10% 分位计算。

final result: passed

---

# 培训巡检工作记录 v0.3.0（2026-09-11）

**Scope**: `src/pages/TrainingInspection.tsx`、`src/pages/training-inspection/`（总览 / 任务体检 / 对话 Agent / 批次记录 / 任务覆盖清单 / 风险卡 / 处置弹窗）、`src/lib/inspectionAgent.ts` 与 `inspectionEngine` 的批次记录逻辑。

**Screenshots**: `output/playwright/inspection-v3-overview.png`、`inspection-v3-agent.png`、`inspection-v3-timeline.png`、`inspection-v3-coverage.png`、`inspection-v3-checkup.png`、`inspection-v3-disposition.png`、`inspection-v3-exception-regional.png`、`inspection-v3-exception-approve.png`、`inspection-v3-mobile.png`。

**Checks**

- 标签页：只保留「巡检总览 / 任务体检」，影响分析与处置中心入口消失；任务体检内「按当前模拟进入处置」仍能打开弹窗并提交。
- 首屏对话 Agent：预设问题（最近巡检了哪些任务 / 现在有哪些任务需要我处理 / 风险最高的任务 / 哪些任务数据不全 / 上次巡检到现在有什么变化 / 南区现在什么情况）逐条给出结论、证据与「工作记录批次」引用，引用里的任务可跳任务体检。
- 巡检工作记录：批次默认折叠，展开后显示执行人、覆盖周期、本次变化（新增 / 解除 / 等级变化）与逐任务结论（任务名、类型、负责人、等级、命中规则号），每行可跳任务体检或原任务。
- 任务覆盖清单：按类型 / 结论 / 只看命中 / 区域筛选，行内展示最近巡检时间、负责人、影响人数与区域、命中规则；展开行直接渲染风险卡（证据、建议、调整、处置）。
- 统计口径：批次快照标注「本次评估命中（含下周排期）」，指标卡标注「仅统计当前选中周期」，避免两处数字被误读为矛盾。
- 移动端 390px：`scrollWidth === innerWidth`（390 = 390），Agent 卡片、批次与覆盖清单纵向堆叠，无横向滚动。
- 例外审批闭环：处置中心标签页移除后，待审批例外改为在处置弹窗顶部处理。区域培训师提交「标记为合理例外」→ 状态为待总部审批；切回总部培训师打开同一任务的处置弹窗，出现「待审批例外 EX-1001 · 规则 A1 · 到期 2026-09-25 · 提交人 Fitriani」，点「批准例外」后风险更新为例外生效。
- 浏览器控制台：除既有 favicon 404 外无报错；此前的重复 key 告警已通过「同一结论跨周去重 + 列表 key 加索引」消除。

**Patches Made**

- 同一问题同时命中本周与下周时，工作记录的新增 / 解除 / 等级变化只保留一条，避免同一条结论重复汇报。
- 对话回答里的段落、要点与引用使用索引化 key，消除跨周重复项导致的 React key 冲突。
- 批次展开的「覆盖周期」由 `09-07 起 / 09-14` 改为「本周期 09-07 · 下周 09-14」。
- 对话引用去掉内部批次 ID，改为「工作记录批次 · 日期 时间」+ 触发方式与执行人。
- 运行条「N 项巡检结论」改为「本周期 N 条规则结论」，与指标卡口径一致。
- 待审批例外从处置中心标签页迁到处置弹窗顶部，审批人显示姓名而不是账号 ID，避免移除标签页后例外无法审批。

**Review Adjustments（2026-09-11 预览批注 · 措辞精简）**

- 页面标题「培训巡检 · 巡检工作记录」→「培训巡检」，副标题压成一句；eyebrow 的「观察模式 · 只建议不修改」→「只建议 · 不改数据」。
- 状态条、Agent 卡片、批次记录、任务清单的说明各压到一行；「任务覆盖清单」→「巡检过的任务」，筛选「只看命中的任务」→「只看有问题的」，「未命中规则」→「没问题」，「结论未变化」→「没变化」。
- 指标卡与批次快照改用短标签（高 / 中 / 低、数据不足），周期标签修正为 `09/07 ~ 09/13`，一次列出超过两个区域时折叠为「前两个 等 N 个区域」。
- 任务体检区块改为「1 基本信息 / 2 人群 / 3 时间与负荷 / 4 关联任务 / 5 结论」，按钮改为「原任务」「提交处置」，footer 提示压成一句。
- 对话回答口语化：逐任务要点只保留「任务（类型）· 高风险 A1」，完整规则名放进引用；各处说明句去掉「我不会…」式重复解释。

**Follow-up Polish**

- 真实模型接入后，`answerInspectionQuestion` 的回答结构与工作记录引用保持不变，仅替换实现；届时可把会话按用户维度持久化并按租户做行级权限。
- 后端接入后，批次由服务端生成并按角色下发，浏览器不再承担巡检调度。

final result: passed

---

**区域负担（2026-09-14）**

- Implementation screenshots: `/Users/yangmeng/Agent工作区/SalesBoost AI/qa/region-burden-overview.png`（区域对比表）、`region-burden-detail.png`（区域明细与任务占用）、`region-burden-person-days.png`（超载人员每日分钟）
- Viewport: 1560 x 1100 desktop；数据为演示数据（本周 09/14–09/20）

**Findings**

- 无 P0 / P1 / P2 级问题。对比表 4 行分别对应 4 个区域，列为区域 / 人均分钟 / 超载人数 / 单日峰值 / 任务数 / 操作，排序为超载比例降序（南区 12/12 → 巴厘岛 8/8 → 北区 8/8 → 泗水全员缺时长）；每行右侧「点击查看」进入区域明细（重复任务数不再单列，重复内容在明细里成对展示）。
- 口径行固定在表格上方：统计周期、区域容量（未确认区域标注「默认」）、单日 60 分钟阈值；数值与巡检总览、Agent 回答同源（`regionAggregates`）。
- 全员缺预计时长的区域（泗水）显示「—」与「全员缺预计时长，无法判定」，不再以 0 分钟参与排序。
- 区域明细的三块内容齐全：任务占用（人均分钟降序、内容重复标记、调整入口）、重复内容（同源内容 / 资源重叠 + 重叠人数 + 可省分钟）、超载的人（按超额分钟降序）。
- 展开某个超载 BA 后可见 7 天柱状（超过单日阈值的一天标红）与逐日任务构成，例如 09/20 181 分钟由 6 项任务叠加。

**Interaction Evidence**

- 点击对比表任一区域进入明细，「返回区域对比」可回到表格；区域培训师角色（fitriani）直接进入雅加达南区明细，看不到其他区域与对比表。
- 从巡检总览「最近一次巡检」结论里点「南区新品卖点巩固」，页面切到区域负担、自动进入雅加达南区并高亮 `south-study` 行。
- 任务行点「调整」打开处置弹窗（标题「处置 · 南区 VIP 顾客练习冲刺」），未提交任何数据；浏览器控制台无报错。

**巡检总览指标卡（业务口径，2026-09-14）**

- Implementation screenshot: `/Users/yangmeng/Agent工作区/SalesBoost AI/qa/inspection-metrics-business.png`
- 卡片文案：有问题的任务 26 项（负荷叠加 16 · 时间集中 8 · 重复布置 7）｜受影响的 BA 36 人（4 个区域 · 9 家门店）｜本周要花的时间 103 小时（人均约 3.7 小时（28 人）· 最忙一天约 3 小时）｜任务挤在一起 14 项（同几天到期或内容重复 · 另有 1 项进度落后（8 人））。
- 顶部状态行：`最近巡检 09-14 02:04（自动）· 26 项任务 · 9 个批次 · 本周期 26 项任务有问题`，不再出现「条结论」。
- 区域培训师（南区）视角同一套卡片收窄为本区域：21 项任务有问题 / 12 人 / 1 个区域 3 家门店 / 53 小时，数字彼此自洽。

**「本周要花的时间」口径说明（2026-09-14）**

- 卡片与说明行截图：`/Users/yangmeng/Agent工作区/SalesBoost AI/qa/inspection-metrics-business.png`
- 卡片：`本周要花的时间 103 小时 · 28 名 BA 的排期合计 · 人均约 3.7 小时 · 最忙一天约 3 小时（09/20）`
- 说明行：`口径：本周要花的时间 = 任务资源的预计时长 × 本周应完成次数，按「时长字段完整」的 BA 累加，是计划排期时长而非实际耗时；缺预计时长的人和任务不计入（本期有 8 人因此未计入）。受影响的 BA 按「任务命中问题」的人数统计，与排期口径不同。`
- 区域培训师（南区）视角下同一行文案自动省略人数括号（该区域没有缺时长的人），数字为 53 小时 / 12 名 BA。

