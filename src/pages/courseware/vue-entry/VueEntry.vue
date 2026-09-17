<template>
  <div class="courseware-create-flow beauty-preview">
        <el-card v-if="step === 1" class="courseware-upload-card studio-entry-card" shadow="never">
          <div class="courseware-create-shell studio-entry-layout">
            <aside class="studio-entry-story">
              <div class="studio-entry-intro">
                <div class="studio-entry-badge">
                  <Icon icon="lucide:sparkles" :size="14" />
                  <span>{{ t('coursewareCreate.studio.coCreationPill') }}</span>
                </div>
                <h1>{{ t('coursewareCreate.studio.entryTitle') }}</h1>
                <p>{{ t('coursewareCreate.studio.entryHint') }}</p>
              </div>

              <div
                class="studio-entry-roadmap"
                role="region"
                :aria-label="t('coursewareCreate.studio.processStepsTitle')"
              >
                <div class="studio-entry-roadmap__step">
                  <span class="studio-entry-roadmap__num">01</span>
                  <div class="studio-entry-roadmap__info">
                    <strong>{{ t('coursewareCreate.studio.roadmapStep1') }}</strong>
                    <small>{{ t('coursewareCreate.studio.roadmapStep1Desc') }}</small>
                  </div>
                </div>
                <div class="studio-entry-roadmap__arrow" aria-hidden="true">
                  <Icon icon="lucide:chevron-right" :size="15" />
                </div>
                <div class="studio-entry-roadmap__step">
                  <span class="studio-entry-roadmap__num">02</span>
                  <div class="studio-entry-roadmap__info">
                    <strong>{{ t('coursewareCreate.studio.roadmapStep2') }}</strong>
                    <small>{{ t('coursewareCreate.studio.roadmapStep2Desc') }}</small>
                  </div>
                </div>
                <div class="studio-entry-roadmap__arrow" aria-hidden="true">
                  <Icon icon="lucide:chevron-right" :size="15" />
                </div>
                <div class="studio-entry-roadmap__step">
                  <span class="studio-entry-roadmap__num">03</span>
                  <div class="studio-entry-roadmap__info">
                    <strong>{{ t('coursewareCreate.studio.roadmapStep3') }}</strong>
                    <small>{{ t('coursewareCreate.studio.roadmapStep3Desc') }}</small>
                  </div>
                </div>
              </div>
            </aside>
            <div class="studio-entry-editor">
              <div class="studio-entry-prompt">
                <div class="studio-entry-prompt-header">
                  <label for="course-topic">{{ t('coursewareCreate.studio.promptLabel') }}</label>
                  <span class="studio-entry-limit">{{ formData.prompt.length }}/12000</span>
                </div>
                <el-input
                  id="course-topic"
                  v-model="formData.prompt"
                  type="textarea"
                  :rows="4"
                  :maxlength="12000"
                  :placeholder="t('coursewareCreate.studio.promptPlaceholder')"
                />
                <div class="studio-entry-examples">
                  <span class="studio-entry-examples-label">
                    <Icon icon="lucide:lightbulb" :size="13" />
                    {{ t('coursewareCreate.studio.inspirationLabel') }}:
                  </span>
                  <button
                    v-for="example in [1, 2, 3]"
                    :key="example"
                    type="button"
                    class="studio-entry-example-btn"
                    @click="formData.prompt = t(`coursewareCreate.studio.example${example}`)"
                  >
                    <span>{{ t(`coursewareCreate.studio.example${example}`) }}</span>
                    <Icon icon="lucide:arrow-up-right" :size="12" />
                  </button>
                </div>
                <fieldset class="studio-entry-types">
                  <legend>{{ t('coursewareCreate.studio.courseType') }}</legend>
                  <div class="studio-entry-types-grid">
                    <label
                      v-for="kind in courseKinds"
                      :key="kind.value"
                      class="studio-entry-type-chip"
                      :class="{ selected: courseKind === kind.value }"
                    >
                      <input
                        v-model="courseKind"
                        type="radio"
                        name="course-kind"
                        :value="kind.value"
                      />
                      <Icon :icon="kind.icon" :size="15" />
                      <span>{{ t(`coursewareCreate.studio.${kind.label}`) }}</span>
                    </label>
                  </div>
                </fieldset>
              </div>
              <div class="studio-entry-identity">
                <div class="studio-entry-identity__field">
                  <label>{{ t('coursewareCreate.narratorRole') }}</label>
                  <el-select
                    v-model="formData.narratorVoiceId"
                    :placeholder="t('coursewareCreate.narratorPlaceholder')"
                    clearable
                    :loading="voiceLoading"
                    @change="handleNarratorVoiceChange"
                  >
                    <el-option
                      v-for="voice in narratorVoices"
                      :key="voice.voiceId"
                      :label="`${voice.voiceName}${voice.gender ? ` · ${genderLabel(voice.gender)}` : ''}`"
                      :value="voice.voiceId"
                    />
                  </el-select>
                </div>
                <div class="studio-entry-identity__field">
                  <label>{{ t('coursewareCreate.catalogLabel') }}</label>
                  <div class="studio-entry-identity__catalog">
                    <el-cascader
                      v-model="selectedCatalogKeys"
                      :options="catalogTree"
                      :props="catalogCascaderProps"
                      :loading="catalogLoading"
                      filterable
                      clearable
                      collapse-tags
                      collapse-tags-tooltip
                      :placeholder="t('coursewareCreate.catalogPlaceholder')"
                      @visible-change="handleCatalogVisibleChange"
                    />
                    <BrandCatalogPopover
                      :language="formData.language"
                      @refreshed="loadCatalogOptions"
                    />
                  </div>
                </div>
              </div>
              <p class="studio-entry-file-label">{{
                t('coursewareCreate.studio.filesOptional')
              }}</p>
              <div class="courseware-upload-area courseware-upload-area--stable w-full max-w-2xl">
                <!-- 始终保留原上传框；文件状态在框内切换，已有文件时禁止再次选择。 -->
                <el-upload
                  class="courseware-upload w-full max-w-2xl"
                  drag
                  action="#"
                  :auto-upload="false"
                  :disabled="uploadItems.length > 0"
                  :show-file-list="false"
                  :file-list="[]"
                  :limit="1"
                  :multiple="false"
                  :accept="acceptedFileTypes"
                  :on-change="handleFileSelected"
                  :on-exceed="handleUploadExceeded"
                >
                  <div
                    v-if="uploadItems.length > 0"
                    class="courseware-upload-status flex w-full flex-col gap-2"
                    @click.stop
                    @keydown.stop
                  >
                    <div
                      v-for="(item, index) in uploadItems"
                      :key="item.uid"
                      class="courseware-upload-item flex w-full min-w-0 items-center gap-3 text-sm text-[#3F3A3D]"
                    >
                      <Icon icon="lucide:file-text" class="mr-2 h-4 w-4 shrink-0 text-orange-500" />
                      <div class="min-w-0 flex-1 text-left">
                        <div class="flex items-center gap-2">
                          <span class="min-w-0 truncate font-medium">{{ item.name }}</span>
                          <span class="shrink-0 text-xs uppercase text-[#9A9396]">{{
                            item.extension
                          }}</span>
                        </div>
                        <el-progress
                          v-if="item.status !== 'ready'"
                          class="mt-2"
                          :percentage="item.progress"
                          :status="
                            item.status === 'failed'
                              ? 'exception'
                              : item.status === 'success'
                                ? 'success'
                                : undefined
                          "
                          :stroke-width="6"
                        />
                      </div>
                      <el-button v-if="item.status === 'uploading'" link @click="pauseUpload(item)">
                        {{ t('coursewareCreate.pauseUpload') }}
                      </el-button>
                      <el-button
                        v-else-if="item.status === 'paused'"
                        link
                        @click="resumeUpload(item)"
                      >
                        {{ t('coursewareCreate.resumeUpload') }}
                      </el-button>
                      <el-button
                        v-else-if="item.status === 'failed'"
                        link
                        type="primary"
                        @click="retryUpload(item)"
                      >
                        {{ t('coursewareCreate.retryUpload') }}
                      </el-button>
                      <el-button link type="danger" class="!ml-0" @click="removeUploadItem(index)">
                        <Icon icon="ep:close" class="h-3.5 w-3.5" />
                      </el-button>
                    </div>
                  </div>
                  <div
                    v-else
                    class="courseware-upload-placeholder flex items-center justify-center gap-4 px-4 py-3 text-left"
                  >
                    <div
                      class="prototype-upload-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    >
                      <Icon icon="lucide:upload-cloud" :size="22" />
                    </div>
                    <h3 class="text-sm font-medium text-[#242124]">{{
                      t('coursewareCreate.uploadTitle')
                    }}</h3>
                    <p class="text-xs text-[#9A9396]">{{
                      t('coursewareCreate.uploadHint', { size: maxFileSize })
                    }}</p>
                  </div>
                </el-upload>
              </div>

              <input
                ref="resumeFileInputRef"
                class="hidden"
                type="file"
                :accept="acceptedFileTypes"
                @change="handleResumeFileSelected"
              />

              <div
                v-if="uploadItems.length === 0 && recoverableUploadTasks.length > 0"
                class="mt-6 flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-left"
              >
                <div>
                  <div class="text-sm font-bold text-[#3F3A3D]">{{
                    t('coursewareCreate.recoverableUploadsTitle')
                  }}</div>
                  <div class="mt-1 text-xs text-[#766F73]">{{
                    t('coursewareCreate.recoverableUploadsDesc')
                  }}</div>
                </div>
                <div
                  v-for="task in recoverableUploadTasks"
                  :key="task.id"
                  class="flex max-w-full items-center gap-3 rounded-lg border border-[#E5DED8] bg-white px-4 py-3 text-sm text-[#3F3A3D] shadow-sm"
                >
                  <Icon icon="lucide:file-clock" class="mr-2 h-4 w-4 shrink-0 text-amber-500" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="max-w-[280px] truncate font-medium">{{ task.fileName }}</span>
                      <span class="shrink-0 text-xs text-[#9A9396]">{{
                        formatFileSize(task.fileSize)
                      }}</span>
                    </div>
                    <div class="mt-1 text-xs text-[#766F73]">
                      {{
                        t('coursewareCreate.resumeTaskMeta', {
                          progress: task.progress,
                          time: formatDateTime(task.updatedAt)
                        })
                      }}
                    </div>
                    <el-progress class="mt-2" :percentage="task.progress" :stroke-width="6" />
                  </div>
                  <el-button link type="primary" @click="chooseResumeFile(task)">
                    {{ t('coursewareCreate.continueUpload') }}
                  </el-button>
                  <el-button link type="danger" class="!ml-0" @click="discardResumeTask(task)">
                    {{ t('coursewareCreate.discardUpload') }}
                  </el-button>
                </div>
              </div>

              <el-collapse
                v-model="manualSelectionPanel"
                class="courseware-advanced-settings w-full max-w-2xl text-left"
                accordion
              >
                <el-collapse-item name="settings">
                  <template #title>
                    <div class="flex items-center gap-2 text-sm font-semibold text-[#3F3A3D]">
                      <Icon icon="lucide:sliders-horizontal" class="h-4 w-4 text-[#B25D49]" />
                      <span>{{ t('coursewareCreate.studio.settings') }}</span>
                      <span class="text-xs font-normal text-[#9A9396]">{{
                        t('coursewareCreate.studio.settingsHint')
                      }}</span>
                    </div>
                  </template>
                  <div class="w-full space-y-4 text-left">
                    <div class="rounded-xl border border-[#E9E4DF] bg-[#F8F5F3] p-4 space-y-4">
                      <div class="flex flex-wrap items-center gap-6">
                        <div class="flex items-center gap-1.5">
                          <label class="flex cursor-pointer items-center space-x-2">
                            <input
                              v-model="formData.generateHomeworkSync"
                              type="checkbox"
                              class="rounded text-rose-600 focus:ring-rose-500"
                            />
                            <span class="text-sm font-bold text-[#3F3A3D]">
                              {{ t('coursewareCreate.generateHomework') }}
                            </span>
                          </label>
                          <el-tooltip
                            :content="t('coursewareCreate.generateHomeworkTip')"
                            placement="top"
                          >
                            <button
                              type="button"
                              class="flex cursor-help items-center border-0 bg-transparent p-0 text-[#9A9396]"
                              :aria-label="t('coursewareCreate.generateHomeworkTip')"
                              @click.stop
                            >
                              <Icon icon="ep:question-filled" class="h-4 w-4" />
                            </button>
                          </el-tooltip>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <label class="flex cursor-pointer items-center space-x-2">
                            <input
                              v-model="formData.enableImageGeneration"
                              type="checkbox"
                              class="rounded text-rose-600 focus:ring-rose-500"
                            />
                            <span class="text-sm font-bold text-[#3F3A3D]">{{
                              t('coursewareCreate.settings.enableImageGeneration')
                            }}</span>
                          </label>
                          <el-tooltip
                            :content="t('coursewareCreate.settings.enableImageGenerationTip')"
                            placement="top"
                          >
                            <button
                              type="button"
                              class="flex cursor-help items-center border-0 bg-transparent p-0 text-[#9A9396]"
                              :aria-label="t('coursewareCreate.settings.enableImageGenerationTip')"
                              @click.stop
                            >
                              <Icon icon="ep:question-filled" class="h-4 w-4" />
                            </button>
                          </el-tooltip>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <label class="flex cursor-pointer items-center space-x-2">
                            <input
                              v-model="formData.outlineEnhancementEnabled"
                              type="checkbox"
                              class="rounded text-rose-600 focus:ring-rose-500"
                            />
                            <span class="text-sm font-bold text-[#3F3A3D]">{{
                              t('coursewareCreate.settings.outlineEnhancement')
                            }}</span>
                          </label>
                          <el-tooltip
                            :content="t('coursewareCreate.settings.outlineEnhancementTip')"
                            placement="top"
                          >
                            <button
                              type="button"
                              class="flex cursor-help items-center border-0 bg-transparent p-0 text-[#9A9396]"
                              :aria-label="t('coursewareCreate.settings.outlineEnhancementTip')"
                              @click.stop
                            >
                              <Icon icon="ep:question-filled" class="h-4 w-4" />
                            </button>
                          </el-tooltip>
                        </div>
                      </div>
                    </div>

                    <div class="rounded-xl border border-[#E9E4DF] bg-[#F8F5F3] p-1">
                      <div class="grid gap-1 sm:grid-cols-2">
                        <button
                          type="button"
                          class="flex h-12 items-center justify-center rounded-lg px-4 text-sm font-bold transition-all"
                          :class="
                            coursewareMode === 'ai-courseware'
                              ? 'bg-white text-rose-600 shadow-sm ring-1 ring-rose-100'
                              : 'text-[#766F73] hover:bg-white/70 hover:text-[#242124]'
                          "
                          @click="coursewareMode = 'ai-courseware'"
                        >
                          <Icon icon="lucide:wand-2" class="mr-2 h-4 w-4" />
                          {{ t('coursewareCreate.modeAi') }}
                        </button>
                        <button
                          type="button"
                          :disabled="!hasUploadedMaterial"
                          class="flex h-12 items-center justify-center rounded-lg px-4 text-sm font-bold transition-all"
                          :class="
                            coursewareMode === 'script-only' && hasUploadedMaterial
                              ? 'bg-white text-rose-600 shadow-sm ring-1 ring-rose-100'
                              : hasUploadedMaterial
                                ? 'text-[#766F73] hover:bg-white/70 hover:text-[#242124]'
                                : 'cursor-not-allowed text-[#B8B1AE]'
                          "
                          @click="coursewareMode = 'script-only'"
                        >
                          <Icon icon="lucide:file-text" class="mr-2 h-4 w-4" />
                          {{ t('coursewareCreate.modeScript') }}
                        </button>
                      </div>
                      <p v-if="!hasUploadedMaterial" class="px-2 pt-2 text-xs text-[#9A9396]">
                        {{ t('coursewareCreate.scriptModeRequiresFiles') }}
                      </p>
                    </div>
                  </div>
                </el-collapse-item>
              </el-collapse>

              <div class="studio-entry-actions flex flex-wrap items-center justify-between gap-3">
                <label class="flex cursor-pointer items-center gap-2 text-sm text-[#3F3A3D]">
                  <input
                    v-model="formData.autoConfirm"
                    type="checkbox"
                    class="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>{{ t('coursewareCreate.studio.autoConfirm') }}</span>
                </label>
                <el-dropdown trigger="click" @command="handleGenerationLanguageChange">
                  <el-button
                    size="large"
                    class="courseware-language-button"
                    :disabled="generationSubmitting"
                  >
                    <Icon icon="ion:language-sharp" class="mr-2 h-4 w-4" />
                    {{ t('coursewareCreate.generationLanguage') }}: {{ generationLanguageLabel }}
                    <Icon icon="ep:arrow-down" class="ml-1 h-3.5 w-3.5" />
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="language in generationLanguageOptions"
                        :key="language.value"
                        :command="language.value"
                      >
                        <span class="flex min-w-28 items-center justify-between gap-4">
                          <span>{{ language.label }}</span>
                          <Icon
                            v-if="formData.language === language.value"
                            icon="ep:check"
                            class="h-4 w-4 text-[#B25D49]"
                          />
                        </span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-button
                  size="large"
                  class="beauty-primary-button px-8"
                  :loading="uploadingCount > 0 || generationSubmitting"
                  :disabled="!canStartGeneration"
                  @click="handleStartGeneration"
                >
                  <Icon icon="lucide:wand-2" class="mr-2 h-4 w-4" />
                  {{ generationButtonText }}
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DEMO_UPLOAD_FILES,
  UPLOAD_ACCEPT,
  UPLOAD_FLAKY_THRESHOLD_BYTES,
  UPLOAD_MAX_SIZE_MB,
  formatFileSize,
  loadResumeTasks,
  matchesResumeFile,
  progressStep,
  removeResumeTask,
  upsertResumeTask,
  validateUploadFile,
  type CoursewareResumeTask
} from '../../../lib/coursewareUpload'
import {
  CW_EXAMPLES,
  CW_LANGUAGES,
  CW_NARRATORS,
  createCoursewareForm,
  type CwForm,
  type CwUploadItem
} from '../../../lib/coursewareStudio'
import { t as sourceT } from '../vue-studio/i18n'
import Icon from './Icon.vue'
import BrandCatalogPopover from './BrandCatalogPopover.vue'

