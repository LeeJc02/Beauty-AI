export default {
  title: '积分管理',
  tabs: { rules: '积分规则', ledger: '积分流水', archive: '月榜归档', backfill: '回填批次' },
  common: {
    all: '全部', search: '查询', reset: '重置', export: '导出', detail: '详情', close: '关闭',
    operation: '操作', status: '状态', version: '版本', enabled: '启用', disabled: '停用',
    noData: '暂无数据', current: '当前', points: '积分', count: '数量'
  },
  categories: { ALL: '总积分', TASK: '任务积分', FREE: '学习积分' },
  views: { ALL: '总积分', TASK: '任务积分', FREE: '学习积分' },
  ruleCodes: {
    TASK_COMPLETION: '任务整体完成', COURSE_COMPLETION: '课件完成',
    AI_CUSTOMER_QUALIFIED: 'AI 顾客练习达标', AI_SCENE_QUALIFIED: 'AI 场景练习达标',
    QUOTE_SESSION_QUALIFIED: '金句整轮达标', EXAM_PASS_BONUS: '考试通过奖励'
  },
  operations: { GRANT: '发放', REVERSAL: '冲正' },
  sources: {
    TASK_ASSIGNMENT: '任务实例', COURSE_LEARNING: '课件学习记录', AI_CHAT_SESSION: 'AI 练习会话',
    QUOTE_SESSION: '金句练习轮次', EXAM_ATTEMPT: '考试作答实例'
  },
  statuses: {
    DRAFT: '草稿', SCHEDULED: '待生效', ACTIVE: '生效中', RETIRED: '已退役',
    OPEN: '实时累计', CLOSING: '月结中', CLOSED: '已归档',
    PENDING: '等待执行', RUNNING: '执行中', COMPLETED: '已完成', FAILED: '失败'
  },
  rules: {
    currentTitle: '当前生效规则', currentVersion: '当前版本 V{version}', createDraft: '创建新版本草稿',
    editDraft: '编辑草稿', draftVersion: '草稿 V{version}', history: '规则版本历史',
    effectiveAt: '生效时间', jakartaTime: '雅加达时间 (UTC+7)', publishedAt: '发布时间',
    publishedBy: '发布人', remark: '变更原因', remarkPlaceholder: '说明本次规则调整原因',
    ruleName: '积分项', ruleCode: '规则代码', category: '分类', formula: '计分方式',
    fixedPoints: '固定分值', divisor: '考试分数除数', scoreFormula: 'round(考试分数 / {divisor})',
    saveDraft: '保存草稿', publish: '发布规则', createSuccess: '规则草稿已创建',
    saveSuccess: '规则草稿已保存', publishSuccess: '规则已发布，将在设定时间生效',
    publishConfirm: '发布后规则不可修改，且只影响生效时间之后的新积分事实。确认发布 V{version}？',
    effectiveRequired: '请选择未来的生效时间', itemsRequired: '请完整配置六项积分规则',
    noCurrent: '未找到当前生效规则', immutableTip: '已发布版本不可修改；新规则仅向后生效，不重算既有流水。'
  },
  ledger: {
    month: '积分月份', userId: '用户 ID', userName: '用户', region: '地区', category: '分类',
    rule: '积分项', operation: '流水操作', sourceType: '来源类型', version: '规则版本',
    occurredAt: '业务发生时间', points: '分值', source: '业务来源', ledgerId: '流水 ID',
    exportFile: '积分流水-{month}.xls', detailTitle: '积分流水详情', sourceId: '来源 ID',
    generation: '来源代次', reversalOf: '冲正原流水', reversedBy: '对应冲正流水',
    taskContext: '任务上下文', taskId: '任务 ID', assignmentId: '任务实例 ID',
    taskResourceId: '任务资源 ID', taskAttemptId: '执行 Attempt ID', backfillBatchId: '回填批次 ID',
    ruleSnapshot: '规则快照', sourceSnapshot: '业务事实快照', evidenceSnapshot: '行为证据快照',
    dailySummary: '该用户当月日汇总', noSnapshot: '无快照内容', exportConfirm: '按当前筛选条件导出积分流水？'
  },
  archive: {
    month: '月份', period: '结算周期', revision: '修订号', closedAt: '归档时间', closedBy: '归档执行人',
    view: '排名视图', region: '地区', rank: '当前范围名次', nationalRank: '全国名次',
    regionRank: '地区名次', user: 'BA', allPoints: '总积分', taskPoints: '任务积分',
    freePoints: '学习积分', viewPoints: '当前视图积分', people: '{count} 人',
    openTip: '当前月份使用实时流水排名，尚未生成月结快照；请在全国数据或区域数据查看实时榜。',
    noSnapshot: '该月份尚无可查询快照', exportFile: '积分月榜-{month}-{view}.xls',
    exportConfirm: '导出当前月份、修订、地区和积分视图对应的月榜快照？', closeSummary: '月结摘要'
  },
  backfill: {
    batchId: '批次 ID', ruleVersion: '规则版本', range: '事实时间范围', scanned: '扫描',
    granted: '发放', skipped: '跳过', failed: '失败', startedAt: '开始时间', finishedAt: '结束时间',
    gapReport: '缺口报告', readOnlyTip: '历史回填由受控部署任务执行，本页面仅用于审计，不提供手工重跑。'
  }
}
