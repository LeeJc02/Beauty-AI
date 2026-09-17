<script setup lang="ts">
/**
 * 考试组卷（原型 `src/pages/ExamManage.tsx`）。
 *
 * 左侧试卷列表 + 右侧编排区：选题目（含固定信息题）、AI 智能组卷、发布考试。
 * 发布考试后调用共享 store `useExamTasks().publishExam()` 追加考试任务，
 * 再 `router.push('/tasks/exam')` 跳到「考试任务管理」（等价原型的 `onExamPublished` + `onGoToExamTasks`）。
 */
import { getQuestionTagNames, QUESTION_TYPE_LABELS } from '@/beauty/lib/questionBank'
import {
  DEFAULT_EXAM_PASS_RULES,
  DEFAULT_EXAM_PROFILE_QUESTIONS,
  EXAM_PARTICIPANT_ROLES,
  EXAM_PASS_SCORE_OPTIONS,
  getExamParticipantRoleName,
  type ExamPassRule
} from '@/beauty/lib/examPublishSettings'
import { aiActionTone } from '@/beauty/lib/visualTones'
import { useBeautyI18n, useQuestionBank } from '@/beauty/composables'
import { publishExam } from '../useExamTasks'

defineOptions({ name: 'BeautyExamAssemble' })

interface ExamPaper {
  id: string
  title: string
  status: 'Draft' | 'Published'
  questionCount: number
  description: string
}

const INITIAL_EXAMS: ExamPaper[] = [
  {
    id: 'e1',
    title: '2023年Q4新品全员考核',
    status: 'Draft',
    questionCount: 15,
    description: '本次考试重点考察Q4新品的核心卖点、适用人群及销售话术。'
  },
  {
    id: 'e2',
    title: '冬季保湿系列通关测试',
    status: 'Published',
    questionCount: 20,
    description: '针对冬季主推保湿单品的知识回顾与通关测试。'
  }
]

