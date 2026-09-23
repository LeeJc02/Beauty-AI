<script setup lang="ts">
/**
 * 场景剧本（原型 pages/BAScripts.tsx + pages/RTBAScripts.tsx）。
 *
 * 原型 App.tsx 里 `Regional Training Manager` 走 RTBAScripts（区域剧本：琥珀色强调色、
 * 无「引用素材 / 预览效果」），其它角色走 BAScripts。两者结构一致，这里用一份实现 +
 * variant 配置区分文案与强调色。
 */
import type { DerivedAssetReference, GoldenMaterial } from '@/beauty/types'
import { createDerivedAssetReferences } from '@/beauty/lib/materialLibraryData'
import EffectiveStatusBadge from '../components/EffectiveStatusBadge.vue'
import PracticePromptNotice from '../components/PracticePromptNotice.vue'
import MaterialReferenceDialog from '../components/MaterialReferenceDialog.vue'
import ConversationPlaygroundDialog from '../components/ConversationPlaygroundDialog.vue'
import type { PlaygroundMessage } from '../components/types'
import { useBeautyRole } from '../components/useBeautyRole'

defineOptions({ name: 'BeautyBaScripts' })

type EffectiveStatus = 'pending' | 'active'

interface ScriptStep {
  id: string
  description: string
  hint: string
}

interface ScriptScenario {
  id: string
  name: string
  description: string
  steps: ScriptStep[]
  imageUrl?: string
  scope?: string
  sourceReferences?: DerivedAssetReference[]
  effectiveStatus: EffectiveStatus
}

interface ScriptVariant {
  sidebarTitle: string
  sideItemActive: string
  sideIconActive: string
  sideNameActive: string
  sideDescActive: string
  saveButton: string
  saveLabel: string
  saveToast: string
  editTitlePrefix: string
  editSubtitle: string
  infoIcon: string
  infoTitle: string
  descriptionLabel: string
  imageSectionTitle: string
  imageIntro: string
  stepsIcon: string
  stepsTitle: string
  stepIndexTone: string
  addStepButton: string
  hintIcon: string
  hintLabel: string
  hintPlaceholder: string
  emptySteps: string
  newScriptName: string
  newScriptDescription: string
  newStepDescription: string
  sidebarEmpty: string
  selectEmpty: string
  generateWarning: string
  generateToast: string
  aiImageToast: string
  aiImagePrefix: string
  supportsReference: boolean
}

const AI_TONE_BTN =
  '!h-8 !border !border-[#D8DEFF] !bg-[#EEF1FF] !text-[#515BCB] hover:!bg-[#E1E7FF] hover:!text-[#3F48B4] shadow-sm'
const AI_OUTLINE_BTN =
  '!h-9 !border-[#D8DEFF] !bg-[#EEF1FF] !text-[#515BCB] hover:!bg-[#E1E7FF] hover:!text-[#3F48B4]'
const NEUTRAL_OUTLINE_BTN = '!h-9 !border-[#E5DED8] !bg-white !text-[#3F3A3D] hover:!bg-[#F8F5F3]'

const STANDARD_VARIANT: ScriptVariant = {
  sidebarTitle: '场景剧本',
  sideItemActive: 'border-rose-600 bg-rose-50/50 shadow-sm',
  sideIconActive: 'bg-rose-100 text-rose-600',
  sideNameActive: 'text-rose-900',
  sideDescActive: 'text-rose-700/70',
  saveButton: 'bg-rose-600 hover:bg-rose-700',
  saveLabel: '保存剧本',
  saveToast: '剧本已保存',
  editTitlePrefix: '编辑剧本：',
  editSubtitle: '配置剧情背景与考核指导节点',
  infoIcon: 'text-rose-500',
  infoTitle: '剧本基础信息',
  descriptionLabel: '场景介绍',
  imageSectionTitle: '场景配图',
  imageIntro: '可以上传一张图，来生动展示这个场景',
  stepsIcon: 'text-rose-500',
  stepsTitle: '剧本步骤与提示节点',
  stepIndexTone: 'bg-rose-100 text-rose-700',
  addStepButton: '!border-[#E5DED8] shadow-sm',
  hintIcon: 'text-[#B9822B]',
  hintLabel: '回答提示 (选填，给BA的指引，不填则由AI自动判定)',
  hintPlaceholder: '例如：需提到核心成分神经酰胺...',
  emptySteps: '暂无剧本步骤，请点击右上角新增',
  newScriptName: '新场景剧本',
  newScriptDescription: '请描述该场景的主要背景与目的...',
  newStepDescription: '新的剧本步骤...',
  sidebarEmpty: '暂无场景剧本，请点击右上角添加',
  selectEmpty: '在左侧选择或创建一个剧本',
  generateWarning: '请先填写剧本名称和场景介绍',
  generateToast: '已生成 6 个剧本步骤',
  aiImageToast: '已生成场景配图',
  aiImagePrefix: 'https://source.unsplash.com/random/800x800/?beauty,skincare,',
  supportsReference: true
}