defineOptions({ name: 'VueCoursewareEntry' })

const props = withDefaults(defineProps<{
  modelValue: CwForm
  submitting?: boolean
  error?: string
}>(), { submitting: false, error: '' })
const emit = defineEmits<{
  'update:modelValue': [value: CwForm]
  start: []
}>()

const initial = createCoursewareForm()
const formData = reactive({ ...initial, ...props.modelValue, outlineEnhancementEnabled: props.modelValue.outlineEnhancement })
const step = 1
const syncing = ref(false)
const notice = ref('')
const resumeFileInputRef = ref<HTMLInputElement>()
const pendingResumeTask = ref<CoursewareResumeTask>()
const recoverableUploadTasks = ref<CoursewareResumeTask[]>([])
const manualSelectionPanel = ref('')
const voiceLoading = false
const catalogLoading = ref(false)
const generationSubmitting = computed(() => props.submitting)
const acceptedFileTypes = UPLOAD_ACCEPT
const maxFileSize = UPLOAD_MAX_SIZE_MB
const narratorVoices = CW_NARRATORS
const courseKinds = [
  { value: 'auto', label: 'auto', icon: 'lucide:sparkles' },
  { value: 'experience', label: 'experienceType', icon: 'lucide:messages-square' },
  { value: 'operation', label: 'operationType', icon: 'lucide:list-checks' },
  { value: 'knowledge', label: 'knowledgeType', icon: 'lucide:lightbulb' }
] as const
const courseKind = computed({
  get: () => formData.kind,
  set: (value) => { formData.kind = value }
})
const selectedCatalogKeys = ref<string[]>([])
const catalogTree = ref([
  { value: 'brand-you', label: 'Y.O.U', children: [
    { value: 'category-skincare', label: '护肤', children: [
      { value: 'product-barrier', label: 'Barrier Shield 修护精华' }
    ] }
  ] }
])
const catalogCascaderProps = { multiple: true, checkStrictly: true, emitPath: false, value: 'value', label: 'label', children: 'children' }
const coursewareMode = computed({
  get: () => formData.mode,
  set: (value: CwForm['mode']) => { formData.mode = value }
})
const hasUploadedMaterial = computed(() => formData.files.length > 0)
const uploadingCount = computed(() => formData.files.filter((item) => item.status === 'uploading').length)
const generationLanguageOptions = CW_LANGUAGES
const generationLanguageLabel = computed(() => generationLanguageOptions.find((item) => item.value === formData.language)?.label || '印尼语')
const canStartGeneration = computed(() => Boolean(formData.prompt.trim() || formData.files.length) && uploadingCount.value === 0 && !props.submitting)
const generationButtonText = computed(() => uploadingCount.value ? '上传中…' : '开始共创课程')
const uploadItems = computed(() => formData.files)

