/**
 * 考试任务 · 跨页面共享 store（模块级 state）
 *
 * 原型里这份状态挂在 `App.tsx` 上：
 * - `ExamManage`（考试组卷）发布考试后调用 `onExamPublished(exam)` 往 `examTasks` 里追加一条任务；
 * - `ExamTaskManage`（考试任务管理，另一个页面）读取这份列表并支持撤回。
 *
 * Vue 版把这段链路收敛成模块级 `ref`，两个页面各自 `useExamTasks()` 读写同一份状态，
 * 因此「发布考试 → 去考试任务管理」不需要经过路由参数或全局 pinia。
 *
 * 维护约定：
 * - 本文件由「题目与考试」移植交付（组卷页发布考试用），考试任务管理页应当直接复用，
 *   不要再另建同名的 store，避免两套状态互不可见。
 * - 与原型一致：仅内存状态，无 localStorage 持久化，刷新回到演示数据。
 */

import { ref, type Ref } from 'vue'
import {
  DEFAULT_EXAM_PROFILE_QUESTIONS,
  type DefaultExamProfileQuestion,
  type ExamPassRule
} from '@/beauty/lib/examPublishSettings'
import { DEMO_PREVIOUS_WEEK, demoDate, demoDateTime } from '@/beauty/lib/demoDates'

/** 考试任务状态（与原型 `ExamTaskManage.tsx` 一致）。 */
export type ExamTaskStatus = '待开始' | '考试中' | '考试结束待复核' | '复核结束'

export interface ExamTask {
  id: string
  title: string
  status: ExamTaskStatus
  publishTime: string
  deadline?: string
  targetCount: number
  submittedCount: number
  aiGraded: boolean
  avgScore?: number
  passRules?: ExamPassRule[]
  profileQuestions?: DefaultExamProfileQuestion[]
  questionCount?: number
}

/** 演示用初始考试任务（逐字搬迁自原型 `INITIAL_EXAM_TASKS`）。 */
export const INITIAL_EXAM_TASKS: ExamTask[] = [
  {
    id: 't1',
    title: 'Q3 新品知识通关考核 (2023)',
    status: '待开始',
    publishTime: demoDateTime(0, '10:00'),
    deadline: demoDate(6),
    targetCount: 1200,
    submittedCount: 0,
    aiGraded: false,
    profileQuestions: DEFAULT_EXAM_PROFILE_QUESTIONS,
    questionCount: 17
  },
  {
    id: 't2',
    title: '防晒季：夏日畅销单品销售话术',
    status: '考试中',
    publishTime: demoDateTime(1, '00:00'),
    deadline: demoDate(7),
    targetCount: 850,
    submittedCount: 421,
    aiGraded: false,
    profileQuestions: DEFAULT_EXAM_PROFILE_QUESTIONS,
    questionCount: 22
  },
  {
    id: 't3',
    title: '敏感肌护理基础：成分剖析与问答',
    status: '考试结束待复核',
    publishTime: demoDateTime(-7, '09:00'),
    deadline: DEMO_PREVIOUS_WEEK,
    targetCount: 500,
    submittedCount: 480,
    aiGraded: true,
    profileQuestions: DEFAULT_EXAM_PROFILE_QUESTIONS,
    questionCount: 18
  },
  {
    id: 't4',
    title: '春季妆容趋势与实操笔试',
    status: '复核结束',
    publishTime: demoDateTime(-30, '10:00'),
    deadline: demoDate(-15),
    targetCount: 1000,
    submittedCount: 980,
    aiGraded: true,
    avgScore: 88.5,
    passRules: [
      { id: 'pass-rule-junior-ba', roleId: 'junior-ba', roleName: '初级 BA', score: 80 },
      { id: 'pass-rule-senior-ba', roleId: 'senior-ba', roleName: '高级 BA', score: 85 },
      { id: 'pass-rule-store-manager', roleId: 'store-manager', roleName: '店长', score: 90 },
      {
        id: 'pass-rule-regional-trainer',
        roleId: 'regional-trainer',
        roleName: '区域培训师',
        score: 90
      }
    ],
    profileQuestions: DEFAULT_EXAM_PROFILE_QUESTIONS,
    questionCount: 20
  }
]

/** 组卷页发布考试时携带的信息（等价原型 `onExamPublished(exam)` 的入参）。 */
export interface PublishedExam {
  id: string
  title: string
  passRules: ExamPassRule[]
  profileQuestions: DefaultExamProfileQuestion[]
  questionCount: number
}

/** 全局唯一的一份考试任务列表。 */
export const examTasks: Ref<ExamTask[]> = ref([...INITIAL_EXAM_TASKS])

/** 与原型 `formatPublishTime` 一致：YYYY-MM-DD HH:mm。 */
export const formatPublishTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

/**
 * 发布考试：追加到考试任务列表头部。
 * 与原型一致，按 `published-<examId>` 去重——同一份试卷重复发布会命中已有任务。
 */
export const publishExam = (exam: PublishedExam) => {
  const taskId = `published-${exam.id}`
  if (examTasks.value.some((task) => task.id === taskId)) return
  examTasks.value = [
    {
      id: taskId,
      title: exam.title,
      status: '待开始',
      publishTime: formatPublishTime(new Date()),
      targetCount: 1200,
      submittedCount: 0,
      aiGraded: false,
      passRules: exam.passRules,
      profileQuestions: exam.profileQuestions,
      questionCount: exam.questionCount
    },
    ...examTasks.value
  ]
}

/** 撤回/移除考试任务（对应原型 `onWithdrawTask`）。 */
export const withdrawExamTask = (taskId: string) => {
  examTasks.value = examTasks.value.filter((task) => task.id !== taskId)
}

/** 仅供测试：重置回演示初始数据。 */
export const resetExamTasks = () => {
  examTasks.value = [...INITIAL_EXAM_TASKS]
}

export const useExamTasks = () => ({
  examTasks,
  publishExam,
  withdrawExamTask
})
