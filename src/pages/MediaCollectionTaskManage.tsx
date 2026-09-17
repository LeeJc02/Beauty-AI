import React, { useMemo, useState } from 'react';
import { syncInspectionSource, toMediaInspectionTask } from '../lib/inspectionStore';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  ExternalLink,
  FileAudio,
  FileVideo,
  History,
  Mic2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  Video,
  WandSparkles,
  X,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { getProgressTone, getScoreTone, getTaskStatusBadgeClass } from '../lib/visualTones';
import type {
  CaptureTarget,
  MediaAnalysisStatus,
  MediaCollectionTask,
  MediaKind,
  MediaSubmission,
  Role,
  RubricDimension,
} from '../types';

const PRODUCTS = [
  { id: 'p1', name: 'BS B5高保湿面霜', version: '2026.05', description: '主打高浓度维他命B5与神经酰胺，适合干敏皮换季修护。' },
  { id: 'p2', name: 'BS 急救舒缓精华', version: '2026.03', description: '高频次安抚敏感泛红，质地轻薄。' },
  { id: 'p3', name: '极光焕白精华液', version: '2026.02', description: '阻断黑色素沉积，温和提亮肤色。' },
  { id: 'p4', name: '丝绒持妆粉底液', version: '2026.04', description: '24小时长效贴合，打造高级哑光丝绒妆效。' },
];

const NATIONAL_COVERAGE_REGIONS = [
  '雅加达区', '泗水区', '巴厘岛区', '万隆区', '棉兰区', '望加锡区', '日惹区',
  '三宝垄区', '万丹区', '万鸦老区', '北干巴鲁区', '巨港区', '巴东区', '坤甸区',
  '班贾尔马辛区', '巴厘巴板区', '茂物区', '勿加泗区', '德博区', '唐格朗区', '玛琅区',
  '占碑区', '亚齐区', '楠榜区', '芝勒邦区', '卡拉旺区', '任抹区', '巴布亚区',
];

const DEMO_TRANSCRIPT = '顾客您好，我先了解一下您最近的肤质状态。如果主要是换季紧绷和泛红，这款 B5 面霜的神经酰胺能帮助修护屏障，质地也不是厚重浮在表面的感觉……';

const AUDIENCES_BY_ROLE: Record<'national' | 'regional', Array<{ id: string; label: string }>> = {
  national: [
    { id: 'all-ba', label: '全国所有门店 BA' },
    { id: 'new-ba', label: '入职不满3个月的新人' },
    { id: 'east-ba', label: '华东区直营门店 BA' },
    { id: 'low-score-ba', label: '近30天练习达标率低于60%的 BA' },
  ],
  regional: [
    { id: 'region-all-ba', label: '本区域所有门店 BA' },
    { id: 'region-new-ba', label: '本区域新入职 BA' },
    { id: 'region-low-score-ba', label: '本区域近30天练习达标率低于60%的 BA' },
  ],
};

const initialRubric: RubricDimension[] = [
  { id: 'r1', name: '需求挖掘', description: '能否通过提问确认顾客肤质、痛点和使用场景。', weight: 25, required: true },
  { id: 'r2', name: '产品表达', description: '准确表达核心卖点，并把成分与顾客需求建立关联。', weight: 35, required: true },
  { id: 'r3', name: '异议处理', description: '回应价格、肤感或效果顾虑，给出可执行的解决方案。', weight: 25, required: false },
  { id: 'r4', name: '表达状态', description: '语速、清晰度、镜头感和服务态度自然得体。', weight: 15, required: false },
];

