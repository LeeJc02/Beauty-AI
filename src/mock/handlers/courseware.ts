import { MockError, type MockCtx, type MockRoute } from '../types'
import {
  DEMO_BRANDS,
  DEMO_CATEGORIES,
  DEMO_COURSEWARES,
  DEMO_PRODUCTS,
  DEMO_VOICES,
  FILE_CAPABILITIES,
  demoParts,
  demoPages,
  demoQuestions,
  demoSummary,
  slidePreviewHtml,
  type DemoCategory,
  type DemoCourseware,
  type DemoLang,
  type DemoPartPlan,
  type DemoProduct,
  type DemoBrand
} from '../data/coursewareDemo'

/* ------------------------------------------------------------------ *
 * 持久化状态
 * ------------------------------------------------------------------ */
type JobPhase =
  | 'clarify'
  | 'summary'
  | 'splitting'
  | 'parts'
  | 'generating'
  | 'finalizing'
  | 'done'
  | 'canceled'

interface JobAnswerRecord {
  message: string
  questions: ReturnType<typeof demoQuestions>
  answers: Array<{ questionId: string; value: string; note?: string }>
}

interface RequirementEdits {
  title?: string
  audience?: string
  objective?: string
  mustInclude?: string[]
  planningOutline?: Array<{ id: string; title: string; description: string; keyPoints: string[] }>
}

interface JobState {
  id: number
  language: DemoLang
  prompt: string
  attachmentNames: string[]
  brandIds: number[]
  categoryIds: number[]
  productIds: number[]
  generateHomeworkSync: boolean
  partCount: number
  phase: JobPhase
  phaseStartedAt: number
  createdAt: number
  answers: Record<string, string>
  history: JobAnswerRecord[]
  requirementEdits?: RequirementEdits
  outlineEdits?: Array<{ id: string; title: string; description: string; keyPoints: string[] }>
  selectedPartIndexes?: number[]
  coursewareId?: number
  title?: string
}

interface MockStore {
  jobs: JobState[]
  coursewares: DemoCourseware[]
  brands: DemoBrand[]
  categories: DemoCategory[]
  products: DemoProduct[]
  nextJobId: number
  nextCoursewareId: number
}

const STORAGE_KEY = 'beauty-ai:mock-courseware-store'

const DEFAULT_STORE = (): MockStore => ({
  jobs: [],
  coursewares: DEMO_COURSEWARES.map((item) => ({ ...item })),
  brands: DEMO_BRANDS.map((item) => ({ ...item })),
  categories: DEMO_CATEGORIES.map((item) => ({ ...item })),
  products: DEMO_PRODUCTS.map((item) => ({ ...item })),
  nextJobId: 101,
  nextCoursewareId: 601
})

let store: MockStore | null = null

const loadStore = (): MockStore => {
  if (store) return store
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockStore
      if (parsed && Array.isArray(parsed.jobs) && Array.isArray(parsed.coursewares)) {
        store = parsed
        return store
      }
    }
  } catch {
    // 解析失败就重建
  }
  store = DEFAULT_STORE()
  saveStore()
  return store
}

const saveStore = () => {
  if (!store) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 忽略配额异常
  }
}

/* ------------------------------------------------------------------ *
 * 阶段时长与推进
 * ------------------------------------------------------------------ */
const SPLIT_MS = 3200
const PAGE_MS = 2600
const FINALIZE_MS = 2600

const TERMINAL_PHASES: JobPhase[] = ['done', 'canceled']

const jobOf = (ctx: MockCtx): JobState => {
  const id = Number(ctx.query.id)
  const job = loadStore().jobs.find((item) => item.id === id)
  if (!job) throw new MockError(404, `生成任务不存在：${ctx.query.id}`)
  return job
}

const pagesOf = (job: JobState): DemoPartPlan[] => {
  const all = demoParts(job.language, job.partCount)
  const selected = job.selectedPartIndexes?.length ? job.selectedPartIndexes : all.map((part) => part.partIndex)
  return all.filter((part) => selected.includes(part.partIndex))
}

