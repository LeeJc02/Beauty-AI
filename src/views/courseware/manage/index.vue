<template>
  <div class="courseware-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('coursewareManage.title') }}</h1>
        <p class="page-subtitle">{{ t('coursewareManage.subtitle', { total }) }}</p>
      </div>
    </div>

    <section class="toolbar-card">
      <div class="tag-filter">
        <button
          v-for="tag in quickTagOptions"
          :key="tag"
          class="tag-button"
          :class="{ active: isQuickTagActive(tag) }"
          type="button"
          @click="toggleQuickTag(tag)"
        >
          {{ tagLabel(tag) }}
        </button>
      </div>

      <div class="toolbar-actions">
        <el-select
          v-model="queryParams.brandIds"
          class="catalog-filter-select"
          multiple
          clearable
          filterable
          collapse-tags
          :placeholder="t('coursewareManage.filters.brandPlaceholder')"
          @change="handleBrandFilterChange"
        >
          <el-option
            v-for="brand in catalogOptions?.brands || []"
            :key="brand.id"
            :label="brand.name"
            :value="brand.id"
          />
        </el-select>
        <el-select
          v-model="queryParams.categoryIds"
          class="catalog-filter-select"
          multiple
          clearable
          filterable
          collapse-tags
          :placeholder="t('coursewareManage.filters.categoryPlaceholder')"
          @change="handleQuery"
        >
          <el-option
            v-for="category in filteredCatalogCategories"
            :key="category.id"
            :label="category.pathName || category.name"
            :value="category.id"
          />
        </el-select>
        <el-select
          v-model="queryParams.productIds"
          class="catalog-filter-select"
          multiple
          clearable
          filterable
          collapse-tags
          :placeholder="t('coursewareManage.filters.productPlaceholder')"
          @change="handleCategoryFilterChange"
        >
          <el-option
            v-for="product in filteredCatalogProducts"
            :key="product.id"
            :label="product.name"
            :value="product.id"
          />
        </el-select>
        <el-select
          v-model="selectedTag"
          class="tag-search-select"
          clearable
          filterable
          reserve-keyword
          default-first-option
          :placeholder="t('coursewareManage.filters.tagPlaceholder')"
          @change="handleTagChange"
        >
          <el-option v-for="tag in tagOptions" :key="tag" :label="tagLabel(tag)" :value="tag" />
        </el-select>

        <div class="search-box">
          <el-autocomplete
            v-model="queryParams.keyword"
            clearable
            :fetch-suggestions="fetchCoursewareSuggestions"
            :trigger-on-focus="false"
            :placeholder="t('coursewareManage.filters.keywordPlaceholder')"
            @select="handleCoursewareSuggestionSelect"
            @clear="handleQuery"
            @keyup.enter="handleQuery"
          >
            <template #prefix><Icon icon="ep:search" /></template>
          </el-autocomplete>
        </div>

        <el-dropdown trigger="click" @command="handleSortCommand">
          <button class="sort-button" type="button">
            <Icon icon="ep:clock" class="sort-icon" />
            {{ sortLabel }}
            <Icon icon="ep:arrow-down" class="chevron-icon" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="createTime_desc">{{
                t('coursewareManage.sort.latestCreated')
              }}</el-dropdown-item>
              <el-dropdown-item command="createTime_asc">{{
                t('coursewareManage.sort.earliestCreated')
              }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <button class="clear-filter-button" type="button" @click="resetQuery">
          <Icon icon="ep:refresh-left" />
          {{ t('coursewareManage.actions.clearFilters') }}
        </button>

        <button
          class="create-button"
          type="button"
          @click="goCreate"
          v-hasPermi="['ai:courseware:generate']"
        >
          <Icon icon="ep:plus" />
          {{ t('coursewareManage.actions.create') }}
        </button>
      </div>
    </section>

    <div v-loading="loading" class="course-grid-wrap">
      <div v-if="list.length" class="course-grid">
        <article
          v-for="(course, index) in list"
          :key="course.id"
          class="course-card"
          role="button"
          tabindex="0"
          @click="handleEdit(course)"
          @keydown.enter.prevent="handleEdit(course)"
          @keydown.space.prevent="handleEdit(course)"
        >
          <div class="thumb" :class="!getCourseCoverUrl(course) ? getThumbClass(index) : ''">
            <img
              v-if="getCourseCoverUrl(course)"
              :src="getCourseCoverUrl(course)"
              class="thumb-image"
              loading="lazy"
              :alt="t('coursewareManage.card.coverAlt')"
              @error="handleCoverError(course)"
            />
            <div class="thumb-mask"></div>

            <div
              v-if="getGenerationTypeLabel(course.documentProcessingMode)"
              class="generation-type-badge"
              :class="`generation-type-badge--${course.documentProcessingMode}`"
            >
              <Icon
                :icon="
                  course.documentProcessingMode === 'direct' ? 'ep:document' : 'ep:magic-stick'
                "
              />
              {{ getGenerationTypeLabel(course.documentProcessingMode) }}
            </div>

            <div class="view-badge">
              <Icon icon="ep:view" />
              {{ formatCount(course.viewCount || 0) }}
            </div>

            <div class="hover-meta">
              <div class="hover-meta-stack">
                <span>{{
                  t('coursewareManage.card.creator', { name: course.creatorName || '-' })
                }}</span>
                <span>{{
                  t('coursewareManage.card.createTime', {
                    time: formatCourseDate(course.createTime) || '-'
                  })
                }}</span>
              </div>
            </div>

            <div class="hover-actions">
              <button
                type="button"
                class="hover-action"
                :class="{ copied: copiedId === course.id }"
                @click.stop="handleCopyLink(course.id)"
              >
                <Icon :icon="copiedId === course.id ? 'ep:circle-check' : 'ep:link'" />
                <span class="hover-action-label">{{
                  t(
                    copiedId === course.id
                      ? 'coursewareManage.hoverActions.copiedLink'
                      : 'coursewareManage.hoverActions.generateLink'
                  )
                }}</span>
              </button>
              <button
                type="button"
                class="hover-action hover-action--primary"
                @click.stop="handleHomework()"
              >
                <Icon icon="ep:calendar" />
                <span class="hover-action-label">{{
                  t('coursewareManage.hoverActions.task')
                }}</span>
              </button>
              <button type="button" class="hover-action" @click.stop="handleEdit(course)">
                <Icon icon="ep:edit" />
                <span class="hover-action-label">{{
                  t('coursewareManage.hoverActions.edit')
                }}</span>
              </button>
              <button type="button" class="hover-action" @click.stop="handleAddHomework(course)">
                <Icon icon="ep:plus" />
                <span class="hover-action-label">{{
                  t('coursewareManage.hoverActions.homework')
                }}</span>
              </button>
              <button
                v-if="!course.linkedQuestionCount"
                v-hasPermi="['ai:courseware:homework-generate']"
                type="button"
                class="hover-action"
                :disabled="course.id ? regeneratingHomeworkIds.has(course.id) : true"
                @click.stop="handleRegenerateHomework(course)"
              >
                <Icon icon="ep:refresh" />
                <span class="hover-action-label">{{
                  t('coursewareManage.hoverActions.generateHomework')
                }}</span>
              </button>
              <button type="button" class="hover-action" @click.stop="handleExport(course)">
                <Icon icon="ep:download" />
                <span class="hover-action-label">{{
                  t('coursewareManage.hoverActions.export')
                }}</span>
              </button>
            </div>
          </div>

          <div class="card-body">
            <div class="card-tags">
              <span class="area-tag" :title="formatAreaNames(course.areaNames)">
                <Icon icon="ep:location" />
                {{ formatAreaNames(course.areaNames) }}
              </span>
              <span
                class="status-tag"
                :class="
                  course.status === COURSEWARE_PUBLISHED_STATUS
                    ? 'status-tag--published'
                    : 'status-tag--draft'
                "
              >
                {{
                  t(
                    course.status === COURSEWARE_PUBLISHED_STATUS
                      ? 'coursewareManage.card.published'
                      : 'coursewareManage.card.unpublished'
                  )
                }}
              </span>
              <span
                class="homework-generation-tag"
                :class="getHomeworkGenerationTagClass(course.generateHomeworkSync)"
              >
                {{ getHomeworkGenerationLabel(course.generateHomeworkSync) }}
              </span>
              <span
                v-for="tag in visibleCourseTags(course)"
                :key="tag"
                class="course-tag"
                :title="tag"
                >{{ tag }}</span
              >
              <span
                v-if="hiddenCourseTagCount(course) > 0"
                class="course-tag muted"
                :title="hiddenCourseTags(course).join('、')"
                >+{{ hiddenCourseTagCount(course) }}</span
              >
              <span v-if="!course.tags?.length" class="course-tag muted">{{
                t('coursewareManage.card.uncategorized')
              }}</span>
            </div>
            <div class="catalog-summary">
              <el-tooltip
                :content="catalogTooltip(course)"
                placement="top"
                :disabled="!hasCatalogRelation(course)"
              >
                <span>
                  {{
                    hasCatalogRelation(course)
                      ? catalogSummary(course)
                      : t('coursewareManage.card.noCatalogRelation')
                  }}
                </span>
              </el-tooltip>
            </div>
            <h3 class="course-title">{{ course.title }}</h3>
            <p class="course-desc">{{
              course.summary ||
              course.description ||
              course.trainingObjective ||
              t('coursewareManage.card.noDescription')
            }}</p>
          </div>

          <div class="card-footer">
            <div class="footer-meta">
              <span>{{
                t('coursewareManage.card.createdAt', {
                  date: formatCourseDate(course.createTime) || '-'
                })
              }}</span>
              <span class="course-duration"
                ><Icon icon="ep:clock" />{{
                  formatEstimatedDuration(course.estimatedDurationSeconds)
                }}</span
              >
            </div>
            <el-dropdown trigger="click" @command="(command) => handleMoreCommand(command, course)">
              <button class="more-button" type="button" @click.stop>
                <Icon icon="ep:more-filled" />
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">{{
                    t('coursewareManage.actions.rename')
                  }}</el-dropdown-item>
                  <el-dropdown-item command="catalog">{{
                    t('coursewareManage.actions.editCatalog')
                  }}</el-dropdown-item>
                  <el-dropdown-item v-if="course.status !== 20" command="publish">{{
                    t('coursewareManage.actions.publish')
                  }}</el-dropdown-item>
                  <el-dropdown-item v-else command="unpublish">{{
                    t('coursewareManage.actions.unpublish')
                  }}</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>{{
                    t('coursewareManage.actions.delete')
                  }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <div class="empty-icon"><Icon icon="ep:search" /></div>
        <p class="empty-title">{{ t('coursewareManage.empty.title') }}</p>
        <p class="empty-desc">{{ t('coursewareManage.empty.description') }}</p>
        <button class="clear-button" type="button" @click="resetQuery">
          {{ t('coursewareManage.empty.clear') }}
        </button>
      </div>
    </div>

    <Pagination
      v-if="total > 0"
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <el-dialog
      v-model="catalogDialogVisible"
      :title="t('coursewareManage.catalogDialog.title')"
      width="560px"
    >
      <el-cascader
        v-model="catalogDialogKeys"
        class="w-full"
        :options="catalogTree"
        :props="catalogCascaderProps"
        filterable
        clearable
        collapse-tags
        collapse-tags-tooltip
        :placeholder="t('coursewareManage.catalogDialog.placeholder')"
      />
      <template #footer>
        <el-button @click="catalogDialogKeys = []">{{
          t('coursewareManage.catalogDialog.clear')
        }}</el-button>
        <el-button @click="catalogDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="catalogSaving" @click="saveCatalogRelation">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '@/utils/formatTime'
import {
  CoursewareApi,
  CoursewarePageReqVO,
  CoursewareVO,
  type CoursewareCatalogOptionsVO
} from '@/api/courseware'
import { buildCatalogTree, joinCatalogKeys, splitCatalogKeys } from '../catalog'
import { useCoursewareGenerationStore } from '@/store/modules/coursewareGeneration'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { buildSearchSuggestions, type SearchSuggestion } from '@/utils/searchSuggestion'

/** 在线课件 - 课件管理 */
defineOptions({ name: 'CoursewareManage' })

const message = useMessage()
const { t } = useI18n()
const router = useRouter()
const generationStore = useCoursewareGenerationStore()

const DEFAULT_TAGS = ['全部', '护肤', '彩妆', '香水', '销售技巧', '专业知识', '客户关系']
const DEFAULT_TAG_LABEL_KEYS: Record<string, string> = {
  全部: 'coursewareManage.quickTags.all',
  护肤: 'coursewareManage.quickTags.skincare',
  彩妆: 'coursewareManage.quickTags.makeup',
  香水: 'coursewareManage.quickTags.fragrance',
  销售技巧: 'coursewareManage.quickTags.salesSkills',
  专业知识: 'coursewareManage.quickTags.productKnowledge',
  客户关系: 'coursewareManage.quickTags.customerRelations'
}
const COURSEWARE_PUBLISHED_STATUS = 20
const MAX_VISIBLE_COURSE_TAGS = 3
const MAX_COVER_SYNC_ATTEMPTS = 3

const loading = ref(false)
const list = ref<CoursewareVO[]>([])
const total = ref(0)
const tags = ref<string[]>([])
const selectedTag = ref<string>()
const copiedId = ref<number>()
const syncingCoverIds = new Set<number>()
const coverSyncAttempts = new Map<number, number>()
const coverFailedIds = reactive(new Set<number>())
const regeneratingHomeworkIds = reactive(new Set<number>())
const catalogOptions = ref<CoursewareCatalogOptionsVO>()
const catalogDialogVisible = ref(false)
const catalogDialogKeys = ref<string[]>([])
const catalogEditingCoursewareId = ref<number>()
const catalogSaving = ref(false)
const catalogTree = computed(() => buildCatalogTree(catalogOptions.value))
const catalogCascaderProps = { multiple: true, checkStrictly: true, emitPath: false }
const queryParams = reactive<CoursewarePageReqVO>({
  pageNo: 1,
  pageSize: 12,
  keyword: undefined,
  status: undefined,
  tag: undefined,
  tags: undefined,
  sort: 'createTime_desc',
  brandIds: undefined,
  categoryIds: undefined,
  productIds: undefined
})
const filteredCatalogCategories = computed(() => {
  const brandIds = new Set(queryParams.brandIds || [])
  if (!brandIds.size) return catalogOptions.value?.categories || []
  return (catalogOptions.value?.categories || []).filter((category) =>
    brandIds.has(category.brandId)
  )
})
const selectedCategoryTreeIds = computed(() => {
  const selectedIds = new Set(queryParams.categoryIds || [])
  if (!selectedIds.size) return selectedIds
  const categories = catalogOptions.value?.categories || []
  const parentById = new Map(categories.map((category) => [category.id, category.parentId]))
  const belongsToSelection = (categoryId: number) => {
    let currentId: number | undefined = categoryId
    const visited = new Set<number>()
    while (currentId && !visited.has(currentId)) {
      if (selectedIds.has(currentId)) return true
      visited.add(currentId)
      currentId = parentById.get(currentId)
    }
    return false
  }
  return new Set(
    categories.filter((category) => belongsToSelection(category.id)).map((category) => category.id)
  )
})
const filteredCatalogProducts = computed(() => {
  const brandIds = new Set(queryParams.brandIds || [])
  const categoryIds = selectedCategoryTreeIds.value
  return (catalogOptions.value?.products || []).filter(
    (product) =>
      (!brandIds.size || brandIds.has(product.brandId)) &&
      (!categoryIds.size || categoryIds.has(product.categoryId))
  )
})

const normalizeTag = (tag?: string) => (tag || '').trim()
const uniqueTags = computed(() => Array.from(new Set(tags.value.map(normalizeTag).filter(Boolean))))
const quickTagOptions = computed(() => uniqueTags.value.slice(0, 5))
const tagOptions = computed(() =>
  Array.from(new Set([...DEFAULT_TAGS.filter((tag) => tag !== '全部'), ...uniqueTags.value]))
)
const tagLabel = (tag: string) => {
  const key = DEFAULT_TAG_LABEL_KEYS[tag]
  return key ? t(key) : tag
}
const sortLabel = computed(() =>
  queryParams.sort === 'createTime_asc'
    ? t('coursewareManage.sort.earliestCreated')
    : t('coursewareManage.sort.latestCreated')
)
const formatCourseDate = (date?: Date) => (date ? formatDate(date, 'YYYY-MM-DD') : '')
const formatAreaNames = (areaNames?: string[]) => (areaNames?.length ? areaNames.join('、') : '-')
const formatEstimatedDuration = (seconds?: number | null) => {
  const normalizedSeconds = Number(seconds)
  if (Number.isFinite(normalizedSeconds) && normalizedSeconds > 0) {
    return t('coursewareManage.card.estimatedDuration', {
      minutes: Math.ceil(normalizedSeconds / 60)
    })
  }
  return t('coursewareManage.card.estimatedDurationPending')
}
const visibleCourseTags = (course: CoursewareVO) =>
  (course.tags || []).slice(0, MAX_VISIBLE_COURSE_TAGS)
const hiddenCourseTags = (course: CoursewareVO) =>
  (course.tags || []).slice(MAX_VISIBLE_COURSE_TAGS)
const hiddenCourseTagCount = (course: CoursewareVO) => hiddenCourseTags(course).length
const getCourseCoverUrl = (course: CoursewareVO) =>
  course.coverNeedsSync || (course.id != null && coverFailedIds.has(course.id))
    ? ''
    : course.coverUrl

/**
 * 封面图加载失败时回落到渐变占位。
 * 直接留着坏掉的 <img> 会显示成一块空白，视觉上和“课件本身空白”无法区分。
 */
const handleCoverError = (course: CoursewareVO) => {
  if (course.id == null) return
  coverFailedIds.add(course.id)
}
const hasCatalogRelation = (course: CoursewareVO) =>
  Boolean(course.catalogBrandCount || course.catalogCategoryCount || course.catalogProductCount)
const catalogSummary = (course: CoursewareVO) => {
  const brand = course.catalogBrands?.[0]
  const category = course.catalogCategories?.[0]
  const product = course.catalogProducts?.[0]
  const parts: string[] = []
  if (brand) {
    const extra = Math.max(0, (course.catalogBrandCount || 0) - 1)
    parts.push(`${brand.name}${extra ? ` +${extra}` : ''}`)
  }
  if (category) {
    const extra = Math.max(0, (course.catalogCategoryCount || 0) - 1)
    parts.push(`${category.pathName || category.name}${extra ? ` +${extra}` : ''}`)
  }
  if (product) {
    const extra = Math.max(0, (course.catalogProductCount || 0) - 1)
    parts.push(`${product.name}${extra ? ` +${extra}` : ''}`)
  }
  return parts.join(' · ')
}
const catalogTooltip = (course: CoursewareVO) =>
  [
    ...(course.catalogBrands || []).map((item) => item.name),
    ...(course.catalogCategories || []).map((item) => item.pathName || item.name),
    ...(course.catalogProducts || []).map((item) => item.name)
  ].join('、')
const isOpenMaicPreview = (previewUrl?: string) =>
  !!previewUrl && previewUrl.includes('/classroom/')
const getGenerationTypeLabel = (mode?: CoursewareVO['documentProcessingMode']) => {
  if (mode === 'parse') return t('coursewareManage.card.generationTypeAi')
  if (mode === 'direct') return t('coursewareManage.card.generationTypeDirect')
  return ''
}
const getHomeworkGenerationLabel = (enabled?: boolean | null) => {
  if (enabled === true) return t('coursewareManage.card.homeworkGenerationEnabled')
  return t('coursewareManage.card.homeworkGenerationDisabled')
}
const getHomeworkGenerationTagClass = (enabled?: boolean | null) => {
  if (enabled === true) return 'homework-generation-tag--enabled'
  return 'homework-generation-tag--disabled'
}

const getList = async () => {
  loading.value = true
  try {
    const data = await CoursewareApi.getCoursewarePage(queryParams)
    list.value = data?.list || []
    total.value = data?.total || 0
    coverFailedIds.clear()
    syncCoursewareCovers(list.value)
  } finally {
    loading.value = false
  }
}

const syncCoursewareCovers = (courses: CoursewareVO[]) => {
  courses
    .filter(
      (course) =>
        course.id &&
        isOpenMaicPreview(course.previewUrl) &&
        (course.coverNeedsSync || !course.coverUrl)
    )
    .forEach((course) => {
      const id = course.id!
      if (syncingCoverIds.has(id)) return
      // OpenMAIC 首图在子课件刚生成完时可能还没渲染好，重进列表要能再试；
      // 但对始终取不到封面的课件设上限，避免每次刷新都白跑一轮请求。
      const attempts = coverSyncAttempts.get(id) || 0
      if (attempts >= MAX_COVER_SYNC_ATTEMPTS) return
      coverSyncAttempts.set(id, attempts + 1)
      syncingCoverIds.add(id)
      void CoursewareApi.syncCoursewareCoverUrl(id)
        .then((coverUrl) => {
          if (!coverUrl) return
          const current = list.value.find((item) => item.id === id)
          if (!current) return
          current.coverUrl = coverUrl
          current.coverNeedsSync = false
          coverFailedIds.delete(id)
          coverSyncAttempts.delete(id)
        })
        .catch(() => {
          // Best effort only.
        })
        .finally(() => syncingCoverIds.delete(id))
    })
}

const getTags = async () => {
  const data = await CoursewareApi.getCoursewareTags()
  tags.value = data || []
  if (selectedTag.value && !tagOptions.value.includes(selectedTag.value)) {
    selectedTag.value = undefined
    syncTagQuery()
  }
}

const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}
const fetchCoursewareSuggestions = (
  keyword: string,
  callback: (suggestions: SearchSuggestion[]) => void
) => {
  const value = keyword.trim()
  if (!value) return callback([])
  void CoursewareApi.getCoursewarePage({
    ...queryParams,
    pageNo: 1,
    pageSize: 50,
    keyword: value
  })
    .then((data) =>
      callback(
        buildSearchSuggestions(data?.list || [], value, (item: CoursewareVO) => [
          item.title,
          item.summary
        ])
      )
    )
    .catch(() => callback([]))
}
const handleCoursewareSuggestionSelect = (suggestion: SearchSuggestion) => {
  queryParams.keyword = suggestion.value
  handleQuery()
}