const messages: Record<string, string> = {
  'coursewareCreate.studio.coCreationPill': 'AI 课程共创工作区',
  'coursewareCreate.studio.entryTitle': '把你的经验，变成一堂好课',
  'coursewareCreate.studio.entryHint': '说说你想教什么。课程助手会帮你梳理关键内容，再一起打磨大纲。',
  'coursewareCreate.studio.processStepsTitle': '课程制作流程',
  'coursewareCreate.studio.roadmapStep1': '聊聊你的经验',
  'coursewareCreate.studio.roadmapStep1Desc': '结构化提炼一线真实业务经验',
  'coursewareCreate.studio.roadmapStep2': '一起打磨大纲',
  'coursewareCreate.studio.roadmapStep2Desc': '提炼核心要点，自由调整教学逻辑',
  'coursewareCreate.studio.roadmapStep3': '制作可学习的课程',
  'coursewareCreate.studio.roadmapStep3Desc': '将确认的内容制作成课件',
  'coursewareCreate.studio.promptLabel': '这次想做一堂什么课？',
  'coursewareCreate.studio.promptPlaceholder': '例如：给门店新人做一堂客户异议处理课，重点是客户说“太贵了”时怎么回应。',
  'coursewareCreate.studio.inspirationLabel': '灵感参考',
  'coursewareCreate.studio.example1': CW_EXAMPLES[0],
  'coursewareCreate.studio.example2': CW_EXAMPLES[1],
  'coursewareCreate.studio.example3': CW_EXAMPLES[2],
  'coursewareCreate.studio.courseType': '这堂课更侧重',
  'coursewareCreate.studio.autoType': '帮我判断',
  'coursewareCreate.studio.experienceType': '分享经验',
  'coursewareCreate.studio.operationType': '教会操作',
  'coursewareCreate.studio.knowledgeType': '讲清方法',
  'coursewareCreate.narratorRole': '讲解角色',
  'coursewareCreate.narratorPlaceholder': '选择讲解角色',
  'coursewareCreate.catalogLabel': '品牌 / 品类',
  'coursewareCreate.catalogPlaceholder': '选择品牌、品类或产品',
  'coursewareCreate.studio.filesOptional': '添加参考资料（可选）',
  'coursewareCreate.uploadTitle': '拖拽 PDF、Word 或 PPT 文件至此或点击上传',
  'coursewareCreate.uploadHint': '支持 PDF、Word、PPT，每个文件不超过 {size}MB',
  'coursewareCreate.pauseUpload': '暂停上传',
  'coursewareCreate.resumeUpload': '继续上传',
  'coursewareCreate.retryUpload': '重试上传',
  'coursewareCreate.recoverableUploadsTitle': '可恢复的上传',
  'coursewareCreate.recoverableUploadsDesc': '选择原始本地文件后，可继续未完成的上传。',
  'coursewareCreate.resumeTaskMeta': '已上传 {progress}% · 更新于 {time}',
  'coursewareCreate.continueUpload': '继续上传',
  'coursewareCreate.discardUpload': '丢弃',
  'coursewareCreate.studio.settings': '课程设置',
  'coursewareCreate.studio.settingsHint': '分类、讲解声音和生成选项',
  'coursewareCreate.generateHomework': '同步生成十道题',
  'coursewareCreate.generateHomeworkTip': '生成十道课后练习题',
  'coursewareCreate.settings.enableImageGeneration': 'AI 生图',
  'coursewareCreate.settings.enableImageGenerationTip': '为课程页面生成配图',
  'coursewareCreate.settings.outlineEnhancement': '拆分优化',
  'coursewareCreate.settings.outlineEnhancementTip': '优化课程大纲拆分',
  'coursewareCreate.modeAi': '使用 AI 智能生成课件',
  'coursewareCreate.modeScript': '保留原始课件，仅生成讲解',
  'coursewareCreate.scriptModeRequiresFiles': '上传资料后可使用此模式',
  'coursewareCreate.studio.autoConfirm': '直接完成（自动继续全流程）',
  'coursewareCreate.generationLanguage': '课件语言',
  'coursewareCreate.generationLanguages.cn': '中文',
  'coursewareCreate.generationLanguages.en': '英文',
  'coursewareCreate.generationLanguages.id': '印尼语'
}
const t = (key: string, params?: Record<string, unknown>) => {
  const translated = sourceT(key, params || {})
  if (translated !== key) return translated
  let value = messages[key] || key
  for (const [name, replacement] of Object.entries(params || {})) value = value.replace(`{${name}}`, String(replacement))
  return value
}
const genderLabel = (gender: string) => gender
const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Jakarta', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const emitForm = () => {
  const { outlineEnhancementEnabled, ...value } = formData
  emit('update:modelValue', { ...value, outlineEnhancement: outlineEnhancementEnabled })
}
watch(() => props.modelValue, (value) => {
  syncing.value = true
  Object.assign(formData, value, { outlineEnhancementEnabled: value.outlineEnhancement })
  syncing.value = false
}, { deep: true })
watch(formData, () => { if (!syncing.value) emitForm() }, { deep: true })