const REGIONAL_VARIANT: ScriptVariant = {
  sidebarTitle: '区域场景剧本',
  sideItemActive: 'border-[#B9822B] bg-[#FFF7EA]/50 shadow-sm',
  sideIconActive: 'bg-[#F7E6C8] text-[#B9822B]',
  sideNameActive: 'text-[#4C3415]',
  sideDescActive: 'text-[#8B621F]/70',
  saveButton: 'bg-[#B9822B] hover:bg-[#A67327]',
  saveLabel: '保存区域剧本',
  saveToast: '区域剧本已保存',
  editTitlePrefix: '编辑区域剧本：',
  editSubtitle: '配置剧情背景与区域适用的考核指导节点',
  infoIcon: 'text-[#B9822B]',
  infoTitle: '区域剧本基础信息',
  descriptionLabel: '区域场景介绍',
  imageSectionTitle: '区域场景配图',
  imageIntro: '可以上传一张图，来生动展示区域门店场景',
  stepsIcon: 'text-[#B9822B]',
  stepsTitle: '区域剧本步骤与提示节点',
  stepIndexTone: 'bg-[#F7E6C8] text-[#8B621F]',
  addStepButton:
    '!border-[#E8CCA0] !text-[#B9822B] hover:!bg-[#FFF7EA] hover:!text-[#8B621F] shadow-sm',
  hintIcon: 'text-[#9A9396]',
  hintLabel: '回答提示 (选填，给区域BA的指引，不填则由AI自动判定)',
  hintPlaceholder: '例如：需结合当季华东地区气候情况...',
  emptySteps: '暂无区域剧本步骤，请点击右上角新增',
  newScriptName: '新区域场景剧本',
  newScriptDescription: '请描述该区域特色场景的主要背景与目的...',
  newStepDescription: '新的区域剧本步骤...',
  sidebarEmpty: '暂无区域场景剧本，请点击右上角添加',
  selectEmpty: '在左侧选择或创建一个区域剧本',
  generateWarning: '请先填写剧本名称和区域场景介绍',
  generateToast: '已生成 6 个区域剧本步骤',
  aiImageToast: '已生成区域场景配图',
  aiImagePrefix: 'https://source.unsplash.com/random/800x800/?beauty,store,china,',
  supportsReference: false
}

const INITIAL_SCRIPTS: ScriptScenario[] = [
  {
    id: '1',
    name: '干敏皮防晒推荐',
    description: '指导BA如何接待干敏皮顾客，通过挖掘需求推荐合适的防晒产品及其主要成分。',
    scope: 'HQ',
    effectiveStatus: 'active',
    steps: [
      {
        id: 's1',
        description: '询问顾客的日常护肤痛点和防晒需求',
        hint: '注意关注防晒产品的滋润度和温和性'
      },
      { id: 's2', description: '介绍Barrier Shield系列或物理类温和防晒', hint: '' },
      {
        id: 's3',
        description: '解答顾客关于搓泥/闷痘的疑虑，提供试用',
        hint: '建议在小面积肌肤上试用'
      }
    ]
  },
  {
    id: '2',
    name: '处理缺货抱怨',
    description: '顾客想要的热门产品缺货，BA需要安抚情绪并推荐合理的替代方案或引导预定。',
    scope: 'HQ',
    effectiveStatus: 'active',
    steps: [
      { id: 's1', description: '诚恳地向顾客道歉并表示理解', hint: '保持态度友好，不要推卸责任' },
      { id: 's2', description: '说明缺货原因并给出大概的到货时间', hint: '' },
      {
        id: 's3',
        description: '推荐功效相近的替代产品或帮忙预定',
        hint: '推荐时要强调替代品的相似功效'
      }
    ]
  }
]

