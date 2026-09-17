<script setup lang="ts">
/**
 * 金句库（原型 pages/BAQuotes.tsx，769 行）。
 *
 * 左侧是「品类 → 产品线 → 产品」三级树，右侧编辑产品基础信息、产品图与销售金句；
 * 另有「金句跟读预览」模拟学员 APP 端跟读界面，以及「引用素材」弹窗。
 */
import type { DerivedAssetReference, GoldenMaterial } from '@/beauty/types'
import { createDerivedAssetReferences } from '@/beauty/lib/materialLibraryData'
import EffectiveStatusBadge from '../components/EffectiveStatusBadge.vue'
import PracticePromptNotice from '../components/PracticePromptNotice.vue'
import MaterialReferenceDialog from '../components/MaterialReferenceDialog.vue'

defineOptions({ name: 'BeautyBaQuotes' })

type EffectiveStatus = 'pending' | 'active'

interface Quote {
  id: string
  text: string
  hint: string
  sourceReferences?: DerivedAssetReference[]
}

interface Product {
  id: string
  name: string
  description: string
  imageUrl?: string
  quotes: Quote[]
  effectiveStatus: EffectiveStatus
}

interface ProductLine {
  id: string
  name: string
  products: Product[]
}

interface ProductCategory {
  id: string
  name: string
  lines: ProductLine[]
}

const AI_TONE_BTN =
  '!h-8 !border !border-[#D8DEFF] !bg-[#EEF1FF] !text-[#515BCB] hover:!bg-[#E1E7FF] hover:!text-[#3F48B4] shadow-sm'
const AI_OUTLINE_BTN =
  '!h-8 !border-[#D8DEFF] !bg-[#EEF1FF] !text-[#515BCB] hover:!bg-[#E1E7FF] hover:!text-[#3F48B4]'
const NEUTRAL_OUTLINE_BTN = '!h-9 !border-[#E5DED8] !bg-white !text-[#3F3A3D] hover:!bg-[#F8F5F3]'

const INITIAL_DATA: ProductCategory[] = [
  {
    id: 'c1',
    name: '护肤品类',
    lines: [
      {
        id: 'l1',
        name: 'Barrier Shield 屏障修护系列',
        products: [
          {
            id: 'p1',
            name: 'BS B5高保湿面霜',
            description: '主打高浓度维他命B5与神经酰胺，适合干敏皮在换季或激光术后使用。',
            imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80',
            effectiveStatus: 'active',
            quotes: [
              {
                id: 'q1',
                text: '“这瓶面霜就像给肌肤穿上了一层隐形的拉链防风衣，特别适合现在这种容易换季泛红的天气。”',
                hint: '强调像衣服一样的保护感，适合秋冬/换季'
              },
              {
                id: 'q2',
                text: '“里面有黄金配比的神经酰胺，不是表面浮油，是真的能吃进皮肤里修护底子的。”',
                hint: '强调成分，针对顾客觉得其他面霜浮油的痛点'
              }
            ]
          },
          {
            id: 'p2',
            name: 'BS 急救舒缓精华',
            description: '高频次安抚敏感泛红，质地轻薄。',
            quotes: [],
            effectiveStatus: 'active'
          }
        ]
      },
      {
        id: 'l2',
        name: 'Radiance 极光透亮系列',
        products: [
          {
            id: 'p3',
            name: '极光焕白精华液',
            description: '阻断黑色素沉积，温和透亮。',
            quotes: [],
            effectiveStatus: 'active'
          }
        ]
      }
    ]
  },
  {
    id: 'c2',
    name: '彩妆品类',
    lines: [
      {
        id: 'l3',
        name: 'Flawless 丝绒底妆系列',
        products: [
          {
            id: 'p4',
            name: '丝绒持妆粉底液',
            description: '24小时长效贴合，打造高级哑光丝绒妆效。',
            quotes: [],
            effectiveStatus: 'active'
          }
        ]
      }
    ]
  }
]

