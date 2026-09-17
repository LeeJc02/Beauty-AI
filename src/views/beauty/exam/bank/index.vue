<script setup lang="ts">
/**
 * 题库管理（原型 `src/pages/ExamBank.tsx`，原型最大的一页）。
 *
 * 结构：左侧筛选树 + 常用标签；右侧搜索/筛选、批量操作、题目列表；右侧滑出题目编辑抽屉；
 * 另有「排查重复题目」「批量编辑标签」「标签管理」三个弹窗。
 *
 * 题库读写全部走 `useQuestionBank()`；答案区复用 `components/QuestionAnswerFields.vue`。
 */
import {
  createQuestionId,
  DEFAULT_FILTERS,
  DIFFICULTY_LABELS,
  filterQuestions,
  findProduct,
  findProductLine,
  GENERAL_CAPABILITY_LINE_ID,
  getQuestionAnswerText,
  getQuestionTagNames,
  getTagNameKey,
  MAX_TAGS_PER_QUESTION,
  mergeTags,
  normalizeQuestionForType,
  normalizeTagName,
  parseTagInput,
  QUESTION_TYPE_LABELS,
  QUESTION_TAXONOMY,
  STATUS_LABELS,
  type QuestionBankItem,
  type QuestionDifficulty,
  type QuestionFilters,
  type QuestionStatus,
  type QuestionType
} from '@/beauty/lib/questionBank'
import { aiActionTone } from '@/beauty/lib/visualTones'
import { useBeautyI18n, useQuestionBank } from '@/beauty/composables'
import QuestionAnswerFields from '../components/QuestionAnswerFields.vue'

defineOptions({ name: 'BeautyExamBank' })

const { t } = useBeautyI18n()
const {
  questions,
  tags,
  addQuestions,
  updateQuestion,
  removeQuestion,
  bulkAddTags,
  bulkSetStatus,
  generateVariants,
  addTag,
  renameTag,
  deleteTag
} = useQuestionBank()

const statusBadgeClass: Record<QuestionStatus, string> = {
  active: 'bg-[#EEF8F4] text-[#2F735C] border-[#BFDCCF]',
  pending_review: 'bg-[#FFF7EA] text-[#8B621F] border-[#E8CCA0]',
  draft: 'bg-slate-100 text-[#5D565A] border-slate-200',
  archived: 'bg-[#F1ECE8] text-[#766F73] border-[#E5DED8]'
}

const typeToneClass: Record<QuestionType, string> = {
  single_choice: 'bg-rose-50 text-rose-700 border-rose-200',
  multiple_choice: 'bg-[#EEF8F4] text-[#2F735C] border-[#BFDCCF]',
  true_false: 'bg-[#FFF7EA] text-[#8B621F] border-[#E8CCA0]',
  short_answer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  dropdown: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  ordering: 'bg-amber-50 text-amber-700 border-amber-200',
  checkbox_grid: 'bg-violet-50 text-violet-700 border-violet-200',
  file_upload: 'bg-slate-100 text-slate-700 border-slate-200'
}

const TAG_MANAGE_PAGE_SIZE = 60
type TagSortMode = 'usage_desc' | 'usage_asc' | 'name_asc' | 'unused_first'
type TreeFilterKey = 'brandIds' | 'productLineIds' | 'categoryIds'
type TreeDraftFilters = Pick<QuestionFilters, TreeFilterKey>
type FilterTreeSectionId = 'brand' | 'productLine' | 'category' | 'generalCapability'

const emptyTreeFilters = (): TreeDraftFilters => ({
  brandIds: [],
  productLineIds: [],
  categoryIds: []
})

const copyTreeFilters = (filters: TreeDraftFilters): TreeDraftFilters => ({
  brandIds: [...filters.brandIds],
  productLineIds: [...filters.productLineIds],
  categoryIds: [...filters.categoryIds]
})

const countTreeSelections = (filters: TreeDraftFilters) =>
  filters.brandIds.length + filters.productLineIds.length + filters.categoryIds.length

const sameTreeSelections = (a: TreeDraftFilters, b: TreeDraftFilters) => {
  const sameValues = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value) => right.includes(value))
  return (
    sameValues(a.brandIds, b.brandIds) &&
    sameValues(a.productLineIds, b.productLineIds) &&
    sameValues(a.categoryIds, b.categoryIds)
  )
}

const getVariantGenerationStep = (progress: number) => {
  if (progress < 25) return '读取旧题题干、答案和分类标签...'
  if (progress < 50) return '围绕同一考点生成不同问法...'
  if (progress < 75) return '继承题目分类、标签和来源信息...'
  if (progress < 100) return '检查相似度并写入待审核列表...'
  return '生成完成，准备进入待审核'
}

const blankQuestion = (): QuestionBankItem =>
  normalizeQuestionForType({
    id: createQuestionId('manual'),
    type: 'single_choice',
    stem: '',
    options: [
      { id: 'a', label: 'A', text: '' },
      { id: 'b', label: 'B', text: '' },
      { id: 'c', label: 'C', text: '' },
      { id: 'd', label: 'D', text: '' }
    ],
    correctOptionIds: ['a'],
    productLineId: QUESTION_TAXONOMY.productLines[0]?.id,
    productId: QUESTION_TAXONOMY.productLines[0]?.products[0]?.id,
    tagIds: [],
    customTags: [],
    difficulty: 'basic',
    sourceFile: '手动录入',
    status: 'draft'
  })

/** 深拷贝题目（编辑抽屉里改的是副本，取消不留痕）。 */
const cloneQuestion = (question: QuestionBankItem): QuestionBankItem => ({
  ...question,
  options: question.options?.map((option) => ({ ...option })),
  tagIds: [...question.tagIds],
  customTags: [...question.customTags],
  correctOptionIds: question.correctOptionIds ? [...question.correctOptionIds] : undefined,
  gridRows: question.gridRows?.map((row) => ({ ...row })),
  gridColumns: question.gridColumns?.map((column) => ({ ...column })),
  gridCorrectAnswers: question.gridCorrectAnswers?.map((answer) => ({ ...answer })),
  allowedUploadTypes: question.allowedUploadTypes ? [...question.allowedUploadTypes] : undefined,
  attachments: question.attachments?.map((attachment) => ({ ...attachment }))
})

const countByProductLine = (list: QuestionBankItem[], productLineId: string) =>
  list.filter(
    (question) => question.productLineId === productLineId && question.status !== 'archived'
  ).length

const countByBrand = (list: QuestionBankItem[], brandId: string) =>
  list.filter((question) => {
    const product = findProduct(question.productLineId, question.productId)
    return product?.brandId === brandId && question.status !== 'archived'
  }).length

const countByCategory = (list: QuestionBankItem[], categoryId: string) =>
  list.filter((question) => {
    const product = findProduct(question.productLineId, question.productId)
    return product?.categoryId === categoryId && question.status !== 'archived'
  }).length

/* -------------------------------------------------- 状态 */
const filters = ref<QuestionFilters>({ ...DEFAULT_FILTERS })
const treeDraft = ref<TreeDraftFilters>(copyTreeFilters(DEFAULT_FILTERS))
const collapsedTreeSections = ref<Record<FilterTreeSectionId, boolean>>({
  brand: false,
  productLine: false,
  category: false,
  generalCapability: false
})
const selectedIds = ref<Set<string>>(new Set())
const toast = ref('')
const tagDialog = ref(false)
const batchTags = ref('')
const tagManageDialog = ref(false)
const newTagName = ref('')
const tagSearch = ref('')
const tagSort = ref<TagSortMode>('usage_desc')
const tagPage = ref(1)
const tagDraftNames = ref<Record<string, string>>({})
const showDuplicates = ref(false)
const editingQuestion = ref<QuestionBankItem | null>(null)
const editingMode = ref<'create' | 'edit' | null>(null)
const customTagInput = ref('')
const variantGeneration = ref<{
  progress: number
  sourceCount: number
  targetCount: number
  step: string
} | null>(null)

let toastTimer: number | null = null
let variantTimer: number | null = null

watch(
  () => [filters.value.brandIds, filters.value.productLineIds, filters.value.categoryIds],
  () => {
    treeDraft.value = copyTreeFilters(filters.value)
  }
)