const RT_INITIAL_SCRIPTS: ScriptScenario[] = [
  {
    id: 'rt-script-1',
    name: '区域性：雨季应对防晕妆',
    description: '针对印尼等地区雨季高湿度容易晕妆的情况，给出针对性的防水防汗保湿建议。',
    scope: '雅加达区',
    effectiveStatus: 'active',
    steps: [
      { id: 's1', description: '询问顾客平时是否容易脱妆或感觉粘腻', hint: '切入热带地区痛点' },
      { id: 's2', description: '推荐含有强效定妆成分和防水配方的产品', hint: '突出持妆防汗脱落' },
      {
        id: 's3',
        description: '建议采用烘焙定妆法或三明治底妆法',
        hint: '给出完整的应对潮湿环境的底妆方案'
      }
    ]
  },
  {
    id: 'rt-script-2',
    name: '重点商圈：雅加达外派高管快速破冰',
    description:
      '针对雅加达高端商超内的门店，高管/外企人员时间紧凑，如何在短时间内吸引注意并建立信任。',
    scope: '雅加达区',
    effectiveStatus: 'active',
    steps: [
      {
        id: 's1',
        description: '用简单的英文或礼貌尊称快速破冰并赞美搭配',
        hint: '需专业干练，避免过度推销感'
      },
      {
        id: 's2',
        description: '一句话点出抗老/熬夜修护明星产品的核心优势',
        hint: '强调产品效率与即时效果'
      },
      {
        id: 's3',
        description: '邀请顾客进行手部五官快速体验，或预约周末SPA',
        hint: '尊重顾客时间，提供VIP服务'
      }
    ]
  }
]

const role = useBeautyRole()
const isRegional = computed(
  () => role.value === 'Regional Training Manager' || role.value === 'Regional Trainer'
)
const variant = computed(() => (isRegional.value ? REGIONAL_VARIANT : STANDARD_VARIANT))

const scripts = ref<ScriptScenario[]>(isRegional.value ? RT_INITIAL_SCRIPTS : INITIAL_SCRIPTS)
const selectedId = ref<string>(scripts.value[0].id)
const showToast = ref(false)
const toastMessage = ref('剧本已保存')
const toastTone = ref<'success' | 'warning'>('success')
const previewOpen = ref(false)
const materialReferenceOpen = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

const selectedScript = computed(
  () => scripts.value.find((script) => script.id === selectedId.value) || scripts.value[0]
)

// 角色信息晚于首帧就绪时（例如刷新后补取权限），按变体重置一次数据集。
watch(isRegional, (regional) => {
  scripts.value = regional ? RT_INITIAL_SCRIPTS : INITIAL_SCRIPTS
  selectedId.value = scripts.value[0].id
})

const stepOutline = (script: ScriptScenario | undefined) =>
  (script?.steps ?? [])
    .map((step) => `${step.description}${step.hint ? `（${step.hint}）` : ''}`)
    .join('\n')

const previewScript = computed(() => ({
  id: selectedScript.value?.id ?? 'custom-flow',
  title: selectedScript.value?.name ?? '自定义大纲',
  description: selectedScript.value?.description ?? '使用当前剧本流程进行预览',
  outline: stepOutline(selectedScript.value)
}))

const previewInitialMessages = computed<PlaygroundMessage[]>(() => [
  {
    id: `${previewScript.value.id}-opening`,
    role: 'assistant',
    text: `欢迎进入剧本预览。我会按「${previewScript.value.title}」这个场景扮演顾客，你可以直接输入 BA 的示范回应。`
  }
])

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

const handleUpdate = <K extends keyof ScriptScenario>(field: K, value: ScriptScenario[K]) => {
  scripts.value = scripts.value.map((script) =>
    script.id === selectedId.value
      ? ({ ...script, [field]: value, effectiveStatus: 'pending' } as ScriptScenario)
      : script
  )
}

const handleUpdateStep = (stepId: string, field: keyof ScriptStep, value: string) => {
  scripts.value = scripts.value.map((script) => {
    if (script.id !== selectedId.value) return script
    return {
      ...script,
      effectiveStatus: 'pending',
      steps: script.steps.map((step) => (step.id === stepId ? { ...step, [field]: value } : step))
    }
  })
}

const handleAddStep = () => {
  if (!selectedScript.value) return
  const newStep: ScriptStep = {
    id: Date.now().toString(),
    description: variant.value.newStepDescription,
    hint: ''
  }
  handleUpdate('steps', [...selectedScript.value.steps, newStep])
}

