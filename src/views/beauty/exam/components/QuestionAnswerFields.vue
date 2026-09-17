<script setup lang="ts">
/**
 * 题目答案编辑器（原型的「题目素材 + 题型化答案编辑」区块）。
 *
 * 该区块在原型里重复出现在两处：
 * - `ExamGenerate.tsx` 生成结果预览（mode="preview"，紧凑尺寸，不含 AI 阅卷提示）
 * - `ExamBank.tsx` 题目编辑抽屉（mode="edit"，完整尺寸与字段）
 *
 * 子组件只负责收集用户输入并 emit `patch`，由父组件统一走 `normalizeQuestionForType()`，
 * 保持与原型「先 patch 再规范化」的写入顺序一致。
 */
import type { QuestionBankItem, QuestionMediaType, QuestionOption } from '@/beauty/lib/questionBank'

const props = withDefaults(
  defineProps<{
    question: QuestionBankItem
    mode?: 'preview' | 'edit'
  }>(),
  { mode: 'edit' }
)

const emit = defineEmits<{ (e: 'patch', patch: Partial<QuestionBankItem>): void }>()

const isEdit = computed(() => props.mode === 'edit')
/** 区块标题字号：预览用 text-xs，编辑抽屉用 text-sm。 */
const labelClass = computed(() =>
  isEdit.value ? 'text-sm font-bold text-[#3F3A3D]' : 'text-xs font-bold text-[#766F73]'
)
const fieldLabelClass = computed(() =>
  isEdit.value
    ? 'mb-1 block text-sm font-bold text-[#3F3A3D]'
    : 'mb-1 block text-xs font-bold text-[#766F73]'
)
const chipClass = computed(() =>
  isEdit.value
    ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold text-[#766F73]'
    : 'shrink-0 text-xs font-bold'
)
const gridInputClass = computed(() =>
  isEdit.value
    ? 'h-8 min-w-0 flex-1 rounded-md border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20'
    : 'h-8 min-w-0 flex-1 rounded border border-[#E5DED8] px-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20'
)
const attachmentRowClass = computed(() =>
  isEdit.value
    ? 'grid gap-2 rounded-md bg-white p-2 md:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.4fr)_28px] md:items-center'
    : 'grid gap-2 rounded bg-white p-2 md:grid-cols-[52px_minmax(0,1fr)_minmax(0,1.4fr)_28px] md:items-center'
)

const patch = (next: Partial<QuestionBankItem>) => emit('patch', next)

/* -------------------------------------------------- 素材（图片/视频） */
const handleAttachmentUpload = (type: QuestionMediaType, event: Event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  patch({
    attachments: [
      ...(props.question.attachments || []),
      {
        id: `att-${Date.now()}`,
        type,
        name: file.name,
        url: URL.createObjectURL(file)
      }
    ]
  })
  input.value = ''
}

const updateAttachment = (attachmentId: string, key: 'name' | 'url', value: string) => {
  patch({
    attachments: (props.question.attachments || []).map((attachment) =>
      attachment.id === attachmentId ? { ...attachment, [key]: value } : attachment
    )
  })
}

const removeAttachment = (attachmentId: string) => {
  patch({
    attachments: (props.question.attachments || []).filter(
      (attachment) => attachment.id !== attachmentId
    )
  })
}

/* -------------------------------------------------- 选项与答案 */
const updateOption = (optionId: string, text: string) => {
  patch({
    options: (props.question.options || []).map((option) =>
      option.id === optionId ? { ...option, text } : option
    )
  })
}

const addOption = () => {
  const options = props.question.options || []
  const label = String.fromCharCode(65 + options.length)
  const option: QuestionOption = { id: `${label.toLowerCase()}-${Date.now()}`, label, text: '' }
  patch({
    options: [...options, option],
    correctOptionIds:
      props.question.type === 'ordering'
        ? [...(props.question.correctOptionIds || []), option.id]
        : props.question.correctOptionIds
  })
}

const toggleCorrectOption = (optionId: string) => {
  const current = props.question.correctOptionIds || []
  if (
    props.question.type === 'single_choice' ||
    props.question.type === 'true_false' ||
    props.question.type === 'dropdown'
  ) {
    patch({ correctOptionIds: [optionId] })
    return
  }
  if (props.question.type === 'ordering') return
  patch({
    correctOptionIds: current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId]
  })
}

