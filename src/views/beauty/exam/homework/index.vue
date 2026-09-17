<script setup lang="ts">
/**
 * 关联附加题管理（原型 `src/pages/ExamHomework.tsx`）。
 *
 * 左侧课件列表 + 右侧「已关联 / 题库可关联」两栏。
 *
 * 与原型唯一的差异：原型由 App.tsx 通过 props 把「刚在课件页点击的课件名」传进来，
 * Vue 版没有这层容器，因此同时支持：
 * - `props.selectedCourseTitle`（沿用原型的传参方式）
 * - 路由 `?courseTitle=`（课件页跳转过来时的取参方式）
 */
import { getQuestionTagNames, QUESTION_TYPE_LABELS } from '@/beauty/lib/questionBank'
import { useBeautyI18n, useQuestionBank } from '@/beauty/composables'

defineOptions({ name: 'BeautyExamHomework' })

interface HomeworkCourse {
  id: string
  title: string
  date: string
  questionIds: string[]
}

const COURSES: HomeworkCourse[] = [
  { id: 'c1', title: 'Lumina 新品精华培训', date: '2023-11-20', questionIds: ['b1', 'b3'] },
  { id: 'c2', title: '冬季护肤基础', date: '2023-11-18', questionIds: [] }
]

const props = withDefaults(defineProps<{ selectedCourseTitle?: string }>(), {
  selectedCourseTitle: undefined
})

const { t } = useBeautyI18n()
const route = useRoute()
const { questions, tags } = useQuestionBank()

const courses = ref<HomeworkCourse[]>(
  COURSES.map((course) => ({ ...course, questionIds: [...course.questionIds] }))
)
const selectedCourseId = ref<string>(COURSES[0].id)
const showToast = ref(false)

/** 课件页跳转时带过来的课件名：优先 props，其次路由 query。 */
const courseTitleFromQuery = computed(() => {
  const value = route.query.courseTitle
  return typeof value === 'string' && value ? value : undefined
})
const effectiveCourseTitle = computed(() => props.selectedCourseTitle || courseTitleFromQuery.value)

/** 等价原型 useEffect：命中已有课件就选中，否则新建一个自定义课件并置顶。 */
const resolveCourseByTitle = (title: string) => {
  const matched = courses.value.find((course) => course.title === title)
  if (matched) {
    selectedCourseId.value = matched.id
    return
  }

  const customId = `custom-${title.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')}`
  if (!courses.value.some((course) => course.id === customId)) {
    courses.value = [{ id: customId, title, date: '-', questionIds: [] }, ...courses.value]
  }
  selectedCourseId.value = customId
}

watch(effectiveCourseTitle, (title) => {
  if (title) resolveCourseByTitle(title)
})

const selectedCourse = computed(() =>
  courses.value.find((course) => course.id === selectedCourseId.value)
)
const activeBank = computed(() =>
  questions.value.filter((question) => question.status === 'active')
)
const linkedQuestions = computed(() =>
  activeBank.value.filter((question) => selectedCourse.value?.questionIds.includes(question.id))
)
const availableQuestions = computed(() =>
  activeBank.value.filter((question) => !selectedCourse.value?.questionIds.includes(question.id))
)

const handleLink = (questionId: string) => {
  courses.value = courses.value.map((course) =>
    course.id === selectedCourseId.value
      ? { ...course, questionIds: [...course.questionIds, questionId] }
      : course
  )
}

const handleUnlink = (questionId: string) => {
  courses.value = courses.value.map((course) =>
    course.id === selectedCourseId.value
      ? { ...course, questionIds: course.questionIds.filter((id) => id !== questionId) }
      : course
  )
}

const handleSave = () => {
  showToast.value = true
  window.setTimeout(() => {
    showToast.value = false
  }, 3000)
}
</script>

