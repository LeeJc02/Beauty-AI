import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Calendar, Users, FileText, CheckCircle, Clock, AlertCircle, BarChart3, Edit, PlayCircle, Search, Eye, AlertTriangle, TrendingUp, HelpCircle, Trophy, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { getProgressTone, getTaskStatusBadgeClass } from '../lib/visualTones';
import { DEFAULT_EXAM_PASS_RULES, DEFAULT_EXAM_PROFILE_QUESTIONS, type DefaultExamProfileQuestion, type ExamPassRule } from '../lib/examPublishSettings';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DEMO_PREVIOUS_WEEK, demoDate, demoDateTime } from '../lib/demoDates';

type TaskStatus = '待开始' | '考试中' | '考试结束待复核' | '复核结束';

export interface ExamTask {
  id: string;
  title: string;
  status: TaskStatus;
  publishTime: string;
  deadline?: string;
  targetCount: number;
  submittedCount: number;
  aiGraded: boolean;
  avgScore?: number;
  passRules?: ExamPassRule[];
  profileQuestions?: DefaultExamProfileQuestion[];
  questionCount?: number;
}

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
    questionCount: 17,
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
    questionCount: 22,
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
    questionCount: 18,
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
      { id: 'pass-rule-regional-trainer', roleId: 'regional-trainer', roleName: '区域培训师', score: 90 },
    ],
    profileQuestions: DEFAULT_EXAM_PROFILE_QUESTIONS,
    questionCount: 20,
  }
];

const MOCK_CANDIDATES = [
  { id: 'BA001', name: 'Siti Aminah', store: 'Jakarta Grand Indonesia', status: '已交卷', submitTime: '10:45' },
  { id: 'BA002', name: 'Budi Santoso', store: 'Jakarta Plaza Senayan', status: '考试中', submitTime: '-' },
  { id: 'BA003', name: 'Ayu Lestari', store: 'Surabaya Tunjungan Plaza', status: '未开始', submitTime: '-' },
  { id: 'BA004', name: 'Rizky Pratama', store: 'Bali Beachwalk', status: '已交卷', submitTime: '10:52' },
  { id: 'BA005', name: 'Dewi Sartika', store: 'Bandung Trans Studio', status: '考试中', submitTime: '-' },
  { id: 'BA006', name: 'Agung Setiawan', store: 'Medan Centre Point', status: '已交卷', submitTime: '11:05' },
  { id: 'BA007', name: 'Putri Maharani', store: 'Yogyakarta Hartono Mall', status: '考试中', submitTime: '-' },
];

const MOCK_REVIEW_CANDIDATES = [
  { id: 'BA001', name: 'Siti Aminah', region: '雅加达区', positionName: '初级 BA', store: 'Jakarta Grand Indonesia', storeChannel: '百货', aiScore: 85, reviewStatus: '待复核' },
  { id: 'BA004', name: 'Rizky Pratama', region: '巴厘岛区', positionName: '店长', store: 'Bali Beachwalk', storeChannel: '购物中心', aiScore: 92, reviewStatus: '已复核' },
  { id: 'BA006', name: 'Reza Rahadian', region: '棉兰区', positionName: '高级 BA', store: 'Medan Centre Point', storeChannel: '商超', aiScore: 78, reviewStatus: '待复核' },
  { id: 'BA007', name: 'Dian Sastrowardoyo', region: '望加锡区', positionName: '初级 BA', store: 'Makassar Trans Studio', storeChannel: 'CS', aiScore: 88, reviewStatus: '待复核' },
  { id: 'BA008', name: 'Maya Sari', region: '日惹区', positionName: '区域培训师', store: 'Yogyakarta Hartono Mall', storeChannel: '线上渠道', aiScore: 95, reviewStatus: '已复核' },
];

const MOCK_INSIGHT_DATA = {
  total: 1000,
  submitted: 980,
  passRate: 92,
  avgScore: 88.5,
  highestScore: 100,
  lowestScore: 56,
  knowledgeGaps: [
    { title: '敏感肌换季护肤步骤', errorRate: 35 },
    { title: '顾客异议处理：大促价格对比', errorRate: 28 },
    { title: '双萃精华核心成分原理解析', errorRate: 22 }
  ],
  scoreHistogram: [
    { range: '0-59', count: 18 },
    { range: '60-69', count: 42 },
    { range: '70-79', count: 118 },
    { range: '80-89', count: 422 },
    { range: '90-100', count: 380 },
  ],
  topPerformers: [
    { name: 'Siti Aminah', store: 'Jakarta Grand Indonesia', score: 100 },
    { name: 'Rizky Pratama', store: 'Bali Beachwalk', score: 98 },
    { name: 'Putri Maharani', store: 'Yogyakarta Hartono Mall', score: 97 },
  ]
};

interface ExamTaskManageProps {
  isReadOnly?: boolean;
  tasks?: ExamTask[];
  onWithdrawTask?: (taskId: string) => void;
}

type ReviewCandidate = typeof MOCK_REVIEW_CANDIDATES[number];

const normalizePositionName = (value: string) => value.replace(/\s+/g, '').toLowerCase();

