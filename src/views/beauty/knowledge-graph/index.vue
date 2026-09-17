<script setup lang="ts">
/**
 * 知识图谱（原型 `src/pages/KnowledgeGraph.tsx`，仅超级管理员可见）。
 *
 * 已解析知识切片列表 + 「拉取同步 / 开始解析」两个演示动作，以及单条切片的标签/内容编辑弹窗。
 * - 拉取同步：2s 后刷新「最近同步时间」（等价原型 setTimeout）；
 * - 开始解析：每 300ms 进度 +10%，到 100% 后再等 500ms 把「待解析」切片置为「已解析」。
 *
 * 与原型的两点差异（交互补全，不改变视觉）：
 * - 列表搜索框在原子里是纯展示，这里接上按标签/内容/来源文件过滤；
 * - 行内的「查看详情 / 删除」是原型里的占位按钮（无 handler），保持原样不动作。
 */
import { useBeautyI18n } from '@/beauty/composables'

defineOptions({ name: 'BeautyKnowledgeGraph' })

type KnowledgeChunkStatus = 'parsed' | 'parsing' | 'failed' | 'pending'

interface KnowledgeChunk {
  id: string
  tags: string[]
  content: string
  sourceFile: string
  time: string
  status: KnowledgeChunkStatus
}

/** 原型 MOCK_CHUNKS。 */
const MOCK_CHUNKS: KnowledgeChunk[] = [
  {
    id: '1',
    tags: ['护肤', '抗老', 'Barrier Shield'],
    content:
      'Barrier Shield系列核心成分为神经酰胺，具有重塑肌肤屏障、舒缓泛红的功效，特别适合敏感和受损肌肤。',
    sourceFile: 'Lumina_2023新品全线成分手册.pdf',
    time: '2023-10-24 14:30',
    status: 'parsed'
  },
  {
    id: '2',
    tags: ['销售话术', '竞品对比', 'Lbrand'],
    content:
      '当客户提及Lbrand的小棕瓶时，重点强调我们的Radiance精华吸收速度快3倍，且在热带气候下不油腻。',
    sourceFile: 'Q4_竞品话术应对SOP.docx',
    time: '2023-10-24 14:00',
    status: 'parsed'
  },
  {
    id: '3',
    tags: ['成分', '防晒', 'Sunbrella'],
    content: '结合了物理和化学防晒的双重优势，SPF50 PA+++，提供长达8小时的全波段紫外线防护。',
    sourceFile: '防晒系列_研发内部资料.pptx',
    time: '2023-10-23 09:15',
    status: 'parsed'
  },
  {
    id: '4',
    tags: ['彩妆', '底妆', '技巧'],
    content: '使用粉底液前，建议先配合使用保湿隔离霜打底，可使底妆服帖度提升50%，避免卡粉问题。',
    sourceFile: '2024早八底妆技巧培训.pdf',
    time: '2023-10-20 16:45',
    status: 'pending'
  }
]

const { t } = useBeautyI18n()

const chunks = ref<KnowledgeChunk[]>(MOCK_CHUNKS.map((chunk) => ({ ...chunk, tags: [...chunk.tags] })))
const isSyncing = ref(false)
const isParsing = ref(false)
const lastSyncTime = ref('2023-10-24 15:00:00')
const parseProgress = ref(0)
const searchQuery = ref('')

const editingChunk = ref<KnowledgeChunk | null>(null)

/** 弹窗开关由 editingChunk 派生（等价原型 `open={!!editingChunk}`）。 */
const editDialogVisible = computed({
  get: () => !!editingChunk.value,
  set: (open: boolean) => {
    if (!open) editingChunk.value = null
  }
})
const editTagsStr = ref('')
const editContent = ref('')

let parseTimer: ReturnType<typeof setInterval> | undefined

onScopeDispose(() => {
  if (parseTimer) clearInterval(parseTimer)
})

const filteredChunks = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return chunks.value
  return chunks.value.filter(
    (chunk) =>
      chunk.content.toLowerCase().includes(keyword) ||
      chunk.sourceFile.toLowerCase().includes(keyword) ||
      chunk.tags.some((tag) => tag.toLowerCase().includes(keyword))
  )
})

/** 等价原型 openEditModal。 */
const openEditModal = (chunk: KnowledgeChunk) => {
  editingChunk.value = chunk
  editTagsStr.value = chunk.tags.join(', ')
  editContent.value = chunk.content
}

