export const TASK_COMPLETION_POINT_VALUE = 10;
export const DEFAULT_MONTHLY_TASK_TOTAL = 8;

export const getEmployeeMonthlyPoints = (completedTaskCount: number, examScore: number) => {
  return completedTaskCount * TASK_COMPLETION_POINT_VALUE + examScore;
};

export const getCompletedTaskCountFromRate = (completionRate: number, taskTotal = DEFAULT_MONTHLY_TASK_TOTAL) => {
  return Math.round((completionRate / 100) * taskTotal);
};

export const getEmployeeMonthlyPointsFromRate = (
  completionRate: number,
  examScore: number,
  taskTotal = DEFAULT_MONTHLY_TASK_TOTAL
) => {
  return getEmployeeMonthlyPoints(getCompletedTaskCountFromRate(completionRate, taskTotal), examScore);
};

export const formatPointValue = (points: number) => {
  const rounded = Math.round(points * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};
