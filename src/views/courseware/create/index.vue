<template>
  <div class="courseware-asset-page">
    <area-scope-notice />
    <div
      v-if="pageInitializing"
      class="courseware-preview courseware-preview--fullscreen beauty-preview mt-1 flex flex-1 min-h-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div class="flex flex-col items-center gap-4 text-center px-6">
        <div class="relative">
          <div
            class="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"
          ></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <Icon icon="ep:loading" class="w-7 h-7 text-indigo-600 animate-spin" />
          </div>
        </div>
        <div>
          <div class="text-sm font-semibold text-slate-800">{{
            t('coursewareCreate.previewLoading')
          }}</div>
        </div>
      </div>
    </div>

    <div
      v-else-if="step === 3"
      class="courseware-preview courseware-preview--fullscreen beauty-preview mt-1 flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
    >
      <div
        v-if="showPreviewToolbar"
        class="flex h-12 shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-4"
      >
        <el-button v-if="canReturnToSeriesList" @click="handleBackToSeriesList">{{
          t('coursewareCreate.preview.backToList')
        }}</el-button>
        <el-button v-if="previewDownloadUrl && !resultSeries" @click="handleOpenPreviewDownload">{{
          t('coursewareCreate.preview.download')
        }}</el-button>
        <el-button
          v-if="previewCoursewareId && !readOnly && !resultSeries"
          type="primary"
          class="beauty-primary-button"
          :loading="coursewarePublishing"
          :disabled="coursewarePublishing || iframeLoading || previewCoursewarePublished"
          @click="handlePublishPreviewCourseware"
        >
          {{
            t(
              previewCoursewarePublished
                ? 'coursewareCreate.publishedButton'
                : 'coursewareCreate.publishButton'
            )
          }}
        </el-button>
      </div>
      <div class="flex-1 flex overflow-hidden min-h-0 bg-white relative">
        <template v-if="previewUrl">
          <div v-show="!showSeriesList" class="relative flex min-h-0 flex-1">
            <iframe
              ref="previewIframeRef"
              :src="embeddedPreviewUrl"
              class="block h-full min-h-0 w-full flex-1 border-0 bg-white"
              :class="iframeLoading ? 'invisible' : 'visible'"
              :title="t('coursewareCreate.preview.iframeTitle')"
              allow="fullscreen; microphone; clipboard-read; clipboard-write"
              @load="handleIframeLoad"
            ></iframe>
            <div
              v-if="iframeLoading && !embeddedBackNavigating"
              class="absolute inset-0 z-10 flex items-center justify-center bg-white"
            >
              <div class="flex flex-col items-center gap-4 px-6 text-center">
                <div class="relative">
                  <div
                    class="h-14 w-14 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"
                  ></div>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <Icon icon="ep:loading" class="h-6 w-6 text-indigo-600 animate-spin" />
                  </div>
                </div>
                <div>
                  <div class="text-sm font-semibold text-slate-800">
                    {{ t('coursewareCreate.previewLoading') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-if="showSeriesList || !previewUrl">
          <template v-if="resultSeries?.items?.length">
            <div class="series-workspace">
              <div class="series-workspace__content">
                <header class="series-workspace__header">
                  <div class="min-w-0">
                    <h2 class="series-workspace__title">
                      {{ resultSeries?.title || t('coursewareCreate.series.title') }}
                    </h2>
                    <p class="series-workspace__description">
                      {{
                        t('coursewareCreate.series.count', {
                          count: resultSeries?.items?.length || 0
                        })
                      }}
                    </p>
                  </div>
                  <el-button class="series-workspace__back" @click="handleBackToGeneration">
                    <Icon icon="lucide:arrow-left" class="mr-1.5 h-4 w-4" />
                    {{ t('coursewareCreate.series.backToGeneration') }}
                  </el-button>
                </header>

                <div class="series-courseware-grid">
                  <article
                    v-for="(item, itemIndex) in resultSeries?.items || []"
                    :key="item.childJobId"
                    class="series-courseware-card"
                    :style="{ animationDelay: `${Math.min(itemIndex, 6) * 65}ms` }"
                    :class="{ 'is-unavailable': !canPreviewSeriesItem(item) }"
                  >
                    <div
                      role="button"
                      class="series-courseware-card__open"
                      :aria-label="seriesItemTitle(item)"
                      :aria-disabled="!canPreviewSeriesItem(item)"
                      :tabindex="canPreviewSeriesItem(item) ? 0 : -1"
                      @click="handleOpenSeriesItem(item)"
                      @keydown.enter="handleOpenSeriesItem(item)"
                      @keydown.space.prevent="handleOpenSeriesItem(item)"
                    >
                      <div class="series-courseware-card__cover">
                        <img
                          v-if="seriesItemCover(item)"
                          :src="seriesItemCover(item)"
                          :alt="seriesItemTitle(item)"
                          loading="lazy"
                          @error="handleSeriesItemCoverError(item)"
                        />
                        <SeriesPageCover
                          v-else
                          :task-id="generationStore.task?.id"
                          :page-id="seriesItemFirstPage(item)"
                          :title="seriesItemTitle(item)"
                        />
                        <div class="series-courseware-card__cover-meta">
                          <span class="series-courseware-card__part">
                            {{
                              t('coursewareCreate.series.part', {
                                index: item.partIndex,
                                count: item.partCount
                              })
                            }}
                          </span>
                          <span
                            class="series-courseware-card__status"
                            :class="seriesItemStatusClass(item.status)"
                          >
                            {{ formatSeriesItemStatus(item.status) }}
                          </span>
                        </div>
                      </div>
                      <div class="series-courseware-card__body">
                        <h3 :title="seriesItemTitle(item)">{{ seriesItemTitle(item) }}</h3>
                        <div
                          v-if="item.estimatedDurationSeconds"
                          class="series-courseware-card__duration"
                        >
                          <Icon icon="lucide:clock-3" class="h-3.5 w-3.5" />
                          {{
                            t('coursewareCreate.series.estimatedDuration', {
                              minutes: Math.max(1, Math.round(item.estimatedDurationSeconds / 60))
                            })
                          }}
                        </div>
                        <p v-if="item.error" class="series-courseware-card__error">{{
                          item.error
                        }}</p>
                      </div>
                    </div>
                    <div class="series-courseware-card__actions">
                      <el-button
                        type="primary"
                        class="beauty-primary-button series-courseware-card__preview"
                        :disabled="!canPreviewSeriesItem(item)"
                        @click="handleSelectSeriesItem(item)"
                      >
                        {{ t('coursewareCreate.series.preview') }}
                        <Icon icon="lucide:arrow-right" class="ml-1.5 h-4 w-4" />
                      </el-button>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div
              class="flex flex-1 items-center justify-center bg-white px-6 text-sm text-[#766F73]"
              >{{ t('coursewareCreate.series.empty') }}</div
            >
          </template>
        </template>
      </div>
    </div>

    <div
      v-else
      class="courseware-create-flow mx-auto"
      :class="step === 2 ? 'studio-flow' : 'studio-entry-flow'"
    >
      <Transition name="cw-swap" mode="out-in">
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
                    <el-tree-select
                      v-model="selectedCatalogKeys"
                      :data="catalogTree"
                      node-key="value"
                      multiple
                      show-checkbox
                      check-strictly
                      :render-after-expand="false"
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
                      class="courseware-upload-item"
                    >
                      <div class="courseware-upload-item__icon">
                        <Icon icon="lucide:file-text" :size="22" />
                      </div>
                      <div class="courseware-upload-item__body">
                        <div class="courseware-upload-item__heading">
                          <span class="min-w-0 truncate font-medium" :title="item.name">{{
                            item.name
                          }}</span>
                          <span class="courseware-upload-item__type">{{ item.extension }}</span>
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
                      <div class="courseware-upload-item__actions">
                        <el-button
                          v-if="item.status === 'uploading'"
                          link
                          @click="pauseUpload(item)"
                        >
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
                        <el-button
                          link
                          type="danger"
                          class="!ml-0"
                          :aria-label="t('action.delete')"
                          :title="t('action.delete')"
                          @click="removeUploadItem(index)"
                        >
                          <Icon icon="lucide:trash-2" class="h-3.5 w-3.5" />
                        </el-button>
                      </div>
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

        <div v-else-if="step === 2" class="courseware-studio-container">
          <div
            v-if="isCoursewareTaskResultReady(generationStore.task)"
            class="courseware-studio-result-link"
          >
            <el-button @click="handleOpenCompletedResults">{{
              t('coursewareCreate.series.viewResults')
            }}</el-button>
          </div>
          <CoursewareStudio
            :task="generationStore.task"
            :source-prompt="formData.prompt"
            :busy="answeringTask || confirmingTask || generationSubmitting"
            :confirmation-failure-revision="confirmationFailureRevision"
            :status-title="generationStatusTitle"
            :status-description="generationStatusDescription"
            :progress="displayProgress"
            :source-preparation-pending="sourcePreparationPending"
            :auto-confirm="formData.autoConfirm"
            :connection-interrupted="generationStore.pollError"
            :can-retry-homework="canRetryHomework"
            @answer="handleSubmitWaitingAnswers"
            @confirm="handleConfirmStudio"
            @cancel="handleReset"
            @retry-homework="handleRetryHomework"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox, UploadFile } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  CoursewareApi,
  CoursewareGenerationReqVO,
  CoursewareMaterialFileReqVO,
  CoursewareSalesboostFileCapabilitiesVO
} from '@/api/courseware'
import type { CoursewareVO } from '@/api/courseware'
import type {
  CoursewareCatalogOptionsVO,
  CoursewareGenerationSeriesItemVO,
  CoursewareSalesboostEmbedVO,
  CoursewareGenerationTaskVO
} from '@/api/courseware'
import { buildCatalogTree, joinCatalogKeys, splitCatalogKeys } from '../catalog'
import CoursewareStudio from './components/CoursewareStudio.vue'
import BrandCatalogPopover from './components/BrandCatalogPopover.vue'
import SeriesPageCover from './components/SeriesPageCover.vue'
import { withManualSelectionPayload } from './manualSelection'
import { buildStudioInstruction } from './studioDraft'
import type { CoursewareStudioConfirmation } from '@/api/courseware'
import { BrowserUploadSessionApi, type BrowserUploadSessionRespVO } from '@/api/infra/uploadSession'
import { createUploader, type BrowserUploader } from '@/components/BrowserUploadUploaders'
import {
  buildCoursewareUploadResumeTask,
  cleanupStaleCoursewareUploadResumeTasks,
  COURSEWARE_UPLOAD_CHUNK_SIZE,
  isResumeTaskExpired,
  loadCoursewareUploadResumeTasks,
  matchesCoursewareUploadResumeFile,
  removeCoursewareUploadResumeTask,
  saveCoursewareUploadResumeTask,
  updateCoursewareUploadResumeTask,
  type CoursewareUploadResumeTask
} from './uploadResumeTasks'
import {
  COURSEWARE_TASK_STATUS,
  createCoursewareFormDefaults,
  getWaitingQuestions,
  hasCoursewarePreviewRouteQuery,
  isCoursewareTaskActive,
  isCoursewareTaskFailed,
  isCoursewareTaskResultReady,
  resolveCoursewareTaskResult,
  resolveCoursewareTaskDisplayStatus,
  resolveCoursewareTaskStatus
} from './generationTask'
import { AiVoiceApi, AiVoiceVO } from '@/api/ai-resource/voice'
import { useCoursewareGenerationStore } from '@/store/modules/coursewareGeneration'
import { useLocaleStore } from '@/store/modules/locale'
import { useI18n } from '@/hooks/web/useI18n'
import { useMessage } from '@/hooks/web/useMessage'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'CoursewareCreate' })

