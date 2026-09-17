export default {
  title: '周报数据',
  subtitle: '全国及区域 BA 周度运营数据',
  week: '统计周',
  timezone: '雅加达时间',
  generatedAt: '更新时间：{time}',
  refresh: '刷新数据',
  national: '全国数据',
  activeBa: '已激活 BA 人数',
  coverage: '全网覆盖率 {rate}',
  weekRange: '统计周期（周一至周日）：{start} - {end}',
  assets: '内容资产本周新增与累计',
  weeklyAdded: '本周新增',
  total: '历史累计',
  completedTaskMetrics: '本周已完成任务平均指标',
  regions: '区域数据与综合排名',
  regionTasks: '区域任务过程指标',
  completedTaskHint: '平均指标仅统计本周已完成的任务周期',
  emptyTasks: '本周暂无进行中或已完成任务',
  noData: '暂无周报数据',
  assetTypes: {
    COURSEWARE: '课件',
    AI_CUSTOMER: '数字人',
    AI_SCENE: '场景剧本',
    QUOTE: '产品金句'
  },
  metrics: {
    studyCompletion: '学习平均完成率',
    practiceParticipation: '练习平均参与率',
    practiceQualification: '练习平均达标率',
    examSubmission: '考试平均交卷率',
    average: '综合平均率'
  },
  columns: {
    rank: '排名', region: '区域', activation: '激活 BA/总数', weeklyNew: '本周新增 BA',
    taskType: '任务类型', taskName: '任务名称', taskStatus: '任务状态', period: '学习周期',
    assigned: '下发人数', completed: '完成人数', currentRate: '当前完成率 / 达标率 / 交卷率'
  },
  demandStat: {
    title: '系统问题处理进度',
    edit: '修改',
    save: '保存',
    cancel: '取消',
    saveSuccess: '保存成功',
    columns: {
      category: '需求分类',
      weeklyAdded: '本周新增({start}-{end})',
      total: '累计',
      resolved: '已解决(累计)',
      remark: '本周待解决/备注'
    }
  },
  demandCategories: {
    SYSTEM_BUG: '系统BUG',
    DEMAND_OPTIMIZE: '需求优化',
    DEMAND_OPTIMIZE_QB_NOTIFY: '需求优化（题库和通知）'
  },
  taskTypes: { STUDY: '学习任务', PRACTICE: '练习任务', EXAM: '考试任务' },
  status: { ONGOING: '进行中', COMPLETED: '已完成' }
}