const handleRemoveStep = (stepId: string) => {
  if (!selectedScript.value) return
  handleUpdate(
    'steps',
    selectedScript.value.steps.filter((step) => step.id !== stepId)
  )
}

const handleAddNew = () => {
  const newScript: ScriptScenario = {
    id: Date.now().toString(),
    name: variant.value.newScriptName,
    description: variant.value.newScriptDescription,
    effectiveStatus: 'pending',
    steps: [{ id: Date.now().toString(), description: '步骤 1', hint: '' }]
  }
  scripts.value = [...scripts.value, newScript]
  selectedId.value = newScript.id
}

const handleDelete = (id: string) => {
  const newScripts = scripts.value.filter((script) => script.id !== id)
  scripts.value = newScripts
  if (selectedId.value === id && newScripts.length > 0) {
    selectedId.value = newScripts[0].id
  } else if (newScripts.length === 0) {
    selectedId.value = ''
  }
}

const handleSave = () => {
  scripts.value = scripts.value.map((script) =>
    script.id === selectedId.value ? { ...script, effectiveStatus: 'active' } : script
  )
  showFeedback(variant.value.saveToast, 'success', 3000)
}

const handleGenerateScriptSteps = () => {
  const script = selectedScript.value
  if (!script) return
  const scriptName = script.name.trim()
  const scenario = script.description.trim()

  if (!scriptName || !scenario) {
    showFeedback(variant.value.generateWarning, 'warning')
    return
  }

  const context = scenario.length > 36 ? `${scenario.slice(0, 36)}...` : scenario
  const regional = isRegional.value
  const generatedSteps: ScriptStep[] = [
    {
      id: `${Date.now()}-ai-1`,
      description: regional
        ? `开场破冰，确认顾客是否符合「${scriptName}」区域场景`
        : `开场破冰，确认顾客是否符合「${scriptName}」场景`,
      hint: regional
        ? `结合本区域门店语境自然问候，再围绕“${context}”确认顾客当前需求。`
        : `先用自然问候降低距离感，再围绕“${context}”确认顾客当前需求。`
    },
    {
      id: `${Date.now()}-ai-2`,
      description: regional
        ? '追问当地气候、肤质状态和消费习惯，补齐推荐前信息'
        : '追问肤质、使用习惯和当前顾虑，补齐推荐前信息',
      hint: regional
        ? '至少确认肤质、近期使用产品、当地环境影响和预算限制。'
        : '至少确认肤质状态、近期使用产品、预算/时间限制，避免直接推品。'
    },
    {
      id: `${Date.now()}-ai-3`,
      description: regional
        ? '复述顾客核心需求，并结合区域特点给出问题判断'
        : '复述顾客核心需求，并给出清晰的问题判断',
      hint: regional
        ? '把顾客痛点与当地气候、商圈或客群特征连接起来，再进入方案推荐。'
        : '用一句话总结顾客痛点，让顾客感到被理解，再进入方案推荐。'
    },
    {
      id: `${Date.now()}-ai-4`,
      description: regional
        ? `推荐匹配「${scriptName}」的产品或服务组合`
        : `推荐匹配「${scriptName}」的主推产品或服务组合`,
      hint: regional
        ? '讲清楚推荐理由、关键卖点和使用顺序，并说明为什么适合该区域场景。'
        : '讲清楚推荐理由、关键成分/卖点和使用顺序，不要只背产品名。'
    },
    {
      id: `${Date.now()}-ai-5`,
      description: regional
        ? '处理顾客异议，补充体验、对比或区域替代方案'
        : '处理顾客异议，补充体验、对比或替代方案',
      hint: regional
        ? '针对价格、效果、安全性、缺货等异议给出可在门店执行的回应。'
        : '针对价格、效果、安全性、缺货等常见异议给出具体回应。'
    },
    {
      id: `${Date.now()}-ai-6`,
      description: '推动试用或成交，并确认后续跟进动作',
      hint: regional
        ? '给出明确下一步，例如现场试用、加购搭配、预约护理或门店复访提醒。'
        : '给出明确下一步，例如现场试用、加购搭配、预约护理或售后提醒。'
    }
  ]

  handleUpdate('steps', generatedSteps)
  showFeedback(variant.value.generateToast, 'success')
}

