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

## 验证

```sh
npm run lint            # tsc --noEmit
npm run test:inspection # 57 项
npx vite build
```

浏览器动线（截图见 `qa/courseware-*.png`）：入口卡 → 开始共创 → 两轮反问 → 课程规划确认 → 大纲勾选确认 →
逐页制作（进度 14% / 22% 子课件）→ 系列课件列表 → 只读预览；390×844 无横向溢出。
