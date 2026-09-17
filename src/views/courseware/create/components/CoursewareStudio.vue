<template>
  <section
    class="studio"
    :class="{
      'studio--interview': waitingForUser,
      'studio--review': waitingForConfirmation,
      'studio--running': !waitingForUser && !waitingForConfirmation && !failed
    }"
    :aria-label="s('title')"
    @keydown="handleKeydown"
  >
    <header class="studio__header">
      <div class="studio__header-left">
        <div class="studio__identity">
          <span class="studio__identity-icon">
            <Icon icon="lucide:sparkles" :size="17" />
          </span>
          <div class="studio__identity-info">
            <strong class="studio__brand-title">{{ s('title') }}</strong>
            <span v-if="currentCourseTitle" class="studio__topic-pill" :title="currentCourseTitle">
              <Icon icon="lucide:bookmark" :size="12" />
              <span class="studio__topic-text">{{ currentCourseTitle }}</span>
            </span>
          </div>
        </div>
      </div>
      <ol class="studio__steps" :aria-label="s('progress')">
        <li
          v-for="(label, index) in stages"
          :key="label"
          class="studio__step-item"
          :class="{ active: index === stage, complete: index < stage }"
          :aria-current="index === stage ? 'step' : undefined"
        >
          <span class="studio__step-badge">
            <Icon v-if="index < stage" icon="lucide:check" :size="12" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="studio__step-label">{{ label }}</span>
          <span
            v-if="index < stages.length - 1"
            class="studio__step-divider"
            aria-hidden="true"
          ></span>
        </li>
      </ol>
      <div class="studio__header-right">
        <span
          class="studio__saved"
          :class="{ 'is-busy': busy }"
          :title="task?.id ? s('saved') : s('connecting')"
        >
          <Icon v-if="busy" icon="lucide:loader-circle" class="studio__spin" :size="13" />
          <Icon v-else icon="lucide:cloud-check" :size="14" />
          <span>{{ busy ? s('saving') : task?.id ? s('saved') : s('connecting') }}</span>
        </span>
        <span v-if="stageLabel" class="studio__stage-tag">
          {{ stageLabel }}
        </span>
      </div>
    </header>
    <div class="studio__mobile-tabs" role="tablist" :aria-label="s('workspace')">
      <button
        role="tab"
        :aria-selected="mobileTab === 'chat'"
        :class="{ active: mobileTab === 'chat' }"
        @click="mobileTab = 'chat'"
      >
        <Icon icon="lucide:message-square" :size="14" />
        <span>{{ s('conversation') }}</span>
      </button>
      <button
        role="tab"
        :aria-selected="mobileTab === 'draft'"
        :class="{ active: mobileTab === 'draft' }"
        @click="mobileTab = 'draft'"
      >
        <Icon icon="lucide:notebook-pen" :size="14" />
        <span>{{
          planningOutline ? s('courseSummary') : draft.outlines.length ? s('outline') : s('draft')
        }}</span>
        <span v-if="draft.outlines.length" class="studio__mobile-badge">{{
          draft.outlines.length
        }}</span>
      </button>
    </div>
    <Transition name="studio-stage" mode="out-in" @after-enter="followConversation">
      <div v-if="busy && !task" key="loading" class="studio__body" aria-busy="true">
        <div v-for="side in 2" :key="side" class="studio__stage-loading" role="status">
          <Icon icon="lucide:loader-circle" class="studio__spin" :size="24" />
          <span>{{ s('connecting') }}</span>
        </div>
      </div>
      <div v-else key="workspace" class="studio__body" :aria-busy="busy">
        <div
          class="studio__conversation"
          :class="{ 'mobile-hidden': mobileTab !== 'chat', 'is-swapped': panelsSwapped }"
        >
          <div class="studio__coach-bar">
            <button class="studio__text-button studio__end-session" @click="$emit('cancel')">
              <Icon :icon="failed ? 'lucide:arrow-left' : 'lucide:x'" :size="13" />
              {{ failed ? s('back') : s('endSession') }}
            </button>
            <div class="studio__coach-profile">
              <div class="studio__coach-avatar">
                <Icon icon="lucide:sparkles" :size="15" />
              </div>
              <div class="studio__coach-meta">
                <span class="studio__coach-name">{{ s('coachRole') }}</span>
                <span class="studio__coach-status">
                  <span class="studio__pulse-dot"></span>
                  {{ s('coachStatus') }}
                </span>
              </div>
            </div>
            <div v-if="waitingForUser" class="studio__round-pill">
              <span>{{
                s('interviewRound', { count: task?.promptEnhancement?.clarificationRound || 1 })
              }}</span>
            </div>
          </div>
          <p v-if="connectionInterrupted" class="studio__connection-notice" role="status">
            <Icon icon="lucide:wifi-off" :size="16" />
            {{ s('connectionInterrupted') }}
          </p>
          <div
            ref="conversationRef"
            class="studio__thread"
            @scroll.passive="trackConversationScroll"
          >
            <div class="studio__history">
              <div v-if="sourcePrompt" class="studio__user-bubble-wrap">
                <div class="studio__user-avatar">
                  <Icon icon="lucide:user" :size="13" />
                </div>
                <div class="studio__user-message">{{ sourcePrompt }}</div>
              </div>
              <div v-for="(round, index) in history" :key="index" class="studio__round">
                <div class="studio__coach-bubble-wrap">
                  <div class="studio__bubble-avatar">
                    <Icon icon="lucide:sparkles" :size="13" />
                  </div>
                  <div class="studio__bubble-content">
                    <div class="studio__speaker">
                      <span>{{ s('coachRole') }}</span>
                      <span class="studio__round-tag">{{
                        s('interviewRound', { count: index + 1 })
                      }}</span>
                    </div>
                    <p v-if="round.message" class="studio__message">{{ round.message }}</p>
                    <div
                      v-for="question in round.questions"
                      :key="question.id"
                      class="studio__history-qa"
                    >
                      <div class="studio__history-question">
                        <Icon icon="lucide:help-circle" :size="14" class="studio__history-icon" />
                        <span>{{ question.question }}</span>
                      </div>
                      <div
                        v-if="round.answers.find((answer) => answer.questionId === question.id)"
                        class="studio__user-bubble-wrap studio__user-bubble-wrap--history"
                      >
                        <div class="studio__user-avatar">
                          <Icon icon="lucide:user" :size="13" />
                        </div>
                        <div class="studio__user-message">
                          <span>{{
                            answerText(
                              question,
                              round.answers.find((answer) => answer.questionId === question.id)!
                                .value
                            )
                          }}</span>
                          <p
                            v-if="
                              round.answers.find((answer) => answer.questionId === question.id)
                                ?.note
                            "
                            class="studio__history-note"
                          >
                            <Icon icon="lucide:info" :size="12" />
                            {{
                              round.answers.find((answer) => answer.questionId === question.id)
                                ?.note
                            }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div :key="key" class="studio__current" :aria-busy="busy">
              <template v-if="waitingForUser">
                <div class="studio__coach-bubble-wrap">
                  <div class="studio__bubble-avatar">
                    <Icon icon="lucide:sparkles" :size="13" />
                  </div>
                  <div class="studio__bubble-content">
                    <div class="studio__speaker">
                      <span>{{ s('coachRole') }}</span>
                    </div>
                    <p class="studio__message">{{
                      task?.promptEnhancement?.message || s('interviewIntro')
                    }}</p>
                  </div>
                </div>
                <form id="studio-answer" class="studio__form" @submit.prevent="submitAnswers">
                  <fieldset
                    v-for="question in questions"
                    :key="question.id"
                    :disabled="busy"
                    class="studio__question"
                    :aria-labelledby="`studio-question-${question.id}`"
                  >
                    <div class="studio__question-card">
                      <div class="studio__question-header">
                        <span class="studio__question-badge">
                          <Icon icon="lucide:help-circle" :size="15" />
                        </span>
                        <h3 :id="`studio-question-${question.id}`" class="studio__question-title">{{
                          question.question
                        }}</h3>
                      </div>
                      <div v-if="question.reason" class="studio__why">
                        <Icon icon="lucide:lightbulb" :size="14" class="studio__why-icon" />
                        <div class="studio__why-content">
                          <strong>{{ s('rationaleLabel') }}:</strong>
                          <span>{{ question.reason }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="studio__options">
                      <label
                        v-for="option in question.options?.filter((item) => item.id !== 'none')"
                        :key="option.id"
                        class="studio__option"
                        :class="{ selected: draft.answers[question.id] === option.id }"
                      >
                        <input
                          v-model="draft.answers[question.id]"
                          type="radio"
                          :name="question.id"
                          :value="option.id"
                        />
                        <span class="studio__option-body">
                          <strong>{{ option.label }}</strong>
                          <small>{{ option.description || question.reason || option.label }}</small>
                        </span>
                        <em
                          v-if="recommendedQuestionAnswer(question) === option.id"
                          class="studio__recommended-badge"
                        >
                          <Icon icon="lucide:star" :size="11" />
                          {{ s('recommended') }}
                        </em>
                      </label>
                      <label
                        v-if="question.allowCustom || !question.options?.length"
                        class="studio__option"
                        :class="{ selected: draft.answers[question.id] === NONE_ANSWER }"
                      >
                        <input
                          v-model="draft.answers[question.id]"
                          type="radio"
                          :name="question.id"
                          :value="NONE_ANSWER"
                        />
                        <span class="studio__option-body">
                          <strong>{{
                            question.options?.some((item) => item.id === 'none')
                              ? s('ownAnswer')
                              : 'None'
                          }}</strong>
                          <small>{{ s('answerPlaceholder') }}</small>
                        </span>
                      </label>
                      <label
                        v-for="option in question.options?.filter((item) => item.id === 'none')"
                        :key="option.id"
                        class="studio__option"
                        :class="{ selected: draft.answers[question.id] === option.id }"
                      >
                        <input
                          v-model="draft.answers[question.id]"
                          type="radio"
                          :name="question.id"
                          :value="option.id"
                        />
                        <span class="studio__option-body">
                          <strong>{{ option.label }}</strong>
                          <small>{{ option.description || s('recommended') }}</small>
                        </span>
                      </label>
                    </div>
                    <label
                      v-if="draft.answers[question.id] === NONE_ANSWER"
                      class="studio__input-label"
                    >
                      <span class="studio__input-title">
                        <Icon icon="lucide:pen-line" :size="13" />
                        {{ s('ownAnswer') }}
                      </span>
                      <textarea
                        v-auto-size
                        v-model="draft.customAnswers[question.id]"
                        rows="3"
                        maxlength="4000"
                        :placeholder="s('answerPlaceholder')"
                      ></textarea>
                    </label>
                    <details
                      v-if="
                        draft.answers[question.id] && draft.answers[question.id] !== NONE_ANSWER
                      "
                      class="studio__note"
                    >
                      <summary>
                        <Icon icon="lucide:plus" :size="13" />
                        <span>{{ s('addDetail') }}</span>
                      </summary>
                      <textarea
                        v-auto-size
                        v-model="draft.notes[question.id]"
                        rows="2"
                        maxlength="4000"
                        :aria-label="s('addDetail')"
                        :placeholder="s('detailPlaceholder')"
                      ></textarea>
                    </details>
                  </fieldset>
                </form>
              </template>
            </div>
          </div>
          <div v-if="!waitingForUser" class="studio__status-dock">
            <template v-if="waitingForConfirmation">
              <div class="studio__working-card studio__milestone-card">
                <div class="studio__living-orb">
                  <Icon icon="lucide:layout-template" :size="24" />
                </div>
                <div class="studio__working">
                  <h3>{{ reviewingOutline ? s('outlineReady') : s('briefReady') }}</h3>
                  <p class="studio__message">{{
                    reviewingOutline ? s('outlineReadyHint') : s('briefReadyHint')
                  }}</p>

                  <div class="studio__checkpoint">
                    <Icon icon="lucide:shield-check" :size="17" />
                    <span>{{
                      reviewingOutline ? s('outlineCheckpoint') : s('briefCheckpoint')
                    }}</span>
                  </div>

                  <button
                    class="studio__text-button studio__show-draft"
                    @click="mobileTab = 'draft'"
                  >
                    <span>{{ s('reviewDraft') }}</span>
                    <Icon icon="lucide:arrow-right" :size="14" />
                  </button>
                </div>
              </div>
            </template>
            <template v-else-if="failed">
              <div class="studio__error-card">
                <div class="studio__error-icon">
                  <Icon icon="lucide:circle-alert" :size="24" />
                </div>
                <div class="studio__error-body">
                  <h2>{{ statusTitle }}</h2>
                  <p class="studio__message" role="alert">{{
                    task?.homeworkGenerationMessage || task?.errorMessage || statusDescription
                  }}</p>
                  <button
                    v-if="canRetryHomework"
                    class="studio__primary mt-4"
                    @click="$emit('retry-homework')"
                  >
                    <Icon icon="lucide:rotate-cw" :size="15" />
                    {{ s('retryHomework') }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="studio__working-card">
                <div class="studio__living-orb">
                  <div class="studio__orb-pulse"></div>
                  <Icon icon="lucide:sparkles" class="studio__spin-slow" :size="22" />
                </div>
                <div class="studio__working" role="status">
                  <h3>{{
                    task?.generation ? generationPhaseTitle : statusTitle || s('understanding')
                  }}</h3>
                </div>
                <p class="studio__message">{{
                  task?.generation
                    ? generationPhaseHint
                    : statusDescription || s('understandingHint')
                }}</p>
                <p v-if="task?.generation?.retry?.retrying" class="studio__why" role="status">
                  {{ s('autoRetry', { count: task.generation.retry.count }) }}
                </p>
                <div v-if="sourcePreparationPending" class="studio__source-notice">
                  <Icon icon="lucide:file-search" :size="15" />
                  <p class="studio__why">{{ s('readingSources') }}</p>
                </div>
                <div v-if="stage === 3" class="studio__progress-layout">
                  <div class="studio__production">
                    <div class="studio__production-header">
                      <span>{{ s('productionProgress') }}</span>
                      <strong>{{ progress }}%</strong>
                    </div>
                    <progress
                      class="studio__progress"
                      :value="progress"
                      max="100"
                      :aria-label="s('productionProgress')"
                    ></progress>
                    <p class="studio__leave-hint">
                      <Icon icon="lucide:info" :size="13" />
                      {{ s('leaveHint') }}
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div v-if="waitingForUser" class="studio__composer">
            <Transition name="studio-fade">
              <p v-if="validationError && waitingForUser" class="studio__error" role="alert">
                <Icon icon="lucide:alert-circle" :size="14" />
                <span>{{ validationError }}</span>
              </p>
            </Transition>
            <div class="studio__composer-actions">
              <span v-if="waitingForUser" class="studio__shortcut-hint">
                {{ s('shortcutSend') }}
              </span>

              <button
                v-if="waitingForUser"
                type="submit"
                form="studio-answer"
                class="studio__primary"
                :disabled="busy || !answersComplete"
              >
                <span v-if="busy" class="studio__button-busy"
                  ><Icon icon="lucide:loader-circle" class="studio__spin" :size="15" />{{
                    s('saving')
                  }}</span
                >
                <template v-else>
                  <span>{{ s('continue') }}</span>
                  <Icon icon="lucide:arrow-up" :size="15" />
                </template>
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="studio__swap-panels"
          :aria-label="s('swapPanels')"
          :title="s('swapPanels')"
          @click="togglePanelsSwapped"
        >
          <Icon icon="lucide:arrow-left-right" :size="16" />
        </button>
        <aside
          class="studio__draft"
          :class="{ 'mobile-hidden': mobileTab !== 'draft', 'is-swapped': panelsSwapped }"
          :aria-label="s('draft')"
        >
          <header class="studio__draft-header">
            <div v-if="showGeneratedPages" class="studio__generated-header">
              <nav class="studio__part-tabs" :aria-label="s('generatedPages')">
                <button
                  v-for="part in generationParts"
                  :key="part.partIndex"
                  type="button"
                  :class="{ 'is-active': part.partIndex === activePart?.partIndex }"
                  :aria-pressed="part.partIndex === activePart?.partIndex"
                  :title="part.title"
                  @click="selectPart(part.partIndex)"
                >
                  <Icon icon="lucide:presentation" :size="15" />
                  <span>PPT {{ part.partIndex }}</span>
                </button>
              </nav>
              <div
                v-if="activePart && generationParts.length > 1"
                class="studio__part-progress"
                aria-live="polite"
                :aria-label="`${activePart.title} ${activePart.progress}%`"
              >
                <div class="studio__part-progress-label">
                  <span>{{ activePart.title }}</span>
                  <strong>{{ activePart.progress }}%</strong>
                </div>
                <progress
                  :value="activePart.progress"
                  max="100"
                  :aria-label="`${activePart.title} ${activePart.progress}%`"
                ></progress>
                <small v-if="activePart.state">{{ s(`partStates.${activePart.state}`) }}</small>
              </div>
            </div>
            <div v-else>
              <span class="studio__draft-icon">
                <Icon
                  :icon="draft.outlines.length ? 'lucide:layout-list' : 'lucide:notebook-pen'"
                  :size="16"
                />
              </span>
              <h2>{{
                planningOutline
                  ? s('courseSummary')
                  : draft.outlines.length
                    ? s('outline')
                    : s('draft')
              }}</h2>
            </div>
            <span
              v-if="!showGeneratedPages"
              class="studio__canvas-badge"
              :class="{ 'is-editable': canEditReview }"
            >
              {{ canEditReview ? s('editable') : s('fromConversation') }}
            </span>
          </header>
          <div ref="documentRef" class="studio__document">
            <section v-if="summary && !showGeneratedPages" class="studio__brief-summary">
              <div class="studio__brief-header">
                <h3>{{ s('courseSummary') }}</h3>
                <button
                  v-if="canEditReview"
                  type="button"
                  class="studio__text-button studio__edit-brief"
                  :aria-label="s(editingBrief ? 'finishEditing' : 'editSection')"
                  @click="editingBrief = !editingBrief"
                >
                  <Icon :icon="editingBrief ? 'lucide:check' : 'lucide:pencil'" :size="14" />
                </button>
              </div>
              <dl v-if="!editingBrief || !canEditReview" class="studio__brief-values">
                <template v-for="field in briefFields" :key="field.label">
                  <dt>{{ field.label }}</dt
                  ><dd>{{ field.value || '—' }}</dd>
                </template>
              </dl>
            </section>
            <div
              v-if="showGeneratedPages"
              :key="`part-${activePart?.partIndex || 0}`"
              class="studio__generated-pages"
              :class="{
                'is-page-turning-next': partSwitchDirection === 'next',
                'is-page-turning-previous': partSwitchDirection === 'previous'
              }"
              aria-live="polite"
            >
              <h3>{{ activePart?.title }}</h3>
              <p class="studio__part-summary">{{
                s('completedPages', {
                  completed: activePages.filter((page) => page.status === 'completed').length,
                  total: activePages.length
                })
              }}</p>
              <article v-for="page in activePages" :key="page.id" class="studio__page">
                <div class="studio__generated-page-heading">
                  <strong>{{ page.partIndex }}.{{ page.order }} · {{ page.title }}</strong>
                  <div class="studio__page-heading-actions">
                    <span
                      v-if="page.status !== 'completed'"
                      :class="['studio__page-status', `is-${page.status}`]"
                      >{{ s(`pageStates.${page.status}`) }}</span
                    >
                    <button
                      v-if="page.status === 'completed'"
                      class="studio__text-button studio__preview-link"
                      :aria-label="`${s('previewPage')}: ${page.title}`"
                      @click="openPagePreview(page)"
                    >
                      <Icon icon="lucide:eye" :size="15" /> {{ s('previewPage') }}
                    </button>
                  </div>
                </div>
                <p v-if="page.summary" class="studio__page-readonly-desc">{{ page.summary }}</p>
                <p v-if="page.retryCount" class="studio__why">{{
                  s('autoRetry', { count: page.retryCount })
                }}</p>
                <p v-if="page.mediaPending && !failed" class="studio__why">{{
                  s('mediaPending')
                }}</p>
                <p v-if="page.error" class="studio__series-error" role="alert">{{ page.error }}</p>
              </article>
              <article
                v-if="task?.generateHomeworkSync && !activePartHasQuizPage"
                class="studio__page studio__quiz-card"
              >
                <div class="studio__generated-page-heading">
                  <strong
                    ><Icon icon="lucide:clipboard-check" :size="16" />
                    {{ s('quizCardTitle') }}</strong
                  >
                  <span class="studio__page-status" :class="`is-${quizCardStatus}`">{{
                    quizCardStatusLabel
                  }}</span>
                </div>
                <p class="studio__page-readonly-desc">{{ quizCardHint }}</p>
              </article>
            </div>
            <template v-else-if="draft.outlines.length">
              <div class="studio__document-title">
                <div class="studio__doc-headline">
                  <Icon icon="lucide:presentation" :size="18" class="text-[#b25d49]" />
                  <h3>{{ draft.brief.title || task?.title }}</h3>
                </div>
                <p>{{
                  s(planningOutline ? 'sectionCount' : 'pageCount', {
                    count: draft.outlines.length
                  })
                }}</p>
              </div>
              <details
                v-if="canEditReview && editingBrief"
                open
                class="studio__page studio__planning-goals"
              >
                <summary>{{ s('courseGoals') }}</summary>
                <div class="studio__page-content">
                  <label class="studio__input-label">
                    <span>{{ s('courseTitle') }}</span>
                    <input v-model="draft.brief.title" maxlength="200" :disabled="busy" />
                  </label>
                  <label class="studio__input-label">
                    <span>{{ s('audience') }}</span>
                    <input v-model="draft.brief.audience" maxlength="1000" :disabled="busy" />
                  </label>
                  <label class="studio__input-label">
                    <span>{{ s('objective') }}</span>
                    <textarea
                      v-auto-size
                      v-model="draft.brief.objective"
                      rows="3"
                      maxlength="4000"
                      :disabled="busy"
                    ></textarea>
                  </label>
                  <label class="studio__input-label">
                    <span>{{ s('scope') }}</span>
                    <textarea
                      v-auto-size
                      :value="draft.brief.mustInclude.join('\n')"
                      rows="5"
                      :disabled="busy"
                      @input="
                        draft.brief.mustInclude = (
                          $event.target as HTMLTextAreaElement
                        ).value.split('\n')
                      "
                    ></textarea>
                  </label>

                  <div v-if="summary?.assumptions?.length" class="studio__assumptions">
                    <h4>
                      <Icon icon="lucide:help-circle" :size="13" />
                      {{ s('assumptions') }}
                    </h4>
                    <p v-for="item in summary?.assumptions" :key="item">{{ item }}</p>
                  </div>
                </div>
              </details>
              <div v-for="part in outlineParts" :key="part.partIndex" class="studio__part">
                <label
                  v-if="(task?.partSelection?.parts.length || 0) > 1"
                  class="studio__part-title"
                >
                  <input
                    v-if="reviewingOutline && canEditReview"
                    v-model="draft.selectedPartIndexes"
                    type="checkbox"
                    :value="part.partIndex"
                    :disabled="busy"
                  />
                  <Icon icon="lucide:layers" :size="14" class="text-[#b25d49]" />
                  <strong>{{ part.title }}</strong>
                  <span class="studio__part-count-badge">{{
                    s('slideCountBadge', { count: part.outlines?.length || 0 })
                  }}</span>
                </label>
                <details
                  v-for="outline in part.outlines || []"
                  :key="outline.id"
                  :open="planningOutline"
                  class="studio__page"
                  :class="{
                    excluded:
                      reviewingOutline && !draft.selectedPartIndexes.includes(part.partIndex)
                  }"
                >
                  <summary>
                    <span class="studio__page-number">{{ pageIndex(outline.id) + 1 }}</span>
                    <div class="studio__page-summary">
                      <strong>{{ draft.outlines[pageIndex(outline.id)]?.title }}</strong>
                      <div class="studio__page-meta">
                        <small
                          v-if="!planningOutline"
                          class="studio__type-badge"
                          :data-type="outline.type"
                        >
                          {{ s(`types.${outline.type}`) }}
                        </small>
                        <span v-if="outline.description" class="studio__page-desc-snippet">
                          {{ draft.outlines[pageIndex(outline.id)]?.description }}
                        </span>
                      </div>
                    </div>
                    <Icon icon="lucide:chevron-down" class="studio__chevron" :size="15" />
                  </summary>
                  <div v-if="draft.outlines[pageIndex(outline.id)]" class="studio__page-content">
                    <div v-if="canEditReview" class="studio__section-actions">
                      <button
                        type="button"
                        class="studio__text-button"
                        :disabled="busy"
                        @click="editingSection = editingSection === outline.id ? '' : outline.id"
                      >
                        <Icon
                          :icon="editingSection === outline.id ? 'lucide:check' : 'lucide:pencil'"
                          :size="13"
                        />
                        {{ s(editingSection === outline.id ? 'finishEditing' : 'editSection') }}
                      </button>
                    </div>
                    <template v-if="canEditReview && editingSection === outline.id">
                      <label class="studio__input-label">
                        <span>{{ s(planningOutline ? 'sectionTitle' : 'pageTitle') }}</span>
                        <input
                          v-model="draft.outlines[pageIndex(outline.id)].title"
                          maxlength="200"
                          :disabled="busy"
                        />
                      </label>
                      <label class="studio__input-label">
                        <span>{{ s(planningOutline ? 'sectionPurpose' : 'pagePurpose') }}</span>
                        <textarea
                          v-auto-size
                          v-model="draft.outlines[pageIndex(outline.id)].description"
                          rows="1"
                          maxlength="4000"
                          :disabled="busy"
                        ></textarea>
                      </label>
                      <label class="studio__input-label">
                        <span>{{ s('keyPoints') }}</span>
                        <textarea
                          v-auto-size
                          :value="draft.outlines[pageIndex(outline.id)].keyPoints.join('\n')"
                          rows="4"
                          :disabled="busy"
                          @input="
                            draft.outlines[pageIndex(outline.id)].keyPoints = (
                              $event.target as HTMLTextAreaElement
                            ).value.split('\n')
                          "
                        ></textarea>
                      </label>
                    </template>
                    <template v-else>
                      <p class="studio__page-readonly-desc">{{
                        draft.outlines[pageIndex(outline.id)].description
                      }}</p>
                      <ul class="studio__page-readonly-points">
                        <li
                          v-for="(point, index) in draft.outlines[pageIndex(outline.id)].keyPoints"
                          :key="index"
                          >{{ point }}</li
                        >
                      </ul>
                    </template>
                  </div>
                </details>
              </div>
            </template>
            <template v-else-if="summary">
              <template v-if="canEditReview && editingBrief">
                <div class="studio__brief-header">
                  <Icon icon="lucide:file-signature" :size="17" class="text-[#b25d49]" />
                  <p class="studio__document-note">{{ s('editBriefHint') }}</p>
                </div>
                <label class="studio__input-label">
                  <span>{{ s('courseTitle') }}</span>
                  <input v-model="draft.brief.title" maxlength="200" :disabled="busy" />
                </label>
                <label class="studio__input-label">
                  <span>{{ s('audience') }}</span>
                  <input v-model="draft.brief.audience" maxlength="1000" :disabled="busy" />
                </label>
                <label class="studio__input-label">
                  <span>{{ s('objective') }}</span>
                  <textarea
                    v-auto-size
                    v-model="draft.brief.objective"
                    rows="3"
                    maxlength="4000"
                    :disabled="busy"
                  ></textarea>
                </label>
                <label class="studio__input-label">
                  <span>{{ s('scope') }}</span>
                  <textarea
                    v-auto-size
                    :value="draft.brief.mustInclude.join('\n')"
                    rows="5"
                    :disabled="busy"
                    @input="
                      draft.brief.mustInclude = ($event.target as HTMLTextAreaElement).value.split(
                        '\n'
                      )
                    "
                  ></textarea>
                </label>

                <div v-if="summary.assumptions?.length" class="studio__assumptions">
                  <h4>
                    <Icon icon="lucide:help-circle" :size="13" />
                    {{ s('assumptions') }}
                  </h4>
                  <p v-for="item in summary.assumptions" :key="item">{{ item }}</p>
                </div>
              </template>
            </template>
            <template v-else>
              <div class="studio__canvas-status">
                <span>{{ s('understoodContent') }}</span>
                <span>{{ s('insightsCount', { count: facts.length }) }}</span>
              </div>
              <div v-if="facts.length" class="studio__facts">
                <section
                  v-for="fact in facts"
                  :key="fact.key"
                  class="studio__fact-card"
                  :class="{ 'is-updated': updatedFactKeys.has(fact.key) }"
                >
                  <div class="studio__fact-header">
                    <Icon :icon="fact.icon" :size="14" class="studio__fact-icon" />
                    <h3>{{ fact.label }}</h3>
                    <span v-if="updatedFactKeys.has(fact.key)" class="studio__updated-pill">
                      {{ s('justUpdated') }}
                    </span>
                  </div>
                  <p>{{ fact.value }}</p>
                </section>
              </div>
              <div v-else class="studio__empty">
                <div class="studio__empty-hero">
                  <div class="studio__empty-icon-wrap">
                    <Icon icon="lucide:notebook-pen" :size="28" />
                  </div>
                  <h3>{{ s('emptyTitle') }}</h3>
                  <p>{{ s('emptyHint') }}</p>
                </div>

                <div class="studio__blueprint-cards">
                  <div class="studio__blueprint-card">
                    <div class="studio__blueprint-icon">
                      <Icon icon="lucide:target" :size="15" />
                    </div>
                    <div class="studio__blueprint-body">
                      <strong>{{ s('emptyCard1Title') }}</strong>
                      <small>{{ s('emptyCard1Desc') }}</small>
                    </div>
                  </div>
                  <div class="studio__blueprint-card">
                    <div class="studio__blueprint-icon">
                      <Icon icon="lucide:lightbulb" :size="15" />
                    </div>
                    <div class="studio__blueprint-body">
                      <strong>{{ s('emptyCard2Title') }}</strong>
                      <small>{{ s('emptyCard2Desc') }}</small>
                    </div>
                  </div>
                  <div class="studio__blueprint-card">
                    <div class="studio__blueprint-icon">
                      <Icon icon="lucide:layout-template" :size="15" />
                    </div>
                    <div class="studio__blueprint-body">
                      <strong>{{ s('emptyCard3Title') }}</strong>
                      <small>{{ s('emptyCard3Desc') }}</small>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="assumptions.length" class="studio__assumptions">
                <h4>
                  <Icon icon="lucide:help-circle" :size="13" />
                  {{ s('assumptions') }}
                </h4>
                <p v-for="item in assumptions" :key="item">{{ item }}</p>
              </div>
            </template>
            <section
              v-if="!showGeneratedPages && task?.series?.items?.length"
              class="studio__results"
            >
              <h3>{{ s('producing') }}</h3>
              <div
                v-for="item in task.series.items"
                :key="item.childJobId"
                class="studio__series-item"
              >
                <Icon
                  :icon="
                    partState(item) === 'FAILED'
                      ? 'lucide:circle-alert'
                      : partState(item) === 'SUCCEEDED'
                        ? 'lucide:circle-check'
                        : 'lucide:loader-circle'
                  "
                  :class="{
                    studio__spin: partState(item) === 'RUNNING',
                    'text-emerald-600': partState(item) === 'SUCCEEDED',
                    'text-rose-600': partState(item) === 'FAILED'
                  }"
                  :size="15"
                />
                <span>{{ item.title }}</span>
                <strong>{{ s(`partStates.${partState(item)}`) }}</strong>
                <p v-if="item.error" class="studio__series-error">{{ s('phaseHints.failed') }}</p>
              </div>
            </section>
          </div>
          <div v-if="waitingForConfirmation" class="studio__composer">
            <Transition name="studio-fade">
              <p
                v-if="validationError && waitingForConfirmation"
                class="studio__error"
                role="alert"
              >
                <Icon icon="lucide:alert-circle" :size="14" />
                <span>{{ validationError }}</span>
              </p>
            </Transition>
            <div class="studio__composer-actions studio__draft-actions">
              <span v-if="waitingForConfirmation" class="studio__confirmation-hint">
                <Icon icon="lucide:shield-check" :size="15" />
                {{ s('confirmationHint') }}
              </span>
              <button
                v-if="waitingForConfirmation"
                class="studio__primary"
                :disabled="busy || confirmationSubmitted"
                @click="confirm"
              >
                <span v-if="busy" class="studio__button-busy"
                  ><Icon icon="lucide:loader-circle" class="studio__spin" :size="15" />{{
                    s('saving')
                  }}</span
                >
                <template v-else>
                  <span>{{ reviewingOutline ? s('generateCourse') : s('generateOutline') }}</span>
                  <Icon icon="lucide:arrow-right" :size="15" />
                </template>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
    <el-dialog
      v-model="previewOpen"
      :title="previewTitle"
      class="studio-preview-dialog"
      width="min(1440px, calc(100vw - 32px))"
      align-center
      :show-close="true"
      append-to-body
      destroy-on-close
    >
      <div class="studio__preview-shell" :aria-busy="previewLoading">
        <nav class="studio__preview-toolbar" :aria-label="s('generatedPages')">
          <button
            type="button"
            class="studio__preview-nav"
            :disabled="previewPageIndex <= 0"
            :aria-label="s('previewPrevious')"
            @click="navigatePreview(-1)"
          >
            <Icon icon="lucide:chevron-left" :size="17" />
            <span>{{ s('previewPrevious') }}</span>
          </button>
          <span class="studio__preview-counter">
            {{ previewPageCount ? `${previewPageIndex + 1} / ${previewPageCount}` : '' }}
          </span>
          <button
            type="button"
            class="studio__preview-nav"
            :disabled="previewPageIndex < 0 || previewPageIndex >= previewPageCount - 1"
            :aria-label="s('previewNext')"
            @click="navigatePreview(1)"
          >
            <span>{{ s('previewNext') }}</span>
            <Icon icon="lucide:chevron-right" :size="17" />
          </button>
        </nav>
        <div class="studio__preview-content">
          <div v-if="previewLoading" class="studio__preview-status" role="status">
            <Icon icon="lucide:loader-circle" class="studio__spin" :size="32" />
            <span>{{ s('previewLoading') }}</span>
          </div>
          <div v-else-if="previewError" class="studio__preview-status" role="alert">
            {{ s('previewUnavailable') }}
          </div>
          <template v-else-if="preview">
            <p v-if="preview.mediaPending" class="studio__preview-notice">{{
              s('mediaPending')
            }}</p>
            <iframe
              :key="`${preview.pageId}:${preview.version}`"
              :srcdoc="preview.html"
              :title="previewTitle"
              sandbox="allow-scripts"
              class="studio__page-preview"
            ></iframe>
          </template>
        </div>
      </div>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { CoursewareGenerationTaskVO, CoursewareStudioConfirmation } from '@/api/courseware'