/** 依据流逝时间把任务推进到当前应该处的阶段（幂等，可反复调用）。 */
const advance = (job: JobState) => {
  const now = Date.now()
  for (let guard = 0; guard < 20; guard++) {
    const elapsed = now - job.phaseStartedAt
    if (job.phase === 'splitting') {
      if (elapsed < SPLIT_MS) return
      job.phase = 'parts'
      job.phaseStartedAt = now
      continue
    }
    if (job.phase === 'generating') {
      const total = demoPages(pagesOf(job)).length
      if (elapsed < total * PAGE_MS + 800) return
      job.phase = 'finalizing'
      job.phaseStartedAt = now
      continue
    }
    if (job.phase === 'finalizing') {
      if (elapsed < FINALIZE_MS) return
      completeJob(job)
      job.phase = 'done'
      job.phaseStartedAt = now
      continue
    }
    return
  }
}

/** 完成任务：写入课件库并生成系列/结果信息。 */
const completeJob = (job: JobState) => {
  const s = loadStore()
  const summary = summaryOf(job)
  if (!job.coursewareId) {
    const parts = pagesOf(job)
    const id = s.nextCoursewareId++
    const created: DemoCourseware = {
      id,
      title: summary.title,
      summary: summary.objective,
      tags: ['AI生成', ...(job.brandIds.length ? [] : []), '价格异议'].filter(Boolean),
      status: 10,
      brandIds: [...job.brandIds],
      categoryIds: [...job.categoryIds],
      productIds: [...job.productIds],
      coverUrl: '/mock/cover-you.svg',
      creatorName: '总部培训 · Sarah',
      createTime: formatTime(new Date()),
      viewCount: 0,
      learnerCount: 0,
      estimatedDurationSeconds: 300 * parts.length,
      previewUrl: '/mock-classroom.html',
      downloadUrl: '/mock/exports/generated-courseware.pptx'
    }
    s.coursewares.unshift(created)
    job.coursewareId = id
    job.title = summary.title
  }
  saveStore()
}

const formatTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const summaryOf = (job: JobState) => {
  const base = demoSummary(job.language)
  const edits = job.requirementEdits
  return {
    ...base,
    ...(edits?.title ? { title: edits.title } : {}),
    ...(edits?.audience ? { audience: edits.audience } : {}),
    ...(edits?.objective ? { objective: edits.objective } : {}),
    ...(edits?.planningOutline ? { planningOutline: edits.planningOutline } : {}),
    scope: {
      ...base.scope,
      ...(edits?.mustInclude ? { mustInclude: edits.mustInclude } : {})
    }
  }
}

const partsOf = (job: JobState) => {
  const parts = pagesOf(job)
  const edits = job.outlineEdits || []
  if (!edits.length) return parts
  return parts.map((part) => ({
    ...part,
    outlines: part.outlines.map((outline) => {
      const edit = edits.find((item) => item.id === outline.id)
      return edit ? { ...outline, ...edit, type: outline.type } : outline
    })
  }))
}

const titleOf = (job: JobState) =>
  job.title || job.requirementEdits?.title || summaryOf(job).title || 'AI 生成的课件'

/* ------------------------------------------------------------------ *
 * 任务快照（对齐 CoursewareGenerationTaskVO）
 * ------------------------------------------------------------------ */