const orderingOrder = computed(() => {
  const options = props.question.options || []
  const correct = props.question.correctOptionIds || []
  return correct.length === options.length ? correct : options.map((option) => option.id)
})

const setOrderingPosition = (optionId: string, position: number) => {
  const withoutOption = orderingOrder.value.filter((id) => id !== optionId)
  withoutOption.splice(position, 0, optionId)
  patch({ correctOptionIds: withoutOption })
}

/* -------------------------------------------------- 复选网格 */
const updateGridItem = (key: 'gridRows' | 'gridColumns', itemId: string, text: string) => {
  patch({
    [key]: (props.question[key] || []).map((item) =>
      item.id === itemId ? { ...item, text } : item
    )
  })
}

const addGridItem = (key: 'gridRows' | 'gridColumns') => {
  const items = props.question[key] || []
  const isRow = key === 'gridRows'
  const index = items.length + 1
  const item: QuestionOption = {
    id: `${isRow ? 'r' : 'c'}-${Date.now()}`,
    label: isRow ? String(index) : String.fromCharCode(64 + index),
    text: ''
  }
  patch({ [key]: [...items, item] })
}

const toggleGridAnswer = (rowId: string, columnId: string) => {
  const current = props.question.gridCorrectAnswers || []
  const exists = current.some((answer) => answer.rowId === rowId && answer.columnId === columnId)
  patch({
    gridCorrectAnswers: exists
      ? current.filter((answer) => !(answer.rowId === rowId && answer.columnId === columnId))
      : [...current, { rowId, columnId }]
  })
}

/* -------------------------------------------------- 文件上传题 */
const toggleAllowedUploadType = (type: QuestionMediaType) => {
  const current = props.question.allowedUploadTypes || []
  const next = current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
  patch({ allowedUploadTypes: next.length > 0 ? next : [type] })
}

const blank = (value?: string) => value || ''

const mediaTypes: QuestionMediaType[] = ['image', 'video']
</script>

