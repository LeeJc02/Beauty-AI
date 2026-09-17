<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBeautyI18n } from '@/beauty/composables'
import { syncInspectionSource, toMediaInspectionTask } from '@/beauty/lib/inspectionStore'
import { getProgressTone, getScoreTone, getTaskStatusBadgeClass } from '@/beauty/lib/visualTones'
import type {
  CaptureTarget,
  MediaAnalysisStatus,
  MediaCollectionTask,
  MediaKind,
  MediaSubmission,
  RubricDimension
} from '@/beauty/types'
import BeautyBadge from '../components/BeautyBadge.vue'
import BeautyProgress from '../components/BeautyProgress.vue'
import { useTaskRole } from '../useTaskRole'

/**
 * 音视频采集任务：原型 `pages/MediaCollectionTaskManage.tsx`。
 *
 * 原型由 `App.tsx` 传入 `userRole` 与 `onOpenMaterialAsset(submissionId)`：
 * - `userRole` 改为 `useTaskRole()` 反查；
 * - `onOpenMaterialAsset` 对应「跳到素材库并高亮该素材」，落到
 *   `router.push({ path: '/material-library', query: { submissionId } })`（素材库页由另一交付单元移植）。
 *
 * 超管「媒体与审计」入口（`src/views/beauty/media-collection/index.vue`）直接复用本组件。
 */
defineOptions({ name: 'BeautyTasksMediaCollection' })

const PRODUCTS = [
  { id: 'p1', name: 'BS B5高保湿面霜', version: '2026.05', description: '主打高浓度维他命B5与神经酰胺，适合干敏皮换季修护。' },
  { id: 'p2', name: 'BS 急救舒缓精华', version: '2026.03', description: '高频次安抚敏感泛红，质地轻薄。' },
  { id: 'p3', name: '极光焕白精华液', version: '2026.02', description: '阻断黑色素沉积，温和提亮肤色。' },
  { id: 'p4', name: '丝绒持妆粉底液', version: '2026.04', description: '24小时长效贴合，打造高级哑光丝绒妆效。' }
]

const NATIONAL_COVERAGE_REGIONS = [
  '雅加达区', '泗水区', '巴厘岛区', '万隆区', '棉兰区', '望加锡区', '日惹区',
  '三宝垄区', '万丹区', '万鸦老区', '北干巴鲁区', '巨港区', '巴东区', '坤甸区',
  '班贾尔马辛区', '巴厘巴板区', '茂物区', '勿加泗区', '德博区', '唐格朗区', '玛琅区',
  '占碑区', '亚齐区', '楠榜区', '芝勒邦区', '卡拉旺区', '任抹区', '巴布亚区'
]

const DEMO_TRANSCRIPT =
  '顾客您好，我先了解一下您最近的肤质状态。如果主要是换季紧绷和泛红，这款 B5 面霜的神经酰胺能帮助修护屏障，质地也不是厚重浮在表面的感觉……'

const AUDIENCES_BY_ROLE: Record<'national' | 'regional', Array<{ id: string; label: string }>> = {
  national: [
    { id: 'all-ba', label: '全国所有门店 BA' },
    { id: 'new-ba', label: '入职不满3个月的新人' },
    { id: 'east-ba', label: '华东区直营门店 BA' },
    { id: 'low-score-ba', label: '近30天练习达标率低于60%的 BA' }
  ],
  regional: [
    { id: 'region-all-ba', label: '本区域所有门店 BA' },
    { id: 'region-new-ba', label: '本区域新入职 BA' },
    { id: 'region-low-score-ba', label: '本区域近30天练习达标率低于60%的 BA' }
  ]
}

const initialRubric: RubricDimension[] = [
  { id: 'r1', name: '需求挖掘', description: '能否通过提问确认顾客肤质、痛点和使用场景。', weight: 25, required: true },
  { id: 'r2', name: '产品表达', description: '准确表达核心卖点，并把成分与顾客需求建立关联。', weight: 35, required: true },
  { id: 'r3', name: '异议处理', description: '回应价格、肤感或效果顾虑，给出可执行的解决方案。', weight: 25, required: false },
  { id: 'r4', name: '表达状态', description: '语速、清晰度、镜头感和服务态度自然得体。', weight: 15, required: false }
]

const initialTasks: MediaCollectionTask[] = [
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
      { id: 'ms-103', baId: 'BA003', baName: 'Ayu Lestari', region: '泗水区', storeName: 'Surabaya Tunjungan Plaza', submittedAt: '2026-09-02 17:30', durationSec: 175, source: 'record', consentStatus: 'granted', analysisStatus: 'needs_attention', overallScore: 72, tags: ['转写不完整', '需人工处理'] }
    ]
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
      { id: 'r4', name: '语音状态', description: '语气稳定、表达清晰且节奏自然。', weight: 15, required: false }
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
      { id: 'ms-202', baId: 'BA024', baName: 'Putri Maharani', region: '泗水区', storeName: 'Surabaya Tunjungan Plaza', submittedAt: '2026-09-03 09:08', durationSec: 132, source: 'upload', consentStatus: 'granted', analysisStatus: 'failed', tags: ['音质异常'] }
    ]
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
    submissions: []
  }
]

const analysisMeta: Record<MediaAnalysisStatus, { label: string; className: string }> = {
  processing: { label: '分析中', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  completed: { label: '已完成', className: 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]' },
  needs_attention: { label: '待处理', className: 'border-[#E8CCA0] bg-[#FFF7EA] text-[#8B621F]' },
  failed: { label: '分析失败', className: 'border-red-200 bg-red-50 text-red-600' }
}

const fieldClass =
  'w-full rounded-lg border border-solid border-[#DED7D2] bg-white px-3 py-2 text-sm text-[#242124] outline-none transition-colors placeholder:text-[#A69EA2] focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'

type CreateStep = 'basic' | 'target' | 'rubric'
type TargetKind = 'product' | 'scenario'

interface CreateFormState {
  title: string
  intro: string
  audiences: string[]
  startAt: string
  deadline: string
  frequency: string
  mediaKind: MediaKind
  targetKind: TargetKind
  productId: string
  scenarioTitle: string
  scenarioDescription: string
  scenarioSuccessCriteria: string
  maxDurationSec: number
  maxFileMb: number
  rubric: RubricDimension[]
}

interface AuditLog {
  id: string
  action: string
  operator: string
  detail: string
  time: string
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
  rubric: initialRubric.map((item) => ({ ...item }))
})

const { t } = useBeautyI18n()
const router = useRouter()

const userRole = useTaskRole()
const isAdmin = computed(() => userRole.value === 'Super Admin')
const isReadOnly = computed(() => userRole.value === 'Regional Manager')
const isRegional = computed(
  () =>
    userRole.value === 'Regional Training Manager' ||
    userRole.value === 'Regional Trainer' ||
    userRole.value === 'Regional Manager'
)
const audiences = computed(() => AUDIENCES_BY_ROLE[isRegional.value ? 'regional' : 'national'])