import {
  CoursewareApi,
  type CoursewareGenerationSeriesItemVO,
  type CoursewarePageStateVO,
  type CoursewarePagePreviewVO
} from '@/api/courseware'
import { useI18n } from '@/hooks/web/useI18n'
import {
  COURSEWARE_TASK_STATUS,
  resolveCoursewareTaskStage,
  resolveCoursewareTaskStatus,
  resolveCoursewareSeriesItemProgress,
  recommendedQuestionAnswer,
  NONE_ANSWER
} from '../generationTask'
import { answerText, createStudioDraft, studioDraftKey, type StudioDraft } from '../studioDraft'

const props = defineProps<{
  task?: CoursewareGenerationTaskVO | null
  sourcePrompt?: string
  busy: boolean
  confirmationFailureRevision?: number
  statusTitle: string
  statusDescription: string
  progress: number
  sourcePreparationPending?: boolean
  autoConfirm?: boolean
  connectionInterrupted?: boolean
  canRetryHomework?: boolean
}>()

const emit = defineEmits<{
  answer: [answers: Array<{ id: string; value: string; note?: string }>]
  confirm: [edits: CoursewareStudioConfirmation]
  cancel: []
  'retry-homework': []
}>()

const { t } = useI18n()
// 折叠区域展开、面板宽度改变时也重新测量，避免隐藏状态下测得 0 高度。
const textareaObservers = new WeakMap<HTMLTextAreaElement, ResizeObserver>()
const resizePurpose = (element: HTMLTextAreaElement) => {
  if (!element.getClientRects().length) return
  const style = getComputedStyle(element)
  const border =
    (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
  element.style.height = '0px'
  element.style.height = `${element.scrollHeight + border}px`
}
const vAutoSize = {
  mounted(element: HTMLTextAreaElement) {
    resizePurpose(element)
    element.addEventListener('input', handleTextareaInput)
    if (typeof ResizeObserver === 'undefined') return
    let previousWidth = -1
    const observer = new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width
      if (width === previousWidth) return
      previousWidth = width
      resizePurpose(element)
    })
    observer.observe(element)
    textareaObservers.set(element, observer)
  },
  updated: resizePurpose,
  beforeUnmount(element: HTMLTextAreaElement) {
    element.removeEventListener('input', handleTextareaInput)
    textareaObservers.get(element)?.disconnect()
    textareaObservers.delete(element)
  }
}
function handleTextareaInput(event: Event) {
  resizePurpose(event.target as HTMLTextAreaElement)
}
const s = (key: string, params: Record<string, unknown> = {}) => {
  const translated = t(`coursewareCreate.studio.${key}`, params)
  // 语言包热切换或未知阶段值不能把 i18n key 直接展示给用户。
  if (!translated.startsWith('coursewareCreate.studio.')) return translated
  const fallback: Record<string, string> = {
    'phases.reviewing_outline': '正在确认课程大纲',
    'phaseHints.reviewing_outline': '课程大纲已生成，请确认后继续制作课件',
    'phases.waiting_for_part_selection': '正在等待选择课件部分',
    'phaseHints.waiting_for_part_selection': '请选择要生成的课件部分',
    swapPanels: '交换左右面板',
    previewPrevious: '上一页',
    previewNext: '下一页',
    'quizStates.waiting': '待生成',
    'quizStates.generating': '生成中',
    'quizStates.completed': '已完成',
    'quizStates.failed': '生成失败',
    'quizHints.waiting': '全部课件页面完成后，将开始生成本课件的课后练习。',
    'quizHints.generating': '正在生成并整理本课件的课后练习。',
    'quizHints.completed': '课后练习已完成，正在更新预览页面。',
    'quizHints.failed': '课后练习生成失败，可重试生成练习。'
  }
  return fallback[key] || key.split('.').pop() || key
}