export const initialTasks: MediaCollectionTask[] = [
  {
    id: 'mct-001',
    title: '新品 B5 面霜门店推荐视频征集',
    intro: '请在门店样品区完成一次 2–4 分钟的产品推荐演示，完整呈现需求挖掘、卖点讲解和异议处理。',
    targetAudienceIds: ['all-ba'],
    targetAudienceLabel: '全国所有门店 BA',
    target: { kind: 'product', productId: 'p1', productVersion: '2026.05', productName: 'BS B5高保湿面霜', productDescription: '主打高浓度维他命B5与神经酰胺，适合干敏皮换季修护。' },
    capture: { enabled: true, mediaKind: 'video', submitModes: ['record', 'upload'], consentRequired: true, limits: { maxDurationSec: 300, maxBytes: 300 * 1024 * 1024, acceptedMimeTypes: ['video/mp4', 'video/quicktime'] } },
    rubric: initialRubric,
    startAt: '2026-09-01',
    deadline: '2026-09-20',
    frequency: '周期内一次性提交',
    scope: '全国',
    creatorId: 'HT001',
    creatorName: 'Sarah Lee',
    status: '进行中',
    targetCount: 1428,
    submittedCount: 684,
    consentDeniedCount: 23,
    analysisCompletedCount: 612,
    submissions: [
      { id: 'ms-101', baId: 'BA001', baName: 'Siti Aminah', region: '雅加达区', storeName: 'Jakarta Grand Indonesia', submittedAt: '2026-09-03 09:42', durationSec: 196, source: 'record', consentStatus: 'granted', analysisStatus: 'completed', overallScore: 91, tags: ['需求挖掘完整', '成分表达准确'] },
      { id: 'ms-102', baId: 'BA002', baName: 'Budi Santoso', region: '雅加达区', storeName: 'Jakarta Plaza Senayan', submittedAt: '2026-09-03 08:16', durationSec: 244, source: 'upload', consentStatus: 'granted', analysisStatus: 'processing', tags: ['待生成标签'] },
      { id: 'ms-103', baId: 'BA003', baName: 'Ayu Lestari', region: '泗水区', storeName: 'Surabaya Tunjungan Plaza', submittedAt: '2026-09-02 17:30', durationSec: 175, source: 'record', consentStatus: 'granted', analysisStatus: 'needs_attention', overallScore: 72, tags: ['转写不完整', '需人工处理'] },
    ],
  },
  {
    id: 'mct-002',
    title: '高峰期缺货客诉音频采集',
    intro: '模拟顾客因热门产品缺货而抱怨的场景，用语音完成安抚、原因说明、替代品推荐与预订引导。',
    targetAudienceIds: ['region-all-ba'],
    targetAudienceLabel: '南区所有门店 BA',
    target: { kind: 'scenario', title: '处理热门商品缺货抱怨', description: '顾客到店后发现预期购买的热门商品缺货，情绪较激动。', successCriteria: '先共情并道歉，准确说明到货时间，提供替代品或预订方案。' },
    capture: { enabled: true, mediaKind: 'audio', submitModes: ['record', 'upload'], consentRequired: true, limits: { maxDurationSec: 240, maxBytes: 40 * 1024 * 1024, acceptedMimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav'] } },
    rubric: [
      { id: 'r1', name: '情绪安抚', description: '先表达理解与道歉，不推卸责任。', weight: 30, required: true },
      { id: 'r2', name: '信息说明', description: '清晰告知缺货原因与预计到货时间。', weight: 25, required: true },
      { id: 'r3', name: '解决方案', description: '提供替代品、跨店调货或预订选项。', weight: 30, required: true },
      { id: 'r4', name: '语音状态', description: '语气稳定、表达清晰且节奏自然。', weight: 15, required: false },
    ],
    startAt: '2026-09-02',
    deadline: '2026-09-16',
    frequency: '周期内一次性提交',
    scope: '区域',
    region: '南区',
    creatorId: 'RT001',
    creatorName: 'Nurul Huda',
    status: '进行中',
    targetCount: 300,
    submittedCount: 207,
    consentDeniedCount: 8,
    analysisCompletedCount: 199,
    submissions: [
      { id: 'ms-201', baId: 'BA021', baName: 'Dewi Sartika', region: '巴厘岛区', storeName: 'Bali Beachwalk', submittedAt: '2026-09-03 10:12', durationSec: 154, source: 'record', consentStatus: 'granted', analysisStatus: 'completed', overallScore: 86, tags: ['共情自然', '方案清晰'] },
      { id: 'ms-202', baId: 'BA024', baName: 'Putri Maharani', region: '泗水区', storeName: 'Surabaya Tunjungan Plaza', submittedAt: '2026-09-03 09:08', durationSec: 132, source: 'upload', consentStatus: 'granted', analysisStatus: 'failed', tags: ['音质异常'] },
    ],
  },
  {
    id: 'mct-003',
    title: '丝绒粉底上妆话术音频抽检',
    intro: '围绕持妆、哑光妆效与适用肤质完成一段产品介绍。',
    targetAudienceIds: ['east-ba'],
    targetAudienceLabel: '华东区直营门店 BA',
    target: { kind: 'product', productId: 'p4', productVersion: '2026.04', productName: '丝绒持妆粉底液', productDescription: '24小时长效贴合，打造高级哑光丝绒妆效。' },
    capture: { enabled: true, mediaKind: 'audio', submitModes: ['record', 'upload'], consentRequired: true, limits: { maxDurationSec: 180, maxBytes: 30 * 1024 * 1024, acceptedMimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav'] } },
    rubric: initialRubric,
    startAt: '2026-08-01',
    deadline: '2026-08-20',
    frequency: '周期内一次性提交',
    scope: '全国',
    creatorId: 'HT001',
    creatorName: 'Sarah Lee',
    status: '已结束',
    targetCount: 420,
    submittedCount: 403,
    consentDeniedCount: 5,
    analysisCompletedCount: 398,
    submissions: [],
  },
];

const analysisMeta: Record<MediaAnalysisStatus, { label: string; className: string }> = {
  processing: { label: '分析中', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  completed: { label: '已完成', className: 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]' },
  needs_attention: { label: '待处理', className: 'border-[#E8CCA0] bg-[#FFF7EA] text-[#8B621F]' },
  failed: { label: '分析失败', className: 'border-red-200 bg-red-50 text-red-600' },
};

const fieldClass = 'w-full rounded-lg border border-[#DED7D2] bg-white px-3 py-2 text-sm text-[#242124] outline-none transition-colors placeholder:text-[#A69EA2] focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15';

type CreateStep = 'basic' | 'target' | 'rubric';
type TargetKind = 'product' | 'scenario';

interface MediaCollectionTaskManageProps {
  userRole: Role;
  onOpenMaterialAsset?: (submissionId: string) => void;
}

interface CreateFormState {
  title: string;
  intro: string;
  audiences: string[];
  startAt: string;
  deadline: string;
  frequency: string;
  mediaKind: MediaKind;
  targetKind: TargetKind;
  productId: string;
  scenarioTitle: string;
  scenarioDescription: string;
  scenarioSuccessCriteria: string;
  maxDurationSec: number;
  maxFileMb: number;
  rubric: RubricDimension[];
}

const createInitialForm = (): CreateFormState => ({
  title: '',
  intro: '',
  audiences: [],
  startAt: '2026-09-03',
  deadline: '',
  frequency: '周期内一次性提交',
  mediaKind: 'video',
  targetKind: 'product',
  productId: PRODUCTS[0].id,
  scenarioTitle: '',
  scenarioDescription: '',
  scenarioSuccessCriteria: '',
  maxDurationSec: 300,
  maxFileMb: 300,
  rubric: initialRubric.map(item => ({ ...item })),
});

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function mediaLabel(kind?: MediaKind) {
  return kind === 'audio' ? '音频' : '视频';
}

function MediaKindIcon({ kind, className = 'h-4 w-4' }: { kind?: MediaKind; className?: string }) {
  return kind === 'audio' ? <FileAudio className={className} /> : <FileVideo className={className} />;
}

export function MediaCollectionTaskManage({ userRole, onOpenMaterialAsset }: MediaCollectionTaskManageProps) {
  const isAdmin = userRole === 'Super Admin';
  const isReadOnly = userRole === 'Regional Manager';
  const isRegional = userRole === 'Regional Training Manager' || userRole === 'Regional Trainer' || userRole === 'Regional Manager';
  const audiences = AUDIENCES_BY_ROLE[isRegional ? 'regional' : 'national'];
  const [tasks, setTasks] = useState<MediaCollectionTask[]>(initialTasks);
  React.useEffect(() => {
    // 审计接收 ADM 结果侧的独立事实：任务状态、提交可用性与 AI 分析状态分开传递。
    syncInspectionSource(
      'media',
      'media_collection_manage',
      tasks.map(toMediaInspectionTask),
    );
  }, [tasks]);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTasks[0].id);
  const [statusFilter, setStatusFilter] = useState<'全部' | '进行中' | '已结束'>('全部');
  const [search, setSearch] = useState('');
  const [submissionRegion, setSubmissionRegion] = useState('全部地区');
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>('basic');
  const [form, setForm] = useState<CreateFormState>(createInitialForm);
  const [formError, setFormError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<MediaSubmission | null>(null);
  const [deleteSubmission, setDeleteSubmission] = useState<MediaSubmission | null>(null);
  const [deactivateTask, setDeactivateTask] = useState<MediaCollectionTask | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [audienceCoverageOpen, setAudienceCoverageOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([
    { id: 'log-1', action: '查看媒体', operator: 'Admin', detail: '查看 Siti Aminah 的视频记录', time: '2026-09-03 10:02' },
    { id: 'log-2', action: '重试分析', operator: 'Sarah Lee', detail: '重新触发 ms-103 的 AI 分析', time: '2026-09-03 09:35' },
    { id: 'log-3', action: '同意记录', operator: 'BA001', detail: '同意许可文本 v1.2，任务 mct-001', time: '2026-09-03 09:38' },
  ]);

  const visibleTasks = useMemo(() => tasks.filter(task => {
    const inScope = !isRegional || task.scope === '全国' || task.region === '南区';
    const matchesStatus = statusFilter === '全部' || task.status === statusFilter;
    const matchesSearch = `${task.title} ${task.target.kind === 'product' ? task.target.productName : task.target.title}`.toLowerCase().includes(search.toLowerCase());
    return inScope && matchesStatus && matchesSearch;
  }), [isRegional, search, statusFilter, tasks]);

  const selectedTask = tasks.find(task => task.id === selectedTaskId) ?? visibleTasks[0] ?? null;
  const isInheritedNationalTask = Boolean(isRegional && selectedTask?.scope === '全国');
  const canEditSelectedTask = Boolean(selectedTask && !isAdmin && !isReadOnly && !isInheritedNationalTask && ['待开始', '进行中'].includes(selectedTask.status));
  const submissionRegions = useMemo(() => Array.from(new Set(selectedTask?.submissions.map(submission => submission.region) ?? [])), [selectedTask]);
  const visibleSubmissions = selectedTask?.submissions.filter(submission => submissionRegion === '全部地区' || submission.region === submissionRegion) ?? [];
  const coverageRegions = selectedTask?.scope === '全国' ? NATIONAL_COVERAGE_REGIONS : selectedTask?.region ? [selectedTask.region] : [];
  const totalRubricWeight = form.rubric.reduce((sum, item) => sum + Number(item.weight || 0), 0);

  const updateMediaKind = (mediaKind: MediaKind) => {
    setForm(prev => ({
      ...prev,
      mediaKind,
      maxDurationSec: mediaKind === 'video' ? 300 : 240,
      maxFileMb: mediaKind === 'video' ? 300 : 40,
    }));
  };

  const updateRubric = (id: string, patch: Partial<RubricDimension>) => {
    setForm(prev => ({ ...prev, rubric: prev.rubric.map(item => item.id === id ? { ...item, ...patch } : item) }));
  };

  const generateRubric = () => {
    const product = PRODUCTS.find(item => item.id === form.productId);
    const contentDimension = form.targetKind === 'product'
      ? { id: `r-${Date.now()}-2`, name: '产品卖点准确性', description: `准确说明「${product?.name ?? '目标产品'}」的核心卖点与适用人群。`, weight: 35, required: true }
      : { id: `r-${Date.now()}-2`, name: '场景目标完成度', description: `完成「${form.scenarioTitle || '目标场景'}」要求的关键沟通与服务动作。`, weight: 35, required: true };
    setForm(prev => ({ ...prev, rubric: [
      { id: `r-${Date.now()}-1`, name: '需求识别与引导', description: '用有效提问确认对方需求，并建立自然的沟通节奏。', weight: 25, required: true },
      contentDimension,
      { id: `r-${Date.now()}-3`, name: '异议与方案', description: '识别顾虑并提供具体、可执行的解决方案。', weight: 25, required: false },
      { id: `r-${Date.now()}-4`, name: form.mediaKind === 'video' ? '镜头表现与表达' : '语音表达状态', description: form.mediaKind === 'video' ? '发音清晰、镜头感自然，产品展示与动作得体。' : '发音清晰、语速适中、语气亲切且有信心。', weight: 15, required: false },
    ] }));
    setFormError('');
  };

  const validateStep = (step: CreateStep) => {
    if (step === 'basic') {
      if (!form.title.trim() || !form.intro.trim() || form.audiences.length === 0 || !form.startAt || !form.deadline) {
        setFormError('请完整填写任务名称、简介、分发对象和任务周期。');
        return false;
      }
      if (form.deadline < form.startAt) {
        setFormError('截止时间不能早于开始时间。');
        return false;
      }
    }
    if (step === 'target') {
      if (form.targetKind === 'scenario' && (!form.scenarioTitle.trim() || !form.scenarioDescription.trim() || !form.scenarioSuccessCriteria.trim())) {
        setFormError('请完整填写场景名称、背景和成功标准。');
        return false;
      }
      if (form.maxDurationSec <= 0 || form.maxFileMb <= 0) {
        setFormError('请填写有效的时长和文件大小限制。');
        return false;
      }
    }
    if (step === 'rubric') {
      if (form.rubric.length === 0 || form.rubric.some(item => !item.name.trim() || !item.description.trim())) {
        setFormError('请至少配置一个完整的评分维度。');
        return false;
      }
      if (totalRubricWeight !== 100) {
        setFormError(`当前权重合计 ${totalRubricWeight}%，调整为 100% 后才能发布。`);
        return false;
      }
    }
    setFormError('');
    return true;
  };

  const goNext = () => {
    if (!validateStep(createStep)) return;
    setCreateStep(createStep === 'basic' ? 'target' : 'rubric');
  };

  const publishTask = () => {
    if (!validateStep('rubric')) return;
    const product = PRODUCTS.find(item => item.id === form.productId) ?? PRODUCTS[0];
    const target: CaptureTarget = form.targetKind === 'product'
      ? { kind: 'product', productId: product.id, productVersion: product.version, productName: product.name, productDescription: product.description }
      : { kind: 'scenario', title: form.scenarioTitle.trim(), description: form.scenarioDescription.trim(), successCriteria: form.scenarioSuccessCriteria.trim() };
    const selectedAudienceLabels = audiences.filter(item => form.audiences.includes(item.id)).map(item => item.label);
    const newTask: MediaCollectionTask = {
      id: `mct-${Date.now()}`,
      title: form.title.trim(),
      intro: form.intro.trim(),
      targetAudienceIds: form.audiences,
      targetAudienceLabel: selectedAudienceLabels.join('、'),
      target,
      capture: {
        enabled: true,
        mediaKind: form.mediaKind,
        submitModes: ['record', 'upload'],
        consentRequired: true,
        limits: {
          maxDurationSec: form.maxDurationSec,
          maxBytes: form.maxFileMb * 1024 * 1024,
          acceptedMimeTypes: form.mediaKind === 'video' ? ['video/mp4', 'video/quicktime'] : ['audio/mpeg', 'audio/mp4', 'audio/wav'],
        },
      },
      rubric: form.rubric,
      startAt: form.startAt,
      deadline: form.deadline,
      frequency: form.frequency,
      scope: isRegional ? '区域' : '全国',
      region: isRegional ? '南区' : undefined,
      creatorId: isRegional ? 'RT001' : 'HT001',
      creatorName: isRegional ? 'Nurul Huda' : 'Sarah Lee',
      status: form.startAt > '2026-09-03' ? '待开始' : '进行中',
      targetCount: isRegional ? 300 : 1428,
      submittedCount: 0,
      consentDeniedCount: 0,
      analysisCompletedCount: 0,
      submissions: [],
    };
    setTasks(prev => [newTask, ...prev]);
    setSelectedTaskId(newTask.id);
    setCreateOpen(false);
    setCreateStep('basic');
    setForm(createInitialForm());
  };

  const retryAnalysis = (submission: MediaSubmission) => {
    if (!selectedTask) return;
    setTasks(prev => prev.map(task => task.id === selectedTask.id ? {
      ...task,
      submissions: task.submissions.map(item => item.id === submission.id ? { ...item, analysisStatus: 'processing' } : item),
    } : task));
    setAuditLogs(prev => [{ id: `log-${Date.now()}`, action: '重试分析', operator: isAdmin ? 'Admin' : selectedTask.creatorName, detail: `重新触发 ${submission.id} 的 AI 分析`, time: '2026-09-03 11:26' }, ...prev]);
  };

  const exportTranscripts = () => {
    if (!selectedTask || visibleSubmissions.length === 0) return;
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = visibleSubmissions.map(submission => [
      selectedTask.title,
      submission.region,
      submission.baName,
      submission.storeName,
      submission.submittedAt,
      analysisMeta[submission.analysisStatus].label,
      submission.overallScore ?? '',
      DEMO_TRANSCRIPT,
    ]);
    const csv = [['任务名称', '地区', 'BA', '门店', '提交时间', 'AI 分析状态', '综合评分', '转写文本'], ...rows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '音视频任务转写内容.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmDeleteMedia = () => {
    if (!selectedTask || !deleteSubmission || !deleteReason.trim()) return;
    setTasks(prev => prev.map(task => task.id === selectedTask.id ? {
      ...task,
      submissions: task.submissions.map(item => item.id === deleteSubmission.id ? { ...item, mediaDeleted: true } : item),
    } : task));
    setAuditLogs(prev => [{ id: `log-${Date.now()}`, action: '删除原始媒体', operator: 'Admin', detail: `${deleteSubmission.baName} / ${deleteSubmission.id}：${deleteReason.trim()}`, time: '2026-09-03 11:28' }, ...prev]);
    setDeleteSubmission(null);
    setDeleteReason('');
    setSelectedSubmission(null);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F7F3F1] pt-2">
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-[#E5DED8] bg-white">
        <div className="border-b border-[#E9E4DF] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#242124]">音视频采集任务</h2>
              <p className="mt-1 text-[11px] text-[#766F73]">{visibleTasks.length} 个任务</p>
            </div>
            {!isReadOnly && !isAdmin && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="h-8 gap-1.5 bg-rose-600 px-3 text-white hover:bg-rose-700">
                <Plus className="h-4 w-4" />
                <span>新建</span>
              </Button>
            )}
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9396]" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索任务或采集目标" className={`${fieldClass} h-9 pl-9`} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[#F3EFEC] p-1">
            {(['全部', '进行中', '已结束'] as const).map(item => (
              <button key={item} onClick={() => setStatusFilter(item)} className={`min-h-7 rounded-md px-2 text-xs font-medium transition-colors ${statusFilter === item ? 'bg-white text-[#242124] shadow-sm' : 'text-[#766F73] hover:text-[#242124]'}`}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {visibleTasks.map(task => {
            const progress = Math.round(task.submittedCount / task.targetCount * 100);
            return (
              <button key={task.id} onClick={() => { setSelectedTaskId(task.id); setSubmissionRegion('全部地区'); }} className={`w-full rounded-lg border p-4 text-left transition-colors ${selectedTask?.id === task.id ? 'border-rose-200 bg-rose-50/60' : 'border-[#E9E4DF] bg-white hover:border-rose-100 hover:bg-[#FCF9F7]'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${getTaskStatusBadgeClass(task.status)}`}>{task.status}</Badge>
                  <Badge variant="outline" className={`gap-1 text-[10px] ${task.capture.mediaKind === 'video' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-violet-200 bg-violet-50 text-violet-700'}`}>
                    <MediaKindIcon kind={task.capture.mediaKind} className="h-3 w-3" />
                    {mediaLabel(task.capture.mediaKind)}
                  </Badge>
                  {task.scope === '区域' && <span className="text-[10px] font-medium text-[#766F73]">{task.region}</span>}
                </div>
                <h3 data-i18n-skip="true" className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-[#242124]">{task.title}</h3>
                <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-[#766F73]">
                  <span className="min-w-0 truncate">{task.target.kind === 'product' ? task.target.productName : task.target.title}</span>
                  <span className={`shrink-0 font-bold ${getProgressTone(progress).textClass}`}>{progress}% 已提交</span>
                </div>
              </button>
            );
          })}
          {visibleTasks.length === 0 && <div className="px-4 py-12 text-center text-sm text-[#9A9396]">当前条件下暂无任务</div>}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-[#F8F5F3]/60">
        {selectedTask ? (
          <div className="mx-auto min-h-full max-w-6xl">
            <header className="border-b border-[#E5DED8] bg-white px-7 py-6">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={getTaskStatusBadgeClass(selectedTask.status)}>{selectedTask.status}</Badge>
                    <Badge variant="outline" className="border-[#E5DED8] bg-[#F8F5F3] text-[#5D565A]">{selectedTask.scope === '区域' ? selectedTask.region : '全国'}</Badge>
                    <Badge variant="outline" className={`gap-1 ${selectedTask.capture.mediaKind === 'video' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-violet-200 bg-violet-50 text-violet-700'}`}>
                      <MediaKindIcon kind={selectedTask.capture.mediaKind} />
                      {`${mediaLabel(selectedTask.capture.mediaKind)}采集`}
                    </Badge>
                  </div>
                  <h1 data-i18n-skip="true" className="mt-3 text-2xl font-bold leading-tight text-[#242124]">{selectedTask.title}</h1>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isAdmin && <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)} className="gap-1.5 border-[#E5DED8]"><History className="h-4 w-4" /><span>审计记录</span></Button>}
                  {canEditSelectedTask && <Button variant="outline" size="sm" onClick={() => setDeactivateTask(selectedTask)} className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"><X className="h-4 w-4" /><span>停用任务</span></Button>}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#E9E4DF] bg-[#E9E4DF] lg:grid-cols-4">
                {[
                  { label: '分发人数', value: `${selectedTask.targetCount} 人`, icon: Users },
                  { label: '已提交', value: `${selectedTask.submittedCount} 人`, icon: CheckCircle2 },
                  { label: '提交率', value: `${Math.round(selectedTask.submittedCount / selectedTask.targetCount * 100)}%`, icon: BarChart3 },
                  { label: 'AI 已分析', value: `${selectedTask.analysisCompletedCount} 份分析`, icon: Sparkles },
                ].map(metric => (
                  metric.label === '分发人数' ? (
                    <button key={metric.label} type="button" onClick={() => setAudienceCoverageOpen(true)} className="bg-white px-4 py-3.5 text-left transition-colors hover:bg-[#FCF9F7] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-rose-400">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]"><metric.icon className="h-3.5 w-3.5" />{metric.label}</div>
                      <div className="mt-1 text-lg font-bold text-[#242124]">{metric.value}</div>
                    </button>
                  ) : (
                    <div key={metric.label} className="bg-white px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]"><metric.icon className="h-3.5 w-3.5" />{metric.label}</div>
                      <div className="mt-1 text-lg font-bold text-[#242124]">{metric.value}</div>
                    </div>
                  )
                ))}
              </div>
            </header>

            <div className="space-y-5 p-7">
              <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                <div className="rounded-lg border border-[#E9E4DF] bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#242124]"><Target className="h-4 w-4 text-rose-600" />采集目标</div>
                  {selectedTask.target.kind === 'product' ? (
                    <div className="mt-4 flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><Package className="h-6 w-6" /></div>
                      <div>
                        <div data-i18n-skip="true" className="font-bold text-[#242124]">{selectedTask.target.productName}</div>
                        <div className="mt-1 text-[11px] font-medium text-[#9A9396]">产品版本 {selectedTask.target.productVersion}</div>
                        <p data-i18n-skip="true" className="mt-2 text-sm leading-relaxed text-[#5D565A]">{selectedTask.target.productDescription}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div><div className="text-[10px] font-bold text-[#9A9396]">场景名称</div><div data-i18n-skip="true" className="mt-1 font-bold text-[#242124]">{selectedTask.target.title}</div></div>
                      <div><div className="text-[10px] font-bold text-[#9A9396]">场景背景</div><p data-i18n-skip="true" className="mt-1 text-sm leading-relaxed text-[#5D565A]">{selectedTask.target.description}</p></div>
                      <div className="rounded-lg border border-[#D8DEFF] bg-[#F3F5FF] px-3 py-2.5"><div className="text-[10px] font-bold text-[#515BCB]">成功标准</div><p data-i18n-skip="true" className="mt-1 text-sm leading-relaxed text-[#3F48B4]">{selectedTask.target.successCriteria}</p></div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-[#E9E4DF] bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#242124]"><ShieldCheck className="h-4 w-4 text-[#3B8F72]" />采集要求</div>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4"><dt className="text-[#766F73]">提交方式</dt><dd className="font-medium text-[#242124]">APP 录制 / 本地上传</dd></div>
                    <div className="flex items-center justify-between gap-4"><dt className="text-[#766F73]">最长时长</dt><dd className="font-medium text-[#242124]">{`${Math.round(selectedTask.capture.limits.maxDurationSec / 60)} 分钟`}</dd></div>
                    <div className="flex items-center justify-between gap-4"><dt className="text-[#766F73]">文件上限</dt><dd className="font-medium text-[#242124]">{Math.round(selectedTask.capture.limits.maxBytes / 1024 / 1024)} MB</dd></div>
                  </dl>
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-[#E9E4DF] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E4DF] px-5 py-4">
                  <div><h2 className="text-sm font-bold text-[#242124]">最近提交</h2><p className="mt-1 text-xs text-[#766F73]">提交成功即计入完成，AI 分析状态独立更新</p></div>
                  <div className="flex flex-wrap items-center justify-end gap-2"><select aria-label="按地区筛选提交" value={submissionRegions.includes(submissionRegion) || submissionRegion === '全部地区' ? submissionRegion : '全部地区'} onChange={event => setSubmissionRegion(event.target.value)} className={`${fieldClass} h-8 w-40 py-1 text-xs`}><option>全部地区</option>{submissionRegions.map(region => <option key={region}>{region}</option>)}</select><Button variant="outline" size="sm" disabled={visibleSubmissions.length === 0} onClick={exportTranscripts} className="h-8 shrink-0 gap-1.5 border-[#E5DED8] text-xs"><Download className="h-3.5 w-3.5" />批量导出转写内容</Button></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-[#F8F5F3] text-[10px] font-bold text-[#766F73]"><tr><th className="px-5 py-3">BA / 门店</th><th className="px-4 py-3">提交信息</th><th className="px-4 py-3">AI 分析</th><th className="px-4 py-3">标签</th><th className="px-5 py-3 text-right">操作</th></tr></thead>
                    <tbody className="divide-y divide-[#EFEAE7]">
                      {visibleSubmissions.map(submission => (
                        <tr key={submission.id} className="hover:bg-[#FCFAF8]">
                          <td className="px-5 py-3"><div data-i18n-skip="true" className="font-bold text-[#242124]">{submission.baName}</div><div data-i18n-skip="true" className="mt-1 text-[10px] text-[#9A9396]">{submission.storeName}</div></td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1.5 font-medium text-[#3F3A3D]">{submission.source === 'record' ? <Mic2 className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}{submission.source === 'record' ? 'APP 录制' : '本地上传'} · {formatDuration(submission.durationSec)}</div><div className="mt-1 text-[10px] text-[#9A9396]">{submission.submittedAt}</div></td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><Badge variant="outline" className={`text-[10px] ${analysisMeta[submission.analysisStatus].className}`}>{analysisMeta[submission.analysisStatus].label}</Badge>{submission.overallScore !== undefined && <span className={`font-bold ${getScoreTone(submission.overallScore)}`}>{submission.overallScore}分</span>}</div></td>
                          <td className="max-w-[220px] px-4 py-3"><div className="flex flex-wrap gap-1">{submission.tags.slice(0, 2).map(tag => <span data-i18n-skip="true" key={tag} className="rounded bg-[#F3EFEC] px-1.5 py-1 text-[10px] text-[#5D565A]">{tag}</span>)}</div></td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              {submission.analysisStatus === 'completed' && !submission.mediaDeleted ? <Button variant="outline" size="sm" title="跳转到素材库" onClick={() => onOpenMaterialAsset?.(submission.id)} className="h-8 gap-1.5 border-[#D8DEFF] text-[#515BCB] hover:bg-[#EEF1FF]"><ExternalLink className="h-3.5 w-3.5" />跳转到素材库</Button> : null}
                              <Button variant="ghost" size="icon-sm" disabled={submission.mediaDeleted} title="查看详情" onClick={() => { setSelectedSubmission(submission); setAuditLogs(prev => [{ id: `log-${Date.now()}`, action: '查看媒体', operator: isAdmin ? 'Admin' : selectedTask.creatorName, detail: `查看 ${submission.baName} 的${mediaLabel(selectedTask.capture.mediaKind)}记录`, time: '2026-09-03 11:25' }, ...prev]); }}><Eye className="h-4 w-4" /></Button>
                              {(submission.analysisStatus === 'failed' || submission.analysisStatus === 'needs_attention') && !isReadOnly && <Button variant="ghost" size="icon-sm" title="重新处理" onClick={() => retryAnalysis(submission)}><RefreshCw className="h-4 w-4" /></Button>}
                              {isAdmin && <Button variant="ghost" size="icon-sm" disabled={submission.mediaDeleted} title="删除原始媒体" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setDeleteSubmission(submission)}><Trash2 className="h-4 w-4" /></Button>}
                            </div>
                            {submission.mediaDeleted && <span className="text-[10px] text-[#9A9396]">原始媒体已删除</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visibleSubmissions.length === 0 && <div className="px-5 py-12 text-center text-sm text-[#9A9396]">暂无可展示的提交记录</div>}
                </div>
              </section>
            </div>
          </div>
        ) : <div className="flex h-full items-center justify-center text-[#9A9396]">请选择一个采集任务</div>}
      </main>

      <Dialog open={audienceCoverageOpen} onOpenChange={setAudienceCoverageOpen}>
        <DialogContent className="max-h-[84vh] overflow-y-auto sm:max-w-3xl">
          {selectedTask && <>
            <DialogHeader className="border-b border-[#E9E4DF] pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#242124]"><Users className="h-5 w-5 text-rose-600" />分发覆盖</DialogTitle>
              <p data-i18n-skip="true" className="mt-1 text-sm text-[#766F73]">{selectedTask.title}</p>
            </DialogHeader>

            <section className="mt-5">
              <h3 className="text-sm font-bold text-[#242124]">当前圈人策略</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-4"><div className="text-[10px] font-bold text-[#8B8387]">分发对象</div><div data-i18n-skip="true" className="mt-1.5 text-sm font-bold text-[#242124]">{selectedTask.targetAudienceLabel}</div></div>
                <div className="rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-4"><div className="text-[10px] font-bold text-[#8B8387]">匹配方式</div><div className="mt-1.5 text-sm font-bold text-[#242124]">全部条件满足</div></div>
              </div>
            </section>

            <section className="mt-5">
              <h3 className="text-sm font-bold text-[#242124]">当前生效条件</h3>
              <div className="mt-3 overflow-hidden rounded-lg border border-[#E9E4DF]">
                <div className="grid grid-cols-[120px_minmax(0,1fr)] border-b border-[#E9E4DF] text-sm"><div className="bg-[#F8F5F3] px-4 py-3 font-bold text-[#766F73]">组织范围</div><div className="px-4 py-3 font-medium text-[#242124]">{selectedTask.scope === '全国' ? '全国所有门店' : `${selectedTask.region}所有门店`}</div></div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] border-b border-[#E9E4DF] text-sm"><div className="bg-[#F8F5F3] px-4 py-3 font-bold text-[#766F73]">人员角色</div><div className="px-4 py-3 font-medium text-[#242124]">门店 BA</div></div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] text-sm"><div className="bg-[#F8F5F3] px-4 py-3 font-bold text-[#766F73]">人群条件</div><div data-i18n-skip="true" className="px-4 py-3 font-medium text-[#242124]">{selectedTask.targetAudienceLabel}</div></div>
              </div>
            </section>

            <section className="mt-5 rounded-lg border border-rose-100 bg-rose-50/50 p-5">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-xs font-bold text-rose-700">圈人结果</div><div className="mt-1 text-sm text-[#5D565A]">当前策略命中且将接收本任务的人群</div></div><div className="text-right"><div className="text-3xl font-bold text-rose-600">{selectedTask.targetCount.toLocaleString()} 人</div><div className="mt-1 text-xs text-[#766F73]">预计分发人数</div></div></div>
              <div className="mt-4 border-t border-rose-100 pt-4"><div className="text-[10px] font-bold text-[#9A9396]">覆盖区域</div><div className="mt-2 flex flex-wrap gap-1.5">{coverageRegions.map(region => <span key={region} className="rounded-md border border-rose-100 bg-white px-2 py-1 text-[11px] font-medium text-[#5D565A]">{region}</span>)}</div><div className="mt-4 flex items-center gap-1 text-sm font-bold text-[#3B8F72]"><CheckCircle2 className="h-3.5 w-3.5" />策略已生效</div></div>
            </section>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) { setCreateStep('basic'); setFormError(''); } }}>
        <DialogContent className="flex h-[88vh] max-h-[860px] flex-col p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-[#E9E4DF] px-6 py-5">
            <DialogTitle className="text-lg font-bold text-[#242124]">新建音视频采集任务</DialogTitle>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                { id: 'basic', label: '1. 任务信息' },
                { id: 'target', label: '2. 采集要求' },
                { id: 'rubric', label: '3. AI 评分' },
              ] as Array<{ id: CreateStep; label: string }>).map((item, index) => {
                const stepIndex = ['basic', 'target', 'rubric'].indexOf(createStep);
                return <div key={item.id} className={`rounded-lg border px-3 py-2 text-center text-xs font-bold ${createStep === item.id ? 'border-rose-200 bg-rose-50 text-rose-700' : index < stepIndex ? 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]' : 'border-[#E9E4DF] bg-[#F8F5F3] text-[#9A9396]'}`}>{index < stepIndex ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}{item.label}</div>;
              })}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#FCFAF8] px-6 py-5">
            {formError && <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{formError}</span></div>}

            {createStep === 'basic' && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">任务名称 <span className="text-rose-600">*</span></label><input value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="例如：新品面霜门店推荐视频征集" className={fieldClass} /></div>
                  <div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">任务简介 <span className="text-rose-600">*</span></label><textarea value={form.intro} onChange={event => setForm(prev => ({ ...prev, intro: event.target.value }))} rows={5} placeholder="说明采集目的、BA 需要完成的内容和拍摄环境要求。" className={`${fieldClass} resize-none leading-relaxed`} /></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">开始时间 <span className="text-rose-600">*</span></label><input type="date" value={form.startAt} onChange={event => setForm(prev => ({ ...prev, startAt: event.target.value }))} className={fieldClass} /></div><div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">截止时间 <span className="text-rose-600">*</span></label><input type="date" value={form.deadline} onChange={event => setForm(prev => ({ ...prev, deadline: event.target.value }))} className={fieldClass} /></div></div>
                  <div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">提交频次</label><select value={form.frequency} onChange={event => setForm(prev => ({ ...prev, frequency: event.target.value }))} className={fieldClass}><option>周期内一次性提交</option><option>每日提交 1 次</option><option>每周提交 1 次</option><option>每周提交 3 次</option></select></div>
                </div>
                <div><label className="mb-2 block text-xs font-bold text-[#3F3A3D]">分发对象 <span className="text-rose-600">*</span></label><div className="space-y-2 rounded-lg border border-[#E5DED8] bg-white p-3">{audiences.map(item => <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${form.audiences.includes(item.id) ? 'border-rose-200 bg-rose-50/60' : 'border-[#EFEAE7] hover:border-[#DED7D2]'}`}><input type="checkbox" checked={form.audiences.includes(item.id)} onChange={event => setForm(prev => ({ ...prev, audiences: event.target.checked ? [...prev.audiences, item.id] : prev.audiences.filter(id => id !== item.id) }))} className="mt-0.5 h-4 w-4 rounded border-[#CFC6C1] text-rose-600 focus:ring-rose-500" /><span className="text-sm leading-snug text-[#3F3A3D]">{item.label}</span></label>)}</div><div className="mt-3 rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] px-3 py-2 text-xs leading-relaxed text-[#766F73]">任务会按创建者组织范围分发：{isRegional ? '仅限南区' : '全国范围'}。</div></div>
              </div>
            )}

            {createStep === 'target' && (
              <div className="space-y-6">
                <section className="rounded-lg border border-[#E9E4DF] bg-white p-5">
                  <label className="mb-3 block text-xs font-bold text-[#3F3A3D]">采集类型</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([{ id: 'video', label: '视频采集', description: '评估 BA 的话术、动作和镜头表现', icon: Video }, { id: 'audio', label: '音频采集', description: '评估 BA 的话术、语音和沟通节奏', icon: Mic2 }] as const).map(item => <button key={item.id} onClick={() => updateMediaKind(item.id)} className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${form.mediaKind === item.id ? 'border-rose-300 bg-rose-50' : 'border-[#E9E4DF] hover:border-[#DED7D2]'}`}><div className={`rounded-lg p-2 ${form.mediaKind === item.id ? 'bg-white text-rose-600' : 'bg-[#F8F5F3] text-[#766F73]'}`}><item.icon className="h-5 w-5" /></div><div><div className="font-bold text-[#242124]">{item.label}</div><div className="mt-1 text-xs leading-relaxed text-[#766F73]">{item.description}</div></div></button>)}
                  </div>
                </section>

                <section className="rounded-lg border border-[#E9E4DF] bg-white p-5">
                  <label className="mb-3 block text-xs font-bold text-[#3F3A3D]">采集目标</label>
                  <div className="inline-flex rounded-lg bg-[#F3EFEC] p-1">{([{ id: 'product', label: '指定产品', icon: Package }, { id: 'scenario', label: '自定义场景', icon: Target }] as const).map(item => <button key={item.id} onClick={() => setForm(prev => ({ ...prev, targetKind: item.id }))} className={`flex min-h-8 items-center gap-1.5 rounded-md px-4 text-xs font-bold ${form.targetKind === item.id ? 'bg-white text-[#242124] shadow-sm' : 'text-[#766F73]'}`}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}</div>
                  {form.targetKind === 'product' ? <div className="mt-4 grid grid-cols-2 gap-3">{PRODUCTS.map(product => <button key={product.id} onClick={() => setForm(prev => ({ ...prev, productId: product.id }))} className={`flex items-start gap-3 rounded-lg border p-3 text-left ${form.productId === product.id ? 'border-rose-300 bg-rose-50/60' : 'border-[#E9E4DF] hover:border-[#DED7D2]'}`}><div className="rounded-lg bg-white p-2 text-rose-600"><Package className="h-4 w-4" /></div><div><div data-i18n-skip="true" className="text-sm font-bold text-[#242124]">{product.name}</div><div className="mt-1 text-[10px] text-[#9A9396]">版本 {product.version}</div><p data-i18n-skip="true" className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#766F73]">{product.description}</p></div></button>)}</div> : <div className="mt-4 grid gap-4 lg:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">场景名称</label><input value={form.scenarioTitle} onChange={event => setForm(prev => ({ ...prev, scenarioTitle: event.target.value }))} placeholder="例如：热门商品缺货客诉" className={fieldClass} /></div><div className="lg:row-span-2"><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">场景背景</label><textarea value={form.scenarioDescription} onChange={event => setForm(prev => ({ ...prev, scenarioDescription: event.target.value }))} rows={5} placeholder="说明环境、参与者状态和当前冲突。" className={`${fieldClass} resize-none`} /></div><div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">成功标准</label><textarea value={form.scenarioSuccessCriteria} onChange={event => setForm(prev => ({ ...prev, scenarioSuccessCriteria: event.target.value }))} rows={3} placeholder="说明 BA 必须完成的关键动作。" className={`${fieldClass} resize-none`} /></div></div>}
                </section>

                <section className="grid gap-4 rounded-lg border border-[#E9E4DF] bg-white p-5 md:grid-cols-2">
                  <div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">最长时长（秒）</label><input type="number" min={30} value={form.maxDurationSec} onChange={event => setForm(prev => ({ ...prev, maxDurationSec: Number(event.target.value) }))} className={fieldClass} /></div>
                  <div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">文件上限（MB）</label><input type="number" min={1} value={form.maxFileMb} onChange={event => setForm(prev => ({ ...prev, maxFileMb: Number(event.target.value) }))} className={fieldClass} /></div>
                  <div className="md:col-span-2"><div className="flex items-start gap-3 rounded-lg border border-[#D8DEFF] bg-[#F3F5FF] p-3"><Upload className="mt-0.5 h-4 w-4 shrink-0 text-[#515BCB]" /><div><div className="text-xs font-bold text-[#3F48B4]">APP 录制与本地上传</div><p className="mt-1 text-xs leading-relaxed text-[#5962B9]">两种方式均可提交，提交成功后异步进行 AI 分析。</p></div></div></div>
                </section>
              </div>
            )}

            {createStep === 'rubric' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D8DEFF] bg-[#F3F5FF] px-4 py-3"><div><div className="flex items-center gap-2 text-sm font-bold text-[#3F48B4]"><Sparkles className="h-4 w-4" />AI 评价标准</div><p className="mt-1 text-xs text-[#5962B9]">根据当前产品/场景生成默认维度，可继续修改。该标准用于AI对上传音视频进行预评价标注，最终视频质量以人工核查为准。</p></div><Button variant="outline" size="sm" onClick={generateRubric} className="gap-1.5 border-[#D8DEFF] bg-white text-[#515BCB] hover:bg-[#E8EBFF]"><WandSparkles className="h-4 w-4" />重新生成</Button></div>
                <div className="flex items-center justify-between"><div className="text-xs font-bold text-[#3F3A3D]">评分维度</div><div className={`text-sm font-bold ${totalRubricWeight === 100 ? 'text-[#3B8F72]' : 'text-rose-600'}`}>权重合计 {totalRubricWeight}%</div></div>
                {form.rubric.map((item, index) => <div key={item.id} className="grid gap-3 rounded-lg border border-[#E9E4DF] bg-white p-4 lg:grid-cols-[28px_minmax(140px,0.7fr)_minmax(240px,1.5fr)_110px_110px_32px]"><div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F3EFEC] text-xs font-bold text-[#766F73]">{index + 1}</div><input value={item.name} onChange={event => updateRubric(item.id, { name: event.target.value })} aria-label="维度名称" className={`${fieldClass} h-9`} /><input value={item.description} onChange={event => updateRubric(item.id, { description: event.target.value })} aria-label="维度说明" className={`${fieldClass} h-9`} /><div className="relative"><input type="number" min={0} max={100} value={item.weight} onChange={event => updateRubric(item.id, { weight: Number(event.target.value) })} aria-label="权重" className={`${fieldClass} h-9 pr-7`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9A9396]">%</span></div><label className="flex h-9 items-center gap-2 rounded-lg border border-[#E9E4DF] px-3 text-xs font-medium text-[#5D565A]"><input type="checkbox" checked={item.required} onChange={event => updateRubric(item.id, { required: event.target.checked })} className="h-4 w-4 rounded border-[#CFC6C1] text-rose-600" />必达项</label><Button variant="ghost" size="icon-sm" title="删除评分维度" disabled={form.rubric.length === 1} onClick={() => setForm(prev => ({ ...prev, rubric: prev.rubric.filter(rubric => rubric.id !== item.id) }))} className="text-[#9A9396] hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button></div>)}
                <button onClick={() => setForm(prev => ({ ...prev, rubric: [...prev.rubric, { id: `r-${Date.now()}`, name: '', description: '', weight: 0, required: false }] }))} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#CFC6C1] bg-white py-3 text-xs font-bold text-[#766F73] hover:border-rose-300 hover:text-rose-600"><Plus className="h-4 w-4" />新增评分维度</button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#E9E4DF] bg-white px-6 py-4">
            <Button variant="outline" onClick={() => createStep === 'basic' ? setCreateOpen(false) : setCreateStep(createStep === 'rubric' ? 'target' : 'basic')} className="gap-1.5 border-[#E5DED8]">{createStep !== 'basic' && <ChevronLeft className="h-4 w-4" />}{createStep === 'basic' ? '取消' : '上一步'}</Button>
            {createStep === 'rubric' ? <Button onClick={publishTask} className="gap-1.5 bg-rose-600 text-white hover:bg-rose-700"><CheckCircle2 className="h-4 w-4" />确认发布任务</Button> : <Button onClick={goNext} className="gap-1.5 bg-rose-600 text-white hover:bg-rose-700">下一步<ChevronRight className="h-4 w-4" /></Button>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSubmission} onOpenChange={open => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader className="border-b border-[#E9E4DF] pb-4"><DialogTitle className="text-lg font-bold text-[#242124]">媒体记录与 AI 分析</DialogTitle></DialogHeader>
          {selectedSubmission && selectedTask && <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(310px,0.9fr)]">
            <div>
              <div className={`flex aspect-video items-center justify-center rounded-lg ${selectedTask.capture.mediaKind === 'video' ? 'bg-[#242124]' : 'border border-[#D8DEFF] bg-[#F3F5FF]'}`}>
                <div className={`flex h-14 w-14 items-center justify-center rounded-full ${selectedTask.capture.mediaKind === 'video' ? 'bg-white/15 text-white' : 'bg-white text-[#515BCB] shadow-sm'}`}><Play className="ml-1 h-6 w-6" /></div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-[#766F73]"><span>{selectedSubmission.baName} · {mediaLabel(selectedTask.capture.mediaKind)}</span><span>{formatDuration(selectedSubmission.durationSec)}</span></div>
              <div className="mt-4 rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-4"><div className="text-xs font-bold text-[#3F3A3D]">转写文本</div><p data-i18n-skip="true" className="mt-2 text-sm leading-7 text-[#5D565A]">{DEMO_TRANSCRIPT}</p></div>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-[#E9E4DF] bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-[#766F73]">综合评分</span>{selectedSubmission.overallScore !== undefined ? <span className={`text-3xl font-bold ${getScoreTone(selectedSubmission.overallScore)}`}>{selectedSubmission.overallScore}</span> : <Badge variant="outline" className={analysisMeta[selectedSubmission.analysisStatus].className}>{analysisMeta[selectedSubmission.analysisStatus].label}</Badge>}</div>{selectedSubmission.overallScore !== undefined && <Progress value={selectedSubmission.overallScore} className="mt-3 h-1.5 bg-[#F1ECE8]" indicatorClassName={getProgressTone(selectedSubmission.overallScore).indicatorClass} />}</div>
              <div className="rounded-lg border border-[#E9E4DF] bg-white p-4"><div className="text-xs font-bold text-[#3F3A3D]">维度评分</div><div className="mt-3 space-y-3">{selectedTask.rubric.map((item, index) => { const score = Math.max(68, (selectedSubmission.overallScore ?? 82) - index * 3 + 4); return <div key={item.id}><div className="flex justify-between text-xs"><span data-i18n-skip="true" className="text-[#5D565A]">{item.name}</span><span className={`font-bold ${getScoreTone(score)}`}>{score}</span></div><Progress value={score} className="mt-1.5 h-1 bg-[#F1ECE8]" indicatorClassName={getProgressTone(score).indicatorClass} /></div>; })}</div></div>
              <div className="rounded-lg border border-[#D8DEFF] bg-[#F3F5FF] p-4"><div className="flex items-center gap-1.5 text-xs font-bold text-[#3F48B4]"><Sparkles className="h-4 w-4" />AI 点评</div><p data-i18n-skip="true" className="mt-2 text-xs leading-relaxed text-[#5962B9]">需求确认自然完整，能够围绕顾客肤质和使用场景展开沟通；产品核心成分与修护卖点表达准确，话术节奏清晰，整体服务状态亲和专业。</p></div>
              <div className="flex flex-wrap gap-1.5">{selectedSubmission.tags.map(tag => <Badge data-i18n-skip="true" key={tag} variant="outline" className="border-[#E5DED8] bg-[#F8F5F3] text-[#5D565A]">{tag}</Badge>)}</div>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteSubmission} onOpenChange={open => !open && setDeleteSubmission(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />删除原始媒体</DialogTitle></DialogHeader>
          <p className="text-sm leading-relaxed text-[#5D565A]">删除后无法播放或重新分析，已生成的 AI 结果和审计记录将保留。</p>
          <div><label className="mb-1.5 block text-xs font-bold text-[#3F3A3D]">删除原因 <span className="text-rose-600">*</span></label><textarea value={deleteReason} onChange={event => setDeleteReason(event.target.value)} rows={3} placeholder="填写数据更正、本人删除请求等原因" className={`${fieldClass} resize-none`} /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteSubmission(null)}>取消</Button><Button disabled={!deleteReason.trim()} onClick={confirmDeleteMedia} className="bg-red-600 text-white hover:bg-red-700">确认删除</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTask} onOpenChange={open => !open && setDeactivateTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="h-5 w-5" />停用采集任务</DialogTitle></DialogHeader>
          <p className="text-sm leading-relaxed text-[#5D565A]">停用后 BA 将不能继续提交，已提交的原始媒体、AI 分析和审计记录将保留。
          </p>
          {deactivateTask && <div data-i18n-skip="true" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{deactivateTask.title}</div>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeactivateTask(null)}>取消</Button><Button onClick={() => { setTasks(prev => prev.map(task => task.id === deactivateTask?.id ? { ...task, status: '已停用' } : task)); setDeactivateTask(null); }} className="bg-red-600 text-white hover:bg-red-700">确认停用</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-[#242124]"><History className="h-5 w-5 text-[#515BCB]" />媒体审计记录</DialogTitle></DialogHeader>
          <div className="divide-y divide-[#EFEAE7] rounded-lg border border-[#E9E4DF]">{auditLogs.map(log => <div key={log.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[110px_minmax(0,1fr)_130px]"><div className="text-xs font-bold text-[#3F3A3D]">{log.action}</div><div><div data-i18n-skip="true" className="text-xs leading-relaxed text-[#5D565A]">{log.detail}</div><div data-i18n-skip="true" className="mt-1 text-[10px] text-[#9A9396]">操作人：{log.operator}</div></div><div className="text-right text-[10px] text-[#9A9396]">{log.time}</div></div>)}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
