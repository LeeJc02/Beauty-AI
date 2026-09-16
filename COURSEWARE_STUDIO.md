# 在线课件 ·「生成新课件」原型（复刻 SalesBoost-vue）

把 `SalesBoost-vue`（test 分支）`src/views/courseware/create/` 的「在线课件 › 生成新课件」链路
按 UI 与交互复刻到 Beauty-AI 原型仓库，用前端演示数据驱动，不连后端。

## 来源与去向

| 来源（SalesBoost-vue @ test） | 去向（Beauty-AI） | 说明 |
| --- | --- | --- |
| `src/views/courseware/create/index.vue`（3804 行，template 1–723） | `src/pages/courseware/CoursewareEntry.tsx` + `CoursewareResult.tsx` + `CoursewareCreateFlow.tsx` | 入口卡、`cw-swap` 切换、系列课件列表与预览 |
| `src/views/courseware/create/components/CoursewareStudio.vue`（1500 行） | `src/pages/courseware/CoursewareStudio.tsx` | 左「与 AI 共创」对话 + 右「课程草稿」双栏工作台 |
| `src/views/courseware/create/components/coursewareStudio.scss`（2048 行）+ `index.vue` 的 `<style scoped>` | `src/pages/courseware/courseware.css` | 设计令牌、卡片体系、动效、响应式 |
| `src/views/courseware/create/generationTask.ts` / `studioDraft.ts` / `agentActivity.ts` | `src/lib/coursewareStudio.ts` 的纯函数部分 | 状态码、阶段、进度、结果状态、答案合并 |
| `src/api/courseware/index.ts` + ADM `AiCoursewareGenerationTaskRespVO` | `src/lib/coursewareStudio.ts` 的 VO 类型 + `buildFrames()` 演示数据 | 字段名与后端保持一致 |

> 注：`agentActivity.ts` 的 `AgentConsole.vue` / `GenerationArtifacts.vue`（旧的「执行轨迹 + 生成产物」工作台）
> 在 test 分支已被 `CoursewareStudio.vue` 取代，本次复刻按新版本做。

## 交互流程（与线上一致，只是把轮询换成帧推进）

1. **入口卡**（`CoursewareEntry`）：左侧「AI 课程共创工作区」徽章 + 标题 + 三步路线图；右侧提示词输入（12000 字 + 计数）、
   3 个灵感示例、课程类型四选一（帮我判断 / 分享经验 / 教会操作 / 讲清方法）、参考资料上传（演示里点一下即上传到 100%）、
   课程设置折叠（分类、同步十道题、AI 生图、拆分优化、讲解角色、生成模式）、底部自动完成开关 + 课件语言 + 「开始共创课程」。
2. **卡片切换**：点开始后入口卡**只淡出**（0.7s，不位移），工作台**淡入 + 上浮 8px**（0.9s），左右面板再错峰 140ms 入场
   —— 对应原实现的 `cw-swap` + `studio-expand-left`。
3. **课程共创工作台**（`CoursewareStudio`）：顶部四段轨道「梳理目标 / 课程规划 / 确认大纲 / 生成课件」。
   - 左栏：教练条（结束本次制作 / 课程共创助手 / 第 N 轮）→ 历史问答 → 当前轮。等反问时是**选项卡**（推荐项带「建议」徽章、
     可选「None · 我自己填写」、可补一条细节），底部「继续」；非反问时是**状态卡**（理解中 / 里程碑确认 / 失败重试 / 逐页制作进度 + 子课件进度条）。
   - 右栏：按阶段切换成「课程草稿 → 课程摘要 → 课程大纲 → 页面制作」。摘要与大纲都可直接编辑（课程主题 / 面向谁 / 学完能够做到什么 /
     核心内容 / 每页标题与要点），多子课件时可勾选要生成的部分；确认按钮「生成课程大纲 / 确认大纲，生成课件」。
   - 已理解的 7 张事实卡（课程主题 / 面向谁 / 学完能够做到什么 / 你的真实经验 / 提炼出的关键动作 / 适用边界 / 核心内容）带「刚更新」高亮。
4. **结果**（`CoursewareResult`）：多子课件走系列列表（封面 + 第 N/M 部分 + 状态 + 预计时长 + 下载 / 预览），单个直接进预览；
   预览是真的 iframe（`slidePreviewHtml()` 现场生成一页讲解页 HTML），工具栏有返回列表 / 返回创建 / 下载课件 / 发布课件。
5. **页面只读预览**：右栏「页面制作」里已完成的页可点「只读预览」，弹出 iframe 弹窗。

## 演示数据

`src/lib/coursewareStudio.ts` 里的 `buildFrames(form)` 把整条链路写成一串帧：

| 帧 | 停留 | 关卡 | 内容 |
| --- | --- | --- | --- |
| `queued` | 1.4s | 自动 | 排队中、解析资料 |
| `interview-1` | — | **等用户** | 第 1 轮反问：讲给谁听 / 课后能做到什么 |
| `interview-2` | — | **等用户** | 第 2 轮反问：素材用真实案例还是标准话术 / 不希望涉及的内容 |
| `brief` | — | **等用户** | 课程规划（8 个章节 + 假设 + 核心内容），可编辑后确认 |
| `outline` | — | **等用户** | 拆分成 3 个子课件（6 + 8 + 5 页），可勾选要生成的部分 |
| `gen-1..4` | 2.2–2.6s | 自动 | 子课件 1→3 依次生成，右栏逐页列表跟着长，含自动重试与媒体待处理 |
| `completed` | 2.0s | 自动 | 全部完成 + 10 道课后题导入 → 切到结果页 |

