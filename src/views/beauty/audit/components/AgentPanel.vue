<script setup lang="ts">
/**
 * 首屏对话 Agent（原型 `training-inspection/AgentPanel.tsx`）。
 *
 * 普通问答走 `answerInspectionQuestion`；「新建一个审计需求」进入选项式反问向导，
 * 五步问完就能建 tab（区域账号跳过范围那一步）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import {
  AGENT_PRESET_QUESTIONS,
  answerInspectionQuestion,
  type AgentAnswer
} from '@/beauty/lib/inspectionAgent'
import { addDays, canSeeRegion, inspectionDay } from '@/beauty/lib/inspectionEngine'
import {
  ASPECT_HINTS,
  ASPECT_LABELS,
  CADENCE_LABELS,
  CREATE_REQUIREMENT_PROMPT,
  REQUIREMENT_ASPECTS,
  REQUIREMENT_NAME_LIMIT,
  aspectLabelOf,
  defaultRequirementName,
  describeRequirement,
  matchRequirementIntent,
  normalizeRequirementName,
  parseAspectsFromText,
  parseCadenceFromText,
  parseCategoriesFromText,
  parsePeriodFromText,
  parseRegionFromText,
  parseReplyCommand,
  requirementCategories,
  type RequirementAspect,
  type RequirementCadence
} from '@/beauty/lib/inspectionRequirements'
import { createRequirement } from '@/beauty/lib/requirementStore'
import { setInspectionState } from '@/beauty/lib/inspectionStore'
import type { InspectionActor, InspectionState } from '@/beauty/lib/inspectionTypes'
import { useBeautyI18n } from '@/beauty/composables'
import BeautySectionHeading from './BeautySectionHeading.vue'

defineOptions({ name: 'BeautyAgentPanel' })

const props = defineProps<{
  state: InspectionState
  actor: InspectionActor
}>()

const emit = defineEmits<{
  (e: 'focus-task', taskId: string): void
  (e: 'created-requirement', id: string): void
}>()

const { t } = useBeautyI18n()

interface ChatOption {
  label: string
  value: string
  hint?: string
}

type WizardStep = 'aspects' | 'category' | 'scope' | 'cadence' | 'period' | 'confirm'
type PeriodPreset = 'long' | 'weeks4' | 'custom'

interface WizardDraft {
  aspects: RequirementAspect[]
  categories: string[]
  regionId: string | null
  cadence: RequirementCadence
  period: PeriodPreset
  startsOn: string
  endsOn: string | null
  name: string
}

interface WizardState {
  step: WizardStep
  draft: WizardDraft
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  answer?: AgentAnswer
  pending?: boolean
  /** 创建向导：这一步的可选按钮与步骤名。 */
  options?: ChatOption[]
  wizardStep?: WizardStep
}

const ASPECT_QUESTION = t(
  '先确认这次审计要盯哪些方面？可以点下面的按钮多选，也可以直接打字说（例如「重复布置和时间集中」或「都要」）。'
)
const CATEGORY_QUESTION = t(
  '要看哪些品类？可以多选，也可以直接打字，例如「新品和敏感肌」或「都要」。'
)
const SCOPE_QUESTION = t(
  '审计范围定在哪里？可以点下面的区域，也可以直接打字，例如「南区」或「全国」。'
)
const CADENCE_QUESTION = t('多久自动跑一次？每天 / 每周一 / 每月 1 日都可以，直接打字说也一样。')
const PERIOD_QUESTION = t(
  '从什么时候开始、跑到什么时候？可以选下面的，也可以直接打字，例如「从今天起连续 4 周」「9 月 20 日到 12 月 31 日」。'
)
const CONFIRM_QUESTION = t('确认一下，没问题我现在就创建，回复「确认」也行。')

/** 每一步输入框的提示语：选项之外，用户也可以自己说。 */
const WIZARD_PLACEHOLDER: Record<WizardStep, string> = {
  aspects: t('也可以打字：例如「重复布置和时间集中」或「都要」'),
  category: t('也可以打字：例如「新品」「敏感肌」「都要」'),
  scope: t('也可以打字：例如「南区」「全国」'),
  cadence: t('也可以打字：例如「每天」「每周一」「每月 1 日」'),
  period: t('也可以打字：例如「从今天起连续 4 周」「9 月 20 日到 12 月 31 日」'),
  confirm: t('回复「确认」直接创建，也可以说「返回修改」')
}