<template>
  <div
    class="flex h-[calc(100vh-11.5rem)] min-h-[620px] overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F7F3F1] pt-2"
  >
    <!-- 左侧课件列表 -->
    <div class="flex w-80 shrink-0 flex-col border-r border-[#E5DED8] bg-white">
      <div class="z-10 flex items-center justify-between border-b border-[#E9E4DF] bg-white p-4">
        <h2 class="font-bold tracking-tight text-[#242124]">{{ t('课件与附加题关联') }}</h2>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-4">
        <div
          v-for="course in courses"
          :key="course.id"
          class="group flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-all"
          :class="
            selectedCourseId === course.id
              ? 'border-rose-600 bg-rose-50/50 shadow-sm'
              : 'border-transparent bg-[#F8F5F3] hover:border-[#E5DED8] hover:bg-[#F1ECE8]'
          "
          @click="selectedCourseId = course.id"
        >
          <div class="flex w-full items-start gap-3">
            <div
              class="mt-0.5 shrink-0 rounded-lg p-2"
              :class="
                selectedCourseId === course.id
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-white text-[#9A9396]'
              "
            >
              <Icon icon="lucide:book-open" :size="20" />
            </div>
            <div class="w-full min-w-0 pr-2">
              <h3
                class="truncate text-sm font-bold"
                :class="selectedCourseId === course.id ? 'text-rose-950' : 'text-[#242124]'"
              >
                {{ course.title }}
              </h3>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-[#9A9396]">{{ course.date }}</span>
                <span
                  class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full bg-[#F7EDEF] px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-[#4A3238]"
                >
                  {{ t('已关联') }} {{ course.questionIds.length }} {{ t('题') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧配置区 -->
    <div class="relative flex flex-1 flex-col overflow-hidden bg-[#F7F3F1]">
      <div
        v-if="showToast"
        class="beauty-toast-in absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#3B8F72] px-4 py-2 text-white shadow-lg"
      >
        <Icon icon="lucide:check-circle" :size="16" />
        <span class="text-sm font-bold">{{ t('保存成功') }}</span>
      </div>

      <template v-if="selectedCourse">
        <div
          class="flex shrink-0 items-center justify-between border-b border-[#E5DED8] bg-white p-6"
        >
          <div>
            <h1 class="text-xl font-bold text-[#242124]">
              {{ t('配置课件附加题：') }}{{ selectedCourse.title }}
            </h1>
            <p class="mt-1 text-xs text-[#766F73]">
              {{ t('学员学习完此课件后，将在APP自动推送已关联的附加题') }}
            </p>
          </div>
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
            @click="handleSave"
          >
            <Icon icon="lucide:save" :size="16" />
            <span>{{ t('保存配置') }}</span>
          </button>
        </div>

        <div class="flex flex-1 flex-col gap-6 overflow-y-auto p-6 md:p-8 xl:flex-row">
          <!-- 已关联题目 -->
          <div class="flex-1 space-y-4">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="flex items-center font-bold text-[#242124]">
                <Icon icon="lucide:clipboard-list" :size="20" class="mr-2 text-[#3B8F72]" />
                {{ t('已关联此课件的题目') }} ({{ linkedQuestions.length }})
              </h3>
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
                    <div data-i18n-skip="true" class="text-sm font-medium text-[#242124]">
                      {{ index + 1 }}. {{ question.stem }}
                    </div>
                    <button
                      type="button"
                      class="shrink-0 rounded-md p-1.5 text-[#9A9396] transition-colors hover:bg-red-50 hover:text-red-500"
                      title="取消关联"
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
                {{ t('暂无关联题目，请从右侧题库添加') }}
              </div>
            </div>
          </div>

          <!-- 题库可关联题目 -->
          <div class="flex-1 space-y-4 xl:border-l xl:border-[#E5DED8] xl:pl-6">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="flex items-center font-bold text-[#242124]">
                <Icon icon="lucide:database" :size="20" class="mr-2 text-rose-500" />
                {{ t('题库可关联题目') }}
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
                      class="flex shrink-0 items-center rounded-md border border-rose-100 p-1.5 text-rose-600 shadow-sm transition-colors hover:bg-rose-50"
                      title="添加到附加题"
                      @click="handleLink(question.id)"
                    >
                      <Icon icon="lucide:plus-circle" :size="16" class="mr-1" /> {{ t('添加') }}
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
                {{ t('没有更多可供关联的候选题目') }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="flex flex-1 flex-col items-center justify-center text-[#9A9396]">
        <Icon icon="lucide:book-open" :size="64" class="mb-4 opacity-20" />
        <p class="font-medium text-[#766F73]">{{ t('在左侧选择一个课件查看其附加题') }}</p>
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
    transform: translate(-50%, -8px);
  }

  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