const status = computed(() => resolveCoursewareTaskStatus(props.task?.status))
const waitingForUser = computed(() => status.value === COURSEWARE_TASK_STATUS.WAITING_FOR_USER)
const waitingForConfirmation = computed(
  () => status.value === COURSEWARE_TASK_STATUS.WAITING_FOR_CONFIRMATION
)
const reviewingOutline = computed(
  () => waitingForConfirmation.value && props.task?.partSelection?.required === true
)
const failed = computed(() =>
  [COURSEWARE_TASK_STATUS.FAILED, COURSEWARE_TASK_STATUS.CANCELED].includes(status.value as never)
)
const panelsSwapped = ref(localStorage.getItem('courseware-studio-panels-swapped') === 'true')
const togglePanelsSwapped = () => {
  panelsSwapped.value = !panelsSwapped.value
  localStorage.setItem('courseware-studio-panels-swapped', String(panelsSwapped.value))
}
const previewOpen = ref(false)
const previewLoading = ref(false)
const previewError = ref(false)
const previewTitle = ref('')
const preview = ref<CoursewarePagePreviewVO>()
const selectedPageId = ref('')
let previewRequest = 0
let requestedPreviewVersion = -1
function resetPreview() {
  previewRequest += 1
  requestedPreviewVersion = -1
  selectedPageId.value = ''
  preview.value = undefined
  previewLoading.value = false
  previewError.value = false
}
function closePagePreview() {
  if (previewOpen.value) previewOpen.value = false
  else resetPreview()
}
async function openPagePreview(page: CoursewarePageStateVO) {
  const taskId = props.task?.id
  if (!taskId || failed.value || page.status !== 'completed') return
  const request = ++previewRequest
  requestedPreviewVersion = page.version
  selectedPageId.value = page.id
  previewTitle.value = page.title
  previewOpen.value = true
  previewLoading.value = true
  previewError.value = false
  preview.value = undefined
  const isCurrent = () =>
    request === previewRequest &&
    props.task?.id === taskId &&
    previewOpen.value &&
    selectedPageId.value === page.id &&
    !failed.value
  try {
    const result = await CoursewareApi.getGenerationPagePreview(taskId, page.id)
    if (!isCurrent()) return
    requestedPreviewVersion = Math.max(requestedPreviewVersion, result.version)
    preview.value = result
  } catch {
    if (isCurrent()) previewError.value = true
  } finally {
    if (isCurrent()) previewLoading.value = false
  }
}
watch([() => props.task?.id, failed], closePagePreview)
watch(
  previewOpen,
  (open) => {
    if (!open) resetPreview()
  },
  { flush: 'sync' }
)
watch(
  () => props.task?.generation?.pages.find((page) => page.id === selectedPageId.value),
  (page) => {
    if (!previewOpen.value) return
    if (!page || page.status !== 'completed') {
      closePagePreview()
      return
    }
    // 在请求途中收到更新也要换新版本；切页本身及轮询心跳不能重复发起请求。
    if (page.version > requestedPreviewVersion) void openPagePreview(page)
  },
  { deep: true }
)
const questions = computed(() => props.task?.promptEnhancement?.questions || [])
const history = computed(() => props.task?.promptEnhancement?.history || [])
const summary = computed(() => props.task?.promptEnhancement?.summary)
const assumptions = computed(() => props.task?.promptEnhancement?.assumptions || [])