const message = useMessage()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const generationStore = useCoursewareGenerationStore()
const localeStore = useLocaleStore()

const step = ref<1 | 2 | 3>(1)
const completedWorkspaceTaskId = ref<number | undefined>(
  route.query.workspace === '1' ? Number(route.query.taskId) : undefined
)
const readOnly = computed(() => route.query.readOnly === '1')
const embeddedBackNavigating = ref(false)
const pageInitializing = ref(
  Boolean(
    route.query.coursewareId ||
      route.query.taskId ||
      route.query.url ||
      route.query.previewUrl ||
      route.query.shareUrl
  )
)
const previewUrl = ref('')
const previewDownloadUrl = ref('')
const previewTitle = ref('')
const resultSeries = ref<CoursewareGenerationTaskVO['series']>()
const selectedSeriesItem = ref<CoursewareGenerationSeriesItemVO>()
interface CoursewarePreviewCacheEntry {
  courseware?: CoursewareVO
  coursewareRequest?: Promise<CoursewareVO>
  embed?: CoursewareSalesboostEmbedVO
  embedRequest?: Promise<CoursewareSalesboostEmbedVO>
}

const EMBED_CACHE_REFRESH_MARGIN_MILLIS = 60_000
const coursewarePreviewCache = new Map<number, CoursewarePreviewCacheEntry>()
const getCoursewarePreviewCacheEntry = (coursewareId: number) => {
  const existing = coursewarePreviewCache.get(coursewareId)
  if (existing) return existing
  const entry: CoursewarePreviewCacheEntry = {}
  coursewarePreviewCache.set(coursewareId, entry)
  return entry
}
const getCachedCourseware = (coursewareId: number): Promise<CoursewareVO> => {
  const entry = getCoursewarePreviewCacheEntry(coursewareId)
  if (entry.courseware) return Promise.resolve(entry.courseware)
  if (entry.coursewareRequest) return entry.coursewareRequest

  entry.coursewareRequest = CoursewareApi.getCourseware(coursewareId)
    .then((courseware: CoursewareVO) => {
      entry.courseware = courseware
      return courseware
    })
    .finally(() => {
      entry.coursewareRequest = undefined
    })
  return entry.coursewareRequest
}
const isCachedEmbedFresh = (embed?: CoursewareSalesboostEmbedVO) =>
  Boolean(embed?.url && Number(embed.expiresAt) > Date.now() + EMBED_CACHE_REFRESH_MARGIN_MILLIS)
const getCachedSalesboostEmbed = (coursewareId: number): Promise<CoursewareSalesboostEmbedVO> => {
  const entry = getCoursewarePreviewCacheEntry(coursewareId)
  if (isCachedEmbedFresh(entry.embed)) return Promise.resolve(entry.embed!)
  if (entry.embedRequest) return entry.embedRequest

  entry.embedRequest = CoursewareApi.getSalesboostEmbed(coursewareId)
    .then((embed: CoursewareSalesboostEmbedVO) => {
      entry.embed = embed
      return embed
    })
    .finally(() => {
      entry.embedRequest = undefined
    })
  return entry.embedRequest
}
type SeriesItemMetadataState = {
  title: string
  coverUrl: string
  loading: boolean
  coverFailed: boolean
}
const seriesItemMetadata = reactive<Record<string, SeriesItemMetadataState>>({})
const seriesCoverSyncRequests = new Set<number>()
const previewCoursewareId = ref<number>()
let previewLoadSequence = 0
const COURSEWARE_PUBLISHED_STATUS = 20
const previewCoursewareStatus = ref<number>()
const previewCoursewarePublished = computed(
  () => previewCoursewareStatus.value === COURSEWARE_PUBLISHED_STATUS
)
const selectedFiles = ref<UploadedCoursewareFile[]>([])
const previewIframeRef = ref<HTMLIFrameElement>()
const resumeFileInputRef = ref<HTMLInputElement>()
const pendingResumeTask = ref<CoursewareUploadResumeTask>()
const iframeLoading = ref(false)
const generationSubmitting = ref(false)
const answeringTask = ref(false)
const confirmingTask = ref(false)
const confirmationFailureRevision = ref(0)
const SALESBOOST_HOST_APP = 'salesboost'
const SALESBOOST_MESSAGE_TYPE_NAVIGATE_BACK = 'salesboost:navigate-back'
const SALESBOOST_MESSAGE_TYPE_READY = 'salesboost:ready'
const SALESBOOST_MESSAGE_TYPE_SET_LOCALE = 'salesboost:set-locale'
const SALESBOOST_MESSAGE_TYPE_REFRESH_EMBED_TOKEN = 'salesboost:refresh-embed-token'
const SALESBOOST_MESSAGE_TYPE_EMBED_TOKEN_REFRESHED = 'salesboost:embed-token-refreshed'
const SALESBOOST_MESSAGE_TYPE_MICROPHONE_PERMISSION_REQUEST =
  'salesboost:course-microphone-permission-request'
const SALESBOOST_MESSAGE_TYPE_MICROPHONE_PERMISSION_RESULT =
  'salesboost:course-microphone-permission-result'
const APP_MICROPHONE_PERMISSION_REQUEST_ACTION = 'course_microphone_permission_request'
const APP_MICROPHONE_PERMISSION_RESULT_ACTION = 'course_microphone_permission_result'
const voiceLoading = ref(false)
const narratorVoices = ref<AiVoiceVO[]>([])
const coursewarePublishing = ref(false)
const catalogLoading = ref(false)
const catalogOptions = ref<CoursewareCatalogOptionsVO>()
const selectedCatalogKeys = ref<string[]>([])
const catalogTree = computed(() => buildCatalogTree(catalogOptions.value))
const catalogSelection = computed(() => splitCatalogKeys(selectedCatalogKeys.value))
const manualSelectionPanel = ref('')
const manualSelectionEnabled = computed(() => manualSelectionPanel.value === 'settings')
const loadCatalogOptions = async () => {
  catalogLoading.value = true
  try {
    catalogOptions.value = await CoursewareApi.getCatalogOptions()
  } finally {
    catalogLoading.value = false
  }
}
const handleCatalogVisibleChange = (visible: boolean) => {
  if (visible) void loadCatalogOptions()
}

type AppMicrophonePermissionStatus =
  | 'granted'
  | 'authorized'
  | 'denied'
  | 'blocked'
  | 'restricted'
  | 'unavailable'
  | 'error'

interface AppMicrophonePermissionRequestMessage {
  action: typeof APP_MICROPHONE_PERMISSION_REQUEST_ACTION
  data: {
    requestId: string
  }
}

interface AppMicrophonePermissionResultPayload {
  requestId?: string
  granted?: boolean
  status?: AppMicrophonePermissionStatus | string
  message?: string
  error?: string
}

interface AppMicrophonePermissionResultMessage {
  action?: typeof APP_MICROPHONE_PERMISSION_RESULT_ACTION
  data?: AppMicrophonePermissionResultPayload
}

interface SalesboostMicrophonePermissionRequestMessage
  extends AppMicrophonePermissionRequestMessage {
  type: typeof SALESBOOST_MESSAGE_TYPE_MICROPHONE_PERMISSION_REQUEST
  hostApp: typeof SALESBOOST_HOST_APP
}

interface SalesboostMicrophonePermissionResultMessage extends AppMicrophonePermissionResultMessage {
  type: typeof SALESBOOST_MESSAGE_TYPE_MICROPHONE_PERMISSION_RESULT
  hostApp: typeof SALESBOOST_HOST_APP
}

interface PendingMicrophonePermissionRequest {
  targetWindow: Window
  targetOrigin: string
  timeoutId: number
}

type CourseMicrophonePermissionWindow = Window & {
  webkit?: {
    messageHandlers?: {
      courseMicrophonePermission?: {
        postMessage?: (message: AppMicrophonePermissionRequestMessage) => void
      }
    }
  }
  courseMicrophonePermission?: {
    postMessage?: (message: string) => void
    requestPermission?: (message: string) => void
  }
  CourseMicrophonePermission?: {
    handleResult?: (result: unknown) => boolean
  }
  handleCourseMicrophonePermissionResult?: (result: unknown) => boolean
}

