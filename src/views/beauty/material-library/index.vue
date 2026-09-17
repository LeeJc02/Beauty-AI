<script setup lang="ts">
/**
 * 素材库（原型 pages/MaterialLibrary.tsx，822 行）。
 *
 * 三个视图：全部采集 / 黄金素材 / AI候选推荐。角色决定可执行动作：
 * 「区域培训负责人」与「总部培训」可把采集转写确认进黄金素材，「区域培训师」只能提交建议。
 *
 * 跨页跳转：音视频采集任务页通过 `/material-library?submissionId=xxx` 打开指定采集详情，
 * 打开后清空 query（等价原型 App.tsx 的 requestedSubmissionId / onRequestedAssetOpened）。
 */
import type {
  GoldenAlbum,
  GoldenMaterial,
  MaterialRecommendation,
  MaterialReviewStatus,
  MaterialScope,
  MaterialTargetKind,
  MediaAsset,
  Role,
  SourceEvidence
} from '@/beauty/types'
import {
  MOCK_ANALYSIS_RUNS,
  MOCK_GOLDEN_ALBUMS,
  MOCK_GOLDEN_MATERIALS,
  MOCK_MATERIAL_RECOMMENDATIONS,
  MOCK_MEDIA_ASSETS
} from '@/beauty/lib/materialLibraryData'
import { useUserStore } from '@/store/modules/user'
import { DEMO_ROLES } from '@/mock/data/roles'
import AudioMiniPlayer from './components/AudioMiniPlayer.vue'
import LibraryBadge from './components/LibraryBadge.vue'

defineOptions({ name: 'BeautyMaterialLibrary' })

type LibraryView = 'assets' | 'golden' | 'recommendations'
type ReviewSource =
  | { kind: 'asset'; asset: MediaAsset }
  | { kind: 'recommendation'; recommendation: MaterialRecommendation }
type MediaFilter = '全部' | 'audio' | 'video'
type TargetFilter = '全部目标' | MaterialTargetKind

const ALL_PRODUCT_FILTER = '全部产品 / 场景'
const ALL_SOURCE_TASK_FILTER = '全部来源任务'
const ALL_ALBUMS_ID = '__all__'
const UNCATEGORIZED_ALBUM_ID = '__uncategorized__'

const viewMeta: Array<{ id: LibraryView; label: string }> = [
  { id: 'assets', label: '全部采集' },
  { id: 'golden', label: '黄金素材' },
  { id: 'recommendations', label: 'AI候选推荐' }
]

const assetStatusMeta: Record<MediaAsset['status'], { label: string; className: string }> = {
  ready: { label: '分析完成', className: 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]' },
  processing: { label: '转写处理中', className: 'border-[#D8DEFF] bg-[#EEF1FF] text-[#515BCB]' },
  needs_attention: { label: '待处理', className: 'border-[#E8CCA0] bg-[#FFF7EA] text-[#8B621F]' },
  deleted: { label: '已删除', className: 'border-red-200 bg-red-50 text-red-600' }
}

const recommendationStatusMeta: Record<MaterialReviewStatus, { label: string; className: string }> =
  {
    recommended: { label: 'AI 推荐', className: 'border-[#D8DEFF] bg-[#EEF1FF] text-[#515BCB]' },
    approved: { label: '已入黄金素材', className: 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]' },
    dismissed: { label: '不再推荐', className: 'border-[#E5DED8] bg-[#F8F5F3] text-[#9A9396]' }
  }

const fieldClass =
  'w-full rounded-lg border border-[#DED7D2] bg-white px-3 py-2 text-sm text-[#242124] outline-none transition-colors placeholder:text-[#A69EA2] focus:border-[#6974E8] focus:ring-2 focus:ring-[#6974E8]/15'

const videoCoverUrls: Record<string, string> = {
  'asset-ms-101':
    'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=960&q=80',
  'asset-ms-102':
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=960&q=80',
  'asset-ms-401':
    'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=960&q=80'
}

const MOCK_VIDEO_PLAYBACK_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const formatTime = formatDuration

const mediaLabel = (kind: MediaAsset['mediaKind']) => (kind === 'audio' ? '音频' : '视频')

const targetKindLabel = (kind: MaterialTargetKind) => (kind === 'product' ? '产品' : '场景')

const getAssetTranscript = (asset: MediaAsset) => asset.transcript?.trim() || ''

const displayAssetTranscript = (asset: MediaAsset) =>
  getAssetTranscript(asset) ||
  (asset.status === 'processing' ? '转写文本暂未生成，完成后会自动更新。' : '暂无有效转写文本。')

const getAssetAnalysis = (asset: MediaAsset) =>
  asset.analysisRunId ? MOCK_ANALYSIS_RUNS.find((run) => run.id === asset.analysisRunId) : undefined

const getRecommendationTarget = (recommendation: MaterialRecommendation) =>
  `${mediaLabel(recommendation.mediaKind)} · ${targetKindLabel(recommendation.targetKind)}`

const getAssetTargetKind = (asset: MediaAsset): MaterialTargetKind =>
  asset.productOrScenario.includes('抱怨') ? 'scenario' : 'product'

const getVideoCoverUrl = (asset: MediaAsset) =>
  videoCoverUrls[asset.id] ?? videoCoverUrls['asset-ms-101']

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

/** 与 ba 页面一致：mock 里 user.id = 1000 + 角色下标。 */
const role = computed<Role>(() => {
  const index = (userStore.getUser.id || 1000) - 1000
  return (DEMO_ROLES[index]?.beautyRole ?? 'Super Admin') as Role
})

const isRegional = computed(() =>
  ['Regional Manager', 'Regional Training Manager', 'Regional Trainer'].includes(role.value)
)
const canReview = computed(
  () => role.value === 'HQ Trainer' || role.value === 'Regional Training Manager'
)
const canSuggest = computed(() => role.value === 'Regional Trainer')

const activeView = ref<LibraryView>('assets')
const search = ref('')
const regionFilter = ref('全部地区')
const mediaFilter = ref<MediaFilter>('全部')
const targetFilter = ref<TargetFilter>('全部目标')
const productFilter = ref(ALL_PRODUCT_FILTER)
const sourceTaskFilter = ref(ALL_SOURCE_TASK_FILTER)
const activeAlbumId = ref(ALL_ALBUMS_ID)
const selectedAsset = ref<MediaAsset | null>(null)
const videoPreviewAsset = ref<MediaAsset | null>(null)
const activeAudioId = ref<string | null>(null)
const selectedRecommendation = ref<MaterialRecommendation | null>(null)
const reviewSource = ref<ReviewSource | null>(null)
const dismissRecommendation = ref<MaterialRecommendation | null>(null)
const dismissReason = ref('')
const reviewForm = reactive<{
  title: string
  summary: string
  scope: MaterialScope
  transcript: string
  preserveFull: boolean
  albumId: string
}>({
  title: '',
  summary: '',
  scope: '全国共享',
  transcript: '',
  preserveFull: true,
  albumId: ''
})
const recommendationStatuses = ref<Record<string, MaterialReviewStatus>>({})
const suggestedIds = ref<string[]>([])
const promotedAssetIds = ref<string[]>([])
const albums = ref<GoldenAlbum[]>(MOCK_GOLDEN_ALBUMS)
const albumDialogOpen = ref(false)
const albumForm = reactive({ name: '', description: '' })
const albumFormError = ref('')
const goldenMaterials = ref<GoldenMaterial[]>(MOCK_GOLDEN_MATERIALS)

const resetFilters = () => {
  activeView.value = 'assets'
  search.value = ''
  regionFilter.value = '全部地区'
  mediaFilter.value = '全部'
  targetFilter.value = '全部目标'
  productFilter.value = ALL_PRODUCT_FILTER
  sourceTaskFilter.value = ALL_SOURCE_TASK_FILTER
}