const createPassRuleId = () => `pass-rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const { t } = useBeautyI18n()
const router = useRouter()
const { questions, tags } = useQuestionBank()

const exams = ref<ExamPaper[]>(INITIAL_EXAMS.map((exam) => ({ ...exam })))
const selectedExamId = ref<string>(INITIAL_EXAMS[0].id)

const examQuestions = ref<{ examId: string; questions: string[] }[]>([
  { examId: 'e1', questions: ['b1', 'b3', 'b4'] },
  { examId: 'e2', questions: ['b1', 'b2'] }
])

const aiDialog = ref(false)
const publishDialog = ref(false)
const publishSuccessDialog = ref(false)
const infoDialog = ref(false)
const passRules = ref<ExamPassRule[]>(DEFAULT_EXAM_PASS_RULES.map((rule) => ({ ...rule })))

const editTitle = ref('')
const editDesc = ref('')
const toast = ref('')

/** 原型里的发布范围/截止时间/时长是非受控字段，这里同样只保留静态展示。 */
const publishScope = ref('全国范围')
const publishDuration = ref<number | undefined>()

const selectedExam = computed(() => exams.value.find((exam) => exam.id === selectedExamId.value))
const currentQuestions = computed(
  () => examQuestions.value.find((item) => item.examId === selectedExamId.value)?.questions || []
)
const activeBank = computed(() =>
  questions.value.filter((question) => question.status === 'active')
)
const linkedQuestions = computed(() =>
  activeBank.value.filter((question) => currentQuestions.value.includes(question.id))
)
const availableQuestions = computed(() =>
  activeBank.value.filter((question) => !currentQuestions.value.includes(question.id))
)
const paperQuestionCount = computed(
  () => linkedQuestions.value.length + DEFAULT_EXAM_PROFILE_QUESTIONS.length
)
const selectedPassRuleRoleIds = computed(() => passRules.value.map((rule) => rule.roleId))
const canAddPassRule = computed(
  () => selectedPassRuleRoleIds.value.length < EXAM_PARTICIPANT_ROLES.length
)

let toastTimer: number | null = null

const showToast = (message: string) => {
  toast.value = message
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 3000)
}

onBeforeUnmount(() => {
  if (toastTimer !== null) window.clearTimeout(toastTimer)
})

const handleLink = (questionId: string) => {
  if (!examQuestions.value.some((item) => item.examId === selectedExamId.value)) {
    examQuestions.value = [
      ...examQuestions.value,
      { examId: selectedExamId.value, questions: [questionId] }
    ]
    return
  }
  examQuestions.value = examQuestions.value.map((item) =>
    item.examId === selectedExamId.value
      ? { ...item, questions: [...item.questions, questionId] }
      : item
  )
}

const handleUnlink = (questionId: string) => {
  examQuestions.value = examQuestions.value.map((item) =>
    item.examId === selectedExamId.value
      ? { ...item, questions: item.questions.filter((id) => id !== questionId) }
      : item
  )
}

/** 与原型一致：AI 组卷取题库前 3 道已入库题直接替换当前试卷题目。 */
const handleAIGenerate = () => {
  const nextIds = activeBank.value.slice(0, 3).map((question) => question.id)
  examQuestions.value = examQuestions.value.map((item) =>
    item.examId === selectedExamId.value ? { ...item, questions: nextIds } : item
  )
  aiDialog.value = false
  showToast('AI 组卷完成！')
}

const handleSave = () => {
  showToast('保存试卷配置成功！')
}

const handleEditInfoStart = () => {
  if (!selectedExam.value) return
  editTitle.value = selectedExam.value.title
  editDesc.value = selectedExam.value.description
  infoDialog.value = true
}

const handleSaveInfo = () => {
  exams.value = exams.value.map((exam) =>
    exam.id === selectedExamId.value
      ? { ...exam, title: editTitle.value, description: editDesc.value }
      : exam
  )
  infoDialog.value = false
  showToast('基本信息已更新')
}

const updatePassRuleRole = (ruleId: string, roleId: string) => {
  passRules.value = passRules.value.map((rule) =>
    rule.id === ruleId ? { ...rule, roleId, roleName: getExamParticipantRoleName(roleId) } : rule
  )
}

const updatePassRuleScore = (ruleId: string, score: number) => {
  passRules.value = passRules.value.map((rule) => (rule.id === ruleId ? { ...rule, score } : rule))
}

const addPassRule = () => {
  const nextRole = EXAM_PARTICIPANT_ROLES.find(
    (role) => !selectedPassRuleRoleIds.value.includes(role.id)
  )
  if (!nextRole) return
  passRules.value = [
    ...passRules.value,
    { id: createPassRuleId(), roleId: nextRole.id, roleName: nextRole.name, score: 80 }
  ]
}

const removePassRule = (ruleId: string) => {
  if (passRules.value.length <= 1) return
  passRules.value = passRules.value.filter((rule) => rule.id !== ruleId)
}

const handlePublish = () => {
  if (selectedExam.value) {
    // 共享 store：考试任务管理页读取同一份列表
    publishExam({
      id: selectedExam.value.id,
      title: selectedExam.value.title,
      passRules: passRules.value.map((rule) => ({ ...rule })),
      profileQuestions: DEFAULT_EXAM_PROFILE_QUESTIONS,
      questionCount: paperQuestionCount.value
    })
  }
  exams.value = exams.value.map((exam) =>
    exam.id === selectedExamId.value ? { ...exam, status: 'Published' } : exam
  )
  publishDialog.value = false
  publishSuccessDialog.value = true
}

const handleGoToExamTasks = () => {
  publishSuccessDialog.value = false
  router.push({ path: '/tasks/exam' })
}
</script>

<template>
  <div
    class="relative flex h-[calc(100vh-11.5rem)] min-h-[620px] overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F7F3F1] pt-2"
  >
    <!-- 左侧试卷列表 -->
    <div class="flex w-80 shrink-0 flex-col border-r border-[#E5DED8] bg-white">
      <div class="z-10 flex items-center justify-between border-b border-[#E9E4DF] bg-white p-4">
        <h2 class="font-bold tracking-tight text-[#242124]">{{ t('考试试卷列表') }}</h2>
        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
        >
          <Icon icon="ep:plus" :size="16" />
          {{ t('新建') }}
        </button>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-4">
        <div
          v-for="exam in exams"
          :key="exam.id"
          class="group flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-all"
          :class="
            selectedExamId === exam.id
              ? 'border-rose-600 bg-rose-50/50 shadow-sm'
              : 'border-transparent bg-[#F8F5F3] hover:border-[#E5DED8] hover:bg-[#F1ECE8]'
          "
          @click="selectedExamId = exam.id"
        >
          <div class="flex w-full items-start gap-3">
            <div
              class="mt-0.5 shrink-0 rounded-lg p-2"
              :class="
                selectedExamId === exam.id ? 'bg-rose-100 text-rose-600' : 'bg-white text-[#9A9396]'
              "
            >
              <Icon icon="lucide:file-text" :size="20" />
            </div>
            <div class="w-full min-w-0 pr-2">
              <h3
                data-i18n-skip="true"
                class="truncate text-sm font-bold"
                :class="selectedExamId === exam.id ? 'text-rose-950' : 'text-[#242124]'"
              >
                {{ exam.title }}
              </h3>
              <div class="mt-2 flex items-center justify-between">
                <span
                  class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
                  :class="
                    exam.status === 'Published'
                      ? 'bg-[#3B8F72] text-white'
                      : 'bg-[#F7EDEF] text-[#4A3238]'
                  "
                >
                  {{ exam.status === 'Published' ? t('已发布') : t('待发布') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧组卷区 -->
    <div class="relative flex flex-1 flex-col overflow-hidden bg-[#F7F3F1]">
      <div
        v-if="toast"
        class="beauty-toast-in absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#3B8F72] px-4 py-2 text-white shadow-lg"
      >
        <Icon icon="lucide:check-circle" :size="16" />
        <span class="text-sm font-bold">{{ toast }}</span>
      </div>

      <template v-if="selectedExam">
        <div
          class="flex shrink-0 items-center justify-between border-b border-[#E5DED8] bg-white p-6"
        >
          <div class="mr-6 flex-1">
            <div class="flex items-center gap-2">
              <h1 data-i18n-skip="true" class="text-xl font-bold text-[#242124]">
                {{ selectedExam.title }}
              </h1>
              <button
                type="button"
                class="inline-flex h-6 shrink-0 items-center rounded-lg px-2 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                @click="handleEditInfoStart"
              >
                <Icon icon="ep:edit" :size="12" class="mr-1" /> {{ t('编辑简介') }}
              </button>
            </div>
            <p
              v-if="selectedExam.description"
              data-i18n-skip="true"
              class="mt-1 text-xs text-[#766F73]"
            >
              {{ selectedExam.description }}
            </p>
            <p v-else class="mt-1 text-xs text-[#766F73]">{{ t('暂无考试简介') }}</p>
          </div>
          <div class="flex shrink-0 gap-3">
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-sm font-bold transition-colors"
              :class="aiActionTone.buttonClass"
              @click="aiDialog = true"
            >
              <Icon icon="lucide:wand-2" :size="16" class="mr-2" :class="aiActionTone.iconClass" />
              AI 智能组卷
            </button>
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[#E5DED8] bg-white px-2.5 text-sm font-bold text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3]"
              @click="handleSave"
            >
              <Icon icon="lucide:save" :size="16" class="mr-2" />
              {{ t('保存配置') }}
            </button>
            <button
              v-if="selectedExam.status === 'Draft'"
              type="button"
              class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#3B8F72] px-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
              @click="publishDialog = true"
            >
              {{ t('发布考试') }}
            </button>
          </div>
        </div>

        <div class="flex flex-1 flex-col gap-6 overflow-y-auto p-6 md:p-8 xl:flex-row">
          <!-- 已选题目 -->
          <div class="flex-1 space-y-4">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="flex items-center font-bold text-[#242124]">
                <Icon icon="lucide:clipboard-list" :size="20" class="mr-2 text-[#3B8F72]" />
                {{ t('已选题目列表') }} ({{ paperQuestionCount }})
              </h3>
              <span
                class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-[#DCEFE7] bg-[#EEF8F4] px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-[#2F735C]"
              >
                {{ t('含') }} {{ DEFAULT_EXAM_PROFILE_QUESTIONS.length }} {{ t('道固定信息题') }}
              </span>
            </div>

            <div class="space-y-3">
              <div
                v-for="(question, index) in linkedQuestions"
                :key="question.id"
                class="relative overflow-hidden rounded-xl border border-emerald-100 bg-white text-sm shadow-sm"
              >
                <div class="absolute bottom-0 left-0 top-0 w-1 bg-[#3B8F72]"></div>
                <div class="p-4 pl-5">
                  <div class="flex items-start justify-between gap-4">
                    <div class="text-sm font-medium text-[#242124]">
                      <span>{{ index + 1 }}. </span
                      ><span data-i18n-skip="true">{{ question.stem }}</span>
                    </div>
                    <button
                      type="button"
                      class="shrink-0 rounded-md p-1.5 text-[#9A9396] transition-colors hover:bg-red-50 hover:text-red-500"
                      title="移除"
                      @click="handleUnlink(question.id)"
                    >
                      <Icon icon="lucide:trash-2" :size="16" />
                    </button>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-white px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-[#2F735C]"
                    >
                      {{ t(QUESTION_TYPE_LABELS[question.type]) }}
                    </span>
                    <span
                      v-for="tag in getQuestionTagNames(question, tags)"
                      :key="tag"
                      data-i18n-skip="true"
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full bg-[#F7EDEF] px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-[#4A3238]"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>

              <div
                v-if="linkedQuestions.length === 0"
                class="rounded-xl border border-dashed border-[#E5DED8] bg-white py-10 text-center text-sm text-[#9A9396]"
              >
                {{ t('暂无业务题，可点击上方AI组卷或从右侧题库手动添加') }}
              </div>

              <div
                v-for="(profileQuestion, index) in DEFAULT_EXAM_PROFILE_QUESTIONS"
                :key="profileQuestion.id"
                class="relative overflow-hidden rounded-xl border border-[#DCEFE7] bg-[#F6FBF8] text-sm shadow-sm"
              >
                <div class="absolute bottom-0 left-0 top-0 w-1 bg-[#78B29F]"></div>
                <div class="p-4 pl-5">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-sm font-medium text-[#242124]">
                        <span>{{ linkedQuestions.length + index + 1 }}. </span>
                        <span>{{ t(profileQuestion.stem) }}</span>
                      </div>
                      <div
                        class="mt-2 rounded-lg border border-dashed border-[#BFDCCF] bg-white px-3 py-2 text-xs text-[#766F73]"
                      >
                        {{ t('作答输入框占位：') }}{{ t(profileQuestion.placeholder) }}
                      </div>
                    </div>
                    <span
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-[#BFDCCF] bg-white px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-[#2F735C]"
                    >
                      {{ t('固定最后题') }}
                    </span>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-[#BFDCCF] bg-white px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-[#2F735C]"
                    >
                      {{ t('信息填写') }}
                    </span>
                    <span
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full bg-[#F7EDEF] px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-[#4A3238]"
                    >
                      {{ t('不计分') }}
                    </span>
                    <span
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full bg-[#F7EDEF] px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-[#4A3238]"
                    >
                      {{ t('发布时自动下发') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 从题库添加 -->
          <div class="flex-1 space-y-4 xl:border-l xl:border-[#E5DED8] xl:pl-6">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="flex items-center font-bold text-[#242124]">
                <Icon icon="lucide:database" :size="20" class="mr-2 text-rose-500" />
                {{ t('从题库手动添加') }}
              </h3>
            </div>

            <div class="space-y-3">
              <div
                v-for="question in availableQuestions"
                :key="question.id"
                class="group rounded-xl border border-[#E5DED8] bg-white text-sm shadow-sm"
              >
                <div class="p-4">
                  <div class="flex items-start justify-between gap-4">
                    <div data-i18n-skip="true" class="text-sm font-medium text-[#3F3A3D]">
                      {{ question.stem }}
                    </div>
                    <button
                      type="button"
                      class="flex shrink-0 items-center rounded-md p-1 text-rose-600 transition-colors hover:bg-rose-50"
                      title="添加"
                      @click="handleLink(question.id)"
                    >
                      <Icon icon="ep:plus" :size="18" />
                    </button>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-rose-100 bg-white px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-rose-600"
                    >
                      {{ t(QUESTION_TYPE_LABELS[question.type]) }}
                    </span>
                    <span
                      v-for="tag in getQuestionTagNames(question, tags)"
                      :key="tag"
                      data-i18n-skip="true"
                      class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border border-[#E5DED8] bg-[#F8F5F3] px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-[#1F1C1F]"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
              <div
                v-if="availableQuestions.length === 0"
                class="py-10 text-center text-sm text-[#9A9396]"
              >
                {{ t('没有更多可供添加的候选题目') }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="flex flex-1 flex-col items-center justify-center text-[#9A9396]">
        <Icon icon="lucide:clipboard-list" :size="64" class="mb-4 opacity-20" />
        <p class="font-medium text-[#766F73]">{{ t('在左侧选择一份试卷进行编排') }}</p>
      </div>
    </div>

    <!-- AI 智能组卷 -->
    <el-dialog v-model="aiDialog" width="420px" :append-to-body="true">
      <template #header>
        <span class="flex items-center text-base font-medium text-[#242124]">
          <Icon icon="lucide:wand-2" :size="20" class="mr-2" :class="aiActionTone.iconClass" />
          {{ t('AI 智能组卷参数') }}
        </span>
      </template>
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-[#3F3A3D]">{{
            t('包含考点 (标签)')
          }}</label>
          <input
            type="text"
            :placeholder="t('例如：新品, 成分, 销售话术')"
            class="w-full rounded-md border border-[#E5DED8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-[#3F3A3D]">{{
            t('期望题目数量')
          }}</label>
          <input
            type="number"
            :placeholder="t('默认为 20')"
            class="w-full rounded-md border border-[#E5DED8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-[#3F3A3D]">{{ t('难度比例') }}</label>
          <input
            type="text"
            :placeholder="t('例如：基础 60%, 进阶 30%, 困难 10%')"
            class="w-full rounded-md border border-[#E5DED8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <el-button @click="aiDialog = false">{{ t('取消') }}</el-button>
          <el-button
            class="!border-none"
            :class="aiActionTone.primaryButtonClass"
            @click="handleAIGenerate"
          >
            {{ t('确认生成') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 发布考试 -->
    <el-dialog v-model="publishDialog" width="512px" :append-to-body="true">
      <template #header>
        <span class="flex items-center text-base font-medium text-[#242124]">
          {{ t('发布考试：') }}{{ selectedExam?.title }}
        </span>
      </template>
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-[#3F3A3D]">{{ t('发布范围') }}</label>
          <select
            v-model="publishScope"
            class="w-full rounded-md border border-[#E5DED8] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          >
            <option value="全国范围">{{ t('全国范围') }}</option>
            <option value="指定大区">{{ t('指定大区') }}</option>
            <option value="指定门店">{{ t('指定门店') }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-[#3F3A3D]">{{ t('截止时间') }}</label>
          <input
            type="datetime-local"
            class="w-full rounded-md border border-[#E5DED8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
        <div>
          <div class="mb-2 flex items-center justify-between gap-3">
            <label class="block text-sm font-medium text-[#3F3A3D]">{{ t('岗位及格分数') }}</label>
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#E5DED8] bg-white px-2 text-xs font-medium text-[#1F1C1F] transition-colors hover:bg-[#F8F5F3] disabled:pointer-events-none disabled:opacity-50"
              :disabled="!canAddPassRule"
              @click="addPassRule"
            >
              <Icon icon="ep:plus" :size="14" />
              {{ t('添加条件') }}
            </button>
          </div>
          <div class="space-y-2">
            <div v-for="rule in passRules" :key="rule.id" class="pass-rule-row">
              <select
                :value="rule.roleId"
                class="h-10 min-w-0 rounded-md border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:border-[#3B8F72] focus:ring-2 focus:ring-[#3B8F72]/15"
                @change="updatePassRuleRole(rule.id, ($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="role in EXAM_PARTICIPANT_ROLES"
                  :key="role.id"
                  :value="role.id"
                  :disabled="selectedPassRuleRoleIds.includes(role.id) && role.id !== rule.roleId"
                >
                  {{ role.name }}
                </option>
              </select>
              <select
                :value="rule.score"
                class="h-10 rounded-md border border-[#E5DED8] bg-white px-3 text-sm outline-none focus:border-[#3B8F72] focus:ring-2 focus:ring-[#3B8F72]/15"
                @change="
                  updatePassRuleScore(rule.id, Number(($event.target as HTMLSelectElement).value))
                "
              >
                <option v-for="score in EXAM_PASS_SCORE_OPTIONS" :key="score" :value="score">
                  {{ score }} {{ t('分') }}
                </option>
              </select>
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md text-[#9A9396] transition-colors hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-30"
                :disabled="passRules.length === 1"
                title="删除条件"
                @click="removePassRule(rule.id)"
              >
                <Icon icon="lucide:trash-2" :size="16" />
              </button>
            </div>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-[#3F3A3D]">{{
            t('考试时长 (分钟)')
          }}</label>
          <input
            v-model="publishDuration"
            type="number"
            placeholder="45"
            class="w-full rounded-md border border-[#E5DED8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
        <div class="profile-field-note">
          <button type="button" class="profile-field-note__badge">注</button>
          <div data-i18n-skip="true" role="tooltip" class="profile-field-note__tip">
            给研发：系统自己带职位名称和地区；门店不进系统，由客户自己填。填写后进入考试结果统计，客户后续通过
            Excel 导出自行治理。
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-bold text-[#2F735C]">{{ t('随卷信息填写') }}</span>
            <span class="text-xs font-bold text-[#2F735C]"
              >{{ t('共') }} {{ paperQuestionCount }} {{ t('题') }}</span
            >
          </div>
          <p class="mt-1 text-xs leading-relaxed text-[#2F735C]/80">
            {{
              t(
                '下发卷子时，系统会默认把“职位名称”和“门店渠道”作为最后两题，要求考生填写；这两题不计分。'
              )
            }}
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <el-button @click="publishDialog = false">{{ t('取消') }}</el-button>
          <el-button
            class="!border-none !bg-[#3B8F72] !text-white hover:!bg-emerald-700"
            @click="handlePublish"
          >
            {{ t('确认发布') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 发布成功 -->
    <el-dialog v-model="publishSuccessDialog" width="448px" :append-to-body="true">
      <template #header>
        <span class="flex items-center text-base font-medium text-[#242124]">
          <Icon icon="lucide:check-circle" :size="20" class="mr-2 text-[#3B8F72]" />
          {{ t('考试发布成功') }}
        </span>
      </template>
      <div class="space-y-3">
        <p class="text-sm font-medium text-[#242124]">
          {{ t('请到考试任务管理那里查看已发布的考试任务。') }}
        </p>
        <div v-if="selectedExam" class="rounded-lg border border-[#DCEFE7] bg-[#EEF8F4] px-3 py-2">
          <p data-i18n-skip="true" class="truncate text-xs font-bold text-[#2F735C]">
            {{ selectedExam.title }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span
              class="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#2F735C] ring-1 ring-[#BFDCCF]"
            >
              {{ t('试卷') }} {{ paperQuestionCount }} {{ t('题') }}
            </span>
            <span
              class="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#2F735C] ring-1 ring-[#BFDCCF]"
            >
              {{ t('固定信息题') }} {{ DEFAULT_EXAM_PROFILE_QUESTIONS.length }} {{ t('道') }}
            </span>
            <span
              v-for="rule in passRules"
              :key="rule.id"
              data-i18n-skip="true"
              class="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#2F735C] ring-1 ring-[#BFDCCF]"
            >
              {{ rule.roleName }} {{ rule.score }}{{ t('分') }}
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <el-button @click="publishSuccessDialog = false">{{ t('继续组卷') }}</el-button>
          <el-button
            class="!border-none !bg-[#3B8F72] !text-white hover:!bg-[#2F735C]"
            @click="handleGoToExamTasks"
          >
            {{ t('去考试任务管理') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 编辑考试简介 -->
    <el-dialog v-model="infoDialog" width="420px" :append-to-body="true">
      <template #header>
        <span class="flex items-center text-base font-medium text-[#242124]">{{
          t('编辑考试简介')
        }}</span>
      </template>
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-[#3F3A3D]">{{ t('考试名称') }}</label>
          <input
            v-model="editTitle"
            type="text"
            class="w-full rounded-md border border-[#E5DED8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-[#3F3A3D]">{{ t('考试简介') }}</label>
          <textarea
            v-model="editDesc"
            rows="4"
            :placeholder="t('在此输入本次考试的目的、大纲或其他注意事项...')"
            class="w-full resize-none rounded-md border border-[#E5DED8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <el-button @click="infoDialog = false">{{ t('取消') }}</el-button>
          <el-button
            class="!border-none !bg-rose-600 !text-white hover:!bg-rose-700"
            @click="handleSaveInfo"
          >
            {{ t('保存信息') }}
          </el-button>
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

.pass-rule-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 116px 32px;
  gap: 8px;
  align-items: center;
}

.profile-field-note {
  position: relative;
  border: 1px solid #dcefe7;
  border-radius: 8px;
  background: #eef8f4;
  padding: 8px 12px;
}

.profile-field-note__badge {
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

.profile-field-note__tip {
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
}

.profile-field-note:hover .profile-field-note__tip,
.profile-field-note:focus-within .profile-field-note__tip {
  display: block;
}
</style>