const ASPECT_OPTIONS: ChatOption[] = [
  ...REQUIREMENT_ASPECTS.map((aspect) => ({
    label: t(ASPECT_LABELS[aspect]),
    value: aspect,
    hint: t(ASPECT_HINTS[aspect])
  })),
  { label: t('以上都要'), value: 'all' }
]
const CADENCE_OPTIONS: ChatOption[] = (['daily', 'weekly', 'monthly'] as RequirementCadence[]).map(
  (cadence) => ({ label: t(CADENCE_LABELS[cadence]), value: cadence })
)
const PERIOD_OPTIONS: ChatOption[] = [
  { label: t('从今天开始 · 长期'), value: 'long' },
  { label: t('从今天开始 · 连续 4 周'), value: 'weeks4' },
  { label: t('自定义起止日期'), value: 'custom' }
]

const messages = ref<ChatMessage[]>([])
const input = ref('')
const busy = ref(false)
const asked = ref(false)
const wizard = ref<WizardState | null>(null)
const listRef = ref<HTMLDivElement | null>(null)

/** 数据里出现过的品类，作为「包含特定品类」那一步的选项。 */
const categoryOptions = computed<ChatOption[]>(() =>
  requirementCategories(props.state, props.actor).map((item) => ({
    label: item.name,
    value: item.name,
    hint: `${item.taskCount} ${t('项任务涉及这个品类')}`
  }))
)

const visibleRegions = computed(() =>
  props.state.regions.filter((region) => canSeeRegion(props.actor, region.id))
)

/**
 * 这一步之后还有哪些步骤：选了「包含特定品类」就多问一步品类；
 * 总部才问范围，区域账号只看得到本区域，范围直接定死。
 */
const stepsFor = (draft: WizardDraft): WizardStep[] => {
  const steps: WizardStep[] = ['aspects']
  if (draft.aspects.includes('category') && categoryOptions.value.length) steps.push('category')
  if (props.actor.hq) steps.push('scope')
  steps.push('cadence', 'period')
  return steps
}

watch(messages, () => {
  nextTick(() => {
    listRef.value?.scrollTo({ top: listRef.value.scrollHeight, behavior: 'smooth' })
  })
})

const pushUser = (text: string) => {
  messages.value = [
    ...messages.value,
    { id: `user-${Date.now()}-${messages.value.length}`, role: 'user', text }
  ]
}

const pushAgent = (text: string, extra: Partial<ChatMessage> = {}) => {
  messages.value = [
    ...messages.value,
    { id: `agent-${Date.now()}-${messages.value.length}`, role: 'agent', text, ...extra }
  ]
}

const ask = async (question: string) => {
  const text = question.trim()
  if (!text || busy.value) return
  // 创建向导进行中：把用户打的字当成这一步的回答，先用本地规则解析
  if (wizard.value) {
    handleWizardText(text)
    return
  }
  // 说「新建 / 创建一个审计」就进创建向导，其他问题照旧走问答
  if (text === CREATE_REQUIREMENT_PROMPT || matchRequirementIntent(text)) {
    startWizard(text)
    return
  }
  busy.value = true
  asked.value = true
  input.value = ''
  const pendingId = `pending-${Date.now()}`
  messages.value = [
    ...messages.value,
    { id: `user-${Date.now()}`, role: 'user', text },
    { id: pendingId, role: 'agent', text: t('正在查看审计记录…'), pending: true }
  ]
  const history = messages.value
    .filter((message) => !message.pending)
    .map((message) => ({
      role: message.role,
      text: message.role === 'agent' ? (message.answer?.title ?? message.text) : message.text
    }))
  const answer = await answerInspectionQuestion(props.state, props.actor, text, history)
  // Agent 只能「提议」写操作：改自动审计频次由界面落到策略上
  if (answer.action?.type === 'set-cadence') {
    const minutes = answer.action.minutes
    setInspectionState((previous) => ({
      ...previous,
      policy: { ...previous.policy, autoRunMinutes: minutes }
    }))
  }
  messages.value = messages.value.map((message) =>
    message.id === pendingId ? { ...message, text: answer.title, answer, pending: false } : message
  )
  busy.value = false
}

