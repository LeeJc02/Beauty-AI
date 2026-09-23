<template>
  <div class="brand-catalog-manager">
    <el-button
      class="brand-catalog-trigger"
      circle
      size="small"
      :title="t('coursewareCreate.catalog.manage')"
      :aria-label="t('coursewareCreate.catalog.manage')"
      @click="visible = true"
    >
      <Icon icon="lucide:plus" class="h-3.5 w-3.5" />
    </el-button>
    <el-dialog
      v-model="visible"
      :title="t('coursewareCreate.catalog.manageTitle')"
      width="min(880px, calc(100vw - 32px))"
      align-center
      append-to-body
      :close-on-click-modal="false"
      :before-close="beforeClose"
      @open="reload"
      @closed="handleClosed"
    >
      <div class="brand-catalog-popover">
        <div class="brand-catalog-popover__header">
          <div>
            <p>{{ t('coursewareCreate.catalog.manageHint') }}</p>
          </div>
          <el-button link :loading="loading" @click="reload">
            <Icon icon="lucide:refresh-cw" class="mr-1.5 h-3.5 w-3.5" />
            {{ t('common.reload') }}
          </el-button>
        </div>

        <div class="brand-catalog-popover__notice">
          <Icon icon="lucide:info" class="h-4 w-4 shrink-0" />
          <span>{{ t('coursewareCreate.catalog.manageNotice') }}</span>
        </div>

        <div v-loading="loading" class="brand-catalog-tree">
          <el-tree
            v-if="tree.length"
            :data="tree"
            node-key="key"
            default-expand-all
            :expand-on-click-node="false"
          >
            <template #default="{ data }">
              <div class="brand-catalog-node">
                <span class="brand-catalog-node__label">
                  <Icon :icon="data.icon" class="mr-1.5 h-3.5 w-3.5" />
                  {{ data.label }}
                </span>
                <el-button
                  v-if="canAddChild(data)"
                  link
                  type="primary"
                  @click.stop="startAdd(data)"
                >
                  <Icon icon="lucide:plus" class="mr-1 h-3.5 w-3.5" />
                  {{ t('action.add') }}
                </el-button>
              </div>
            </template>
          </el-tree>
          <el-empty v-else :description="t('coursewareCreate.catalog.empty')" :image-size="72" />
        </div>

        <el-button
          v-if="canCreateCategory"
          class="brand-catalog-new-brand"
          size="small"
          @click="startAddBrand"
        >
          <Icon icon="lucide:plus" class="mr-1.5 h-3.5 w-3.5" />
          {{ t('coursewareCreate.catalog.addBrand') }}
        </el-button>
        <el-dialog
          :model-value="!!addTarget"
          :title="addTarget?.label"
          width="min(440px, calc(100vw - 32px))"
          append-to-body
          align-center
          :close-on-click-modal="false"
          :before-close="beforeClose"
          @update:model-value="cancelAdd"
        >
          <div v-if="addTarget" class="brand-catalog-add">
            <span class="brand-catalog-add__target">{{ addTarget.label }}</span>
            <el-input
              v-model="newName"
              :placeholder="t('coursewareCreate.catalog.addPlaceholder')"
              @keyup.enter="submitAdd"
            />
            <div class="brand-catalog-add__actions">
              <el-button size="small" @click="cancelAdd">{{ t('common.cancel') }}</el-button>
              <el-button size="small" type="primary" :loading="saving" @click="submitAdd">
                {{ t('action.add') }}
              </el-button>
            </div>
          </div>
        </el-dialog>
      </div>
      <template #footer>
        <el-button :disabled="saving" @click="visible = false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'
import { useMessage } from '@/hooks/web/useMessage'
import { CategorySettingsApi } from '@/api/categorySettings'
import { checkPermi } from '@/utils/permission'
import type { CoursewareCatalogOptionsVO } from '@/api/courseware'
import { CoursewareApi } from '@/api/courseware'
import { AiTrainingProductApi } from '@/api/ai-training/product'

defineOptions({ name: 'BrandCatalogPopover' })

const props = defineProps<{ language?: string }>()
const emit = defineEmits<{ refreshed: [] }>()
const { t } = useI18n()
const message = useMessage()
const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const canCreateCategory = computed(() => checkPermi(['ai:category:create']))
const canCreateProduct = computed(() => checkPermi(['ai:training-product:create']))
const options = ref<CoursewareCatalogOptionsVO>()
const newName = ref('')
type AddTarget = {
  type: 'brand' | 'category' | 'series' | 'product'
  label: string
  brandId?: number
  parentId?: number
  categoryId?: number
}
const addTarget = ref<AddTarget>()

interface TreeNode extends AddTarget {
  key: string
  icon: string
  children?: TreeNode[]
}