const stripQuoteMarks = (text: string) => text.replace(/^[“"']+|[”"']+$/g, '').trim()

const splitQuoteForEmphasis = (text: string) => {
  const clean = stripQuoteMarks(text)
  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length >= 8) {
    return {
      lead: words.slice(0, 5).join(' '),
      highlight: words.slice(5, 8).join(' '),
      tail: words.slice(8).join(' ')
    }
  }

  const punctuationIndex = clean.search(/[，,。.!！?？]/)
  if (punctuationIndex > 5) {
    return {
      lead: clean.slice(0, punctuationIndex),
      highlight: clean.slice(punctuationIndex, punctuationIndex + 1),
      tail: clean.slice(punctuationIndex + 1)
    }
  }

  const midpoint = Math.max(4, Math.floor(clean.length * 0.45))
  const end = Math.min(clean.length, midpoint + Math.max(2, Math.floor(clean.length * 0.25)))
  return {
    lead: clean.slice(0, midpoint),
    highlight: clean.slice(midpoint, end),
    tail: clean.slice(end)
  }
}

const categories = ref<ProductCategory[]>(INITIAL_DATA)
const expandedItems = ref<Set<string>>(new Set(['c1', 'l1']))
const selectedProductId = ref('p1')
const showToast = ref(false)
const toastMessage = ref('产品库已保存')
const toastTone = ref<'success' | 'warning'>('success')
const previewOpen = ref(false)
const materialReferenceOpen = ref(false)
const previewActiveIndex = ref(0)
let toastTimer: ReturnType<typeof setTimeout> | null = null

const showFeedback = (
  message: string,
  tone: 'success' | 'warning' = 'success',
  duration = 2500
) => {
  toastMessage.value = message
  toastTone.value = tone
  showToast.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (showToast.value = false), duration)
}