onBeforeUnmount(() => {
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  if (variantTimer !== null) window.clearInterval(variantTimer)
})

/* -------------------------------------------------- 派生数据 */
const filteredQuestions = computed(() =>
  filterQuestions(questions.value, filters.value, tags.value)
)
const allVisibleSelected = computed(
  () =>
    filteredQuestions.value.length > 0 &&
    filteredQuestions.value.every((question) => selectedIds.value.has(question.id))
)
const selectedQuestions = computed(() =>
  questions.value.filter((question) => selectedIds.value.has(question.id))
)
const pendingCount = computed(
  () => questions.value.filter((question) => question.status === 'pending_review').length
)

const productsForFilter = computed(() =>
  filters.value.productLineId === 'all'
    ? QUESTION_TAXONOMY.productLines.flatMap((line) => line.products)
    : findProductLine(filters.value.productLineId)?.products || []
)
const filterLineHasProducts = computed(
  () => filters.value.productLineId === 'all' || productsForFilter.value.length > 0
)
const editingProductLine = computed(() =>
  editingQuestion.value?.productLineId
    ? findProductLine(editingQuestion.value.productLineId)
    : undefined
)
const editingProducts = computed(() => editingProductLine.value?.products || [])
const editingUsesTagSubclassification = computed(
  () =>
    !!editingQuestion.value &&
    (editingQuestion.value.productLineId === GENERAL_CAPABILITY_LINE_ID ||
      editingProducts.value.length === 0)
)

const tagUsageById = computed(() => {
  const usage = new Map<string, number>(tags.value.map((tag) => [tag.id, 0]))
  const tagIdByName = new Map<string, string>(
    tags.value.map((tag) => [getTagNameKey(tag.name), tag.id])
  )

  questions.value.forEach((question) => {
    const usedInQuestion = new Set<string>()
    question.tagIds.forEach((tagId) => {
      if (usage.has(tagId)) usedInQuestion.add(tagId)
    })
    question.customTags.forEach((tagName) => {
      const tagId = tagIdByName.get(getTagNameKey(tagName))
      if (tagId) usedInQuestion.add(tagId)
    })
    usedInQuestion.forEach((tagId) => usage.set(tagId, (usage.get(tagId) || 0) + 1))
  })

  return usage
})

const tagRows = computed(() => {
  const keyword = tagSearch.value.trim().toLocaleLowerCase()
  return tags.value
    .map((tag) => ({ tag, usage: tagUsageById.value.get(tag.id) || 0 }))
    .filter((row) => !keyword || row.tag.name.toLocaleLowerCase().includes(keyword))
    .sort((a, b) => {
      if (tagSort.value === 'usage_asc')
        return a.usage - b.usage || a.tag.name.localeCompare(b.tag.name, 'zh-Hans-CN')
      if (tagSort.value === 'name_asc') return a.tag.name.localeCompare(b.tag.name, 'zh-Hans-CN')
      if (tagSort.value === 'unused_first')
        return (
          Number(a.usage > 0) - Number(b.usage > 0) ||
          a.tag.name.localeCompare(b.tag.name, 'zh-Hans-CN')
        )
      return b.usage - a.usage || a.tag.name.localeCompare(b.tag.name, 'zh-Hans-CN')
    })
})

const totalTagPages = computed(() =>
  Math.max(1, Math.ceil(tagRows.value.length / TAG_MANAGE_PAGE_SIZE))
)
const currentTagPage = computed(() => Math.min(tagPage.value, totalTagPages.value))
const tagPageStart = computed(() => (currentTagPage.value - 1) * TAG_MANAGE_PAGE_SIZE)
const visibleTagRows = computed(() =>
  tagRows.value.slice(tagPageStart.value, tagPageStart.value + TAG_MANAGE_PAGE_SIZE)
)

const sidebarTags = computed(() =>
  [...tags.value]
    .sort(
      (a, b) =>
        (tagUsageById.value.get(b.id) || 0) - (tagUsageById.value.get(a.id) || 0) ||
        a.name.localeCompare(b.name, 'zh-Hans-CN')
    )
    .slice(0, 18)
)

/** 原型固定挑 b1/b2 作为「相似题」演示样本。 */
const duplicates = computed(() => {
  const first = questions.value.find((question) => question.id === 'b1')
  const second = questions.value.find((question) => question.id === 'b2')
  if (!first || !second) return []
  return [{ targetId: second.id, similarToId: first.id, matchPercent: 85 }]
})

/** 重复题对照卡片（已有试题 / 新试题两份）。 */
const duplicatePairs = computed(() =>
  duplicates.value.map((duplicate) => ({
    ...duplicate,
    items: [
      {
        index: 0,
        question: questions.value.find((question) => question.id === duplicate.similarToId)
      },
      {
        index: 1,
        question: questions.value.find((question) => question.id === duplicate.targetId)
      }
    ]
  }))
)

const handleTagSearchInput = (value: string) => {
  tagSearch.value = value
  tagPage.value = 1
}

const handleTagSortChange = (value: string) => {
  tagSort.value = value as TagSortMode
  tagPage.value = 1
}

const appliedTreeFilters = computed(() => copyTreeFilters(filters.value))
const treeDraftSelectionCount = computed(() => countTreeSelections(treeDraft.value))
const treeDraftHasChanges = computed(
  () => !sameTreeSelections(treeDraft.value, appliedTreeFilters.value)
)
const isAllTreeActive = computed(() => treeDraftSelectionCount.value === 0)

const filterTreeSections = computed(() => [
  {
    id: 'brand' as FilterTreeSectionId,
    title: '品牌',
    items: QUESTION_TAXONOMY.brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      count: countByBrand(questions.value, brand.id),
      checked: treeDraft.value.brandIds.includes(brand.id),
      skipI18n: true
    }))
  },
  {
    id: 'productLine' as FilterTreeSectionId,
    title: '产品线',
    items: QUESTION_TAXONOMY.productLines
      .filter((line) => line.id !== GENERAL_CAPABILITY_LINE_ID)
      .map((line) => ({
        id: line.id,
        name: line.name,
        count: countByProductLine(questions.value, line.id),
        checked: treeDraft.value.productLineIds.includes(line.id),
        skipI18n: false
      }))
  },
  {
    id: 'category' as FilterTreeSectionId,
    title: '类别',
    items: QUESTION_TAXONOMY.categories.map((category) => ({
      id: category.id,
      name: category.name,
      count: countByCategory(questions.value, category.id),
      checked: treeDraft.value.categoryIds.includes(category.id),
      skipI18n: false
    }))
  },
  {
    id: 'generalCapability' as FilterTreeSectionId,
    title: '通用能力',
    items: [
      {
        id: GENERAL_CAPABILITY_LINE_ID,
        name: '通用能力题',
        count: countByProductLine(questions.value, GENERAL_CAPABILITY_LINE_ID),
        checked: treeDraft.value.productLineIds.includes(GENERAL_CAPABILITY_LINE_ID),
        skipI18n: false
      }
    ]
  }
])

/* -------------------------------------------------- 操作 */
const showToast = (message: string) => {
  toast.value = message
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 2200)
}

const updateFilters = (patch: Partial<QuestionFilters>) => {
  filters.value = { ...filters.value, ...patch }
  selectedIds.value = new Set()
}

const toggleSelect = (id: string) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const toggleSelectAll = () => {
  if (allVisibleSelected.value) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(filteredQuestions.value.map((question) => question.id))
}

const openCreatePanel = () => {
  editingQuestion.value = blankQuestion()
  editingMode.value = 'create'
  customTagInput.value = ''
}

const openEditPanel = (question: QuestionBankItem) => {
  editingQuestion.value = cloneQuestion(question)
  editingMode.value = 'edit'
  customTagInput.value = ''
}

const closeEditPanel = () => {
  editingQuestion.value = null
  editingMode.value = null
  customTagInput.value = ''
}

/** 编辑抽屉统一写入入口：先 patch 再按题型规范化。 */
const patchEditing = (patch: Partial<QuestionBankItem>) => {
  if (!editingQuestion.value) return
  editingQuestion.value = normalizeQuestionForType({ ...editingQuestion.value, ...patch })
}