const pendingMicrophonePermissionRequests = new Map<string, PendingMicrophonePermissionRequest>()
let cleanupMicrophonePermissionResultHandlers: (() => void) | undefined

interface UploadedCoursewareFile extends CoursewareMaterialFileReqVO {}

type CoursewareMode = 'ai-courseware' | 'script-only'
type CoursewareLanguage = 'cn' | 'en' | 'id'
type DocumentProcessingMode = NonNullable<CoursewareGenerationReqVO['documentProcessingMode']>
type UploadStatus = 'ready' | 'uploading' | 'paused' | 'success' | 'failed'

interface CoursewareUploadItem {
  uid: string
  file: File
  name: string
  size: number
  type: string
  extension: string
  progress: number
  status: UploadStatus
  uploadId?: string
  objectKey?: string
  configId?: number
  resumeTaskId?: string
  chunkSize: number
  materialFile?: CoursewareMaterialFileReqVO
  uploader?: BrowserUploader | null
  session?: BrowserUploadSessionRespVO
  error?: unknown
  removed?: boolean
}

type FileCapability = NonNullable<CoursewareSalesboostFileCapabilitiesVO['fileTypes']>[number]

const MB = 1024 * 1024
const DEFAULT_SOURCE_FILE_MAX_SIZE_BYTES = 500 * MB
const FALLBACK_FILE_CAPABILITIES: FileCapability[] = [
  {
    extension: 'pdf',
    mimeTypes: ['application/pdf'],
    maxSizeBytes: DEFAULT_SOURCE_FILE_MAX_SIZE_BYTES,
    parse: true,
    direct: true,
    enabled: true,
    label: 'PDF'
  },
  {
    extension: 'doc',
    mimeTypes: ['application/msword'],
    maxSizeBytes: DEFAULT_SOURCE_FILE_MAX_SIZE_BYTES,
    parse: true,
    direct: true,
    enabled: true,
    label: 'DOC'
  },
  {
    extension: 'docx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSizeBytes: DEFAULT_SOURCE_FILE_MAX_SIZE_BYTES,
    parse: true,
    direct: true,
    enabled: true,
    label: 'DOCX'
  },
  {
    extension: 'ppt',
    mimeTypes: ['application/vnd.ms-powerpoint'],
    maxSizeBytes: DEFAULT_SOURCE_FILE_MAX_SIZE_BYTES,
    parse: true,
    direct: true,
    enabled: true,
    label: 'PPT'
  },
  {
    extension: 'pptx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    maxSizeBytes: DEFAULT_SOURCE_FILE_MAX_SIZE_BYTES,
    parse: true,
    direct: true,
    enabled: true,
    label: 'PPTX'
  }
]
const SOURCE_FILE_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}
const uploadItems = ref<CoursewareUploadItem[]>([])
const recoverableUploadTasks = ref<CoursewareUploadResumeTask[]>([])
const fileCapabilities = ref<CoursewareSalesboostFileCapabilitiesVO>()
const coursewareMode = ref<CoursewareMode>('ai-courseware')

const enabledFileCapabilities = computed(() => {
  const apiCapabilities = fileCapabilities.value?.fileTypes?.filter(
    (item) => item.enabled !== false && item.parse !== false
  )
  return apiCapabilities?.length ? apiCapabilities : FALLBACK_FILE_CAPABILITIES
})

const allowedExtensions = computed(() =>
  enabledFileCapabilities.value.map((item) => item.extension.toLowerCase())
)
const acceptedFileTypes = computed(() =>
  allowedExtensions.value.map((extension) => `.${extension}`).join(',')
)
const maxFileSizeBytes = computed(() =>
  Math.max(
    ...enabledFileCapabilities.value.map((item) => item.maxSizeBytes || 0),
    DEFAULT_SOURCE_FILE_MAX_SIZE_BYTES
  )
)
const maxFileSize = computed(() => Math.floor(maxFileSizeBytes.value / MB))
const uploadingCount = computed(
  () => uploadItems.value.filter((item) => item.status === 'uploading').length
)
const hasPausedUpload = computed(() => uploadItems.value.some((item) => item.status === 'paused'))
const hasReadyUpload = computed(() => uploadItems.value.some((item) => item.status === 'ready'))
const documentProcessingMode = computed<DocumentProcessingMode>(() =>
  coursewareMode.value === 'script-only' && selectedFiles.value.length > 0 ? 'direct' : 'parse'
)

const SALESBOOST_LOCALE_MAP: Record<string, CoursewareLanguage> = {
  'zh-CN': 'cn',
  cn: 'cn',
  en: 'en',
  id: 'id'
}

const formData = reactive<
  CoursewareGenerationReqVO & {
    prompt: string
    outlineEnhancementEnabled: boolean
    autoConfirm: boolean
  }
>(Object.assign(createCoursewareFormDefaults('cn'), { autoConfirm: false }))
const courseKind = ref('auto')
const courseKinds = [
  { value: 'auto', label: 'auto', icon: 'lucide:sparkles' },
  { value: 'experience', label: 'experienceType', icon: 'lucide:messages-square' },
  { value: 'operation', label: 'operationType', icon: 'lucide:list-checks' },
  { value: 'knowledge', label: 'knowledgeType', icon: 'lucide:lightbulb' }
]

// Content language is selected on this page; the top-right locale only controls
// Vue text and the embedded classroom UI.
const generationLanguageSelected = ref(false)

const normalizeCoursewareLanguage = (language?: string): CoursewareLanguage => {
  const normalized = language?.trim()
  if (normalized === 'cn' || normalized === 'en' || normalized === 'id') {
    return normalized
  }
  return SALESBOOST_LOCALE_MAP[normalized || ''] || 'cn'
}

const generationLanguageOptions = computed<Array<{ value: CoursewareLanguage; label: string }>>(
  () => [
    { value: 'cn', label: t('coursewareCreate.generationLanguages.cn') },
    { value: 'en', label: t('coursewareCreate.generationLanguages.en') },
    { value: 'id', label: t('coursewareCreate.generationLanguages.id') }
  ]
)

const generationLanguageLabel = computed(
  () =>
    generationLanguageOptions.value.find((item) => item.value === formData.language)?.label ||
    generationLanguageOptions.value[0].label
)

const hasUploadedMaterial = computed(() => selectedFiles.value.length > 0)
const hasGenerationPrompt = computed(() => Boolean(formData.prompt?.trim()))
const hasGenerationSource = computed(() => hasUploadedMaterial.value || hasGenerationPrompt.value)

const buildRequest = (): CoursewareGenerationReqVO => {
  const materialFiles = selectedFiles.value.map((file) => ({
    fileId: file.fileId,
    configId: file.configId,
    path: file.path,
    name: file.name,
    url: file.url,
    size: file.size,
    type: file.type
  }))
  return withManualSelectionPayload(
    {
      description: formData.description,
      trainingObjective: formData.trainingObjective,
      category: formData.category,
      tags: selectedFiles.value.map((file) => file.name),
      knowledgeMaterial: '',
      materialFiles,
      additionalInstruction: buildStudioInstruction(formData.prompt, courseKind.value),
      language: normalizeCoursewareLanguage(formData.language),
      style: formData.style,
      promptEnhancementEnabled: true,
      narratorVoiceId: formData.narratorVoiceId,
      narratorMinimaxVoiceId: formData.narratorMinimaxVoiceId,
      brandIds: catalogSelection.value.brandIds,
      categoryIds: catalogSelection.value.categoryIds,
      productIds: catalogSelection.value.productIds
    },
    manualSelectionEnabled.value,
    {
      generateHomeworkSync: formData.generateHomeworkSync,
      enableImageGeneration: formData.enableImageGeneration,
      outlineEnhancementEnabled: formData.outlineEnhancementEnabled,
      documentProcessingMode: documentProcessingMode.value
    }
  )
}

const hasPreviewRouteQuery = computed(() => hasCoursewarePreviewRouteQuery(route.query))
const directPreviewUrl = computed(() => {
  const rawUrl = route.query.previewUrl || route.query.url || route.query.shareUrl
  return Array.isArray(rawUrl) ? rawUrl[0] : rawUrl ? String(rawUrl) : ''
})

const currentVueLocale = computed(() => localeStore.getCurrentLocale?.lang || 'zh-CN')
const currentSalesboostLocale = computed(
  () => SALESBOOST_LOCALE_MAP[currentVueLocale.value] || 'cn'
)

const parsePreviewUrl = (rawUrl: string) => {
  if (!rawUrl || typeof window === 'undefined') {
    return undefined
  }

  try {
    return new URL(rawUrl, window.location.origin)
  } catch {
    return undefined
  }
}

const buildEmbeddedPreviewUrl = (rawUrl: string) => {
  const url = parsePreviewUrl(rawUrl)
  if (!url) {
    return rawUrl
  }

  url.searchParams.set('embed', '1')
  url.searchParams.set('hostApp', SALESBOOST_HOST_APP)
  url.searchParams.set('returnMode', 'postMessage')
  url.searchParams.set('hostOrigin', window.location.origin)
  url.searchParams.set('uiLocale', currentSalesboostLocale.value)
  url.searchParams.set('hostMicrophoneBridge', '1')
  return url.toString()
}

const embeddedPreviewUrl = computed(() => buildEmbeddedPreviewUrl(previewUrl.value))
const previewOrigin = computed(() => parsePreviewUrl(previewUrl.value)?.origin || '')