const snapshot = (job: JobState) => {
  const base: Record<string, any> = {
    id: job.id,
    title: titleOf(job),
    pollIntervalMs: 2500,
    coursewareId: job.coursewareId,
    generateHomeworkSync: job.generateHomeworkSync,
    createTime: new Date(job.createdAt)
  }

  if (job.phase === 'clarify') {
    return {
      ...base,
      status: 21,
      step: 'waiting_for_user',
      progress: 8,
      promptEnhancement: {
        promptVersion: 'mock-1',
        modelRole: 'courseware-planner',
        clarificationEligible: true,
        clarificationRound: 1,
        message:
          job.language === 'id'
            ? 'Sebelum menyusun materi, saya perlu memastikan beberapa hal berikut.'
            : '开始规划前，先和你确认几件事，避免返工。',
        questions: demoQuestions(job.language),
        history: job.history,
        knownRequirements: {
          prompt: job.prompt,
          attachments: job.attachmentNames
        },
        assumptions: []
      }
    }
  }

  if (job.phase === 'summary') {
    return {
      ...base,
      status: 22,
      step: 'waiting_for_confirmation',
      progress: 22,
      promptEnhancement: {
        promptVersion: 'mock-1',
        clarificationEligible: true,
        clarificationRound: 1,
        message:
          job.language === 'id'
            ? 'Berikut ringkasan kebutuhan menurut pemahaman saya, silakan periksa.'
            : '按你的回答，我整理了一版需求规格，请确认。',
        questions: [],
        history: job.history,
        summary: summaryOf(job),
        assumptions: summaryOf(job).assumptions
      }
    }
  }

  if (job.phase === 'splitting') {
    return {
      ...base,
      status: 20,
      step: 'splitting_outline',
      progress: 38,
      promptEnhancement: {
        promptVersion: 'mock-1',
        clarificationEligible: true,
        clarificationRound: 1,
        message: job.language === 'id' ? 'Sedang memecah materi…' : '正在拆分大纲…',
        history: job.history,
        summary: summaryOf(job),
        assumptions: summaryOf(job).assumptions
      }
    }
  }

  if (job.phase === 'parts') {
    const parts = partsOf(job)
    const summary = summaryOf(job)
    return {
      ...base,
      status: 22,
      step: 'waiting_for_part_selection',
      progress: 55,
      outlineGrouping: {
        strategy: job.language === 'id' ? 'Berdasarkan alur counter' : '按柜台动线拆分',
        partCount: parts.length,
        partDurationsSeconds: parts.map((part) => part.estimatedDurationSeconds)
      },
      partSelection: {
        required: true,
        selectedPartIndexes: job.selectedPartIndexes,
        parts: parts.map((part) => ({
          partIndex: part.partIndex,
          partCount: part.partCount,
          title: part.title,
          estimatedDurationSeconds: part.estimatedDurationSeconds,
          outlineCount: part.outlines.length,
          outlines: part.outlines
        }))
      },
      promptEnhancement: {
        promptVersion: 'mock-1',
        clarificationEligible: true,
        clarificationRound: 1,
        history: job.history,
        summary,
        assumptions: summary.assumptions
      }
    }
  }

  if (job.phase === 'generating') {
    const parts = partsOf(job)
    const seeds = demoPages(parts)
    const elapsed = Date.now() - job.phaseStartedAt
    const completed = Math.min(seeds.length, Math.floor(elapsed / PAGE_MS))
    const pages = seeds.map((seed, index) => ({
      id: seed.id,
      outlineId: seed.outlineId,
      partIndex: seed.partIndex,
      order: seed.order,
      title: seed.title,
      summary: seed.summary,
      status: index < completed ? 'completed' : index === completed ? 'generating' : 'waiting',
      retryCount: 0,
      maxRetries: 2,
      mediaPending: false,
      // 页面完成时 version 递增：工作台据此重新拉取逐页预览
      version: index < completed ? 2 : 1
    }))
    const progress = 60 + Math.round((completed / Math.max(1, seeds.length)) * 28)
    const series = parts.length
      ? {
          seriesId: `series-${job.id}`,
          title: titleOf(job),
          items: parts.map((part) => ({
            childJobId: `job-${job.id}-part-${part.partIndex}`,
            partIndex: part.partIndex,
            partCount: parts.length,
            title: part.title,
            status: 20,
            progress,
            coursewareId: job.coursewareId,
            previewUrl: `/mock-classroom.html?part=${part.partIndex}`,
            homeworkGenerationStatus: 'pending'
          }))
        }
      : undefined
    return {
      ...base,
      status: 20,
      step: completed === 0 ? 'generating_children' : 'generating_scenes',
      progress,
      generation: {
        phase: 'pages',
        sourceSummary: job.attachmentNames.join('、'),
        pages,
        retry: { phase: 'generating_scenes', count: 0, maxRetries: 2, retrying: false }
      },
      series,
      researchSummary: {
        version: 'mock-1',
        status: 'complete',
        queries: [
          { query: 'Y.O.U Barrier Shield 成分与价格带', intent: '产品事实核对' },
          { query: '印尼直营门店价格异议高频话术', intent: '门店话术参考' }
        ],
        sources: [
          {
            title: 'Y.O.U Barrier Shield 产品手册（内部）',
            quality: 'high',
            label: '官方资料',
            adoptedConclusion: '神经酰胺 + 三层屏障修护是价格合理性的主要举证点'
          },
          {
            title: '2026 Q3 直营门店异议复盘',
            quality: 'medium',
            label: '内部复盘',
            adoptedConclusion: '价格异议集中在首次到店、试用前'
          }
        ],
        finalConclusions: [
          '价格异议的本质是不确定价值，先认可再举证',
          '举证顺序固定为：痛点 → 机制 → 结果'
        ]
      }
    }
  }

  if (job.phase === 'finalizing') {
    const parts = partsOf(job)
    const seeds = demoPages(parts)
    return {
      ...base,
      status: 20,
      step: 'finalizing',
      progress: 95,
      homeworkGenerationStatus: job.generateHomeworkSync ? 'running' : undefined,
      generation: {
        phase: 'finalizing',
        pages: seeds.map((seed) => ({
          id: seed.id,
          outlineId: seed.outlineId,
          partIndex: seed.partIndex,
          order: seed.order,
          title: seed.title,
          summary: seed.summary,
          status: 'completed',
          retryCount: 0,
          mediaPending: false,
          version: 2
        })),
        retry: { phase: 'finalizing', count: 0, retrying: false }
      }
    }
  }

  if (job.phase === 'canceled') {
    return {
      ...base,
      status: 50,
      step: 'canceled',
      progress: 0,
      message: job.language === 'id' ? 'Dibatalkan oleh pengguna' : '已被用户取消'
    }
  }

  // done
  const parts = partsOf(job)
  const seeds = demoPages(parts)
  const coursewareId = job.coursewareId
  const previewUrl = `/mock-classroom.html?coursewareId=${coursewareId}`
  return {
    ...base,
    status: 30,
    step: 'completed',
    progress: 100,
    done: true,
    resultCoursewareId: coursewareId,
    coursewareId,
    homeworkGenerationStatus: job.generateHomeworkSync ? 'imported' : undefined,
    generation: {
      phase: 'completed',
      pages: seeds.map((seed) => ({
        id: seed.id,
        outlineId: seed.outlineId,
        partIndex: seed.partIndex,
        order: seed.order,
        title: seed.title,
        summary: seed.summary,
        status: 'completed',
        retryCount: 0,
        mediaPending: false,
        version: 2
      })),
      retry: { phase: 'completed', count: 0, retrying: false }
    },
    result: {
      classroomId: `classroom-${coursewareId}`,
      url: previewUrl,
      previewUrl,
      downloadUrl: '/mock/exports/generated-courseware.pptx',
      exportUrls: {
        pptx: '/mock/exports/generated-courseware.pptx',
        html: previewUrl,
        classroomZip: '/mock/exports/generated-courseware.zip'
      },
      scenesCount: seeds.length
    },
    series: {
      seriesId: `series-${job.id}`,
      title: titleOf(job),
      items: parts.map((part) => ({
        childJobId: `job-${job.id}-part-${part.partIndex}`,
        coursewareId,
        resultCoursewareId: coursewareId,
        partIndex: part.partIndex,
        partCount: parts.length,
        title: part.title,
        status: 30,
        progress: 100,
        estimatedDurationSeconds: part.estimatedDurationSeconds,
        openingContext: job.language === 'id' ? 'Lanjutan dari bagian sebelumnya' : '承接上一部分的柜台场景',
        closingSummary: job.language === 'id' ? 'Rangkuman bagian ini' : '本部分小结',
        transitionToNext: job.language === 'id' ? 'Berlanjut ke bagian berikutnya' : '过渡到下一部分',
        homeworkGenerationStatus: job.generateHomeworkSync ? 'imported' : undefined,
        previewUrl: `/mock-classroom.html?part=${part.partIndex}`,
        downloadUrl: '/mock/exports/generated-courseware.pptx'
      }))
    }
  }
}