const saveEditingQuestion = () => {
  if (!editingQuestion.value) return
  const normalized = normalizeQuestionForType(editingQuestion.value)
  if (editingMode.value === 'create') {
    addQuestions([normalized])
    showToast('已新增题目草稿')
  } else {
    updateQuestion(normalized)
    showToast(normalized.status === 'pending_review' ? '待审核题目已更新' : '题目已保存')
  }
  closeEditPanel()
}

const approveEditingQuestion = () => {
  if (!editingQuestion.value) return
  const normalized = normalizeQuestionForType({ ...editingQuestion.value, status: 'active' })
  if (editingMode.value === 'create') {
    addQuestions([normalized])
  } else {
    updateQuestion(normalized)
  }
  showToast('题目已审核入库')
  closeEditPanel()
}

const handleProductLineChange = (productLineId: string) => {
  patchEditing({
    productLineId,
    productId: findProductLine(productLineId)?.products[0]?.id
  })
}

const toggleTag = (tagId: string) => {
  if (!editingQuestion.value) return
  const tag = tags.value.find((item) => item.id === tagId)
  const selectedNames = getQuestionTagNames(editingQuestion.value, tags.value)
  if (
    !editingQuestion.value.tagIds.includes(tagId) &&
    selectedNames.length >= MAX_TAGS_PER_QUESTION
  ) {
    showToast(`每道题最多 ${MAX_TAGS_PER_QUESTION} 个标签`)
    return
  }
  const nextTags = editingQuestion.value.tagIds.includes(tagId)
    ? editingQuestion.value.tagIds.filter((id) => id !== tagId)
    : [...editingQuestion.value.tagIds, tagId]
  patchEditing({
    tagIds: nextTags,
    customTags: tag
      ? editingQuestion.value.customTags.filter(
          (name) => getTagNameKey(name) !== getTagNameKey(tag.name)
        )
      : editingQuestion.value.customTags
  })
}

const addCustomTag = () => {
  if (!editingQuestion.value) return
  const inputTags = parseTagInput(customTagInput.value).map(normalizeTagName).filter(Boolean)
  if (inputTags.length === 0) return
  const currentTagCount = getQuestionTagNames(editingQuestion.value, tags.value).length

  if (currentTagCount >= MAX_TAGS_PER_QUESTION) {
    showToast(`每道题最多 ${MAX_TAGS_PER_QUESTION} 个标签`)
    customTagInput.value = ''
    return
  }

  if (inputTags.length > MAX_TAGS_PER_QUESTION - currentTagCount) {
    showToast(`每道题最多 ${MAX_TAGS_PER_QUESTION} 个标签`)
  }

  let nextTagIds = [...editingQuestion.value.tagIds]
  let nextCustomTags = [...editingQuestion.value.customTags]
  let selectedNames = getQuestionTagNames(editingQuestion.value, tags.value)

  inputTags.forEach((name) => {
    if (selectedNames.length >= MAX_TAGS_PER_QUESTION) return
    const existing = tags.value.find((tag) => getTagNameKey(tag.name) === getTagNameKey(name))
    const alreadySelected = selectedNames.some(
      (tagName) => getTagNameKey(tagName) === getTagNameKey(name)
    )
    if (alreadySelected) return

    if (existing) {
      nextTagIds = Array.from(new Set([...nextTagIds, existing.id]))
    } else {
      nextCustomTags = mergeTags(nextCustomTags, [name])
    }
    selectedNames = mergeTags(selectedNames, [name])
  })

  patchEditing({ tagIds: nextTagIds, customTags: nextCustomTags })
  customTagInput.value = ''
}

const removeCustomTag = (tag: string) => {
  if (!editingQuestion.value) return
  const matchedCommonTag = tags.value.find(
    (item) => getTagNameKey(item.name) === getTagNameKey(tag)
  )
  patchEditing({
    tagIds: matchedCommonTag
      ? editingQuestion.value.tagIds.filter((id) => id !== matchedCommonTag.id)
      : editingQuestion.value.tagIds,
    customTags: editingQuestion.value.customTags.filter(
      (item) => getTagNameKey(item) !== getTagNameKey(tag)
    )
  })
}

const saveBatchTags = () => {
  const parsed = parseTagInput(batchTags.value)
  if (parsed.length === 0 || selectedIds.value.size === 0) return
  bulkAddTags(Array.from(selectedIds.value), parsed)
  tagDialog.value = false
  batchTags.value = ''
  selectedIds.value = new Set()
  showToast('批量标签已成功应用')
}

const openTagManageDialog = () => {
  tagDraftNames.value = Object.fromEntries(tags.value.map((tag) => [tag.id, tag.name]))
  newTagName.value = ''
  tagSearch.value = ''
  tagSort.value = 'usage_desc'
  tagPage.value = 1
  tagManageDialog.value = true
}

const handleAddCommonTag = () => {
  const normalized = normalizeTagName(newTagName.value)
  if (!normalized) return
  addTag(normalized)
  newTagName.value = ''
  showToast('标签已新增，同名会自动去重')
}

const handleRenameCommonTag = (tagId: string) => {
  const normalized = normalizeTagName(tagDraftNames.value[tagId] || '')
  if (!normalized) return
  renameTag(tagId, normalized)
  showToast('标签名称已更新')
}

const handleDeleteCommonTag = (tagId: string) => {
  if (filters.value.tagId === tagId) updateFilters({ tagId: 'all' })
  deleteTag(tagId)
  showToast('标签已删除，并已从题目上解除关联')
}

const handleBatchArchive = () => {
  if (selectedIds.value.size === 0) return
  bulkSetStatus(Array.from(selectedIds.value), 'archived')
  showToast(`已归档 ${selectedIds.value.size} 道题目`)
  selectedIds.value = new Set()
}

const handleGenerateVariants = (ids: string[]) => {
  if (ids.length === 0 || variantGeneration.value) return
  const sourceIds = [...ids]
  const targetCount = sourceIds.length * 3
  let progress = 8

  variantGeneration.value = {
    progress,
    sourceCount: sourceIds.length,
    targetCount,
    step: getVariantGenerationStep(progress)
  }

  variantTimer = window.setInterval(() => {
    progress = Math.min(progress + 18, 100)
    variantGeneration.value = {
      progress,
      sourceCount: sourceIds.length,
      targetCount,
      step: getVariantGenerationStep(progress)
    }

    if (progress >= 100) {
      if (variantTimer !== null) {
        window.clearInterval(variantTimer)
        variantTimer = null
      }
      window.setTimeout(() => {
        const variants = generateVariants(sourceIds)
        variantGeneration.value = null
        filters.value = {
          ...filters.value,
          status: 'pending_review',
          brandId: 'all',
          brandIds: [],
          productLineId: 'all',
          productLineIds: [],
          productId: 'all',
          categoryId: 'all',
          categoryIds: []
        }
        selectedIds.value = new Set(variants.map((question) => question.id))
        showToast(`AI 已生成 ${variants.length} 道待审核变体题`)
      }, 250)
    }
  }, 320)
}

const handleResolveDuplicate = (keepId: string, deleteId: string) => {
  removeQuestion(deleteId)
  showDuplicates.value = false
  const next = new Set(selectedIds.value)
  next.delete(deleteId)
  next.add(keepId)
  selectedIds.value = next
  showToast('成功合并重复题目！')
}

const clearTreeDraft = () => {
  treeDraft.value = emptyTreeFilters()
}

const toggleTreeDraftValue = (key: TreeFilterKey, id: string) => {
  const values = treeDraft.value[key]
  treeDraft.value = {
    ...treeDraft.value,
    [key]: values.includes(id) ? values.filter((value) => value !== id) : [...values, id]
  }
}

const toggleTreeSection = (sectionId: FilterTreeSectionId) => {
  collapsedTreeSections.value = {
    ...collapsedTreeSections.value,
    [sectionId]: !collapsedTreeSections.value[sectionId]
  }
}

const applyTreeFilters = () =>
  updateFilters({
    brandId: 'all',
    brandIds: [...treeDraft.value.brandIds],
    productLineId: 'all',
    productLineIds: [...treeDraft.value.productLineIds],
    productId: 'all',
    categoryId: 'all',
    categoryIds: [...treeDraft.value.categoryIds]
  })
</script>