const displayProgress = computed(() => generationStore.displayProgress)
const currentTaskStatus = computed(() => resolveCoursewareTaskStatus(generationStore.task?.status))
const currentTaskDisplayStatus = computed(() =>
  resolveCoursewareTaskDisplayStatus(generationStore.task)
)
const waitingQuestions = computed(() => getWaitingQuestions(generationStore.task))
const waitingForUser = computed(
  () => currentTaskStatus.value === COURSEWARE_TASK_STATUS.WAITING_FOR_USER
)
const waitingForConfirmation = computed(
  () => currentTaskStatus.value === COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION
)
const sourcePreparationPending = computed(() =>
  ['pending', 'running'].includes(generationStore.task?.sourcePreparation?.status || '')
)
const showSeriesList = computed(
  () => Boolean(resultSeries.value?.items?.length) && !selectedSeriesItem.value
)
const canReturnToSeriesList = computed(() =>
  Boolean(resultSeries.value?.items?.length && selectedSeriesItem.value)
)
const showPreviewToolbar = computed(
  () =>
    !showSeriesList.value &&
    Boolean(previewCoursewareId.value || previewDownloadUrl.value || canReturnToSeriesList.value)
)
const canStartGeneration = computed(
  () =>
    !generationSubmitting.value &&
    uploadingCount.value === 0 &&
    !hasPausedUpload.value &&
    !hasReadyUpload.value &&
    hasGenerationSource.value
)
const homeworkGenerationStarted = computed(() =>
  Boolean(
    generationStore.task?.resultCoursewareId || generationStore.task?.homeworkGenerationTaskId
  )
)
const homeworkGenerationActive = computed(
  () =>
    generationStore.task?.generateHomeworkSync === true &&
    homeworkGenerationStarted.value &&
    ['queued', 'running', 'succeeded'].includes(
      generationStore.task?.homeworkGenerationStatus || ''
    )
)
const generationTerminalError = computed(() => isCoursewareTaskFailed(generationStore.task?.status))
// 课件本体已生成成功，仅课后作业失败：允许从失败卡片直接重试附加题（不重新生成课件）
const canRetryHomework = computed(
  () =>
    currentTaskStatus.value === COURSEWARE_TASK_STATUS.FAILED &&
    Boolean(generationStore.task?.resultCoursewareId) &&
    generationStore.task?.homeworkGenerationStatus === 'failed'
)
const handleRetryHomework = async () => {
  const task = generationStore.task
  if (!task?.resultCoursewareId || !canRetryHomework.value) return
  await ElMessageBox.confirm(
    t('coursewareCreate.retryHomeworkConfirm'),
    t('coursewareCreate.retryHomeworkButton'),
    {
      confirmButtonText: t('coursewareCreate.retryHomeworkStart'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  )
  const retryTask = await CoursewareApi.regenerateHomework({
    coursewareId: task.resultCoursewareId,
    generationTaskId: task.id
  })
  message.success(t('coursewareCreate.retryHomeworkSubmitted'))
  // 练习重试沿用父生成任务。接口返回的旧快照可能因运行时序列化而暂时不带页面，
  // 因此在新结果可用前始终保留当前页面和系列信息，避免右侧工作区被清空。
  const mergedGeneration = retryTask.generation
    ? {
        ...task.generation,
        ...retryTask.generation,
        pages:
          retryTask.generation.pages?.length || !task.generation?.pages?.length
            ? retryTask.generation.pages
            : task.generation.pages
      }
    : task.generation
  const mergedSeries = retryTask.series?.items?.length ? retryTask.series : task.series
  generationStore.setTask({
    ...task,
    ...retryTask,
    generation: mergedGeneration,
    series: mergedSeries,
    result: retryTask.result || task.result
  })
}
const generationButtonText = computed(() => {
  if (uploadingCount.value > 0) return t('coursewareCreate.uploadingButton')
  if (hasPausedUpload.value || hasReadyUpload.value) return t('coursewareCreate.uploadingButton')
  return t('coursewareCreate.studio.start')
})
const generationStatusTitle = computed(() => {
  if (isCoursewareTaskResultReady(generationStore.task))
    return t('coursewareCreate.status.completed')
  if (
    generationTerminalError.value &&
    currentTaskStatus.value === COURSEWARE_TASK_STATUS.CANCELED
  ) {
    return t('coursewareCreate.cancelledTitle')
  }
  if (generationTerminalError.value) {
    return t('coursewareCreate.failedTitle')
  }
  if (waitingForUser.value) {
    return t('coursewareCreate.status.waitingForUser')
  }
  if (waitingForConfirmation.value) {
    return t('coursewareCreate.status.waitingForConfirmation')
  }
  if (homeworkGenerationActive.value) {
    return t('coursewareCreate.homeworkGeneratingTitle')
  }
  if (currentTaskStatus.value === COURSEWARE_TASK_STATUS.QUEUED) {
    return t('coursewareCreate.queuedTitle')
  }
  if (currentTaskDisplayStatus.value === COURSEWARE_TASK_STATUS.REVIEWING_OUTLINE) {
    return t('coursewareCreate.status.reviewingOutline')
  }
  if (currentTaskDisplayStatus.value === COURSEWARE_TASK_STATUS.SPLITTING_OUTLINE) {
    return t('coursewareCreate.status.splittingOutline')
  }
  if (currentTaskDisplayStatus.value === COURSEWARE_TASK_STATUS.GENERATING_CHILDREN) {
    return t('coursewareCreate.status.generatingChildren')
  }
  return t('coursewareCreate.generatingTitle')
})
const generationStatusDescription = computed(() => {
  if (isCoursewareTaskResultReady(generationStore.task))
    return t('coursewareCreate.studio.phaseHints.completed')
  if (generationTerminalError.value && generationStore.task?.errorMessage) {
    return generationStore.task.errorMessage
  }
  if (generationTerminalError.value && generationStore.task?.error) {
    return generationStore.task.error
  }
  if (currentTaskStatus.value === COURSEWARE_TASK_STATUS.CANCELED) {
    return t('coursewareCreate.cancelledDesc')
  }
  if (generationTerminalError.value) {
    return t('coursewareCreate.failedDesc')
  }
  if (waitingForUser.value) {
    return sourcePreparationPending.value
      ? t('coursewareCreate.questions.waitingWithSourceDescription')
      : t('coursewareCreate.questions.waitingDescription')
  }
  if (waitingForConfirmation.value) {
    return t('coursewareCreate.confirmation.description')
  }
  if (homeworkGenerationActive.value) {
    return t('coursewareCreate.homeworkGeneratingDesc')
  }
  if (currentTaskDisplayStatus.value === COURSEWARE_TASK_STATUS.REVIEWING_OUTLINE) {
    return t('coursewareCreate.status.reviewingOutlineDescription')
  }
  if (currentTaskDisplayStatus.value === COURSEWARE_TASK_STATUS.SPLITTING_OUTLINE) {
    return t('coursewareCreate.status.splittingOutlineDescription')
  }
  if (currentTaskDisplayStatus.value === COURSEWARE_TASK_STATUS.GENERATING_CHILDREN) {
    return t('coursewareCreate.status.generatingChildrenDescription')
  }
  return t('coursewareCreate.generatingDesc')
})

const getFileExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || ''

const getFileCapability = (extension: string) =>
  enabledFileCapabilities.value.find((item) => item.extension.toLowerCase() === extension)

const getDirectModeUnsupportedFiles = () =>
  selectedFiles.value.filter((file) => {
    const capability = getFileCapability(getFileExtension(file.name))
    return !capability?.direct
  })

const normalizeFileMimeType = (file: File, extension: string) =>
  file.type || SOURCE_FILE_MIME_TYPES[extension] || 'application/octet-stream'

const formatFileSize = (size?: number) => {
  if (!size) return '0 MB'
  if (size < MB) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / MB).toFixed(size >= 10 * MB ? 0 : 1)} MB`
}

const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString()

const refreshRecoverableUploadTasks = () => {
  const { freshTasks, removedTasks } = cleanupStaleCoursewareUploadResumeTasks()
  recoverableUploadTasks.value = freshTasks
  if (removedTasks.length > 0) {
    message.warning(t('coursewareCreate.resumeTaskExpired'))
  }
}

const persistResumeTask = (item: CoursewareUploadItem) => {
  if (!item.uploadId || !item.objectKey || !item.configId || !item.session) return
  const task = buildCoursewareUploadResumeTask({
    uploadId: item.uploadId,
    objectKey: item.objectKey,
    configId: item.configId,
    provider: item.session.provider,
    mode: item.session.mode,
    bucket: item.session.bucket,
    region: item.session.region,
    endpoint: item.session.endpoint,
    file: item.file,
    extension: item.extension,
    type: item.type,
    progress: item.progress,
    chunkSize: item.chunkSize
  })
  item.resumeTaskId = task.id
  saveCoursewareUploadResumeTask(task)
  refreshRecoverableUploadTasks()
}

const updateResumeTaskProgress = (item: CoursewareUploadItem) => {
  updateCoursewareUploadResumeTask(item.resumeTaskId || item.uploadId, {
    progress: item.progress,
    chunkSize: item.chunkSize
  })
  recoverableUploadTasks.value = loadCoursewareUploadResumeTasks()
}

const clearResumeTask = (item: CoursewareUploadItem) => {
  removeCoursewareUploadResumeTask(item.resumeTaskId || item.uploadId)
  refreshRecoverableUploadTasks()
}

const validateUploadFile = (file: File) => {
  const extension = getFileExtension(file.name)
  const capability = getFileCapability(extension)
  if (!capability) {
    message.error(t('coursewareCreate.unsupportedFile'))
    return null
  }
  const limitBytes = capability.maxSizeBytes || maxFileSizeBytes.value
  if (file.size > limitBytes) {
    message.error(t('coursewareCreate.fileTooLarge', { size: Math.floor(limitBytes / MB) }))
    return null
  }
  return {
    extension,
    type: normalizeFileMimeType(file, extension)
  }
}

const syncSelectedFiles = () => {
  selectedFiles.value = uploadItems.value
    .filter((item) => item.status === 'success' && item.materialFile)
    .map((item) => item.materialFile as UploadedCoursewareFile)
}

const hasUploadStatus = (item: CoursewareUploadItem, status: UploadStatus) => item.status === status

const getUploadErrorMessageKey = (error: unknown) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'coursewareCreate.uploadOffline'
  }

  const errorRecord = error && typeof error === 'object' ? (error as Record<string, any>) : {}
  const response =
    errorRecord.response && typeof errorRecord.response === 'object'
      ? (errorRecord.response as Record<string, any>)
      : {}
  const code = String(errorRecord.code || response.code || '').toLowerCase()
  const errorMessage = String(errorRecord.message || error || '').toLowerCase()
  const status = Number(response.status || errorRecord.status || errorRecord.statusCode || 0)

  if (
    code === 'econnaborted' ||
    code === 'etimedout' ||
    code.includes('timeout') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out')
  ) {
    return 'coursewareCreate.uploadTimeout'
  }

  if (
    code === 'err_network' ||
    code.includes('network') ||
    code === 'requesterror' ||
    errorMessage.includes('network error') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('load failed') ||
    errorMessage.includes('connection error')
  ) {
    return 'coursewareCreate.uploadNetworkError'
  }

  if (
    status === 401 ||
    status === 403 ||
    code.includes('expiredtoken') ||
    code.includes('invalidaccesskey') ||
    code.includes('securitytoken')
  ) {
    return 'coursewareCreate.uploadAuthorizationExpired'
  }

  if (status >= 500) {
    return 'coursewareCreate.uploadServerError'
  }

  return 'coursewareCreate.uploadFailedRetry'
}

const startUpload = async (item: CoursewareUploadItem) => {
  const isResumeAttempt = Boolean(item.resumeTaskId && item.uploadId)
  item.status = 'uploading'
  item.error = undefined
  try {
    // 初始化/刷新上传会话
    const session: BrowserUploadSessionRespVO = await BrowserUploadSessionApi.initUploadSession({
      uploadId: item.uploadId || undefined,
      name: item.name,
      size: item.size,
      type: item.type
    })
    item.uploadId = session.uploadId
    item.objectKey = session.objectKey
    item.configId = session.configId
    item.session = session
    item.resumeTaskId = session.uploadId
    persistResumeTask(item)

    // 使用 factory 创建对应 provider/mode 的 uploader
    const uploader = createUploader({
      session,
      refreshCredentials: async () => {
        const refreshed = await BrowserUploadSessionApi.refreshUploadSession({
          uploadId: item.uploadId!
        })
        item.session = refreshed
        return refreshed
      }
    })
    item.uploader = uploader

    await uploader.upload(
      item.file,
      session.objectKey,
      (progress: number) => {
        if (item.removed) return
        item.progress = Math.min(99, progress)
        updateResumeTaskProgress(item)
      },
      { chunkSize: item.chunkSize }
    )

    if (item.removed) return
    if (hasUploadStatus(item, 'paused')) return

    // 完成上传会话
    const completed = await BrowserUploadSessionApi.completeUploadSession({
      uploadId: session.uploadId,
      objectKey: session.objectKey,
      name: item.name,
      size: item.size,
      type: item.type
    })

    // 构造 materialFile（与旧接口保持一致）
    const materialFile: CoursewareMaterialFileReqVO = {
      fileId: undefined,
      configId: session.configId,
      path: session.objectKey,
      name: item.name,
      url: completed.objectUrl || '',
      size: item.size,
      type: item.type
    }
    item.progress = 100
    item.status = 'success'
    item.materialFile = materialFile
    clearResumeTask(item)
    syncSelectedFiles()
    message.success(t('coursewareCreate.uploadSuccess', { name: item.name }))
  } catch (error) {
    if (item.removed) return
    if (hasUploadStatus(item, 'paused')) return
    item.status = 'failed'
    item.error = error
    updateResumeTaskProgress(item)
    if (isResumeAttempt && !item.session?.accessKeyId && !item.session?.presignedUploadUrl) {
      clearResumeTask(item)
      message.error(t('coursewareCreate.resumeSessionUnavailable'))
      return
    }
    message.error(t(getUploadErrorMessageKey(error), { name: item.name }))
  } finally {
    item.uploader = null
  }
}

const createUploadItemFromFile = (
  file: File,
  extension: string,
  type: string,
  options: Partial<CoursewareUploadItem> = {}
): CoursewareUploadItem => ({
  uid: options.uid || `${Date.now()}-${file.name}`,
  file,
  name: file.name,
  size: file.size,
  type,
  extension,
  progress: options.progress || 0,
  status: options.status || 'ready',
  uploadId: options.uploadId,
  objectKey: options.objectKey,
  configId: options.configId,
  resumeTaskId: options.resumeTaskId,
  chunkSize: options.chunkSize || COURSEWARE_UPLOAD_CHUNK_SIZE,
  session: options.session
})

const handleUploadExceeded = () => {
  message.warning(t('coursewareCreate.uploadSingleFileOnly'))
}

const handleFileSelected = (uploadFile: UploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    return
  }
  // 参考资料仅支持单文件，重复选择（含拖拽）直接忽略并明确提示。
  if (uploadItems.value.length > 0) {
    message.warning(t('coursewareCreate.uploadSingleFileOnly'))
    return
  }
  const validated = validateUploadFile(rawFile)
  if (!validated) {
    return
  }
  const item = createUploadItemFromFile(rawFile, validated.extension, validated.type, {
    uid: uploadFile.uid?.toString()
  })
  uploadItems.value.push(item)
  void startUpload(uploadItems.value[uploadItems.value.length - 1])
}

const pauseUpload = (item: CoursewareUploadItem) => {
  if (item.status !== 'uploading') {
    return
  }
  item.status = 'paused'
  updateResumeTaskProgress(item)
  item.uploader?.cancel?.()
}

const resumeUpload = (item: CoursewareUploadItem) => {
  if (item.status !== 'paused' && item.status !== 'failed') {
    return
  }
  void startUpload(item)
}

const retryUpload = (item: CoursewareUploadItem) => {
  if (item.status !== 'failed') {
    return
  }
  void startUpload(item)
}

const chooseResumeFile = (task: CoursewareUploadResumeTask) => {
  if (isResumeTaskExpired(task)) {
    removeCoursewareUploadResumeTask(task.id)
    refreshRecoverableUploadTasks()
    message.warning(t('coursewareCreate.resumeTaskExpired'))
    return
  }
  pendingResumeTask.value = task
  if (resumeFileInputRef.value) {
    resumeFileInputRef.value.value = ''
    resumeFileInputRef.value.click()
  }
}

const handleResumeFileSelected = (event: Event) => {
  const task = pendingResumeTask.value
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  pendingResumeTask.value = undefined
  if (!task || !file) return
  if (uploadItems.value.length > 0) {
    message.warning(t('coursewareCreate.uploadSingleFileOnly'))
    return
  }
  if (!matchesCoursewareUploadResumeFile(task, file)) {
    message.error(t('coursewareCreate.resumeFileMismatch'))
    return
  }
  const validated = validateUploadFile(file)
  if (!validated) return
  const item = createUploadItemFromFile(
    file,
    task.extension || validated.extension,
    validated.type,
    {
      progress: task.progress,
      uploadId: task.uploadId,
      objectKey: task.objectKey,
      configId: task.configId,
      resumeTaskId: task.id,
      chunkSize: task.chunkSize || COURSEWARE_UPLOAD_CHUNK_SIZE,
      session: {
        uploadId: task.uploadId,
        configId: task.configId,
        provider: task.provider,
        mode: task.mode,
        bucket: task.bucket,
        region: task.region,
        endpoint: task.endpoint,
        objectKey: task.objectKey
      }
    }
  )
  uploadItems.value.push(item)
  void startUpload(item)
}

const discardResumeTask = async (task: CoursewareUploadResumeTask) => {
  try {
    await BrowserUploadSessionApi.abortUploadSession({ uploadId: task.uploadId })
  } catch {
    message.warning(t('coursewareCreate.discardUploadLocalOnly'))
  } finally {
    removeCoursewareUploadResumeTask(task.id)
    refreshRecoverableUploadTasks()
  }
}

const abortUploadSession = async (item: CoursewareUploadItem) => {
  if (!item.uploadId || item.status === 'success') {
    return
  }
  try {
    await BrowserUploadSessionApi.abortUploadSession({ uploadId: item.uploadId })
  } catch {
    // 删除本地条目不依赖后端 abort 成功；后端会按 Redis TTL 清理会话。
  }
}

const removeUploadItem = (index: number) => {
  const item = uploadItems.value[index]
  if (!item) {
    return
  }
  if (item.status === 'uploading') {
    item.status = 'paused'
  }
  item.removed = true
  item.uploader?.cancel?.()
  void abortUploadSession(item)
  clearResumeTask(item)
  uploadItems.value.splice(index, 1)
  syncSelectedFiles()
}

const loadNarratorVoices = async (lang?: string) => {
  voiceLoading.value = true
  try {
    const voiceLang = lang || currentSalesboostLocale.value
    narratorVoices.value = await AiVoiceApi.getList(voiceLang)
    // 若当前已选音色不在新列表中，清空选择
    if (
      formData.narratorVoiceId &&
      !narratorVoices.value.some((v) => v.voiceId === formData.narratorVoiceId)
    ) {
      formData.narratorVoiceId = undefined
      formData.narratorMinimaxVoiceId = undefined
    }
  } finally {
    voiceLoading.value = false
  }
}

const genderLabel = (gender?: number) => {
  if (gender === 1) return t('coursewareCreate.narratorGender.male')
  if (gender === 2) return t('coursewareCreate.narratorGender.female')
  return ''
}

const handleNarratorVoiceChange = (voiceId?: string) => {
  formData.narratorMinimaxVoiceId = voiceId
}

const handleGenerationLanguageChange = async (language: string) => {
  const nextLanguage = normalizeCoursewareLanguage(language)
  generationLanguageSelected.value = true
  if (formData.language === nextLanguage) {
    return
  }
  formData.language = nextLanguage
  await loadNarratorVoices(nextLanguage)
}

const handleStartGeneration = async () => {
  if (generationSubmitting.value || step.value !== 1) {
    return
  }
  if (uploadingCount.value > 0) {
    message.warning(t('coursewareCreate.waitUploading'))
    return
  }
  if (hasPausedUpload.value || hasReadyUpload.value) {
    message.warning(t('coursewareCreate.waitUploading'))
    return
  }
  if (!hasGenerationSource.value) {
    message.warning(t('coursewareCreate.needPromptOrUpload'))
    return
  }
  if (coursewareMode.value === 'script-only' && !hasUploadedMaterial.value) {
    coursewareMode.value = 'ai-courseware'
  }
  if (manualSelectionEnabled.value && documentProcessingMode.value === 'direct') {
    const unsupportedFiles = getDirectModeUnsupportedFiles()
    if (unsupportedFiles.length > 0) {
      message.warning(
        t('coursewareCreate.directModeUnsupportedFile', {
          names: unsupportedFiles.map((file) => file.name).join(', ')
        })
      )
      return
    }
  }
  generationSubmitting.value = true
  step.value = 2
  previewUrl.value = ''
  generationStore.clear()
  try {
    const task = await CoursewareApi.createGenerationTask(buildRequest())
    generationStore.setTask(task)
    await handleGenerationCompletion()
  } catch {
    generationStore.clear()
    step.value = 1
    message.error(t('coursewareGeneration.networkRetryLater'))
  } finally {
    generationSubmitting.value = false
  }
}

const clearPreviewResultState = () => {
  iframeLoading.value = false
  previewUrl.value = ''
  previewDownloadUrl.value = ''
  previewTitle.value = ''
  resultSeries.value = undefined
  selectedSeriesItem.value = undefined
  previewCoursewareId.value = undefined
  previewCoursewareStatus.value = undefined
}

const replaceRouteQuery = async (patch: Record<string, any>) => {
  const nextQuery = { ...route.query, ...patch }
  Object.keys(nextQuery).forEach((key) => {
    const value = nextQuery[key]
    if (value == null || value === '') {
      delete nextQuery[key]
    }
  })
  await router.replace({ path: route.path, query: nextQuery })
}

const handleOpenPreviewDownload = () => {
  if (!previewDownloadUrl.value) return
  window.open(previewDownloadUrl.value, '_blank')
}

const formatSeriesItemStatus = (status: number | string) => {
  const resolvedStatus = resolveCoursewareTaskStatus(status)
  if (resolvedStatus === COURSEWARE_TASK_STATUS.SUCCEEDED)
    return t('coursewareCreate.status.completed')
  if (resolvedStatus === COURSEWARE_TASK_STATUS.FAILED) return t('coursewareCreate.status.failed')
  if (resolvedStatus === COURSEWARE_TASK_STATUS.CANCELED)
    return t('coursewareCreate.status.cancelled')
  if (resolvedStatus === COURSEWARE_TASK_STATUS.GENERATING_CHILDREN)
    return t('coursewareCreate.status.generating')
  if (resolvedStatus === COURSEWARE_TASK_STATUS.QUEUED) return t('coursewareCreate.status.queued')
  if (resolvedStatus === COURSEWARE_TASK_STATUS.RUNNING) return t('coursewareCreate.status.running')
  return t('coursewareCreate.status.processing')
}

const seriesItemStatusClass = (status: number | string) => {
  const resolvedStatus = resolveCoursewareTaskStatus(status)
  if (resolvedStatus === COURSEWARE_TASK_STATUS.SUCCEEDED) return 'is-succeeded'
  if (
    resolvedStatus === COURSEWARE_TASK_STATUS.FAILED ||
    resolvedStatus === COURSEWARE_TASK_STATUS.CANCELED
  ) {
    return 'is-failed'
  }
  return 'is-pending'
}

const seriesItemFirstPage = (item: CoursewareGenerationSeriesItemVO) =>
  generationStore.task?.generation?.pages
    .filter((page) => page.partIndex === item.partIndex && page.status === 'completed')
    .sort((a, b) => a.order - b.order)[0]?.id

const resolveSeriesCoursewareId = (item: CoursewareGenerationSeriesItemVO) =>
  item.coursewareId || item.resultCoursewareId

const ensureSeriesItemMetadata = (item: CoursewareGenerationSeriesItemVO) => {
  const existing = seriesItemMetadata[item.childJobId]
  if (existing) return existing

  const metadata: SeriesItemMetadataState = {
    title: item.title,
    coverUrl: '',
    loading: false,
    coverFailed: false
  }
  seriesItemMetadata[item.childJobId] = metadata
  return metadata
}

const seriesItemTitle = (item: CoursewareGenerationSeriesItemVO) =>
  seriesItemMetadata[item.childJobId]?.title || item.title

const seriesItemCover = (item: CoursewareGenerationSeriesItemVO) => {
  const metadata = seriesItemMetadata[item.childJobId]
  return metadata?.coverFailed ? '' : metadata?.coverUrl || ''
}

const canPreviewSeriesItem = (item: CoursewareGenerationSeriesItemVO) =>
  Boolean(resolveSeriesCoursewareId(item) || item.previewUrl)

const handleSeriesItemCoverError = (item: CoursewareGenerationSeriesItemVO) => {
  const metadata = ensureSeriesItemMetadata(item)
  metadata.coverFailed = true
  metadata.coverUrl = ''
}

const loadSeriesItemMetadata = (item: CoursewareGenerationSeriesItemVO) => {
  const coursewareId = resolveSeriesCoursewareId(item)
  if (!coursewareId) return

  const metadata = ensureSeriesItemMetadata(item)
  if (metadata.loading) return

  metadata.loading = true
  void getCachedCourseware(coursewareId)
    .then((courseware) => {
      metadata.title = courseware?.title || metadata.title || item.title
      metadata.coverUrl = courseware?.coverUrl || ''
      metadata.coverFailed = false

      if (metadata.coverUrl || seriesCoverSyncRequests.has(coursewareId)) return
      seriesCoverSyncRequests.add(coursewareId)
      void CoursewareApi.syncCoursewareCoverUrl(coursewareId)
        .then((coverUrl) => {
          if (coverUrl) {
            metadata.coverUrl = coverUrl
            metadata.coverFailed = false
            const cacheEntry = getCoursewarePreviewCacheEntry(coursewareId)
            if (cacheEntry.courseware) {
              cacheEntry.courseware.coverUrl = coverUrl
              cacheEntry.courseware.coverNeedsSync = false
            }
          }
        })
        .catch(() => {
          // 首图尚未渲染完成时保留标题占位封面，下次重新进入列表可再试。
        })
        .finally(() => seriesCoverSyncRequests.delete(coursewareId))
    })
    .catch(() => {
      // 卡片已有任务标题和占位封面，元数据失败不应影响整个系列列表。
    })
    .finally(() => {
      metadata.loading = false
    })
}

const handleSelectSeriesItem = async (item: CoursewareGenerationSeriesItemVO) => {
  const series = resultSeries.value
  selectedSeriesItem.value = item
  const coursewareId = item.coursewareId || item.resultCoursewareId
  await replaceRouteQuery({
    taskId: generationStore.task?.id ? String(generationStore.task.id) : undefined,
    seriesId: resultSeries.value?.seriesId,
    currentPart: String(item.partIndex),
    coursewareId: coursewareId ? String(coursewareId) : undefined
  })
  if (coursewareId) {
    await loadCoursewarePreview(coursewareId)
    selectedSeriesItem.value = item
    resultSeries.value = generationStore.task?.series || series
    return
  }
  previewTitle.value = item.title
  previewDownloadUrl.value = item.downloadUrl || ''
  previewCoursewareId.value = undefined
  iframeLoading.value = !!item.previewUrl
  previewUrl.value = item.previewUrl || ''
  step.value = 3
}

const handleOpenSeriesItem = (item: CoursewareGenerationSeriesItemVO) => {
  if (!canPreviewSeriesItem(item)) return
  void handleSelectSeriesItem(item)
}

const handleBackToSeriesList = async () => {
  selectedSeriesItem.value = undefined
  previewTitle.value = resultSeries.value?.title || ''
  iframeLoading.value = false
  await replaceRouteQuery({ seriesId: undefined, currentPart: undefined, coursewareId: undefined })
}

const loadCoursewarePreview = async (coursewareId: number, fallbackPreviewUrl = '') => {
  const loadSequence = ++previewLoadSequence
  const previousPreviewUrl = previewUrl.value
  const previousCoursewareId = previewCoursewareId.value
  let courseware: CoursewareVO
  try {
    courseware = await getCachedCourseware(coursewareId)
  } catch {
    if (!fallbackPreviewUrl) return
    courseware = { id: coursewareId, title: '', previewUrl: fallbackPreviewUrl }
  }
  if (embeddedBackNavigating.value || loadSequence !== previewLoadSequence) return

  let nextPreviewUrl =
    courseware?.embedUrl || courseware?.previewUrl || courseware?.shareUrl || fallbackPreviewUrl
  if (nextPreviewUrl) {
    try {
      const embed = await getCachedSalesboostEmbed(coursewareId)
      nextPreviewUrl = embed?.url || nextPreviewUrl
    } catch {
      // 兜底保留原预览地址，避免嵌入授权异常导致整个页面不可用。
    }
  }
  if (embeddedBackNavigating.value || loadSequence !== previewLoadSequence) return

  resultSeries.value = undefined
  selectedSeriesItem.value = undefined
  previewDownloadUrl.value = courseware?.downloadUrl || ''
  previewTitle.value = courseware?.title || ''
  previewCoursewareId.value = coursewareId
  previewCoursewareStatus.value = courseware?.status
  if (nextPreviewUrl !== previousPreviewUrl || coursewareId !== previousCoursewareId) {
    iframeLoading.value = !!nextPreviewUrl
    previewUrl.value = nextPreviewUrl
  } else if (!nextPreviewUrl) {
    iframeLoading.value = false
  }
  step.value = 3
}

const applyTaskResultState = async (task?: CoursewareGenerationTaskVO) => {
  if (!isCoursewareTaskResultReady(task)) {
    clearPreviewResultState()
    step.value = 2
    return
  }

  const resultState = resolveCoursewareTaskResult(task, {
    seriesId: route.query.seriesId as any,
    currentPart: route.query.currentPart as any
  })
  const series = resultState.series
  const currentItem = resultState.currentItem
  const currentCoursewareId = currentItem?.coursewareId || currentItem?.resultCoursewareId

  resultSeries.value = series
  series?.items?.forEach(loadSeriesItemMetadata)
  selectedSeriesItem.value = currentItem
  previewTitle.value = resultState.title
  previewDownloadUrl.value = resultState.downloadUrl
  // A multi-part task keeps the first child in the legacy resultCoursewareId
  // field for old clients, but must still open the series selector first.
  previewCoursewareId.value =
    resultState.mode === 'series-list'
      ? undefined
      : currentCoursewareId || task?.resultCoursewareId || task?.coursewareId
  iframeLoading.value = !!resultState.previewUrl
  previewUrl.value = resultState.previewUrl
  step.value = 3

  // A refreshed series route must use the local SalesBoost courseware embed,
  // not the raw OpenMAIC preview URL. Keep the series state after loading the
  // existing iframe because loadCoursewarePreview clears transient result state.
  if (resultState.mode === 'series-preview' && currentCoursewareId) {
    await loadCoursewarePreview(currentCoursewareId)
    resultSeries.value = series
    selectedSeriesItem.value = currentItem
  }
}

const handleSubmitWaitingAnswers = async (
  answers: Array<{ id: string; value: string; note?: string }>
) => {
  const taskId = generationStore.task?.id
  if (!taskId || answeringTask.value) return
  answeringTask.value = true
  try {
    const updated = await CoursewareApi.answerGenerationTask({ id: taskId, answers })
    generationStore.setTask(updated)
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : t('coursewareCreate.submitAnswersFailed')
    )
  } finally {
    answeringTask.value = false
  }
}

const handleConfirmStudio = async (edits: CoursewareStudioConfirmation) => {
  const taskId = generationStore.task?.id
  if (!taskId || confirmingTask.value) return
  confirmingTask.value = true
  try {
    const updated = await CoursewareApi.confirmGenerationTask({
      id: taskId,
      confirmed: true,
      ...edits
    })
    generationStore.setTask(updated)
  } catch (error) {
    confirmationFailureRevision.value += 1
    message.error(
      error instanceof Error ? error.message : t('coursewareCreate.submitConfirmationFailed')
    )
  } finally {
    confirmingTask.value = false
  }
}

const handleBackToGeneration = async () => {
  const taskId = generationStore.task?.id
  if (!taskId) return
  completedWorkspaceTaskId.value = taskId
  previewLoadSequence += 1
  clearPreviewResultState()
  step.value = 2
  await replaceRouteQuery({
    taskId: String(taskId),
    workspace: '1',
    seriesId: undefined,
    currentPart: undefined,
    coursewareId: undefined
  })
}

const handleOpenCompletedResults = async () => {
  completedWorkspaceTaskId.value = undefined
  await replaceRouteQuery({ workspace: undefined })
  await handleGenerationCompletion()
}

const handleGenerationCompletion = async () => {
  const currentTask = generationStore.task
  if (currentTask && currentTask.id === completedWorkspaceTaskId.value) {
    step.value = 2
    return
  }
  if (!currentTask || !isCoursewareTaskResultReady(currentTask)) {
    clearPreviewResultState()
    if (currentTask) {
      step.value = 2
    }
    return
  }
  if ((currentTask.series?.items?.length || 0) > 1) {
    await applyTaskResultState(currentTask)
    return
  }
  const coursewareId = currentTask.resultCoursewareId || currentTask.coursewareId
  if (coursewareId) {
    await loadCoursewarePreview(coursewareId)
    return
  }
  await applyTaskResultState(currentTask)
}

const postSalesboostLocale = () => {
  if (!previewOrigin.value || !previewIframeRef.value?.contentWindow) {
    return
  }

  const payload = {
    type: SALESBOOST_MESSAGE_TYPE_SET_LOCALE,
    hostApp: SALESBOOST_HOST_APP,
    locale: currentSalesboostLocale.value
  }

  previewIframeRef.value.contentWindow.postMessage(payload, previewOrigin.value)
  window.setTimeout(() => {
    previewIframeRef.value?.contentWindow?.postMessage(payload, previewOrigin.value)
  }, 250)
  window.setTimeout(() => {
    previewIframeRef.value?.contentWindow?.postMessage(payload, previewOrigin.value)
  }, 1000)
}

const handleIframeLoad = () => {
  iframeLoading.value = false
  postSalesboostLocale()
}

const loadFileCapabilities = async () => {
  try {
    fileCapabilities.value = await CoursewareApi.getSalesboostFileCapabilities()
  } catch {
    fileCapabilities.value = undefined
  }
}

const cancelActiveUploads = () => {
  uploadItems.value.forEach((item) => {
    if (item.status === 'uploading') {
      item.uploader?.cancel?.()
      updateResumeTaskProgress(item)
      item.status = 'paused'
    }
  })
}

const resetFormState = () => {
  cancelActiveUploads()
  uploadItems.value = []
  selectedFiles.value = []
  formData.description = ''
  formData.trainingObjective = ''
  formData.category = ''
  formData.tags = []
  formData.knowledgeMaterial = ''
  generationLanguageSelected.value = false
  formData.language = currentSalesboostLocale.value
  formData.style = 'interactive'
  formData.generateHomeworkSync = true
  formData.enableImageGeneration = true
  formData.prompt = ''
  courseKind.value = 'auto'
  formData.outlineEnhancementEnabled = true
  formData.narratorVoiceId = undefined
  formData.narratorMinimaxVoiceId = undefined
  selectedCatalogKeys.value = []
  manualSelectionPanel.value = ''
  completedWorkspaceTaskId.value = undefined
}

const restoreGenerationLanguageFromTask = () => {
  const requestSnapshot = generationStore.task?.requestSnapshot
  if (!requestSnapshot) {
    return
  }
  try {
    const snapshot = JSON.parse(requestSnapshot) as {
      language?: string
      additionalInstruction?: string
      brandIds?: number[]
      categoryIds?: number[]
      productIds?: number[]
    }
    if (snapshot.additionalInstruction) formData.prompt = snapshot.additionalInstruction
    selectedCatalogKeys.value = joinCatalogKeys(
      snapshot.brandIds,
      snapshot.categoryIds,
      snapshot.productIds
    )
    if (!snapshot.language) {
      return
    }
    formData.language = normalizeCoursewareLanguage(snapshot.language)
    generationLanguageSelected.value = true
  } catch {
    // Historical task snapshots may not be valid JSON.
  }
}

const handleReset = async () => {
  const task = generationStore.task
  if (task?.id && isCoursewareTaskActive(task.status)) {
    try {
      await CoursewareApi.cancelGenerationTask(task.id)
    } catch (error) {
      message.error(
        error instanceof Error && error.message
          ? error.message
          : t('coursewareCreate.cancelGenerationFailed')
      )
      return
    }
  }
  generationStore.clear()
  clearPreviewResultState()
  previewCoursewareId.value = undefined
  previewCoursewareStatus.value = undefined
  step.value = 1
  resetFormState()
  await router.replace({ path: route.path, query: {} })
}

const handleEmbeddedBackReset = async () => {
  embeddedBackNavigating.value = true
  generationStore.clear()
  clearPreviewResultState()
  previewCoursewareId.value = undefined
  previewCoursewareStatus.value = undefined
  step.value = 1
  resetFormState()
  try {
    await router.replace({ path: route.path, query: {} })
  } finally {
    embeddedBackNavigating.value = false
  }
}

const openActiveTask = async () => {
  const coursewareId = Number(route.query.coursewareId)
  const taskId = Number(route.query.taskId)
  if (directPreviewUrl.value && !taskId) {
    if (coursewareId) {
      await loadCoursewarePreview(coursewareId, directPreviewUrl.value)
      return
    }
    let nextPreviewUrl = directPreviewUrl.value
    clearPreviewResultState()
    previewCoursewareId.value = undefined
    iframeLoading.value = true
    previewUrl.value = nextPreviewUrl
    step.value = 3
    return
  }

  if (taskId) {
    step.value = 2
    clearPreviewResultState()
    previewCoursewareId.value = undefined
    previewCoursewareStatus.value = undefined
    generationStore.setTask(await CoursewareApi.getGenerationTask(taskId))
    restoreGenerationLanguageFromTask()
    if (waitingQuestions.value.length) {
      return
    }
    await handleGenerationCompletion()
    return
  }

  if (coursewareId) {
    await loadCoursewarePreview(coursewareId)
    return
  }

  await generationStore.init()
  if (generationStore.task?.id) {
    restoreGenerationLanguageFromTask()
    if (waitingQuestions.value.length) {
      step.value = 2
      clearPreviewResultState()
      previewCoursewareId.value = undefined
      return
    }
    if (generationStore.isGenerating || waitingForConfirmation.value) {
      step.value = 2
      clearPreviewResultState()
      previewCoursewareId.value = undefined
      await handleGenerationCompletion()
    }
  }
}

watch(
  () => generationStore.task,
  async () => {
    if (waitingQuestions.value.length) {
      step.value = 2
      return
    }
    if (waitingForConfirmation.value) {
      step.value = 2
      // CoursewareStudio owns auto-confirm scheduling; avoid a second parent request.
      return
    }
    if (generationStore.task && !isCoursewareTaskResultReady(generationStore.task)) {
      clearPreviewResultState()
      step.value = 2
    }
    if (isCoursewareTaskResultReady(generationStore.task)) {
      await handleGenerationCompletion()
    }
  },
  { deep: true }
)

watch(
  () => selectedFiles.value.length,
  (count) => {
    if (count === 0 && coursewareMode.value === 'script-only') {
      coursewareMode.value = 'ai-courseware'
    }
  }
)

watch(
  currentSalesboostLocale,
  async (locale) => {
    if (!generationLanguageSelected.value && step.value === 1) {
      formData.language = locale
    }
    postSalesboostLocale()
    await loadNarratorVoices(formData.language)
  },
  { immediate: true }
)

const parseMicrophonePermissionResult = (
  rawResult: unknown
): AppMicrophonePermissionResultPayload | null => {
  let result = rawResult
  if (typeof rawResult === 'string') {
    try {
      result = JSON.parse(rawResult) as AppMicrophonePermissionResultPayload
    } catch {
      return null
    }
  }

  if (!result || typeof result !== 'object') return null

  const message = result as AppMicrophonePermissionResultMessage &
    AppMicrophonePermissionResultPayload
  if (message.data && typeof message.data === 'object') {
    return message.data
  }
  return message
}

const postSalesboostMicrophonePermissionResult = (
  targetWindow: Window,
  targetOrigin: string,
  data: AppMicrophonePermissionResultPayload
) => {
  const payload: SalesboostMicrophonePermissionResultMessage = {
    type: SALESBOOST_MESSAGE_TYPE_MICROPHONE_PERMISSION_RESULT,
    hostApp: SALESBOOST_HOST_APP,
    action: APP_MICROPHONE_PERMISSION_RESULT_ACTION,
    data
  }
  targetWindow.postMessage(payload, targetOrigin)
}

const handleNativeMicrophonePermissionResult = (rawResult: unknown): boolean => {
  const payload = parseMicrophonePermissionResult(rawResult)
  const requestId = payload?.requestId
  if (!payload || !requestId) return false

  const pending = pendingMicrophonePermissionRequests.get(requestId)
  if (!pending) return false

  window.clearTimeout(pending.timeoutId)
  pendingMicrophonePermissionRequests.delete(requestId)
  postSalesboostMicrophonePermissionResult(pending.targetWindow, pending.targetOrigin, payload)
  return true
}

const installMicrophonePermissionResultHandlers = () => {
  const permissionWindow = window as CourseMicrophonePermissionWindow
  const previousCourseMicrophonePermission = permissionWindow.CourseMicrophonePermission
  const previousHandleResult = permissionWindow.handleCourseMicrophonePermissionResult

  permissionWindow.CourseMicrophonePermission = {
    ...(previousCourseMicrophonePermission || {}),
    handleResult: handleNativeMicrophonePermissionResult
  }
  permissionWindow.handleCourseMicrophonePermissionResult = handleNativeMicrophonePermissionResult

  return () => {
    if (
      permissionWindow.CourseMicrophonePermission?.handleResult ===
      handleNativeMicrophonePermissionResult
    ) {
      permissionWindow.CourseMicrophonePermission = previousCourseMicrophonePermission
    }
    if (
      permissionWindow.handleCourseMicrophonePermissionResult ===
      handleNativeMicrophonePermissionResult
    ) {
      permissionWindow.handleCourseMicrophonePermissionResult = previousHandleResult
    }
  }
}

const postNativeMicrophonePermissionRequest = (
  message: AppMicrophonePermissionRequestMessage
): boolean => {
  const permissionWindow = window as CourseMicrophonePermissionWindow

  try {
    const bridge = permissionWindow.webkit?.messageHandlers?.courseMicrophonePermission
    if (bridge?.postMessage) {
      bridge.postMessage(message)
      return true
    }
  } catch {}

  const json = JSON.stringify(message)

  try {
    const bridge = permissionWindow.courseMicrophonePermission
    if (bridge?.postMessage) {
      bridge.postMessage(json)
      return true
    }
  } catch {}

  try {
    const bridge = permissionWindow.courseMicrophonePermission
    if (bridge?.requestPermission) {
      bridge.requestPermission(json)
      return true
    }
  } catch {}

  return false
}

const isMicrophonePermissionRequestMessage = (
  value: unknown
): value is SalesboostMicrophonePermissionRequestMessage => {
  if (!value || typeof value !== 'object') return false
  const message = value as SalesboostMicrophonePermissionRequestMessage
  return (
    message.type === SALESBOOST_MESSAGE_TYPE_MICROPHONE_PERMISSION_REQUEST &&
    message.hostApp === SALESBOOST_HOST_APP &&
    message.action === APP_MICROPHONE_PERMISSION_REQUEST_ACTION &&
    typeof message.data?.requestId === 'string' &&
    message.data.requestId.length > 0
  )
}

const handleMicrophonePermissionRequest = (
  event: MessageEvent,
  payload: SalesboostMicrophonePermissionRequestMessage
) => {
  const targetWindow = previewIframeRef.value?.contentWindow
  if (!targetWindow || event.source !== targetWindow) return

  const requestId = payload.data.requestId
  const message: AppMicrophonePermissionRequestMessage = {
    action: APP_MICROPHONE_PERMISSION_REQUEST_ACTION,
    data: { requestId }
  }

  const timeoutId = window.setTimeout(() => {
    pendingMicrophonePermissionRequests.delete(requestId)
    postSalesboostMicrophonePermissionResult(targetWindow, event.origin, {
      requestId,
      granted: false,
      status: 'error',
      message: t('coursewareCreate.microphonePermissionTimeout')
    })
  }, 30000)

  pendingMicrophonePermissionRequests.set(requestId, {
    targetWindow,
    targetOrigin: event.origin,
    timeoutId
  })

  if (postNativeMicrophonePermissionRequest(message)) return

  window.clearTimeout(timeoutId)
  pendingMicrophonePermissionRequests.delete(requestId)
  postSalesboostMicrophonePermissionResult(targetWindow, event.origin, {
    requestId,
    granted: true,
    status: 'granted'
  })
}

const refreshSalesboostEmbedToken = async () => {
  if (
    !previewCoursewareId.value ||
    !previewIframeRef.value?.contentWindow ||
    !previewOrigin.value
  ) {
    return
  }
  const embed = await getCachedSalesboostEmbed(previewCoursewareId.value)
  previewIframeRef.value.contentWindow.postMessage(
    {
      type: SALESBOOST_MESSAGE_TYPE_EMBED_TOKEN_REFRESHED,
      hostApp: SALESBOOST_HOST_APP,
      token: embed.token,
      expiresAt: embed.expiresAt,
      coursewareId: embed.coursewareId,
      classroomId: embed.classroomId
    },
    previewOrigin.value
  )
}

const handlePublishPreviewCourseware = async () => {
  if (!previewCoursewareId.value || coursewarePublishing.value) {
    return
  }

  coursewarePublishing.value = true
  try {
    await CoursewareApi.publishCourseware(previewCoursewareId.value)
    previewCoursewareStatus.value = COURSEWARE_PUBLISHED_STATUS
    message.success(t('coursewareCreate.publishSuccess'))
  } catch (error) {
    message.error(
      error instanceof Error && error.message ? error.message : t('coursewareCreate.publishFailed')
    )
  } finally {
    coursewarePublishing.value = false
  }
}

const handlePreviewMessage = async (event: MessageEvent) => {
  if (!previewOrigin.value || event.origin !== previewOrigin.value) {
    return
  }

  const payload = event.data
  if (!payload || typeof payload !== 'object') {
    return
  }

  if (payload.hostApp !== SALESBOOST_HOST_APP) {
    return
  }

  if (isMicrophonePermissionRequestMessage(payload)) {
    handleMicrophonePermissionRequest(event, payload)
    return
  }

  if (payload.type === SALESBOOST_MESSAGE_TYPE_READY) {
    postSalesboostLocale()
    return
  }

  if (payload.type === SALESBOOST_MESSAGE_TYPE_REFRESH_EMBED_TOKEN) {
    await refreshSalesboostEmbedToken()
    return
  }

  if (payload.type === SALESBOOST_MESSAGE_TYPE_NAVIGATE_BACK) {
    await handleEmbeddedBackReset()
  }
}

onMounted(async () => {
  window.addEventListener('message', handlePreviewMessage)
  cleanupMicrophonePermissionResultHandlers = installMicrophonePermissionResultHandlers()
  pageInitializing.value = hasPreviewRouteQuery.value
  try {
    catalogLoading.value = true
    const [, options] = await Promise.all([
      loadFileCapabilities(),
      CoursewareApi.getCatalogOptions()
    ])
    catalogOptions.value = options
    refreshRecoverableUploadTasks()
    await openActiveTask()
  } finally {
    catalogLoading.value = false
    pageInitializing.value = false
  }
})

onBeforeUnmount(() => {
  cancelActiveUploads()
  window.removeEventListener('message', handlePreviewMessage)
  cleanupMicrophonePermissionResultHandlers?.()
  pendingMicrophonePermissionRequests.forEach((pending) => window.clearTimeout(pending.timeoutId))
  pendingMicrophonePermissionRequests.clear()
})
</script>

<style scoped>
.studio-entry-identity {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 12px;
  margin-top: 4px;
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
.studio-entry-identity__catalog :deep(.el-select) {
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

.courseware-upload-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  box-sizing: border-box;
  color: #3f3a3d;
  font-size: 13px;
}
.courseware-upload-item__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 44px;
  border-radius: 10px;
  color: #b25d49;
  background: #fff1e9;
}
.courseware-upload-item__body {
  min-width: 0;
  text-align: left;
}
.courseware-upload-item__heading,
.courseware-upload-item__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.courseware-upload-item__type {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1ece8;
  color: #766f73;
  font-size: 10px;
  text-transform: uppercase;
}
.courseware-upload-item__actions :deep(.el-button) {
  min-height: 32px;
  margin-left: 0;
}
@media (max-width: 480px) {
  .courseware-upload-item {
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 8px;
    padding: 8px;
  }
  .courseware-upload-item__icon {
    width: 32px;
    height: 38px;
  }
  .courseware-upload-item__actions {
    grid-column: 2;
    justify-content: flex-end;
  }
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
  margin-bottom: 0;
}
.studio-entry-types {
  margin: 12px 0 10px;
}
.studio-entry-type-chip {
  min-height: 40px;
  padding: 8px 10px;
  font-size: 12px;
}
.studio-entry-file-label {
  margin-top: 16px;
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