const applyMaterialReference = (materials: GoldenMaterial[]) => {
  if (!materials.length || !selectedScript.value) return
  const steps = materials.map((material, index) => ({
    id: `material-step-${Date.now()}-${index}`,
    description: `${index + 1}. ${material.title}`,
    hint: material.aiSummary ?? material.summary
  }))
  scripts.value = scripts.value.map((script) =>
    script.id === selectedId.value
      ? {
          ...script,
          description: `围绕${materials
            .map((material) => material.targetLabel)
            .filter((value, index, values) => values.indexOf(value) === index)
            .join('、')}，${materials
            .map((material) => material.aiSummary ?? material.summary)
            .join('；')}`,
          steps,
          sourceReferences: createDerivedAssetReferences('script', materials),
          effectiveStatus: 'pending'
        }
      : script
  )
  showFeedback(`已引用 ${materials.length} 条黄金素材，生成可编辑剧本草稿`, 'success', 3000)
}

const generatePreviewReply = (input: string) => {
  const script = selectedScript.value
  if (!script) return ''
  const text = input.toLowerCase()
  const matchedStep = script.steps.find(
    (step) =>
      text.includes(step.description.toLowerCase().slice(0, 4)) ||
      text.includes('价格') ||
      text.includes('预算') ||
      text.includes('试用') ||
      text.includes('异议') ||
      text.includes('油') ||
      text.includes('搓泥')
  )

  if (text.includes('价格') || text.includes('预算')) {
    return `可以先从价值和体验讲起。这个剧本里更适合先回应顾客顾虑，再给出更稳的方案，必要时补充试用或替代选择。`
  }

  if (text.includes('试用') || text.includes('小样')) {
    return `可以顺着顾客的试用意愿推进，先确认肤感和实际需求，再结合当前剧本的步骤引导试涂或体验。`
  }

  if (text.includes('油') || text.includes('搓泥') || text.includes('闷痘')) {
    return `可以重点解释质地、适用肤质和使用顺序，先打消顾客对油腻、搓泥或闷痘的担心。`
  }

  if (matchedStep) {
    return `可以按第 ${script.steps.indexOf(matchedStep) + 1} 步的节奏回应：${matchedStep.description}。对应提示可以写成「${matchedStep.hint || '先围绕当前顾客需求展开，再推进下一步'}」。`
  }

  return `建议先呼应顾客问题，再回到这个剧本的核心主线：${script.description.slice(0, 36)}${script.description.length > 36 ? '...' : ''}`
}

const onScenarioImageSelected = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  handleUpdate('imageUrl', URL.createObjectURL(file))
}