const planningOutline = computed(
  () => Boolean(summary.value?.planningOutline?.length) && !props.task?.partSelection?.parts.length
)
const showGeneratedPages = computed(
  () => !waitingForConfirmation.value && Boolean(props.task?.generation?.pages.length)
)
const selectedPartIndex = ref<number>()
const documentRef = ref<HTMLElement>()
const partSwitchDirection = ref<'next' | 'previous'>()
const partState = (
  item: Pick<CoursewareGenerationSeriesItemVO, 'status' | 'homeworkGenerationStatus' | 'error'>
) => {
  const resolved = resolveCoursewareTaskStatus(item.status)
  const homework = item.homeworkGenerationStatus?.toLowerCase()
  if (homework === 'failed' || homework === 'canceled') return 'FAILED'
  if (item.error || resolved === COURSEWARE_TASK_STATUS.FAILED) return 'FAILED'
  if (resolved === COURSEWARE_TASK_STATUS.CANCELED || failed.value) return 'CANCELED'
  if (resolved === COURSEWARE_TASK_STATUS.QUEUED) return 'QUEUED'
  if (props.task?.generateHomeworkSync && homework !== 'imported') return 'RUNNING'
  return resolved === COURSEWARE_TASK_STATUS.SUCCEEDED ? 'SUCCEEDED' : 'RUNNING'
}
const seriesItemProgress = (item: CoursewareGenerationSeriesItemVO) =>
  resolveCoursewareSeriesItemProgress(item, props.task?.generateHomeworkSync)
