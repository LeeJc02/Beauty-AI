<script setup lang="ts">
/**
 * 生成题目（原型 `src/pages/ExamGenerate.tsx`）。
 *
 * 交互路径与原型一致：上传 → AI 解析（进度条）→ 生成结果预览（可逐题编辑）→ 审核导入题库。
 * 题库读写走 `useQuestionBank()`，题目答案编辑复用 `components/QuestionAnswerFields.vue`。
 */
import {
  createUploadPreviewQuestions,
  getQuestionAnswerText,
  getQuestionTagNames,
  normalizeQuestionForType,
  QUESTION_TYPE_LABELS,
  type QuestionBankItem,
  type QuestionType
} from '@/beauty/lib/questionBank'
import { aiActionTone } from '@/beauty/lib/visualTones'
import { useBeautyI18n, useQuestionBank } from '@/beauty/composables'
import QuestionAnswerFields from '../components/QuestionAnswerFields.vue'

defineOptions({ name: 'BeautyExamGenerate' })

const { t } = useBeautyI18n()
const { addQuestions, tags } = useQuestionBank()

type GenerateStep = 'upload' | 'generating' | 'preview'

const step = ref<GenerateStep>('upload')
const progress = ref(0)
const showToast = ref(false)
const previewQuestions = ref<QuestionBankItem[]>([])
let progressTimer: number | null = null

const stopProgressTimer = () => {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer)
    progressTimer = null
  }
}

onBeforeUnmount(stopProgressTimer)

/** 与原型一致：每 800ms +25，涨到 100 后再等一拍才切到预览。 */
const handleStartGeneration = () => {
  step.value = 'generating'
  progress.value = 0
  stopProgressTimer()
  progressTimer = window.setInterval(() => {
    if (progress.value >= 100) {
      stopProgressTimer()
      previewQuestions.value = createUploadPreviewQuestions()
      step.value = 'preview'
      return
    }
    progress.value += 25
  }, 800)
}

/** 统一入口：先 patch 再按题型规范化（等价原型的 setPreviewQuestions + normalizeQuestionForType）。 */
const applyPreviewPatch = (id: string, patch: Partial<QuestionBankItem>) => {
  previewQuestions.value = previewQuestions.value.map((question) =>
    question.id === id ? normalizeQuestionForType({ ...question, ...patch }) : question
  )
}

const handleTypeChange = (id: string, type: QuestionType) => {
  applyPreviewPatch(id, { type })
}

const removePreviewQuestion = (id: string) => {
  previewQuestions.value = previewQuestions.value.filter((question) => question.id !== id)
}

const handleImport = () => {
  addQuestions(
    previewQuestions.value.map((question) =>
      normalizeQuestionForType({ ...question, status: 'active' })
    )
  )
  showToast.value = true
  window.setTimeout(() => {
    showToast.value = false
    previewQuestions.value = []
    step.value = 'upload'
  }, 2000)
}
</script>