/** 从音视频采集任务页跳进来时，直接打开对应采集详情并清空 query。 */
const openRequestedAsset = () => {
  const requestedSubmissionId = route.query.submissionId
  if (!requestedSubmissionId || typeof requestedSubmissionId !== 'string') return
  const asset = MOCK_MEDIA_ASSETS.find((item) => item.submissionId === requestedSubmissionId)
  resetFilters()
  selectedAsset.value = asset ?? null
  router.replace({ query: {} })
}

onMounted(openRequestedAsset)
watch(() => route.query.submissionId, openRequestedAsset)

const regions = Array.from(new Set(MOCK_MEDIA_ASSETS.map((asset) => asset.region)))
const productOptions = Array.from(
  new Set(MOCK_MEDIA_ASSETS.map((asset) => asset.productOrScenario))
)
const sourceTaskOptions = Array.from(
  new Map(MOCK_MEDIA_ASSETS.map((asset) => [asset.taskId, asset.taskTitle])).entries()
).map(([id, title]) => ({ id, title }))

const hasGoldenSource = (assetId: string) =>
  promotedAssetIds.value.includes(assetId) ||
  goldenMaterials.value.some(
    (material) => material.sourceMediaAssetId === assetId && material.status === 'active'
  )

const isGoldenMaterialVisibleToRole = (material: GoldenMaterial) =>
  !isRegional.value ||
  material.scope === '全国共享' ||
  ['巴厘岛区', '泗水区'].includes(material.region)

interface FilterValues {
  title: string
  transcript: string
  tags?: string[]
  region: string
  mediaKind: 'audio' | 'video'
  targetKind: MaterialTargetKind
}

const matchesFilters = (values: FilterValues) => {
  const keywords =
    `${values.title} ${values.transcript} ${(values.tags ?? []).join(' ')}`.toLowerCase()
  return (
    (regionFilter.value === '全部地区' || values.region === regionFilter.value) &&
    (mediaFilter.value === '全部' || values.mediaKind === mediaFilter.value) &&
    (targetFilter.value === '全部目标' || values.targetKind === targetFilter.value) &&
    keywords.includes(search.value.trim().toLowerCase())
  )
}

const matchesAssetFilters = (asset: MediaAsset) =>
  matchesFilters({
    title: `${asset.taskTitle} ${asset.productOrScenario}`,
    transcript: getAssetTranscript(asset),
    tags: asset.tags,
    region: asset.region,
    mediaKind: asset.mediaKind,
    targetKind: getAssetTargetKind(asset)
  }) &&
  (productFilter.value === ALL_PRODUCT_FILTER || asset.productOrScenario === productFilter.value) &&
  (sourceTaskFilter.value === ALL_SOURCE_TASK_FILTER || asset.taskId === sourceTaskFilter.value)

const assets = computed(() =>
  MOCK_MEDIA_ASSETS.filter((asset) => {
    const inRoleScope =
      !isRegional.value || asset.scope === '全国' || ['巴厘岛区', '泗水区'].includes(asset.region)
    return inRoleScope && matchesAssetFilters(asset)
  })
)

const recommendations = computed(() =>
  MOCK_MATERIAL_RECOMMENDATIONS.map((recommendation) => ({
    ...recommendation,
    status: recommendationStatuses.value[recommendation.id] ?? recommendation.status
  })).filter((recommendation) => {
    const inRoleScope =
      !isRegional.value ||
      ['巴厘岛区', '泗水区'].includes(recommendation.region) ||
      recommendation.targetKind === 'product'
    return (
      recommendation.status === 'recommended' &&
      inRoleScope &&
      matchesFilters({
        title: `${recommendation.targetLabel} ${getRecommendationTarget(recommendation)}`,
        transcript: `${recommendation.transcript} ${recommendation.aiSummary}`,
        region: recommendation.region,
        mediaKind: recommendation.mediaKind,
        targetKind: recommendation.targetKind
      })
    )
  })
)

const visibleGoldenMaterials = computed(() =>
  goldenMaterials.value.filter((material) => {
    const targetKind =
      material.targetKind ?? (material.type === 'scenario_beat' ? 'scenario' : 'product')
    const mediaKind = material.mediaKind ?? 'audio'
    const inRoleScope = isGoldenMaterialVisibleToRole(material)
    const inAlbum =
      activeAlbumId.value === ALL_ALBUMS_ID ||
      (activeAlbumId.value === UNCATEGORIZED_ALBUM_ID
        ? !material.albumId
        : material.albumId === activeAlbumId.value)
    return (
      material.status === 'active' &&
      inRoleScope &&
      inAlbum &&
      matchesFilters({
        title: `${material.title} ${material.targetLabel}`,
        transcript: `${material.transcript ?? material.summary} ${material.aiSummary ?? ''}`,
        tags: material.tags,
        region: material.region,
        mediaKind,
        targetKind
      })
    )
  })
)