const tasks = ref<MediaCollectionTask[]>(initialTasks)
const selectedTaskId = ref(initialTasks[0].id)
const statusFilter = ref<'全部' | '进行中' | '已结束'>('全部')
const search = ref('')
const submissionRegion = ref('全部地区')
const createOpen = ref(false)
const createStep = ref<CreateStep>('basic')
const form = ref<CreateFormState>(createInitialForm())
const formError = ref('')
const selectedSubmission = ref<MediaSubmission | null>(null)
const deleteSubmission = ref<MediaSubmission | null>(null)
const deactivateTask = ref<MediaCollectionTask | null>(null)
const deleteReason = ref('')
const audienceCoverageOpen = ref(false)
const auditOpen = ref(false)
const auditLogs = ref<AuditLog[]>([
  { id: 'log-1', action: '查看媒体', operator: 'Admin', detail: '查看 Siti Aminah 的视频记录', time: '2026-09-03 10:02' },
  { id: 'log-2', action: '重试分析', operator: 'Sarah Lee', detail: '重新触发 ms-103 的 AI 分析', time: '2026-09-03 09:35' },
  { id: 'log-3', action: '同意记录', operator: 'BA001', detail: '同意许可文本 v1.2，任务 mct-001', time: '2026-09-03 09:38' }
])

const submissionOpen = computed({
  get: () => Boolean(selectedSubmission.value),
  set: (value: boolean) => {
    if (!value) selectedSubmission.value = null
  }
})
const deleteOpen = computed({
  get: () => Boolean(deleteSubmission.value),
  set: (value: boolean) => {
    if (!value) deleteSubmission.value = null
  }
})
const deactivateOpen = computed({
  get: () => Boolean(deactivateTask.value),
  set: (value: boolean) => {
    if (!value) deactivateTask.value = null
  }
})

// 与原型一致：任务列表变化即同步到培训审计数据源（幂等）。
watch(
  tasks,
  (value) => {
    syncInspectionSource('media', 'media_collection_manage', value.map(toMediaInspectionTask))
  },
  { immediate: true, deep: true }
)

const visibleTasks = computed(() =>
  tasks.value.filter((task) => {
    const inScope = !isRegional.value || task.scope === '全国' || task.region === '南区'
    const matchesStatus = statusFilter.value === '全部' || task.status === statusFilter.value
    const keyword = search.value.toLowerCase()
    const matchesSearch = `${task.title} ${task.target.kind === 'product' ? task.target.productName : task.target.title}`
      .toLowerCase()
      .includes(keyword)
    return inScope && matchesStatus && matchesSearch
  })
)

const selectedTask = computed(
  () => tasks.value.find((task) => task.id === selectedTaskId.value) ?? visibleTasks.value[0] ?? null
)
const isInheritedNationalTask = computed(
  () => isRegional.value && selectedTask.value?.scope === '全国'
)
const canEditSelectedTask = computed(
  () =>
    Boolean(selectedTask.value) &&
    !isAdmin.value &&
    !isReadOnly.value &&
    !isInheritedNationalTask.value &&
    ['待开始', '进行中'].includes(selectedTask.value?.status ?? '')
)
const submissionRegions = computed(() =>
  Array.from(new Set(selectedTask.value?.submissions.map((submission) => submission.region) ?? []))
)
const visibleSubmissions = computed(
  () =>
    selectedTask.value?.submissions.filter(
      (submission) => submissionRegion.value === '全部地区' || submission.region === submissionRegion.value
    ) ?? []
)
const coverageRegions = computed(() =>
  selectedTask.value?.scope === '全国'
    ? NATIONAL_COVERAGE_REGIONS
    : selectedTask.value?.region
      ? [selectedTask.value.region]
      : []
)
const totalRubricWeight = computed(() =>
  form.value.rubric.reduce((sum, item) => sum + Number(item.weight || 0), 0)
)
const publishTimePreview = '2026-09-03'

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
const mediaLabel = (kind?: MediaKind) => (kind === 'audio' ? '音频' : '视频')
const mediaIcon = (kind?: MediaKind) => (kind === 'audio' ? 'lucide:file-audio' : 'lucide:file-video')

const openMaterialAsset = (submissionId: string) => {
  router.push({ path: '/material-library', query: { submissionId } })
}

const updateMediaKind = (mediaKind: MediaKind) => {
  form.value = {
    ...form.value,
    mediaKind,
    maxDurationSec: mediaKind === 'video' ? 300 : 240,
    maxFileMb: mediaKind === 'video' ? 300 : 40
  }
}

const updateRubric = (id: string, patch: Partial<RubricDimension>) => {
  form.value = {
    ...form.value,
    rubric: form.value.rubric.map((item) => (item.id === id ? { ...item, ...patch } : item))
  }
}

const generateRubric = () => {
  const product = PRODUCTS.find((item) => item.id === form.value.productId)
  const contentDimension =
    form.value.targetKind === 'product'
      ? {
          id: `r-${Date.now()}-2`,
          name: '产品卖点准确性',
          description: `准确说明「${product?.name ?? '目标产品'}」的核心卖点与适用人群。`,
          weight: 35,
          required: true
        }
      : {
          id: `r-${Date.now()}-2`,
          name: '场景目标完成度',
          description: `完成「${form.value.scenarioTitle || '目标场景'}」要求的关键沟通与服务动作。`,
          weight: 35,
          required: true
        }
  form.value = {
    ...form.value,
    rubric: [
      { id: `r-${Date.now()}-1`, name: '需求识别与引导', description: '用有效提问确认对方需求，并建立自然的沟通节奏。', weight: 25, required: true },
      contentDimension,
      { id: `r-${Date.now()}-3`, name: '异议与方案', description: '识别顾虑并提供具体、可执行的解决方案。', weight: 25, required: false },
      {
        id: `r-${Date.now()}-4`,
        name: form.value.mediaKind === 'video' ? '镜头表现与表达' : '语音表达状态',
        description:
          form.value.mediaKind === 'video'
            ? '发音清晰、镜头感自然，产品展示与动作得体。'
            : '发音清晰、语速适中、语气亲切且有信心。',
        weight: 15,
        required: false
      }
    ]
  }
  formError.value = ''
}

const validateStep = (step: CreateStep) => {
  const current = form.value
  if (step === 'basic') {
    if (!current.title.trim() || !current.intro.trim() || current.audiences.length === 0 || !current.startAt || !current.deadline) {
      formError.value = '请完整填写任务名称、简介、分发对象和任务周期。'
      return false
    }
    if (current.deadline < current.startAt) {
      formError.value = '截止时间不能早于开始时间。'
      return false
    }
  }
  if (step === 'target') {
    if (current.targetKind === 'scenario' && (!current.scenarioTitle.trim() || !current.scenarioDescription.trim() || !current.scenarioSuccessCriteria.trim())) {
      formError.value = '请完整填写场景名称、背景和成功标准。'
      return false
    }
    if (current.maxDurationSec <= 0 || current.maxFileMb <= 0) {
      formError.value = '请填写有效的时长和文件大小限制。'
      return false
    }
  }
  if (step === 'rubric') {
    if (current.rubric.length === 0 || current.rubric.some((item) => !item.name.trim() || !item.description.trim())) {
      formError.value = '请至少配置一个完整的评分维度。'
      return false
    }
    if (totalRubricWeight.value !== 100) {
      formError.value = `当前权重合计 ${totalRubricWeight.value}%，调整为 100% 后才能发布。`
      return false
    }
  }
  formError.value = ''
  return true
}

const goNext = () => {
  if (!validateStep(createStep.value)) return
  createStep.value = createStep.value === 'basic' ? 'target' : 'rubric'
}

const goPrevious = () => {
  if (createStep.value === 'basic') {
    createOpen.value = false
    return
  }
  createStep.value = createStep.value === 'rubric' ? 'target' : 'basic'
}