let fileSeed = 0
let timer: number | undefined
const patchFile = (uid: string, patch: Partial<CwUploadItem>) => {
  const item = formData.files.find((file) => file.uid === uid)
  if (item) Object.assign(item, patch)
}
const addFile = (name: string, size: number) => {
  const checked = validateUploadFile(name, size)
  if (!checked.ok) { notice.value = checked.error || '文件校验失败'; ElMessage.error(notice.value); return }
  if (formData.files.length) { notice.value = '参考资料仅支持一个文件，请先移除已上传的文件'; ElMessage.warning(notice.value); return }
  notice.value = ''
  fileSeed += 1
  formData.files = [{ uid: `upload-${fileSeed}`, name, extension: checked.extension, size, progress: 4, status: 'uploading', attempts: 1 }]
}
const handleFileSelected = (uploadFile: any) => {
  const raw = uploadFile?.raw as File | undefined
  if (raw) addFile(raw.name, raw.size)
}
const handleUploadExceeded = () => { notice.value = '参考资料仅支持一个文件，请先移除已上传的文件'; ElMessage.warning(notice.value) }
const pauseUpload = (item: CwUploadItem) => patchFile(item.uid, { status: 'paused' })
const resumeUpload = (item: CwUploadItem) => patchFile(item.uid, { status: 'uploading' })
const retryUpload = (item: CwUploadItem) => patchFile(item.uid, { status: 'uploading', error: undefined, attempts: (item.attempts || 1) + 1 })
const removeUploadItem = (index: number) => {
  const item = formData.files[index]
  if (item && item.progress > 0 && item.progress < 100) {
    recoverableUploadTasks.value = upsertResumeTask({ id: item.uid, fileName: item.name, fileSize: item.size, extension: item.extension, progress: item.progress, updatedAt: new Date().toISOString() })
  }
  formData.files.splice(index, 1)
}
const chooseResumeFile = (task: CoursewareResumeTask) => {
  pendingResumeTask.value = task
  if (resumeFileInputRef.value) { resumeFileInputRef.value.value = ''; resumeFileInputRef.value.click() }
}
const applyResume = (task: CoursewareResumeTask, name: string, size: number) => {
  if (!matchesResumeFile(task, name, size)) { notice.value = '请选择原始文件继续上传，文件名或大小不匹配。'; ElMessage.error(notice.value); return }
  const checked = validateUploadFile(name, size)
  if (!checked.ok) { notice.value = checked.error || '文件校验失败'; return }
  fileSeed += 1
  formData.files = [{ uid: `upload-${fileSeed}`, name, extension: checked.extension, size, progress: task.progress, status: 'uploading', attempts: 2 }]
  recoverableUploadTasks.value = removeResumeTask(task.id)
  pendingResumeTask.value = undefined
}
const handleResumeFileSelected = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  const task = pendingResumeTask.value
  if (file && task) applyResume(task, file.name, file.size)
  ;(event.target as HTMLInputElement).value = ''
}
const discardResumeTask = (task: CoursewareResumeTask) => {
  recoverableUploadTasks.value = removeResumeTask(task.id)
  notice.value = `已丢弃「${task.fileName}」的未完成上传。`
}
const handleNarratorVoiceChange = () => undefined
const handleCatalogVisibleChange = (visible: boolean) => { if (visible) catalogLoading.value = false }
const loadCatalogOptions = () => undefined
const handleGenerationLanguageChange = (language: CwForm['language']) => { formData.language = language }
const handleStartGeneration = () => emit('start')