const generationParts = computed(() => {
  const pages = props.task?.generation?.pages || []
  const items = props.task?.series?.items || []
  const indexes = [
    ...new Set([...items.map((item) => item.partIndex), ...pages.map((page) => page.partIndex)])
  ].sort((a, b) => a - b)
  return indexes.map((partIndex) => {
    const item = items.find((candidate) => candidate.partIndex === partIndex)
    const pagesForPart = pages.filter((page) => page.partIndex === partIndex)
    const pageProgress = pagesForPart.length
      ? Math.round(
          (pagesForPart.filter((page) => page.status === 'completed').length /
            pagesForPart.length) *
            100
        )
      : 0
    return {
      partIndex,
      title:
        item?.title ||
        props.task?.partSelection?.parts.find((part) => part.partIndex === partIndex)?.title ||
        `PPT ${partIndex}`,
      progress: item
        ? seriesItemProgress(item)
        : Math.max(
            0,
            Math.min(
              props.task?.done && !failed.value ? 100 : 99,
              props.task?.series ? pageProgress : Math.round(props.progress)
            )
          ),
      state: item ? partState(item) : props.task?.series ? undefined : partState(props.task!)
    }
  })
})
const activePart = computed(
  () =>
    generationParts.value.find((part) => part.partIndex === selectedPartIndex.value) ||
    generationParts.value[0]
)
const activePages = computed(() =>
  (props.task?.generation?.pages || [])
    .filter((page) => page.partIndex === activePart.value?.partIndex)
    .sort((a, b) => a.order - b.order)
)
const previewPages = computed(() => activePages.value.filter((page) => page.status === 'completed'))
const previewPageIndex = computed(() =>
  previewPages.value.findIndex((page) => page.id === selectedPageId.value)
)
const previewPageCount = computed(() => previewPages.value.length)
const selectPart = async (partIndex: number) => {
  if (partIndex === activePart.value?.partIndex) return
  partSwitchDirection.value = partIndex > (activePart.value?.partIndex || 0) ? 'next' : 'previous'
  selectedPartIndex.value = partIndex
  closePagePreview()
  await nextTick()
  if (selectedPartIndex.value === partIndex)
    documentRef.value?.scrollTo({ top: 0, behavior: 'auto' })
}
const navigatePreview = (direction: -1 | 1) => {
  if (!previewOpen.value || previewPageIndex.value < 0) return
  const target = previewPages.value[previewPageIndex.value + direction]
  if (target) void openPagePreview(target)
}
const isQuizPage = (page: CoursewarePageStateVO) => {
  // append-quiz 的固定场景 ID；普通页面的“练习”标题不能证明它是 quiz。
  if (
    page.outlineId === 'scene_homework_quiz' ||
    page.id === `${page.partIndex}:scene_homework_quiz`
  )
    return true
  const outline = props.task?.partSelection?.parts
    .find((part) => part.partIndex === page.partIndex)
    ?.outlines?.find((item) => item.id === page.outlineId)
  return outline?.type === 'quiz'
}
const activePartHasQuizPage = computed(() => activePages.value.some(isQuizPage))
const activeSeriesItem = computed(() =>
  props.task?.series?.items?.find((item) => item.partIndex === activePart.value?.partIndex)
)
const quizCardStatus = computed(() => {
  // 系列任务的父级状态是汇总值，不能覆盖尚未开始的子项。
  const homework = (
    props.task?.series
      ? activeSeriesItem.value?.homeworkGenerationStatus
      : props.task?.homeworkGenerationStatus
  )
    ?.trim()
    .toLowerCase()
  if (homework === 'failed' || homework === 'canceled') return 'failed'
  if (homework === 'imported') return 'completed'
  const pages = props.task?.generation?.pages || []
  const items = props.task?.series?.items || []
  const pagesReady =
    pages.length > 0 &&
    pages.every((page) => page.status === 'completed') &&
    items.every(
      (item) =>
        resolveCoursewareTaskStatus(item.status) === COURSEWARE_TASK_STATUS.SUCCEEDED &&
        (item.partCount || 1) <= items.length
    )
  // succeeded 仍要导入并回填课件，直到 imported 才能作为完成依据。
  if (pagesReady && (homework === 'running' || homework === 'succeeded')) return 'generating'
  return 'waiting'
})
const quizCardStatusLabel = computed(() => s(`quizStates.${quizCardStatus.value}`))
const quizCardHint = computed(() => s(`quizHints.${quizCardStatus.value}`))
const generationStage = computed(() => resolveCoursewareTaskStage(props.task))
const generationPhaseTitle = computed(() => s(`phases.${generationStage.value}`))
const generationPhaseHint = computed(() => s(`phaseHints.${generationStage.value}`))
watch(
  () => props.task?.id,
  () => {
    selectedPartIndex.value = undefined
    partSwitchDirection.value = undefined
  }
)
const stage = computed(() => {
  if (waitingForUser.value) return 0
  if (reviewingOutline.value) return 2
  if (waitingForConfirmation.value) return 1
  if (
    props.task?.generation?.phase === 'pages' ||
    props.task?.generation?.phase === 'finalizing' ||
    props.task?.partSelection?.selectedPartIndexes?.length ||
    [
      'generating_scenes',
      'generating_children',
      'generating_media',
      'generating_tts',
      'persisting',
      'finalizing',
      'assembling',
      'completed'
    ].includes(props.task?.step || '')
  )
    return 3
  return summary.value || props.task?.partSelection?.parts.length ? 2 : 0
})
const stages = computed(() => ['understand', 'coCreate', 'review', 'produce'].map((key) => s(key)))
const stageLabel = computed(() => (failed.value ? '' : stages.value[stage.value]))

