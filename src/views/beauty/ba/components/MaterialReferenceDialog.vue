<script setup lang="ts">
/**
 * 引用素材弹窗（原型 components/MaterialReferenceDialog.tsx）。
 * 用于数字人顾客 / 场景剧本 / 金句库从「黄金素材」中挑选已审核话术并生成可编辑草稿。
 */
import type { GoldenMaterial, MaterialRecommendation } from '@/beauty/types'
import {
  MOCK_GOLDEN_ALBUMS,
  MOCK_GOLDEN_MATERIALS,
  MOCK_MATERIAL_RECOMMENDATIONS
} from '@/beauty/lib/materialLibraryData'
import MaterialOptionCard from './MaterialOptionCard.vue'
import { materialTargetKind } from './materialReference'

type MaterialReferenceTarget = 'avatar' | 'script' | 'quote'
type QuoteReferenceTab = 'recommended' | 'albums'

const ALL_ALBUMS_ID = '__all__'
const UNCATEGORIZED_ALBUM_ID = '__uncategorized__'

defineOptions({ name: 'BeautyMaterialReferenceDialog' })

const props = defineProps<{
  modelValue: boolean
  target: MaterialReferenceTarget
  quoteTargetLabel?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'apply', materials: GoldenMaterial[]): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const targetConfig: Record<MaterialReferenceTarget, { title: string; description: string }> = {
  avatar: {
    title: '为数字人顾客引用素材',
    description: '选取已审核的黄金话术，提炼顾客需求、顾虑、表达方式和互动流程，生成可编辑草稿。'
  },
  script: {
    title: '为场景剧本引用素材',
    description: '选取已审核的黄金话术，提炼场景背景、关键转折和 BA 行动，生成可编辑草稿。'
  },
  quote: {
    title: '为金句库引用素材',
    description: '选取已审核的黄金话术；每条素材会生成一条可继续编辑的金句草稿。'
  }
}

const config = computed(() => targetConfig[props.target])

/** 仅展示已审核、当前可用的黄金素材。 */
const materials = MOCK_GOLDEN_MATERIALS.filter((material) => material.status === 'active')

const selectedIds = ref<string[]>([])
const quoteReferenceTab = ref<QuoteReferenceTab>('recommended')
const selectedAlbumId = ref(ALL_ALBUMS_ID)

const normalizeName = (value?: string) => value?.trim().toLocaleLowerCase() ?? ''

const normalizedProductName = computed(() => normalizeName(props.quoteTargetLabel))

watch(
  () => [props.modelValue, props.target] as const,
  ([open]) => {
    if (!open) return
    selectedIds.value = []
    quoteReferenceTab.value = 'recommended'
    selectedAlbumId.value = ALL_ALBUMS_ID
  }
)

const recommendationsBySourceId = new Map<string, MaterialRecommendation>(
  MOCK_MATERIAL_RECOMMENDATIONS.map((recommendation) => [
    recommendation.mediaAssetId,
    recommendation
  ])
)

const recommendedMaterials = computed(() => {
  const ranked = materials
    .filter((material) => materialTargetKind(material) === 'product')
    .flatMap((material) => {
      const recommendation = material.sourceMediaAssetId
        ? recommendationsBySourceId.get(material.sourceMediaAssetId)
        : undefined
      if (!recommendation) return []
      const matchesProduct =
        Boolean(normalizedProductName.value) &&
        (normalizeName(material.targetLabel) === normalizedProductName.value ||
          normalizeName(recommendation.targetLabel) === normalizedProductName.value)
      return [{ material, recommendation, matchesProduct }]
    })
    .sort(
      (left, right) =>
        Number(right.matchesProduct) - Number(left.matchesProduct) ||
        Number(right.material.type === 'quote') - Number(left.material.type === 'quote') ||
        right.recommendation.createdAt.localeCompare(left.recommendation.createdAt) ||
        right.material.reviewedAt.localeCompare(left.material.reviewedAt)
    )

  const targetMatches = ranked.filter((item) => item.matchesProduct)
  return targetMatches.length ? targetMatches : ranked
})