const syncTagQuery = () => {
  const value = normalizeTag(selectedTag.value)
  queryParams.tag = value || undefined
  queryParams.tags = value ? [value] : undefined
}

const handleTagChange = () => {
  syncTagQuery()
  handleQuery()
}

const retainValidSelection = (selectedIds: number[] | undefined, validIds: Set<number>) => {
  const retained = (selectedIds || []).filter((id) => validIds.has(id))
  return retained.length ? retained : undefined
}

const handleBrandFilterChange = () => {
  queryParams.categoryIds = retainValidSelection(
    queryParams.categoryIds,
    new Set(filteredCatalogCategories.value.map((category) => category.id))
  )
  queryParams.productIds = retainValidSelection(
    queryParams.productIds,
    new Set(filteredCatalogProducts.value.map((product) => product.id))
  )
  handleQuery()
}

const handleCategoryFilterChange = () => {
  queryParams.productIds = retainValidSelection(
    queryParams.productIds,
    new Set(filteredCatalogProducts.value.map((product) => product.id))
  )
  handleQuery()
}

const resetQuery = () => {
  queryParams.keyword = undefined
  queryParams.status = undefined
  queryParams.tag = undefined
  queryParams.tags = undefined
  queryParams.sort = 'createTime_desc'
  queryParams.categoryIds = undefined
  queryParams.brandIds = undefined
  queryParams.productIds = undefined
  selectedTag.value = undefined
  handleQuery()
}