const getCandidatePassScore = (task: ExamTask | null, candidate: ReviewCandidate) => {
  const rules = task?.passRules && task.passRules.length > 0 ? task.passRules : DEFAULT_EXAM_PASS_RULES;
  const matchedRule = rules.find(rule => normalizePositionName(rule.roleName) === normalizePositionName(candidate.positionName));
  return matchedRule?.score ?? rules[0]?.score ?? 80;
};

const isCandidatePassed = (task: ExamTask | null, candidate: ReviewCandidate) => {
  return candidate.aiScore >= getCandidatePassScore(task, candidate);
};

const getPositionPassSummaries = (task: ExamTask | null, candidates: ReviewCandidate[]) => {
  const summaryMap = new Map<string, { positionName: string; passScore: number; total: number; passed: number }>();

  candidates.forEach(candidate => {
    const passScore = getCandidatePassScore(task, candidate);
    const key = `${candidate.positionName}-${passScore}`;
    const current = summaryMap.get(key) || {
      positionName: candidate.positionName,
      passScore,
      total: 0,
      passed: 0,
    };

    current.total += 1;
    if (candidate.aiScore >= passScore) current.passed += 1;
    summaryMap.set(key, current);
  });

  return Array.from(summaryMap.values()).map(summary => ({
    ...summary,
    passRate: summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0,
  }));
};

const escapeExcelCell = (value: string | number) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const createBarText = (value: number, maxValue: number) => {
  if (maxValue <= 0 || value <= 0) return '';
  const blocks = Math.max(1, Math.round((value / maxValue) * 24));
  return '█'.repeat(blocks);
};