<template>
  <div class="space-y-4">
    <!-- 题目素材 -->
    <div>
      <div class="mb-2 flex items-center justify-between">
        <span :class="labelClass">题目素材</span>
        <div class="flex gap-2">
          <label
            class="inline-flex h-7 cursor-pointer items-center justify-center rounded-md border border-[#E5DED8] bg-white px-3 text-xs font-bold text-[#3F3A3D] shadow-sm transition-colors hover:bg-[#F8F5F3]"
          >
            添加图片
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAttachmentUpload('image', $event)"
            />
          </label>
          <label
            class="inline-flex h-7 cursor-pointer items-center justify-center rounded-md border border-[#E5DED8] bg-white px-3 text-xs font-bold text-[#3F3A3D] shadow-sm transition-colors hover:bg-[#F8F5F3]"
          >
            添加视频
            <input
              type="file"
              accept="video/*"
              class="hidden"
              @change="handleAttachmentUpload('video', $event)"
            />
          </label>
        </div>
      </div>
      <div
        v-if="question.attachments?.length || isEdit"
        class="space-y-2 rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-2"
      >
        <div v-if="!question.attachments?.length" class="px-2 py-1 text-xs text-[#9A9396]">
          暂无图片或视频素材
        </div>
        <div
          v-for="attachment in question.attachments || []"
          :key="attachment.id"
          :class="attachmentRowClass"
        >
          <span
            class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-[#E5DED8] px-2 py-0.5 text-[10px] font-medium text-[#1F1C1F]"
          >
            {{ attachment.type === 'image' ? '图片' : '视频' }}
          </span>
          <input
            data-i18n-skip="true"
            :value="attachment.name"
            :placeholder="isEdit ? '素材名称' : undefined"
            class="h-8 min-w-0 rounded border border-[#E5DED8] px-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/20"
            @input="
              updateAttachment(attachment.id, 'name', ($event.target as HTMLInputElement).value)
            "
          />
          <input
            data-i18n-skip="true"
            :value="attachment.url"
            :placeholder="isEdit ? '素材链接' : undefined"
            class="h-8 min-w-0 rounded border border-[#E5DED8] px-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/20"
            @input="
              updateAttachment(attachment.id, 'url', ($event.target as HTMLInputElement).value)
            "
          />
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded text-[#9A9396] hover:bg-red-50 hover:text-red-500"
            title="移除素材"
            @click="removeAttachment(attachment.id)"
          >
            <Icon icon="lucide:trash-2" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- 段落题 -->
    <template v-if="question.type === 'short_answer'">
      <div :class="isEdit ? 'space-y-3' : 'grid gap-3 md:grid-cols-2'">
        <label class="block">
          <span :class="fieldLabelClass">参考答案</span>
          <textarea
            data-i18n-skip="true"
            :value="blank(question.referenceAnswer)"
            :class="
              isEdit
                ? 'min-h-24 w-full resize-none rounded-lg border border-[#E5DED8] px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-rose-500/20'
                : 'min-h-28 w-full resize-none rounded border border-[#E5DED8] px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20'
            "
            @input="patch({ referenceAnswer: ($event.target as HTMLTextAreaElement).value })"
          ></textarea>
        </label>
        <label class="block">
          <span :class="fieldLabelClass">评分要点</span>
          <textarea
            data-i18n-skip="true"
            :value="blank(question.scoringRubric)"
            :class="
              isEdit
                ? 'min-h-20 w-full resize-none rounded-lg border border-[#E5DED8] px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-rose-500/20'
                : 'min-h-28 w-full resize-none rounded border border-[#E5DED8] px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20'
            "
            @input="patch({ scoringRubric: ($event.target as HTMLTextAreaElement).value })"
          ></textarea>
        </label>
        <label v-if="isEdit" class="block">
          <span :class="fieldLabelClass">AI 阅卷提示 (选填)</span>
          <textarea
            data-i18n-skip="true"
            :value="blank(question.aiGradingHint)"
            class="min-h-16 w-full resize-none rounded-lg border border-[#E5DED8] px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-rose-500/20"
            @input="patch({ aiGradingHint: ($event.target as HTMLTextAreaElement).value })"
          ></textarea>
        </label>
      </div>
    </template>

    <!-- 文件上传题 -->
    <template v-else-if="question.type === 'file_upload'">
      <div :class="isEdit ? 'space-y-3' : 'grid gap-3 md:grid-cols-2'">
        <label class="block">
          <span :class="fieldLabelClass">上传说明</span>
          <textarea
            data-i18n-skip="true"
            :value="blank(question.uploadInstructions)"
            :class="
              isEdit
                ? 'min-h-20 w-full resize-none rounded-lg border border-[#E5DED8] px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-rose-500/20'
                : 'min-h-28 w-full resize-none rounded border border-[#E5DED8] px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20'
            "
            @input="patch({ uploadInstructions: ($event.target as HTMLTextAreaElement).value })"
          ></textarea>
        </label>
        <div class="space-y-3">
          <div>
            <span :class="fieldLabelClass">允许上传类型</span>
            <div :class="isEdit ? 'flex gap-3' : 'flex gap-2'">
              <label
                v-for="type in mediaTypes"
                :key="type"
                :class="
                  isEdit
                    ? 'flex items-center gap-2 rounded-lg border border-[#E5DED8] bg-[#F8F5F3] px-3 py-2 text-sm font-bold text-[#5D565A]'
                    : 'flex items-center gap-2 rounded border border-[#E5DED8] bg-[#F8F5F3] px-3 py-2 text-xs font-bold text-[#5D565A]'
                "
              >
                <input
                  type="checkbox"
                  :checked="question.allowedUploadTypes?.includes(type) || false"
                  class="h-4 w-4 text-rose-600 focus:ring-rose-500"
                  @change="toggleAllowedUploadType(type)"
                />
                {{ type === 'image' ? '图片' : '视频' }}
              </label>
            </div>
          </div>
          <label class="block">
            <span :class="fieldLabelClass">评分要点</span>
            <textarea
              data-i18n-skip="true"
              :value="blank(question.scoringRubric)"
              :class="
                isEdit
                  ? 'min-h-20 w-full resize-none rounded-lg border border-[#E5DED8] px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-rose-500/20'
                  : 'min-h-16 w-full resize-none rounded border border-[#E5DED8] px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20'
              "
              @input="patch({ scoringRubric: ($event.target as HTMLTextAreaElement).value })"
            ></textarea>
          </label>
          <label v-if="isEdit" class="block">
            <span :class="fieldLabelClass">AI 阅卷提示 (选填)</span>
            <textarea
              data-i18n-skip="true"
              :value="blank(question.aiGradingHint)"
              class="min-h-16 w-full resize-none rounded-lg border border-[#E5DED8] px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-rose-500/20"
              @input="patch({ aiGradingHint: ($event.target as HTMLTextAreaElement).value })"
            ></textarea>
          </label>
        </div>
      </div>
    </template>

    <!-- 复选网格 -->
    <template v-else-if="question.type === 'checkbox_grid'">
      <div class="space-y-3">
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <div class="mb-2 flex items-center justify-between">
              <span :class="labelClass">网格行</span>
              <button
                type="button"
                class="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E5DED8] bg-white px-2.5 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
                @click="addGridItem('gridRows')"
              >
                <Icon icon="ep:plus" :size="14" />
                加行
              </button>
            </div>
            <div class="space-y-2">
              <div
                v-for="row in question.gridRows || []"
                :key="row.id"
                :class="
                  isEdit
                    ? 'flex items-center gap-2 rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-2'
                    : 'flex items-center gap-2'
                "
              >
                <span :class="chipClass">{{ row.label }}</span>
                <input
                  data-i18n-skip="true"
                  :value="row.text"
                  :class="gridInputClass"
                  @input="
                    updateGridItem('gridRows', row.id, ($event.target as HTMLInputElement).value)
                  "
                />
              </div>
            </div>
          </div>
          <div>
            <div class="mb-2 flex items-center justify-between">
              <span :class="labelClass">网格列</span>
              <button
                type="button"
                class="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E5DED8] bg-white px-2.5 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
                @click="addGridItem('gridColumns')"
              >
                <Icon icon="ep:plus" :size="14" />
                加列
              </button>
            </div>
            <div class="space-y-2">
              <div
                v-for="column in question.gridColumns || []"
                :key="column.id"
                :class="
                  isEdit
                    ? 'flex items-center gap-2 rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-2'
                    : 'flex items-center gap-2'
                "
              >
                <span :class="chipClass">{{ column.label }}</span>
                <input
                  data-i18n-skip="true"
                  :value="column.text"
                  :class="gridInputClass"
                  @input="
                    updateGridItem(
                      'gridColumns',
                      column.id,
                      ($event.target as HTMLInputElement).value
                    )
                  "
                />
              </div>
            </div>
          </div>
        </div>
        <div
          :class="
            isEdit
              ? 'overflow-x-auto rounded-lg border border-[#E9E4DF]'
              : 'overflow-x-auto rounded border border-[#E9E4DF]'
          "
        >
          <table class="min-w-full text-xs">
            <thead class="bg-[#F8F5F3]">
              <tr>
                <th
                  :class="
                    isEdit
                      ? 'w-28 px-3 py-2 text-left text-[#766F73]'
                      : 'px-3 py-2 text-left text-[#766F73]'
                  "
                >
                  匹配项
                </th>
                <th
                  v-for="column in question.gridColumns || []"
                  :key="column.id"
                  data-i18n-skip="true"
                  class="px-3 py-2 text-center text-[#766F73]"
                >
                  {{ column.text || column.label }}
                </th>
              </tr>
            </thead>
            <tbody class="bg-white">
              <tr
                v-for="(row, rowIndex) in question.gridRows || []"
                :key="row.id"
                :class="rowIndex > 0 ? 'border-t border-[#E9E4DF]' : ''"
              >
                <td data-i18n-skip="true" class="px-3 py-2 font-bold text-[#3F3A3D]">
                  {{ row.text || row.label }}
                </td>
                <td
                  v-for="column in question.gridColumns || []"
                  :key="column.id"
                  class="px-3 py-2 text-center"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 text-rose-600 focus:ring-rose-500"
                    :checked="
                      question.gridCorrectAnswers?.some(
                        (answer) => answer.rowId === row.id && answer.columnId === column.id
                      ) || false
                    "
                    @change="toggleGridAnswer(row.id, column.id)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- 排序题 -->
    <template v-else-if="question.type === 'ordering'">
      <div>
        <div class="mb-2 flex items-center justify-between">
          <span :class="labelClass">排序步骤与正确顺序</span>
          <button
            type="button"
            class="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E5DED8] bg-white px-2.5 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
            @click="addOption"
          >
            <Icon icon="ep:plus" :size="14" />
            增加步骤
          </button>
        </div>
        <div :class="isEdit ? 'space-y-2' : 'grid gap-2 md:grid-cols-2'">
          <div
            v-for="option in question.options || []"
            :key="option.id"
            :class="
              isEdit
                ? 'grid grid-cols-[72px_1fr] items-center gap-2 rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-2'
                : 'grid grid-cols-[72px_1fr] items-center gap-2 rounded border border-[#E5DED8] bg-[#F8F5F3] p-2 text-sm'
            "
          >
            <select
              :value="Math.max(0, orderingOrder.indexOf(option.id))"
              class="h-8 rounded border border-[#E5DED8] bg-white px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500/20"
              @change="
                setOrderingPosition(option.id, Number(($event.target as HTMLSelectElement).value))
              "
            >
              <option
                v-for="(_, optionIndex) in question.options || []"
                :key="optionIndex"
                :value="optionIndex"
              >
                第 {{ optionIndex + 1 }}
              </option>
            </select>
            <div class="flex min-w-0 items-center gap-2">
              <span :class="chipClass">{{ option.label }}</span>
              <input
                data-i18n-skip="true"
                :value="option.text"
                class="h-8 min-w-0 flex-1 rounded border border-[#E5DED8] bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
                @input="updateOption(option.id, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 单选 / 多选 / 判断 / 下拉 -->
    <template v-else>
      <div>
        <div class="mb-2 flex items-center justify-between">
          <span :class="labelClass">
            {{ question.type === 'dropdown' ? '下拉选项与答案' : '选项与答案' }}
          </span>
          <button
            v-if="question.type !== 'true_false'"
            type="button"
            class="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E5DED8] bg-white px-2.5 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
            @click="addOption"
          >
            <Icon icon="ep:plus" :size="14" />
            增加选项
          </button>
        </div>
        <div :class="isEdit ? 'space-y-2' : 'grid gap-2 md:grid-cols-2'">
          <div
            v-for="option in question.options || []"
            :key="option.id"
            :class="[
              isEdit
                ? 'grid grid-cols-[32px_1fr] items-center gap-2 rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] p-2'
                : 'grid grid-cols-[32px_1fr] items-center gap-2 rounded border p-2 text-sm',
              !isEdit && question.correctOptionIds?.includes(option.id)
                ? 'bg-[#EEF8F4] border-emerald-200 text-emerald-800 font-medium'
                : '',
              !isEdit && !question.correctOptionIds?.includes(option.id)
                ? 'bg-[#F8F5F3] border-[#E5DED8] text-[#5D565A]'
                : ''
            ]"
          >
            <label v-if="isEdit" class="flex h-8 items-center justify-center">
              <input
                :type="question.type === 'multiple_choice' ? 'checkbox' : 'radio'"
                :checked="question.correctOptionIds?.includes(option.id) || false"
                class="h-4 w-4 text-rose-600 focus:ring-rose-500"
                @change="toggleCorrectOption(option.id)"
              />
            </label>
            <input
              v-else
              :type="question.type === 'multiple_choice' ? 'checkbox' : 'radio'"
              :checked="question.correctOptionIds?.includes(option.id) || false"
              class="h-4 w-4 text-rose-600 focus:ring-rose-500"
              @change="toggleCorrectOption(option.id)"
            />
            <div class="flex min-w-0 items-center gap-2">
              <span :class="chipClass">{{ option.label }}</span>
              <input
                data-i18n-skip="true"
                :value="option.text"
                :disabled="question.type === 'true_false'"
                :class="
                  isEdit
                    ? 'h-8 min-w-0 flex-1 rounded-md border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 disabled:bg-[#F1ECE8]'
                    : 'h-8 min-w-0 flex-1 rounded border border-[#E5DED8] bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 disabled:bg-transparent'
                "
                @input="updateOption(option.id, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