const currentCourseTitle = computed(() => {
  const title =
    summary.value?.title ||
    props.task?.promptEnhancement?.knownRequirements?.title ||
    props.task?.title ||
    props.sourcePrompt ||
    ''
  return typeof title === 'string' ? title : ''
})

const draft = reactive<StudioDraft>(createStudioDraft(props.task))
const confirmationSubmitted = ref(false)
const editingBrief = ref(false)
const canEditReview = computed(
  () => waitingForConfirmation.value && !props.busy && !confirmationSubmitted.value
)
const outlineParts = computed(() =>
  planningOutline.value
    ? [{ partIndex: 1, title: draft.brief.title, outlines: draft.outlines }]
    : props.task?.partSelection?.parts || []
)
const briefFields = computed(() => [
  { label: s('courseTitle'), value: draft.brief.title },
  { label: s('audience'), value: draft.brief.audience },
  { label: s('objective'), value: draft.brief.objective },
  { label: s('scope'), value: draft.brief.mustInclude.join('\n') }
])
const validationError = ref('')
const mobileTab = ref<'chat' | 'draft'>('chat')
const editingSection = ref('')
const conversationRef = ref<HTMLElement>()
const followLatest = ref(true)
function trackConversationScroll() {
  const element = conversationRef.value
  if (element)
    followLatest.value = element.scrollHeight - element.clientHeight - element.scrollTop < 80
}
async function followConversation() {
  await nextTick()
  if (followLatest.value)
    conversationRef.value?.scrollTo({ top: conversationRef.value.scrollHeight, behavior: 'auto' })
}
watch(
  () => props.task?.id,
  () => {
    followLatest.value = true
  }
)
watch(() => props.task?.promptEnhancement, followConversation, { deep: true, immediate: true })
watch(
  () => props.task?.promptEnhancement?.clarificationRound,
  (round, previousRound) => {
    if (round == null || round === previousRound) return
    draft.answers = {}
    draft.customAnswers = {}
    draft.notes = {}
  }
)