onMounted(() => {
  recoverableUploadTasks.value = loadResumeTasks()
  timer = window.setInterval(() => {
    for (const item of formData.files) {
      if (item.status !== 'uploading') continue
      const next = Math.min(100, item.progress + progressStep(item.size))
      const flaky = item.size >= UPLOAD_FLAKY_THRESHOLD_BYTES && (item.attempts || 1) <= 1
      if (flaky && next >= 80) Object.assign(item, { progress: 80, status: 'failed', error: `网络中断，文件 ${item.name} 上传失败，请重试` })
      else if (next >= 100) {
        Object.assign(item, { progress: 100, status: 'success', error: undefined })
        const stale = recoverableUploadTasks.value.filter(
          (task) => task.fileName === item.name && task.fileSize === item.size,
        )
        for (const task of stale) recoverableUploadTasks.value = removeResumeTask(task.id)
      } else item.progress = next
    }
  }, 240)
})
onBeforeUnmount(() => { if (timer) window.clearInterval(timer) })
</script>

<style scoped>
.studio-entry-identity {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 16px;
  margin-top: 14px;
}
.studio-entry-identity__field {
  min-width: 0;
}
.studio-entry-identity__field > label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #78716c;
}
.studio-entry-identity__field :deep(.el-select) {
  width: 100%;
}
.studio-entry-identity__catalog {
  display: flex;
  align-items: center;
  gap: 8px;
}
.studio-entry-identity__catalog :deep(.el-cascader) {
  flex: 1;
  min-width: 0;
}
@media (max-width: 600px) {
  .studio-entry-identity {
    grid-template-columns: 1fr;
  }
}
/* 上传前后的同一容器保持固定高度，避免文件状态切换导致入口卡片跳动。 */
.courseware-upload-area--stable {
  min-height: 100px;
}
.courseware-upload-area--stable > div,
.courseware-upload-area--stable :deep(.courseware-upload),
.courseware-upload-area--stable :deep(.el-upload),
.courseware-upload-area--stable :deep(.el-upload-dragger) {
  min-height: 100px;
  box-sizing: border-box;
}
.courseware-upload-area--stable :deep(.el-upload-dragger) {
  display: flex;
  align-items: center;
  justify-content: center;
}
.courseware-upload-status {
  cursor: default;
  padding: 10px;
}
.studio-flow {
  width: 100%;
  max-width: none;
  padding: 0;
  margin: 0 auto;
}
.courseware-create-flow {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* 居中方式固定在基类：阶段切换时只换尺寸类名，对齐方式不变，
     初始卡片才能在原位淡出，而不是先被挤到左侧。 */
  align-items: center;
  justify-content: center;
}
.studio-entry-card {
  flex: 0 1 auto;
  width: min(100%, 1120px);
  max-height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.studio-entry-card :deep(.el-card__body) {
  min-height: 0;
  overflow-y: auto;
  box-sizing: border-box;
}
.studio-entry-header {
  text-align: center;
  margin-bottom: 20px;
}
.studio-entry-card {
  border-radius: 24px !important;
  border: 1px solid #e8e2de !important;
  box-shadow: 0 4px 20px -2px rgba(28, 25, 23, 0.05) !important;
  background: #ffffff !important;
  overflow: hidden;
}
.studio-entry-intro {
  max-width: 680px;
  margin-bottom: 20px;
  text-align: center;
}
.studio-entry-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  background: #fbf3f0;
  border: 1px solid #f0d8d0;
  color: #b25d49;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
}
.studio-entry-intro h1 {
  font-size: clamp(24px, 3vw, 30px);
  line-height: 1.35;
  font-weight: 700;
  color: #1c1917;
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}
.studio-entry-intro p {
  font-size: 14px;
  line-height: 1.7;
  color: #78716c;
  margin: 0 auto;
  max-width: 580px;
}
.studio-entry-roadmap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 0 auto 28px;
  padding: 12px 18px;
  background: #faf8f6;
  border: 1px solid #f0ece9;
  border-radius: 12px;
  max-width: 720px;
  width: 100%;
  box-sizing: border-box;
}
.studio-entry-roadmap__step {
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: left;
}
.studio-entry-roadmap__num {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fbf3f0;
  border: 1px solid #f0d8d0;
  color: #b25d49;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.studio-entry-roadmap__info strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #1c1917;
  white-space: nowrap;
}
.studio-entry-roadmap__info small {
  display: block;
  font-size: 11px;
  color: #a8a29e;
  white-space: nowrap;
}
.studio-entry-roadmap__arrow {
  color: #d6d3d1;
  flex-shrink: 0;
}
.studio-entry-prompt {
  width: 100%;
  max-width: 720px;
  text-align: left;
  margin: 0 auto;
}
.studio-entry-prompt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.studio-entry-prompt-header label {
  font-size: 13px;
  font-weight: 600;
  color: #292524;
}
.studio-entry-limit {
  font-size: 11px;
  color: #a8a29e;
}
.studio-entry-prompt :deep(.el-textarea__inner) {
  padding: 16px 18px;
  border-radius: 12px;
  line-height: 1.8;
  font-size: 14px;
  color: #1c1917;
  border-color: #e7e2df;
  transition: all 0.2s ease;
}
.studio-entry-prompt :deep(.el-textarea__inner:focus) {
  border-color: #b25d49;
  box-shadow: 0 0 0 3px rgba(178, 93, 73, 0.12);
}
.studio-entry-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 12px 0 18px;
}
.studio-entry-examples-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #78716c;
  font-weight: 500;
}
.studio-entry-example-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #ede7e4;
  background: #fdfbf9;
  color: #57514d;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  transition: all 0.18s ease;
}
.studio-entry-example-btn:hover {
  color: #b25d49;
  border-color: #d9aba0;
  background: #fbf3f0;
}
.studio-entry-types {
  border: 0;
  padding: 0;
  margin: 0 0 24px;
}
.studio-entry-types legend {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #78716c;
}
.studio-entry-types-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.studio-entry-type-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 12px;
  border: 1px solid #e7e2df;
  border-radius: 9px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #57514d;
  background: #faf8f6;
  transition: all 0.18s ease;
}
.studio-entry-type-chip:hover {
  border-color: #d9aba0;
  background: #ffffff;
}
.studio-entry-type-chip input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.studio-entry-type-chip:has(input:focus-visible) {
  outline: 2px solid #b25d49;
  outline-offset: 4px;
}
.studio-entry-type-chip.selected {
  border-color: #b25d49;
  color: #b25d49;
  background: #fbf3f0;
  box-shadow: 0 0 0 1px #b25d49;
  font-weight: 600;
}
.studio-entry-file-label {
  width: 100%;
  max-width: 720px;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  color: #78716c;
  margin: 6px 0 10px;
}
.studio-entry-card :deep(.el-upload-dragger) {
  padding: 16px !important;
  border-radius: 12px !important;
  border: 1.5px dashed #e2dad5 !important;
  background: #faf8f6 !important;
  transition: all 0.2s ease;
}
.studio-entry-card :deep(.el-upload-dragger:hover) {
  border-color: #b25d49 !important;
  background: #fbf5f2 !important;
}
.studio-entry-card .courseware-advanced-settings {
  margin-top: 22px;
  border: 1px solid #ede7e4;
  border-radius: 12px;
  overflow: hidden;
}