const generateScenarioImage = () => {
  const script = selectedScript.value
  if (!script) return
  handleUpdate('imageUrl', `${variant.value.aiImagePrefix}${encodeURIComponent(script.name)}`)
  showFeedback(variant.value.aiImageToast, 'success', 2000)
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div
    class="beauty-ba-page flex overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F7F3F1] pt-2"
  >
    <!-- 左侧列表 -->
    <div class="w-80 shrink-0 flex flex-col border-r border-[#E5DED8] bg-white">
      <div class="z-10 flex items-center justify-between border-b border-[#E9E4DF] bg-white p-4">
        <h2 class="font-bold tracking-tight text-[#242124]">
          {{ variant.sidebarTitle }} ({{ scripts.length }})
        </h2>
        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
          @click="handleAddNew"
        >
          <Icon icon="lucide:plus" :size="16" />
          <span>新建</span>
        </button>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-4">
        <div
          v-for="script in scripts"
          :key="script.id"
          class="group relative flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-all"
          :class="
            selectedId === script.id
              ? variant.sideItemActive
              : 'border-transparent bg-[#F8F5F3] hover:border-[#E5DED8] hover:bg-[#F1ECE8]'
          "
          @click="selectedId = script.id"
        >
          <div class="flex items-start justify-between">
            <div class="flex w-full items-start gap-3">
              <div
                class="mt-0.5 shrink-0 rounded-lg p-2"
                :class="
                  selectedId === script.id ? variant.sideIconActive : 'bg-white text-[#9A9396]'
                "
              >
                <Icon icon="lucide:file-text" :size="20" />
              </div>
              <div class="min-w-0 w-full pr-6">
                <div class="mb-1 flex items-center gap-2">
                  <h3
                    data-i18n-skip="true"
                    class="truncate text-sm font-bold"
                    :class="selectedId === script.id ? variant.sideNameActive : 'text-[#242124]'"
                  >
                    {{ script.name }}
                  </h3>
                  <span
                    v-if="script.scope && script.scope !== 'HQ'"
                    data-i18n-skip="true"
                    class="inline-flex h-4 shrink-0 items-center rounded border-none bg-rose-50 px-1.5 py-0 text-[9px] font-normal leading-none tracking-widest text-rose-600"
                    >{{ script.scope }}</span
                  >
                </div>
                <p
                  data-i18n-skip="true"
                  class="mt-1 line-clamp-2 text-xs"
                  :class="selectedId === script.id ? variant.sideDescActive : 'text-[#766F73]'"
                >
                  {{ script.description }}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="absolute right-4 top-4 rounded-md p-1.5 text-[#9A9396] transition-colors hover:bg-red-50 hover:text-red-500"
            :class="selectedId === script.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
            @click.stop="handleDelete(script.id)"
          >
            <Icon icon="lucide:trash-2" :size="16" />
          </button>
        </div>
        <div v-if="scripts.length === 0" class="py-10 text-center text-sm text-[#9A9396]">
          {{ variant.sidebarEmpty }}
        </div>
      </div>
    </div>

    <!-- 右侧编辑区 -->
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

      <template v-if="selectedScript">
        <div
          class="flex shrink-0 items-center justify-between border-b border-[#E5DED8] bg-white p-6"
        >
          <div>
            <h1 class="text-xl font-bold text-[#242124]">
              {{ variant.editTitlePrefix }}{{ selectedScript.name }}
            </h1>
            <p class="mt-1 text-xs text-[#766F73]">{{ variant.editSubtitle }}</p>
          </div>
          <div class="flex items-center gap-3">
            <template v-if="variant.supportsReference">
              <el-button :class="AI_OUTLINE_BTN" @click="materialReferenceOpen = true">
                <Icon icon="lucide:library-big" :size="16" class="mr-1.5" />
                <span>引用素材</span>
              </el-button>
              <el-button :class="NEUTRAL_OUTLINE_BTN" @click="previewOpen = true">
                <Icon icon="lucide:message-square" :size="16" class="mr-1.5" />
                <span>预览效果</span>
              </el-button>
            </template>
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors"
              :class="variant.saveButton"
              @click="handleSave"
            >
              <Icon icon="lucide:save" :size="16" />
              <span>{{ variant.saveLabel }}</span>
            </button>
            <EffectiveStatusBadge :status="selectedScript.effectiveStatus" />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6 md:p-8">
          <div class="mx-auto max-w-4xl space-y-6">
            <PracticePromptNotice />

            <!-- 剧本基础信息 -->
            <div class="rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm">
              <h3 class="mb-5 flex items-center text-sm font-bold text-[#242124]">
                <Icon icon="lucide:settings" :size="16" class="mr-2" :class="variant.infoIcon" />
                {{ variant.infoTitle }}
              </h3>
              <div class="space-y-4">
                <div>
                  <label class="mb-2 block text-xs font-bold text-[#766F73]">剧本名称</label>
                  <input
                    :value="selectedScript.name"
                    type="text"
                    class="w-full rounded-lg border border-[#E5DED8] px-4 py-2 text-sm font-medium transition-shadow focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    @input="handleUpdate('name', ($event.target as HTMLInputElement).value)"
                  />
                </div>
                <div>
                  <label class="mb-2 block text-xs font-bold text-[#766F73]">{{
                    variant.descriptionLabel
                  }}</label>
                  <textarea
                    :value="selectedScript.description"
                    rows="3"
                    class="w-full resize-none rounded-lg border border-[#E5DED8] px-4 py-2 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    @input="
                      handleUpdate('description', ($event.target as HTMLTextAreaElement).value)
                    "
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- 场景配图 -->
            <div class="rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm">
              <h3 class="mb-5 flex items-center text-sm font-bold text-[#242124]">
                <Icon icon="lucide:image" :size="16" class="mr-2 text-[#3B8F72]" />
                {{ variant.imageSectionTitle }}
              </h3>
              <div class="flex overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F8F5F3]/50">
                <div
                  class="relative flex h-48 w-48 shrink-0 items-center justify-center overflow-hidden border-r border-[#E5DED8] bg-slate-100"
                >
                  <img
                    v-if="selectedScript.imageUrl"
                    :src="selectedScript.imageUrl"
                    alt="Scenario"
                    class="h-full w-full object-cover"
                  />
                  <div v-else class="p-4 text-center text-[#9A9396]">
                    <Icon icon="lucide:image" :size="32" class="mx-auto mb-2 opacity-50" />
                    <span class="text-xs">暂无配图</span>
                  </div>
                </div>
                <div class="flex flex-1 flex-col justify-center space-y-4 p-6">
                  <div>
                    <p class="text-sm font-medium text-[#3F3A3D]">{{ variant.imageIntro }}</p>
                    <ul class="mt-2 list-disc space-y-1 pl-4 text-xs text-[#766F73]">
                      <li>建议尺寸：800x800 px，比例 1:1</li>
                      <li>支持的格式：JPG, PNG, WebP</li>
                      <li>大小限制：不得超过 2MB</li>
                    </ul>
                  </div>
                  <div class="flex items-center gap-3 pt-2">
                    <div class="relative inline-flex overflow-hidden">
                      <el-button size="small" class="!h-9 shadow-sm">
                        <Icon icon="lucide:upload" :size="16" class="mr-1.5 text-[#766F73]" />
                        <span>上传图片</span>
                      </el-button>
                      <input
                        type="file"
                        class="absolute inset-0 cursor-pointer opacity-0"
                        accept="image/png, image/jpeg, image/webp"
                        @change="onScenarioImageSelected"
                      />
                    </div>
                    <div class="group/image-note relative">
                      <span
                        class="absolute -right-1 -top-2 z-10 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-center text-[9px] font-bold leading-4 text-white shadow-sm backdrop-blur-sm"
                        >注</span
                      >
                      <el-button
                        size="small"
                        class="relative overflow-hidden !h-9"
                        :class="AI_TONE_BTN"
                        :disabled="!selectedScript.name || !selectedScript.description"
                        @click="generateScenarioImage"
                      >
                        <Icon icon="lucide:wand-2" :size="16" class="mr-1.5 text-[#6974E8]" />
                        <span>AI 一键生成配图</span>
                      </el-button>
                      <div
                        class="absolute bottom-full left-0 z-50 mb-2 hidden w-80 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm group-hover/image-note:block"
                      >
                        给研发：必须先有剧本名称和场景介绍才能生图；生图的预制 prompt
                        里要写清楚这是美妆店场景，然后拼接剧本名称、场景介绍等基础信息。
                      </div>
                    </div>
                  </div>
                  <p
                    v-if="!selectedScript.name || !selectedScript.description"
                    class="text-[10px] text-[#B9822B]"
                  >
                    完善“剧本名称”和“场景介绍”后，可使用 AI 配图。
                  </p>
                </div>
              </div>
            </div>

            <!-- 剧本步骤 -->
            <div class="rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm">
              <div class="mb-5 flex items-center justify-between">
                <h3 class="flex items-center text-sm font-bold text-[#242124]">
                  <Icon
                    icon="lucide:message-square"
                    :size="16"
                    class="mr-2"
                    :class="variant.stepsIcon"
                  />
                  {{ variant.stepsTitle }}
                </h3>
                <div class="flex items-center gap-2">
                  <el-button :class="AI_TONE_BTN" @click="handleGenerateScriptSteps">
                    <Icon icon="lucide:wand-2" :size="16" class="mr-1 text-[#6974E8]" />
                    AI 一键生成剧本
                  </el-button>
                  <el-button
                    size="small"
                    class="!h-8"
                    :class="variant.addStepButton"
                    @click="handleAddStep"
                  >
                    <Icon icon="lucide:plus" :size="16" class="mr-1" />
                    新增步骤
                  </el-button>
                </div>
              </div>

              <div class="space-y-4">
                <div
                  v-for="(step, index) in selectedScript.steps"
                  :key="step.id"
                  class="group relative rounded-xl border border-[#E5DED8] bg-[#F8F5F3]/50 p-4"
                >
                  <div
                    class="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold"
                    :class="variant.stepIndexTone"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="space-y-3 pl-10">
                    <div>
                      <label class="mb-1 block text-xs font-bold text-[#766F73]">步骤描述</label>
                      <input
                        :value="step.description"
                        type="text"
                        class="w-full rounded-md border border-[#E5DED8] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        @input="
                          handleUpdateStep(
                            step.id,
                            'description',
                            ($event.target as HTMLInputElement).value
                          )
                        "
                      />
                    </div>
                    <div>
                      <label class="mb-1 flex items-center text-xs font-bold text-[#766F73]">
                        <Icon
                          icon="lucide:alert-circle"
                          :size="12"
                          class="mr-1"
                          :class="variant.hintIcon"
                        />
                        {{ variant.hintLabel }}
                      </label>
                      <textarea
                        :value="step.hint"
                        rows="2"
                        :placeholder="variant.hintPlaceholder"
                        class="w-full resize-none rounded-md border border-[#E5DED8] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B9822B]/20"
                        @input="
                          handleUpdateStep(
                            step.id,
                            'hint',
                            ($event.target as HTMLTextAreaElement).value
                          )
                        "
                      ></textarea>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="absolute right-4 top-4 rounded-md p-1 text-[#9A9396] opacity-0 transition-all hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
                    @click="handleRemoveStep(step.id)"
                  >
                    <Icon icon="lucide:trash-2" :size="16" />
                  </button>
                </div>
                <div
                  v-if="selectedScript.steps.length === 0"
                  class="rounded-xl border border-dashed border-[#E5DED8] bg-[#F8F5F3] py-6 text-center text-sm text-[#766F73]"
                >
                  {{ variant.emptySteps }}
                </div>
              </div>
            </div>

            <!-- 来源素材 -->
            <section
              v-if="selectedScript.sourceReferences?.length"
              class="rounded-xl border border-[#D8DEFF] bg-[#F7F8FF] p-5"
            >
              <div class="flex items-center gap-2 text-sm font-bold text-[#515BCB]">
                <Icon icon="lucide:link-2" :size="16" />来源素材
              </div>
              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                <div
                  v-for="source in selectedScript.sourceReferences"
                  :key="source.id"
                  class="rounded-lg border border-[#D8DEFF] bg-white px-3 py-2.5"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-sm font-bold text-[#3F3A3D]">{{ source.materialTitle }}</span>
                    <span class="shrink-0 text-[11px] text-[#766F73]"
                      >v{{ source.materialVersion }}</span
                    >
                  </div>
                  <div class="mt-1 text-xs text-[#766F73]">
                    证据
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
            </section>
          </div>
        </div>
      </template>

      <div v-else class="flex flex-1 flex-col items-center justify-center text-[#9A9396]">
        <Icon icon="lucide:file-text" :size="64" class="mb-4 opacity-20" />
        <p class="font-medium text-[#766F73]">{{ variant.selectEmpty }}</p>
      </div>

      <ConversationPlaygroundDialog
        v-if="variant.supportsReference"
        v-model="previewOpen"
        title="剧本预览"
        subtitle="输入顾客问题，查看当前剧本下的 BA 示范回应"
        :seed-key="selectedScript?.id ?? ''"
        :initial-messages="previewInitialMessages"
        :generate-reply="generatePreviewReply"
      >
        <template #right-pane>
          <div class="space-y-5">
            <div class="flex items-center gap-3 border-b border-[#E5DED8] pb-4">
              <div class="min-w-0">
                <div data-i18n-skip="true" class="truncate text-sm font-bold text-[#242124]">
                  {{ selectedScript?.name }}
                </div>
                <div data-i18n-skip="true" class="mt-1 truncate text-xs text-[#766F73]">
                  {{ selectedScript?.description }}
                </div>
              </div>
              <div class="ml-auto shrink-0">
                <EffectiveStatusBadge :status="selectedScript?.effectiveStatus ?? 'pending'" />
              </div>
            </div>

            <div>
              <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9A9396]">
                剧本步骤
              </div>
              <div class="space-y-3">
                <div
                  v-for="(step, index) in selectedScript?.steps ?? []"
                  :key="step.id"
                  class="rounded-xl border border-[#E5DED8] bg-white p-3"
                >
                  <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#C47D2A]">
                    步骤 {{ index + 1 }}
                  </div>
                  <div data-i18n-skip="true" class="text-sm font-bold text-[#242124]">
                    {{ step.description }}
                  </div>
                  <div
                    v-if="step.hint"
                    data-i18n-skip="true"
                    class="mt-1 text-xs leading-relaxed text-[#766F73]"
                  >
                    {{ step.hint }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </ConversationPlaygroundDialog>

      <MaterialReferenceDialog
        v-if="variant.supportsReference"
        v-model="materialReferenceOpen"
        target="script"
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
</style>