const toggleExpand = (id: string) => {
  const next = new Set(expandedItems.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedItems.value = next
}

/** 从三级树里找出当前选中的产品，并返回面包屑。 */
const selectedRef = computed(() => {
  for (const category of categories.value) {
    for (const line of category.lines) {
      for (const product of line.products) {
        if (product.id === selectedProductId.value) {
          return { product, breadcrumbs: [category.name, line.name, product.name] }
        }
      }
    }
  }
  return { product: undefined, breadcrumbs: [] as string[] }
})

const selectedProduct = computed(() => selectedRef.value.product)
const breadcrumbs = computed(() => selectedRef.value.breadcrumbs)

const handleUpdateProduct = <K extends keyof Product>(field: K, value: Product[K]) => {
  categories.value = categories.value.map((category) => ({
    ...category,
    lines: category.lines.map((line) => ({
      ...line,
      products: line.products.map((product) =>
        product.id === selectedProductId.value
          ? ({ ...product, [field]: value, effectiveStatus: 'pending' } as Product)
          : product
      )
    }))
  }))
}

const handleUpdateQuote = (quoteId: string, field: keyof Quote, value: string) => {
  if (!selectedProduct.value) return
  handleUpdateProduct(
    'quotes',
    selectedProduct.value.quotes.map((quote) =>
      quote.id === quoteId ? { ...quote, [field]: value } : quote
    )
  )
}

const handleAddQuote = () => {
  if (!selectedProduct.value) return
  const newQuote: Quote = { id: Date.now().toString(), text: '', hint: '' }
  handleUpdateProduct('quotes', [...selectedProduct.value.quotes, newQuote])
}

const handleRemoveQuote = (quoteId: string) => {
  if (!selectedProduct.value) return
  handleUpdateProduct(
    'quotes',
    selectedProduct.value.quotes.filter((quote) => quote.id !== quoteId)
  )
}

const applyMaterialReference = (materials: GoldenMaterial[]) => {
  if (!selectedProduct.value || !materials.length) return
  const importedQuotes: Quote[] = materials.map((material) => ({
    id: `material-quote-${material.id}-${Date.now()}`,
    text: material.quoteText ?? `“${material.evidence[0]?.transcript ?? material.summary}”`,
    hint: `适用：${material.targetLabel}。${material.aiSummary ?? material.summary}`,
    sourceReferences: createDerivedAssetReferences('quote', [material])
  }))
  handleUpdateProduct('quotes', [...selectedProduct.value.quotes, ...importedQuotes])
  showFeedback(`已从素材库导入 ${importedQuotes.length} 条金句草稿`, 'success', 3000)
}

const handleGenerateQuotes = () => {
  const product = selectedProduct.value
  if (!product) return
  const productName = product.name.trim()
  const productDescription = product.description.trim()

  if (!productName || !productDescription) {
    showFeedback('请先填写产品名称和产品卖点', 'warning')
    return
  }

  const context =
    productDescription.length > 34 ? `${productDescription.slice(0, 34)}...` : productDescription
  const generatedQuotes: Quote[] = [
    {
      id: `${Date.now()}-quote-1`,
      text: `“${productName}适合先从肤感讲起，它不是单纯补水，而是帮肌肤把状态稳下来。”`,
      hint: `开场推荐，适合顾客还没有明确需求时，用“${context}”做温和引入。`
    },
    {
      id: `${Date.now()}-quote-2`,
      text: `“如果你担心护肤只是表面舒服，${productName}的重点就是让后续状态更稳定、更容易维持。”`,
      hint: '适合回应顾客担心效果短暂、只停留在肤感层面的疑虑。'
    },
    {
      id: `${Date.now()}-quote-3`,
      text: `“这款可以当作日常护理里的稳定器，换季、熬夜或状态波动时都更好衔接。”`,
      hint: '适合换季、作息不规律、皮肤状态反复的顾客。'
    },
    {
      id: `${Date.now()}-quote-4`,
      text: `“你可以先把${productName}理解成给皮肤打底，底子稳了，后面上妆和保养都会更听话。”`,
      hint: '适合有上妆、卡粉、保养吸收差等困扰的顾客。'
    },
    {
      id: `${Date.now()}-quote-5`,
      text: `“它的卖点不是夸张立刻变白变嫩，而是让皮肤慢慢回到更舒服、更可控的状态。”`,
      hint: '适合对功效承诺敏感、担心过度营销的理性顾客。'
    },
    {
      id: `${Date.now()}-quote-6`,
      text: `“如果你只想先入手一款不容易出错的护理品，${productName}会是很稳的第一步。”`,
      hint: '适合收口成交，帮助顾客降低选择成本。'
    }
  ]

  handleUpdateProduct('quotes', generatedQuotes)
  showFeedback('已生成 6 条销售金句', 'success')
}

const handleSave = () => {
  categories.value = categories.value.map((category) => ({
    ...category,
    lines: category.lines.map((line) => ({
      ...line,
      products: line.products.map((product) =>
        product.id === selectedProductId.value
          ? { ...product, effectiveStatus: 'active' as EffectiveStatus }
          : product
      )
    }))
  }))
  showFeedback('产品库已保存', 'success', 3000)
}

const selectedProductForPreview = computed<Product>(
  () => selectedProduct.value ?? categories.value[0].lines[0].products[0]
)

const previewQuotes = computed<Quote[]>(() =>
  selectedProductForPreview.value.quotes.length > 0
    ? selectedProductForPreview.value.quotes
    : [
        {
          id: 'empty-preview',
          text: '“请先为这个产品添加一条适合跟读的销售金句。”',
          hint: '学员将在 APP 中听原音并按住跟读。'
        }
      ]
)

const currentQuote = computed(
  () => previewQuotes.value[Math.min(previewActiveIndex.value, previewQuotes.value.length - 1)]
)

const emphasizedQuote = computed(() => splitQuoteForEmphasis(currentQuote.value?.text ?? ''))

watch([previewOpen, () => selectedProductForPreview.value.id], ([open]) => {
  if (open) previewActiveIndex.value = 0
})

const onQuoteImageSelected = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  handleUpdateProduct('imageUrl', URL.createObjectURL(file))
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div
    class="beauty-ba-page flex overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F7F3F1] pt-2"
  >
    <!-- 左侧：品类 / 产品线 / 产品 -->
    <div class="w-80 shrink-0 flex flex-col border-r border-[#E5DED8] bg-white">
      <div class="z-10 flex items-center justify-between border-b border-[#E9E4DF] bg-white p-4">
        <h2 class="font-bold tracking-tight text-[#242124]">产品与金句库</h2>
        <button
          type="button"
          title="添加品类或产品 (开发中)"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
        >
          <Icon icon="lucide:plus" :size="16" />
          <span>新建</span>
        </button>
      </div>

      <div class="flex-1 space-y-1 overflow-y-auto p-4">
        <div v-for="category in categories" :key="category.id" class="space-y-1">
          <div
            class="flex cursor-pointer select-none items-center gap-2 rounded-lg p-2 text-[#3F3A3D] hover:bg-[#F8F5F3]"
            @click="toggleExpand(category.id)"
          >
            <Icon
              :icon="
                expandedItems.has(category.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'
              "
              :size="16"
            />
            <Icon
              :icon="expandedItems.has(category.id) ? 'lucide:folder-open' : 'lucide:folder'"
              :size="16"
              class="text-rose-400"
            />
            <span data-i18n-skip="true" class="text-sm font-bold">{{ category.name }}</span>
          </div>

          <div v-if="expandedItems.has(category.id)" class="space-y-1 pl-6">
            <div v-for="line in category.lines" :key="line.id" class="space-y-1">
              <div
                class="flex cursor-pointer select-none items-center gap-2 rounded-lg p-2 text-[#5D565A] hover:bg-[#F8F5F3]"
                @click="toggleExpand(line.id)"
              >
                <Icon
                  :icon="
                    expandedItems.has(line.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'
                  "
                  :size="16"
                />
                <Icon
                  :icon="expandedItems.has(line.id) ? 'lucide:folder-open' : 'lucide:folder'"
                  :size="16"
                  class="text-emerald-400"
                />
                <span data-i18n-skip="true" class="text-sm font-medium">{{ line.name }}</span>
              </div>

              <div v-if="expandedItems.has(line.id)" class="space-y-0.5 pl-6">
                <div
                  v-for="product in line.products"
                  :key="product.id"
                  class="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm transition-all"
                  :class="
                    selectedProductId === product.id
                      ? 'bg-rose-50 font-bold text-rose-700'
                      : 'text-[#766F73] hover:bg-[#F8F5F3] hover:text-[#242124]'
                  "
                  @click="selectedProductId = product.id"
                >
                  <Icon
                    icon="lucide:package"
                    :size="16"
                    :class="selectedProductId === product.id ? 'text-rose-500' : 'text-[#9A9396]'"
                  />
                  <span data-i18n-skip="true" class="truncate">{{ product.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：产品与金句编辑 -->
    <div class="relative flex-1 flex flex-col overflow-hidden bg-[#F7F3F1]">
      <div
        v-if="showToast"
        class="beauty-toast-in absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-2 text-white shadow-lg"
        :class="toastTone === 'warning' ? 'bg-[#B9822B]' : 'bg-[#3B8F72]'"
      >
        <Icon
          :icon="toastTone === 'warning' ? 'lucide:alert-circle' : 'lucide:check-circle'"
          :size="16"
        />
        <span class="text-sm font-bold">{{ toastMessage }}</span>
      </div>

      <template v-if="selectedProduct">
        <div
          class="flex shrink-0 items-center justify-between border-b border-[#E5DED8] bg-white p-6"
        >
          <div>
            <p
              data-i18n-skip="true"
              class="mb-1 flex items-center text-[10px] font-bold uppercase tracking-wider text-[#9A9396]"
            >
              {{ breadcrumbs.join(' / ') }}
            </p>
            <h1 class="text-xl font-bold text-[#242124]">编辑产品：{{ selectedProduct.name }}</h1>
          </div>
          <div class="flex items-center gap-3">
            <el-button :class="NEUTRAL_OUTLINE_BTN" @click="previewOpen = true">
              <Icon icon="lucide:message-square" :size="16" class="mr-1.5" />
              <span>预览效果</span>
            </el-button>
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
              @click="handleSave"
            >
              <Icon icon="lucide:save" :size="16" />
              <span>保存产品库</span>
            </button>
            <EffectiveStatusBadge :status="selectedProduct.effectiveStatus" />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6 md:p-8">
          <div class="mx-auto max-w-4xl space-y-6">
            <PracticePromptNotice />

            <!-- 产品基础信息 -->
            <div class="rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm">
              <h3 class="mb-5 flex items-center text-sm font-bold text-[#242124]">
                <Icon icon="lucide:settings" :size="16" class="mr-2 text-rose-500" />
                产品基础信息
              </h3>
              <div class="space-y-4">
                <div>
                  <label class="mb-2 block text-xs font-bold text-[#766F73]">产品名称</label>
                  <input
                    :value="selectedProduct.name"
                    type="text"
                    class="w-full rounded-lg border border-[#E5DED8] px-4 py-2 text-sm font-medium transition-shadow focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    @input="handleUpdateProduct('name', ($event.target as HTMLInputElement).value)"
                  />
                </div>
                <div>
                  <label class="mb-2 block text-xs font-bold text-[#766F73]">产品卖点 / 介绍</label>
                  <textarea
                    :value="selectedProduct.description"
                    rows="3"
                    class="w-full resize-none rounded-lg border border-[#E5DED8] px-4 py-2 text-sm transition-shadow focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    @input="
                      handleUpdateProduct(
                        'description',
                        ($event.target as HTMLTextAreaElement).value
                      )
                    "
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- 产品图 -->
            <div class="rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm">
              <h3 class="mb-5 flex items-center text-sm font-bold text-[#242124]">
                <Icon icon="lucide:image" :size="16" class="mr-2 text-[#3B8F72]" />
                产品图配图
              </h3>
              <div
                class="flex flex-col overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F8F5F3]/50 lg:flex-row"
              >
                <div
                  class="flex shrink-0 items-center justify-center border-b border-[#E5DED8] bg-slate-100 p-4 lg:w-[360px] lg:border-b-0 lg:border-r"
                >
                  <div class="w-full max-w-[320px] rounded-2xl bg-slate-900 p-1.5 shadow-sm">
                    <div class="overflow-hidden rounded-xl bg-white">
                      <div
                        class="flex h-5 items-center justify-between px-3 text-[8px] font-bold text-[#9A9396]"
                      >
                        <span>9:41</span>
                        <span>SalesBoost AI</span>
                      </div>
                      <div class="relative aspect-square overflow-hidden bg-slate-100">
                        <img
                          v-if="selectedProduct.imageUrl"
                          :src="selectedProduct.imageUrl"
                          alt="Product cover"
                          class="h-full w-full object-cover"
                        />
                        <div
                          v-else
                          class="absolute inset-0 flex flex-col items-center justify-center text-center text-[#9A9396]"
                        >
                          <Icon icon="lucide:image" :size="32" class="mb-2 opacity-50" />
                          <span class="text-xs">移动端方形头图预览</span>
                        </div>
                        <div
                          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/55 to-transparent px-3 pb-3 pt-8"
                        >
                          <p
                            data-i18n-skip="true"
                            class="line-clamp-1 text-[10px] font-bold text-white"
                          >
                            {{ selectedProduct.name }}
                          </p>
                          <p class="text-[8px] text-white/75">Training cover image</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="flex flex-1 flex-col justify-center space-y-4 p-6">
                  <div>
                    <p class="text-sm font-medium text-[#3F3A3D]">
                      用于移动端培训详情页顶部头图，展示产品实物、使用场景或主视觉
                    </p>
                    <ul class="mt-2 list-disc space-y-1 pl-4 text-xs text-[#766F73]">
                      <li>建议尺寸：1080x1080 px，比例 1:1</li>
                      <li>主体内容居中，四周预留安全边距，避免文字或 Logo 贴边</li>
                      <li>图片会以 cover 方式裁切，重要信息不要放在边缘</li>
                      <li>支持的格式：JPG, PNG, WebP</li>
                      <li>大小限制：不得超过 10MB，上传后可二次压缩</li>
                    </ul>
                  </div>
                  <div class="flex items-center gap-3 pt-2">
                    <div class="relative inline-flex overflow-hidden">
                      <el-button size="small" class="!h-9 shadow-sm">
                        <Icon icon="lucide:upload" :size="16" class="mr-1.5 text-[#766F73]" />
                        <span>上传头图</span>
                      </el-button>
                      <input
                        type="file"
                        class="absolute inset-0 cursor-pointer opacity-0"
                        accept="image/png, image/jpeg, image/webp"
                        @change="onQuoteImageSelected"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 销售金句库 -->
            <div class="rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm">
              <div class="mb-5 flex items-center justify-between">
                <div class="flex items-center">
                  <Icon icon="lucide:message-square" :size="16" class="mr-2 text-rose-500" />
                  <h3 class="text-sm font-bold text-[#242124]">产品销售金句库</h3>
                </div>
                <div class="flex items-center gap-2">
                  <el-button :class="AI_OUTLINE_BTN" @click="materialReferenceOpen = true">
                    <Icon icon="lucide:library-big" :size="16" class="mr-1" />
                    引用素材
                  </el-button>
                  <el-button :class="AI_TONE_BTN" @click="handleGenerateQuotes">
                    <Icon icon="lucide:wand-2" :size="16" class="mr-1 text-[#6974E8]" />
                    AI 一键生成金句
                  </el-button>
                  <el-button size="small" class="!h-8 shadow-sm" @click="handleAddQuote">
                    <Icon icon="lucide:plus" :size="16" class="mr-1" />
                    新增金句
                  </el-button>
                </div>
              </div>

              <div class="space-y-4">
                <div
                  v-for="(quote, index) in selectedProduct.quotes"
                  :key="quote.id"
                  class="group relative rounded-xl border border-[#E5DED8] bg-[#F8F5F3]/50 p-4"
                >
                  <div
                    class="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-md bg-rose-100 text-xs font-bold text-rose-700"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="mt-2 space-y-3 pl-10">
                    <div>
                      <label class="mb-1 block text-xs font-bold text-[#766F73]"
                        >具体金句内容</label
                      >
                      <textarea
                        :value="quote.text"
                        rows="2"
                        placeholder="输入推荐给顾客的销售话术..."
                        class="w-full resize-none rounded-md border border-[#E5DED8] bg-white px-3 py-1.5 text-sm font-medium focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        @input="
                          handleUpdateQuote(
                            quote.id,
                            'text',
                            ($event.target as HTMLTextAreaElement).value
                          )
                        "
                      ></textarea>
                    </div>
                    <div>
                      <label class="mb-1 flex items-center text-xs font-bold text-[#766F73]">
                        <Icon icon="lucide:alert-circle" :size="12" class="mr-1 text-[#B9822B]" />
                        金句使用提示 (场景、受众等)
                      </label>
                      <input
                        :value="quote.hint"
                        type="text"
                        placeholder="例如：适合在顾客抱怨皮肤干燥脱皮时使用..."
                        class="w-full rounded-md border border-[#E5DED8] bg-white px-3 py-1.5 text-sm focus:border-[#B9822B] focus:outline-none focus:ring-2 focus:ring-[#B9822B]/20"
                        @input="
                          handleUpdateQuote(
                            quote.id,
                            'hint',
                            ($event.target as HTMLInputElement).value
                          )
                        "
                      />
                    </div>
                    <div
                      v-if="quote.sourceReferences?.length"
                      class="rounded-md border border-[#D8DEFF] bg-[#F7F8FF] px-3 py-2"
                    >
                      <div class="flex items-center gap-1.5 text-[11px] font-bold text-[#515BCB]">
                        <Icon icon="lucide:link-2" :size="14" />素材库来源
                      </div>
                      <div
                        v-for="source in quote.sourceReferences"
                        :key="source.id"
                        class="mt-1.5 text-[11px] leading-relaxed text-[#766F73]"
                      >
                        {{ source.materialTitle }} · v{{ source.materialVersion }} · 证据
                        {{
                          source.evidenceRanges
                            .map(
                              (range) =>
                                `${Math.floor(range.startSec / 60)}:${String(range.startSec % 60).padStart(2, '0')} - ${Math.floor(range.endSec / 60)}:${String(range.endSec % 60).padStart(2, '0')}`
                            )
                            .join('，')
                        }}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="absolute right-4 top-4 rounded-md p-1 text-[#9A9396] opacity-0 transition-all hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
                    @click="handleRemoveQuote(quote.id)"
                  >
                    <Icon icon="lucide:trash-2" :size="16" />
                  </button>
                </div>
                <div
                  v-if="selectedProduct.quotes.length === 0"
                  class="rounded-xl border border-dashed border-[#E5DED8] bg-[#F8F5F3] py-6 text-center text-sm text-[#766F73]"
                >
                  暂无销售金句，请点击右上角新增
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="flex flex-1 flex-col items-center justify-center text-[#9A9396]">
        <Icon icon="lucide:package" :size="64" class="mb-4 opacity-20" />
        <p class="font-medium text-[#766F73]">在左侧选择一个产品查看金句</p>
      </div>

      <!-- 金句跟读预览 -->
      <el-dialog
        v-model="previewOpen"
        class="beauty-quote-preview-dialog"
        width="1120px"
        top="5vh"
        append-to-body
      >
        <template #header>
          <div class="flex items-center justify-between pr-8">
            <div>
              <div class="group/quote-read-note relative w-fit pr-5">
                <span
                  data-i18n-skip="true"
                  class="absolute -right-1 -top-2 z-20 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-center text-[9px] font-bold leading-4 text-white shadow-sm backdrop-blur-sm"
                  >注</span
                >
                <div class="text-lg font-bold text-[#242124]">金句跟读预览</div>
                <div
                  data-i18n-skip="true"
                  class="absolute left-0 top-full z-50 mt-2 hidden w-80 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm group-hover/quote-read-note:block"
                >
                  给研发：兵哥提出，金句跟读每次要做文本比对来判定正确率；如果有两次正确率低于
                  80%，则多读一次，最多 4 次。
                </div>
              </div>
              <p class="mt-1 text-xs text-[#766F73]">
                模拟学员 APP 端听原音、按住跟读和查看进度的练习界面
              </p>
            </div>
            <el-button
              size="small"
              class="!border-[#E5DED8] !bg-white !text-[#3F3A3D]"
              @click="previewActiveIndex = 0"
            >
              <Icon icon="lucide:rotate-ccw" :size="16" class="mr-1" />
              <span>重置预览</span>
            </el-button>
          </div>
        </template>

        <div
          class="grid h-[80vh] min-h-0 grid-cols-1 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1fr)]"
        >
          <div
            class="flex min-h-0 items-center justify-center overflow-y-auto border-r border-[#E5DED8] bg-[#F7ECEC] p-6"
          >
            <div
              class="relative h-[690px] w-[390px] max-h-full overflow-hidden rounded-[42px] border-[10px] border-[#242124] bg-[#FCEEEF] shadow-2xl"
            >
              <div class="relative h-[300px] overflow-hidden bg-slate-200">
                <img
                  v-if="selectedProductForPreview.imageUrl"
                  :src="selectedProductForPreview.imageUrl"
                  :alt="selectedProductForPreview.name"
                  class="h-full w-full object-cover"
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#E8D8D6] via-[#F3ECE9] to-[#C8D8D2] text-[#9A9396]"
                >
                  <Icon icon="lucide:image" :size="48" />
                </div>
                <div
                  class="absolute inset-0 bg-gradient-to-b from-black/25 via-white/5 to-[#FCEEEF]"
                ></div>
                <button
                  type="button"
                  class="absolute left-6 top-8 flex h-12 w-12 items-center justify-center rounded-full border border-white/45 bg-white/20 text-white shadow-sm backdrop-blur-md"
                >
                  <Icon icon="lucide:arrow-left" :size="24" />
                </button>
                <div
                  class="absolute right-6 top-8 rounded-full border border-white/60 bg-white/25 p-1 shadow-sm backdrop-blur-md"
                >
                  <div
                    class="rounded-full bg-white px-4 py-2 text-sm font-black italic text-rose-500 shadow-sm"
                  >
                    Sentence of Day
                  </div>
                </div>
              </div>

              <div
                class="absolute left-7 right-7 top-[230px] h-[305px] rounded-[32px] border border-white/70 bg-white/95 px-6 py-6 shadow-xl"
              >
                <div
                  class="mb-5 flex items-center justify-between text-[12px] font-black uppercase tracking-[0.22em]"
                >
                  <span class="text-[#6E8DA5]"
                    >Progress {{ previewActiveIndex + 1 }}/{{ previewQuotes.length }}</span
                  >
                  <span class="text-rose-500">Practice #{{ previewActiveIndex }}</span>
                </div>
                <p
                  data-i18n-skip="true"
                  class="line-clamp-5 text-[23px] font-black italic leading-[1.25] text-[#0E3A4B]"
                >
                  {{ emphasizedQuote.lead
                  }}<span
                    v-if="emphasizedQuote.highlight"
                    class="mx-1 text-rose-500 underline decoration-rose-200 decoration-4 underline-offset-4"
                    >{{ emphasizedQuote.highlight }}</span
                  >{{ emphasizedQuote.tail }}
                </p>
                <div class="my-4 h-px bg-[#E5EEF1]"></div>
                <p
                  data-i18n-skip="true"
                  class="line-clamp-2 text-xs font-bold leading-relaxed text-[#8EA8BA]"
                >
                  {{ currentQuote?.hint || selectedProductForPreview.description }}
                </p>
              </div>

              <div class="absolute inset-x-0 bottom-20 flex items-end justify-center gap-12">
                <div class="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#6E8DA5] shadow-lg"
                  >
                    <Icon icon="lucide:play" :size="28" class="fill-current" />
                  </button>
                  <span class="text-sm font-black text-[#A8BBC8]">Listen</span>
                </div>
                <div class="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    class="flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-white bg-rose-500 text-white shadow-xl shadow-rose-200 transition-transform active:scale-95"
                  >
                    <Icon icon="lucide:mic" :size="44" />
                  </button>
                  <span class="text-base font-black text-rose-500">Hold to Read</span>
                </div>
              </div>

              <button
                type="button"
                class="absolute inset-x-0 bottom-6 mx-auto flex w-fit flex-col items-center text-[12px] font-black uppercase tracking-[0.28em] text-[#B8C8D0]"
                @click="previewActiveIndex = (previewActiveIndex + 1) % previewQuotes.length"
              >
                Swipe Up
                <Icon icon="lucide:chevron-up" :size="20" class="mt-1" />
              </button>
            </div>
          </div>

          <div class="min-h-0 overflow-y-auto bg-[#F8F5F3] p-6">
            <div class="mb-5 rounded-2xl border border-[#E5DED8] bg-white p-5">
              <div data-i18n-skip="true" class="text-sm font-bold text-[#242124]">
                {{ selectedProductForPreview.name }}
              </div>
              <p data-i18n-skip="true" class="mt-1 text-xs leading-relaxed text-[#766F73]">
                {{ selectedProductForPreview.description }}
              </p>
              <div class="mt-4 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-xl bg-[#F8F5F3] p-3">
                  <div class="text-lg font-black text-[#242124]">{{ previewQuotes.length }}</div>
                  <div class="mt-1 text-[10px] font-bold text-[#9A9396]">金句数</div>
                </div>
                <div class="rounded-xl bg-[#F8F5F3] p-3">
                  <div class="text-lg font-black text-[#3B8F72]">92</div>
                  <div class="mt-1 text-[10px] font-bold text-[#9A9396]">示例评分</div>
                </div>
                <div class="rounded-xl bg-[#F8F5F3] p-3">
                  <div class="text-lg font-black text-rose-500">3</div>
                  <div class="mt-1 text-[10px] font-bold text-[#9A9396]">跟读次数</div>
                </div>
              </div>
            </div>

            <div class="mb-3 flex items-center justify-between">
              <div class="text-xs font-black uppercase tracking-wider text-[#9A9396]">
                金句跟读队列
              </div>
            </div>
            <div class="space-y-3">
              <button
                v-for="(quote, index) in previewQuotes"
                :key="quote.id"
                type="button"
                class="w-full rounded-2xl border p-4 text-left transition-all"
                :class="
                  index === previewActiveIndex
                    ? 'border-rose-200 bg-white shadow-sm ring-2 ring-rose-100'
                    : 'border-[#E5DED8] bg-white/70 hover:bg-white'
                "
                @click="previewActiveIndex = index"
              >
                <div class="mb-2 flex items-center justify-between">
                  <span
                    class="text-[10px] font-black uppercase tracking-wider"
                    :class="index === previewActiveIndex ? 'text-rose-500' : 'text-[#9A9396]'"
                    >Practice {{ index + 1 }}</span
                  >
                  <span
                    class="rounded-full bg-[#F8F5F3] px-2 py-0.5 text-[10px] font-bold text-[#766F73]"
                    >跟读</span
                  >
                </div>
                <p
                  data-i18n-skip="true"
                  class="line-clamp-2 text-sm font-bold leading-relaxed text-[#242124]"
                >
                  {{ stripQuoteMarks(quote.text) }}
                </p>
                <p
                  v-if="quote.hint"
                  data-i18n-skip="true"
                  class="mt-2 line-clamp-2 text-xs leading-relaxed text-[#766F73]"
                >
                  {{ quote.hint }}
                </p>
              </button>
            </div>
          </div>
        </div>
      </el-dialog>

      <MaterialReferenceDialog
        v-model="materialReferenceOpen"
        target="quote"
        :quote-target-label="selectedProduct?.name"
        @apply="applyMaterialReference"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.beauty-ba-page {
  height: calc(
    100dvh - var(--top-tool-height) - var(--tags-view-height) - var(--app-content-padding) *
      2 - var(--app-footer-height)
  );
  min-height: 560px;
}

.beauty-toast-in {
  animation: beauty-toast-in 0.2s ease-out both;
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

:global(.beauty-quote-preview-dialog .el-dialog__header) {
  margin: 0;
  padding: 16px 24px;
  border-bottom: 1px solid #e5ded8;
  background: #fff;
}

:global(.beauty-quote-preview-dialog .el-dialog__body) {
  padding: 0;
}

:global(.beauty-quote-preview-dialog .el-dialog__footer) {
  padding: 0;
}
</style>