@media (max-width: 768px) {
  .studio-entry-roadmap {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .studio-entry-roadmap__arrow {
    display: none;
  }
  .studio-entry-types-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.courseware-asset-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.courseware-preview :deep(.el-button + .el-button) {
  margin-left: 0;
}

.courseware-studio-container {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
}
.courseware-studio-result-link {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}
.series-workspace {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #f8f5f3;
  padding: clamp(16px, 3vw, 36px);
}

.series-workspace__content {
  box-sizing: border-box;
  width: min(100%, 1040px);
  padding: clamp(20px, 3vw, 36px);
  margin: 0 auto;
  border: 1px solid #e8e2de;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 4px 20px -2px rgb(28 25 23 / 5%);
  animation: entry-reveal 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.series-workspace__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 20px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e9e4df;
}

.series-workspace__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  color: #242124;
  overflow-wrap: anywhere;
}

.series-workspace__description {
  max-width: 680px;
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: #766f73;
}

.series-workspace__summary {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 10px;
  font-size: 12px;
  color: #766f73;
  background: #fff;
  border: 1px solid #e9e4df;
  border-radius: 8px;
}

.series-workspace__summary :deep(svg) {
  color: #b25d49;
}

.series-workspace__summary strong {
  font-size: 16px;
  color: #242124;
}

.series-courseware-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.series-courseware-card {
  display: flex;
  min-width: 0;
  flex-direction: row;
  align-items: center;
  overflow: hidden;
  padding: 24px 0;
  background: #fff;
  border-bottom: 1px solid #eee8e3;
  animation: entry-reveal 500ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease,
    border-color 0.2s ease;
}

.series-courseware-card__open {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: row;
  align-items: center;
  padding: 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.series-courseware-card__open:focus-visible {
  outline: 2px solid #b25d49;
  outline-offset: -2px;
}

.series-courseware-card__open[aria-disabled='true'] {
  cursor: default;
}

.series-courseware-card:last-child {
  border-bottom: 0;
}
.series-courseware-card:hover {
  background: #fdfbf9;
}

.series-courseware-card.is-unavailable {
  opacity: 0.7;
}

.series-courseware-card__cover {
  position: relative;
  width: 260px;
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #f1ebe7;
  border: 1px solid #eee8e3;
  border-radius: 10px;
}

.series-courseware-card__cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.series-courseware-card__open:hover .series-courseware-card__cover img {
  transform: scale(1.025);
}

.series-courseware-card__cover--coral {
  color: #9a4e3d;
  background: #f8e5df;
}

.series-courseware-card__cover--blue {
  color: #406c89;
  background: #e1edf3;
}

.series-courseware-card__cover--green {
  color: #4f765b;
  background: #e4efe5;
}

.series-courseware-card__fallback {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 18px;
}

.series-courseware-card__fallback span {
  font-size: 38px;
  font-weight: 700;
  line-height: 1;
}

.series-courseware-card__cover-meta {
  position: absolute;
  inset: 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  pointer-events: none;
}

.series-courseware-card__part,
.series-courseware-card__status {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  border-radius: 999px;
}

.series-courseware-card__part {
  color: #473f42;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 2px 8px rgb(45 32 37 / 10%);
}

.series-courseware-card__status {
  color: #6b5f63;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 2px 8px rgb(45 32 37 / 10%);
}

.series-courseware-card__status.is-succeeded {
  color: #216247;
  background: #e8f5ef;
}

.series-courseware-card__status.is-failed {
  color: #b42318;
  background: #fff0ee;
}

.series-courseware-card__status.is-pending {
  color: #9a5a13;
  background: #fff4df;
}

.series-courseware-card__body {
  display: flex;
  min-height: 112px;
  flex: 1;
  flex-direction: column;
  padding: 16px;
}

.series-courseware-card__body h3 {
  display: -webkit-box;
  min-height: 44px;
  margin: 0;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  color: #242124;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.series-courseware-card__duration {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.4;
  color: #766f73;
}

.series-courseware-card__error {
  display: -webkit-box;
  margin: 10px 0 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  color: #b42318;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.series-courseware-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 12px 20px;
  flex-shrink: 0;
}

.series-courseware-card__download {
  width: 40px;
  height: 36px;
  color: #5d565a !important;
  background: #fff !important;
  border-color: #ded6d2 !important;
}

.series-courseware-card__download:hover,
.series-courseware-card__download:focus {
  color: #b25d49 !important;
  background: #fff7f5 !important;
  border-color: #b25d49 !important;
}

.series-courseware-card__preview {
  flex: 0;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  font-weight: 700;
  white-space: nowrap;
}

@media (max-width: 1023px) {
  .series-courseware-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 639px) {
  .series-courseware-card {
    flex-wrap: wrap;
  }
  .series-courseware-card__open {
    flex-direction: column !important;
  }
  .series-courseware-card__cover {
    width: 100%;
  }
  .series-courseware-card__actions {
    width: 100%;
    padding: 0 0 8px;
  }
  .series-courseware-card__preview {
    width: 100%;
  }
  .series-workspace__content {
    padding: 16px;
  }

  .series-workspace__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 16px;
    margin-bottom: 16px;
  }

  .series-courseware-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .series-workspace__content,
  .series-courseware-card,
  .series-courseware-card__cover img {
    animation: none;
    transition: none;
  }
}

.courseware-upload-card :deep(.el-card__body) {
  padding: 0;
}

.courseware-create-shell {
  width: 100%;
}

.courseware-advanced-settings {
  border-top: 1px solid #eee8e3;
}

.courseware-advanced-settings :deep(.el-collapse-item__header) {
  height: 48px;
  border-bottom: 0;
  color: #3f3a3d;
}

.courseware-advanced-settings :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
}