<template>
  <div class="relative flex h-[calc(100vh-11.5rem)] min-h-[680px] flex-col gap-4 overflow-hidden">
    <div
      v-if="toast"
      class="beauty-toast-in absolute left-1/2 top-0 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#3B8F72] px-4 py-2 text-white shadow-lg"
    >
      <Icon icon="lucide:check-circle" :size="16" />
      <span class="text-sm font-bold">{{ toast }}</span>
    </div>

    <!-- 页头 -->
    <div class="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="flex items-center text-2xl font-bold text-[#1F1C1F]">
          <Icon icon="lucide:library" :size="24" class="mr-2 text-rose-600" />
          {{ t('题库管理') }}
        </h1>
        <p class="mt-1 text-sm text-[#766F73]">
          {{ t('统一管理通过生成、录入和 AI 派生的考核试题') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="inline-flex h-8 w-fit shrink-0 items-center justify-center rounded-full border border-[#E8CCA0] bg-[#FFF7EA] px-3 text-sm font-medium whitespace-nowrap text-[#8B621F]"
        >
          {{ t('待审核') }} {{ pendingCount }}
        </span>
        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E8CCA0] bg-[#FFF7EA] px-2.5 text-sm font-bold text-[#8B621F] transition-colors hover:bg-[#F7E6C8]"
          @click="showDuplicates = true"
        >
          <Icon icon="lucide:replace" :size="16" />
          {{ t('排查重复题目') }}
        </button>
        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700"
          @click="openCreatePanel"
        >
          <Icon icon="ep:plus" :size="16" />
          {{ t('新增题目') }}
        </button>
      </div>
    </div>

    <!-- AI 变体题生成进度 -->
    <div
      v-if="variantGeneration"
      class="shrink-0 rounded-xl border border-[#E8CCA0] bg-[#FFF7EA] px-4 py-3 shadow-sm"
    >
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <div
            class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#B9822B] ring-1 ring-[#E8CCA0]"
          >
            <Icon icon="lucide:loader-2" :size="20" class="animate-spin" />
          </div>
          <div class="min-w-0">
            <div class="text-sm font-bold text-[#242124]">{{ t('AI 正在生成变体题') }}</div>
            <p class="mt-0.5 text-xs leading-relaxed text-[#8B621F]">
              {{ t('基于') }} {{ variantGeneration.sourceCount }} {{ t('道旧题生成约') }}
              {{ variantGeneration.targetCount }}
              {{ t('道待审核题，完成后会自动筛选到“待审核”。') }}
            </p>
            <p class="mt-1 text-xs text-[#766F73]">{{ t(variantGeneration.step) }}</p>
          </div>
        </div>
        <div class="w-full shrink-0 md:w-72">
          <div class="mb-1 flex items-center justify-between text-[10px] font-bold text-[#8B621F]">
            <span>{{ t('生成进度') }}</span>
            <span>{{ variantGeneration.progress }}%</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-[#F7E6C8]">
            <div
              class="h-full bg-[#B9822B] transition-all"
              :style="{ width: `${variantGeneration.progress}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div class="bank-layout">
      <!-- 左侧筛选树 + 常用标签 -->
      <aside class="flex min-h-0 flex-col rounded-xl border border-[#E5DED8] bg-white">
        <div class="border-b border-[#E9E4DF] p-4">
          <div class="flex items-center text-sm font-bold text-[#242124]">
            <Icon icon="lucide:folder-tree" :size="16" class="mr-2 text-rose-600" />
            {{ t('筛选树') }}
          </div>
        </div>
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <button
              type="button"
              class="mb-3 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors"
              :class="
                isAllTreeActive ? 'bg-rose-50 text-rose-700' : 'text-[#3F3A3D] hover:bg-[#F8F5F3]'
              "
              @click="clearTreeDraft"
            >
              <span>{{ t('全部题目') }}</span>
              <span class="text-xs text-[#9A9396]">
                {{ questions.filter((question) => question.status !== 'archived').length }}
              </span>
            </button>

            <div class="space-y-2">
              <div v-for="section in filterTreeSections" :key="section.id">
                <button
                  type="button"
                  class="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[11px] font-bold text-[#766F73] transition-colors hover:bg-[#F8F5F3] hover:text-[#3F3A3D]"
                  :aria-expanded="!collapsedTreeSections[section.id]"
                  @click="toggleTreeSection(section.id)"
                >
                  <Icon
                    :icon="
                      collapsedTreeSections[section.id]
                        ? 'lucide:chevron-right'
                        : 'lucide:chevron-down'
                    "
                    :size="14"
                    class="shrink-0"
                  />
                  <span class="min-w-0 flex-1 truncate">{{ t(section.title) }}</span>
                  <span
                    v-if="section.items.filter((item) => item.checked).length > 0"
                    data-i18n-skip="true"
                    class="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700"
                  >
                    {{ section.items.filter((item) => item.checked).length }}
                  </span>
                </button>
                <div
                  v-if="!collapsedTreeSections[section.id]"
                  class="space-y-1 border-l border-[#E9E4DF] pl-2"
                >
                  <label
                    v-for="item in section.items"
                    :key="item.id"
                    class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors"
                    :class="
                      item.checked
                        ? 'bg-rose-50 font-bold text-rose-700'
                        : 'text-[#766F73] hover:bg-[#F8F5F3]'
                    "
                  >
                    <input
                      type="checkbox"
                      class="h-3.5 w-3.5 shrink-0 rounded border-[#D6CEC8] text-rose-600 focus:ring-rose-500"
                      :checked="item.checked"
                      @change="
                        toggleTreeDraftValue(
                          section.id === 'brand'
                            ? 'brandIds'
                            : section.id === 'category'
                              ? 'categoryIds'
                              : 'productLineIds',
                          item.id
                        )
                      "
                    />
                    <span
                      :data-i18n-skip="item.skipI18n ? 'true' : undefined"
                      class="min-w-0 flex-1 truncate"
                    >
                      {{ item.skipI18n ? item.name : t(item.name) }}
                    </span>
                    <span class="shrink-0 text-[#9A9396]">{{ item.count }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div
            class="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-[#E9E4DF] bg-white p-3 shadow-[0_-6px_14px_rgba(31,28,31,0.04)]"
          >
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[#E5DED8] bg-white px-3 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
              @click="clearTreeDraft"
            >
              {{ t('清空') }}
            </button>
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white transition-colors hover:bg-rose-700 disabled:pointer-events-none disabled:bg-[#D6CEC8]"
              :disabled="!treeDraftHasChanges"
              @click="applyTreeFilters"
            >
              {{ t('确定') }}
            </button>
          </div>
        </div>

        <div class="border-t border-[#E9E4DF] p-4">
          <div class="tag-rule-note relative mb-2 flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center text-sm font-bold text-[#242124]">
              <Icon icon="lucide:tags" :size="16" class="mr-2 text-rose-600" />
              {{ t('常用标签') }}
            </div>
            <button
              type="button"
              class="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[#E5DED8] bg-white px-2 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
              @click="openTagManageDialog"
            >
              <Icon icon="ep:edit" :size="14" />
              {{ t('标签管理') }}
            </button>
            <button type="button" class="note-badge">注</button>
            <div data-i18n-skip="true" role="tooltip" class="note-tip">
              AI 生成题目时自动匹配标签，优先从现有常用标签里选。如果 AI
              认为需要新标签，比如“沟通开场”，先在生成预览或待审核题中显示；培训师审核入库时同步加入常用标签库。同名标签自动去重；一道题默认最多贴
              5 个标签。培训师在这里删除标签时，只会从题目上解除关联，不删除题目。
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tag in sidebarTags"
              :key="tag.id"
              data-i18n-skip="true"
              type="button"
              class="rounded-full border px-2 py-1 text-[10px] font-bold transition-colors"
              :class="
                filters.tagId === tag.id
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-[#E5DED8] bg-[#F8F5F3] text-[#5D565A] hover:border-rose-200'
              "
              @click="updateFilters({ tagId: filters.tagId === tag.id ? 'all' : tag.id })"
            >
              {{ tag.name }}
            </button>
          </div>
          <div v-if="tags.length > sidebarTags.length" class="mt-2 text-[10px] text-[#9A9396]">
            {{ t('共') }} {{ tags.length }} {{ t('个标签，仅展示高频前') }} {{ sidebarTags.length }}
            {{ t('个') }}
          </div>
        </div>
      </aside>

      <!-- 右侧题目列表 -->
      <main
        class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#E5DED8] bg-white"
      >
        <div class="shrink-0 border-b border-[#E9E4DF] p-4">
          <div class="bank-filter-grid">
            <div class="relative min-w-0">
              <Icon
                icon="lucide:search"
                :size="16"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9396]"
              />
              <input
                type="text"
                :placeholder="t('搜索题目、标签、题目分类、产品或来源...')"
                :value="filters.keyword"
                class="h-9 w-full rounded-lg border border-[#E5DED8] bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                @input="updateFilters({ keyword: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <select
              :value="filters.type"
              class="h-9 rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
              @change="
                updateFilters({
                  type: ($event.target as HTMLSelectElement).value as QuestionFilters['type']
                })
              "
            >
              <option value="all">{{ t('全部题型') }}</option>
              <option v-for="(label, value) in QUESTION_TYPE_LABELS" :key="value" :value="value">
                {{ t(label) }}
              </option>
            </select>
            <select
              :value="filters.productId"
              :disabled="!filterLineHasProducts"
              class="h-9 rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 disabled:bg-[#F8F5F3] disabled:text-[#9A9396]"
              @change="updateFilters({ productId: ($event.target as HTMLSelectElement).value })"
            >
              <option value="all">{{
                filterLineHasProducts ? t('全部产品') : t('无需关联产品')
              }}</option>
              <option v-for="product in productsForFilter" :key="product.id" :value="product.id">
                {{ product.name }}
              </option>
            </select>
            <select
              :value="filters.difficulty"
              class="h-9 rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
              @change="
                updateFilters({
                  difficulty: ($event.target as HTMLSelectElement)
                    .value as QuestionFilters['difficulty']
                })
              "
            >
              <option value="all">{{ t('全部难度') }}</option>
              <option v-for="(label, value) in DIFFICULTY_LABELS" :key="value" :value="value">
                {{ t(label) }}
              </option>
            </select>
            <div class="status-flow-note relative">
              <select
                :value="filters.status"
                class="h-9 w-full rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @change="
                  updateFilters({
                    status: ($event.target as HTMLSelectElement).value as QuestionFilters['status']
                  })
                "
              >
                <option value="all">{{ t('全部状态') }}</option>
                <option v-for="(label, value) in STATUS_LABELS" :key="value" :value="value">
                  {{ t(label) }}
                </option>
              </select>
              <button type="button" class="note-badge">注</button>
              <div data-i18n-skip="true" role="tooltip" class="note-tip note-tip--below">
                <p class="font-bold">手动录入题</p>
                <p>草稿 -&gt; 已入库 -&gt; 已归档</p>
                <p class="mt-1 text-white/85">
                  用户点“新增题目”后，默认是
                  草稿。草稿代表培训师还在编辑，不应该进入考试组卷或附加题。编辑完成后点右下角“审核入库”，状态变成
                  已入库，之后才会出现在“考试组卷”和“课件附加题”的候选题里。历史不用的题可以批量归档，变成
                  已归档。
                </p>
                <p class="mt-3 font-bold">AI 生成/旧题派生题</p>
                <p>待审核 -&gt; 已入库 -&gt; 已归档</p>
                <p class="mt-1 text-white/85">
                  从题库里点“AI 生成变体题”后，新题直接进入 待审核。待审核表示：AI
                  已经生成初稿，但培训师必须检查题干、答案、标签、分类、难度。用户可以在题库筛选“待审核”，打开题目编辑抽屉修改，然后点“审核入库”。
                </p>
              </div>
            </div>
          </div>

          <div
            v-if="selectedIds.size > 0"
            class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm"
          >
            <div class="font-bold text-rose-700"
              >{{ t('已选择') }} {{ selectedIds.size }} {{ t('项') }}</div
            >
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                @click="tagDialog = true"
              >
                <Icon icon="ep:edit" :size="16" />
                {{ t('批量编辑标签') }}
              </button>
              <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-colors"
                :class="aiActionTone.buttonClass"
                :disabled="!!variantGeneration"
                @click="handleGenerateVariants(Array.from(selectedIds))"
              >
                <Icon
                  icon="lucide:wand-2"
                  :size="16"
                  :class="[aiActionTone.iconClass, variantGeneration ? 'animate-spin' : '']"
                />
                {{ variantGeneration ? t('生成中') : t('AI 生成变体题') }}
              </button>
              <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#E8CCA0] bg-white px-2.5 text-sm font-medium text-[#8B621F] transition-colors hover:bg-[#FFF7EA]"
                @click="handleBatchArchive"
              >
                <Icon icon="lucide:archive" :size="16" />
                {{ t('批量归档') }}
              </button>
            </div>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <div
            class="mb-2 flex items-center justify-between border-b border-[#E5DED8] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#766F73]"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3 pr-4">
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                :checked="allVisibleSelected"
                @change="toggleSelectAll"
              />
              <span class="w-20 shrink-0">{{ t('题型') }}</span>
              <span class="min-w-0 flex-1">{{ t('题干') }}</span>
              <span class="hidden w-28 shrink-0 lg:block">{{ t('分类/产品') }}</span>
              <span class="hidden w-36 shrink-0 xl:block">{{ t('标签') }}</span>
              <span class="hidden w-28 shrink-0 md:block">{{ t('状态') }}</span>
              <span class="hidden w-40 shrink-0 2xl:block">{{ t('来源文件') }}</span>
            </div>
            <span class="w-32 shrink-0 text-right">{{ t('操作') }}</span>
          </div>

          <div class="space-y-2">
            <div
              v-for="question in filteredQuestions"
              :key="question.id"
              class="group flex items-center justify-between rounded-lg border border-[#E9E4DF] bg-white p-3 shadow-sm transition-colors hover:border-[#E5DED8] hover:bg-[#F8F5F3]"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3 pr-4">
                <input
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  :checked="selectedIds.has(question.id)"
                  @change="toggleSelect(question.id)"
                />
                <div class="w-20 shrink-0">
                  <span
                    class="inline-flex w-full items-center justify-center whitespace-normal rounded-full border px-2 py-0.5 text-center text-[10px] font-bold leading-tight"
                    :class="typeToneClass[question.type]"
                  >
                    {{ t(QUESTION_TYPE_LABELS[question.type]) }}
                  </span>
                </div>
                <button
                  type="button"
                  class="stem-tooltip relative min-w-0 flex-1 text-left"
                  @click="openEditPanel(question)"
                >
                  <div
                    data-i18n-skip="true"
                    :title="question.stem"
                    class="truncate text-sm font-bold text-[#242124] group-hover:text-rose-700"
                  >
                    {{ question.stem }}
                  </div>
                  <div data-i18n-skip="true" role="tooltip" class="stem-tip">
                    {{ question.stem }}
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#766F73]">
                    <span data-i18n-skip="true">
                      {{
                        question.productLineId === GENERAL_CAPABILITY_LINE_ID
                          ? findProductLine(question.productLineId)?.name || t('未分类')
                          : `${findProductLine(question.productLineId)?.name || t('未分类')} / ${
                              findProduct(question.productLineId, question.productId)?.name ||
                              t('未关联产品')
                            }`
                      }}
                    </span>
                    <span>{{ t(DIFFICULTY_LABELS[question.difficulty]) }}</span>
                    <span
                      v-if="question.generatedFromQuestionId"
                      class="rounded bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-700"
                    >
                      AI 派生
                    </span>
                  </div>
                </button>
                <div
                  data-i18n-skip="true"
                  class="hidden w-28 shrink-0 truncate text-xs text-[#5D565A] lg:block"
                  :title="
                    question.productLineId === GENERAL_CAPABILITY_LINE_ID
                      ? '通用能力'
                      : findProduct(question.productLineId, question.productId)?.name ||
                        '未关联产品'
                  "
                >
                  {{
                    question.productLineId === GENERAL_CAPABILITY_LINE_ID
                      ? t('通用能力')
                      : findProduct(question.productLineId, question.productId)?.name ||
                        t('未关联产品')
                  }}
                </div>
                <div class="hidden w-36 shrink-0 flex-wrap gap-1 xl:flex">
                  <span
                    v-for="tag in getQuestionTagNames(question, tags).slice(0, 3)"
                    :key="tag"
                    data-i18n-skip="true"
                    class="inline-flex max-w-full items-center justify-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-normal text-[#5D565A]"
                  >
                    {{ tag }}
                  </span>
                  <span
                    v-if="getQuestionTagNames(question, tags).length > 3"
                    class="text-[10px] text-[#9A9396]"
                  >
                    +{{ getQuestionTagNames(question, tags).length - 3 }}
                  </span>
                </div>
                <div class="hidden w-28 shrink-0 md:block">
                  <span
                    class="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold"
                    :class="statusBadgeClass[question.status]"
                  >
                    {{ t(STATUS_LABELS[question.status]) }}
                  </span>
                </div>
                <div
                  class="hidden w-40 shrink-0 items-center truncate text-xs text-[#766F73] 2xl:flex"
                  :title="question.sourceFile"
                >
                  <Icon icon="lucide:file-text" :size="12" class="mr-1 shrink-0" />
                  <span data-i18n-skip="true" class="truncate">{{
                    question.sourceFile || '-'
                  }}</span>
                </div>
              </div>

              <div class="flex w-32 shrink-0 items-center justify-end gap-1">
                <button
                  v-if="question.status === 'pending_review'"
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-[#3B8F72] transition-colors hover:bg-[#EEF8F4]"
                  title="审核入库"
                  @click="updateQuestion({ ...question, status: 'active' })"
                >
                  <Icon icon="lucide:check" :size="16" />
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-[#8B621F] transition-colors hover:bg-[#FFF7EA]"
                  title="AI 生成变体题"
                  :disabled="!!variantGeneration"
                  @click="handleGenerateVariants([question.id])"
                >
                  <Icon
                    :icon="variantGeneration ? 'lucide:loader-2' : 'lucide:sparkles'"
                    :size="16"
                    :class="variantGeneration ? 'animate-spin' : ''"
                  />
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50"
                  title="编辑"
                  @click="openEditPanel(question)"
                >
                  <Icon icon="ep:edit" :size="16" />
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                  title="删除"
                  @click="removeQuestion(question.id)"
                >
                  <Icon icon="lucide:trash-2" :size="16" />
                </button>
              </div>
            </div>

            <div v-if="filteredQuestions.length === 0" class="py-16 text-center text-[#9A9396]">
              <Icon icon="lucide:database" :size="48" class="mx-auto mb-4 opacity-20" />
              <p>{{ t('暂无符合条件的题目') }}</p>
              <p class="mt-1 text-xs">{{ t('请尝试其他关键词、题目分类或标签') }}</p>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- 题目编辑抽屉 -->
    <div
      v-if="editingQuestion"
      class="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-[#E5DED8] bg-white shadow-2xl"
    >
      <div class="flex items-center justify-between border-b border-[#E9E4DF] px-5 py-4">
        <div>
          <h2 class="text-lg font-bold text-[#242124]">
            {{ editingMode === 'create' ? t('新增题目') : t('编辑题目') }}
          </h2>
          <p class="text-xs text-[#766F73]">{{
            t('修改题干、题型、答案、题目分类和标签后保存')
          }}</p>
        </div>
        <button
          type="button"
          class="rounded-lg p-2 text-[#766F73] hover:bg-[#F8F5F3]"
          @click="closeEditPanel"
        >
          <Icon icon="lucide:x" :size="20" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div class="space-y-5">
          <div class="grid gap-3 md:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-sm font-bold text-[#3F3A3D]">{{ t('题型') }}</span>
              <select
                :value="editingQuestion.type"
                class="h-9 w-full rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @change="
                  patchEditing({ type: ($event.target as HTMLSelectElement).value as QuestionType })
                "
              >
                <option v-for="(label, value) in QUESTION_TYPE_LABELS" :key="value" :value="value">
                  {{ t(label) }}
                </option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-sm font-bold text-[#3F3A3D]">{{ t('状态') }}</span>
              <select
                :value="editingQuestion.status"
                class="h-9 w-full rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @change="
                  patchEditing({
                    status: ($event.target as HTMLSelectElement).value as QuestionStatus
                  })
                "
              >
                <option v-for="(label, value) in STATUS_LABELS" :key="value" :value="value">
                  {{ t(label) }}
                </option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-sm font-bold text-[#3F3A3D]">{{ t('题目分类') }}</span>
              <select
                :value="editingQuestion.productLineId || ''"
                class="h-9 w-full rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @change="handleProductLineChange(($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="line in QUESTION_TAXONOMY.productLines"
                  :key="line.id"
                  :value="line.id"
                >
                  {{ t(line.name) }}
                </option>
              </select>
            </label>
            <div v-if="editingUsesTagSubclassification" class="block">
              <span class="mb-1 block text-sm font-bold text-[#3F3A3D]">{{ t('产品') }}</span>
              <div
                class="min-h-9 rounded-lg border border-dashed border-[#E5DED8] bg-[#F8F5F3] px-3 py-2 text-sm"
              >
                <div class="font-bold text-[#5D565A]">{{ t('无需关联产品') }}</div>
                <p class="mt-1 text-xs leading-relaxed text-[#766F73]">
                  {{ t('通用能力题无需关联产品，培训师可通过标签继续细分。') }}
                </p>
              </div>
            </div>
            <label v-else class="block">
              <span class="mb-1 block text-sm font-bold text-[#3F3A3D]">{{ t('产品') }}</span>
              <select
                :value="editingQuestion.productId || ''"
                class="h-9 w-full rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @change="patchEditing({ productId: ($event.target as HTMLSelectElement).value })"
              >
                <option v-for="product in editingProducts" :key="product.id" :value="product.id">
                  {{ product.name }}
                </option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-sm font-bold text-[#3F3A3D]">{{ t('难度') }}</span>
              <select
                :value="editingQuestion.difficulty"
                class="h-9 w-full rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @change="
                  patchEditing({
                    difficulty: ($event.target as HTMLSelectElement).value as QuestionDifficulty
                  })
                "
              >
                <option v-for="(label, value) in DIFFICULTY_LABELS" :key="value" :value="value">
                  {{ t(label) }}
                </option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-sm font-bold text-[#3F3A3D]">{{ t('来源文件') }}</span>
              <input
                :value="editingQuestion.sourceFile || ''"
                class="h-9 w-full rounded-lg border border-[#E5DED8] px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @input="patchEditing({ sourceFile: ($event.target as HTMLInputElement).value })"
              />
            </label>
          </div>

          <label class="block">
            <span class="mb-1 block text-sm font-bold text-[#3F3A3D]">{{ t('题干') }}</span>
            <textarea
              data-i18n-skip="true"
              :value="editingQuestion.stem"
              :placeholder="t('请输入题干...')"
              class="min-h-24 w-full resize-none rounded-lg border border-[#E5DED8] px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-rose-500/20"
              @input="patchEditing({ stem: ($event.target as HTMLTextAreaElement).value })"
            ></textarea>
          </label>

          <QuestionAnswerFields :question="editingQuestion" mode="edit" @patch="patchEditing" />

          <div>
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span class="block text-sm font-bold text-[#3F3A3D]">{{ t('常用标签') }}</span>
              <span class="text-xs text-[#766F73]">
                {{ t('AI 已自动匹配标签，可删除或补充；每题最多') }} {{ MAX_TAGS_PER_QUESTION }}
                {{ t('个。') }}
              </span>
            </div>
            <div
              class="mb-3 flex min-h-8 flex-wrap gap-2 rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-2"
            >
              <span
                v-for="tag in getQuestionTagNames(editingQuestion, tags)"
                :key="tag"
                data-i18n-skip="true"
                class="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-[#5D565A] ring-1 ring-[#E5DED8]"
              >
                {{ tag }}
                <button
                  type="button"
                  class="text-[#9A9396] hover:text-red-500"
                  title="移除标签"
                  @click="removeCustomTag(tag)"
                >
                  <Icon icon="lucide:x" :size="12" />
                </button>
              </span>
              <span
                v-if="getQuestionTagNames(editingQuestion, tags).length === 0"
                class="px-1 py-1 text-xs text-[#9A9396]"
              >
                {{ t('暂无标签') }}
              </span>
            </div>
            <div class="mb-3 flex flex-wrap gap-2">
              <button
                v-for="tag in tags"
                :key="tag.id"
                data-i18n-skip="true"
                type="button"
                class="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
                :class="
                  editingQuestion.tagIds.includes(tag.id) ||
                  editingQuestion.customTags.some(
                    (name) => getTagNameKey(name) === getTagNameKey(tag.name)
                  )
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-[#E5DED8] bg-white text-[#5D565A] hover:border-rose-200'
                "
                @click="toggleTag(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
            <div class="flex gap-2">
              <input
                v-model="customTagInput"
                :placeholder="t('输入标签并按回车添加...')"
                class="h-9 min-w-0 flex-1 rounded-lg border border-[#E5DED8] px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @keydown.enter="addCustomTag"
              />
              <button
                type="button"
                class="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[#E5DED8] bg-white px-3 text-sm font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
                @click="addCustomTag"
              >
                {{ t('添加为本题标签') }}
              </button>
            </div>
          </div>

          <div
            v-if="editingQuestion.generatedFromQuestionId"
            class="rounded-lg border border-[#E8CCA0] bg-[#FFF7EA] p-3 text-xs leading-relaxed text-[#8B621F]"
          >
            {{ t('这是一道 AI 派生题，来源题 ID：') }}
            <span data-i18n-skip="true" class="font-bold">{{
              editingQuestion.generatedFromQuestionId
            }}</span>
            {{ t('。请确认题干、答案和标签后再审核入库。') }}
          </div>
        </div>
      </div>

      <div class="flex shrink-0 items-center justify-between border-t border-[#E9E4DF] px-5 py-4">
        <div class="text-xs text-[#766F73]">
          {{ t('当前答案：') }}
          <span data-i18n-skip="true" class="font-bold text-[#3B8F72]">{{
            getQuestionAnswerText(editingQuestion)
          }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[#E5DED8] bg-white px-2.5 text-sm font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
            @click="closeEditPanel"
          >
            {{ t('取消') }}
          </button>
          <button
            type="button"
            class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E5DED8] bg-white px-2.5 text-sm font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
            @click="saveEditingQuestion"
          >
            <Icon icon="lucide:save" :size="16" />
            {{ t('保存') }}
          </button>
          <button
            type="button"
            class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#3B8F72] px-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2F735C]"
            @click="approveEditingQuestion"
          >
            <Icon icon="lucide:check" :size="16" />
            {{ t('审核入库') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 排查重复题目 -->
    <el-dialog v-model="showDuplicates" width="896px" :append-to-body="true">
      <template #header>
        <span class="flex items-center text-base font-medium text-[#242124]">
          <Icon icon="lucide:replace" :size="20" class="mr-2 text-[#B9822B]" />
          {{ t('发现高度相似的题目') }}
        </span>
      </template>
      <div class="py-4">
        <div
          v-for="duplicate in duplicatePairs"
          :key="duplicate.targetId"
          class="space-y-4 rounded-xl border border-[#E5DED8] bg-[#F8F5F3] p-4"
        >
          <div class="flex items-center justify-between px-2">
            <span class="text-sm font-bold text-[#3F3A3D]">{{ t('相似度检测') }}</span>
            <span
              class="inline-flex h-5 w-fit items-center justify-center rounded-full bg-[#F7E6C8] px-2 py-0.5 text-xs font-bold whitespace-nowrap text-[#8B621F]"
            >
              {{ duplicate.matchPercent }}% {{ t('相似') }}
            </span>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <div
              v-for="item in duplicate.items"
              :key="item.index"
              class="rounded-xl border border-[#E5DED8] bg-white p-4"
            >
              <template v-if="item.question">
                <span
                  class="mb-2 inline-flex h-5 w-fit items-center justify-center rounded-full border border-[#E5DED8] px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[#1F1C1F]"
                >
                  {{ item.index === 0 ? t('已有试题') : t('新试题') }} (ID: {{ item.question.id }})
                </span>
                <p data-i18n-skip="true" class="mb-3 text-sm font-bold text-[#242124]">
                  {{ item.question.stem }}
                </p>
                <ul v-if="item.question.options" class="mb-3 space-y-1 text-xs text-[#766F73]">
                  <li
                    v-for="option in item.question.options"
                    :key="option.id"
                    data-i18n-skip="true"
                  >
                    {{ option.label }}. {{ option.text }}
                  </li>
                </ul>
                <p class="mb-4 text-xs font-medium text-[#3B8F72]">
                  {{ t('答案:') }}
                  <span data-i18n-skip="true">{{ getQuestionAnswerText(item.question) }}</span>
                </p>
                <button
                  type="button"
                  class="w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-50"
                  @click="
                    item.index === 0
                      ? handleResolveDuplicate(duplicate.similarToId, duplicate.targetId)
                      : handleResolveDuplicate(duplicate.targetId, duplicate.similarToId)
                  "
                >
                  {{ item.index === 0 ? t('保留此题并移除右侧') : t('保留此题并移除左侧') }}
                </button>
              </template>
            </div>
          </div>
        </div>
        <div v-if="duplicates.length === 0" class="py-8 text-center text-[#766F73]">
          {{ t('目前没有发现重复或雷同题目。') }}
        </div>
      </div>
    </el-dialog>

    <!-- 批量编辑标签 -->
    <el-dialog v-model="tagDialog" width="448px" :append-to-body="true">
      <template #header>
        <span class="flex items-center text-base font-medium text-[#242124]">{{
          t('批量编辑标签')
        }}</span>
      </template>
      <div class="space-y-4 py-4">
        <div class="rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-3">
          <p class="text-sm font-medium text-[#3F3A3D]">
            {{ t('将为选中的') }} {{ selectedQuestions.length }} {{ t('道题目应用标签') }}
          </p>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between">
            <label class="block text-sm font-medium text-[#3F3A3D]">
              {{ t('添加标签 (以逗号或空格分隔)') }}
            </label>
            <button
              type="button"
              class="inline-flex h-6 shrink-0 items-center rounded-lg px-2 text-xs font-medium transition-colors"
              :class="aiActionTone.ghostButtonClass"
              @click="batchTags = 'Lumina新品, 成分解析, 销售话术'"
            >
              <Icon icon="lucide:wand-2" :size="12" class="mr-1" :class="aiActionTone.iconClass" />
              {{ t('AI 自动推荐') }}
            </button>
          </div>
          <textarea
            v-model="batchTags"
            :placeholder="t('例如: 基础知识, 新品, Lumina')"
            class="min-h-80px w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-rose-500"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <el-button @click="tagDialog = false">{{ t('取消') }}</el-button>
          <el-button
            class="!border-none !bg-rose-600 !text-white hover:!bg-rose-700"
            @click="saveBatchTags"
          >
            {{ t('应用标签') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 标签管理 -->
    <el-dialog
      v-model="tagManageDialog"
      class="exam-bank-tag-dialog"
      width="1120px"
      top="7vh"
      :append-to-body="true"
    >
      <template #header>
        <div>
          <span class="flex items-center text-base font-medium text-[#242124]">
            <Icon icon="lucide:tags" :size="20" class="mr-2 text-rose-600" />
            {{ t('标签管理') }}
          </span>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#766F73]">
            <span>
              {{ t('全部') }} <span data-i18n-skip="true">{{ tags.length }}</span> {{ t('个标签') }}
            </span>
          </div>
        </div>
      </template>

      <div class="bank-tag-toolbar">
        <div class="relative min-w-0">
          <Icon
            icon="lucide:search"
            :size="16"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9396]"
          />
          <input
            :value="tagSearch"
            :placeholder="t('搜索标签名称')"
            class="h-9 w-full rounded-lg border border-[#E5DED8] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
            @input="handleTagSearchInput(($event.target as HTMLInputElement).value)"
          />
        </div>
        <select
          :value="tagSort"
          class="h-9 rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          @change="handleTagSortChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="usage_desc">{{ t('使用量从高到低') }}</option>
          <option value="usage_asc">{{ t('使用量从低到高') }}</option>
          <option value="name_asc">{{ t('按名称排序') }}</option>
          <option value="unused_first">{{ t('未使用优先') }}</option>
        </select>
        <input
          :value="newTagName"
          :placeholder="t('输入新标签')"
          class="h-9 min-w-0 rounded-lg border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          @input="newTagName = ($event.target as HTMLInputElement).value"
          @keydown.enter="handleAddCommonTag"
        />
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700"
          @click="handleAddCommonTag"
        >
          <Icon icon="ep:plus" :size="16" />
          {{ t('新增') }}
        </button>
      </div>

      <div class="bank-tag-table-wrap">
        <div class="bank-tag-table">
          <div class="bank-tag-table__head">
            <span>{{ t('标签名称') }}</span>
            <span class="text-center">{{ t('引用题数') }}</span>
            <span class="text-center">{{ t('操作') }}</span>
          </div>
          <div class="bank-tag-table__body">
            <div v-for="row in visibleTagRows" :key="row.tag.id" class="bank-tag-row">
              <input
                data-i18n-skip="true"
                :value="tagDraftNames[row.tag.id] ?? row.tag.name"
                class="bank-tag-row__name"
                @input="
                  tagDraftNames = {
                    ...tagDraftNames,
                    [row.tag.id]: ($event.target as HTMLInputElement).value
                  }
                "
              />
              <div class="text-xs tabular-nums text-[#766F73] md:text-center">{{ row.usage }}</div>
              <div class="flex items-center gap-1 md:justify-center">
                <button
                  type="button"
                  class="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E5DED8] text-[#5D565A] transition-colors hover:bg-[#F8F5F3]"
                  :title="`保存 ${row.tag.name} 的新名称`"
                  @click="handleRenameCommonTag(row.tag.id)"
                >
                  <Icon icon="lucide:save" :size="14" />
                </button>
                <button
                  type="button"
                  class="flex h-7 w-7 items-center justify-center rounded-lg border border-red-100 text-red-500 transition-colors hover:bg-red-50"
                  :title="`删除 ${row.tag.name}`"
                  @click="handleDeleteCommonTag(row.tag.id)"
                >
                  <Icon icon="lucide:trash-2" :size="14" />
                </button>
              </div>
            </div>
            <div
              v-if="tagRows.length === 0"
              class="flex h-full min-h-240px items-center justify-center text-sm text-[#9A9396]"
            >
              {{ t('暂无符合条件的标签') }}
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs text-[#766F73]">
            {{ t('显示') }}
            <span data-i18n-skip="true">
              {{ tagRows.length === 0 ? 0 : tagPageStart + 1 }}-{{
                Math.min(tagPageStart + TAG_MANAGE_PAGE_SIZE, tagRows.length)
              }}
            </span>
            / <span data-i18n-skip="true">{{ tagRows.length }}</span>
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-[#E5DED8] bg-white px-2.5 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3] disabled:pointer-events-none disabled:opacity-50"
              :disabled="currentTagPage <= 1"
              @click="tagPage = Math.max(1, tagPage - 1)"
            >
              {{ t('上一页') }}
            </button>
            <span data-i18n-skip="true" class="min-w-12 text-center text-xs text-[#766F73]">
              {{ currentTagPage }} / {{ totalTagPages }}
            </span>
            <button
              type="button"
              class="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-[#E5DED8] bg-white px-2.5 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3] disabled:pointer-events-none disabled:opacity-50"
              :disabled="currentTagPage >= totalTagPages"
              @click="tagPage = Math.min(totalTagPages, tagPage + 1)"
            >
              {{ t('下一页') }}
            </button>
          </div>
          <el-button @click="tagManageDialog = false">{{ t('关闭') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.beauty-toast-in {
  animation: beauty-toast-in 0.2s ease-out;
}

@keyframes beauty-toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, -8px);
  }

  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.bank-layout {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: 1fr;
  gap: 16px;

  @media (min-width: 1024px) {
    grid-template-columns: 280px minmax(0, 1fr);
  }
}

.bank-filter-grid {
  display: grid;
  gap: 12px;

  @media (min-width: 1280px) {
    grid-template-columns: minmax(220px, 1fr) 160px 160px 160px 160px;
  }
}

/* 「注」悬浮说明（原型用 group-hover 命名组实现，这里用 scoped 选择器等价实现） */
.note-badge {
  position: absolute;
  right: -6px;
  top: -8px;
  z-index: 20;
  height: 16px;
  min-width: 16px;
  border-radius: 9999px;
  background: #172554;
  padding: 0 4px;
  text-align: center;
  font-size: 9px;
  font-weight: 700;
  line-height: 16px;
  color: #fff;
  box-shadow: 0 1px 2px rgb(36 31 28 / 5%);
}

.note-tip {
  display: none;
  position: absolute;
  right: 0;
  bottom: 100%;
  z-index: 100;
  width: 380px;
  max-width: min(380px, calc(100vw - 2rem));
  margin-bottom: 8px;
  border-radius: 8px;
  background: rgb(23 37 84 / 95%);
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.625;
  color: #fff;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 10%),
    0 8px 10px -6px rgb(0 0 0 / 10%);
  backdrop-filter: blur(4px);
}

.note-tip--below {
  top: 100%;
  bottom: auto;
  width: 420px;
  max-width: min(420px, calc(100vw - 2rem));
  margin-top: 8px;
  margin-bottom: 0;
}

.tag-rule-note:hover .note-tip,
.tag-rule-note:focus-within .note-tip,
.status-flow-note:hover .note-tip,
.status-flow-note:focus-within .note-tip {
  display: block;
}

/* 题干悬浮完整文本 */
.stem-tip {
  display: none;
  pointer-events: none;
  position: absolute;
  left: 0;
  top: 100%;
  z-index: 90;
  margin-top: 8px;
  width: 520px;
  max-width: min(520px, calc(100vw - 2rem));
  border: 1px solid #e5ded8;
  border-radius: 8px;
  background: #fff;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.625;
  color: #242124;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 10%),
    0 8px 10px -6px rgb(0 0 0 / 10%);
}

.stem-tooltip:hover .stem-tip,
.stem-tooltip:focus .stem-tip {
  display: block;
}
</style>

<style lang="scss">
/* 标签管理弹窗被 teleport 到 body，scoped 样式覆盖不到，用唯一类名做全局命名空间。 */
.exam-bank-tag-dialog {
  display: flex;
  flex-direction: column;
  height: 86vh;
  overflow: hidden;
  background: #fcfaf8;

  .el-dialog__header {
    margin-right: 0;
    padding: 16px 56px 16px 20px;
    border-bottom: 1px solid #e9e4df;
    background: #fff;
  }

  .el-dialog__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
  }

  .el-dialog__footer {
    padding: 12px 20px;
    border-top: 1px solid #e9e4df;
    background: #fff;
  }

  .bank-tag-toolbar {
    flex-shrink: 0;
    display: grid;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid #e9e4df;
    background: #f8f5f3;

    @media (min-width: 1024px) {
      grid-template-columns: minmax(220px, 1fr) 180px minmax(240px, 360px) 92px;
    }
  }

  .bank-tag-table-wrap {
    flex: 1;
    min-height: 0;
    padding: 12px 20px;
  }

  .bank-tag-table {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid #e9e4df;
    border-radius: 8px;
    background: #fff;

    &__head {
      display: none;
      flex-shrink: 0;
      gap: 12px;
      padding: 8px 12px;
      border-bottom: 1px solid #e9e4df;
      background: #f8f5f3;
      font-size: 12px;
      font-weight: 700;
      color: #766f73;

      @media (min-width: 768px) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 96px 92px;
      }
    }

    &__body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
  }

  .bank-tag-row {
    display: grid;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid #f1ece8;

    &:last-child {
      border-bottom: 0;
    }

    @media (min-width: 768px) {
      grid-template-columns: minmax(0, 1fr) 96px 92px;
      align-items: center;
      min-height: 40px;
    }
  }

  .bank-tag-row__name {
    height: 28px;
    min-width: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    padding: 0 8px;
    font-size: 14px;
    outline: none;

    &:hover {
      border-color: #e5ded8;
      background: #fcfaf8;
    }

    &:focus {
      border-color: #e5ded8;
      background: #fff;
      box-shadow: 0 0 0 2px rgb(244 63 94 / 20%);
    }
  }
}
</style>
