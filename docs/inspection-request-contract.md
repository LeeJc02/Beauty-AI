# 智能巡检：统一需求与两类业务

当前为前端产品原型，使用本地数据与事件，不依赖真实模型或消息接口；界面保持正常产品形态，不暴露演示入口或推进按钮。

## 需求与澄清
- `inspectionRequest.ts` 导出 `planRequest(text, previous)`、`planFromTask(task)`、`toInspectionRules(plan)`。
- `subject: courseware | training`；`mode: once | continuous`。`ready`只代表条件明确，必须用户最后确认才能执行。
- 课件条件：`keyword`、`timeMode`、`startsOn/endsOn`、`minDurationMinutes/maxDurationMinutes`。只能读取产物预计学习时长，不用生成目标冒充结果。
- 培训条件：`region/person/product`（明确全部用`全部`）、`timeMode: current | range | ongoing`、日期范围、`minScore`、`requireCourseCompleted`。地区、人员、产品、时间、执行方式、标准不清楚时逐轮追问；不默默扩大范围。
- 日期按`Asia/Jakarta`；支持当前记录、本周、昨天及起止日期等已识别表达。不能识别的时间与范围修改必须澄清，不能保留旧值后直接确认。过期范围的持续监督需改为一次查询或未来范围。
- 培训默认标准不是自动授权：提供“完课且80分/只看80分”选项或接受明确自定义标准。
- 只有持续模式使用提醒/汇报授权；否定表达撤销旧授权，切换领域或模式后重新明确相应条件。

## 查询与监督
- `inspectionQuery.ts`的`queryCurrentCourseware(plan)`按subject分派：课件读取现有mock CoursewareApi；培训读取`trainingInspection.ts`数据并严格按地区、人员、产品、时间过滤。
- 统一结果：`summary/columns/rows/evidence/tools/toolRuns`。工具记录包含时间、业务条件、处理结果；缺依据为partial，失败为error，不伪装为合格或无记录。
- `runtime.executeQuery(plan,{confirmed:true},executor?)`确认后读取、保存`mode:once/completedAt/queryResult/requestPlan`。一次查询不订阅、不提醒、不参加连续计数。
- 查询逐页前后及保存前校验身份与版本，A→B→A也使在途查询失效。直接保存异步结果应携带`captureQueryContext()`；纯factory可`dispose()`清理身份观察。
- `processTrainingRecord(record,targetTaskId?)`仅处理授权且在范围内的新培训记录；完课和成绩均满足才达标。缺依据不判断、断连续、不提醒；同人连续第三次未达标时按授权汇报。
- 课件与培训生产者互不串用。业务事件和样本事件的计数、清零、证据与升级幂等按来源隔离。
- `inspectionEvaluation(entry)`返回保留的核验事实；UI统计使用它而非仅看最终`outcome`，暂停/停止不抹去已核验结论。

## 连续事件与归档
- `useInspectionPresentation.ts`只在可见任务详情或已确认会话内，每1600ms调用一次`advancePresentation(taskId)`；暂停、页面隐藏、离开、KeepAlive失活、卸载都停止。
- 持续任务每组依次记录发现对象、核验、次数与动作、对方反馈、归档，然后接收新组；一次只追加一个业务阶段。
- 样本事件使用`source:presentation`，不代替用户点击签收真实生产者提醒。其自动回执是业务参与人的反馈事件。
- 完成后原`events`整体保留；`InspectionEntryTimeline.vue`被实时区、完成记录和工作区过程标签共用。用户上翻时不强制拉到底部。
- 仅保留最近100组presentation完成样本，用户生成记录和初始记录不受该限额影响。
- 到期监督停止并保留完成时间；只读持续任务不新增样本。

## 一次查询归类
- 首页“运行中”仅展示尚未结束的持续监督（暂停监督仍保留未结束状态）。一次查询只在执行完成后保存为“已完成”记录；查询会话内的实际读取等待不进入运行中任务列表。
- seedVersion5将v4两条预置queryPending样本归档，保留准备好的结果及原事件，只补齐缺失过程；不强行完成真实用户的在途查询，不删除历史或自建任务。
- 旧queryPending兼容字段不是产品正常推进路径，监督事件流不推进一次查询。

## 样本与界面
- `seedVersion:5`：11项初始任务，运行中5项（仅课件/培训监督）、已完成6项（查询结果与结束监督）。升级仅增补新版本样本，不覆盖原有修改或重建已移除旧任务。
- 新建引导固定提供四类业务提示，随后按需要反问，展示完整澄清后的任务说明，由用户确认。
- 对话是持续交互，不显示线性阶段条。右侧常驻“分析汇报/执行过程/数据明细”，明细包含全部记录、需关注、提醒与汇报。
- 新监督确认后保持会话，过程与中间数据继续更新；回列表打开监督任务显示三卡详情。
- 首页无外层重复标题栏，“我的任务”和分类同排，列表固定可视高度以保持切换尺寸。详情首卡左上放操作，右上以澄清后的任务说明为标题。旧`demoScenario`数据保留但不向正常页面和全局弹窗暴露。