const buildScoreSheetHtml = (task: ExamTask, candidates: ReviewCandidate[]) => {
  const headers = ['工号', '姓名', '地区', '职位', '门店', '门店渠道', '最终得分', '及格分数', '是否及格', '状态'];
  const rows = candidates.map(candidate => {
    const passScore = getCandidatePassScore(task, candidate);
    return [
      candidate.id,
      candidate.name,
      candidate.region,
      candidate.positionName,
      candidate.store,
      candidate.storeChannel,
      `${candidate.aiScore} 分`,
      `${passScore} 分`,
      candidate.aiScore >= passScore ? '及格' : '未及格',
      '已评分',
    ];
  });
  const histogramMaxCount = Math.max(...MOCK_INSIGHT_DATA.scoreHistogram.map(item => item.count), 1);
  const histogramRows = MOCK_INSIGHT_DATA.scoreHistogram.map(item => [
    item.range,
    item.count,
    `${Math.round((item.count / MOCK_INSIGHT_DATA.submitted) * 100)}%`,
    createBarText(item.count, histogramMaxCount),
  ]);
  const positionPassSummaries = getPositionPassSummaries(task, candidates);
  const positionRows = positionPassSummaries.map(summary => [
    summary.positionName,
    `${summary.passScore} 分`,
    summary.total,
    summary.passed,
    `${summary.passRate}%`,
    createBarText(summary.passRate, 100),
  ]);

  const renderTable = (tableHeaders: string[], tableRows: Array<Array<string | number>>) => [
    `<tr>${tableHeaders.map(header => `<th>${escapeExcelCell(header)}</th>`).join('')}</tr>`,
    ...tableRows.map(row => `<tr>${row.map(cell => `<td>${escapeExcelCell(cell)}</td>`).join('')}</tr>`),
  ].join('');

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #d9d2cc; padding: 8px 10px; text-align: left; }
          th { background: #f8f5f3; font-weight: 700; }
        </style>
      </head>
      <body>
        <h3>${escapeExcelCell(task.title)} - 成绩单</h3>
        <table>${renderTable(headers, rows)}</table>
        <h3>成绩分布直方图</h3>
        <table>${renderTable(['分数段', '人数', '占比', '直方图'], histogramRows)}</table>
        <h3>不同职位通过率</h3>
        <table>${renderTable(['职位', '及格分数', '参考人数', '及格人数', '通过率', '直方图'], positionRows)}</table>
      </body>
    </html>
  `;
};

export function ExamTaskManage({ isReadOnly = false, tasks: controlledTasks, onWithdrawTask }: ExamTaskManageProps) {
  const [localTasks, setLocalTasks] = useState<ExamTask[]>(INITIAL_EXAM_TASKS);
  const [activeTab, setActiveTab] = useState<'全部' | TaskStatus>('全部');
  const [monitoringTask, setMonitoringTask] = useState<ExamTask | null>(null);
  const [reviewingTask, setReviewingTask] = useState<ExamTask | null>(null);
  const [insightTask, setInsightTask] = useState<ExamTask | null>(null);
  const [withdrawTask, setWithdrawTask] = useState<ExamTask | null>(null);
  const [scoreSearch, setScoreSearch] = useState('');
  const tasks = controlledTasks ?? localTasks;

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case '待开始':
        return <Badge variant="outline" className={`${getTaskStatusBadgeClass(status)} whitespace-nowrap`}>待开始</Badge>;
      case '考试中':
        return <Badge variant="outline" className={`${getTaskStatusBadgeClass(status)} whitespace-nowrap`}>考试中</Badge>;
      case '考试结束待复核':
        return <Badge variant="outline" className={`${getTaskStatusBadgeClass(status)} whitespace-nowrap`}>待复核</Badge>;
      case '复核结束':
        return <Badge variant="outline" className={`${getTaskStatusBadgeClass(status)} whitespace-nowrap`}>已结束</Badge>;
    }
  };

  const filteredTasks = tasks.filter(t => activeTab === '全部' || t.status === activeTab);
  const filteredReviewCandidates = MOCK_REVIEW_CANDIDATES.filter(candidate => {
    const keyword = scoreSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [
      candidate.id,
      candidate.name,
      candidate.region,
      candidate.positionName,
      candidate.store,
      candidate.storeChannel,
    ].some(value => value.toLowerCase().includes(keyword));
  });
  const insightPositionPassSummaries = getPositionPassSummaries(insightTask, MOCK_REVIEW_CANDIDATES);

  const TABS = ['全部', '待开始', '考试中', '考试结束待复核', '复核结束'] as const;

  const handleWithdrawTask = () => {
    if (!withdrawTask) return;

    if (onWithdrawTask) {
      onWithdrawTask(withdrawTask.id);
    } else {
      setLocalTasks(prev => prev.filter(task => task.id !== withdrawTask.id));
    }
    if (monitoringTask?.id === withdrawTask.id) {
      setMonitoringTask(null);
    }
    setWithdrawTask(null);
  };

  const handleExportFinishedScores = () => {
    if (!reviewingTask || reviewingTask.status !== '复核结束') return;

    const html = buildScoreSheetHtml(reviewingTask, MOCK_REVIEW_CANDIDATES);
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeTitle = reviewingTask.title.replace(/[\\/:*?"<>|]/g, '_');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}_成绩单.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderWithdrawButton = (task: ExamTask) => {
    if (isReadOnly) return null;

    return (
      <Button
        variant="outline"
        onClick={() => setWithdrawTask(task)}
        className="w-full text-xs font-bold border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
      >
        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
        撤回考试
      </Button>
    );
  };

  return (
    <div className="flex-1 flex flex-col pt-2 h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#242124]">考试任务管理</h1>
          <p className="text-xs text-[#766F73] mt-1">查看和追踪所有已发布的考试任务状态</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100/50 p-1 rounded-xl shrink-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-[#766F73] hover:text-[#3F3A3D] hover:bg-slate-200/50'
              }`}
            >
              {tab === '考试结束待复核' ? '待复核' : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {filteredTasks.map(task => (
          <React.Fragment key={task.id}>
          <Card key={task.id} className="rounded-2xl border border-[#E9E4DF] shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center gap-6">

              {/* Info section */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  {getStatusBadge(task.status)}
                  <div className="flex items-center text-[10px] text-[#9A9396] font-medium font-mono">
                    <Calendar className="w-3 h-3 mr-1" />
                    {`${task.publishTime} 发布`}
                  </div>
                </div>
                <CardTitle data-i18n-skip="true" className="text-base font-bold text-[#242124] line-clamp-1">
                  {task.title}
                </CardTitle>
                {((task.passRules && task.passRules.length > 0) || (task.profileQuestions && task.profileQuestions.length > 0)) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {task.questionCount && (
                      <span className="rounded-full bg-[#F8F5F3] px-2 py-0.5 text-[10px] font-bold text-[#766F73] ring-1 ring-[#E5DED8]">
                        试卷 {task.questionCount} 题
                      </span>
                    )}
                    {task.profileQuestions && task.profileQuestions.length > 0 && (
                      <span className="rounded-full bg-[#EEF8F4] px-2 py-0.5 text-[10px] font-bold text-[#2F735C] ring-1 ring-[#BFDCCF]">
                        固定信息题 {task.profileQuestions.length} 道
                      </span>
                    )}
                    {(task.passRules || []).slice(0, 3).map(rule => (
                      <span key={rule.id} data-i18n-skip="true" className="rounded-full bg-[#EEF8F4] px-2 py-0.5 text-[10px] font-bold text-[#2F735C] ring-1 ring-[#BFDCCF]">
                        {rule.roleName} {rule.score}分
                      </span>
                    ))}
                    {(task.passRules || []).length > 3 && (
                      <span className="rounded-full bg-[#F8F5F3] px-2 py-0.5 text-[10px] font-bold text-[#766F73] ring-1 ring-[#E5DED8]">
                        +{(task.passRules || []).length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Status specific content section */}
              <div className="w-full md:w-64 shrink-0">
                {task.status === '待开始' && (
                  <div className="flex items-center gap-3 p-3 bg-[#F8F5F3] rounded-xl border border-[#E9E4DF]">
                    <div className="w-8 h-8 rounded-full bg-slate-200/50 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-[#9A9396]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#3F3A3D]">尚未开始</p>
                      <p className="text-[10px] text-[#766F73] mt-0.5">{`预计推送给 ${task.targetCount} 名考生`}</p>
                    </div>
                  </div>
                )}

                {task.status === '考试中' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <div className="text-[11px] text-[#766F73] font-medium">{`答题进度 (${task.submittedCount}/${task.targetCount})`}</div>
                      <div className={`text-sm font-bold ${getProgressTone((task.submittedCount / task.targetCount) * 100).textClass}`}>
                        {Math.round((task.submittedCount / task.targetCount) * 100)}%
                      </div>
                    </div>
                    <Progress value={(task.submittedCount / task.targetCount) * 100} className="h-1.5 bg-slate-100" indicatorClassName={getProgressTone((task.submittedCount / task.targetCount) * 100).indicatorClass} />
                  </div>
                )}

                {task.status === '考试结束待复核' && (
                  <div className="flex items-center gap-3 p-3 bg-[#FFF7EA]/50 rounded-xl border border-[#F2DEC0]">
                     <div className="w-8 h-8 rounded-full bg-[#F7E6C8] flex items-center justify-center shrink-0">
                       <AlertCircle className="w-4 h-4 text-[#B9822B]" />
                     </div>
                     <div>
                       <p className="text-xs font-bold text-amber-800">AI阅卷完毕</p>
                       <p className="text-[10px] text-[#B9822B] mt-0.5">{`已有 ${task.submittedCount} 份答卷等待人工复核`}</p>
                     </div>
                  </div>
                )}

                {task.status === '复核结束' && (
                  <div className="flex items-center justify-between gap-4 p-3 bg-[#F8F5F3] rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#766F73] font-medium">参考</span>
                      <span className="text-sm font-bold text-[#3F3A3D]">{task.submittedCount} 人</span>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#3B8F72] font-medium">平均分</span>
                      <span className="text-sm font-bold text-[#2F735C]">{task.avgScore} 分</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action section */}
              <div className="w-full md:w-44 shrink-0 md:border-l md:border-[#E9E4DF] md:pl-6 flex justify-end">
                 {task.status === '待开始' && (
                   <div className="w-full flex flex-col gap-2">
                     <Button variant="outline" className="w-full text-xs font-bold hover:bg-[#F8F5F3] border-[#E5DED8]">
                       <FileText className="w-3.5 h-3.5 mr-1.5" /> 详情
                     </Button>
                     {renderWithdrawButton(task)}
                   </div>
                 )}
                 {task.status === '考试中' && (
                   <div className="w-full flex flex-col gap-2">
                     <Button onClick={() => setMonitoringTask(task)} className="w-full text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border-none shadow-none">
                       <Users className="w-3.5 h-3.5 mr-1.5" /> 监控
                     </Button>
                     {renderWithdrawButton(task)}
                   </div>
                 )}
                 {task.status === '考试结束待复核' && (
                   isReadOnly ? (
                     <Button variant="outline" className="w-full text-xs font-bold bg-[#FFF7EA]/50 text-[#B9822B] border-[#E8CCA0] pointer-events-none">
                       <Clock className="w-3.5 h-3.5 mr-1.5" /> 复核中
                     </Button>
                   ) : (
                     <Button onClick={() => setReviewingTask(task)} className="w-full text-xs font-bold bg-[#FFF7EA] text-[#B9822B] hover:bg-[#F7E6C8] border border-[#E8CCA0] shadow-none">
                       <Edit className="w-3.5 h-3.5 mr-1.5" /> 复核
                     </Button>
                   )
                 )}
                 {task.status === '复核结束' && (
                   <div className="grid w-full grid-cols-2 gap-2">
                     <Button onClick={() => setReviewingTask(task)} className="min-w-0 text-xs font-bold bg-[#F8F5F3] text-[#5D565A] hover:bg-[#F1ECE8] border-none shadow-none px-2 whitespace-nowrap">
                       <FileText className="w-3.5 h-3.5 mr-1" /> 成绩
                     </Button>
                     <Button onClick={() => setInsightTask(task)} className="min-w-0 text-xs font-bold bg-[#EEF8F4] text-[#3B8F72] hover:bg-[#DCEFE7] border-none shadow-none px-2 whitespace-nowrap">
                       <BarChart3 className="w-3.5 h-3.5 mr-1" /> 洞察
                     </Button>
                   </div>
                 )}
              </div>
            </CardContent>
          </Card>
          </React.Fragment>
        ))}
        {filteredTasks.length === 0 && (
           <div className="text-center py-12 text-[#9A9396]">
             <AlertCircle className="w-8 h-8 opacity-20 mx-auto mb-3" />
             <p className="text-sm font-medium">当前状态下暂无考试任务</p>
           </div>
        )}
      </div>

      {/* Monitoring Dialog */}
      <Dialog open={!!monitoringTask} onOpenChange={(open) => !open && setMonitoringTask(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b border-[#E9E4DF] pb-4 shrink-0">
            <DialogTitle className="flex items-center text-[#242124]">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              {monitoringTask?.title} - 实时监控
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pt-4 flex flex-col min-h-0">
            <div className="grid grid-cols-3 gap-4 mb-6 shrink-0">
               <Card className="bg-[#F8F5F3] border-[#E9E4DF] shadow-none">
                 <CardContent className="p-4 flex items-center justify-between">
                   <div>
                     <p className="text-xs font-medium text-[#766F73] mb-1">目标人数</p>
                     <p className="text-xl font-bold text-[#242124]">{monitoringTask?.targetCount}</p>
                   </div>
                   <Users className="w-8 h-8 text-blue-200" />
                 </CardContent>
               </Card>
               <Card className="bg-[#F8F5F3] border-[#E9E4DF] shadow-none">
                 <CardContent className="p-4 flex items-center justify-between">
                   <div>
                     <p className="text-xs font-medium text-[#766F73] mb-1">已交卷</p>
                     <p className="text-xl font-bold text-blue-600">{monitoringTask?.submittedCount}</p>
                   </div>
                   <CheckCircle className="w-8 h-8 text-blue-200" />
                 </CardContent>
               </Card>
               <Card className="bg-[#F8F5F3] border-[#E9E4DF] shadow-none">
                 <CardContent className="p-4 flex items-center justify-between">
                   <div>
                     <p className="text-xs font-medium text-[#766F73] mb-1">交卷率</p>
                     <p className="text-xl font-bold text-[#242124]">{monitoringTask ? Math.round((monitoringTask.submittedCount / monitoringTask.targetCount) * 100) : 0}%</p>
                   </div>
                   <BarChart3 className="w-8 h-8 text-blue-200" />
                 </CardContent>
               </Card>
            </div>

            <div className="flex justify-between items-center mb-4 shrink-0">
               <h3 className="text-sm font-bold text-[#242124]">考生明细 (正在实时刷新)</h3>
               <div className="relative">
                 <Search className="w-4 h-4 text-[#9A9396] absolute left-3 top-1/2 -translate-y-1/2" />
                 <input type="text" placeholder="搜索免考工号、姓名、门店..." className="pl-9 pr-4 py-1.5 text-sm border border-[#E5DED8] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64" />
               </div>
            </div>

            <div className="flex-1 overflow-auto border border-[#E5DED8] rounded-xl">
               <table className="w-full text-left text-sm">
                 <thead className="bg-[#F8F5F3] sticky top-0 z-10 border-b border-[#E5DED8]">
                   <tr>
                     <th className="p-3 font-medium text-[#766F73] w-24">工号</th>
                     <th className="p-3 font-medium text-[#766F73] w-32">姓名</th>
                     <th className="p-3 font-medium text-[#766F73]">门店</th>
                     <th className="p-3 font-medium text-[#766F73] w-32">状态</th>
                     <th className="p-3 font-medium text-[#766F73] w-32">交卷时间</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 bg-white">
                    {MOCK_CANDIDATES.map((c) => (
                      <tr key={c.id} className="hover:bg-[#F8F5F3] transition-colors">
                        <td className="p-3 text-[#766F73] font-mono text-xs">{c.id}</td>
                        <td className="p-3 font-medium text-[#242124]">{c.name}</td>
                        <td className="p-3 text-[#5D565A]">{c.store}</td>
                        <td className="p-3">
                          {c.status === '已交卷' && <Badge variant="outline" className="bg-[#EEF8F4] text-[#3B8F72] border-none font-normal">已交卷</Badge>}
                          {c.status === '考试中' && <Badge variant="outline" className={`${getTaskStatusBadgeClass(c.status)} border-none font-normal`}>正在答题</Badge>}
                          {c.status === '未开始' && <Badge variant="outline" className="bg-slate-100 text-[#766F73] border-none font-normal">尚未进入</Badge>}
                        </td>
                        <td className="p-3 text-[#766F73] text-xs font-mono">{c.submitTime}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={!!withdrawTask} onOpenChange={(open) => !open && setWithdrawTask(null)}>
        <DialogContent className="sm:max-w-md border border-red-100">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              撤回考试
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm font-bold text-[#242124]">该考试任务将撤回，是否确定？</p>
            <p className="text-xs leading-relaxed text-[#766F73]">
              撤回后该任务将从考试任务管理中消失，已分发的考生将不再看到该考试。
            </p>
            {withdrawTask && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                <p data-i18n-skip="true" className="text-xs font-bold text-red-700 line-clamp-1">{withdrawTask.title}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-6 gap-3">
            <Button variant="outline" onClick={() => setWithdrawTask(null)}>
              取消
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold" onClick={handleWithdrawTask}>
              确认撤回
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!reviewingTask} onOpenChange={(open) => !open && setReviewingTask(null)}>
        <DialogContent className="sm:max-w-6xl max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b border-[#E9E4DF] pb-4 shrink-0">
            <DialogTitle className="flex items-center text-[#242124]">
              {reviewingTask?.status === '复核结束' ? (
                <>
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  {reviewingTask?.title} - 完整考卷与成绩单
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 mr-2 text-[#B9822B]" />
                  {reviewingTask?.title} - 待人工复核
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pt-4 flex flex-col min-h-0">

            {reviewingTask?.status !== '复核结束' && (
              <div className="p-4 bg-[#FFF7EA]/50 border border-[#F2DEC0] rounded-xl mb-6 flex items-start gap-4 shrink-0">
                 <div className="w-10 h-10 rounded-full bg-[#F7E6C8] flex items-center justify-center shrink-0">
                    <BarChart3 className="w-5 h-5 text-[#B9822B]" />
                 </div>
                 <div className="flex-1">
                   <h3 className="text-sm font-bold text-amber-800 mb-1">主观题/实操题AI阅卷完成</h3>
                   <p className="text-xs text-[#8B621F]/80 mb-3 leading-relaxed">
                     本次考试包含 <span className="font-bold">2个AI对话实操题</span> 和 <span className="font-bold">1个简答题</span>。系统已经完成全部 480 份试卷的初步打分。请总部培训师对低分卷、可疑卷进行重点抽查，并可以通过录音核听纠正AI的评分，确认无误后结束复核发布最终成绩。
                   </p>
                   <div className="flex gap-4">
                      <div className="bg-white px-3 py-1.5 rounded-md border border-[#E8CCA0] flex items-center">
                        <span className="text-[10px] text-[#B9822B] font-bold mr-2">待复核数量</span>
                        <span className="text-sm font-bold text-[#242124]">12 份</span>
                      </div>
                      <div className="bg-white px-3 py-1.5 rounded-md border border-[#E8CCA0] flex items-center">
                        <span className="text-[10px] text-[#B9822B] font-bold mr-2">当前AI均分</span>
                        <span className="text-sm font-bold text-[#242124]">88.5 分</span>
                      </div>
                   </div>
                 </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-4 shrink-0">
               <h3 className="text-sm font-bold text-[#242124]">考生考卷列表</h3>
               <div className="flex gap-2">
                 {reviewingTask?.status === '复核结束' && (
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={handleExportFinishedScores}
                     className="h-8 border-[#DCEFE7] bg-[#EEF8F4] text-xs font-bold text-[#2F735C] hover:bg-[#DCEFE7]"
                   >
                     <Download className="mr-1.5 h-3.5 w-3.5" />
                     导出Excel
                   </Button>
                 )}
                 <div className="relative">
                   <Search className="w-4 h-4 text-[#9A9396] absolute left-3 top-1/2 -translate-y-1/2" />
                   <input
                     type="text"
                     value={scoreSearch}
                     onChange={event => setScoreSearch(event.target.value)}
                     placeholder="搜索姓名、工号、地区、职位或门店..."
                     className="pl-9 pr-4 py-1.5 text-sm border border-[#E5DED8] rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 w-60"
                   />
                 </div>
                 {reviewingTask?.status !== '复核结束' && (
                   <select className="px-3 py-1.5 text-sm border border-[#E5DED8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B9822B]/20 w-40">
                     <option>所有试卷</option>
                     <option>低于 80 分</option>
                     <option>分数异常差异重点</option>
                   </select>
                 )}
               </div>
            </div>

            <div className="flex-1 overflow-auto border border-[#E5DED8] rounded-xl">
               <table className="w-full text-left text-sm">
                 <thead className="bg-[#F8F5F3] sticky top-0 z-10 border-b border-[#E5DED8]">
                   <tr>
                     <th className="p-3 font-medium text-[#766F73] w-24">工号</th>
                     <th className="p-3 font-medium text-[#766F73] w-32">姓名</th>
                     {reviewingTask?.status === '复核结束' && (
                       <th className="p-3 font-medium text-[#766F73] w-28">地区</th>
                     )}
                     {reviewingTask?.status === '复核结束' && (
                       <th className="p-3 font-medium text-[#766F73] w-28">职位</th>
                     )}
                     <th className="p-3 font-medium text-[#766F73] min-w-48">门店</th>
                     {reviewingTask?.status === '复核结束' && (
                       <th className="p-3 font-medium text-[#766F73] w-28">门店渠道</th>
                     )}
                     <th className="p-3 font-medium text-[#766F73] w-24">{reviewingTask?.status === '复核结束' ? '最终得分' : 'AI打分'}</th>
                     {reviewingTask?.status === '复核结束' && (
                       <th className="p-3 font-medium text-[#766F73] w-24">及格分</th>
                     )}
                     <th className="p-3 font-medium text-[#766F73] w-24">{reviewingTask?.status === '复核结束' ? '是否及格' : '状态'}</th>
                     <th className="p-3 font-medium text-[#766F73] w-32 text-right">操作</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredReviewCandidates.map((c) => {
                      const passScore = getCandidatePassScore(reviewingTask, c);
                      const passed = isCandidatePassed(reviewingTask, c);
                      return (
                        <tr key={c.id} className="hover:bg-[#F8F5F3] transition-colors">
                          <td className="p-3 text-[#766F73] font-mono text-xs">{c.id}</td>
                          <td className="p-3 font-medium text-[#242124]">{c.name}</td>
                          {reviewingTask?.status === '复核结束' && (
                            <td className="p-3 text-[#5D565A]">{c.region}</td>
                          )}
                          {reviewingTask?.status === '复核结束' && (
                            <td className="p-3 text-[#5D565A]">{c.positionName}</td>
                          )}
                          <td className="p-3 text-[#5D565A]">{c.store}</td>
                          {reviewingTask?.status === '复核结束' && (
                            <td className="p-3 text-[#5D565A]">{c.storeChannel}</td>
                          )}
                          <td className="p-3">
                            <span className={`font-bold ${passed ? 'text-[#242124]' : 'text-red-500'}`}>{c.aiScore} 分</span>
                          </td>
                          {reviewingTask?.status === '复核结束' && (
                            <td className="p-3 text-[#766F73]">{passScore} 分</td>
                          )}
                          <td className="p-3">
                            {reviewingTask?.status === '复核结束' ? (
                              <Badge variant="outline" className={`${passed ? 'bg-[#EEF8F4] text-[#3B8F72] border-[#BFDCCF]' : 'bg-red-50 text-red-600 border-red-100'} font-bold`}>
                                {passed ? '及格' : '未及格'}
                              </Badge>
                            ) : c.reviewStatus === '已复核' ? (
                              <Badge variant="outline" className="bg-slate-100 text-[#766F73] border-transparent font-normal">已复核</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-[#FFF7EA] text-[#B9822B] border-[#E8CCA0] font-bold">待复核</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="sm" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                              <Eye className="w-4 h-4 mr-1.5" /> 查阅原卷
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredReviewCandidates.length === 0 && (
                      <tr>
                        <td colSpan={reviewingTask?.status === '复核结束' ? 10 : 6} className="p-8 text-center text-sm text-[#9A9396]">
                          暂无符合条件的考生成绩
                        </td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>

          </div>
          <div className="pt-4 mt-4 border-t border-[#E9E4DF] flex justify-end gap-3 shrink-0">
             {reviewingTask?.status === '复核结束' ? (
               <Button variant="outline" onClick={() => setReviewingTask(null)}>关闭</Button>
             ) : (
               <>
                 <Button variant="outline" onClick={() => setReviewingTask(null)}>稍后再复核</Button>
                 <Button className="bg-[#B9822B] hover:bg-[#A67327] text-white shadow-none" onClick={() => setReviewingTask(null)}>一键确认无误结出成绩</Button>
               </>
             )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Insight Dialog */}
      <Dialog open={!!insightTask} onOpenChange={(open) => !open && setInsightTask(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col bg-[#F8F5F3]">
          <DialogHeader className="border-b border-[#E5DED8] pb-4 shrink-0 bg-white px-6 pt-6 -mx-6 -mt-6">
            <DialogTitle className="flex flex-col text-[#242124]">
              <span className="flex items-center text-lg">
                 <TrendingUp className="w-5 h-5 mr-2 text-[#3B8F72]" />
                 考试结果与洞察
              </span>
              <span data-i18n-skip="true" className="text-xs text-[#766F73] font-normal mt-1">{insightTask?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 py-4 flex flex-col gap-6">

            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-4 shrink-0">
              <Card className="shadow-sm border-none">
                <CardContent className="p-5 flex flex-col p-4">
                  <span className="text-xs font-bold text-[#766F73] uppercase tracking-wider mb-2">平均得分</span>
                  <div className="flex items-end gap-2">
                     <span className="text-3xl font-bold text-[#242124]">{MOCK_INSIGHT_DATA.avgScore}</span>
                     <span className="text-sm font-medium text-[#9A9396] mb-1">/ 100</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-none">
                <CardContent className="p-5 flex flex-col p-4">
                  <span className="text-xs font-bold text-[#766F73] uppercase tracking-wider mb-2">整体通过率</span>
                  <div className="flex items-end gap-2">
                     <span className="text-3xl font-bold text-[#3B8F72]">{MOCK_INSIGHT_DATA.passRate}%</span>
                     <span className="text-xs font-medium text-[#9A9396] mb-1.5 line-clamp-1">≥ 80分合格</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-none">
                <CardContent className="p-5 flex flex-col p-4">
                  <span className="text-xs font-bold text-[#766F73] uppercase tracking-wider mb-2">最高分</span>
                  <div className="flex items-end gap-2">
                     <span className="text-3xl font-bold text-[#242124]">{MOCK_INSIGHT_DATA.highestScore}</span>
                     <span className="text-sm font-medium text-[#9A9396] mb-1">/ 100</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-none">
                <CardContent className="p-5 flex flex-col p-4">
                  <span className="text-xs font-bold text-[#766F73] uppercase tracking-wider mb-2">最低分</span>
                  <div className="flex items-end gap-2">
                     <span className="text-3xl font-bold text-[#242124]">{MOCK_INSIGHT_DATA.lowestScore}</span>
                     <span className="text-sm font-medium text-[#9A9396] mb-1">/ 100</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shrink-0 border-none shadow-sm">
              <CardHeader className="border-b border-slate-50 p-5 pb-3">
                <CardTitle className="flex items-center text-sm font-bold text-[#242124]">
                  <BarChart3 className="mr-2 h-4 w-4 text-[#3B8F72]" />
                  成绩分布直方图
                </CardTitle>
                <CardDescription className="text-xs text-[#766F73]">
                  按本次考试最终得分区间统计人数
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={MOCK_INSIGHT_DATA.scoreHistogram} margin={{ top: 8, right: 20, bottom: 0, left: -8 }}>
                      <CartesianGrid stroke="#F1ECE8" vertical={false} />
                      <XAxis dataKey="range" tick={{ fill: '#766F73', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#E5DED8' }} />
                      <YAxis tick={{ fill: '#766F73', fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: '#F8F5F3' }}
                        formatter={(value) => [`${value} 人`, '人数']}
                        labelFormatter={(label) => `分数段 ${label}`}
                        contentStyle={{
                          border: '1px solid #E5DED8',
                          borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(31,28,31,0.08)',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" name="人数" fill="#3B8F72" radius={[6, 6, 0, 0]} barSize={54} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shrink-0 border-none shadow-sm">
              <CardHeader className="border-b border-slate-50 p-5 pb-3">
                <CardTitle className="flex items-center text-sm font-bold text-[#242124]">
                  <Users className="mr-2 h-4 w-4 text-[#3B8F72]" />
                  不同职位通过率
                </CardTitle>
                <CardDescription className="text-xs text-[#766F73]">
                  按考生职位匹配对应及格分数线后统计
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
                {insightPositionPassSummaries.map(summary => (
                  <div key={`${summary.positionName}-${summary.passScore}`} className="rounded-xl border border-[#E9E4DF] bg-[#FCFAF8] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#242124]">{summary.positionName}</p>
                        <p className="mt-1 text-xs text-[#766F73]">及格线 {summary.passScore} 分</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${summary.passRate >= 90 ? 'bg-[#EEF8F4] text-[#2F735C]' : summary.passRate >= 70 ? 'bg-[#FFF7EA] text-[#8B621F]' : 'bg-red-50 text-red-600'}`}>
                        {summary.passRate}%
                      </span>
                    </div>
                    <Progress
                      value={summary.passRate}
                      className="mt-3 h-2 bg-[#F1ECE8]"
                      indicatorClassName={summary.passRate >= 90 ? 'bg-[#3B8F72]' : summary.passRate >= 70 ? 'bg-[#B9822B]' : 'bg-red-500'}
                    />
                    <div className="mt-2 flex justify-between text-[11px] text-[#766F73]">
                      <span>及格 {summary.passed} 人</span>
                      <span>参考 {summary.total} 人</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
               {/* Left: Knowledge Gaps */}
               <Card className="shadow-sm border-none flex flex-col">
                 <CardHeader className="p-5 pb-3 shrink-0 border-b border-slate-50">
                    <CardTitle className="text-sm font-bold flex items-center text-[#242124]">
                      <HelpCircle className="w-4 h-4 mr-2 text-rose-500" /> 高频错题 / 知识薄弱点
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-5 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                      {MOCK_INSIGHT_DATA.knowledgeGaps.map((gap, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                             <span className="font-medium text-[#3F3A3D]">{gap.title}</span>
                             <span className="text-rose-600 font-bold">错误率 {gap.errorRate}%</span>
                          </div>
                    <Progress value={gap.errorRate} className="h-2 bg-slate-100" indicatorClassName="bg-rose-400" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-800 leading-relaxed font-medium">
                      💡 <span className="font-bold">AI 建议：</span> 发现大部分 BA 在“敏感肌换季护肤步骤”和对大促价格异议处理上存在短板，建议后续指派该两门专题课件进行复补。
                    </div>
                 </CardContent>
               </Card>

               {/* Right: Top Performers */}
               <Card className="shadow-sm border-none flex flex-col">
                 <CardHeader className="p-5 pb-3 shrink-0 border-b border-slate-50">
                    <CardTitle className="relative w-fit max-w-full pr-5 text-sm font-bold flex items-center text-[#242124] group/top-performer-note">
                      <span className="absolute -right-1 -top-2 z-10 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-[9px] font-bold leading-4 text-white text-center shadow-sm backdrop-blur-sm">注</span>
                      <Trophy className="w-4 h-4 mr-2 text-[#B9822B]" /> 优秀标杆 (TOP 3)
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover/top-performer-note:block z-[80] w-72 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm">
                        给研发：同分就按谁早交卷排。
                      </div>
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0 flex-1 overflow-y-auto">
                    <ul className="divide-y divide-slate-50">
                      {MOCK_INSIGHT_DATA.topPerformers.map((p, i) => (
                        <li key={i} className="flex items-center justify-between p-4 hover:bg-[#F8F5F3] transition-colors">
                          <div className="flex items-center gap-4">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${
                               i === 0 ? 'bg-[#F7E6C8] text-[#B9822B]' :
                               i === 1 ? 'bg-slate-200 text-[#766F73]' : 'bg-orange-100 text-orange-700'
                             }`}>
                               {i + 1}
                             </div>
                             <div>
                               <p className="text-sm font-bold text-[#242124]">{p.name}</p>
                               <p className="text-xs text-[#766F73]">{p.store}</p>
                             </div>
                          </div>
                          <div className="text-xl font-black text-[#242124]">
                            {p.score} <span className="text-[10px] font-bold text-[#9A9396]">分</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                 </CardContent>
               </Card>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