/* ------------------------------------------------------------ 创建向导 */

const startWizard = (text: string) => {
  const today = inspectionDay()
  const regionName = props.actor.regionId
    ? (props.state.regions.find((region) => region.id === props.actor.regionId)?.name ?? '')
    : ''
  const draft: WizardDraft = {
    aspects: [],
    categories: [],
    regionId: props.actor.hq ? null : (props.actor.regionId ?? null),
    cadence: 'weekly',
    period: 'long',
    startsOn: today,
    endsOn: null,
    name: ''
  }
  asked.value = true
  wizard.value = { step: 'aspects', draft }
  messages.value = [
    ...messages.value,
    { id: `user-${Date.now()}`, role: 'user', text },
    {
      id: `wizard-aspects-${Date.now()}`,
      role: 'agent',
      text: props.actor.hq
        ? ASPECT_QUESTION
        : `${t('你的账号只看得到')}${regionName}${t('，范围就按这个来。')}${ASPECT_QUESTION}`,
      options: ASPECT_OPTIONS,
      wizardStep: 'aspects'
    }
  ]
}

const askNext = (from: WizardStep, draft: WizardDraft) => {
  const steps = stepsFor(draft)
  const index = steps.indexOf(from)
  const next = steps[index + 1]
  if (!next) {
    wizard.value = { step: 'confirm', draft }
    pushAgent(CONFIRM_QUESTION, { wizardStep: 'confirm' })
    return
  }
  const question =
    next === 'category'
      ? CATEGORY_QUESTION
      : next === 'scope'
        ? SCOPE_QUESTION
        : next === 'cadence'
          ? CADENCE_QUESTION
          : PERIOD_QUESTION
  const options =
    next === 'category'
      ? [...categoryOptions.value, { label: t('以上都要'), value: 'all' }]
      : next === 'scope'
        ? [
            { label: t('全国（我可见的全部区域）'), value: '__all__' },
            ...visibleRegions.value.map((region) => ({ label: region.name, value: region.id }))
          ]
        : next === 'cadence'
          ? CADENCE_OPTIONS
          : PERIOD_OPTIONS
  wizard.value = { step: next, draft }
  messages.value = [
    ...messages.value,
    {
      id: `wizard-${next}-${Date.now()}`,
      role: 'agent',
      text: question,
      options,
      wizardStep: next
    }
  ]
}

/**
 * 向导里用户直接打字：先用本地规则解析成这一步的答案；
 * 解析不出来就说明白能听懂什么，不让对话卡住。
 */
const handleWizardText = (text: string) => {
  const current = wizard.value
  if (!current) return
  const draft = current.draft
  input.value = ''

  if (current.step === 'confirm') {
    const command = parseReplyCommand(text)
    pushUser(text)
    if (command === 'confirm') {
      confirmCreate()
      return
    }
    if (command === 'cancel') {
      cancelWizard()
      return
    }
    if (command === 'back') {
      wizard.value = { ...current, step: 'aspects' }
      pushAgent(t('好，那我们从头再确认一遍。'))
      return
    }
    pushAgent(t('现在可以直接回复「确认」创建，或者点「返回修改」回去改前面的选择。'))
    return
  }

  if (current.step === 'aspects') {
    const aspects = parseAspectsFromText(text)
    if (!aspects.length) {
      pushUser(text)
      pushAgent(
        t(
          '这一层我只盯四类问题：重复布置、时间集中、任务量超了、数据不全。点上面的按钮选，或者说「都要」。'
        )
      )
      return
    }
    pushUser(text)
    askNext('aspects', { ...draft, aspects })
    return
  }

  if (current.step === 'category') {
    const categories = parseCategoriesFromText(props.state, props.actor, text)
    if (!categories.length) {
      pushUser(text)
      pushAgent(
        `${t('品类只认数据里出现过的：')}${categoryOptions.value
          .map((item) => item.value)
          .join('、')}${t('。直接点上面的按钮，或者说「都要」。')}`
      )
      return
    }
    pushUser(text)
    askNext('category', { ...draft, categories })
    return
  }

  if (current.step === 'scope') {
    const parsed = parseRegionFromText(props.state, props.actor, text)
    if (!parsed) {
      pushUser(text)
      pushAgent(
        `${t('没认出是哪个区域。可以说')}${visibleRegions.value
          .map((region) => region.name)
          .join('、')}${t('，或者「全国」。')}`
      )
      return
    }
    pushUser(text)
    askNext('scope', { ...draft, regionId: parsed.regionId })
    return
  }

  if (current.step === 'cadence') {
    const cadence = parseCadenceFromText(text)
    if (!cadence) {
      pushUser(text)
      pushAgent(
        t('周期只有三种：每天、每周一、每月 1 日（都是早上 8 点跑）。直接点按钮，或者说「每天」。')
      )
      return
    }
    pushUser(text)
    askNext('cadence', { ...draft, cadence })
    return
  }

  // 起止时间
  const today = inspectionDay()
  const parsed = parsePeriodFromText(text, today)
  if (!parsed) {
    pushUser(text)
    pushAgent(
      t(
        '时间没太看懂。可以说「长期」「连续 4 周」「从今天到 10 月 20 日」，或者在下面选自定义日期。'
      )
    )
    return
  }
  const period: PeriodPreset = !parsed.endsOn
    ? 'long'
    : parsed.startsOn === today && parsed.endsOn === addDays(today, 27)
      ? 'weeks4'
      : 'custom'
  pushUser(text)
  askNext('period', {
    ...draft,
    period,
    startsOn: parsed.startsOn,
    endsOn: parsed.endsOn
  })
}