主题是印尼美妆门店场景（Y.O.U Barrier Shield 修护精华、雅加达南区 Plaza Senayan 门店），
文案取自 `src/locales/modules/coursewareStudio.ts` 的中文原文，字段名取自 ADM 的
`AiCoursewareGenerationTaskRespVO`（`status` / `step` / `progress` / `promptEnhancement` /
`partSelection` / `series` / `generation.pages` / `result` 等）。

## 已知差异（原型取舍）

- 没有后端与轮询：帧推进替代 `generation-task/get`，`snapshotVersion` 之类的对账字段省略。
- 上传只做演示：点一下即生成一条「已上传」记录（进度条走完），不走分片上传与断点续传。
- 预览用现场生成的单页 HTML，不渲染真正的 classroom 播放器。
- 导出、发布、下载都是提示语（`window.alert`），不产生真实文件。

## 第二轮：与 vue 增量对齐（2026-09-16 15:37 的 `5e1024310`）

复刻第一稿基于 vue@test `7b1777da7`；之后 vue 又落了 `5e1024310`
（"优化课件工作台上传与大纲交互"），本仓库已把其中有界面影响的部分搬过来：

| vue 的改动 | Beauty-AI 对应 |
| --- | --- |
| 上传框始终保留，文件状态在框内切换（`courseware-upload-area--stable` + `courseware-upload-status`） | `CoursewareEntry.tsx` 上传区重写：框内状态列表（文件名 / 扩展名 / 进度条 / 暂停 / 继续 / 重试 / 移除） |
| 上传状态机 `ready → uploading → (paused \| failed) → success` | `src/lib/coursewareUpload.ts`：`validateUploadFile()`（仅 PDF/Word/PPT、单文件 ≤ 500MB）、`progressStep()`；≥100MB 的文件第一次在 80% 处模拟一次网络中断，用来演示失败重试 |
| 断点续传（`recoverableUploadTasks` + 重选原文件） | 移除未完成的上传会写一条 localStorage 记录 → 页面出现「可恢复的上传」卡片（文件名 / 大小 / 已上传 X% / 更新时间 / 继续上传 / 丢弃）；继续上传要重选原文件，文件名与大小不匹配就提示 |
| 双栏中间的交换面板按钮（`studio__swap-panels` + `is-swapped` + localStorage） | `CoursewareStudio.tsx` 与审计工作台都加了同一个按钮，顺序分别记在 `courseware-studio-panels-swapped` / `audit-console-panels-swapped`；窄屏双栏叠起来时隐藏 |
| 失败态区分 failed / canceled + 「仅课后题失败可重试」 | `resolveGenerationStatus()` / `canRetryHomework()`；入口新增演示开关「课后题失败分支」，走到末尾会停在失败卡，可点「重试附加题」只重跑附加题 |
| 更细的生成阶段 | `GenerationPhase` 补齐 `queued / generating_scenes / generating_media / generating_tts / persisting`，演示帧逐步经过这些阶段，标题按阶段与 step 切换 |
| 子课件状态并入课后题语义 | `resolvePartState()`（课后题未同步完成就算「制作中 · 正在同步课后题」）与 `resolveSeriesProgress()`（课后题未导入不显示 100%，失败封顶 99%） |
| 确认提交契约 | `confirm()` 按两种表单分别校验：大纲阶段校「标题 + 讲解安排 + 内容要点」并至少勾一个部品；摘要阶段校主题 / 目标学员 / 学习目标，并把逐页大纲当作 `planningOutline`；摘要卡片补齐「核心内容（每行一条）」与「尚待确认的假设」 |
| 草稿持久化与轮次重置 | `sessionStorage['courseware-studio-draft:{taskId}']` 存 `{key, draft}`（只在等回答 / 待确认阶段写）；`clarificationRound` 变化时清空上一轮的答案与补充说明 |
| `⌘/Ctrl + Enter` 提交；`autoConfirm` 自动推进 | `<section onKeyDown>` 复用 `submitAnswers()/confirm()`；入口的「直接完成（自动继续全流程）」现在真的会 1 秒后自动推进（同一屏只自动一次） |
| 顶栏保存三态、已完成阶段打勾 | 「尚未保存 / 正在保存 / 进度已保存」三态；已走过的阶段序号换成对勾 |
| 结果页可访问性与发布态 | 系列卡可键盘触发（`role=button` + Enter/Space）、不可用卡降级为 `is-unavailable`、发布按钮带「发布中」态、预览 iframe 未就绪时有遮罩（并修了 iframe 高度塌成 150px 的老问题） |

### 仍未对齐的地方（原型取舍）

- 上传没有真实分片、断点续传不真的续传（写的是本地记录），进度由定时器推进；
- 生成阶段是帧推进，不是 `generation-task` 轮询，也没有 `snapshotVersion` 之类的对账字段；
- 课程设置的「产品分类」还是写死的文本（vue 是级联选择器），讲解角色是固定三条，没有请求真实音色列表；
- 结果页封面用色块 + 编号占位（vue 会拉 `coverUrl` 并在失败时回退），预览是现场生成的单页 HTML，不是真实 classroom 播放器；
- 下载 / 导出 / 发布都是前端提示语，不产生真实文件；
- 「连接中断」提示条（`studio__connection-notice`）在原型里无从触发，暂未接入。

## 验证

```sh
npm run lint            # tsc --noEmit
npm run test:inspection # 57 项
npx vite build
```

浏览器动线（截图见 `qa/courseware-*.png`）：入口卡 → 上传（含暂停 / 失败重试 / 可恢复横幅 / 校验失败）→ 开始共创 → 两轮反问 → 课程规划确认 → 大纲勾选可编辑确认 →
逐页制作（生成页面 / 媒体 / 语音 / 保存课件四个阶段）→ 课后题失败卡 → 重试附加题 → 系列课件列表 → 只读预览；390×844 无横向溢出。
