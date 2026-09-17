export default {
  title: 'Weekly Report',
  subtitle: 'Weekly national and regional BA operations data',
  week: 'Reporting week',
  timezone: 'Jakarta Time',
  generatedAt: 'Updated: {time}',
  refresh: 'Refresh data',
  national: 'National Data',
  activeBa: 'Activated BAs',
  coverage: 'Network coverage {rate}',
  weekRange: 'Period (Monday-Sunday): {start} - {end}',
  assets: 'Content assets added this week and total',
  weeklyAdded: 'Added this week',
  total: 'All-time total',
  completedTaskMetrics: 'Average metrics for tasks completed this week',
  regions: 'Regional data and ranking',
  regionTasks: 'Regional task process metrics',
  completedTaskHint: 'Average metrics include only task periods completed this week',
  emptyTasks: 'No ongoing or completed tasks this week',
  noData: 'No weekly report data',
  assetTypes: { COURSEWARE: 'Courseware', AI_CUSTOMER: 'Digital humans', AI_SCENE: 'Scenario scripts', QUOTE: 'Product quotes' },
  metrics: {
    studyCompletion: 'Avg. learning completion', practiceParticipation: 'Avg. practice participation',
    practiceQualification: 'Avg. practice qualification', examSubmission: 'Avg. exam submission', average: 'Composite average'
  },
  columns: {
    rank: 'Rank', region: 'Region', activation: 'Activated / Total BAs', weeklyNew: 'New BAs this week',
    taskType: 'Task type', taskName: 'Task name', taskStatus: 'Status', period: 'Learning period',
    assigned: 'Assigned', completed: 'Completed', currentRate: 'Completion / Qualification / Submission'
  },
  demandStat: {
    title: 'System issue progress',
    edit: 'Edit', save: 'Save', cancel: 'Cancel', saveSuccess: 'Saved',
    columns: {
      category: 'Requirement category', weeklyAdded: 'Added this week ({start}-{end})',
      total: 'Total', resolved: 'Resolved (total)', remark: 'Pending this week / Remarks'
    }
  },
  demandCategories: {
    SYSTEM_BUG: 'System bug', DEMAND_OPTIMIZE: 'Requirement optimization',
    DEMAND_OPTIMIZE_QB_NOTIFY: 'Requirement optimization (question bank & notifications)'
  },
  taskTypes: { STUDY: 'Learning', PRACTICE: 'Practice', EXAM: 'Exam' },
  status: { ONGOING: 'Ongoing', COMPLETED: 'Completed' }
}