.courseware-advanced-prompt {
  padding-bottom: 4px;
}

/**
 * 初始卡片淡出后，双栏工作台轻柔浮现，不横向推挤内容。
 */
.cw-swap-enter-active {
  transition:
    opacity 0.9s ease,
    transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.cw-swap-leave-active {
  transition: opacity 0.75s ease;
}

.cw-swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.cw-swap-leave-to {
  opacity: 0;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .cw-swap-enter-active,
  .cw-swap-leave-active {
    transition: opacity 0.2s ease;
  }

  .cw-swap-enter-from,
  .cw-swap-leave-to {
    transform: none;
  }
}

.courseware-upload :deep(.el-upload) {
  width: 100%;
}

.courseware-upload :deep(.el-upload-dragger) {
  width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
}

.courseware-upload :deep(.el-upload-dragger:hover),
.courseware-upload :deep(.el-upload-dragger.is-dragover) {
  background: var(--beauty-brand-soft);
}

.courseware-create-flow :deep(.text-gray-900),
.courseware-create-flow :deep(.text-gray-800),
.courseware-create-flow :deep(.text-slate-800),
.beauty-preview :deep(.text-slate-800) {
  color: var(--beauty-text) !important;
}

.courseware-create-flow :deep(.text-gray-700),
.courseware-create-flow :deep(.text-slate-700),
.beauty-preview :deep(.text-slate-700),
.beauty-preview :deep(.text-slate-600) {
  color: #5d565a !important;
}

.courseware-create-flow :deep(.text-gray-500),
.courseware-create-flow :deep(.text-gray-400),
.beauty-preview :deep(.text-slate-500),
.beauty-preview :deep(.text-slate-400) {
  color: var(--beauty-text-muted) !important;
}

.courseware-create-flow :deep(.text-blue-600),
.courseware-create-flow :deep(.text-blue-500),
.courseware-create-flow :deep(.text-indigo-600),
.beauty-preview :deep(.text-indigo-600),
.beauty-preview :deep(.text-fuchsia-600) {
  color: var(--beauty-brand) !important;
}

.courseware-create-flow :deep(.bg-blue-600),
.courseware-create-flow :deep(.bg-indigo-600),
.beauty-preview :deep(.bg-indigo-600),
.beauty-preview :deep(.bg-fuchsia-500) {
  background-color: var(--beauty-brand) !important;
}

.courseware-create-flow :deep(.hover\:\!bg-indigo-700:hover),
.beauty-preview :deep(.hover\:\!bg-indigo-700:hover) {
  background-color: #974f3e !important;
}

.courseware-create-flow :deep(.bg-blue-50),
.courseware-create-flow :deep(.bg-indigo-50),
.courseware-create-flow :deep(.bg-gray-50),
.beauty-preview :deep(.bg-slate-50),
.beauty-preview :deep(.bg-slate-100),
.beauty-preview :deep(.bg-indigo-50\/30),
.beauty-preview :deep(.bg-fuchsia-50\/30),
.beauty-preview :deep(.hover\:bg-slate-50:hover),
.beauty-preview :deep(.hover\:bg-slate-100:hover) {
  background-color: #f8f5f3 !important;
}

.courseware-create-flow :deep(.border-blue-600),
.courseware-create-flow :deep(.border-indigo-600),
.beauty-preview :deep(.border-indigo-600),
.beauty-preview :deep(.border-fuchsia-300) {
  border-color: var(--beauty-brand) !important;
}

.courseware-create-flow :deep(.border-gray-300),
.courseware-create-flow :deep(.border-gray-200),
.courseware-create-flow :deep(.border-gray-100),
.courseware-create-flow :deep(.border-slate-200),
.beauty-preview :deep(.border-slate-200),
.beauty-preview :deep(.border-slate-100),
.beauty-preview :deep(.border-indigo-100),
.beauty-preview :deep(.border-r),
.beauty-preview :deep(.border-l),
.beauty-preview :deep(.border-b),
.beauty-preview :deep(.border-t) {
  border-color: var(--beauty-border) !important;
}

.courseware-create-flow :deep(.bg-gray-200),
.courseware-create-flow :deep(.bg-slate-200),
.beauty-preview :deep(.bg-slate-200),
.beauty-preview :deep(.bg-slate-300),
.beauty-preview :deep(.bg-slate-400) {
  background-color: var(--beauty-border) !important;
}

.prototype-upload-icon {
  color: var(--beauty-rose);
  background: var(--beauty-rose-soft);
}

.beauty-primary-button {
  color: #fff !important;
  background: var(--beauty-brand) !important;
  border-color: var(--beauty-brand) !important;
  box-shadow: 0 10px 20px rgb(178 93 73 / 18%);
}

.beauty-primary-button:hover,
.beauty-primary-button:focus {
  color: #fff !important;
  background: #974f3e !important;
  border-color: #974f3e !important;
}

.beauty-primary-button.is-loading,
.beauty-primary-button.is-disabled,
.beauty-primary-button:disabled {
  color: #fff !important;
  background: var(--beauty-brand) !important;
  border-color: var(--beauty-brand) !important;
  opacity: 0.72;
}

.courseware-language-button {
  color: var(--beauty-text) !important;
  background: #fff !important;
  border-color: var(--beauty-border) !important;
}

.courseware-language-button:hover,
.courseware-language-button:focus {
  color: var(--beauty-brand) !important;
  background: var(--beauty-brand-soft) !important;
  border-color: var(--beauty-brand) !important;
}

.courseware-create-flow :deep(input[type='checkbox']) {
  accent-color: var(--beauty-brand);
}

.courseware-create-flow :deep(.courseware-upload-card) {
  background: var(--beauty-card-bg);
  border-color: var(--beauty-border) !important;
  box-shadow: var(--beauty-shadow-soft);
}

.courseware-create-flow :deep(.border-t-indigo-600) {
  border-top-color: var(--beauty-brand) !important;
}

.courseware-create-flow :deep(.border-indigo-100) {
  border-color: #f3c9bc !important;
}

.courseware-create-flow :deep(.bg-indigo-50) {
  background-color: var(--beauty-brand-soft) !important;
}

/* One writing surface, with a quiet explanation of the process alongside it. */
.studio-entry-flow {
  width: 100%;
  max-width: none;
}
.studio-entry-card .studio-entry-layout {
  display: grid;
  grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.6fr);
  align-items: center;
  box-sizing: border-box;
  gap: clamp(28px, 4vw, 64px);
  padding: clamp(28px, 4vw, 52px);
  text-align: left;
}
.studio-entry-story {
  padding-top: 12px;
}
.studio-entry-intro {
  text-align: left;
  margin-bottom: 40px;
}
.studio-entry-intro h1 {
  font-size: clamp(28px, 2.8vw, 42px);
  line-height: 1.35;
  letter-spacing: -0.04em;
  text-wrap: balance;
  margin: 20px 0 18px;
}
.studio-entry-intro p {
  line-height: 1.9;
  max-width: 30ch;
  margin: 0;
}
.studio-entry-roadmap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
}
.studio-entry-roadmap__arrow {
  display: none;
}
.studio-entry-roadmap__step {
  gap: 14px;
}
.studio-entry-roadmap__num {
  width: 28px;
  height: 28px;
  background: transparent;
  border-color: #dfd5ce;
  color: #8a6557;
}
.studio-entry-roadmap__info strong {
  font-size: 13px;
}
.studio-entry-roadmap__info small {
  white-space: normal;
  margin-top: 5px;
  font-size: 12px;
  color: #78716c;
  line-height: 1.65;
}
.studio-entry-editor {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  padding: 0;
}
.studio-entry-editor > * {
  width: 100%;
  max-width: none;
}
.studio-entry-editor :deep(.el-textarea__inner) {
  min-height: 170px;
  padding: 18px;
  font-size: 15px;
  line-height: 1.8;
}
.studio-entry-examples {
  gap: 6px;
  margin-top: 12px;
}
.studio-entry-examples-label {
  width: 100%;
  margin-bottom: 4px;
}
.studio-entry-types {
  margin: 22px 0 20px;
}
.studio-entry-type-chip {
  min-height: 40px;
  padding: 8px 10px;
  font-size: 12px;
}
.studio-entry-file-label {
  margin-top: 24px;
}
.studio-entry-editor :deep(.el-upload-dragger) {
  padding: 6px !important;
}
.studio-entry-editor :deep(.courseware-upload-placeholder) {
  gap: 10px;
  padding: 10px;
  flex-wrap: wrap;
}
.studio-entry-editor :deep(.courseware-upload-placeholder h3) {
  flex: 1;
  min-width: 170px;
  font-size: 12px;
  line-height: 1.6;
}
.studio-entry-editor :deep(.courseware-upload-placeholder p) {
  width: 100%;
  margin-left: 50px;
  font-size: 11px;
}
.studio-entry-card .courseware-advanced-settings {
  margin-top: 14px;
  border: 0;
  border-bottom: 1px solid #eee8e3;
  border-radius: 0;
}
.studio-entry-actions {
  margin-top: 24px;
}
.studio-entry-story,
.studio-entry-editor {
  animation: entry-reveal 440ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.studio-entry-editor {
  animation-delay: 70ms;
}
@keyframes entry-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (min-width: 1001px) and (max-height: 850px) {
  .studio-entry-card .studio-entry-layout {
    padding: 20px 32px;
    gap: 32px;
  }
  .studio-entry-editor :deep(.el-textarea__inner) {
    min-height: 112px !important;
    padding: 12px;
    font-size: 14px;
    line-height: 1.6;
  }
  .studio-entry-intro {
    margin-bottom: 24px;
  }
  .studio-entry-intro h1 {
    font-size: 32px;
    margin: 12px 0;
  }
  .studio-entry-roadmap {
    gap: 16px;
  }
  .studio-entry-types {
    margin: 14px 0 4px;
  }
  .studio-entry-file-label {
    margin-top: 12px;
  }
  .studio-entry-actions {
    margin-top: 16px;
  }
}
@media (max-width: 1000px) {
  .studio-entry-card .studio-entry-layout {
    grid-template-columns: 1fr;
    padding: 28px;
    gap: 28px;
  }
  .studio-entry-story {
    padding-top: 0;
  }
  .studio-entry-intro {
    margin-bottom: 0;
  }
  .studio-entry-intro h1 {
    font-size: 30px;
    margin: 14px 0;
  }
  .studio-entry-intro p {
    max-width: none;
  }
  .studio-entry-roadmap {
    display: none;
  }
  .studio-entry-badge {
    margin-bottom: 0;
  }
}
@media (max-width: 600px) {
  .studio-entry-card .studio-entry-layout {
    padding: 20px;
    gap: 24px;
  }
  .studio-entry-intro h1 {
    font-size: 27px;
  }
  .studio-entry-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }
  .studio-entry-actions > :deep(.el-button),
  .studio-entry-actions :deep(.el-dropdown),
  .studio-entry-actions :deep(.el-dropdown > .el-button) {
    width: 100%;
    margin: 0;
  }
  .studio-entry-editor :deep(.courseware-upload-placeholder p) {
    margin-left: 0;
  }
}
:global(.dark) .studio-entry-card {
  background: #211f1d !important;
  border-color: #423a35 !important;
}
:global(.dark) .studio-entry-intro h1,
:global(.dark) .studio-entry-roadmap__info strong,
:global(.dark) .studio-entry-prompt-header label {
  color: #f3eee9;
}
:global(.dark) .studio-entry-intro p,
:global(.dark) .studio-entry-roadmap__info small,
:global(.dark) .studio-entry-file-label {
  color: #bdb2aa;
}
:global(.dark) .studio-entry-card :deep(.el-upload-dragger),
:global(.dark) .studio-entry-type-chip {
  background: #2a2522 !important;
  border-color: #51433b !important;
  color: #d9c9bf;
}
:global(.dark) .studio-entry-type-chip.selected {
  color: #f0b5a4;
  background: #3b2922 !important;
}
@media (prefers-reduced-motion: reduce) {
  .studio-entry-card *,
  .cw-swap-enter-active,
  .cw-swap-leave-active {
    animation: none !important;
    transition: none !important;
  }
}
</style>