const key = computed(() => studioDraftKey(props.task))
const storageKey = computed(() => `courseware-studio-draft:${props.task?.id}`)

watch(
  key,
  async (value) => {
    // 身份变化（采访→摘要→正式页计划）必须重建，不能按 task.id 保留旧章节。
    Object.assign(draft, createStudioDraft(props.task))
    confirmationSubmitted.value = false
    editingBrief.value = false
    editingSection.value = ''
    validationError.value = ''
    if (props.task?.id) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey.value) || 'null')
        if (saved?.key === value && saved?.draft?.brief && Array.isArray(saved?.draft?.outlines))
          Object.assign(draft, saved.draft)
        const defaults = createStudioDraft(props.task)
        for (const question of questions.value) {
          if (!draft.answers[question.id]) {
            if (defaults.answers[question.id])
              draft.answers[question.id] = defaults.answers[question.id]
          }
          const answer = draft.answers[question.id]
          if (
            answer &&
            answer !== NONE_ANSWER &&
            !question.options?.some((option) => option.id === answer)
          ) {
            draft.customAnswers[question.id] = answer
            draft.answers[question.id] = NONE_ANSWER
          }
        }
      } catch {
        /* Storage can be unavailable in embedded browsers. */
      }
    }
  },
  { immediate: true }
)

// 仅父层确认失败才解锁；busy 结束也可能表示成功，不能据此恢复编辑。
watch(
  () => props.confirmationFailureRevision,
  () => {
    confirmationSubmitted.value = false
  }
)

// 有些轮询先送确认状态、后送完整摘要；只补空字段，不覆盖正在编辑的内容。
watch(
  () => props.task?.promptEnhancement?.summary,
  () => {
    if (editingBrief.value || confirmationSubmitted.value) return
    const incoming = createStudioDraft(props.task).brief
    for (const field of ['title', 'audience', 'objective'] as const) {
      if (!draft.brief[field]) draft.brief[field] = incoming[field]
    }
    if (!draft.brief.mustInclude.length) draft.brief.mustInclude = incoming.mustInclude
  },
  { deep: true, immediate: true }
)

