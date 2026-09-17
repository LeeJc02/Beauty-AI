export default {
  title: 'Points Management',
  tabs: { rules: 'Point Rules', ledger: 'Point Ledger', archive: 'Monthly Archive', backfill: 'Backfill Batches' },
  common: {
    all: 'All', search: 'Search', reset: 'Reset', export: 'Export', detail: 'Details', close: 'Close',
    operation: 'Actions', status: 'Status', version: 'Version', enabled: 'Enabled', disabled: 'Disabled',
    noData: 'No data', current: 'Current', points: 'Points', count: 'Count'
  },
  categories: { ALL: 'All Points', TASK: 'Task Points', FREE: 'Learning Points' },
  views: { ALL: 'All Points', TASK: 'Task Points', FREE: 'Learning Points' },
  ruleCodes: {
    TASK_COMPLETION: 'Task completion', COURSE_COMPLETION: 'Course completion',
    AI_CUSTOMER_QUALIFIED: 'AI customer practice qualified', AI_SCENE_QUALIFIED: 'AI scenario practice qualified',
    QUOTE_SESSION_QUALIFIED: 'Quote session qualified', EXAM_PASS_BONUS: 'Exam pass bonus'
  },
  operations: { GRANT: 'Grant', REVERSAL: 'Reversal' },
  sources: {
    TASK_ASSIGNMENT: 'Task assignment', COURSE_LEARNING: 'Course learning record', AI_CHAT_SESSION: 'AI practice session',
    QUOTE_SESSION: 'Quote practice session', EXAM_ATTEMPT: 'Exam attempt'
  },
  statuses: {
    DRAFT: 'Draft', SCHEDULED: 'Scheduled', ACTIVE: 'Active', RETIRED: 'Retired',
    OPEN: 'Live', CLOSING: 'Closing', CLOSED: 'Archived',
    PENDING: 'Pending', RUNNING: 'Running', COMPLETED: 'Completed', FAILED: 'Failed'
  },
  rules: {
    currentTitle: 'Current Active Rules', currentVersion: 'Current version V{version}', createDraft: 'Create Version Draft',
    editDraft: 'Edit Draft', draftVersion: 'Draft V{version}', history: 'Rule Version History',
    effectiveAt: 'Effective At', jakartaTime: 'Jakarta time (UTC+7)', publishedAt: 'Published At',
    publishedBy: 'Published By', remark: 'Change Reason', remarkPlaceholder: 'Describe why these rules are changing',
    ruleName: 'Point Item', ruleCode: 'Rule Code', category: 'Category', formula: 'Formula',
    fixedPoints: 'Fixed Points', divisor: 'Exam Score Divisor', scoreFormula: 'round(exam score / {divisor})',
    saveDraft: 'Save Draft', publish: 'Publish Rules', createSuccess: 'Rule draft created',
    saveSuccess: 'Rule draft saved', publishSuccess: 'Rules published and will take effect as scheduled',
    publishConfirm: 'Published rules cannot be edited and only affect facts after the effective time. Publish V{version}?',
    effectiveRequired: 'Select a future effective time', itemsRequired: 'Configure all six point rules',
    noCurrent: 'No active rule version found', immutableTip: 'Published versions are immutable. New rules apply forward only and never recalculate existing ledger entries.'
  },
  ledger: {
    month: 'Point Month', userId: 'User ID', userName: 'User', region: 'Region', category: 'Category',
    rule: 'Point Item', operation: 'Operation', sourceType: 'Source Type', version: 'Rule Version',
    occurredAt: 'Business Time', points: 'Points', source: 'Business Source', ledgerId: 'Ledger ID',
    exportFile: 'point-ledger-{month}.xls', detailTitle: 'Point Ledger Details', sourceId: 'Source ID',
    generation: 'Source Generation', reversalOf: 'Reversal Of', reversedBy: 'Reversed By',
    taskContext: 'Task Context', taskId: 'Task ID', assignmentId: 'Assignment ID',
    taskResourceId: 'Task Resource ID', taskAttemptId: 'Execution Attempt ID', backfillBatchId: 'Backfill Batch ID',
    ruleSnapshot: 'Rule Snapshot', sourceSnapshot: 'Business Fact Snapshot', evidenceSnapshot: 'Activity Evidence Snapshot',
    dailySummary: 'Daily Summary for This User and Month', noSnapshot: 'No snapshot content',
    exportConfirm: 'Export point ledger entries matching the current filters?'
  },
  archive: {
    month: 'Month', period: 'Accounting Period', revision: 'Revision', closedAt: 'Archived At', closedBy: 'Closed By',
    view: 'Ranking View', region: 'Region', rank: 'Scope Rank', nationalRank: 'National Rank',
    regionRank: 'Region Rank', user: 'BA', allPoints: 'All Points', taskPoints: 'Task Points',
    freePoints: 'Learning Points', viewPoints: 'Selected View Points', people: '{count} people',
    openTip: 'The current month uses the live ledger and has no closing snapshot yet. Use National or Regional Data for the live ranking.',
    noSnapshot: 'No snapshot is available for this month', exportFile: 'point-ranking-{month}-{view}.xls',
    exportConfirm: 'Export the snapshot for the selected month, revision, region, and point view?', closeSummary: 'Closing Summary'
  },
  backfill: {
    batchId: 'Batch ID', ruleVersion: 'Rule Version', range: 'Fact Time Range', scanned: 'Scanned',
    granted: 'Granted', skipped: 'Skipped', failed: 'Failed', startedAt: 'Started At', finishedAt: 'Finished At',
    gapReport: 'Gap Report', readOnlyTip: 'Historical backfills run through controlled deployment tasks. This page is read-only for audit purposes.'
  }
}