const albumCounts = computed(() => {
  const counts = new Map<string, number>()
  goldenMaterials.value.forEach((material) => {
    if (material.status !== 'active' || !isGoldenMaterialVisibleToRole(material)) return
    const key = material.albumId ?? UNCATEGORIZED_ALBUM_ID
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return counts
})

const roleScopedGoldenMaterialCount = computed(
  () =>
    goldenMaterials.value.filter(
      (material) => material.status === 'active' && isGoldenMaterialVisibleToRole(material)
    ).length
)

const completedTranscriptCount = MOCK_MEDIA_ASSETS.filter(
  (asset) => asset.status === 'ready' && Boolean(getAssetTranscript(asset))
).length

const openReviewForAsset = (asset: MediaAsset) => {
  if (asset.status !== 'ready' || !getAssetTranscript(asset) || hasGoldenSource(asset.id)) return
  reviewSource.value = { kind: 'asset', asset }
  reviewForm.title = `${asset.productOrScenario} · 精选话术`
  reviewForm.summary = asset.aiCommentary ?? '请补充这段采集话术值得复用的原因。'
  reviewForm.scope = asset.scope === '区域' ? '区域可用' : '全国共享'
  reviewForm.transcript = getAssetTranscript(asset)
  reviewForm.preserveFull = true
  reviewForm.albumId = ''
  selectedAsset.value = null
}

const openReviewForRecommendation = (recommendation: MaterialRecommendation) => {
  reviewSource.value = { kind: 'recommendation', recommendation }
  reviewForm.title = `${recommendation.targetLabel} · 推荐话术`
  reviewForm.summary = recommendation.aiSummary
  reviewForm.scope = recommendation.targetKind === 'scenario' ? '区域可用' : '全国共享'
  reviewForm.transcript = recommendation.transcript
  reviewForm.preserveFull = false
  reviewForm.albumId = ''
  selectedRecommendation.value = null
}

const openCreateAlbum = () => {
  albumForm.name = ''
  albumForm.description = ''
  albumFormError.value = ''
  albumDialogOpen.value = true
}

const createAlbum = () => {
  const name = albumForm.name.trim()
  if (!name) {
    albumFormError.value = '请输入专辑名称'
    return
  }
  if (albums.value.some((album) => album.name.toLowerCase() === name.toLowerCase())) {
    albumFormError.value = '已有同名专辑，请换一个名称'
    return
  }
  const now = '2026-09-03 11:50'
  const album: GoldenAlbum = {
    id: `album-${Date.now()}`,
    name,
    description: albumForm.description.trim() || undefined,
    createdAt: now,
    updatedAt: now
  }
  albums.value = [...albums.value, album]
  activeAlbumId.value = album.id
  if (reviewSource.value) reviewForm.albumId = album.id
  albumDialogOpen.value = false
  albumForm.name = ''
  albumForm.description = ''
  albumFormError.value = ''
}

const moveMaterialToAlbum = (materialId: string, albumId: string) => {
  goldenMaterials.value = goldenMaterials.value.map((material) =>
    material.id === materialId ? { ...material, albumId: albumId || undefined } : material
  )
}

const removeMaterialFromGolden = (materialId: string) => {
  const material = goldenMaterials.value.find((item) => item.id === materialId)
  if (!material || material.status !== 'active') return

  const sourceStillInUse = material.sourceMediaAssetId
    ? goldenMaterials.value.some(
        (item) =>
          item.id !== material.id &&
          item.sourceMediaAssetId === material.sourceMediaAssetId &&
          item.status === 'active'
      )
    : false

  goldenMaterials.value = goldenMaterials.value.map((item) =>
    item.id === materialId ? { ...item, status: 'retired' } : item
  )
  if (material.sourceMediaAssetId && !sourceStillInUse) {
    promotedAssetIds.value = promotedAssetIds.value.filter(
      (assetId) => assetId !== material.sourceMediaAssetId
    )
  }
}

const removeAssetFromGolden = (assetId: string) => {
  goldenMaterials.value = goldenMaterials.value.map((material) =>
    material.sourceMediaAssetId === assetId && material.status === 'active'
      ? { ...material, status: 'retired' }
      : material
  )
  promotedAssetIds.value = promotedAssetIds.value.filter(
    (promotedAssetId) => promotedAssetId !== assetId
  )
}

const buildEvidence = (source: ReviewSource, transcript: string): SourceEvidence[] => {
  const asset =
    source.kind === 'asset'
      ? source.asset
      : MOCK_MEDIA_ASSETS.find((item) => item.id === source.recommendation.mediaAssetId)
  const analysis = asset ? getAssetAnalysis(asset) : undefined
  if (analysis?.segments.length) return [{ ...analysis.segments[0], transcript }]
  return [
    {
      id: `evidence-manual-${Date.now()}`,
      mediaAssetId: asset?.id ?? source.kind,
      startSec: 0,
      endSec: asset?.durationSec ?? 0,
      transcript
    }
  ]
}

const confirmPromote = () => {
  const source = reviewSource.value
  if (
    !source ||
    !reviewForm.title.trim() ||
    !reviewForm.summary.trim() ||
    !reviewForm.transcript.trim() ||
    !reviewForm.albumId
  )
    return
  const sourceAsset =
    source.kind === 'asset'
      ? source.asset
      : MOCK_MEDIA_ASSETS.find((asset) => asset.id === source.recommendation.mediaAssetId)
  if (!sourceAsset) return
  const sourceTargetKind: MaterialTargetKind = sourceAsset.productOrScenario.includes('抱怨')
    ? 'scenario'
    : 'product'
  const evidence = buildEvidence(source, reviewForm.transcript.trim())
  const material: GoldenMaterial = {
    id: `gold-manual-${Date.now()}`,
    candidateId:
      source.kind === 'recommendation' ? source.recommendation.id : `manual-${sourceAsset.id}`,
    type: 'sales_method',
    title: reviewForm.title.trim(),
    summary: reviewForm.summary.trim(),
    targetLabel: sourceAsset.productOrScenario,
    region: sourceAsset.region,
    scope: reviewForm.scope,
    tags: sourceAsset.tags,
    evidence,
    reviewerName: role.value === 'HQ Trainer' ? 'Sarah Lee' : 'Fitriani',
    reviewedAt: '2026-09-03 11:45',
    version: 1,
    status: 'active',
    albumId: reviewForm.albumId,
    sourceMediaAssetId: sourceAsset.id,
    transcript: reviewForm.preserveFull
      ? getAssetTranscript(sourceAsset)
      : reviewForm.transcript.trim(),
    aiSummary: reviewForm.summary.trim(),
    mediaKind: sourceAsset.mediaKind,
    targetKind: sourceTargetKind
  }
  goldenMaterials.value = [material, ...goldenMaterials.value]
  promotedAssetIds.value = promotedAssetIds.value.includes(sourceAsset.id)
    ? promotedAssetIds.value
    : [...promotedAssetIds.value, sourceAsset.id]
  if (source.kind === 'recommendation') {
    recommendationStatuses.value = {
      ...recommendationStatuses.value,
      [source.recommendation.id]: 'approved'
    }
  }
  reviewSource.value = null
  activeAlbumId.value = reviewForm.albumId
  activeView.value = 'golden'
}

const confirmDismissRecommendation = () => {
  const recommendation = dismissRecommendation.value
  if (!recommendation) return
  recommendationStatuses.value = {
    ...recommendationStatuses.value,
    [recommendation.id]: 'dismissed'
  }
  dismissRecommendation.value = null
  dismissReason.value = ''
}

const requestSuggestion = (recommendation: MaterialRecommendation) => {
  suggestedIds.value = suggestedIds.value.includes(recommendation.id)
    ? suggestedIds.value
    : [...suggestedIds.value, recommendation.id]
}

const requestSuggestionForAsset = (assetId: string) => {
  if (suggestedIds.value.includes(assetId)) return
  suggestedIds.value = [...suggestedIds.value, assetId]
}

const handleAudioActiveChange = (assetId: string | null) => {
  activeAudioId.value = assetId
}

/* 以下为模板里用到的具名处理器：避免模板内联多语句被 prettier 重排后破坏编译。 */
const clearCategoryFilters = () => {
  productFilter.value = ALL_PRODUCT_FILTER
  sourceTaskFilter.value = ALL_SOURCE_TASK_FILTER
}

const openMaterialSource = (material: GoldenMaterial) => {
  selectedAsset.value = material.sourceMediaAssetId
    ? (MOCK_MEDIA_ASSETS.find((asset) => asset.id === material.sourceMediaAssetId) ?? null)
    : null
}

const setVideoPreviewVisible = (open: boolean) => {
  if (!open) videoPreviewAsset.value = null
}

const setSelectedAssetVisible = (open: boolean) => {
  if (!open) selectedAsset.value = null
}

const setSelectedRecommendationVisible = (open: boolean) => {
  if (!open) selectedRecommendation.value = null
}

const setReviewVisible = (open: boolean) => {
  if (!open) reviewSource.value = null
}

const setDismissVisible = (open: boolean) => {
  if (!open) dismissRecommendation.value = null
}

const openDismissFromDetail = () => {
  dismissRecommendation.value = selectedRecommendation.value
  selectedRecommendation.value = null
}

const resetAlbumForm = () => {
  albumForm.name = ''
  albumForm.description = ''
  albumFormError.value = ''
}

const openVideoFromDetail = () => {
  if (selectedAsset.value) videoPreviewAsset.value = selectedAsset.value
}

const albumChipClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
    active
      ? 'border-[#515BCB] bg-[#EEF1FF] text-[#515BCB]'
      : 'border-[#E5DED8] bg-white text-[#766F73] hover:border-[#C9C3C0] hover:text-[#3F3A3D]'
  }`

onBeforeUnmount(() => {
  activeAudioId.value = null
})
</script>

<template>
  <div class="min-h-full space-y-5">
    <header class="rounded-lg border border-[#E5DED8] bg-white px-5 py-5 shadow-sm sm:px-6">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div class="flex items-center gap-2 text-[#515BCB]">
            <Icon icon="lucide:book-open-check" :size="20" />
            <span class="text-xs font-bold uppercase tracking-wider">AI 陪练</span>
          </div>
          <h2 class="mt-2 text-xl font-bold text-[#242124]">素材库</h2>
          <p class="mt-1 text-sm text-[#766F73]">先读转写，再从真实采集中精选可复用的黄金话术。</p>
        </div>
        <div
          class="grid w-full max-w-[520px] grid-cols-3 divide-x divide-[#E9E4DF] rounded-lg border border-[#E5DED8] bg-[#FCFAF8] sm:min-w-[390px]"
        >
          <div class="px-3 py-3 sm:px-4">
            <div class="text-lg font-bold text-[#242124]">{{ MOCK_MEDIA_ASSETS.length }}</div>
            <div class="mt-1 text-[11px] text-[#766F73]">采集记录</div>
          </div>
          <div class="px-3 py-3 sm:px-4">
            <div class="text-lg font-bold text-[#515BCB]">{{ completedTranscriptCount }}</div>
            <div class="mt-1 text-[11px] text-[#766F73]">已完成转写</div>
          </div>
          <div class="px-3 py-3 sm:px-4">
            <div class="text-lg font-bold text-[#3B8F72]">{{ visibleGoldenMaterials.length }}</div>
            <div class="mt-1 text-[11px] text-[#766F73]">黄金素材</div>
          </div>
        </div>
      </div>
    </header>

    <section class="overflow-hidden rounded-lg border border-[#E5DED8] bg-white shadow-sm">
      <div class="border-b border-[#E9E4DF] px-5 pt-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-1">
            <button
              v-for="view in viewMeta"
              :key="view.id"
              type="button"
              class="relative px-3 py-3 text-sm font-bold transition-colors"
              :class="
                activeView === view.id ? 'text-[#515BCB]' : 'text-[#766F73] hover:text-[#3F3A3D]'
              "
              @click="activeView = view.id"
            >
              {{ view.label }}
              <span
                v-if="activeView === view.id"
                class="absolute inset-x-3 bottom-0 h-0.5 bg-[#515BCB]"
              ></span>
            </button>
          </div>
          <div class="flex w-full flex-wrap items-center gap-2 pb-3 sm:w-auto">
            <div class="relative min-w-[220px] flex-1 sm:flex-none">
              <Icon
                icon="lucide:search"
                :size="16"
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9396]"
              />
              <input
                v-model="search"
                placeholder="搜索转写、产品或场景"
                class="h-8 w-full rounded-lg border border-[#E5DED8] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#6974E8] focus:ring-2 focus:ring-[#EEF1FF] sm:w-52"
              />
            </div>
            <select
              v-model="regionFilter"
              aria-label="按地区筛选"
              class="h-8 rounded-lg border border-[#E5DED8] bg-white px-2 text-xs text-[#5D565A] outline-none focus:border-[#6974E8]"
            >
              <option>全部地区</option>
              <option v-for="region in regions" :key="region">{{ region }}</option>
            </select>
            <select
              v-model="mediaFilter"
              aria-label="按媒体类型筛选"
              class="h-8 rounded-lg border border-[#E5DED8] bg-white px-2 text-xs text-[#5D565A] outline-none focus:border-[#6974E8]"
            >
              <option value="全部">全部媒体</option>
              <option value="video">视频</option>
              <option value="audio">音频</option>
            </select>
            <select
              v-model="targetFilter"
              aria-label="按目标类型筛选"
              class="h-8 rounded-lg border border-[#E5DED8] bg-white px-2 text-xs text-[#5D565A] outline-none focus:border-[#6974E8]"
            >
              <option value="全部目标">全部目标</option>
              <option value="product">产品</option>
              <option value="scenario">场景</option>
            </select>
          </div>
        </div>

        <div
          v-if="activeView === 'assets'"
          class="flex flex-wrap items-end gap-3 border-t border-[#F0ECE8] py-3"
        >
          <div class="mr-1 flex items-center gap-1.5 self-center text-xs font-bold text-[#5D565A]">
            <Icon icon="lucide:search" :size="14" class="text-[#515BCB]" />采集分类筛选
          </div>
          <label
            class="flex min-w-[190px] flex-1 flex-col gap-1 text-[11px] font-bold text-[#766F73] sm:flex-none"
          >
            <span>产品 / 场景</span>
            <select
              v-model="productFilter"
              aria-label="按产品或场景筛选"
              class="h-8 w-full rounded-lg border border-[#E5DED8] bg-white px-2 text-xs font-normal text-[#5D565A] outline-none focus:border-[#6974E8]"
            >
              <option>{{ ALL_PRODUCT_FILTER }}</option>
              <option v-for="product in productOptions" :key="product">{{ product }}</option>
            </select>
          </label>
          <label
            class="flex min-w-[230px] flex-1 flex-col gap-1 text-[11px] font-bold text-[#766F73] sm:flex-none"
          >
            <span>来源任务</span>
            <select
              v-model="sourceTaskFilter"
              aria-label="按来源任务筛选"
              class="h-8 w-full rounded-lg border border-[#E5DED8] bg-white px-2 text-xs font-normal text-[#5D565A] outline-none focus:border-[#6974E8]"
            >
              <option :value="ALL_SOURCE_TASK_FILTER">{{ ALL_SOURCE_TASK_FILTER }}</option>
              <option v-for="option in sourceTaskOptions" :key="option.id" :value="option.id">
                {{ option.title }}
              </option>
            </select>
          </label>
          <button
            v-if="
              productFilter !== ALL_PRODUCT_FILTER || sourceTaskFilter !== ALL_SOURCE_TASK_FILTER
            "
            type="button"
            class="h-8 px-1 text-xs font-bold text-[#515BCB] hover:text-[#3F48B4]"
            @click="clearCategoryFilters"
          >
            清除分类筛选
          </button>
        </div>
      </div>

      <div class="p-5">
        <!-- 全部采集 -->
        <div v-if="activeView === 'assets'" class="space-y-3">
          <article
            v-for="asset in assets"
            :key="asset.id"
            class="rounded-lg border border-[#E5DED8] bg-white p-4 transition-colors hover:border-[#C9C3C0] sm:p-5"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
              <button
                v-if="asset.mediaKind === 'video'"
                type="button"
                :aria-label="`播放 ${asset.productOrScenario} 视频`"
                class="group relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-[#E5DED8] bg-[#F8F5F3] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#515BCB] sm:w-52 lg:w-56"
                @click="videoPreviewAsset = asset"
              >
                <img
                  :src="getVideoCoverUrl(asset)"
                  :alt="`${asset.productOrScenario} 视频封面`"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span
                  class="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/30"
                ></span>
                <span
                  class="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-bold text-white"
                  >{{ formatDuration(asset.durationSec) }}</span
                >
                <span
                  class="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#515BCB] shadow-sm transition-transform group-hover:scale-105"
                >
                  <Icon icon="lucide:play" :size="20" class="ml-0.5 fill-current" />
                </span>
              </button>
              <AudioMiniPlayer
                v-else
                :asset="asset"
                :active="activeAudioId === asset.id"
                @active-change="handleAudioActiveChange"
              />

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-bold text-[#766F73]"
                    >{{ mediaLabel(asset.mediaKind) }} ·
                    {{ formatDuration(asset.durationSec) }}</span
                  >
                  <LibraryBadge :tone="assetStatusMeta[asset.status].className">{{
                    assetStatusMeta[asset.status].label
                  }}</LibraryBadge>
                  <LibraryBadge
                    v-if="hasGoldenSource(asset.id)"
                    tone="border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]"
                    >已加入黄金素材</LibraryBadge
                  >
                </div>

                <div
                  class="mt-3 grid gap-3 border-y border-[#F0ECE8] py-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold text-[#9A9396]">
                      {{ targetKindLabel(getAssetTargetKind(asset)) }}
                    </div>
                    <div
                      class="mt-1 truncate text-sm font-bold text-[#242124]"
                      :title="asset.productOrScenario"
                    >
                      {{ asset.productOrScenario }}
                    </div>
                  </div>
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold text-[#9A9396]">提交人</div>
                    <div class="mt-1 truncate text-sm font-bold text-[#242124]">
                      {{ asset.submitterName }}
                    </div>
                  </div>
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold text-[#9A9396]">地区</div>
                    <div
                      class="mt-1 flex items-center gap-1 truncate text-sm font-bold text-[#242124]"
                    >
                      <Icon icon="lucide:map-pin" :size="14" class="shrink-0 text-[#9A9396]" />{{
                        asset.region
                      }}
                    </div>
                  </div>
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold text-[#9A9396]">来源任务</div>
                    <div
                      class="mt-1 truncate text-sm font-bold text-[#242124]"
                      :title="asset.taskTitle"
                    >
                      {{ asset.taskTitle }}
                    </div>
                  </div>
                </div>
                <p data-i18n-skip="true" class="mt-3 line-clamp-2 text-sm leading-6 text-[#5D565A]">
                  <span class="mr-2 font-bold text-[#766F73]">高光转写</span
                  >{{ displayAssetTranscript(asset) }}
                </p>
              </div>

              <div
                class="flex shrink-0 items-center justify-end gap-2 lg:w-[180px] lg:flex-col lg:items-stretch"
              >
                <el-button
                  size="small"
                  class="!h-8 !border-[#E5DED8] !text-[#5D565A]"
                  @click="selectedAsset = asset"
                >
                  <Icon icon="lucide:eye" :size="16" class="mr-1.5" />查看详情
                </el-button>
                <template v-if="hasGoldenSource(asset.id)">
                  <el-button
                    size="small"
                    disabled
                    class="!h-8 !border-[#BFDCCF] !bg-[#EEF8F4] !text-[#3B8F72]"
                  >
                    <Icon icon="lucide:shield-check" :size="16" class="mr-1.5" />已加入黄金素材
                  </el-button>
                  <el-button
                    v-if="canReview"
                    size="small"
                    class="!h-8 !border-[#F1CFCA] !text-[#B75147] hover:!bg-[#FFF4F2] hover:!text-[#A8443A]"
                    @click="removeAssetFromGolden(asset.id)"
                  >
                    <Icon icon="lucide:archive-x" :size="16" class="mr-1.5" />从黄金素材移出
                  </el-button>
                </template>
                <el-button
                  v-else
                  size="small"
                  :disabled="!canReview || asset.status !== 'ready'"
                  class="!h-8 !border-[#D8DEFF] !text-[#515BCB] hover:!bg-[#EEF1FF]"
                  @click="openReviewForAsset(asset)"
                >
                  <Icon icon="lucide:shield-check" :size="16" class="mr-1.5" />{{
                    canReview ? '加入黄金素材' : canSuggest ? '建议入库' : '无操作权限'
                  }}
                </el-button>
                <button
                  v-if="canSuggest && !hasGoldenSource(asset.id)"
                  type="button"
                  class="text-right text-[11px] font-bold text-[#515BCB] hover:text-[#3F48B4] lg:text-center"
                  @click="requestSuggestionForAsset(asset.id)"
                >
                  {{ suggestedIds.includes(asset.id) ? '已提交建议' : '提交精选建议' }}
                </button>
              </div>
            </div>
          </article>
          <div
            v-if="!assets.length"
            class="rounded-lg border border-dashed border-[#E5DED8] px-5 py-12 text-center text-sm text-[#766F73]"
          >
            没有符合条件的采集记录
          </div>
        </div>

        <!-- 黄金素材 -->
        <div v-if="activeView === 'golden'">
          <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 class="text-base font-bold text-[#242124]">已精选黄金素材</h3>
              <p class="mt-1 text-xs text-[#766F73]">
                由培训人员确认可复用，引用时只带入脱敏转写和来源版本。
              </p>
            </div>
            <div class="flex items-center gap-2">
              <el-button
                v-if="canReview"
                size="small"
                class="!h-8 !border-[#D8DEFF] !text-[#515BCB] hover:!bg-[#EEF1FF]"
                @click="openCreateAlbum"
              >
                <Icon icon="lucide:folder-plus" :size="16" class="mr-1.5" />新建专辑
              </el-button>
            </div>
          </div>

          <div class="mb-5 overflow-x-auto border-b border-[#E9E4DF]">
            <div class="flex min-w-max items-center gap-2 pb-3">
              <button
                type="button"
                :aria-pressed="activeAlbumId === ALL_ALBUMS_ID"
                :class="albumChipClass(activeAlbumId === ALL_ALBUMS_ID)"
                @click="activeAlbumId = ALL_ALBUMS_ID"
              >
                <Icon icon="lucide:folder" :size="14" />全部专辑<span
                  class="ml-0.5 text-[11px] opacity-70"
                  >{{ roleScopedGoldenMaterialCount }}</span
                >
              </button>
              <button
                v-for="album in albums"
                :key="album.id"
                type="button"
                :title="album.description"
                :aria-pressed="activeAlbumId === album.id"
                :class="albumChipClass(activeAlbumId === album.id)"
                @click="activeAlbumId = album.id"
              >
                <Icon icon="lucide:folder" :size="14" />{{ album.name
                }}<span class="ml-0.5 text-[11px] opacity-70">{{
                  albumCounts.get(album.id) ?? 0
                }}</span>
              </button>
              <button
                v-if="albumCounts.has(UNCATEGORIZED_ALBUM_ID)"
                type="button"
                :aria-pressed="activeAlbumId === UNCATEGORIZED_ALBUM_ID"
                :class="albumChipClass(activeAlbumId === UNCATEGORIZED_ALBUM_ID)"
                @click="activeAlbumId = UNCATEGORIZED_ALBUM_ID"
              >
                <Icon icon="lucide:folder" :size="14" />未分类<span
                  class="ml-0.5 text-[11px] opacity-70"
                  >{{ albumCounts.get(UNCATEGORIZED_ALBUM_ID) ?? 0 }}</span
                >
              </button>
            </div>
          </div>

          <div class="space-y-3">
            <article
              v-for="material in visibleGoldenMaterials"
              :key="material.id"
              class="rounded-lg border border-[#E5DED8] bg-white p-4 sm:p-5"
            >
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <LibraryBadge tone="border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]"
                      >已审核</LibraryBadge
                    >
                    <span class="text-xs text-[#766F73]"
                      >来源：{{ mediaLabel(material.mediaKind ?? 'audio') }} ·
                      {{ targetKindLabel(material.targetKind ?? 'product') }} ·
                      {{ material.targetLabel }}</span
                    >
                  </div>
                  <p
                    data-i18n-skip="true"
                    class="mt-3 text-sm font-medium leading-7 text-[#242124]"
                  >
                    {{ material.transcript ?? material.summary }}
                  </p>
                  <div
                    class="mt-3 rounded-md bg-[#F8F5F3] px-3 py-2 text-xs leading-relaxed text-[#5D565A]"
                  >
                    <span class="font-bold text-[#766F73]">AI 总结：</span
                    >{{ material.aiSummary ?? material.summary }}
                  </div>
                  <div
                    class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#766F73]"
                  >
                    <span
                      ><Icon
                        icon="lucide:map-pin"
                        :size="14"
                        class="mr-1 inline text-[#9A9396]"
                      />{{ material.region }}</span
                    >
                    <span>范围：{{ material.scope }}</span>
                    <span>审核人：{{ material.reviewerName }}</span>
                  </div>
                </div>
                <div
                  class="flex shrink-0 items-center justify-end gap-2 lg:w-[180px] lg:flex-col lg:items-stretch"
                >
                  <el-button
                    size="small"
                    class="!h-8 !border-[#E5DED8] !text-[#5D565A]"
                    @click="openMaterialSource(material)"
                  >
                    <Icon icon="lucide:eye" :size="16" class="mr-1.5" />查看详情
                  </el-button>
                  <div v-if="canReview" class="flex items-center justify-end gap-1.5 lg:w-full">
                    <el-dropdown
                      trigger="click"
                      @command="(command: string) => moveMaterialToAlbum(material.id, command)"
                    >
                      <button
                        type="button"
                        :aria-label="`移动 ${material.title} 到专辑`"
                        title="移动到专辑"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5DED8] bg-white text-[#5D565A] transition-colors hover:bg-[#F8F5F3] hover:text-[#3F3A3D]"
                      >
                        <Icon icon="lucide:folder-input" :size="16" />
                      </button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="">
                            <Icon icon="lucide:folder" :size="14" class="mr-1.5" />未分类
                            <Icon
                              v-if="!material.albumId"
                              icon="lucide:check-circle-2"
                              :size="14"
                              class="ml-2 text-[#515BCB]"
                            />
                          </el-dropdown-item>
                          <el-dropdown-item
                            v-for="album in albums"
                            :key="album.id"
                            :command="album.id"
                          >
                            <Icon icon="lucide:folder" :size="14" class="mr-1.5" />{{ album.name }}
                            <Icon
                              v-if="material.albumId === album.id"
                              icon="lucide:check-circle-2"
                              :size="14"
                              class="ml-2 text-[#515BCB]"
                            />
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                    <el-button
                      size="small"
                      class="!h-8 !w-8 !border-[#F1CFCA] !text-[#B75147] hover:!bg-[#FFF4F2] hover:!text-[#A8443A]"
                      :aria-label="`移出 ${material.title} 黄金素材`"
                      title="移出黄金素材"
                      @click="removeMaterialFromGolden(material.id)"
                    >
                      <Icon icon="lucide:archive-x" :size="16" />
                    </el-button>
                  </div>
                  <span class="text-right text-[11px] text-[#9A9396] lg:text-center"
                    >已被 {{ material.type === 'quote' ? 3 : 2 }} 个陪练资产引用</span
                  >
                </div>
              </div>
            </article>
            <div
              v-if="!visibleGoldenMaterials.length"
              class="rounded-lg border border-dashed border-[#E5DED8] px-5 py-12 text-center text-sm text-[#766F73]"
            >
              暂时没有符合条件的黄金素材
            </div>
          </div>
        </div>

        <!-- AI候选推荐 -->
        <div v-if="activeView === 'recommendations'">
          <div
            class="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#E9E4DF] pb-4"
          >
            <div>
              <h3 class="flex items-center gap-2 text-base font-bold text-[#242124]">
                <Icon icon="lucide:sparkles" :size="16" class="text-[#6974E8]" />AI候选推荐
              </h3>
              <p class="mt-1 text-xs text-[#766F73]">
                AI 只负责发现和总结，是否进入黄金素材由人确认。
              </p>
            </div>
            <LibraryBadge tone="border-[#D8DEFF] bg-[#EEF1FF] text-[#515BCB]"
              >{{ recommendations.length }} 条待确认</LibraryBadge
            >
          </div>
          <div class="space-y-3">
            <article
              v-for="recommendation in recommendations"
              :key="recommendation.id"
              class="rounded-lg border border-[#D8DEFF] bg-[#F9FAFF] p-4 sm:p-5"
            >
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <LibraryBadge :tone="recommendationStatusMeta.recommended.className"
                      >AI 推荐</LibraryBadge
                    >
                    <span class="text-xs text-[#766F73]"
                      >来源：{{ getRecommendationTarget(recommendation) }} ·
                      {{ recommendation.targetLabel }}</span
                    >
                  </div>
                  <p
                    data-i18n-skip="true"
                    class="mt-3 text-sm font-medium leading-7 text-[#242124]"
                  >
                    {{ recommendation.transcript }}
                  </p>
                  <div
                    class="mt-3 rounded-md border border-[#D8DEFF] bg-white px-3 py-2 text-xs leading-relaxed text-[#515BCB]"
                  >
                    <span class="font-bold">AI 总结：</span>{{ recommendation.aiSummary }}
                  </div>
                  <div
                    class="mt-3 rounded-md bg-[#EEF1FF] px-3 py-2 text-xs leading-relaxed text-[#515BCB]"
                  >
                    <span class="font-bold">AI 推荐理由：</span
                    >{{ recommendation.recommendationReason }}
                  </div>
                  <div
                    class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#766F73]"
                  >
                    <span
                      ><Icon
                        icon="lucide:map-pin"
                        :size="14"
                        class="mr-1 inline text-[#9A9396]"
                      />{{ recommendation.region }}</span
                    >
                    <span>推荐时间：{{ recommendation.createdAt }}</span>
                  </div>
                </div>
                <div
                  class="flex shrink-0 items-center justify-end gap-2 lg:w-[180px] lg:flex-col lg:items-stretch"
                >
                  <el-button
                    size="small"
                    class="!h-8 !border-[#D8DEFF] !text-[#515BCB] hover:!bg-white"
                    @click="selectedRecommendation = recommendation"
                  >
                    <Icon icon="lucide:eye" :size="16" class="mr-1.5" />查看详情
                  </el-button>
                  <el-button
                    v-if="canReview"
                    size="small"
                    class="!h-8 !border-[#515BCB] !bg-[#515BCB] !text-white hover:!bg-[#444DB2]"
                    @click="openReviewForRecommendation(recommendation)"
                  >
                    <Icon icon="lucide:shield-check" :size="16" class="mr-1.5" />进入黄金素材
                  </el-button>
                  <el-button
                    v-else-if="canSuggest"
                    size="small"
                    class="!h-8 !border-[#D8DEFF] !text-[#515BCB] hover:!bg-white"
                    @click="requestSuggestion(recommendation)"
                  >
                    <Icon icon="lucide:shield-check" :size="16" class="mr-1.5" />{{
                      suggestedIds.includes(recommendation.id) ? '已提交建议' : '建议入库'
                    }}
                  </el-button>
                  <el-button
                    size="small"
                    text
                    class="!h-8 !text-[#766F73] hover:!text-[#5D565A]"
                    @click="dismissRecommendation = recommendation"
                  >
                    <Icon icon="lucide:circle-off" :size="16" class="mr-1.5" />不再推荐
                  </el-button>
                </div>
              </div>
            </article>
            <div
              v-if="!recommendations.length"
              class="rounded-lg border border-dashed border-[#D8DEFF] bg-[#F9FAFF] px-5 py-10 text-center text-sm text-[#766F73]"
            >
              当前没有待确认的 AI 候选推荐
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 原始视频预览 -->
    <el-dialog
      :model-value="Boolean(videoPreviewAsset)"
      class="beauty-material-dialog"
      width="896px"
      append-to-body
      @update:model-value="setVideoPreviewVisible"
    >
      <template #header>
        <div class="flex items-center gap-2 text-lg font-bold text-[#242124]">
          <Icon icon="lucide:video" :size="20" class="text-[#515BCB]" />原始视频预览
        </div>
      </template>
      <div v-if="videoPreviewAsset">
        <div class="-mx-5 -mt-5 bg-[#171518] p-4 sm:p-5">
          <video
            :key="videoPreviewAsset.id"
            controls
            autoplay
            playsinline
            :poster="getVideoCoverUrl(videoPreviewAsset)"
            class="aspect-video w-full rounded-md bg-black object-contain"
          >
            <source :src="MOCK_VIDEO_PLAYBACK_URL" type="video/mp4" />
            当前浏览器不支持视频播放。
          </video>
        </div>
        <div class="grid gap-3 pt-4 text-sm sm:grid-cols-3">
          <div>
            <div class="text-[11px] font-bold text-[#9A9396]">
              {{ targetKindLabel(getAssetTargetKind(videoPreviewAsset)) }}
            </div>
            <div class="mt-1 font-bold text-[#242124]">
              {{ videoPreviewAsset.productOrScenario }}
            </div>
          </div>
          <div>
            <div class="text-[11px] font-bold text-[#9A9396]">提交人</div>
            <div class="mt-1 font-bold text-[#242124]">{{ videoPreviewAsset.submitterName }}</div>
          </div>
          <div>
            <div class="text-[11px] font-bold text-[#9A9396]">地区</div>
            <div class="mt-1 flex items-center gap-1 font-bold text-[#242124]">
              <Icon icon="lucide:map-pin" :size="14" class="text-[#9A9396]" />{{
                videoPreviewAsset.region
              }}
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 采集转写详情 -->
    <el-dialog
      :model-value="Boolean(selectedAsset)"
      class="beauty-material-dialog"
      width="768px"
      top="6vh"
      append-to-body
      @update:model-value="setSelectedAssetVisible"
    >
      <template #header>
        <div class="flex items-center gap-2 text-lg font-bold text-[#242124]">
          <Icon
            :icon="selectedAsset?.mediaKind === 'audio' ? 'lucide:file-audio' : 'lucide:file-video'"
            :size="20"
            class="text-[#515BCB]"
          />采集转写详情
        </div>
      </template>
      <div v-if="selectedAsset" class="space-y-5">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg bg-[#F8F5F3] p-3">
            <div class="text-[11px] text-[#766F73]">媒体来源</div>
            <div class="mt-1 text-sm font-bold text-[#242124]">
              {{ mediaLabel(selectedAsset.mediaKind) }} · {{ selectedAsset.fileName }}
            </div>
            <div class="mt-1 text-xs text-[#766F73]"
              >时长 {{ formatDuration(selectedAsset.durationSec) }}</div
            >
          </div>
          <div class="rounded-lg bg-[#F8F5F3] p-3">
            <div class="text-[11px] text-[#766F73]">采集目标</div>
            <div class="mt-1 text-sm font-bold text-[#242124]">
              {{ selectedAsset.productOrScenario }}
            </div>
            <div class="mt-1 text-xs text-[#766F73]">
              {{ selectedAsset.region }} · {{ selectedAsset.submittedAt }}
            </div>
          </div>
          <div class="rounded-lg bg-[#F8F5F3] p-3">
            <div class="text-[11px] text-[#766F73]">处理状态</div>
            <div class="mt-1">
              <LibraryBadge :tone="assetStatusMeta[selectedAsset.status].className">{{
                assetStatusMeta[selectedAsset.status].label
              }}</LibraryBadge>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-[#E5DED8] bg-[#171518] p-4 text-white">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-bold">原始{{ mediaLabel(selectedAsset.mediaKind) }}</div>
              <div class="mt-1 text-xs text-white/60">仅对有权限的审核人员开放播放</div>
            </div>
            <el-button
              size="small"
              :disabled="selectedAsset.mediaKind !== 'video'"
              class="!border-white/20 !bg-white/10 !text-white hover:!bg-white/15"
              @click="openVideoFromDetail"
            >
              <Icon icon="lucide:play" :size="16" class="mr-1.5" />播放原始媒体
            </el-button>
          </div>
          <div
            class="mt-4 flex h-20 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-xs text-white/50"
          >
            <Icon
              :icon="selectedAsset.mediaKind === 'video' ? 'lucide:video' : 'lucide:audio-lines'"
              :size="20"
              class="mr-2"
            />{{ selectedAsset.fileName }}
          </div>
        </div>

        <section>
          <div class="flex items-center gap-2 text-sm font-bold text-[#242124]">
            <Icon icon="lucide:audio-lines" :size="16" class="text-[#515BCB]" />完整转写文本
          </div>
          <div
            data-i18n-skip="true"
            class="mt-3 whitespace-pre-line rounded-lg border border-[#E9E4DF] bg-[#FCFAF8] p-4 text-sm leading-7 text-[#5D565A]"
          >
            {{ displayAssetTranscript(selectedAsset) }}
          </div>
        </section>

        <section
          v-if="getAssetAnalysis(selectedAsset) || selectedAsset.aiCommentary"
          class="rounded-lg border border-[#D8DEFF] bg-[#EEF1FF] p-4"
        >
          <div class="flex items-center gap-2 text-sm font-bold text-[#515BCB]">
            <Icon icon="lucide:sparkles" :size="16" />AI 点评
          </div>
          <p class="mt-2 text-sm leading-relaxed text-[#515BCB]">
            {{ getAssetAnalysis(selectedAsset)?.aiCommentary ?? selectedAsset.aiCommentary }}
          </p>
        </section>

        <section>
          <div class="text-sm font-bold text-[#242124]">提取洞察</div>
          <div class="mt-3 space-y-2">
            <div
              v-for="insight in getAssetAnalysis(selectedAsset)?.insights ??
              selectedAsset.insights ??
              []"
              :key="insight"
              class="flex gap-2 rounded-lg border border-[#E9E4DF] bg-white p-3 text-sm text-[#5D565A]"
            >
              <Icon
                icon="lucide:check-circle-2"
                :size="16"
                class="mt-0.5 shrink-0 text-[#3B8F72]"
              />
              {{ insight }}
            </div>
            <div
              v-if="
                !(getAssetAnalysis(selectedAsset)?.insights ?? selectedAsset.insights ?? []).length
              "
              class="rounded-lg border border-dashed border-[#E5DED8] p-3 text-sm text-[#766F73]"
            >
              分析完成后会在这里显示洞察。
            </div>
          </div>
        </section>

        <div v-for="segment in getAssetAnalysis(selectedAsset)?.segments ?? []" :key="segment.id">
          <div class="rounded-lg border border-[#E9E4DF] bg-[#FCFAF8] p-3">
            <div class="flex items-center gap-2 text-[11px] font-bold text-[#766F73]">
              <Icon icon="lucide:play" :size="14" class="text-[#515BCB]" />证据片段
              {{ formatTime(segment.startSec) }} - {{ formatTime(segment.endSec) }}
            </div>
            <p
              data-i18n-skip="true"
              class="mt-2 line-clamp-3 text-xs leading-relaxed text-[#5D565A]"
            >
              {{ segment.transcript }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-2 border-t border-[#E9E4DF] pt-4">
          <el-button @click="selectedAsset = null">关闭</el-button>
          <template v-if="hasGoldenSource(selectedAsset.id)">
            <el-button disabled class="!border-[#BFDCCF] !bg-[#EEF8F4] !text-[#3B8F72]">
              <Icon icon="lucide:shield-check" :size="16" class="mr-1.5" />已加入黄金素材
            </el-button>
            <el-button
              v-if="canReview"
              class="!border-[#F1CFCA] !text-[#B75147] hover:!bg-[#FFF4F2] hover:!text-[#A8443A]"
              @click="removeAssetFromGolden(selectedAsset.id)"
            >
              <Icon icon="lucide:archive-x" :size="16" class="mr-1.5" />从黄金素材移出
            </el-button>
          </template>
          <el-button
            v-else
            :disabled="!canReview || selectedAsset.status !== 'ready'"
            class="!border-[#515BCB] !bg-[#515BCB] !text-white hover:!bg-[#444DB2]"
            @click="openReviewForAsset(selectedAsset)"
          >
            <Icon icon="lucide:shield-check" :size="16" class="mr-1.5" />{{
              canReview ? '加入黄金素材' : canSuggest ? '建议入库' : '无操作权限'
            }}
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- AI 推荐素材详情 -->
    <el-dialog
      :model-value="Boolean(selectedRecommendation)"
      class="beauty-material-dialog"
      width="672px"
      top="7vh"
      append-to-body
      @update:model-value="setSelectedRecommendationVisible"
    >
      <template #header>
        <div class="flex items-center gap-2 text-lg font-bold text-[#242124]">
          <Icon icon="lucide:sparkles" :size="20" class="text-[#6974E8]" />AI 推荐素材详情
        </div>
      </template>
      <div v-if="selectedRecommendation" class="space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <LibraryBadge :tone="recommendationStatusMeta.recommended.className"
            >AI 推荐</LibraryBadge
          >
          <span class="text-xs text-[#766F73]"
            >来源：{{ getRecommendationTarget(selectedRecommendation) }} ·
            {{ selectedRecommendation.targetLabel }}</span
          >
        </div>
        <section>
          <div class="text-sm font-bold text-[#242124]">推荐素材话术</div>
          <p
            data-i18n-skip="true"
            class="mt-3 rounded-lg border border-[#E9E4DF] bg-[#FCFAF8] p-4 text-sm leading-7 text-[#3F3A3D]"
          >
            {{ selectedRecommendation.transcript }}
          </p>
        </section>
        <section class="rounded-lg border border-[#D8DEFF] bg-[#EEF1FF] p-4">
          <div class="text-sm font-bold text-[#515BCB]">AI 总结</div>
          <p class="mt-2 text-sm leading-relaxed text-[#515BCB]">
            {{ selectedRecommendation.aiSummary }}
          </p>
        </section>
        <section>
          <div class="text-sm font-bold text-[#242124]">AI 推荐理由</div>
          <p class="mt-2 text-sm leading-relaxed text-[#5D565A]">
            {{ selectedRecommendation.recommendationReason }}
          </p>
        </section>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#766F73]">
          <span
            ><Icon icon="lucide:map-pin" :size="14" class="mr-1 inline text-[#9A9396]" />{{
              selectedRecommendation.region
            }}</span
          >
          <span>推荐时间：{{ selectedRecommendation.createdAt }}</span>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#E9E4DF] pt-4">
          <el-button @click="selectedRecommendation = null">关闭</el-button>
          <el-button
            v-if="canReview"
            class="!border-[#515BCB] !bg-[#515BCB] !text-white hover:!bg-[#444DB2]"
            @click="openReviewForRecommendation(selectedRecommendation)"
          >
            <Icon icon="lucide:shield-check" :size="16" class="mr-1.5" />进入黄金素材
          </el-button>
          <el-button class="!border-[#E5DED8] !text-[#5D565A]" @click="openDismissFromDetail">
            <Icon icon="lucide:circle-off" :size="16" class="mr-1.5" />不再推荐
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 确认进入黄金素材 -->
    <el-dialog
      :model-value="Boolean(reviewSource)"
      class="beauty-material-dialog"
      width="672px"
      top="6vh"
      append-to-body
      @update:model-value="setReviewVisible"
    >
      <template #header>
        <div class="flex items-center gap-2 text-lg font-bold text-[#242124]">
          <Icon icon="lucide:shield-check" :size="20" class="text-[#515BCB]" />确认进入黄金素材
        </div>
      </template>
      <div v-if="reviewSource" class="space-y-4">
        <div
          class="rounded-lg border border-[#E9E4DF] bg-[#FCFAF8] p-3 text-xs leading-relaxed text-[#766F73]"
        >
          人工确认后，这条转写会进入黄金素材，并可被数字人顾客、场景剧本和金句库引用。
        </div>
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-[#766F73]">黄金素材标题</span>
          <input v-model="reviewForm.title" :class="fieldClass" />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-[#766F73]">AI 总结 / 人工摘要</span>
          <textarea
            v-model="reviewForm.summary"
            rows="3"
            :class="`${fieldClass} resize-none`"
          ></textarea>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-[#766F73]">纳入黄金素材的话术</span>
          <textarea
            v-model="reviewForm.transcript"
            rows="5"
            :class="`${fieldClass} resize-none leading-relaxed`"
          ></textarea>
          <span class="mt-1 block text-[11px] text-[#9A9396]"
            >可直接保留完整转写，也可以编辑为更短的精选片段。</span
          >
        </label>

        <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-[#766F73]">归入专辑</span>
            <select v-model="reviewForm.albumId" aria-label="选择黄金素材专辑" :class="fieldClass">
              <option value="">选择专辑</option>
              <option v-for="album in albums" :key="album.id" :value="album.id">
                {{ album.name }}
              </option>
            </select>
          </label>
          <el-button
            class="!h-9 !border-[#D8DEFF] !text-[#515BCB] hover:!bg-[#EEF1FF]"
            @click="openCreateAlbum"
          >
            <Icon icon="lucide:folder-plus" :size="16" class="mr-1.5" />新建专辑
          </el-button>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-[#766F73]">发布范围</span>
            <select v-model="reviewForm.scope" :class="fieldClass">
              <option value="全国共享">全国共享</option>
              <option value="区域可用">仅本区域可用</option>
            </select>
          </label>
          <label class="flex items-center gap-2 pt-6 text-xs font-medium text-[#5D565A]">
            <input
              v-model="reviewForm.preserveFull"
              type="checkbox"
              class="h-4 w-4 accent-[#515BCB]"
            />保留完整转写快照
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#E9E4DF] pt-4">
          <el-button @click="reviewSource = null">取消</el-button>
          <el-button
            :disabled="
              !reviewForm.title.trim() ||
              !reviewForm.summary.trim() ||
              !reviewForm.transcript.trim() ||
              !reviewForm.albumId
            "
            class="!border-[#515BCB] !bg-[#515BCB] !text-white hover:!bg-[#444DB2]"
            @click="confirmPromote"
          >
            确认进入黄金素材
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 新建专辑 -->
    <el-dialog
      v-model="albumDialogOpen"
      class="beauty-material-dialog"
      width="448px"
      append-to-body
      @closed="resetAlbumForm"
    >
      <template #header>
        <div class="flex items-center gap-2 text-lg font-bold text-[#242124]">
          <Icon icon="lucide:folder-plus" :size="20" class="text-[#515BCB]" />新建专辑
        </div>
      </template>
      <div class="space-y-4">
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-[#766F73]">专辑名称</span>
          <input
            v-model="albumForm.name"
            required
            autofocus
            placeholder="例如：高频异议处理"
            :class="fieldClass"
            @input="albumFormError = ''"
          />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-[#766F73]"
            >专辑说明 <span class="font-normal text-[#9A9396]">（选填）</span></span
          >
          <textarea
            v-model="albumForm.description"
            rows="3"
            placeholder="说明这组素材适合什么场景或产品"
            :class="`${fieldClass} resize-none`"
          ></textarea>
        </label>
        <p v-if="albumFormError" role="alert" class="text-xs font-medium text-[#B34D4D]">
          {{ albumFormError }}
        </p>
        <div class="flex justify-end gap-2 border-t border-[#E9E4DF] pt-4">
          <el-button @click="albumDialogOpen = false">取消</el-button>
          <el-button
            class="!border-[#515BCB] !bg-[#515BCB] !text-white hover:!bg-[#444DB2]"
            @click="createAlbum"
          >
            <Icon icon="lucide:folder-plus" :size="16" class="mr-1.5" />创建专辑
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 不再推荐 -->
    <el-dialog
      :model-value="Boolean(dismissRecommendation)"
      class="beauty-material-dialog"
      width="448px"
      append-to-body
      @update:model-value="setDismissVisible"
    >
      <template #header>
        <div class="flex items-center gap-2 text-lg font-bold text-[#3F3A3D]">
          <Icon icon="lucide:circle-off" :size="20" class="text-[#766F73]" />不再推荐
        </div>
      </template>
      <div v-if="dismissRecommendation" class="space-y-4">
        <p class="text-sm leading-relaxed text-[#5D565A]">
          这条 AI 推荐会从推荐列表移除，但原始采集和转写仍会保留在“全部采集”。
        </p>
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-[#766F73]">备注原因（选填）</span>
          <textarea
            v-model="dismissReason"
            rows="3"
            placeholder="例如：表达不完整、场景不具备复用性"
            :class="`${fieldClass} resize-none`"
          ></textarea>
        </label>
        <div class="flex justify-end gap-2 border-t border-[#E9E4DF] pt-4">
          <el-button @click="dismissRecommendation = null">取消</el-button>
          <el-button
            class="!border-[#5D565A] !bg-[#5D565A] !text-white hover:!bg-[#3F3A3D]"
            @click="confirmDismissRecommendation"
          >
            确认不再推荐
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:global(.beauty-material-dialog .el-dialog__header) {
  margin: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e9e4df;
}

:global(.beauty-material-dialog .el-dialog__body) {
  padding: 20px;
}
</style>
