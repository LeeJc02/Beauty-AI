<script setup lang="ts">
/**
 * 品类设置（原型 `src/pages/CategoryManage.tsx`，仅超级管理员可见）。
 *
 * 分类体系直接沿用原型：一级分类由题库的 `QUESTION_TAXONOMY.productLines` 推导，
 * 「已关联内容数」按原型写死的序列（护肤品 42 / 彩妆 18 / 护发 5 / 化妆品 0 / 通用能力 8），
 * 二级标签取该产品线下的商品名。通用能力线不允许再加二级标签。
 *
 * 与原型一致的取舍：原型里的「编辑 / 删除 / 增加二级标签」是占位按钮（无 handler），
 * 这里保持原样不做动作，避免引入原型没有的弹窗与新文案。
 */
import { GENERAL_CAPABILITY_LINE_ID, QUESTION_TAXONOMY } from '@/beauty/lib/questionBank'
import { useBeautyI18n } from '@/beauty/composables'

defineOptions({ name: 'BeautyCategories' })

interface CategoryItem {
  id: string
  name: string
  /** 已关联内容数 */
  count: number
  /** 二级标签（商品名） */
  sub: string[]
  allowSubCategory: boolean
}

/** 原型 MOCK_CATEGORIES 里写死的关联条数，下标与 QUESTION_TAXONOMY.productLines 对齐。 */
const CONTENT_COUNTS = [42, 18, 5]

const buildCategories = (): CategoryItem[] =>
  QUESTION_TAXONOMY.productLines.map((line, index) => ({
    id: line.id,
    name: line.name,
    count: line.id === GENERAL_CAPABILITY_LINE_ID ? 8 : (CONTENT_COUNTS[index] ?? 0),
    sub: line.products.map((product) => product.name),
    allowSubCategory: line.id !== GENERAL_CAPABILITY_LINE_ID
  }))

const { t } = useBeautyI18n()

const categories = ref<CategoryItem[]>(buildCategories())
const newCat = ref('')

/** 等价原型 handleAddCat：空名直接忽略，新增的一级分类默认允许二级标签。 */
const handleAddCat = () => {
  if (!newCat.value.trim()) return
  categories.value = [
    ...categories.value,
    { id: `cat_${Date.now()}`, name: newCat.value, count: 0, sub: [], allowSubCategory: true }
  ]
  newCat.value = ''
}
</script>

<template>
  <div class="flex h-[calc(100vh-11.5rem)] min-h-[560px] flex-1 flex-col pt-2">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-[#1F1C1F]">全局品类与标签配置</h2>
        <p class="mt-1 text-sm text-[#766F73]">
          管理业务分类体系，变更将自动同步至题库、知识图谱及所有业务课件内容
        </p>
      </div>
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-3">
      <div class="col-span-2 flex h-full min-h-0 flex-col">
        <div
          class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm"
        >
          <div class="flex items-center border-b border-slate-50 bg-[#F8F5F3]/50 p-5">
            <Icon icon="lucide:tag" :size="16" class="mr-2 text-rose-600" />
            <span class="text-base font-bold">一级分类管理</span>
          </div>

          <div class="flex-1 overflow-auto p-5">
            <div class="space-y-4">
              <div
                v-for="cat in categories"
                :key="cat.id"
                class="flex flex-col rounded-xl border border-[#E5DED8] bg-white p-4 transition-colors hover:border-rose-200"
              >
                <div class="mb-3 flex items-center justify-between">
                  <div data-i18n-skip="true" class="font-bold text-[#242124]">{{ cat.name }}</div>
                  <div class="flex space-x-2">
                    <div
                      class="flex items-center rounded bg-slate-100 px-2 py-1 text-xs font-medium text-[#766F73]"
                    >
                      <Icon icon="lucide:link-2" :size="12" class="mr-1" />
                      {{ t(`已关联 ${cat.count} 项内容`) }}
                    </div>
                    <button
                      type="button"
                      class="h-6 rounded-lg border border-[#E5DED8] bg-white px-2 text-xs text-[#242124] transition-colors hover:bg-[#F8F5F3]"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      class="h-6 rounded-lg border border-[#E5DED8] bg-white px-2 text-xs text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="sub in cat.sub"
                    :key="sub"
                    data-i18n-skip="true"
                    class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-[#E5DED8] bg-[#F8F5F3] px-2 py-0.5 text-xs font-normal whitespace-nowrap text-[#5D565A]"
                  >
                    {{ sub }}
                  </span>
                  <span
                    v-if="cat.allowSubCategory"
                    class="inline-flex h-5 w-fit shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-[#E5DED8] bg-white px-2 py-0.5 text-xs whitespace-nowrap text-[#9A9396] transition-colors hover:border-rose-300 hover:text-rose-600"
                  >
                    <Icon icon="lucide:plus" :size="12" class="mr-1" /> 增加二级标签
                  </span>
                  <span
                    v-else
                    class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-dashed border-[#E5DED8] bg-white px-2 py-0.5 text-xs whitespace-nowrap text-[#9A9396]"
                  >
                    标签自定义细分
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex space-x-3 border-t border-[#E9E4DF] bg-[#F8F5F3]/50 p-4">
            <input
              v-model="newCat"
              type="text"
              placeholder="输入新分类名称"
              class="min-w-0 flex-1 rounded-lg border border-[#E5DED8] bg-white px-3 py-2 text-sm text-[#242124] shadow-sm transition-colors outline-none placeholder:text-[#9A9396] focus:border-[#A85F4B] focus:ring-2 focus:ring-[#A85F4B]/20"
              @keyup.enter="handleAddCat"
            />
            <el-button
              type="primary"
              class="!shrink-0 !border-rose-600 !bg-rose-600 !text-white shadow-sm hover:!border-rose-700 hover:!bg-rose-700"
              @click="handleAddCat"
            >
              添加一级分类
            </el-button>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="rounded-2xl border border-[#E9E4DF] bg-rose-50/30 shadow-sm">
          <div class="flex items-center p-5">
            <Icon icon="lucide:settings" :size="16" class="mr-2 text-rose-600" />
            <span class="text-base font-bold">同步规则设置</span>
          </div>
          <div class="space-y-4 p-5 pt-0">
            <div class="rounded-lg border border-[#E5DED8] bg-white p-3 text-sm shadow-sm">
              <p class="mb-1 font-bold text-[#242124]">强制关联约束</p>
              <p class="text-xs text-[#766F73]">
                所有新生成的课件或场景剧本必须至少关联一个二级标签。
              </p>
            </div>
            <div class="rounded-lg border border-[#E5DED8] bg-white p-3 text-sm shadow-sm">
              <p class="mb-1 font-bold text-[#242124]">自动级联更新</p>
              <p class="text-xs text-[#766F73]">
                修改或合并标签名称时，底部所有历史内容将自动执行替换操作。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