const chooseOption = (message: ChatMessage, option: ChatOption) => {
  const current = wizard.value
  if (!current || current.step !== message.wizardStep) return

  if (message.wizardStep === 'aspects') {
    const draft = current.draft
    if (option.value === 'all') {
      wizard.value = { ...current, draft: { ...draft, aspects: [...REQUIREMENT_ASPECTS] } }
      return
    }
    if (option.value === 'next') {
      if (!draft.aspects.length) return
      pushUser(aspectLabelOf(draft.aspects))
      askNext('aspects', draft)
      return
    }
    const aspect = option.value as RequirementAspect
    const aspects = draft.aspects.includes(aspect)
      ? draft.aspects.filter((item) => item !== aspect)
      : [...draft.aspects, aspect]
    wizard.value = {
      ...current,
      draft: {
        ...draft,
        aspects,
        // 不再盯品类时，把之前选过的品类一起清掉
        categories: aspects.includes('category') ? draft.categories : []
      }
    }
    return
  }

  if (message.wizardStep === 'category') {
    const draft = current.draft
    if (option.value === 'all') {
      wizard.value = {
        ...current,
        draft: { ...draft, categories: categoryOptions.value.map((item) => item.value) }
      }
      return
    }
    if (option.value === 'next') {
      if (!draft.categories.length) return
      pushUser(draft.categories.join('、'))
      askNext('category', draft)
      return
    }
    const categories = draft.categories.includes(option.value)
      ? draft.categories.filter((item) => item !== option.value)
      : [...draft.categories, option.value]
    wizard.value = { ...current, draft: { ...draft, categories } }
    return
  }

  if (message.wizardStep === 'scope') {
    const regionId = option.value === '__all__' ? null : option.value
    pushUser(option.label)
    askNext('scope', { ...current.draft, regionId })
    return
  }

  if (message.wizardStep === 'cadence') {
    const cadence = option.value as RequirementCadence
    pushUser(option.label)
    askNext('cadence', { ...current.draft, cadence })
    return
  }

  if (message.wizardStep === 'period') {
    const today = inspectionDay()
    if (option.value === 'custom') {
      wizard.value = {
        ...current,
        draft: {
          ...current.draft,
          period: 'custom',
          startsOn: current.draft.startsOn,
          endsOn: current.draft.endsOn ?? addDays(today, 27)
        }
      }
      return
    }
    const endsOn = option.value === 'weeks4' ? addDays(today, 27) : null
    pushUser(option.label)
    askNext('period', {
      ...current.draft,
      period: option.value as PeriodPreset,
      startsOn: today,
      endsOn
    })
  }
}