const tree = computed<TreeNode[]>(() => {
  const catalog = options.value
  if (!catalog) return []
  return catalog.brands.map((brand) => {
    const brandCategories = catalog.categories.filter((category) => category.brandId === brand.id)
    const roots = brandCategories.filter((category) => !category.parentId)
    const makeCategory = (category: (typeof catalog.categories)[number]): TreeNode => ({
      key: `category-${category.id}`,
      type: 'category',
      label: category.name,
      icon: 'lucide:folder',
      brandId: brand.id,
      parentId: category.id,
      children: [
        ...brandCategories
          .filter((child) => child.parentId === category.id)
          .map((child) => ({
            key: `series-${child.id}`,
            type: 'series' as const,
            label: child.name,
            icon: 'lucide:layers-3',
            brandId: brand.id,
            parentId: child.id,
            children: catalog.products
              .filter((product) => product.categoryId === child.id)
              .map((product) => ({
                key: `product-${product.id}`,
                type: 'product' as const,
                label: product.name,
                icon: 'lucide:package',
                brandId: brand.id,
                categoryId: child.id
              }))
          })),
        ...catalog.products
          .filter((product) => product.categoryId === category.id)
          .map((product) => ({
            key: `product-${product.id}`,
            type: 'product' as const,
            label: product.name,
            icon: 'lucide:package',
            brandId: brand.id,
            categoryId: category.id
          }))
      ]
    })
    return {
      key: `brand-${brand.id}`,
      type: 'brand',
      label: brand.name,
      icon: 'lucide:badge',
      brandId: brand.id,
      children: roots.map(makeCategory)
    }
  })
})

const reload = async () => {
  loading.value = true
  try {
    options.value = await CoursewareApi.getCatalogOptions()
  } finally {
    loading.value = false
  }
}

const canAddChild = (target: TreeNode) =>
  target.type === 'series'
    ? canCreateProduct.value
    : target.type !== 'product' && canCreateCategory.value

const startAddBrand = () => {
  addTarget.value = { type: 'brand', label: t('coursewareCreate.catalog.addBrand') }
  newName.value = ''
}

const startAdd = (target: TreeNode) => {
  if (!canAddChild(target)) return
  const type =
    target.type === 'brand' ? 'category' : target.type === 'category' ? 'series' : 'product'
  addTarget.value = {
    type,
    label: `${target.label} / ${t(`coursewareCreate.catalog.${type}`)}`,
    brandId: target.brandId,
    parentId: target.parentId,
    categoryId: target.parentId
  }
  newName.value = ''
}

const cancelAdd = () => {
  addTarget.value = undefined
  newName.value = ''
}

const beforeClose = (done: () => void) => {
  if (!saving.value) done()
}
const handleClosed = () => {
  cancelAdd()
  emit('refreshed')
}

const submitAdd = async () => {
  const target = addTarget.value
  const name = newName.value.trim()
  if (!target || !name || saving.value) return
  saving.value = true
  try {
    if (target.type === 'product' ? !canCreateProduct.value : !canCreateCategory.value) return
    if (target.type === 'brand') {
      await CategorySettingsApi.createBrand({
        name,
        lang: props.language || 'cn',
        sort: 0,
        status: 1
      })
    } else if (target.type === 'category') {
      await CategorySettingsApi.createCategory({
        brandId: target.brandId,
        name,
        sort: 0,
        status: 0
      })
    } else if (target.type === 'series') {
      await CategorySettingsApi.createTag({ categoryId: target.parentId!, name, sort: 0 })
    } else {
      await AiTrainingProductApi.create({
        brandId: target.brandId,
        categoryId: target.categoryId,
        lang: props.language || 'cn',
        name,
        status: 1,
        sort: 0
      })
    }
    message.success(t('coursewareCreate.catalog.addSuccess'))
    cancelAdd()
    await reload()
    emit('refreshed')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.brand-catalog-popover {
  color: #3f3a3d;
}
.brand-catalog-popover__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.brand-catalog-popover__header strong {
  font-size: 14px;
}
.brand-catalog-popover__header p {
  margin: 4px 0 0;
  color: #9a9396;
  font-size: 12px;
  line-height: 1.5;
}
.brand-catalog-popover__notice {
  display: flex;
  gap: 7px;
  margin: 12px 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff8f3;
  color: #8b6253;
  font-size: 12px;
  line-height: 1.5;
}
.brand-catalog-tree {
  height: min(380px, 42vh);
  overflow: auto;
  padding: 12px;
  border: 1px solid #eee8e4;
  border-radius: 12px;
  background: #fcfaf9;
}
.brand-catalog-tree :deep(.el-tree) {
  background: transparent;
}
.brand-catalog-tree :deep(.el-tree-node__content) {
  height: 38px;
  border-radius: 6px;
}
.brand-catalog-new-brand {
  margin-top: 12px;
}
.brand-catalog-node {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.brand-catalog-node__label {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.brand-catalog-add {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee8e4;
}
.brand-catalog-add__target {
  display: block;
  margin-bottom: 6px;
  color: #766f73;
  font-size: 12px;
}
.brand-catalog-add__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