watch(
  draft,
  () => {
    if (!props.task?.id) return
    try {
      if (waitingForUser.value || waitingForConfirmation.value)
        sessionStorage.setItem(storageKey.value, JSON.stringify({ key: key.value, draft }))
      else sessionStorage.removeItem(storageKey.value)
    } catch {
      /* The server still retains submitted answers and confirmed plans. */
    }
  },
  { deep: true }
)

// Genuine data update detection for knownRequirements (avoids animating on polling heartbeats)
const updatedFactKeys = ref<Set<string>>(new Set())
const lastKnownSnapshot = ref(
  JSON.stringify(props.task?.promptEnhancement?.knownRequirements || {})
)
let highlightTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.task?.promptEnhancement?.knownRequirements,
  (current) => {
    if (!current) return
    const currentStr = JSON.stringify(current)
    if (!lastKnownSnapshot.value) {
      lastKnownSnapshot.value = currentStr
      return
    }
    if (currentStr === lastKnownSnapshot.value) {
      // Polling heartbeat with identical content: no animation
      return
    }
    const newUpdated = new Set<string>()
    try {
      const prevObj = JSON.parse(lastKnownSnapshot.value) as Record<string, unknown>
      for (const k of Object.keys(current) as Array<keyof typeof current>) {
        if (JSON.stringify(current[k]) !== JSON.stringify(prevObj[k])) {
          newUpdated.add(k)
        }
      }
    } catch {
      /* parse error fallback */
    }
    lastKnownSnapshot.value = currentStr
    if (newUpdated.size > 0) {
      updatedFactKeys.value = newUpdated
      if (highlightTimer) clearTimeout(highlightTimer)
      highlightTimer = setTimeout(() => {
        updatedFactKeys.value = new Set()
      }, 2000)
    }
  },
  { deep: true }
)

onBeforeUnmount(() => {
  if (highlightTimer) clearTimeout(highlightTimer)
  if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
  resetPreview()
})

const facts = computed(() => {
  const known = props.task?.promptEnhancement?.knownRequirements || {}
  const source = summary.value || known
  const scope = source.scope as { mustInclude?: string[] } | undefined
  const items = [
    { key: 'title', label: s('courseTitle'), value: source.title, icon: 'lucide:sparkles' },
    { key: 'audience', label: s('audience'), value: source.audience, icon: 'lucide:users' },
    { key: 'objective', label: s('objective'), value: source.objective, icon: 'lucide:target' },
    { key: 'experience', label: s('experience'), value: known.experience, icon: 'lucide:compass' },
    { key: 'keySteps', label: s('keySteps'), value: known.keySteps, icon: 'lucide:list-ordered' },
    {
      key: 'boundaries',
      label: s('boundaries'),
      value: known.boundaries,
      icon: 'lucide:shield-alert'
    },
    { key: 'scope', label: s('scope'), value: scope?.mustInclude, icon: 'lucide:bookmark' }
  ]
  return items
    .map((item) => ({
      ...item,
      value: Array.isArray(item.value)
        ? item.value.filter((value) => typeof value === 'string').join('\n')
        : typeof item.value === 'string'
          ? item.value
          : ''
    }))
    .filter((item) => item.value)
})

const answersComplete = computed(() =>
  questions.value.every((question) => {
    const value = answerValue(question.id)
    return (
      !question.required ||
      Boolean(
        value && (question.allowCustom || question.options?.some((option) => option.id === value))
      )
    )
  })
)

const answerValue = (id: string) =>
  (draft.answers[id] === NONE_ANSWER ? draft.customAnswers[id] : draft.answers[id])?.trim() || ''

let autoAdvanceTimer: ReturnType<typeof setTimeout> | undefined
let autoAdvancedKey: string | undefined
function cancelAutoAdvance() {
  if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
  autoAdvanceTimer = undefined
}
watch(
  [
    key,
    waitingForUser,
    waitingForConfirmation,
    answersComplete,
    () => props.autoConfirm,
    () => props.busy
  ],
  () => {
    cancelAutoAdvance()
    if (!props.autoConfirm || props.busy || autoAdvancedKey === key.value) return
    if (
      questions.value.some(
        (question) =>
          question.requiresExplicitAnswer || question.id.startsWith('generation-option-')
      )
    )
      return
    if (!waitingForConfirmation.value && !(waitingForUser.value && answersComplete.value)) return
    const scheduledKey = key.value
    autoAdvanceTimer = setTimeout(() => {
      if (!props.autoConfirm || props.busy || key.value !== scheduledKey) return
      autoAdvancedKey = scheduledKey
      if (waitingForUser.value && answersComplete.value) submitAnswers()
      else if (waitingForConfirmation.value) confirm()
    }, 1000)
  },
  { immediate: true }
)

const pageIndex = (id: string) => draft.outlines.findIndex((outline) => outline.id === id)

function handleKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.repeat) return
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    if (waitingForUser.value && answersComplete.value && !props.busy) {
      submitAnswers()
    } else if (waitingForConfirmation.value && !props.busy) {
      confirm()
    }
  }
}

function submitAnswers() {
  if (props.busy || !waitingForUser.value || !answersComplete.value) return
  cancelAutoAdvance()
  if (props.autoConfirm) autoAdvancedKey = key.value
  emit(
    'answer',
    questions.value.map((question) => ({
      id: question.id,
      value: answerValue(question.id),
      ...(draft.answers[question.id] !== NONE_ANSWER && draft.notes[question.id]?.trim()
        ? { note: draft.notes[question.id].trim() }
        : {})
    }))
  )
}

function lockReview() {
  confirmationSubmitted.value = true
  editingBrief.value = false
  editingSection.value = ''
}

function confirm() {
  if (props.busy || confirmationSubmitted.value || !waitingForConfirmation.value) return
  cancelAutoAdvance()
  if (props.autoConfirm) autoAdvancedKey = key.value
  validationError.value = ''
  if (
    draft.outlines.some(
      (outline) =>
        !outline.title.trim() ||
        !outline.description.trim() ||
        !outline.keyPoints.some((point) => point.trim())
    )
  ) {
    validationError.value = s('completePages')
    mobileTab.value = 'draft'
    return
  }
  if (reviewingOutline.value) {
    if (!draft.selectedPartIndexes.length) {
      validationError.value = s('selectPart')
      return
    }
    if (draft.outlines.some((outline) => !outline.title.trim() || !outline.description.trim())) {
      validationError.value = s('completePages')
      mobileTab.value = 'draft'
      return
    }
    lockReview()
    emit('confirm', {
      ...(summary.value
        ? {
            requirementEdits: {
              ...draft.brief,
              mustInclude: draft.brief.mustInclude.map((item) => item.trim()).filter(Boolean)
            }
          }
        : {}),
      selectedPartIndexes: [...draft.selectedPartIndexes],
      outlineEdits: draft.outlines.map(({ id, title, description, keyPoints }) => ({
        id,
        title: title.trim(),
        description: description.trim(),
        keyPoints: keyPoints.map((point) => point.trim()).filter(Boolean)
      }))
    })
  } else {
    if (
      !draft.brief.title.trim() ||
      !draft.brief.audience.trim() ||
      !draft.brief.objective.trim()
    ) {
      validationError.value = s('completeBrief')
      mobileTab.value = 'draft'
      return
    }
    lockReview()
    emit('confirm', {
      requirementEdits: {
        ...draft.brief,
        ...(planningOutline.value
          ? {
              planningOutline: draft.outlines.map(({ id, title, description, keyPoints }) => ({
                id,
                title: title.trim(),
                description: description.trim(),
                keyPoints: keyPoints.map((point) => point.trim()).filter(Boolean)
              }))
            }
          : {}),
        mustInclude: draft.brief.mustInclude.map((item) => item.trim()).filter(Boolean)
      }
    })
  }
}
</script>

<style scoped lang="scss" src="./coursewareStudio.scss"></style>