const confirmCustomPeriod = () => {
  const current = wizard.value
  if (!current) return
  const { startsOn, endsOn } = current.draft
  if (!endsOn || endsOn < startsOn) return
  pushUser(`${startsOn.slice(5)} ${t('起')}，${endsOn.slice(5)} ${t('止')}`)
  askNext('period', { ...current.draft, period: 'custom' })
}

const defaultName = computed(() =>
  wizard.value ? defaultRequirementName(props.state, wizard.value.draft) : ''
)

const confirmCreate = () => {
  const current = wizard.value
  if (!current) return
  const draft = current.draft
  const result = createRequirement({
    name: normalizeRequirementName(draft.name) || defaultName.value,
    aspects: draft.aspects,
    categories: draft.categories,
    regionId: draft.regionId,
    cadence: draft.cadence,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn,
    createdBy: props.actor.name
  })
  wizard.value = null
  if (!result.ok || !result.requirement) {
    pushAgent(`${t('这次没创建成功：')}${result.error ?? t('未知原因')}`)
    return
  }
  const requirement = result.requirement
  pushAgent(
    `${t('已经建好了：')}「${requirement.name}」。${describeRequirement(props.state, requirement)}。${t(
      '标签页已经切过去了，之后点它就能看这个审计跑得怎么样。'
    )}`
  )
  emit('created-requirement', requirement.id)
}

const cancelWizard = () => {
  wizard.value = null
  pushAgent(t('已取消。需要的时候再点「新建一个审计需求」。'))
}

/* -------------------------------------------------------------- 渲染 */

const wizardStepLabel = computed(() => {
  const current = wizard.value
  if (!current) return ''
  if (current.step === 'confirm') return t('最后一步')
  const steps = stepsFor(current.draft)
  return `${t('第')} ${steps.indexOf(current.step) + 1} ${t('步 / 共')} ${steps.length} ${t('步')}`
})

const optionSelected = (option: ChatOption) => {
  const current = wizard.value
  if (!current) return false
  const draft = current.draft
  if (option.value === 'all') return draft.aspects.length === REQUIREMENT_ASPECTS.length
  if (option.value === 'next') return false
  if ((REQUIREMENT_ASPECTS as string[]).includes(option.value) && current.step === 'aspects')
    return draft.aspects.includes(option.value as RequirementAspect)
  if (current.step === 'category')
    return option.value === 'all'
      ? draft.categories.length === categoryOptions.value.length
      : draft.categories.includes(option.value)
  if (current.step === 'scope') return (draft.regionId ?? '__all__') === option.value
  if (current.step === 'cadence') return draft.cadence === option.value
  if (current.step === 'period') return draft.period === option.value
  return false
}

const onNameInput = (event: Event) => {
  const current = wizard.value
  if (!current) return
  wizard.value = {
    ...current,
    draft: { ...current.draft, name: (event.target as HTMLInputElement).value }
  }
}

const onCustomStart = (event: Event) => {
  const current = wizard.value
  if (!current) return
  wizard.value = {
    ...current,
    draft: { ...current.draft, startsOn: (event.target as HTMLInputElement).value }
  }
}

const onCustomEnd = (event: Event) => {
  const current = wizard.value
  if (!current) return
  wizard.value = {
    ...current,
    draft: { ...current.draft, endsOn: (event.target as HTMLInputElement).value }
  }
}

const backToAspects = () => {
  const current = wizard.value
  if (!current) return
  wizard.value = { ...current, step: 'aspects', draft: { ...current.draft } }
}

const submitInput = () => {
  void ask(input.value)
}

const presetQuestions = computed(() =>
  asked.value ? AGENT_PRESET_QUESTIONS.slice(3) : AGENT_PRESET_QUESTIONS
)

const confirmText = computed(() =>
  wizard.value ? describeRequirement(props.state, wizard.value.draft) : ''
)

const placeholder = computed(() =>
  wizard.value ? WIZARD_PLACEHOLDER[wizard.value.step] : t('问点什么…例如：南区现在什么情况？')
)
</script>