<template>
  <div class="relative space-y-6">
    <div
      v-if="showToast"
      class="beauty-toast-in absolute right-0 top-0 z-50 flex items-center gap-2 rounded-lg bg-[#3B8F72] px-4 py-2 text-white shadow-lg"
    >
      <Icon icon="lucide:check-circle" :size="16" />
      <span class="text-sm font-bold">{{ t('成功导入到题库！') }}</span>
    </div>

    <!-- 上传 -->
    <div
      v-if="step === 'upload'"
      class="flex flex-col gap-4 overflow-hidden rounded-xl border-2 border-dashed border-[#E5DED8] bg-white py-4 text-sm shadow-[0_0_0_1px_rgb(31_28_31_/_10%)]"
    >
      <div class="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div
          class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500"
        >
          <Icon icon="lucide:upload-cloud" :size="40" />
        </div>
        <h3 class="mb-2 text-xl font-bold text-[#1F1C1F]">{{ t('生成题目') }}</h3>
        <p class="mb-8 text-sm text-[#766F73]">
          {{ t('拖拽 PDF、DOC、PPTX文件至此或点击上传，AI 将自动分析提取内容并出题') }}
        </p>

        <div class="mb-8 flex flex-wrap justify-center gap-3">
          <div
            class="flex items-center rounded-lg border border-[#E5DED8] bg-[#F8F5F3] px-4 py-2 text-sm"
          >
            <Icon icon="lucide:file-text" :size="16" class="mr-2 text-rose-500" />
            <span data-i18n-skip="true" class="font-medium text-[#3F3A3D]"
              >Lumina_新品精华_培训版.pdf</span
            >
          </div>
          <div
            class="flex items-center rounded-lg border border-[#E8CCA0] bg-[#FFF7EA] px-4 py-2 text-sm text-[#8B621F]"
          >
            {{ t('生成结果将先进入待审核预览') }}
          </div>
        </div>

        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-8 text-sm font-bold transition-colors"
          :class="aiActionTone.primaryButtonClass"
          @click="handleStartGeneration"
        >
          <Icon icon="lucide:wand-2" :size="16" class="mr-2" />
          {{ t('一键生成题目') }}
        </button>
      </div>
    </div>

    <!-- 生成中 -->
    <div
      v-else-if="step === 'generating'"
      class="flex flex-col gap-4 overflow-hidden rounded-xl bg-white py-4 text-sm shadow-[0_0_0_1px_rgb(31_28_31_/_10%)]"
    >
      <div class="flex flex-col items-center justify-center px-4 py-20 text-center">
        <Icon icon="lucide:loader-2" :size="48" class="mb-6 animate-spin text-rose-600" />
        <h3 class="mb-2 text-xl font-bold text-[#1F1C1F]">
          {{ t('AI 正在深度解析文件并生成题目') }}
        </h3>
        <p class="mb-8 text-sm text-[#766F73]">{{ t('基于行业知识图谱提取核心考点...') }}</p>
        <div class="w-full max-w-md">
          <div class="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full bg-[#C93F63] transition-all"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
          <p class="mt-2 text-right text-xs text-[#9A9396]">{{ progress }}%</p>
        </div>
      </div>
    </div>

    <!-- 生成结果预览 -->
    <div v-else class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-[#1F1C1F]">{{ t('生成结果预览') }}</h1>
          <p class="mt-1 text-[#766F73]">
            {{ t('共生成') }} {{ previewQuestions.length }}
            {{ t('道题目。请先人工编辑审核，确认后再导入题库。') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[#E5DED8] bg-white px-3 text-sm font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
            @click="step = 'upload'"
          >
            {{ t('返回重新生成') }}
          </button>
          <button
            type="button"
            class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-rose-600 px-3 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-50"
            :disabled="previewQuestions.length === 0"
            @click="handleImport"
          >
            <Icon icon="lucide:database" :size="16" class="mr-2" />
            {{ t('审核导入题库') }}
          </button>
        </div>
      </div>

      <div class="grid gap-4">
        <div
          v-for="(question, index) in previewQuestions"
          :key="question.id"
          class="flex flex-col gap-4 overflow-hidden rounded-xl bg-white py-4 text-sm shadow-[0_0_0_1px_rgb(31_28_31_/_10%)]"
        >
          <div
            class="flex flex-col gap-3 border-b border-[#E9E4DF] px-4 pb-3 md:flex-row md:items-center md:justify-between"
          >
            <div class="flex flex-wrap items-center gap-2">
              <select
                :value="question.type"
                class="h-8 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-bold text-rose-700 outline-none focus:ring-2 focus:ring-rose-500/20"
                @change="
                  handleTypeChange(
                    question.id,
                    ($event.target as HTMLSelectElement).value as QuestionType
                  )
                "
              >
                <option v-for="(label, value) in QUESTION_TYPE_LABELS" :key="value" :value="value">
                  {{ t(label) }}
                </option>
              </select>
              <span
                class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-[#E8CCA0] bg-[#FFF7EA] px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[#8B621F]"
              >
                {{ t('待审核') }}
              </span>
              <span class="text-xs text-[#766F73]">
                {{ t('来源:') }} <span data-i18n-skip="true">{{ question.sourceFile }}</span>
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span
                v-for="tag in getQuestionTagNames(question, tags)"
                :key="tag"
                data-i18n-skip="true"
                class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full bg-[#F7EDEF] px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[#4A3238]"
              >
                {{ tag }}
              </span>
              <button
                type="button"
                class="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50"
                @click="removePreviewQuestion(question.id)"
              >
                <Icon icon="lucide:trash-2" :size="14" />
                {{ t('移除') }}
              </button>
            </div>
          </div>

          <div class="space-y-4 px-4 pt-4">
            <label class="block">
              <span class="mb-1 flex items-center text-xs font-bold text-[#766F73]">
                <Icon icon="lucide:edit" :size="14" class="mr-1" />
                {{ t('题干') }} {{ index + 1 }}
              </span>
              <textarea
                data-i18n-skip="true"
                :value="question.stem"
                class="min-h-16 w-full resize-none rounded border border-[#E5DED8] px-2 py-2 text-sm font-bold text-[#242124] outline-none focus:ring-2 focus:ring-rose-500/20"
                @input="
                  applyPreviewPatch(question.id, {
                    stem: ($event.target as HTMLTextAreaElement).value
                  })
                "
              ></textarea>
            </label>

            <QuestionAnswerFields
              :question="question"
              mode="preview"
              @patch="applyPreviewPatch(question.id, $event)"
            />

            <div class="flex items-start text-sm font-medium text-[#3B8F72]">
              <Icon icon="lucide:check-circle" :size="16" class="mr-1.5 mt-0.5 shrink-0" />
              <span>
                {{ t('当前正确答案:') }}
                <span data-i18n-skip="true">{{ getQuestionAnswerText(question) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.beauty-toast-in {
  animation: beauty-toast-in 0.2s ease-out;
}

@keyframes beauty-toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