const isQuickTagActive = (tag: string) => selectedTag.value === tag

const toggleQuickTag = (tag: string) => {
  selectedTag.value = selectedTag.value === tag ? undefined : tag
  syncTagQuery()
  handleQuery()
}

const handleSortCommand = (command: string) => {
  queryParams.sort = command
  handleQuery()
}

const goCreate = async () => {
  const context = generationStore.captureTaskContext()
  const activeTask = await CoursewareApi.getActiveGenerationTask()
  if (!generationStore.setTask(activeTask, context)) return
  if (activeTask?.id) {
    router.push({ name: 'CoursewareCreate', query: { taskId: activeTask.id } })
    return
  }
  router.push({ name: 'CoursewareCreate' })
}

const handleEdit = (row: CoursewareVO) => {
  if (!row.id) {
    message.warning(t('coursewareManage.messages.missingId'))
    return
  }
  router.push({
    name: 'CoursewareCreate',
    query: { coursewareId: row.id }
  })
}

const handleHomework = () => {
  router.push('/task-center/study')
}

const handleAddHomework = (row: CoursewareVO) => {
  router.push({ path: '/assignment-exam/homework', query: { coursewareId: row.id } })
}

const handleRegenerateHomework = async (row: CoursewareVO) => {
  if (!row.id || regeneratingHomeworkIds.has(row.id)) return
  await ElMessageBox.confirm(
    t('coursewareManage.messages.homeworkRegenerateConfirm', { title: row.title }),
    t('coursewareManage.messages.homeworkRegenerateTitle'),
    {
      confirmButtonText: t('coursewareManage.messages.homeworkRegenerateStart'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  )
  regeneratingHomeworkIds.add(row.id)
  try {
    await CoursewareApi.regenerateHomework(row.id)
    message.success(t('coursewareManage.messages.homeworkRegenerateSubmitted'))
  } finally {
    regeneratingHomeworkIds.delete(row.id)
  }
}

const handleExport = async (row: CoursewareVO) => {
  if (!row.id) return
  const downloadUrl = row.downloadUrl
  if (!downloadUrl) {
    message.warning(t('coursewareManage.messages.missingDownloadUrl'))
    return
  }
  window.open(downloadUrl, '_blank')
}

const handlePublish = async (id?: number) => {
  if (!id) return
  await CoursewareApi.publishCourseware(id)
  message.success(t('coursewareManage.messages.publishSuccess'))
  getList()
}

const handleUnpublish = async (id?: number) => {
  if (!id) return
  await CoursewareApi.unpublishCourseware(id)
  message.success(t('coursewareManage.messages.unpublishSuccess'))
  getList()
}

const handleCopyLink = async (id?: number) => {
  if (!id) return
  const link = await CoursewareApi.copyCoursewareLink(id)
  await navigator.clipboard?.writeText(link)
  copiedId.value = id
  message.success(t('coursewareManage.messages.linkCopied'))
  window.setTimeout(() => {
    if (copiedId.value === id) copiedId.value = undefined
  }, 2000)
}

const handleDelete = async (id?: number) => {
  if (!id) return
  try {
    await message.delConfirm()
    await CoursewareApi.deleteCourseware(id)
    message.success(t('common.delSuccess'))
    await getList()
    await getTags()
  } catch {}
}

const handleRename = async (row: CoursewareVO) => {
  if (!row.id) return
  const result = await ElMessageBox.prompt(
    t('coursewareManage.rename.prompt'),
    t('coursewareManage.rename.title'),
    {
      inputValue: row.title,
      inputPattern: /\S/,
      inputErrorMessage: t('coursewareManage.rename.required'),
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel')
    }
  ).catch(() => undefined)
  const title = String(result?.value || '').trim()
  if (!title || title === row.title) return
  await CoursewareApi.updateCoursewareTitle({ id: row.id, title })
  row.title = title
  message.success(t('coursewareManage.rename.success'))
}

const handleMoreCommand = (command: string, row: CoursewareVO) => {
  if (command === 'rename') handleRename(row)
  if (command === 'publish') handlePublish(row.id)
  if (command === 'unpublish') handleUnpublish(row.id)
  if (command === 'delete') handleDelete(row.id)
  if (command === 'catalog') openCatalogDialog(row)
}

const openCatalogDialog = async (row: CoursewareVO) => {
  if (!row.id) return
  const relation = await CoursewareApi.getCatalogRelation(row.id)
  catalogEditingCoursewareId.value = row.id
  catalogDialogKeys.value = joinCatalogKeys(
    relation.brandIds,
    relation.categoryIds,
    relation.productIds
  )
  catalogDialogVisible.value = true
}

const saveCatalogRelation = async () => {
  if (!catalogEditingCoursewareId.value) return
  catalogSaving.value = true
  try {
    const selection = splitCatalogKeys(catalogDialogKeys.value)
    await CoursewareApi.replaceCatalogRelation({
      coursewareId: catalogEditingCoursewareId.value,
      ...selection
    })
    catalogDialogVisible.value = false
    await getList()
    message.success(t('coursewareManage.catalogDialog.saved'))
  } finally {
    catalogSaving.value = false
  }
}

const getThumbClass = (index: number) => `thumb-${(index % 8) + 1}`

const formatCount = (count: number) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)

onMounted(async () => {
  catalogOptions.value = await CoursewareApi.getCatalogOptions()
  getList()
  getTags()
})
</script>

<style scoped lang="scss">
.courseware-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;
  padding: 8px 0 24px;
}