/** 等价原型 handleSaveEdit：标签按逗号切分并去空。 */
const handleSaveEdit = () => {
  if (!editingChunk.value) return
  const targetId = editingChunk.value.id
  chunks.value = chunks.value.map((chunk) =>
    chunk.id === targetId
      ? {
          ...chunk,
          content: editContent.value,
          tags: editTagsStr.value
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag)
        }
      : chunk
  )
  editingChunk.value = null
}

/** 等价原型 handleSync。 */
const handleSync = () => {
  isSyncing.value = true
  setTimeout(() => {
    isSyncing.value = false
    lastSyncTime.value = new Date().toLocaleString('zh-CN', { hour12: false })
  }, 2000)
}

/** 等价原型 handleParse：300ms 步进 10%，完成后把待解析切片置为已解析。 */
const handleParse = () => {
  isParsing.value = true
  parseProgress.value = 0

  parseTimer = setInterval(() => {
    if (parseProgress.value >= 100) {
      if (parseTimer) clearInterval(parseTimer)
      parseTimer = undefined
      setTimeout(() => {
        isParsing.value = false
        chunks.value = chunks.value.map((chunk) =>
          chunk.status === 'pending' ? { ...chunk, status: 'parsed' } : chunk
        )
      }, 500)
      return
    }
    parseProgress.value = Math.min(parseProgress.value + 10, 100)
  }, 300)
}
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm md:flex-row md:items-center"
    >
      <div>
        <h1 class="flex items-center text-2xl font-bold tracking-tight text-[#1F1C1F]">
          <Icon icon="lucide:database" :size="24" class="mr-3 text-rose-600" />
          企业知识图谱
        </h1>
        <p class="mt-1 flex items-center text-sm text-[#766F73]">
          <Icon icon="lucide:clock" :size="16" class="mr-1.5 opacity-70" />
          {{ t(`最近同步时间：${lastSyncTime}`) }}
        </p>
      </div>

      <div class="flex w-full items-center space-x-3 md:w-auto">
        <el-button
          :disabled="isSyncing || isParsing"
          class="!h-10 w-full !rounded-xl !border-[#E5DED8] !bg-white !font-bold !text-[#3F3A3D] shadow-sm hover:!bg-[#F8F5F3] hover:!text-rose-600 md:!w-auto"
          @click="handleSync"
        >
          <Icon
            icon="lucide:refresh-cw"
            :size="16"
            class="mr-2"
            :class="{ 'animate-spin text-rose-600': isSyncing }"
          />
          {{ isSyncing ? '正在拉取...' : '拉取同步' }}
        </el-button>

        <el-button
          type="primary"
          :disabled="isSyncing || isParsing"
          class="!h-10 w-full !rounded-xl !border-rose-600 !bg-rose-600 !font-bold !text-white shadow-sm hover:!border-rose-700 hover:!bg-rose-700 md:!w-auto"
          @click="handleParse"
        >
          <Icon
            :icon="isParsing ? 'lucide:refresh-cw' : 'lucide:play'"
            :size="16"
            class="mr-2"
            :class="{ 'animate-spin': isParsing }"
          />
          {{ isParsing ? '解析中' : '开始解析' }}
        </el-button>
      </div>
    </div>

    <div
      v-if="isParsing"
      class="rounded-xl border border-rose-100 bg-rose-50/30 px-4 pt-6 pb-4"
    >
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-bold text-rose-800">正在知识切片与入库...</span>
        <span class="text-sm font-bold text-rose-600">{{ parseProgress }}%</span>
      </div>
      <div class="flex h-2 w-full overflow-hidden rounded-full bg-rose-100">
        <div class="h-full bg-rose-600 transition-all" :style="{ width: `${parseProgress}%` }"></div>
      </div>
    </div>

    <div class="rounded-xl border border-[#E9E4DF] bg-white shadow-sm">
      <div class="px-6 pt-6">
        <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <h3 class="text-lg font-bold text-[#242124]">
            {{ t(`已解析知识切片 (${chunks.length})`) }}
          </h3>
          <div class="flex w-full items-center space-x-2 md:w-auto">
            <div class="relative flex-1 md:w-64">
              <Icon
                icon="lucide:search"
                :size="16"
                class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]"
              />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索内容或标签..."
                class="w-full rounded-lg border border-[#E5DED8] py-2 pr-4 pl-9 text-sm text-[#242124] transition-shadow outline-none placeholder:text-[#9A9396] focus:border-[#A85F4B] focus:ring-2 focus:ring-[#A85F4B]/20"
              />
            </div>
            <button
              type="button"
              class="rounded-lg border border-[#E5DED8] p-2 text-[#766F73] transition-colors hover:bg-[#F8F5F3]"
            >
              <Icon icon="lucide:filter" :size="16" />
            </button>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-[#5D565A]">
            <thead
              class="border-b border-[#E9E4DF] bg-[#F8F5F3]/80 text-xs font-bold text-[#766F73] uppercase"
            >
              <tr>
                <th class="rounded-tl-lg px-4 py-3">序号</th>
                <th class="px-4 py-3">知识标签</th>
                <th class="min-w-[300px] px-4 py-3">知识切片详情</th>
                <th class="px-4 py-3">来源文件名</th>
                <th class="px-4 py-3">时间</th>
                <th class="px-4 py-3">状态</th>
                <th class="rounded-tr-lg px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="(chunk, index) in filteredChunks"
                :key="chunk.id"
                class="knowledge-row transition-colors hover:bg-[#F8F5F3]/50"
              >
                <td class="px-4 py-4 font-medium text-[#9A9396]">{{ index + 1 }}</td>
                <td class="px-4 py-4">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="tag in chunk.tags"
                      :key="tag"
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-rose-700"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <p class="line-clamp-2 leading-relaxed font-medium text-[#3F3A3D]">
                    {{ chunk.content }}
                  </p>
                </td>
                <td class="px-4 py-4">
                  <div class="flex items-center space-x-2 text-[#5D565A]">
                    <Icon icon="lucide:file-text" :size="16" class="shrink-0 text-[#9A9396]" />
                    <span class="max-w-[150px] truncate" :title="chunk.sourceFile">
                      {{ chunk.sourceFile }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-4 text-xs whitespace-nowrap text-[#766F73]">{{ chunk.time }}</td>
                <td class="px-4 py-4">
                  <span
                    v-if="chunk.status === 'parsed'"
                    class="inline-flex items-center rounded-full bg-[#DCEFE7] px-2 py-1 text-[10px] font-bold text-[#2F735C]"
                  >
                    已解析
                  </span>
                  <span
                    v-else-if="chunk.status === 'pending'"
                    class="inline-flex items-center rounded-full bg-[#F7E6C8] px-2 py-1 text-[10px] font-bold text-[#8B621F]"
                  >
                    待解析
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700"
                  >
                    解析失败
                  </span>
                </td>
                <td class="px-4 py-4 text-right">
                  <div
                    class="knowledge-row__actions flex items-center justify-end space-x-2 opacity-0 transition-opacity"
                  >
                    <button
                      type="button"
                      title="查看详情"
                      class="rounded-md p-1.5 text-[#9A9396] transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Icon icon="lucide:eye" :size="16" />
                    </button>
                    <button
                      type="button"
                      title="编辑"
                      class="rounded-md p-1.5 text-[#9A9396] transition-colors hover:bg-blue-50 hover:text-blue-600"
                      @click="openEditModal(chunk)"
                    >
                      <Icon icon="lucide:edit" :size="16" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      class="rounded-md p-1.5 text-[#9A9396] transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Icon icon="lucide:trash-2" :size="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <el-dialog v-model="editDialogVisible" width="600px" append-to-body destroy-on-close>
      <template #header>
        <h3 class="text-base font-semibold text-[#242124]">编辑知识切片</h3>
      </template>

      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <label class="text-sm font-medium text-[#3F3A3D]">标签 (以逗号分隔)</label>
          <input
            v-model="editTagsStr"
            type="text"
            class="w-full rounded-md border border-[#E5DED8] px-3 py-2 text-sm text-[#242124] outline-none focus:border-[#A85F4B] focus:ring-2 focus:ring-[#A85F4B]/20"
          />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium text-[#3F3A3D]">知识切片详情</label>
          <textarea
            v-model="editContent"
            rows="6"
            class="w-full resize-none rounded-md border border-[#E5DED8] px-3 py-2 text-sm text-[#242124] outline-none focus:border-[#A85F4B] focus:ring-2 focus:ring-[#A85F4B]/20"
          ></textarea>
        </div>
      </div>

      <div class="flex justify-end space-x-3">
        <el-button @click="editingChunk = null">取消</el-button>
        <el-button
          type="primary"
          class="!border-rose-600 !bg-rose-600 !text-white hover:!border-rose-700 hover:!bg-rose-700"
          @click="handleSaveEdit"
        >
          发布知识
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
/* 原型用 group-hover:opacity-100 显示行内操作按钮；这里用行级 hover，避免命名分组变体在 unocss 0.58 下失效。 */
.knowledge-row__actions {
  visibility: hidden;
}

.knowledge-row:hover .knowledge-row__actions,
.knowledge-row:focus-within .knowledge-row__actions {
  visibility: visible;
  opacity: 1;
}
</style>