/* ------------------------------------------------------------------ *
 * 接口实现
 * ------------------------------------------------------------------ */
const ensureJob = () => {
  const s = loadStore()
  s.jobs.forEach((job) => advance(job))
}

const activeJob = (): JobState | undefined => {
  ensureJob()
  return loadStore()
    .jobs.filter((job) => !TERMINAL_PHASES.includes(job.phase))
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

const coursewareOf = (id: number) => loadStore().coursewares.find((item) => item.id === id)

/** 把内部课程记录补全成 CoursewareVO（预览/下载/封面等）。 */
const toCoursewareVO = (item: DemoCourseware) => ({
  id: item.id,
  title: item.title,
  summary: item.summary,
  tags: item.tags,
  status: item.status,
  creatorName: item.creatorName,
  createTime: item.createTime,
  publishTime: item.publishTime,
  viewCount: item.viewCount,
  learnerCount: item.learnerCount,
  estimatedDurationSeconds: item.estimatedDurationSeconds,
  coverUrl: item.coverUrl,
  coverNeedsSync: false,
  previewUrl: item.previewUrl,
  embedUrl: item.previewUrl,
  shareUrl: item.previewUrl,
  downloadUrl: item.downloadUrl,
  catalogCategoryCount: item.categoryIds.length,
  catalogBrandCount: item.brandIds.length,
  catalogProductCount: item.productIds.length,
  catalogBrands: item.brandIds.map((id) => ({
    id,
    name: loadStore().brands.find((brand) => brand.id === id)?.name || ''
  })),
  catalogCategories: item.categoryIds.map((id) => ({
    id,
    name: loadStore().categories.find((category) => category.id === id)?.pathName || ''
  })),
  catalogProducts: item.productIds.map((id) => ({
    id,
    name: loadStore().products.find((product) => product.id === id)?.name || ''
  }))
})

export const coursewareRoutes: MockRoute[] = [
  /* ---------------- 生成任务 ---------------- */
  {
    method: 'POST',
    path: '/ai/courseware/generation-task/create',
    handler: (ctx: MockCtx) => {
      const s = loadStore()
      const body = ctx.body || {}
      const rawLang = String(body.language || 'cn').toLowerCase()
      const language: DemoLang = rawLang.startsWith('id') ? 'id' : rawLang.startsWith('en') ? 'en' : 'cn'
      const files: Array<{ name?: string }> = Array.isArray(body.materialFiles) ? body.materialFiles : []
      const prompt = [body.description, body.trainingObjective, body.knowledgeMaterial, body.additionalInstruction]
        .filter(Boolean)
        .join(' · ')
      const job: JobState = {
        id: s.nextJobId++,
        language,
        prompt,
        attachmentNames: files.map((file) => file?.name || '未命名素材'),
        brandIds: Array.isArray(body.brandIds) ? body.brandIds : [],
        categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds : [],
        productIds: Array.isArray(body.productIds) ? body.productIds : [],
        generateHomeworkSync: body.generateHomeworkSync !== false,
        partCount: 2,
        phase: 'clarify',
        phaseStartedAt: Date.now(),
        createdAt: Date.now(),
        answers: {},
        history: []
      }
      s.jobs.push(job)
      saveStore()
      return snapshot(job)
    }
  },
  {
    method: 'GET',
    path: '/ai/courseware/generation-task/get',
    handler: (ctx: MockCtx) => {
      const job = jobOf(ctx)
      advance(job)
      saveStore()
      return snapshot(job)
    }
  },
  {
    method: 'GET',
    path: '/ai/courseware/generation-task/active',
    handler: () => {
      const job = activeJob()
      return job ? snapshot(job) : null
    }
  },
  {
    method: 'POST',
    path: '/ai/courseware/generation-task/answer',
    handler: (ctx: MockCtx) => {
      const job = jobOf(ctx)
      const answers: Array<{ id: string; value: string; note?: string }> = ctx.body?.answers || []
      const questions = demoQuestions(job.language)
      answers.forEach((answer) => {
        job.answers[answer.id] = answer.value
        if (answer.id === 'split') {
          job.partCount = answer.value === 'one' ? 1 : 2
        }
      })
      job.history.push({
        message:
          job.language === 'id'
            ? 'Terima kasih, saya susun ringkasan kebutuhan.'
            : '收到，我据此整理需求规格。',
        questions,
        answers: answers.map((answer) => ({
          questionId: answer.id,
          value: answer.value,
          ...(answer.note ? { note: answer.note } : {})
        }))
      })
      job.phase = 'summary'
      job.phaseStartedAt = Date.now()
      saveStore()
      advance(job)
      return snapshot(job)
    }
  },
  {
    method: 'POST',
    path: '/ai/courseware/generation-task/confirm',
    handler: (ctx: MockCtx) => {
      const job = jobOf(ctx)
      const body = ctx.body || {}
      if (body.confirmed === false) {
        job.phase = 'canceled'
        job.phaseStartedAt = Date.now()
        saveStore()
        return snapshot(job)
      }
      if (body.requirementEdits) {
        job.requirementEdits = { ...job.requirementEdits, ...body.requirementEdits }
      }
      if (Array.isArray(body.outlineEdits) && body.outlineEdits.length) {
        job.outlineEdits = body.outlineEdits
      }
      if (Array.isArray(body.selectedPartIndexes) && body.selectedPartIndexes.length) {
        job.selectedPartIndexes = body.selectedPartIndexes
        job.partCount = body.selectedPartIndexes.length
        job.phase = 'generating'
        job.phaseStartedAt = Date.now()
        saveStore()
        return snapshot(job)
      }
      // 需求确认 → 进入大纲拆分
      job.phase = 'splitting'
      job.phaseStartedAt = Date.now()
      saveStore()
      advance(job)
      return snapshot(job)
    }
  },
  {
    method: 'PUT',
    path: '/ai/courseware/generation-task/cancel',
    handler: (ctx: MockCtx) => {
      const job = jobOf(ctx)
      job.phase = 'canceled'
      job.phaseStartedAt = Date.now()
      saveStore()
      return snapshot(job)
    }
  },
  {
    method: 'POST',
    path: '/ai/courseware/generation-task/retry',
    handler: (ctx: MockCtx) => {
      const job = jobOf(ctx)
      advance(job)
      return snapshot(job)
    }
  },
  {
    method: 'GET',
    path: '/ai/courseware/generation-task/page-preview',
    handler: (ctx: MockCtx) => {
      const job = jobOf(ctx)
      advance(job)
      saveStore()
      const pageId = String(ctx.query.pageId || '')
      const seeds = demoPages(partsOf(job))
      const seed = seeds.find((item) => item.id === pageId)
      if (!seed) throw new MockError(404, `页面不存在：${pageId}`)
      return {
        pageId,
        version: job.phase === 'done' || job.phase === 'finalizing' ? 2 : 1,
        mediaPending: false,
        html: slidePreviewHtml({
          title: seed.title,
          summary: seed.summary,
          keyPoints: seed.keyPoints,
          partIndex: seed.partIndex,
          order: seed.order,
          courseTitle: titleOf(job)
        })
      }
    }
  },
  {
    method: 'POST',
    path: '/ai/courseware/homework/regenerate',
    handler: (ctx: MockCtx) => {
      const s = loadStore()
      const coursewareId = Number(ctx.query.coursewareId)
      const taskId = Number(ctx.query.generationTaskId)
      const job = s.jobs.find((item) => item.id === taskId) || activeJob()
      if (job) {
        advance(job)
        saveStore()
        const snap = snapshot(job) as Record<string, any>
        return {
          ...snap,
          coursewareId: snap.coursewareId || coursewareId,
          homeworkGenerationStatus: 'imported',
          homeworkGenerationMode: 'mock',
          homeworkGenerationMessage:
            job.language === 'id'
              ? 'Soal tambahan berhasil dibuat dan diimpor.'
              : '附加题已生成并导入。'
        }
      }
      return {
        id: taskId || 0,
        status: 30,
        step: 'completed',
        done: true,
        coursewareId,
        homeworkGenerationStatus: 'imported',
        progress: 100
      }
    }
  },

  /* ---------------- 能力 / 素材上传会话 ---------------- */
  {
    method: 'GET',
    path: '/ai/courseware/salesboost/file-capabilities',
    handler: () => FILE_CAPABILITIES
  },
  {
    method: 'POST',
    path: '/infra/file/upload-session/init',
    handler: (ctx: MockCtx) => {
      const uploadId = `mock-upload-${Date.now()}`
      const name = String(ctx.body?.name || 'upload.bin')
      return {
        uploadId,
        configId: 1,
        provider: 'local_demo',
        mode: 'local_demo',
        bucket: 'beauty-ai-demo',
        region: 'ap-jakarta',
        endpoint: 'local://demo',
        objectKey: `browser-upload/1/${uploadId}/${name}`,
        presignedUploadUrl: '',
        objectUrl: ''
      }
    }
  },
  {
    method: 'POST',
    path: '/infra/file/upload-session/refresh',
    handler: (ctx: MockCtx) => ({
      uploadId: String(ctx.body?.uploadId || 'mock-upload'),
      configId: 1,
      provider: 'local_demo',
      mode: 'local_demo',
      objectKey: 'browser-upload/1/refresh',
      presignedUploadUrl: ''
    })
  },
  {
    method: 'POST',
    path: '/infra/file/upload-session/complete',
    handler: (ctx: MockCtx) => {
      const name = String(ctx.body?.name || 'upload.bin')
      return {
        uploadId: String(ctx.body?.uploadId || 'mock-upload'),
        configId: 1,
        provider: 'local_demo',
        mode: 'local_demo',
        objectKey: String(ctx.body?.objectKey || `browser-upload/1/${name}`),
        objectUrl: `/mock/files/${encodeURIComponent(name)}`
      }
    }
  },
  {
    method: 'POST',
    path: '/infra/file/upload-session/abort',
    handler: () => true
  },

  /* ---------------- 音色 / 品牌品类产品 ---------------- */
  {
    method: 'GET',
    path: '/ai-resource/voice/list',
    handler: (ctx: MockCtx) => {
      const lang = String(ctx.query.lang || '').toLowerCase()
      const normalized = lang.startsWith('id') ? 'id' : lang.startsWith('en') ? 'en' : 'cn'
      const list = DEMO_VOICES.filter((voice) => voice.lang === normalized)
      return list.length ? list : DEMO_VOICES
    }
  },
  {
    method: 'GET',
    path: '/category/brand/list',
    handler: () => loadStore().brands
  },
  {
    method: 'POST',
    path: '/category/brand/create',
    handler: (ctx: MockCtx) => {
      const s = loadStore()
      const name = String(ctx.body?.name || '').trim()
      if (!name) throw new MockError(400, '品牌名不能为空')
      const exist = s.brands.find((brand) => brand.name === name)
      if (exist) return exist.id
      const id = Math.max(0, ...s.brands.map((brand) => brand.id)) + 1
      s.brands.push({ id, name, sort: s.brands.length + 1 })
      saveStore()
      return id
    }
  },
  {
    method: 'GET',
    path: '/category/list',
    handler: () => loadStore().categories
  },
  {
    method: 'POST',
    path: '/category/create',
    handler: (ctx: MockCtx) => {
      const s = loadStore()
      const body = ctx.body || {}
      const brand = s.brands.find((item) => item.id === body.brandId)
      const id = Math.max(0, ...s.categories.map((item) => item.id)) + 1
      s.categories.push({
        id,
        brandId: body.brandId,
        parentId: body.parentId,
        name: body.name,
        pathName: brand ? `${brand.name} · ${body.name}` : body.name,
        sort: s.categories.length + 1
      })
      saveStore()
      return id
    }
  },
  {
    method: 'POST',
    path: '/category/tag/create',
    handler: () => true
  },
  {
    method: 'GET',
    path: '/ai-training/product/page',
    handler: (ctx: MockCtx) => {
      const s = loadStore()
      const categoryId = Number(ctx.query.categoryId)
      const list = s.products.filter((product) => !categoryId || product.categoryId === categoryId)
      return { list, total: list.length }
    }
  },
  {
    method: 'POST',
    path: '/ai-training/product/create',
    handler: (ctx: MockCtx) => {
      const s = loadStore()
      const body = ctx.body || {}
      const id = Math.max(0, ...s.products.map((item) => item.id)) + 1
      s.products.push({
        id,
        brandId: body.brandId,
        categoryId: body.categoryId,
        name: body.name,
        sort: s.products.length + 1
      })
      saveStore()
      return id
    }
  },

  /* ---------------- 课件目录 / 库 ---------------- */
  {
    method: 'GET',
    path: '/ai/courseware/catalog/options',
    handler: () => {
      const s = loadStore()
      return { brands: s.brands, categories: s.categories, products: s.products }
    }
  },
  {
    method: 'GET',
    path: '/ai/courseware/catalog/relation',
    handler: (ctx: MockCtx) => {
      const item = coursewareOf(Number(ctx.query.coursewareId))
      return {
        coursewareId: Number(ctx.query.coursewareId),
        brandIds: item?.brandIds || [],
        categoryIds: item?.categoryIds || [],
        productIds: item?.productIds || []
      }
    }
  },
  {
    method: 'PUT',
    path: '/ai/courseware/catalog/relation',
    handler: (ctx: MockCtx) => {
      const body = ctx.body || {}
      const item = coursewareOf(Number(body.coursewareId))
      if (item) {
        item.brandIds = body.brandIds || []
        item.categoryIds = body.categoryIds || []
        item.productIds = body.productIds || []
        saveStore()
      }
      return {
        coursewareId: body.coursewareId,
        brandIds: body.brandIds || [],
        categoryIds: body.categoryIds || [],
        productIds: body.productIds || []
      }
    }
  },
  {
    method: 'GET',
    path: '/ai/courseware/tags',
    handler: () => {
      const tags = new Set<string>()
      loadStore().coursewares.forEach((item) => item.tags.forEach((tag) => tags.add(tag)))
      return [...tags]
    }
  },
  {
    method: 'GET',
    path: '/ai/courseware/page',
    handler: (ctx: MockCtx) => {
      const s = loadStore()
      const keyword = String(ctx.query.keyword || '').trim()
      const status = ctx.query.status === undefined || ctx.query.status === '' ? undefined : Number(ctx.query.status)
      const tags = String(ctx.query.tags || '')
        .split(',')
        .filter(Boolean)
      const list = s.coursewares.filter((item) => {
        if (keyword && !item.title.includes(keyword)) return false
        if (status !== undefined && item.status !== status) return false
        if (tags.length && !tags.every((tag) => item.tags.includes(tag))) return false
        return true
      })
      const pageNo = Number(ctx.query.pageNo || 1)
      const pageSize = Number(ctx.query.pageSize || 10)
      const start = (pageNo - 1) * pageSize
      return {
        list: list.slice(start, start + pageSize).map(toCoursewareVO),
        total: list.length
      }
    }
  },
  {
    method: 'GET',
    path: '/ai/courseware/get',
    handler: (ctx: MockCtx) => {
      const item = coursewareOf(Number(ctx.query.id))
      if (!item) throw new MockError(404, `课件不存在：${ctx.query.id}`)
      return toCoursewareVO(item)
    }
  },
  {
    method: 'PUT',
    path: '/ai/courseware/publish',
    handler: (ctx: MockCtx) => {
      const item = coursewareOf(Number(ctx.query.id))
      if (item) {
        item.status = 20
        item.publishTime = formatTime(new Date())
        saveStore()
      }
      return true
    }
  },
  {
    method: 'PUT',
    path: '/ai/courseware/unpublish',
    handler: (ctx: MockCtx) => {
      const item = coursewareOf(Number(ctx.query.id))
      if (item) {
        item.status = 10
        saveStore()
      }
      return true
    }
  },
  {
    method: 'PUT',
    path: '/ai/courseware/update-title',
    handler: (ctx: MockCtx) => {
      const item = coursewareOf(Number(ctx.body?.id))
      if (item && ctx.body?.title) {
        item.title = String(ctx.body.title)
        saveStore()
      }
      return true
    }
  },
  {
    method: 'DELETE',
    path: '/ai/courseware/delete',
    handler: (ctx: MockCtx) => {
      const s = loadStore()
      const id = Number(ctx.query.id)
      s.coursewares = s.coursewares.filter((item) => item.id !== id)
      saveStore()
      return true
    }
  },
  {
    method: 'GET',
    path: '/ai/courseware/copy-link',
    handler: (ctx: MockCtx) => `/mock-classroom.html?coursewareId=${ctx.query.id}`
  },
  {
    method: 'POST',
    path: '/ai/courseware/sync-cover-url',
    handler: (ctx: MockCtx) => coursewareOf(Number(ctx.query.id))?.coverUrl || ''
  },
  {
    method: 'GET',
    path: '/ai/courseware/salesboost/embed',
    handler: (ctx: MockCtx) => {
      const id = Number(ctx.query.id)
      const item = coursewareOf(id)
      return {
        url: '/mock-classroom.html',
        token: `mock-embed-token-${id}`,
        expiresAt: Date.now() + 3600 * 1000,
        coursewareId: id,
        classroomId: item ? `classroom-${item.id}` : `classroom-${id}`
      }
    }
  }
]