const albumCounts = computed(() => {
  const counts = new Map<string, number>()
  materials.forEach((material) => {
    const albumId = material.albumId ?? UNCATEGORIZED_ALBUM_ID
    counts.set(albumId, (counts.get(albumId) ?? 0) + 1)
  })
  return counts
})

const manualMaterials = computed(() =>
  materials.filter((material) => {
    if (selectedAlbumId.value === ALL_ALBUMS_ID) return true
    if (selectedAlbumId.value === UNCATEGORIZED_ALBUM_ID) return !material.albumId
    return material.albumId === selectedAlbumId.value
  })
)

const toggleMaterial = (id: string) => {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

const apply = () => {
  const selected = materials.filter((material) => selectedIds.value.includes(material.id))
  if (!selected.length) return
  emit('apply', selected)
  visible.value = false
}

const albumFilterClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
    active
      ? 'border-[#515BCB] bg-[#EEF1FF] text-[#515BCB]'
      : 'border-[#E5DED8] bg-white text-[#766F73] hover:border-[#C9C3C0] hover:text-[#3F3A3D]'
  }`
</script>

<template>
  <el-dialog
    v-model="visible"
    class="beauty-material-ref-dialog"
    width="896px"
    top="6vh"
    append-to-body
  >
    <template #header>
      <div class="flex items-start gap-3 pr-8">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF1FF] text-[#515BCB]"
        >
          <Icon icon="lucide:book-open-check" :size="20" />
        </div>
        <div>
          <div class="text-lg font-bold text-[#242124]">{{ config.title }}</div>
          <p class="mt-1 text-xs leading-relaxed text-[#766F73]">{{ config.description }}</p>
        </div>
      </div>
    </template>

    <div class="flex h-[68vh] min-h-0 flex-col">
      <div class="min-h-0 flex-1 overflow-y-auto bg-[#F8F5F3] px-6 py-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="text-xs font-bold text-[#766F73]">仅展示已审核、当前可用的黄金素材</div>
          <span
            data-i18n-skip="true"
            class="inline-flex items-center rounded-md border border-[#D8DEFF] bg-[#EEF1FF] px-2.5 py-0.5 text-xs font-semibold text-[#515BCB]"
            >已选 {{ selectedIds.length }} 条</span
          >
        </div>

        <template v-if="target === 'quote'">
          <div class="flex h-10 w-full justify-start gap-1 border-b border-[#E9E4DF]">
            <button
              type="button"
              class="inline-flex h-10 flex-none items-center gap-1.5 rounded-none border-b-2 px-3 text-xs font-bold transition-colors"
              :class="
                quoteReferenceTab === 'recommended'
                  ? 'border-[#515BCB] text-[#515BCB]'
                  : 'border-transparent text-[#766F73] hover:text-[#3F3A3D]'
              "
              @click="quoteReferenceTab = 'recommended'"
            >
              <Icon icon="lucide:sparkles" :size="14" />AI 推荐引用素材
            </button>
            <button
              type="button"
              class="inline-flex h-10 flex-none items-center gap-1.5 rounded-none border-b-2 px-3 text-xs font-bold transition-colors"
              :class="
                quoteReferenceTab === 'albums'
                  ? 'border-[#515BCB] text-[#515BCB]'
                  : 'border-transparent text-[#766F73] hover:text-[#3F3A3D]'
              "
              @click="quoteReferenceTab = 'albums'"
            >
              <Icon icon="lucide:folder" :size="14" />从专辑手动选择
            </button>
          </div>

          <div v-if="quoteReferenceTab === 'recommended'" class="mt-4">
            <div
              class="mb-4 rounded-lg border border-[#D8DEFF] bg-[#F7F8FF] px-3 py-2 text-xs leading-relaxed text-[#515BCB]"
            >
              <span class="font-bold">AI 优先排序：</span
              >{{
                quoteTargetLabel?.trim()
                  ? `优先展示与“${quoteTargetLabel.trim()}”匹配的已审核产品素材。`
                  : '优先展示已审核产品素材。'
              }}
            </div>
            <div v-if="recommendedMaterials.length" class="space-y-3">
              <MaterialOptionCard
                v-for="item in recommendedMaterials"
                :key="item.material.id"
                :material="item.material"
                :selected="selectedIds.includes(item.material.id)"
                :recommendation="item.recommendation"
                @toggle="toggleMaterial"
              />
            </div>
            <div
              v-else
              class="rounded-lg border border-dashed border-[#E5DED8] bg-white px-5 py-10 text-center text-sm text-[#766F73]"
            >
              当前没有可引用的 AI 推荐素材，可切换到“从专辑手动选择”。
            </div>
          </div>

          <div v-else class="mt-4">
            <div class="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                :aria-pressed="selectedAlbumId === ALL_ALBUMS_ID"
                :class="albumFilterClass(selectedAlbumId === ALL_ALBUMS_ID)"
                @click="selectedAlbumId = ALL_ALBUMS_ID"
              >
                <Icon icon="lucide:folder" :size="14" />全部专辑<span
                  class="text-[11px] opacity-70"
                  >{{ materials.length }}</span
                >
              </button>
              <button
                v-for="album in MOCK_GOLDEN_ALBUMS"
                :key="album.id"
                type="button"
                :aria-pressed="selectedAlbumId === album.id"
                :class="albumFilterClass(selectedAlbumId === album.id)"
                @click="selectedAlbumId = album.id"
              >
                <Icon icon="lucide:folder" :size="14" />{{ album.name
                }}<span class="text-[11px] opacity-70">{{ albumCounts.get(album.id) ?? 0 }}</span>
              </button>
              <button
                v-if="(albumCounts.get(UNCATEGORIZED_ALBUM_ID) ?? 0) > 0"
                type="button"
                :aria-pressed="selectedAlbumId === UNCATEGORIZED_ALBUM_ID"
                :class="albumFilterClass(selectedAlbumId === UNCATEGORIZED_ALBUM_ID)"
                @click="selectedAlbumId = UNCATEGORIZED_ALBUM_ID"
              >
                <Icon icon="lucide:folder" :size="14" />未分类<span
                  class="text-[11px] opacity-70"
                  >{{ albumCounts.get(UNCATEGORIZED_ALBUM_ID) }}</span
                >
              </button>
            </div>
            <div v-if="manualMaterials.length" class="space-y-3">
              <MaterialOptionCard
                v-for="material in manualMaterials"
                :key="material.id"
                :material="material"
                :selected="selectedIds.includes(material.id)"
                @toggle="toggleMaterial"
              />
            </div>
            <div
              v-else
              class="rounded-lg border border-dashed border-[#E5DED8] bg-white px-5 py-10 text-center text-sm text-[#766F73]"
            >
              当前专辑暂无可引用素材
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="materials.length" class="space-y-3">
            <MaterialOptionCard
              v-for="material in materials"
              :key="material.id"
              :material="material"
              :selected="selectedIds.includes(material.id)"
              @toggle="toggleMaterial"
            />
          </div>
          <div
            v-else
            class="rounded-lg border border-dashed border-[#E5DED8] bg-white px-5 py-10 text-center text-sm text-[#766F73]"
          >
            当前没有可引用的黄金素材
          </div>
        </template>
      </div>

      <div
        class="flex items-center justify-between gap-3 border-t border-[#E9E4DF] bg-white px-6 py-4"
      >
        <div class="flex items-center gap-2 text-xs text-[#766F73]">
          <Icon icon="lucide:sparkles" :size="16" class="text-[#6974E8]" />
          引用后会生成可编辑草稿，并保留证据与版本来源。
        </div>
        <el-button
          :disabled="!selectedIds.length"
          class="!border-[#515BCB] !bg-[#515BCB] !text-white hover:!bg-[#444DB2]"
          @click="apply"
        >
          <Icon icon="lucide:clock-3" :size="16" class="mr-1.5" />生成编辑草稿
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style lang="scss" scoped>
:global(.beauty-material-ref-dialog .el-dialog__header) {
  margin: 0;
  padding: 20px 24px;
  border-bottom: 1px solid #e9e4df;
  background: #fff;
}

:global(.beauty-material-ref-dialog .el-dialog__body) {
  padding: 0;
}

:global(.beauty-material-ref-dialog .el-dialog__footer) {
  padding: 0;
}
</style>
