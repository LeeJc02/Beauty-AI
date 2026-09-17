import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Plus, Clock, Target, Calendar, CheckCircle2, FileText, Bot, MessageSquareText, TextSelect, Users, CheckCircle, Search, AlertTriangle, FileAudio, FileVideo, ShieldCheck, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { getProgressTone, getTaskStatusBadgeClass } from '../lib/visualTones';
import type { MediaKind, PracticeCaptureConfig } from '../types';
import { syncInspectionSource } from '../lib/inspectionStore';
import { DEMO_PREVIOUS_WEEK, DEMO_WEEK, demoDate } from '../lib/demoDates';

const MOCK_AVATARS = [
  { id: 'a1', title: 'Ibu Nisa (VIP)' },
  { id: 'a2', title: 'Rina (Ingredient Geek)' },
];

const MOCK_SCRIPTS = [
  { id: 's1', title: '双萃精华促单话术' },
  { id: 's2', title: '敏感肌换季安抚' },
];

const MOCK_QUOTES = [
  { id: 'q1', title: '经典王牌：水油双泵黄金比例' },
  { id: 'q2', title: '异议处理：网上比专柜便宜' },
];

export const MOCK_PRACTICE_TASKS = [
  {
    id: 'pt1',
    title: '11月每日打卡：双萃冲刺陪练',
    status: '进行中',
    publishTime: DEMO_WEEK,
    deadline: demoDate(6),
    target: '全国直营门店BA',
    frequency: '每日完成 1 次',
    items: {
      avatars: ['a1'],
      scripts: ['s1'],
      quotes: ['q1']
    },
    progress: 58,
    targetCount: 1428,
    completedCount: 828,
    periodCompletedCount: 828,
    periodTargetCount: 1428,
    periodProgress: 58,
    scope: '全国',
    capture: {
      enabled: true,
      mediaKind: 'video' as MediaKind,
      fullInteractionRecording: true,
      consentRequired: true,
      limits: { maxDurationSec: 600, maxBytes: 500 * 1024 * 1024, acceptedMimeTypes: ['video/mp4', 'video/quicktime'] }
    } satisfies PracticeCaptureConfig,
    captureStats: { submittedCount: 780, analysisCompletedCount: 724, consentDeniedCount: 26 },
  },
  {
    id: 'pt2',
    title: '新功能实战：场景剧本每周通关',
    status: '已结束',
    publishTime: DEMO_PREVIOUS_WEEK,
    deadline: demoDate(-2),
    target: '华东区BA',
    frequency: '每周完成 3 次',
    items: {
      avatars: ['a2'],
      scripts: ['s1', 's2'],
      quotes: []
    },
    progress: 88,
    targetCount: 350,
    completedCount: 308,
    scope: '全国',
    capture: {
      enabled: false,
      fullInteractionRecording: true,
      consentRequired: true,
      limits: { maxDurationSec: 0, maxBytes: 0, acceptedMimeTypes: [] }
    } satisfies PracticeCaptureConfig,
    captureStats: { submittedCount: 0, analysisCompletedCount: 0, consentDeniedCount: 0 },
  },
  {
    id: 'pt3',
    title: '南区特定客诉处理专项',
    status: '进行中',
    publishTime: demoDate(2),
    deadline: demoDate(20),
    target: '南区所有门店BA',
    frequency: '每周完成 2 次',
    items: {
      avatars: ['a1'],
      scripts: ['s2'],
      quotes: []
    },
    progress: 15,
    targetCount: 300,
    completedCount: 45,
    periodCompletedCount: 45,
    periodTargetCount: 300,
    periodProgress: 15,
    scope: '区域',
    region: '南区',
    capture: {
      enabled: true,
      mediaKind: 'audio' as MediaKind,
      fullInteractionRecording: true,
      consentRequired: true,
      limits: { maxDurationSec: 600, maxBytes: 80 * 1024 * 1024, acceptedMimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav'] }
    } satisfies PracticeCaptureConfig,
    captureStats: { submittedCount: 39, analysisCompletedCount: 36, consentDeniedCount: 4 },
  }
];

const MOCK_CANDIDATES = [
  { id: 'BA001', name: 'Siti Aminah', store: 'Jakarta Grand Indonesia', status: '已达标', captureStatus: '已采集', analysisStatus: '已完成' },
  { id: 'BA002', name: 'Budi Santoso', store: 'Jakarta Plaza Senayan', status: '练习中', captureStatus: '已采集', analysisStatus: '分析中' },
  { id: 'BA003', name: 'Ayu Lestari', store: 'Surabaya Tunjungan Plaza', status: '未开始', captureStatus: '未开始', analysisStatus: '--' },
  { id: 'BA004', name: 'Rizky Pratama', store: 'Bali Beachwalk', status: '已达标', captureStatus: '已采集', analysisStatus: '已完成' },
  { id: 'BA005', name: 'Dewi Sartika', store: 'Bandung Trans Studio', status: '练习中', captureStatus: '未授权', analysisStatus: '--' },
  { id: 'BA006', name: 'Agung Setiawan', store: 'Medan Centre Point', status: '已达标', captureStatus: '已采集', analysisStatus: '待处理' },
  { id: 'BA007', name: 'Putri Maharani', store: 'Yogyakarta Hartono Mall', status: '练习中', captureStatus: '已采集', analysisStatus: '分析中' },
];

const getPracticeCycleLabel = (frequency: string) => {
  if (frequency.includes('每日')) return '本日';
  if (frequency.includes('每周')) return '本周';
  return '当前周期';
};

const getPracticeRateMetric = (task: any) => {
  if (task.status === '已结束') {
    return {
      completedCount: task.completedCount,
      completedLabel: '已达标',
      countText: `${task.completedCount} / ${task.targetCount} 人已达标`,
      progress: task.progress,
      rateLabel: '整体达标率',
      ruleText: '达标 = 完成全部要求次数',
      shortText: `${task.progress}% 达标`,
      targetCount: task.targetCount,
    };
  }

  const cycleLabel = getPracticeCycleLabel(task.frequency);
  const completedCount = task.periodCompletedCount ?? task.completedCount;
  const targetCount = task.periodTargetCount ?? task.targetCount;
  const progress = task.periodProgress ?? task.progress;
  return {
    completedCount,
    completedLabel: `${cycleLabel}已达标`,
    countText: `${cycleLabel} ${completedCount} / ${targetCount} 人已达标`,
    progress,
    rateLabel: `${cycleLabel}达标率`,
    ruleText: `达标 = ${cycleLabel}完成规定次数`,
    shortText: `${cycleLabel} ${progress}% 达标`,
    targetCount,
  };
};

export function PracticeTaskManage({ isReadOnly = false, userRole }: { isReadOnly?: boolean, userRole?: string }) {
  const [tasks, setTasks] = useState(MOCK_PRACTICE_TASKS);
  React.useEffect(() => { syncInspectionSource('practice', 'practice_task_manage', tasks); }, [tasks]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(MOCK_PRACTICE_TASKS[0].id);
  const [createDialog, setCreateDialog] = useState(false);
  const [detailTask, setDetailTask] = useState<any>(null);
  const [deactivateTask, setDeactivateTask] = useState<any>(null);
  const [captureMode, setCaptureMode] = useState<'none' | MediaKind>('none');

  const targets = (userRole === 'Regional Training Manager' || userRole === 'Regional Trainer')
    ? ['雅加达南区所有门店 BA', '本区域店长', '本区域新入职员工']
    : ['全国所有门店 BA', '华北区区域经理', '华东区店长', '入职不满3个月的新人'];

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const isRegionalReadOnlyTask = selectedTask && (userRole === 'Regional Training Manager' || userRole === 'Regional Trainer') && selectedTask.scope === '全国';
  const canDeactivateSelectedTask = Boolean(selectedTask && !isReadOnly && !isRegionalReadOnlyTask && selectedTask.status === '进行中');
  const selectedTaskRateMetric = selectedTask ? getPracticeRateMetric(selectedTask) : null;
  const detailTaskRateMetric = detailTask ? getPracticeRateMetric(detailTask) : null;

  const handleDeactivateTask = () => {
    if (!deactivateTask) return;

    setTasks(prev => prev.map(task =>
      task.id === deactivateTask.id
        ? { ...task, status: '已停用' }
        : task
    ));
    if (detailTask?.id === deactivateTask.id) {
      setDetailTask((prev: any) => prev ? { ...prev, status: '已停用' } : prev);
    }
    setDeactivateTask(null);
  };

  return (
    <div className="flex h-full bg-[#F7F3F1] overflow-hidden pt-2 rounded-xl border border-[#E5DED8]">
      {/* Left Sidebar */}
      <div className="task-list-sidebar w-80 bg-white border-r border-[#E5DED8] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#E9E4DF] flex flex-wrap items-center justify-between gap-3 z-10 bg-white">
          <h2 className="min-w-0 font-bold text-[#242124] tracking-tight">练习任务列表</h2>
          {!isReadOnly && (
            <Button size="sm" className="h-8 shrink-0 gap-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm" onClick={() => setCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              新建
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tasks.map(task => (
            <React.Fragment key={task.id}>
            <div
              onClick={() => setSelectedTaskId(task.id)}
              className={`p-4 rounded-xl cursor-pointer transition-all border ${
                selectedTaskId === task.id
                  ? 'bg-rose-50/50 border-rose-200 shadow-sm'
                  : 'bg-white border-[#E9E4DF] hover:border-rose-100 hover:bg-[#F8F5F3]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                 <div className="flex flex-wrap items-center gap-2">
                   <Badge variant="outline" className={`text-[10px] py-0 ${getTaskStatusBadgeClass(task.status)}`}>
                     {task.status}
                   </Badge>
                   <Badge variant="outline" className={`text-[10px] py-0 ${task.scope === '全国' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-[#EEF8F4] text-[#3B8F72] border-emerald-200'}`}>
                     {task.scope === '区域' && task.region ? task.region : '全国'}
                   </Badge>
                 </div>
              </div>
              <h3 data-i18n-skip="true" className={`font-bold text-sm mb-2 line-clamp-2 leading-snug ${
                selectedTaskId === task.id ? 'text-rose-950' : 'text-[#242124]'
              }`}>
                {task.title}
              </h3>
              <div className="task-card-metrics flex items-center justify-between mt-3 text-[10px] text-[#9A9396] font-medium">
                <span className="flex min-w-0 items-start leading-snug"><Clock className="w-3 h-3 mr-1 mt-0.5 shrink-0" /> {task.frequency}</span>
                <span className={`font-bold leading-snug ${getProgressTone(task.progress).textClass}`}>
                  {getPracticeRateMetric(task).shortText}
                </span>
              </div>
            </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col flex-wrap bg-[#F8F5F3]/50">
        {selectedTask ? (
          <div className="h-full flex flex-col max-w-4xl mx-auto w-full">
            <div className="p-8 border-b border-[#E5DED8] bg-white shrink-0">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                   <Badge variant="outline" className={getTaskStatusBadgeClass(selectedTask.status)}>
                     {selectedTask.status}
                   </Badge>
                   <Badge variant="outline" className={`${selectedTask.scope === '全国' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-[#EEF8F4] text-[#3B8F72] border-emerald-200'}`}>
                     {selectedTask.scope === '区域' && selectedTask.region ? selectedTask.region : '全国'}
                   </Badge>
                   {selectedTask.capture.enabled && (
                     <Badge variant="outline" className={`gap-1 ${selectedTask.capture.mediaKind === 'video' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-violet-200 bg-violet-50 text-violet-700'}`}>
                       {selectedTask.capture.mediaKind === 'video' ? <FileVideo className="h-3.5 w-3.5" /> : <FileAudio className="h-3.5 w-3.5" />}
                       {selectedTask.capture.mediaKind === 'video' ? '完整视频采集' : '完整音频采集'}
                     </Badge>
                   )}
                 </div>
                 <div className="flex space-x-2">
                   <Button
                     variant="outline"
                     size="sm"
                     className="h-8 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                     disabled={!canDeactivateSelectedTask}
                     onClick={() => setDeactivateTask(selectedTask)}
                   >
                     {selectedTask.status === '已停用' ? '已停用' : '停用任务'}
                   </Button>
                   <Button size="sm" className="h-8 bg-rose-600 hover:bg-rose-700 text-white shadow-none" onClick={() => setDetailTask(selectedTask)}>查看完成明细</Button>
                 </div>
              </div>
              <h1 data-i18n-skip="true" className="text-2xl font-bold text-[#242124] mb-2">{selectedTask.title}</h1>

              <div className="grid grid-cols-4 gap-6 mt-6">
                 <div className="flex flex-col">
                   <span className="text-[10px] uppercase tracking-wider text-[#766F73] font-bold mb-1 flex items-center"><Target className="w-3 h-3 mr-1" /> 分发对象</span>
                   <span className="text-sm font-medium text-[#242124]">{selectedTask.target}</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[10px] uppercase tracking-wider text-[#766F73] font-bold mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> 练习频次</span>
                   <span className="text-sm font-medium text-[#242124]">{selectedTask.frequency}</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[10px] uppercase tracking-wider text-[#766F73] font-bold mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> 任务周期</span>
                   <span className="text-xs font-medium text-[#242124]">{selectedTask.publishTime} 至 {selectedTask.deadline}</span>
                 </div>
                 {selectedTaskRateMetric && (
                   <div className="flex flex-col">
                     <span className="text-[10px] uppercase tracking-wider text-[#766F73] font-bold mb-1 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> {selectedTaskRateMetric.rateLabel}</span>
                     <span className={`text-sm font-bold ${getProgressTone(selectedTaskRateMetric.progress).textClass}`}>{selectedTaskRateMetric.progress}%</span>
                     <span className="mt-1 text-[10px] leading-snug text-[#766F73]">{selectedTaskRateMetric.countText}</span>
                     <span className="mt-0.5 text-[10px] leading-snug text-[#9A9396]">{selectedTaskRateMetric.ruleText}</span>
                   </div>
                 )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
               {selectedTask.capture.enabled && (
                 <section className="mb-6 overflow-hidden rounded-lg border border-[#D8DEFF] bg-white">
                   <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E8FF] bg-[#F3F5FF] px-4 py-3">
                     <div>
                       <h3 className="flex items-center gap-2 text-sm font-bold text-[#3F48B4]">
                         {selectedTask.capture.mediaKind === 'video' ? <FileVideo className="h-4 w-4" /> : <FileAudio className="h-4 w-4" />}
                         音视频采集情况
                       </h3>
                       <p className="mt-1 text-xs text-[#5962B9]">取得 BA 许可后，每次互动从开始到结束完整录制</p>
                     </div>
                     <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#3B8F72]"><ShieldCheck className="h-3.5 w-3.5" />许可确认已开启</span>
                   </div>
                   <div className="grid grid-cols-2 gap-px bg-[#E9E4DF] sm:grid-cols-4">
                     <div className="bg-white px-4 py-3"><div className="text-[10px] font-bold text-[#9A9396]">采集类型</div><div className="mt-1 text-sm font-bold text-[#242124]">{selectedTask.capture.mediaKind === 'video' ? '视频' : '音频'}</div></div>
                     <div className="bg-white px-4 py-3"><div className="text-[10px] font-bold text-[#9A9396]">已采集</div><div className="mt-1 text-sm font-bold text-[#242124]">{selectedTask.captureStats.submittedCount} 人</div></div>
                     <div className="bg-white px-4 py-3"><div className="text-[10px] font-bold text-[#9A9396]">AI 已分析</div><div className="mt-1 flex items-center gap-1 text-sm font-bold text-[#515BCB]"><Sparkles className="h-3.5 w-3.5" />{`${selectedTask.captureStats.analysisCompletedCount} 份分析`}</div></div>
                     <div className="bg-white px-4 py-3"><div className="text-[10px] font-bold text-[#9A9396]">未授权</div><div className="mt-1 text-sm font-bold text-[#B9822B]">{`${selectedTask.captureStats.consentDeniedCount} 次`}</div></div>
                   </div>
                 </section>
               )}
               <h3 className="text-sm font-bold text-[#242124] mb-4 flex items-center">
                 包含的训练资产
               </h3>
               <div className="grid grid-cols-2 gap-4">

                 {selectedTask.items.avatars.length > 0 && (
                   <Card className="border-[#E5DED8]">
                     <CardContent className="p-4">
                       <div className="flex items-center text-xs font-bold text-[#3B8F72] mb-3"><Bot className="w-4 h-4 mr-1.5" /> 指定数字人顾客 ({selectedTask.items.avatars.length})</div>
                       <ul className="space-y-2">
                         {selectedTask.items.avatars.map(id => {
                           const c = MOCK_AVATARS.find(x => x.id === id);
                           return <li key={id} data-i18n-skip="true" className="text-sm font-medium text-[#3F3A3D] bg-[#F8F5F3] p-2 rounded-md">{c?.title}</li>
                         })}
                       </ul>
                     </CardContent>
                   </Card>
                 )}

                 {selectedTask.items.scripts.length > 0 && (
                   <Card className="border-[#E5DED8]">
                     <CardContent className="p-4">
                       <div className="flex items-center text-xs font-bold text-blue-600 mb-3"><MessageSquareText className="w-4 h-4 mr-1.5" /> 指定场景剧本 ({selectedTask.items.scripts.length})</div>
                       <ul className="space-y-2">
                         {selectedTask.items.scripts.map(id => {
                           const c = MOCK_SCRIPTS.find(x => x.id === id);
                           return <li key={id} data-i18n-skip="true" className="text-sm font-medium text-[#3F3A3D] bg-[#F8F5F3] p-2 rounded-md">{c?.title}</li>
                         })}
                       </ul>
                     </CardContent>
                   </Card>
                 )}

                 {selectedTask.items.quotes.length > 0 && (
                   <Card className="border-[#E5DED8]">
                     <CardContent className="p-4">
                       <div className="flex items-center text-xs font-bold text-rose-600 mb-3"><TextSelect className="w-4 h-4 mr-1.5" /> 指定金句跟读 ({selectedTask.items.quotes.length})</div>
                       <ul className="space-y-2">
                         {selectedTask.items.quotes.map(id => {
                           const c = MOCK_QUOTES.find(x => x.id === id);
                           return <li key={id} data-i18n-skip="true" className="text-sm font-medium text-[#3F3A3D] bg-[#F8F5F3] p-2 rounded-md">{c?.title}</li>
                         })}
                       </ul>
                     </CardContent>
                   </Card>
                 )}

               </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#9A9396]">
            <FileText className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-medium text-[#766F73]">在左侧选择一个练习任务查看明细</p>
          </div>
        )}
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-5xl flex flex-col h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>新建周期练习任务</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto flex gap-6 my-4 px-1">
            {/* Left Column: Basic Info */}
            <div className="w-1/3 space-y-5 border-r border-[#E9E4DF] pr-6 shrink-0">
              <div>
                <label className="block text-sm font-bold text-[#3F3A3D] mb-1.5">任务名称</label>
                <input type="text" placeholder="例如：11月每日开口练习计划" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" />
              </div>

              <div>
                 <label className="block text-sm font-bold text-[#3F3A3D] mb-1.5">分发对象 (多选)</label>
                 <div className="space-y-2 p-3 bg-[#F8F5F3] border border-[#E5DED8] rounded-lg h-32 overflow-y-auto">
                   {targets.map(target => (
                     <label key={target} className="flex items-center space-x-2 cursor-pointer">
                       <input type="checkbox" className="rounded border-slate-300 text-rose-600 focus:ring-indigo-500" />
                       <span className="text-sm text-[#3F3A3D]">{target}</span>
                     </label>
                   ))}
                 </div>
              </div>

               <div>
                 <label className="block text-sm font-bold text-[#3F3A3D] mb-1.5">截止时间</label>
                 <input type="date" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all" />
               </div>

              <div>
                 <label className="block text-sm font-bold text-[#3F3A3D] mb-1.5">练习频次要求</label>
                 <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all">
                   <option>每日完成 1 次</option>
                   <option>每周完成 3 次</option>
                   <option>周期内一次性通关</option>
                 </select>
              </div>
            </div>

            {/* Right Column: Asset Selection */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-sm font-bold text-[#3F3A3D] mb-2">配置练习素材 (可选多项组合)</label>

              <div className="flex-1 overflow-y-auto border border-[#E5DED8] rounded-lg bg-[#F8F5F3]/50 p-4 space-y-6">

                {/* 1. Avatars */}
                <div className="space-y-3">
                   <div className="text-sm font-bold text-[#3B8F72] flex items-center border-b border-emerald-100 pb-2"><Bot className="w-5 h-5 mr-2" /> 数字人顾客自由练</div>
                   <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {MOCK_AVATARS.map(item => (
                         <label key={item.id} className="relative flex flex-col p-3 bg-white rounded-xl border border-[#E5DED8] cursor-pointer hover:border-emerald-300 hover:shadow-sm  transition-all group">
                           <div className="absolute top-2 right-2 z-10">
                             <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#3B8F72] focus:ring-emerald-500 shadow-sm" />
                           </div>
                           <div className="w-12 h-12 bg-[#EEF8F4] rounded-full flex items-center justify-center mb-2 mx-auto border border-emerald-100">
                             <span className="text-[#3B8F72] font-bold text-sm">3D</span>
                           </div>
                           <span data-i18n-skip="true" className="text-xs font-bold text-center text-[#3F3A3D] group-hover:text-[#2F735C]">{item.title}</span>
                         </label>
                      ))}
                   </div>
                </div>

                {/* 2. Scripts */}
                <div className="space-y-3">
                   <div className="text-sm font-bold text-blue-600 flex items-center border-b border-blue-100 pb-2"><MessageSquareText className="w-5 h-5 mr-2" /> 场景剧本通关</div>
                   <div className="grid grid-cols-2 gap-3">
                      {MOCK_SCRIPTS.map(item => (
                         <label key={item.id} className="relative flex items-center p-3 bg-white rounded-xl border border-[#E5DED8] cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group">
                           <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 mr-3">
                             <MessageSquareText className="w-4 h-4" />
                           </div>
                           <span data-i18n-skip="true" className="text-xs font-bold text-[#3F3A3D] flex-1 group-hover:text-blue-700 line-clamp-1">{item.title}</span>
                           <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ml-2 shadow-sm" />
                         </label>
                      ))}
                   </div>
                </div>

                {/* 3. Quotes */}
                <div className="space-y-3">
                   <div className="text-sm font-bold text-rose-600 flex items-center border-b border-rose-100 pb-2"><TextSelect className="w-5 h-5 mr-2" /> 金句跟读打分</div>
                   <div className="grid grid-cols-1 gap-2">
                      {MOCK_QUOTES.map(item => (
                         <label key={item.id} className="relative flex items-center justify-between p-3 bg-white rounded-xl border border-[#E5DED8] cursor-pointer hover:border-rose-300 hover:shadow-sm transition-all group">
                           <div className="flex flex-col">
                             <span className="text-[10px] text-[#9A9396] mb-0.5 font-medium uppercase">QUOTE</span>
                             <span data-i18n-skip="true" className="text-xs font-bold text-[#3F3A3D] group-hover:text-rose-700">{item.title}</span>
                           </div>
                           <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 ml-2 shadow-sm shrink-0" />
                         </label>
                      ))}
                   </div>
                </div>

              </div>

              <p className="text-xs text-[#766F73] mt-3 flex items-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#9A9396]" />
                提示：选择不同的素材模块将组合成一个多维度的陪练任务。
              </p>

              <section className="mt-5 rounded-lg border border-[#D8DEFF] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#3F3A3D]"><ShieldCheck className="h-4 w-4 text-[#515BCB]" />音视频采集要求</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([
                    { id: 'none', label: '不采集', icon: CheckCircle2 },
                    { id: 'audio', label: '采集音频', icon: FileAudio },
                    { id: 'video', label: '采集视频', icon: FileVideo },
                  ] as const).map(option => (
                    <button key={option.id} type="button" onClick={() => setCaptureMode(option.id)} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${captureMode === option.id ? 'border-[#AAB4FF] bg-[#F3F5FF] text-[#3F48B4]' : 'border-[#E9E4DF] text-[#766F73] hover:border-[#D8DEFF]'}`}>
                      <option.icon className="h-4 w-4" />{option.label}
                    </button>
                  ))}
                </div>
                {captureMode !== 'none' && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#BFDCCF] bg-[#EEF8F4] px-3 py-2 text-xs leading-relaxed text-[#2F735C]">开始互动前由 APP 向 BA 征得许可，拒绝不阻塞练习。</div>
                    <div className="rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] px-3 py-2 text-xs leading-relaxed text-[#5D565A]">完整录制每次互动，最长 10 分钟；{captureMode === 'video' ? 'MP4 / MOV，500 MB' : 'MP3 / M4A / WAV，80 MB'}。</div>
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-[#E9E4DF] shrink-0">
            <Button variant="outline" onClick={() => setCreateDialog(false)}>取消</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => {
              setTasks([{
                id: `pt${Date.now()}`,
                title: '新建测试任务',
                status: '进行中',
                publishTime: new Date().toISOString().split('T')[0],
                deadline: demoDate(14),
                target: '选中的人群',
                frequency: '每日完成 1 次',
                items: {
                  avatars: ['a1'],
                  scripts: [],
                  quotes: []
                },
                progress: 0,
                targetCount: 100,
                completedCount: 0,
                periodCompletedCount: 0,
                periodTargetCount: 100,
                periodProgress: 0,
                scope: (userRole === 'Regional Training Manager' || userRole === 'Regional Trainer') ? '区域' : '全国',
                region: (userRole === 'Regional Training Manager' || userRole === 'Regional Trainer') ? '南区' : undefined,
                capture: {
                  enabled: captureMode !== 'none',
                  mediaKind: captureMode === 'none' ? undefined : captureMode,
                  fullInteractionRecording: true,
                  consentRequired: true,
                  limits: {
                    maxDurationSec: captureMode === 'none' ? 0 : 600,
                    maxBytes: captureMode === 'video' ? 500 * 1024 * 1024 : captureMode === 'audio' ? 80 * 1024 * 1024 : 0,
                    acceptedMimeTypes: captureMode === 'video' ? ['video/mp4', 'video/quicktime'] : captureMode === 'audio' ? ['audio/mpeg', 'audio/mp4', 'audio/wav'] : []
                  }
                } satisfies PracticeCaptureConfig,
                captureStats: { submittedCount: 0, analysisCompletedCount: 0, consentDeniedCount: 0 },
              }, ...tasks]);
              setCaptureMode('none');
              setCreateDialog(false);
            }}>确认发布任务</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate Task Dialog */}
      <Dialog open={!!deactivateTask} onOpenChange={(open) => !open && setDeactivateTask(null)}>
        <DialogContent className="sm:max-w-md border border-red-100">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              停用任务
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm font-bold text-[#242124]">该任务将停用，是否确定？</p>
            <p className="text-xs leading-relaxed text-[#766F73]">
              停用后学员将不再收到或继续完成该任务，任务记录会保留在管理列表中。
            </p>
            {deactivateTask && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                <p data-i18n-skip="true" className="text-xs font-bold text-red-700 line-clamp-1">{deactivateTask.title}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-6 gap-3">
            <Button variant="outline" onClick={() => setDeactivateTask(null)}>
              取消
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold" onClick={handleDeactivateTask}>
              确认停用
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!detailTask} onOpenChange={(open) => !open && setDetailTask(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b border-[#E9E4DF] pb-4 shrink-0">
            <DialogTitle className="flex items-center text-[#242124]">
              <Users className="w-5 h-5 mr-2 text-rose-600" />
              {detailTask?.title} - 完成明细
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pt-4 flex flex-col min-h-0">
            <div className="grid grid-cols-3 gap-4 mb-6 shrink-0">
               <Card className="bg-[#F8F5F3] border-[#E9E4DF] shadow-none">
                 <CardContent className="p-4 flex items-center justify-between">
                   <div>
                     <p className="text-xs font-medium text-[#766F73] mb-1">目标人数</p>
                     <p className="text-xl font-bold text-[#242124]">{detailTask?.targetCount}</p>
                   </div>
                   <Users className="w-8 h-8 text-indigo-200" />
                 </CardContent>
               </Card>
               <Card className="bg-[#F8F5F3] border-[#E9E4DF] shadow-none">
                 <CardContent className="p-4 flex items-center justify-between">
                   <div>
                     <p className="text-xs font-medium text-[#766F73] mb-1">{detailTaskRateMetric?.completedLabel ?? '已达标'}</p>
                     <p className="text-xl font-bold text-rose-600">{detailTaskRateMetric?.completedCount ?? detailTask?.completedCount}</p>
                   </div>
                   <CheckCircle className="w-8 h-8 text-indigo-200" />
                 </CardContent>
               </Card>
               {detailTaskRateMetric && (
                 <Card className="bg-[#F8F5F3] border-[#E9E4DF] shadow-none">
                   <CardContent className="p-4 flex items-center justify-between">
                     <div>
                       <p className="text-xs font-medium text-[#766F73] mb-1">{detailTaskRateMetric.rateLabel}</p>
                       <p className={`text-xl font-bold ${getProgressTone(detailTaskRateMetric.progress).textClass}`}>{detailTaskRateMetric.progress}%</p>
                       <p className="mt-1 text-[10px] leading-snug text-[#766F73]">{detailTaskRateMetric.countText}</p>
                       <p className="mt-0.5 text-[10px] leading-snug text-[#9A9396]">{detailTaskRateMetric.ruleText}</p>
                     </div>
                     <Target className="w-8 h-8 text-indigo-200" />
                   </CardContent>
                 </Card>
               )}
            </div>

            {detailTask?.capture?.enabled && (
              <div className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[#D8DEFF] bg-[#D8DEFF] shrink-0">
                <div className="bg-[#F3F5FF] px-4 py-3"><div className="text-[10px] font-bold text-[#5962B9]">已采集</div><div className="mt-1 text-lg font-bold text-[#3F48B4]">{detailTask.captureStats.submittedCount} 人</div></div>
                <div className="bg-[#F3F5FF] px-4 py-3"><div className="text-[10px] font-bold text-[#5962B9]">AI 已分析</div><div className="mt-1 text-lg font-bold text-[#3F48B4]">{`${detailTask.captureStats.analysisCompletedCount} 份分析`}</div></div>
                <div className="bg-[#F3F5FF] px-4 py-3"><div className="text-[10px] font-bold text-[#5962B9]">未授权</div><div className="mt-1 text-lg font-bold text-[#B9822B]">{`${detailTask.captureStats.consentDeniedCount} 次`}</div></div>
              </div>
            )}

            <div className="flex justify-between items-center mb-4 shrink-0">
               <h3 className="text-sm font-bold text-[#242124]">学员明细</h3>
               <div className="relative">
                 <Search className="w-4 h-4 text-[#9A9396] absolute left-3 top-1/2 -translate-y-1/2" />
                 <input type="text" placeholder="搜索工号、姓名、门店..." className="pl-9 pr-4 py-1.5 text-sm border border-[#E5DED8] rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 w-64" />
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
                     {detailTask?.capture?.enabled && <th className="p-3 font-medium text-[#766F73] w-36">采集 / AI</th>}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 bg-white">
                    {MOCK_CANDIDATES.map((c) => (
                      <tr key={c.id} className="hover:bg-[#F8F5F3] transition-colors">
                        <td className="p-3 text-[#766F73] font-mono text-xs">{c.id}</td>
                        <td className="p-3 font-medium text-[#242124]">{c.name}</td>
                        <td className="p-3 text-[#5D565A]">{c.store}</td>
                        <td className="p-3">
                          {c.status === '已达标' && <Badge variant="outline" className={`${getTaskStatusBadgeClass(c.status)} border-none font-normal`}>已达标</Badge>}
                          {c.status === '练习中' && <Badge variant="outline" className={`${getTaskStatusBadgeClass(c.status)} border-none font-normal`}>练习中</Badge>}
                          {c.status === '未开始' && <Badge variant="outline" className={`${getTaskStatusBadgeClass(c.status)} border-none font-normal`}>未开始</Badge>}
                        </td>
                        {detailTask?.capture?.enabled && (
                          <td className="p-3">
                            <div className="text-xs font-medium text-[#3F3A3D]">{c.captureStatus}</div>
                            <div className={`mt-1 text-[10px] ${c.analysisStatus === '已完成' ? 'text-[#3B8F72]' : c.analysisStatus === '待处理' ? 'text-[#B9822B]' : 'text-[#9A9396]'}`}>{c.analysisStatus}</div>
                          </td>
                        )}
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