<template>
  <div class="rounded-xl bg-gradient-to-br from-secondary/70 to-card p-3.5 ring-1 ring-primary/15">
    <BeautySectionHeading :title="t('和审计Agent对话')" />

    <div ref="listRef" class="mt-3 grid max-h-[360px] gap-2.5 overflow-y-auto pr-0.5">
      <div
        v-for="message in messages"
        :key="message.id"
        class="flex gap-2"
        :class="message.role === 'user' ? 'justify-end' : ''"
      >
        <span
          v-if="message.role === 'agent'"
          class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"
        >
          <Icon icon="lucide:bot" :size="13" />
        </span>
        <div
          class="grid max-w-[92%] gap-1.5 rounded-xl px-3 py-2 text-[12px] leading-relaxed ring-1"
          :class="
            message.role === 'user'
              ? 'bg-primary text-primary-foreground ring-primary/30'
              : 'bg-background text-foreground ring-foreground/10'
          "
        >
          <span v-if="message.pending" class="flex items-center gap-1.5 text-muted-foreground">
            <Icon icon="lucide:loader-2" :size="13" class="animate-spin" /> {{ message.text }}
          </span>
          <template v-else>
            <span class="font-semibold">{{ message.text }}</span>
            <span
              v-for="(paragraph, index) in message.answer?.paragraphs ?? []"
              :key="`${index}-${paragraph}`"
              class="text-[11.5px] text-muted-foreground"
            >
              {{ paragraph }}
            </span>
            <ul v-if="message.answer?.bullets.length" class="grid gap-1 text-[11.5px]">
              <li
                v-for="(bullet, index) in message.answer.bullets"
                :key="`${index}-${bullet}`"
                class="flex gap-1.5"
              >
                <span class="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60"></span>
                <span>{{ bullet }}</span>
              </li>
            </ul>
            <div
              v-if="message.answer?.citations.length"
              class="grid gap-1 border-t border-solid border-border/70 pt-1.5"
            >
              <div
                v-for="(citation, index) in message.answer.citations.slice(0, 6)"
                :key="`${index}-${citation.label}-${citation.ref}`"
                class="flex flex-wrap items-center justify-between gap-1 text-[10.5px] text-muted-foreground"
              >
                <span>
                  {{ citation.label }}
                  <span class="ml-1 text-[10px]">{{ t('来源：') }}{{ citation.ref }}</span>
                </span>
                <button
                  v-if="citation.taskId"
                  type="button"
                  class="inspection-link"
                  @click="emit('focus-task', citation.taskId)"
                >
                  {{ t('看任务体检') }}
                </button>
              </div>
            </div>
            <div v-if="message.answer?.followUps.length" class="flex flex-wrap gap-1 pt-0.5">
              <button
                v-for="followUp in message.answer.followUps.slice(0, 4)"
                :key="followUp"
                type="button"
                class="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] text-secondary-foreground ring-1 ring-primary/15 hover:bg-primary/10"
                @click="ask(followUp)"
              >
                {{ followUp }}
              </button>
            </div>

            <div
              v-if="
                wizard &&
                wizard.step === message.wizardStep &&
                (message.options?.length || message.wizardStep === 'confirm')
              "
              class="grid gap-1.5 border-t border-solid border-border/70 pt-1.5"
            >
              <span v-if="message.options?.length" class="text-[10px] text-muted-foreground">
                {{ wizardStepLabel }}
              </span>
              <div v-if="message.options?.length" class="flex flex-wrap gap-1">
                <button
                  v-for="option in message.options"
                  :key="option.value"
                  type="button"
                  :title="option.hint"
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] ring-1"
                  :class="
                    optionSelected(option)
                      ? 'bg-primary text-primary-foreground ring-primary/30'
                      : 'bg-secondary text-secondary-foreground ring-primary/15 hover:bg-primary/10'
                  "
                  @click="chooseOption(message, option)"
                >
                  <Icon v-if="optionSelected(option)" icon="lucide:check" :size="10" />
                  {{ option.label }}
                </button>
                <button
                  v-if="message.wizardStep === 'category'"
                  type="button"
                  class="rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-semibold text-primary-foreground disabled:opacity-50"
                  :disabled="!wizard.draft.categories.length"
                  @click="chooseOption(message, { label: t('下一步'), value: 'next' })"
                >
                  {{ t('下一步') }}
                </button>
                <button
                  v-if="message.wizardStep === 'aspects'"
                  type="button"
                  class="rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-semibold text-primary-foreground disabled:opacity-50"
                  :disabled="!wizard.draft.aspects.length"
                  @click="chooseOption(message, { label: t('下一步'), value: 'next' })"
                >
                  {{ t('下一步') }}
                </button>
              </div>

              <div
                v-if="
                  message.options?.length &&
                  message.wizardStep === 'period' &&
                  wizard.draft.period === 'custom'
                "
                class="flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground"
              >
                <input
                  type="date"
                  class="rounded-md border border-solid border-input bg-background px-1.5 py-0.5 text-[11px]"
                  :value="wizard.draft.startsOn"
                  :min="inspectionDay()"
                  @input="onCustomStart"
                />
                <span>{{ t('到') }}</span>
                <input
                  type="date"
                  class="rounded-md border border-solid border-input bg-background px-1.5 py-0.5 text-[11px]"
                  :value="wizard.draft.endsOn ?? ''"
                  :min="wizard.draft.startsOn"
                  @input="onCustomEnd"
                />
                <button
                  type="button"
                  class="rounded-full bg-primary px-2.5 py-0.5 font-semibold text-primary-foreground disabled:opacity-50"
                  :disabled="!wizard.draft.endsOn || wizard.draft.endsOn < wizard.draft.startsOn"
                  @click="confirmCustomPeriod"
                >
                  {{ t('确定时间') }}
                </button>
              </div>

              <div
                v-if="message.wizardStep === 'confirm'"
                class="grid gap-2 rounded-lg bg-muted/50 p-2"
              >
                <label class="grid gap-1 text-[10.5px] text-muted-foreground">
                  {{ t('审计名称（最多') }} {{ REQUIREMENT_NAME_LIMIT }} {{ t('字）') }}
                  <input
                    class="h-8 rounded-md border border-solid border-input bg-background px-2 text-[12px] text-foreground outline-none focus-visible:border-ring"
                    :placeholder="defaultName"
                    :maxlength="REQUIREMENT_NAME_LIMIT"
                    :value="wizard.draft.name"
                    @input="onNameInput"
                  />
                </label>
                <span class="text-[11px] text-muted-foreground">{{ confirmText }}</span>
                <div class="flex flex-wrap gap-1.5">
                  <el-button size="small" @click="confirmCreate">{{ t('确认创建') }}</el-button>
                  <el-button size="small" plain @click="backToAspects">{{
                    t('返回修改')
                  }}</el-button>
                  <el-button size="small" plain @click="cancelWizard">{{ t('取消') }}</el-button>
                </div>
              </div>
            </div>
          </template>
        </div>
        <span
          v-if="message.role === 'user'"
          class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Icon icon="lucide:user" :size="13" />
        </span>
      </div>
    </div>

    <div v-if="wizard" class="mt-2 flex justify-end">
      <button type="button" class="inspection-link" @click="cancelWizard">{{
        t('取消创建')
      }}</button>
    </div>
    <div v-else class="mt-3 flex flex-wrap gap-1.5">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/25 hover:bg-primary/20 disabled:opacity-60"
        :disabled="busy"
        @click="ask(CREATE_REQUIREMENT_PROMPT)"
      >
        <Icon icon="lucide:plus" :size="11" /> {{ t(CREATE_REQUIREMENT_PROMPT) }}
      </button>
      <button
        v-for="question in presetQuestions"
        :key="question"
        type="button"
        class="rounded-full bg-background px-2.5 py-1 text-[11px] text-foreground ring-1 ring-border hover:bg-secondary disabled:opacity-60"
        :disabled="busy"
        @click="ask(question)"
      >
        {{ t(question) }}
      </button>
    </div>

    <form class="mt-2.5 flex items-center gap-1.5" @submit.prevent="submitInput">
      <input
        v-model="input"
        class="h-9 min-w-0 flex-1 rounded-lg border border-solid border-input bg-background px-2.5 text-[12px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        :placeholder="placeholder"
      />
      <el-button size="small" native-type="submit" :disabled="busy || !input.trim()">
        <Icon :icon="busy ? 'lucide:loader-2' : 'lucide:corner-down-left'" :size="13" />
        {{ wizard ? t('发送') : t('提问') }}
      </el-button>
    </form>
  </div>
</template>