const publishTask = () => {
  if (!validateStep('rubric')) return
  const current = form.value
  const product = PRODUCTS.find((item) => item.id === current.productId) ?? PRODUCTS[0]
  const target: CaptureTarget =
    current.targetKind === 'product'
      ? { kind: 'product', productId: product.id, productVersion: product.version, productName: product.name, productDescription: product.description }
      : { kind: 'scenario', title: current.scenarioTitle.trim(), description: current.scenarioDescription.trim(), successCriteria: current.scenarioSuccessCriteria.trim() }
  const selectedAudienceLabels = audiences.value
    .filter((item) => current.audiences.includes(item.id))
    .map((item) => item.label)
  const newTask: MediaCollectionTask = {
    id: `mct-${Date.now()}`,
    title: current.title.trim(),
    intro: current.intro.trim(),
    targetAudienceIds: current.audiences,
    targetAudienceLabel: selectedAudienceLabels.join('、'),
    target,
    capture: {
      enabled: true,
      mediaKind: current.mediaKind,
      submitModes: ['record', 'upload'],
      consentRequired: true,
      limits: {
        maxDurationSec: current.maxDurationSec,
        maxBytes: current.maxFileMb * 1024 * 1024,
        acceptedMimeTypes:
          current.mediaKind === 'video'
            ? ['video/mp4', 'video/quicktime']
            : ['audio/mpeg', 'audio/mp4', 'audio/wav']
      }
    },
    rubric: current.rubric,
    startAt: current.startAt,
    deadline: current.deadline,
    frequency: current.frequency,
    scope: isRegional.value ? '区域' : '全国',
    region: isRegional.value ? '南区' : undefined,
    creatorId: isRegional.value ? 'RT001' : 'HT001',
    creatorName: isRegional.value ? 'Nurul Huda' : 'Sarah Lee',
    status: current.startAt > publishTimePreview ? '待开始' : '进行中',
    targetCount: isRegional.value ? 300 : 1428,
    submittedCount: 0,
    consentDeniedCount: 0,
    analysisCompletedCount: 0,
    submissions: []
  }
  tasks.value = [newTask, ...tasks.value]
  selectedTaskId.value = newTask.id
  createOpen.value = false
  createStep.value = 'basic'
  form.value = createInitialForm()
}

const retryAnalysis = (submission: MediaSubmission) => {
  const task = selectedTask.value
  if (!task) return
  tasks.value = tasks.value.map((item) =>
    item.id === task.id
      ? {
          ...item,
          submissions: item.submissions.map((entry) =>
            entry.id === submission.id ? { ...entry, analysisStatus: 'processing' } : entry
          )
        }
      : item
  )
  auditLogs.value = [
    { id: `log-${Date.now()}`, action: '重试分析', operator: isAdmin.value ? 'Admin' : task.creatorName, detail: `重新触发 ${submission.id} 的 AI 分析`, time: '2026-09-03 11:26' },
    ...auditLogs.value
  ]
}

const exportTranscripts = () => {
  const task = selectedTask.value
  if (!task || visibleSubmissions.value.length === 0) return
  const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const rows = visibleSubmissions.value.map((submission) => [
    task.title,
    submission.region,
    submission.baName,
    submission.storeName,
    submission.submittedAt,
    analysisMeta[submission.analysisStatus].label,
    submission.overallScore ?? '',
    DEMO_TRANSCRIPT
  ])
  const csv = [
    [t('任务名称'), t('地区'), 'BA', t('门店'), t('提交时间'), t('AI 分析状态'), t('综合评分'), t('转写文本')],
    ...rows
  ]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '音视频任务转写内容.csv'
  link.click()
  URL.revokeObjectURL(url)
}

const confirmDeleteMedia = () => {
  const task = selectedTask.value
  const submission = deleteSubmission.value
  if (!task || !submission || !deleteReason.value.trim()) return
  tasks.value = tasks.value.map((item) =>
    item.id === task.id
      ? {
          ...item,
          submissions: item.submissions.map((entry) =>
            entry.id === submission.id ? { ...entry, mediaDeleted: true } : entry
          )
        }
      : item
  )
  auditLogs.value = [
    { id: `log-${Date.now()}`, action: '删除原始媒体', operator: 'Admin', detail: `${submission.baName} / ${submission.id}：${deleteReason.value.trim()}`, time: '2026-09-03 11:28' },
    ...auditLogs.value
  ]
  deleteSubmission.value = null
  deleteReason.value = ''
  selectedSubmission.value = null
}

const confirmDeactivateTask = () => {
  const task = deactivateTask.value
  if (!task) return
  tasks.value = tasks.value.map((item) =>
    item.id === task.id ? { ...item, status: '已停用' } : item
  )
  deactivateTask.value = null
}

const viewSubmission = (submission: MediaSubmission) => {
  const task = selectedTask.value
  selectedSubmission.value = submission
  if (!task) return
  auditLogs.value = [
    { id: `log-${Date.now()}`, action: '查看媒体', operator: isAdmin.value ? 'Admin' : task.creatorName, detail: `查看 ${submission.baName} 的${mediaLabel(task.capture.mediaKind)}记录`, time: '2026-09-03 11:25' },
    ...auditLogs.value
  ]
}

const taskProgress = (task: MediaCollectionTask) =>
  Math.round((task.submittedCount / task.targetCount) * 100)

const dimensionScore = (submission: MediaSubmission, index: number) =>
  Math.max(68, (submission.overallScore ?? 82) - index * 3 + 4)

const createSteps: Array<{ id: CreateStep; label: string }> = [
  { id: 'basic', label: '1. 任务信息' },
  { id: 'target', label: '2. 采集要求' },
  { id: 'rubric', label: '3. AI 评分' }
]
const createStepIndex = computed(() => ['basic', 'target', 'rubric'].indexOf(createStep.value))

const statusFilters = ['全部', '进行中', '已结束'] as const

const captureTypeOptions: Array<{ id: MediaKind; label: string; description: string; icon: string }> = [
  { id: 'video', label: '视频采集', description: '评估 BA 的话术、动作和镜头表现', icon: 'lucide:video' },
  { id: 'audio', label: '音频采集', description: '评估 BA 的话术、语音和沟通节奏', icon: 'lucide:mic-2' }
]

const targetKindOptions: Array<{ id: TargetKind; label: string; icon: string }> = [
  { id: 'product', label: '指定产品', icon: 'lucide:package' },
  { id: 'scenario', label: '自定义场景', icon: 'lucide:target' }
]

const handleCreateClosed = () => {
  createStep.value = 'basic'
  formError.value = ''
}

const selectTask = (taskId: string) => {
  selectedTaskId.value = taskId
  submissionRegion.value = '全部地区'
}
</script>