.catalog-filter-select {
  flex: 1 1 180px;
  min-width: 160px;
}

.catalog-summary {
  min-height: 22px;
  color: #766f73;
  font-size: 12px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--beauty-text);
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--beauty-text-muted);
}

.toolbar-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  margin-bottom: 24px;
  background: var(--beauty-card-bg);
  border: 1px solid var(--beauty-border);
  border-radius: 16px;
  box-shadow: var(--beauty-shadow-soft);
  align-items: stretch;
  gap: 16px;
}

.tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.tag-button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #5d565a;
  background: #f8f5f3;
  border: 1px solid var(--beauty-border);
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: #f1ece8;
  }

  &.active {
    color: #fff;
    background: var(--beauty-brand);
    border-color: var(--beauty-brand);
    box-shadow: 0 1px 2px rgb(var(--el-color-primary-rgb) / 18%);
  }
}

.toolbar-actions {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

:deep(.tag-search-select) {
  flex: 1.35 1 230px;
  min-width: 200px;

  .el-select__wrapper {
    min-height: 38px;
    border-radius: 12px;
  }
}

.search-box {
  position: relative;
  flex: 1.35 1 240px;
  min-width: 220px;

  :deep(.el-autocomplete) {
    width: 100%;
  }

  :deep(.el-input__wrapper) {
    height: 38px;
    font-size: 14px;
    border: 1px solid var(--beauty-border);
    border-radius: 12px;
    box-shadow: none;
    transition: all 0.2s;

    &.is-focus {
      border-color: var(--beauty-brand);
      box-shadow: 0 0 0 3px rgb(var(--el-color-primary-rgb) / 20%);
    }
  }
}

.sort-button,
.clear-filter-button,
.create-button {
  display: inline-flex;
  height: 38px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 12px;
  transition: all 0.2s;
  align-items: center;
  gap: 8px;
}

.sort-button {
  color: #3f3a3d;
  background: var(--beauty-card-bg);
  border: 1px solid var(--beauty-border);

  &:hover {
    background: #f8f5f3;
  }
}

.clear-filter-button {
  color: var(--beauty-text-muted);
  background: var(--beauty-card-bg);
  border: 1px solid var(--beauty-border);

  &:hover {
    color: var(--beauty-brand);
    background: #f8f5f3;
  }
}

.sort-icon {
  color: var(--beauty-text-muted);
}

.chevron-icon {
  width: 12px;
  height: 12px;
  color: #9a9396;
}

.create-button {
  color: #fff;
  background: var(--beauty-brand);
  border: 0;

  &:hover {
    background: #974f3e;
  }
}

.course-grid-wrap {
  min-height: 360px;
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  padding-bottom: 32px;
}

.course-card {
  display: flex;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e9e4df;
  border-radius: 16px;
  outline: none;
  transition: all 0.3s;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow:
      0 20px 25px -5px rgb(36 31 36 / 12%),
      0 8px 10px -6px rgb(36 31 36 / 10%);
  }

  &:focus-visible {
    transform: translateY(-4px);
    box-shadow:
      0 0 0 3px rgb(var(--el-color-primary-rgb) / 30%),
      0 20px 25px -5px rgb(36 31 36 / 12%),
      0 8px 10px -6px rgb(36 31 36 / 10%);
  }
}

.thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.thumb-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-1 {
  background: linear-gradient(135deg, #f2d8dd, #ddb9c1);
}

.thumb-2 {
  background: linear-gradient(135deg, #efe0d6, #d8bbaa);
}

.thumb-3 {
  background: linear-gradient(135deg, #e3ece7, #c7d8d0);
}

.thumb-4 {
  background: linear-gradient(135deg, #e7d6b4, #cdbb8b);
}

.thumb-5 {
  background: linear-gradient(135deg, #e6c8ce, #cfa2aa);
}

.thumb-6 {
  background: linear-gradient(135deg, #e7e4e2, #cdc7c3);
}

.thumb-7 {
  background: linear-gradient(135deg, #e2ded9, #c9c1bb);
}

.thumb-8 {
  background: linear-gradient(135deg, var(--beauty-border), #cbc0b8);
}

.thumb-mask {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 10%);
  transition:
    opacity 0.3s ease,
    background 0.3s ease;
}

.course-card:hover .thumb-mask,
.course-card:focus-visible .thumb-mask {
  background: rgb(0 0 0 / 60%);
}

.view-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: inline-flex;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: rgb(0 0 0 / 40%);
  border-radius: 999px;
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
}

.generation-type-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  display: inline-flex;
  max-width: calc(100% - 76px);
  min-height: 24px;
  padding: 4px 8px;
  overflow: hidden;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid transparent;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  align-items: center;
  gap: 4px;

  .iconify {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
  }
}

.generation-type-badge--parse {
  color: #9f1239;
  background: rgb(255 241 242 / 94%);
  border-color: #fecdd3;
}

.generation-type-badge--direct {
  color: #1d4ed8;
  background: rgb(239 246 255 / 94%);
  border-color: #bfdbfe;
}

.course-card:hover .view-badge,
.course-card:focus-visible .view-badge {
  opacity: 0;
  transform: translateY(-4px);
}

.hover-meta {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 6;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.hover-meta-stack {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;

  span {
    display: inline-flex;
    align-self: flex-start;
    padding: 4px 8px;
    font-size: 10px;
    color: rgb(255 255 255 / 90%);
    background: rgb(0 0 0 / 40%);
    border-radius: 4px;
    backdrop-filter: blur(6px);
    box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  }
}

.course-card:hover .hover-meta,
.course-card:focus-visible .hover-meta {
  opacity: 1;
  transform: translateY(0);
}

.hover-actions {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  pointer-events: none;
  backdrop-filter: blur(2px);
  transition: opacity 0.3s ease;
}

.course-card:hover .hover-actions,
.course-card:focus-visible .hover-actions {
  opacity: 1;
  pointer-events: auto;
}

.hover-action {
  position: relative;
  display: inline-flex;
  width: 32px;
  height: 32px;
  color: #fff;
  background: rgb(255 255 255 / 20%);
  border: 0;
  border-radius: 999px;
  box-shadow: 0 10px 20px rgb(0 0 0 / 14%);
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
  align-items: center;
  justify-content: center;
  pointer-events: auto;

  .iconify {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: rgb(255 255 255 / 42%);
    box-shadow: 0 14px 24px rgb(0 0 0 / 18%);
    transform: scale(1.1);
  }

  &.copied {
    background: rgb(255 255 255 / 32%);
  }
}

.hover-action--primary {
  width: 44px;
  height: 44px;
  background: rgb(255 255 255 / 30%);

  .iconify {
    width: 16px;
    height: 16px;
  }
}

.hover-action-label {
  position: absolute;
  bottom: -20px;
  left: 50%;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgb(0 0 0 / 45%);
  opacity: 0;
  transform: translateX(-50%);
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.hover-action:hover .hover-action-label,
.hover-action:focus-visible .hover-action-label {
  opacity: 1;
}

.card-body {
  padding: 16px;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 20px;
  margin-bottom: 8px;
  padding-right: 16px;
}

.course-tag {
  max-width: 110px;
  padding: 2px 6px;
  overflow: hidden;
  font-size: 9px;
  font-weight: 800;
  color: var(--beauty-brand);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #fff1f2;
  border: 1px solid #ffe4e6;
  border-radius: 4px;

  &.muted {
    color: #9a9396;
    background: #f8f5f3;
    border-color: var(--beauty-border);
  }
}

.area-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  padding: 2px 6px;
  overflow: hidden;
  font-size: 9px;
  font-weight: 800;
  color: var(--beauty-brand);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #fff1f2;
  border: 1px solid #ffe4e6;
  border-radius: 4px;
}

.status-tag {
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
  border: 1px solid transparent;
  border-radius: 4px;
}

.status-tag--published {
  color: #16a34a;
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.status-tag--draft {
  color: #9a3412;
  background: #fff7ed;
  border-color: #fed7aa;
}

.homework-generation-tag {
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
  border: 1px solid transparent;
  border-radius: 4px;
}

.homework-generation-tag--enabled {
  color: #1d4ed8;
  background: #eff6ff;
  border-color: #bfdbfe;
}

.homework-generation-tag--disabled {
  color: #6b7280;
  background: #f9fafb;
  border-color: #e5e7eb;
}

.homework-generation-tag--unknown {
  color: #a16207;
  background: #fefce8;
  border-color: #fef08a;
}

.area-tag :deep(svg) {
  flex: 0 0 auto;
  width: 11px;
  height: 11px;
}

.course-title {
  margin: 0 0 4px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
  color: var(--beauty-text);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
}

.course-card:hover .course-title {
  color: var(--beauty-brand);
}

.course-desc {
  display: -webkit-box;
  min-height: 28px;
  margin: 0;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.45;
  color: var(--beauty-text-muted);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-footer {
  position: relative;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin-top: auto;
  border-top: 1px solid #f8fafc;

  span {
    font-size: 10px;
    font-weight: 600;
    color: #9a9396;
  }
}

.footer-meta {
  display: flex;
  min-width: 0;
  gap: 4px;
  align-items: flex-start;
  flex: 1;
  flex-direction: column;
}

.course-duration {
  display: inline-flex;
  min-width: 0;
  gap: 3px;
  align-items: center;
  line-height: 1.3;
}

.more-button {
  position: relative;
  z-index: 7;
  display: inline-flex;
  width: 28px;
  height: 28px;
  color: #9a9396;
  background: transparent;
  border: 0;
  border-radius: 999px;
  transition:
    color 0.2s ease,
    background 0.2s ease;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--beauty-brand);
    background: rgb(var(--el-color-primary-rgb) / 8%);
  }
}

.empty-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  text-align: center;
}

.empty-icon {
  display: flex;
  width: 64px;
  height: 64px;
  margin-bottom: 12px;
  font-size: 32px;
  color: #9a9396;
  background: #f1ece8;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
}

.empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #5d565a;
}

.empty-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9a9396;
}

.clear-button {
  padding: 8px 16px;
  margin-top: 16px;
  font-size: 12px;
  font-weight: 800;
  color: var(--beauty-brand);
  background: #fff1f2;
  border: 0;
  border-radius: 8px;

  &:hover {
    background: #ffe4e6;
  }
}

@media (width <= 1280px) {
  .course-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width <= 1024px) {
  .search-box,
  .tag-search-select {
    flex-basis: calc(50% - 6px);
  }

  .course-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 640px) {
  .catalog-filter-select,
  .search-box,
  .tag-search-select {
    flex-basis: 100%;
    width: 100%;
  }

  .course-grid {
    grid-template-columns: 1fr;
  }
}
</style>