<template>
  <div
    class="flex min-h-0 overflow-hidden rounded-xl border border-solid border-[#E5DED8] bg-[#F7F3F1] pt-2"
    style="
      height: calc(
        100vh - var(--top-tool-height) - var(--tags-view-height) - 2 * var(--app-content-padding)
      );
      min-height: 560px;
    "
  >
    <aside class="flex w-[340px] shrink-0 flex-col border-r border-solid border-[#E5DED8] bg-white">
      <div class="border-b border-solid border-[#E9E4DF] bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-bold text-[#242124]">音视频采集任务</h2>
            <p class="mt-1 text-[11px] text-[#766F73]">{{ t(`${visibleTasks.length} 个任务`) }}</p>
          </div>
          <button
            v-if="!isReadOnly && !isAdmin"
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-sm font-medium text-white transition-colors hover:bg-rose-700"
            @click="createOpen = true"
          >
            <Icon icon="lucide:plus" :size="16" />
            <span>新建</span>
          </button>
        </div>
        <div class="relative mt-4">
          <Icon icon="lucide:search" :size="16" class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]" />
          <input v-model="search" placeholder="搜索任务或采集目标" :class="[fieldClass, 'h-9 pl-9']" />
        </div>
        <div class="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[#F3EFEC] p-1">
          <button
            v-for="item in statusFilters"
            :key="item"
            type="button"
            class="min-h-7 rounded-md px-2 text-xs font-medium transition-colors"
            :class="statusFilter === item ? 'bg-white text-[#242124] shadow-sm' : 'text-[#766F73] hover:text-[#242124]'"
            @click="statusFilter = item"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        <button
          v-for="task in visibleTasks"
          :key="task.id"
          type="button"
          class="w-full rounded-lg border border-solid p-4 text-left transition-colors"
          :class="selectedTask?.id === task.id ? 'border-rose-200 bg-rose-50/60' : 'border-[#E9E4DF] bg-white hover:border-rose-100 hover:bg-[#FCF9F7]'"
          @click="selectTask(task.id)"
        >
          <div class="flex flex-wrap items-center gap-2">
            <BeautyBadge :class="['text-[10px]', getTaskStatusBadgeClass(task.status)]">{{ task.status }}</BeautyBadge>
            <BeautyBadge
              :class="['gap-1 text-[10px]', task.capture.mediaKind === 'video' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-violet-200 bg-violet-50 text-violet-700']"
            >
              <Icon :icon="mediaIcon(task.capture.mediaKind)" :size="12" />
              {{ mediaLabel(task.capture.mediaKind) }}
            </BeautyBadge>
            <span v-if="task.scope === '区域'" class="text-[10px] font-medium text-[#766F73]">{{ task.region }}</span>
          </div>
          <h3 data-i18n-skip="true" class="mt-2 line-clamp-2 text-sm leading-snug font-bold text-[#242124]">{{ task.title }}</h3>
          <div class="mt-3 flex items-center justify-between gap-3 text-[10px] text-[#766F73]">
            <span class="min-w-0 truncate">{{ task.target.kind === 'product' ? task.target.productName : task.target.title }}</span>
            <span class="shrink-0 font-bold" :class="getProgressTone(taskProgress(task)).textClass">
              {{ t(`${taskProgress(task)}% 已提交`) }}
            </span>
          </div>
        </button>
        <div v-if="visibleTasks.length === 0" class="px-4 py-12 text-center text-sm text-[#9A9396]">
          当前条件下暂无任务
        </div>
      </div>
    </aside>

    <main class="min-w-0 flex-1 overflow-y-auto bg-[#F8F5F3]/60">
      <div v-if="selectedTask" class="mx-auto min-h-full max-w-6xl">
        <header class="border-b border-solid border-[#E5DED8] bg-white px-7 py-6">
          <div class="flex items-start justify-between gap-5">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <BeautyBadge :class="getTaskStatusBadgeClass(selectedTask.status)">{{ selectedTask.status }}</BeautyBadge>
                <BeautyBadge class="border-[#E5DED8] bg-[#F8F5F3] text-[#5D565A]">
                  {{ selectedTask.scope === '区域' ? selectedTask.region : '全国' }}
                </BeautyBadge>
                <BeautyBadge
                  :class="['gap-1', selectedTask.capture.mediaKind === 'video' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-violet-200 bg-violet-50 text-violet-700']"
                >
                  <Icon :icon="mediaIcon(selectedTask.capture.mediaKind)" :size="16" />
                  {{ t(`${mediaLabel(selectedTask.capture.mediaKind)}采集`) }}
                </BeautyBadge>
              </div>
              <h1 data-i18n-skip="true" class="mt-3 text-2xl leading-tight font-bold text-[#242124]">{{ selectedTask.title }}</h1>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button
                v-if="isAdmin"
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-md border border-solid border-[#E5DED8] bg-white px-3 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
                @click="auditOpen = true"
              >
                <Icon icon="lucide:history" :size="16" /><span>审计记录</span>
              </button>
              <button
                v-if="canEditSelectedTask"
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-md border border-solid border-red-200 bg-red-50 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                @click="deactivateTask = selectedTask"
              >
                <Icon icon="lucide:x" :size="16" /><span>停用任务</span>
              </button>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-solid border-[#E9E4DF] bg-[#E9E4DF] lg:grid-cols-4">
            <button
              type="button"
              class="bg-white px-4 py-3.5 text-left transition-colors hover:bg-[#FCF9F7] focus:ring-2 focus:ring-rose-400 focus:outline-none focus:ring-inset"
              @click="audienceCoverageOpen = true"
            >
              <div class="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]">
                <Icon icon="lucide:users" :size="14" />分发人数
              </div>
              <div class="mt-1 text-lg font-bold text-[#242124]">{{ t(`${selectedTask.targetCount} 人`) }}</div>
            </button>
            <div class="bg-white px-4 py-3.5">
              <div class="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]">
                <Icon icon="lucide:check-circle-2" :size="14" />已提交
              </div>
              <div class="mt-1 text-lg font-bold text-[#242124]">{{ t(`${selectedTask.submittedCount} 人`) }}</div>
            </div>
            <div class="bg-white px-4 py-3.5">
              <div class="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]">
                <Icon icon="lucide:bar-chart-3" :size="14" />提交率
              </div>
              <div class="mt-1 text-lg font-bold text-[#242124]">{{ t(`${Math.round((selectedTask.submittedCount / selectedTask.targetCount) * 100)}%`) }}</div>
            </div>
            <div class="bg-white px-4 py-3.5">
              <div class="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8387]">
                <Icon icon="lucide:sparkles" :size="14" />AI 已分析
              </div>
              <div class="mt-1 text-lg font-bold text-[#242124]">{{ t(`${selectedTask.analysisCompletedCount} 份分析`) }}</div>
            </div>
          </div>
        </header>

        <div class="space-y-5 p-7">
          <section class="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <div class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-5">
              <div class="flex items-center gap-2 text-sm font-bold text-[#242124]">
                <Icon icon="lucide:target" :size="16" class="text-rose-600" />采集目标
              </div>
              <div v-if="selectedTask.target.kind === 'product'" class="mt-4 flex items-start gap-4">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Icon icon="lucide:package" :size="24" />
                </div>
                <div>
                  <div data-i18n-skip="true" class="font-bold text-[#242124]">{{ selectedTask.target.productName }}</div>
                  <div class="mt-1 text-[11px] font-medium text-[#9A9396]">产品版本 {{ selectedTask.target.productVersion }}</div>
                  <p data-i18n-skip="true" class="mt-2 text-sm leading-relaxed text-[#5D565A]">{{ selectedTask.target.productDescription }}</p>
                </div>
              </div>
              <div v-else class="mt-4 space-y-3">
                <div>
                  <div class="text-[10px] font-bold text-[#9A9396]">场景名称</div>
                  <div data-i18n-skip="true" class="mt-1 font-bold text-[#242124]">{{ selectedTask.target.title }}</div>
                </div>
                <div>
                  <div class="text-[10px] font-bold text-[#9A9396]">场景背景</div>
                  <p data-i18n-skip="true" class="mt-1 text-sm leading-relaxed text-[#5D565A]">{{ selectedTask.target.description }}</p>
                </div>
                <div class="rounded-lg border border-solid border-[#D8DEFF] bg-[#F3F5FF] px-3 py-2.5">
                  <div class="text-[10px] font-bold text-[#515BCB]">成功标准</div>
                  <p data-i18n-skip="true" class="mt-1 text-sm leading-relaxed text-[#3F48B4]">{{ selectedTask.target.successCriteria }}</p>
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-5">
              <div class="flex items-center gap-2 text-sm font-bold text-[#242124]">
                <Icon icon="lucide:shield-check" :size="16" class="text-[#3B8F72]" />采集要求
              </div>
              <dl class="mt-4 space-y-3 text-sm">
                <div class="flex items-center justify-between gap-4">
                  <dt class="text-[#766F73]">提交方式</dt>
                  <dd class="font-medium text-[#242124]">APP 录制 / 本地上传</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt class="text-[#766F73]">最长时长</dt>
                  <dd class="font-medium text-[#242124]">{{ t(`${Math.round(selectedTask.capture.limits.maxDurationSec / 60)} 分钟`) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt class="text-[#766F73]">文件上限</dt>
                  <dd class="font-medium text-[#242124]">{{ Math.round(selectedTask.capture.limits.maxBytes / 1024 / 1024) }} MB</dd>
                </div>
              </dl>
            </div>
          </section>

          <section class="overflow-hidden rounded-lg border border-solid border-[#E9E4DF] bg-white">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-solid border-[#E9E4DF] px-5 py-4">
              <div>
                <h2 class="text-sm font-bold text-[#242124]">最近提交</h2>
                <p class="mt-1 text-xs text-[#766F73]">提交成功即计入完成，AI 分析状态独立更新</p>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-2">
                <select
                  aria-label="按地区筛选提交"
                  :value="submissionRegions.includes(submissionRegion) || submissionRegion === '全部地区' ? submissionRegion : '全部地区'"
                  :class="[fieldClass, 'h-8 w-40 py-1 text-xs']"
                  @change="submissionRegion = ($event.target as HTMLSelectElement).value"
                >
                  <option>全部地区</option>
                  <option v-for="region in submissionRegions" :key="region">{{ region }}</option>
                </select>
                <button
                  type="button"
                  :disabled="visibleSubmissions.length === 0"
                  class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-solid border-[#E5DED8] bg-white px-3 text-xs font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3] disabled:cursor-not-allowed disabled:opacity-50"
                  @click="exportTranscripts"
                >
                  <Icon icon="lucide:download" :size="14" />批量导出转写内容
                </button>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="beauty-table w-full min-w-[760px] text-left text-xs">
                <thead class="bg-[#F8F5F3] text-[10px] font-bold text-[#766F73]">
                  <tr>
                    <th class="px-5 py-3">BA / 门店</th>
                    <th class="px-4 py-3">提交信息</th>
                    <th class="px-4 py-3">AI 分析</th>
                    <th class="px-4 py-3">标签</th>
                    <th class="px-5 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="submission in visibleSubmissions" :key="submission.id" class="hover:bg-[#FCFAF8]">
                    <td class="px-5 py-3">
                      <div data-i18n-skip="true" class="font-bold text-[#242124]">{{ submission.baName }}</div>
                      <div data-i18n-skip="true" class="mt-1 text-[10px] text-[#9A9396]">{{ submission.storeName }}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-1.5 font-medium text-[#3F3A3D]">
                        <Icon :icon="submission.source === 'record' ? 'lucide:mic-2' : 'lucide:upload'" :size="14" />
                        {{ submission.source === 'record' ? 'APP 录制' : '本地上传' }} · {{ formatDuration(submission.durationSec) }}
                      </div>
                      <div class="mt-1 text-[10px] text-[#9A9396]">{{ submission.submittedAt }}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <BeautyBadge :class="['text-[10px]', analysisMeta[submission.analysisStatus].className]">
                          {{ analysisMeta[submission.analysisStatus].label }}
                        </BeautyBadge>
                        <span v-if="submission.overallScore !== undefined" class="font-bold" :class="getScoreTone(submission.overallScore)">
                          {{ submission.overallScore }}分
                        </span>
                      </div>
                    </td>
                    <td class="max-w-[220px] px-4 py-3">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="tag in submission.tags.slice(0, 2)"
                          :key="tag"
                          data-i18n-skip="true"
                          class="rounded bg-[#F3EFEC] px-1.5 py-1 text-[10px] text-[#5D565A]"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </td>
                    <td class="px-5 py-3 text-right">
                      <div class="flex flex-wrap justify-end gap-1">
                        <button
                          v-if="submission.analysisStatus === 'completed' && !submission.mediaDeleted"
                          type="button"
                          title="跳转到素材库"
                          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-solid border-[#D8DEFF] bg-white px-3 text-xs font-medium text-[#515BCB] transition-colors hover:bg-[#EEF1FF]"
                          @click="openMaterialAsset(submission.id)"
                        >
                          <Icon icon="lucide:external-link" :size="14" />跳转到素材库
                        </button>
                        <button
                          type="button"
                          :disabled="submission.mediaDeleted"
                          title="查看详情"
                          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#766F73] transition-colors hover:bg-[#F8F5F3] disabled:cursor-not-allowed disabled:opacity-40"
                          @click="viewSubmission(submission)"
                        >
                          <Icon icon="lucide:eye" :size="16" />
                        </button>
                        <button
                          v-if="(submission.analysisStatus === 'failed' || submission.analysisStatus === 'needs_attention') && !isReadOnly"
                          type="button"
                          title="重新处理"
                          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#766F73] transition-colors hover:bg-[#F8F5F3]"
                          @click="retryAnalysis(submission)"
                        >
                          <Icon icon="lucide:refresh-cw" :size="16" />
                        </button>
                        <button
                          v-if="isAdmin"
                          type="button"
                          :disabled="submission.mediaDeleted"
                          title="删除原始媒体"
                          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          @click="deleteSubmission = submission"
                        >
                          <Icon icon="lucide:trash-2" :size="16" />
                        </button>
                      </div>
                      <span v-if="submission.mediaDeleted" class="text-[10px] text-[#9A9396]">原始媒体已删除</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="visibleSubmissions.length === 0" class="px-5 py-12 text-center text-sm text-[#9A9396]">
                暂无可展示的提交记录
              </div>
            </div>
          </section>
        </div>
      </div>
      <div v-else class="flex h-full items-center justify-center text-[#9A9396]">请选择一个采集任务</div>
    </main>

    <!-- 分发覆盖 -->
    <el-dialog
      v-model="audienceCoverageOpen"
      width="820px"
      append-to-body
      class="!p-0"
      body-class="!max-h-[78vh] !overflow-y-auto !p-6"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E9E4DF] !px-6 !pt-5 !pb-4"
    >
      <template #header>
        <div class="flex flex-col">
          <div class="flex items-center gap-2 text-lg font-bold text-[#242124]">
            <Icon icon="lucide:users" :size="20" class="text-rose-600" />分发覆盖
          </div>
          <p data-i18n-skip="true" class="mt-1 text-sm font-normal text-[#766F73]">{{ selectedTask?.title }}</p>
        </div>
      </template>
      <template v-if="selectedTask">
        <section>
          <h3 class="text-sm font-bold text-[#242124]">当前圈人策略</h3>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
              <div class="text-[10px] font-bold text-[#8B8387]">分发对象</div>
              <div data-i18n-skip="true" class="mt-1.5 text-sm font-bold text-[#242124]">{{ selectedTask.targetAudienceLabel }}</div>
            </div>
            <div class="rounded-lg border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
              <div class="text-[10px] font-bold text-[#8B8387]">匹配方式</div>
              <div class="mt-1.5 text-sm font-bold text-[#242124]">全部条件满足</div>
            </div>
          </div>
        </section>

        <section class="mt-5">
          <h3 class="text-sm font-bold text-[#242124]">当前生效条件</h3>
          <div class="mt-3 overflow-hidden rounded-lg border border-solid border-[#E9E4DF]">
            <div class="grid grid-cols-[120px_minmax(0,1fr)] border-b border-solid border-[#E9E4DF] text-sm">
              <div class="bg-[#F8F5F3] px-4 py-3 font-bold text-[#766F73]">组织范围</div>
              <div class="px-4 py-3 font-medium text-[#242124]">{{ selectedTask.scope === '全国' ? '全国所有门店' : `${selectedTask.region}所有门店` }}</div>
            </div>
            <div class="grid grid-cols-[120px_minmax(0,1fr)] border-b border-solid border-[#E9E4DF] text-sm">
              <div class="bg-[#F8F5F3] px-4 py-3 font-bold text-[#766F73]">人员角色</div>
              <div class="px-4 py-3 font-medium text-[#242124]">门店 BA</div>
            </div>
            <div class="grid grid-cols-[120px_minmax(0,1fr)] text-sm">
              <div class="bg-[#F8F5F3] px-4 py-3 font-bold text-[#766F73]">人群条件</div>
              <div data-i18n-skip="true" class="px-4 py-3 font-medium text-[#242124]">{{ selectedTask.targetAudienceLabel }}</div>
            </div>
          </div>
        </section>

        <section class="mt-5 rounded-lg border border-solid border-rose-100 bg-rose-50/50 p-5">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div class="text-xs font-bold text-rose-700">圈人结果</div>
              <div class="mt-1 text-sm text-[#5D565A]">当前策略命中且将接收本任务的人群</div>
            </div>
            <div class="text-right">
              <div class="text-3xl font-bold text-rose-600">{{ selectedTask.targetCount.toLocaleString() }} 人</div>
              <div class="mt-1 text-xs text-[#766F73]">预计分发人数</div>
            </div>
          </div>
          <div class="mt-4 border-t border-solid border-rose-100 pt-4">
            <div class="text-[10px] font-bold text-[#9A9396]">覆盖区域</div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="region in coverageRegions"
                :key="region"
                class="rounded-md border border-solid border-rose-100 bg-white px-2 py-1 text-[11px] font-medium text-[#5D565A]"
              >
                {{ region }}
              </span>
            </div>
            <div class="mt-4 flex items-center gap-1 text-sm font-bold text-[#3B8F72]">
              <Icon icon="lucide:check-circle-2" :size="14" />策略已生效
            </div>
          </div>
        </section>
      </template>
    </el-dialog>

    <!-- 新建采集任务 -->
    <el-dialog
      v-model="createOpen"
      width="1100px"
      append-to-body
      destroy-on-close
      class="!p-0"
      body-class="!p-0"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E9E4DF] !px-6 !pt-5 !pb-4"
      @closed="handleCreateClosed"
    >
      <template #header>
        <div>
          <h3 class="text-lg font-bold text-[#242124]">新建音视频采集任务</h3>
          <div class="mt-3 grid grid-cols-3 gap-2">
            <div
              v-for="(item, index) in createSteps"
              :key="item.id"
              class="rounded-lg border border-solid px-3 py-2 text-center text-xs font-bold"
              :class="
                createStep === item.id
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : index < createStepIndex
                    ? 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]'
                    : 'border-[#E9E4DF] bg-[#F8F5F3] text-[#9A9396]'
              "
            >
              <Icon v-if="index < createStepIndex" icon="lucide:check" :size="14" class="mr-1 inline" />{{ item.label }}
            </div>
          </div>
        </div>
      </template>
      <div class="flex h-[74vh] flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto bg-[#FCFAF8] px-6 py-5">
          <div v-if="formError" class="mb-4 flex items-start gap-2 rounded-lg border border-solid border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <Icon icon="lucide:alert-circle" :size="16" class="mt-0.5 shrink-0" /><span>{{ formError }}</span>
          </div>

          <div v-if="createStep === 'basic'" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div class="space-y-5">
              <div>
                <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">任务名称 <span class="text-rose-600">*</span></label>
                <input v-model="form.title" placeholder="例如：新品面霜门店推荐视频征集" :class="fieldClass" />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">任务简介 <span class="text-rose-600">*</span></label>
                <textarea v-model="form.intro" rows="5" placeholder="说明采集目的、BA 需要完成的内容和拍摄环境要求。" :class="[fieldClass, 'resize-none leading-relaxed']"></textarea>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">开始时间 <span class="text-rose-600">*</span></label>
                  <input v-model="form.startAt" type="date" :class="fieldClass" />
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">截止时间 <span class="text-rose-600">*</span></label>
                  <input v-model="form.deadline" type="date" :class="fieldClass" />
                </div>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">提交频次</label>
                <select v-model="form.frequency" :class="fieldClass">
                  <option>周期内一次性提交</option>
                  <option>每日提交 1 次</option>
                  <option>每周提交 1 次</option>
                  <option>每周提交 3 次</option>
                </select>
              </div>
            </div>
            <div>
              <label class="mb-2 block text-xs font-bold text-[#3F3A3D]">分发对象 <span class="text-rose-600">*</span></label>
              <div class="space-y-2 rounded-lg border border-solid border-[#E5DED8] bg-white p-3">
                <label
                  v-for="item in audiences"
                  :key="item.id"
                  class="flex cursor-pointer items-start gap-3 rounded-lg border border-solid p-3 transition-colors"
                  :class="form.audiences.includes(item.id) ? 'border-rose-200 bg-rose-50/60' : 'border-[#EFEAE7] hover:border-[#DED7D2]'"
                >
                  <input
                    type="checkbox"
                    :checked="form.audiences.includes(item.id)"
                    class="mt-0.5 h-4 w-4 rounded border-[#CFC6C1] text-rose-600 focus:ring-rose-500"
                    @change="
                      form.audiences = ($event.target as HTMLInputElement).checked
                        ? [...form.audiences, item.id]
                        : form.audiences.filter((id) => id !== item.id)
                    "
                  />
                  <span class="text-sm leading-snug text-[#3F3A3D]">{{ item.label }}</span>
                </label>
              </div>
              <div class="mt-3 rounded-lg border border-solid border-[#E9E4DF] bg-[#F8F5F3] px-3 py-2 text-xs leading-relaxed text-[#766F73]">
                任务会按创建者组织范围分发：{{ isRegional ? '仅限南区' : '全国范围' }}。
              </div>
            </div>
          </div>

          <div v-else-if="createStep === 'target'" class="space-y-6">
            <section class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-5">
              <label class="mb-3 block text-xs font-bold text-[#3F3A3D]">采集类型</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="item in captureTypeOptions"
                  :key="item.id"
                  type="button"
                  class="flex items-start gap-3 rounded-lg border border-solid p-4 text-left transition-colors"
                  :class="form.mediaKind === item.id ? 'border-rose-300 bg-rose-50' : 'border-[#E9E4DF] hover:border-[#DED7D2]'"
                  @click="updateMediaKind(item.id)"
                >
                  <div class="rounded-lg p-2" :class="form.mediaKind === item.id ? 'bg-white text-rose-600' : 'bg-[#F8F5F3] text-[#766F73]'">
                    <Icon :icon="item.icon" :size="20" />
                  </div>
                  <div>
                    <div class="font-bold text-[#242124]">{{ item.label }}</div>
                    <div class="mt-1 text-xs leading-relaxed text-[#766F73]">{{ item.description }}</div>
                  </div>
                </button>
              </div>
            </section>

            <section class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-5">
              <label class="mb-3 block text-xs font-bold text-[#3F3A3D]">采集目标</label>
              <div class="inline-flex rounded-lg bg-[#F3EFEC] p-1">
                <button
                  v-for="item in targetKindOptions"
                  :key="item.id"
                  type="button"
                  class="flex min-h-8 items-center gap-1.5 rounded-md px-4 text-xs font-bold"
                  :class="form.targetKind === item.id ? 'bg-white text-[#242124] shadow-sm' : 'text-[#766F73]'"
                  @click="form.targetKind = item.id"
                >
                  <Icon :icon="item.icon" :size="14" />{{ item.label }}
                </button>
              </div>
              <div v-if="form.targetKind === 'product'" class="mt-4 grid grid-cols-2 gap-3">
                <button
                  v-for="product in PRODUCTS"
                  :key="product.id"
                  type="button"
                  class="flex items-start gap-3 rounded-lg border border-solid p-3 text-left"
                  :class="form.productId === product.id ? 'border-rose-300 bg-rose-50/60' : 'border-[#E9E4DF] hover:border-[#DED7D2]'"
                  @click="form.productId = product.id"
                >
                  <div class="rounded-lg bg-white p-2 text-rose-600"><Icon icon="lucide:package" :size="16" /></div>
                  <div>
                    <div data-i18n-skip="true" class="text-sm font-bold text-[#242124]">{{ product.name }}</div>
                    <div class="mt-1 text-[10px] text-[#9A9396]">版本 {{ product.version }}</div>
                    <p data-i18n-skip="true" class="mt-1 line-clamp-2 text-xs leading-relaxed text-[#766F73]">{{ product.description }}</p>
                  </div>
                </button>
              </div>
              <div v-else class="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">场景名称</label>
                  <input v-model="form.scenarioTitle" placeholder="例如：热门商品缺货客诉" :class="fieldClass" />
                </div>
                <div class="lg:row-span-2">
                  <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">场景背景</label>
                  <textarea v-model="form.scenarioDescription" rows="5" placeholder="说明环境、参与者状态和当前冲突。" :class="[fieldClass, 'resize-none']"></textarea>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">成功标准</label>
                  <textarea v-model="form.scenarioSuccessCriteria" rows="3" placeholder="说明 BA 必须完成的关键动作。" :class="[fieldClass, 'resize-none']"></textarea>
                </div>
              </div>
            </section>

            <section class="grid gap-4 rounded-lg border border-solid border-[#E9E4DF] bg-white p-5 md:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">最长时长（秒）</label>
                <input v-model.number="form.maxDurationSec" type="number" min="30" :class="fieldClass" />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">文件上限（MB）</label>
                <input v-model.number="form.maxFileMb" type="number" min="1" :class="fieldClass" />
              </div>
              <div class="md:col-span-2">
                <div class="flex items-start gap-3 rounded-lg border border-solid border-[#D8DEFF] bg-[#F3F5FF] p-3">
                  <Icon icon="lucide:upload" :size="16" class="mt-0.5 shrink-0 text-[#515BCB]" />
                  <div>
                    <div class="text-xs font-bold text-[#3F48B4]">APP 录制与本地上传</div>
                    <p class="mt-1 text-xs leading-relaxed text-[#5962B9]">两种方式均可提交，提交成功后异步进行 AI 分析。</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div v-else class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-solid border-[#D8DEFF] bg-[#F3F5FF] px-4 py-3">
              <div>
                <div class="flex items-center gap-2 text-sm font-bold text-[#3F48B4]">
                  <Icon icon="lucide:sparkles" :size="16" />AI 评价标准
                </div>
                <p class="mt-1 text-xs text-[#5962B9]">根据当前产品/场景生成默认维度，可继续修改。该标准用于AI对上传音视频进行预评价标注，最终视频质量以人工核查为准。</p>
              </div>
              <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-solid border-[#D8DEFF] bg-white px-3 text-xs font-medium text-[#515BCB] transition-colors hover:bg-[#E8EBFF]"
                @click="generateRubric"
              >
                <Icon icon="lucide:wand-sparkles" :size="16" />重新生成
              </button>
            </div>
            <div class="flex items-center justify-between">
              <div class="text-xs font-bold text-[#3F3A3D]">评分维度</div>
              <div class="text-sm font-bold" :class="totalRubricWeight === 100 ? 'text-[#3B8F72]' : 'text-rose-600'">
                权重合计 {{ totalRubricWeight }}%
              </div>
            </div>
            <div
              v-for="(item, index) in form.rubric"
              :key="item.id"
              class="grid gap-3 rounded-lg border border-solid border-[#E9E4DF] bg-white p-4 lg:grid-cols-[28px_minmax(140px,0.7fr)_minmax(240px,1.5fr)_110px_110px_32px]"
            >
              <div class="flex h-7 w-7 items-center justify-center rounded-md bg-[#F3EFEC] text-xs font-bold text-[#766F73]">{{ index + 1 }}</div>
              <input
                :value="item.name"
                aria-label="维度名称"
                :class="[fieldClass, 'h-9']"
                @input="updateRubric(item.id, { name: ($event.target as HTMLInputElement).value })"
              />
              <input
                :value="item.description"
                aria-label="维度说明"
                :class="[fieldClass, 'h-9']"
                @input="updateRubric(item.id, { description: ($event.target as HTMLInputElement).value })"
              />
              <div class="relative">
                <input
                  :value="item.weight"
                  type="number"
                  min="0"
                  max="100"
                  aria-label="权重"
                  :class="[fieldClass, 'h-9 pr-7']"
                  @input="updateRubric(item.id, { weight: Number(($event.target as HTMLInputElement).value) })"
                />
                <span class="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-[#9A9396]">%</span>
              </div>
              <label class="flex h-9 items-center gap-2 rounded-lg border border-solid border-[#E9E4DF] px-3 text-xs font-medium text-[#5D565A]">
                <input
                  type="checkbox"
                  :checked="item.required"
                  class="h-4 w-4 rounded border-[#CFC6C1] text-rose-600"
                  @change="updateRubric(item.id, { required: ($event.target as HTMLInputElement).checked })"
                />必达项
              </label>
              <button
                type="button"
                title="删除评分维度"
                :disabled="form.rubric.length === 1"
                class="flex h-8 w-8 items-center justify-center rounded-md text-[#9A9396] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                @click="form.rubric = form.rubric.filter((dimension) => dimension.id !== item.id)"
              >
                <Icon icon="lucide:trash-2" :size="16" />
              </button>
            </div>
            <button
              type="button"
              class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#CFC6C1] bg-white py-3 text-xs font-bold text-[#766F73] transition-colors hover:border-rose-300 hover:text-rose-600"
              @click="form.rubric = [...form.rubric, { id: `r-${Date.now()}`, name: '', description: '', weight: 0, required: false }]"
            >
              <Icon icon="lucide:plus" :size="16" />新增评分维度
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-solid border-[#E9E4DF] bg-white px-6 py-4">
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
            @click="goPrevious"
          >
            <Icon v-if="createStep !== 'basic'" icon="lucide:chevron-left" :size="16" />{{ createStep === 'basic' ? '取消' : '上一步' }}
          </button>
          <button
            v-if="createStep === 'rubric'"
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700"
            @click="publishTask"
          >
            <Icon icon="lucide:check-circle-2" :size="16" />确认发布任务
          </button>
          <button
            v-else
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700"
            @click="goNext"
          >
            下一步<Icon icon="lucide:chevron-right" :size="16" />
          </button>
        </div>
      </div>
    </el-dialog>

    <!-- 媒体记录与 AI 分析 -->
    <el-dialog
      v-model="submissionOpen"
      width="1000px"
      append-to-body
      class="!p-0"
      body-class="!max-h-[80vh] !overflow-y-auto !p-6"
      header-class="!mx-0 !mb-0 !border-b border-solid !border-[#E9E4DF] !px-6 !pt-5 !pb-4"
    >
      <template #header>
        <h3 class="text-lg font-bold text-[#242124]">媒体记录与 AI 分析</h3>
      </template>
      <div v-if="selectedSubmission && selectedTask" class="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(310px,0.9fr)]">
        <div>
          <div
            class="flex aspect-video items-center justify-center rounded-lg"
            :class="selectedTask.capture.mediaKind === 'video' ? 'bg-[#242124]' : 'border border-solid border-[#D8DEFF] bg-[#F3F5FF]'"
          >
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full"
              :class="selectedTask.capture.mediaKind === 'video' ? 'bg-white/15 text-white' : 'bg-white text-[#515BCB] shadow-sm'"
            >
              <Icon icon="lucide:play" :size="24" class="ml-1" />
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-[#766F73]">
            <span>{{ selectedSubmission.baName }} · {{ mediaLabel(selectedTask.capture.mediaKind) }}</span>
            <span>{{ formatDuration(selectedSubmission.durationSec) }}</span>
          </div>
          <div class="mt-4 rounded-lg border border-solid border-[#E9E4DF] bg-[#F8F5F3] p-4">
            <div class="text-xs font-bold text-[#3F3A3D]">转写文本</div>
            <p data-i18n-skip="true" class="mt-2 text-sm leading-7 text-[#5D565A]">{{ DEMO_TRANSCRIPT }}</p>
          </div>
        </div>
        <div class="space-y-4">
          <div class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-[#766F73]">综合评分</span>
              <span v-if="selectedSubmission.overallScore !== undefined" class="text-3xl font-bold" :class="getScoreTone(selectedSubmission.overallScore)">
                {{ selectedSubmission.overallScore }}
              </span>
              <BeautyBadge v-else :class="analysisMeta[selectedSubmission.analysisStatus].className">
                {{ analysisMeta[selectedSubmission.analysisStatus].label }}
              </BeautyBadge>
            </div>
            <BeautyProgress
              v-if="selectedSubmission.overallScore !== undefined"
              :value="selectedSubmission.overallScore"
              track-class="mt-3 h-1.5 bg-[#F1ECE8]"
              :indicator-class="getProgressTone(selectedSubmission.overallScore).indicatorClass"
            />
          </div>
          <div class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-4">
            <div class="text-xs font-bold text-[#3F3A3D]">维度评分</div>
            <div class="mt-3 space-y-3">
              <div v-for="(item, index) in selectedTask.rubric" :key="item.id">
                <div class="flex justify-between text-xs">
                  <span data-i18n-skip="true" class="text-[#5D565A]">{{ item.name }}</span>
                  <span class="font-bold" :class="getScoreTone(dimensionScore(selectedSubmission, index))">
                    {{ dimensionScore(selectedSubmission, index) }}
                  </span>
                </div>
                <BeautyProgress
                  :value="dimensionScore(selectedSubmission, index)"
                  track-class="mt-1.5 h-1 bg-[#F1ECE8]"
                  :indicator-class="getProgressTone(dimensionScore(selectedSubmission, index)).indicatorClass"
                />
              </div>
            </div>
          </div>
          <div class="rounded-lg border border-solid border-[#D8DEFF] bg-[#F3F5FF] p-4">
            <div class="flex items-center gap-1.5 text-xs font-bold text-[#3F48B4]">
              <Icon icon="lucide:sparkles" :size="16" />AI 点评
            </div>
            <p data-i18n-skip="true" class="mt-2 text-xs leading-relaxed text-[#5962B9]">需求确认自然完整，能够围绕顾客肤质和使用场景展开沟通；产品核心成分与修护卖点表达准确，话术节奏清晰，整体服务状态亲和专业。</p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <BeautyBadge
              v-for="tag in selectedSubmission.tags"
              :key="tag"
              data-i18n-skip="true"
              class="border-[#E5DED8] bg-[#F8F5F3] text-[#5D565A]"
            >
              {{ tag }}
            </BeautyBadge>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 删除原始媒体 -->
    <el-dialog v-model="deleteOpen" width="440px" append-to-body>
      <template #header>
        <div class="flex items-center gap-2 text-base font-semibold text-red-600">
          <Icon icon="lucide:trash-2" :size="20" />删除原始媒体
        </div>
      </template>
      <p class="text-sm leading-relaxed text-[#5D565A]">删除后无法播放或重新分析，已生成的 AI 结果和审计记录将保留。</p>
      <div class="mt-4">
        <label class="mb-1.5 block text-xs font-bold text-[#3F3A3D]">删除原因 <span class="text-rose-600">*</span></label>
        <textarea v-model="deleteReason" rows="3" placeholder="填写数据更正、本人删除请求等原因" :class="[fieldClass, 'resize-none']"></textarea>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
            @click="deleteSubmission = null"
          >
            取消
          </button>
          <button
            type="button"
            :disabled="!deleteReason.trim()"
            class="inline-flex h-9 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="confirmDeleteMedia"
          >
            确认删除
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- 停用采集任务 -->
    <el-dialog v-model="deactivateOpen" width="440px" append-to-body>
      <template #header>
        <div class="flex items-center gap-2 text-base font-semibold text-red-600">
          <Icon icon="lucide:alert-circle" :size="20" />停用采集任务
        </div>
      </template>
      <p class="text-sm leading-relaxed text-[#5D565A]">停用后 BA 将不能继续提交，已提交的原始媒体、AI 分析和审计记录将保留。</p>
      <div v-if="deactivateTask" data-i18n-skip="true" class="mt-3 rounded-lg border border-solid border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
        {{ deactivateTask.title }}
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md border border-solid border-[#E5DED8] bg-white px-4 text-sm font-medium text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3]"
            @click="deactivateTask = null"
          >
            取消
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
            @click="confirmDeactivateTask"
          >
            确认停用
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- 媒体审计记录 -->
    <el-dialog v-model="auditOpen" width="640px" append-to-body>
      <template #header>
        <div class="flex items-center gap-2 text-base font-semibold text-[#242124]">
          <Icon icon="lucide:history" :size="20" class="text-[#515BCB]" />媒体审计记录
        </div>
      </template>
      <div class="rounded-lg border border-solid border-[#E9E4DF]">
        <div
          v-for="log in auditLogs"
          :key="log.id"
          class="grid gap-2 border-b border-solid border-[#EFEAE7] px-4 py-3 last:border-b-0 sm:grid-cols-[110px_minmax(0,1fr)_130px]"
        >
          <div class="text-xs font-bold text-[#3F3A3D]">{{ log.action }}</div>
          <div>
            <div data-i18n-skip="true" class="text-xs leading-relaxed text-[#5D565A]">{{ log.detail }}</div>
            <div data-i18n-skip="true" class="mt-1 text-[10px] text-[#9A9396]">操作人：{{ log.operator }}</div>
          </div>
          <div class="text-right text-[10px] text-[#9A9396]">{{ log.time }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.beauty-table tbody tr + tr {
  border-top: 1px solid #efeae7;
}
</style>
