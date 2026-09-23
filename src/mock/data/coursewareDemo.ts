/**
 * 课件生成演示数据。
 *
 * 内容取自 Beauty-AI 原型（Y.O.U Barrier Shield 修护精华 · 门店话术进阶课），
 * 用于本地 mock 的「澄清问答 → 需求确认 → 大纲拆分 → 逐页生成 → 完成预览」全链路。
 */
export type DemoLang = 'cn' | 'en' | 'id'

export interface DemoBrand {
  id: number
  name: string
  sort?: number
}

export interface DemoCategory {
  id: number
  brandId: number
  parentId?: number
  name: string
  pathName?: string
  sort?: number
}

export interface DemoProduct {
  id: number
  brandId: number
  categoryId: number
  name: string
  sort?: number
}

export const DEMO_BRANDS: DemoBrand[] = [
  { id: 1, name: 'Y.O.U', sort: 1 },
  { id: 2, name: 'HY Amino', sort: 2 },
  { id: 3, name: 'BNB', sort: 3 },
  { id: 4, name: 'DZ Supor', sort: 4 }
]

export const DEMO_CATEGORIES: DemoCategory[] = [
  { id: 11, brandId: 1, name: '护肤', pathName: 'Y.O.U · 护肤', sort: 1 },
  { id: 12, brandId: 1, name: '彩妆', pathName: 'Y.O.U · 彩妆', sort: 2 },
  { id: 21, brandId: 2, name: '护肤', pathName: 'HY Amino · 护肤', sort: 1 },
  { id: 22, brandId: 2, name: '身体护理', pathName: 'HY Amino · 身体护理', sort: 2 },
  { id: 31, brandId: 3, name: '唇部彩妆', pathName: 'BNB · 唇部彩妆', sort: 1 },
  { id: 41, brandId: 4, name: '护肤', pathName: 'DZ Supor · 护肤', sort: 1 }
]

export const DEMO_PRODUCTS: DemoProduct[] = [
  { id: 101, brandId: 1, categoryId: 11, name: 'Barrier Shield 修护精华', sort: 1 },
  { id: 102, brandId: 1, categoryId: 11, name: 'Barrier Shield 修护面霜', sort: 2 },
  { id: 103, brandId: 1, categoryId: 12, name: 'Velvet Matte 唇釉', sort: 1 },
  { id: 201, brandId: 2, categoryId: 21, name: '氨基酸洁面慕斯', sort: 1 },
  { id: 202, brandId: 2, categoryId: 22, name: '氨基酸身体乳', sort: 1 },
  { id: 301, brandId: 3, categoryId: 31, name: 'Peach 水光唇釉', sort: 1 },
  { id: 401, brandId: 4, categoryId: 41, name: 'Supor 高保湿精华', sort: 1 }
]

/** 音色列表（narrator 选择用）。 */
export const DEMO_VOICES = [
  { id: 1, voiceId: 'id-female-siti', voiceName: 'Siti（印尼语女声·亲和）', gender: 2, lang: 'id' },
  { id: 2, voiceId: 'id-male-budi', voiceName: 'Budi（印尼语男声·讲解）', gender: 1, lang: 'id' },
  { id: 3, voiceId: 'cn-female-xiaoya', voiceName: '小雅（中文女声·培训）', gender: 2, lang: 'cn' },
  { id: 4, voiceId: 'en-female-ava', voiceName: 'Ava（英文女声·培训）', gender: 2, lang: 'en' }
]

/** 可上传的素材类型与能力（与生产口径一致）。 */
export const FILE_CAPABILITIES = {
  fileTypes: [
    {
      extension: 'pptx',
      mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      maxSizeBytes: 524288000,
      parse: true,
      direct: true,
      enabled: true,
      label: 'PowerPoint .pptx',
      supportedModes: ['parse', 'direct']
    },
    {
      extension: 'pdf',
      mimeTypes: ['application/pdf'],
      maxSizeBytes: 524288000,
      parse: true,
      direct: false,
      enabled: true,
      label: 'PDF .pdf',
      supportedModes: ['parse']
    },
    {
      extension: 'docx',
      mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      maxSizeBytes: 104857600,
      parse: true,
      direct: false,
      enabled: true,
      label: 'Word .docx',
      supportedModes: ['parse']
    },
    {
      extension: 'mp4',
      mimeTypes: ['video/mp4'],
      maxSizeBytes: 1073741824,
      parse: true,
      direct: false,
      enabled: true,
      label: '视频 .mp4',
      supportedModes: ['parse']
    }
  ],
  supportedModes: ['parse', 'direct'],
  defaultMode: 'parse'
}

/* ------------------------------------------------------------------ *
 * 每份课件的内容：按语言给出问答 / 需求摘要 / 大纲
 * ------------------------------------------------------------------ */
const pick = <T>(lang: DemoLang, dict: { zh: T; id: T }): T => (lang === 'id' ? dict.id : dict.zh)

export interface DemoQuestionOption {
  id: string
  label: string
  description?: string
  recommended?: boolean
}

export interface DemoQuestion {
  id: string
  question: string
  reason?: string
  required: boolean
  options: DemoQuestionOption[]
  recommendedOptionId: string
  allowCustom: boolean
}

const QUESTIONS_ZH: DemoQuestion[] = [
  {
    id: 'audience',
    question: '这次课件主要讲给谁听？',
    reason: '受众决定案例选材与口播用词',
    required: true,
    allowCustom: false,
    recommendedOptionId: 'store-ba',
    options: [
      { id: 'store-ba', label: '直营门店 BA', description: '印尼直营 128 家门店', recommended: true },
      { id: 'new-ba', label: '新入职 BA（3 个月内）' },
      { id: 'agency', label: '代理商店主' },
      { id: 'trainer', label: '区域培训师' }
    ]
  },
  {
    id: 'scenario',
    question: '课程要优先解决哪类柜台场景？',
    reason: '先聚焦一类场景，成课更快也更好演练',
    required: true,
    allowCustom: false,
    recommendedOptionId: 'price',
    options: [
      { id: 'price', label: '价格异议', description: '顾客说“太贵了”时的回应', recommended: true },
      { id: 'ingredient', label: '成分与安全疑问' },
      { id: 'cross-sell', label: '连带与复购' },
      { id: 'new-launch', label: '新品首推' }
    ]
  },
  {
    id: 'split',
    question: '课件要不要拆成多个子课件？',
    reason: '拆分后分别生成，便于按门店节奏分批下发',
    required: true,
    allowCustom: false,
    recommendedOptionId: 'two',
    options: [
      { id: 'two', label: '拆成 2 个子课件', recommended: true },
      { id: 'one', label: '先做一个完整课件' },
      { id: 'auto', label: '由你判断' }
    ]
  },
  {
    id: 'duration',
    question: '每个子课件的目标时长？',
    required: true,
    allowCustom: false,
    recommendedOptionId: 'd5',
    options: [
      { id: 'd5', label: '5 分钟左右', recommended: true },
      { id: 'd8', label: '8 分钟' },
      { id: 'd10', label: '10 分钟' }
    ]
  },
  {
    id: 'style',
    question: '授课风格偏向哪种？',
    required: false,
    allowCustom: true,
    recommendedOptionId: 'real-talk',
    options: [
      { id: 'real-talk', label: '真实柜台对话为主', recommended: true },
      { id: 'knowledge', label: '知识点讲解为主' },
      { id: 'quiz', label: '练习与测验为主' }
    ]
  }
]

const QUESTIONS_ID: DemoQuestion[] = [
  {
    id: 'audience',
    question: 'Materi ini terutama untuk siapa?',
    reason: 'Audiens menentukan pilihan kasus dan gaya bahasa narasi',
    required: true,
    allowCustom: false,
    recommendedOptionId: 'store-ba',
    options: [
      { id: 'store-ba', label: 'BA toko langsung', description: '128 toko langsung di Indonesia', recommended: true },
      { id: 'new-ba', label: 'BA baru (di bawah 3 bulan)' },
      { id: 'agency', label: 'Pemilik toko agensi' },
      { id: 'trainer', label: 'Trainer regional' }
    ]
  },
  {
    id: 'scenario',
    question: 'Situasi counter mana yang paling perlu diselesaikan?',
    reason: 'Fokus satu situasi membuat materi lebih cepat jadi dan mudah dilatihkan',
    required: true,
    allowCustom: false,
    recommendedOptionId: 'price',
    options: [
      { id: 'price', label: 'Keberatan harga', description: 'Saat pelanggan bilang “terlalu mahal”', recommended: true },
      { id: 'ingredient', label: 'Pertanyaan bahan & keamanan' },
      { id: 'cross-sell', label: 'Cross-sell & repeat order' },
      { id: 'new-launch', label: 'Peluncuran produk baru' }
    ]
  },
  {
    id: 'split',
    question: 'Materi perlu dipecah menjadi beberapa sub-materi?',
    reason: 'Jika dipecah, tiap bagian dibuat terpisah agar mudah dibagikan bertahap per toko',
    required: true,
    allowCustom: false,
    recommendedOptionId: 'two',
    options: [
      { id: 'two', label: 'Pecah menjadi 2 sub-materi', recommended: true },
      { id: 'one', label: 'Satu materi lengkap dulu' },
      { id: 'auto', label: 'Terserah penilaian Anda' }
    ]
  },
  {
    id: 'duration',
    question: 'Target durasi tiap sub-materi?',
    required: true,
    allowCustom: false,
    recommendedOptionId: 'd5',
    options: [
      { id: 'd5', label: 'Sekitar 5 menit', recommended: true },
      { id: 'd8', label: '8 menit' },
      { id: 'd10', label: '10 menit' }
    ]
  },
  {
    id: 'style',
    question: 'Gaya penyampaian yang diinginkan?',
    required: false,
    allowCustom: true,
    recommendedOptionId: 'real-talk',
    options: [
      { id: 'real-talk', label: 'Dominan dialog counter nyata', recommended: true },
      { id: 'knowledge', label: 'Dominan penjelasan materi' },
      { id: 'quiz', label: 'Dominan latihan & kuis' }
    ]
  }
]

export const demoQuestions = (lang: DemoLang): DemoQuestion[] =>
  pick(lang, { zh: QUESTIONS_ZH, id: QUESTIONS_ID })

/* ------------------------------------------------------------------ *
 * 需求摘要
 * ------------------------------------------------------------------ */
export interface DemoOutlineDraft {
  id: string
  title: string
  description: string
  keyPoints: string[]
}

export interface DemoPartPlan {
  partIndex: number
  partCount: number
  title: string
  estimatedDurationSeconds: number
  outlineCount: number
  outlines: Array<DemoOutlineDraft & { type: 'slide' | 'quiz' | 'interactive' | 'pbl' }>
}

interface DemoContentSet {
  title: string
  audience: string
  objective: string
  mustInclude: string[]
  mustExclude: string[]
  optional: string[]
  assumptions: string[]
  sections: DemoOutlineDraft[]
  parts: Array<{ title: string; outlines: Array<DemoOutlineDraft & { type: DemoPartPlan['outlines'][number]['type'] }> }>
}

const CONTENT_ZH: DemoContentSet = {
  title: 'Y.O.U Barrier Shield 价格异议应对',
  audience: '印尼直营门店 BA',
  objective: '能独立完成价格异议的三步回应，并在柜台完成一次带试用动作的演练',
  mustInclude: ['价格锚点换算', '三层屏障举证', '试用动作收尾'],
  mustExclude: ['与竞品做贬低式对比', '承诺医疗功效'],
  optional: ['折扣权限说明'],
  assumptions: ['学员已通过产品知识基础考核', '按 5 分钟课时设计，不含课后作业'],
  sections: [
    {
      id: 'sec-1',
      title: '顾客为什么说贵',
      description: '把“贵”翻译成不确定，先处理情绪再讲价值',
      keyPoints: ['三句认可话术', '把价格换算成单次使用成本', '不做反驳式回应']
    },
    {
      id: 'sec-2',
      title: '三层屏障举证',
      description: '用神经酰胺与屏障修护解释价格合理性',
      keyPoints: ['成分与功效的对应关系', '举证顺序：痛点 → 机制 → 结果', '用顾客自己的皮肤状态收口']
    },
    {
      id: 'sec-3',
      title: '试用动作收尾',
      description: '把异议转成一次现场试用',
      keyPoints: ['邀请试用的标准话术', '留客动作与二次到店', '记录顾客反馈']
    }
  ],
  parts: [
    {
      title: '第 1 部分 · 价格异议的三步回应',
      outlines: [
        {
          id: 'p1-o1',
          type: 'slide',
          title: '价格异议的真实来源',
          description: '顾客说的“贵”，多数时候是不确定值不值',
          keyPoints: ['先认可价格感受，不急着解释成分', '把“贵”翻译成“不确定”', '三句话完成情绪落地']
        },
        {
          id: 'p1-o2',
          type: 'slide',
          title: '把价格换算成单次使用成本',
          description: '用对比口径降低价格感知',
          keyPoints: ['按每次 0.8ml 计算单次成本', '与一杯咖啡做同量级对比', '避免直接说“其实不贵”']
        },
        {
          id: 'p1-o3',
          type: 'quiz',
          title: '小测：价格异议的三步回应',
          description: '用 3 道题确认学员记住了顺序',
          keyPoints: ['第 1 步是认可还是解释？', '单次成本怎么算？', '收尾动作是什么？']
        }
      ]
    },
    {
      title: '第 2 部分 · 柜台演练与跟进',
      outlines: [
        {
          id: 'p2-o1',
          type: 'slide',
          title: '三层屏障举证话术',
          description: '神经酰胺 + 屏障修护 + 复购口碑',
          keyPoints: ['举证顺序：痛点 → 机制 → 结果', '用顾客皮肤状态收口', '给一个明确的下一步']
        },
        {
          id: 'p2-o2',
          type: 'interactive',
          title: '角色扮演：顾客要求再打折',
          description: '学员扮演 BA，AI 扮演要折扣的顾客',
          keyPoints: ['坚持价格锚点', '用试用替代折扣', '结束时复述承诺']
        },
        {
          id: 'p2-o3',
          type: 'pbl',
          title: '课后任务：一周试用跟进',
          description: '带 3 位顾客完成试用并回传反馈',
          keyPoints: ['记录试用顾客名单', '第 3 天回访', '汇总一条门店经验']
        }
      ]
    }
  ]
}

const CONTENT_ID: DemoContentSet = {
  title: 'Menangani Keberatan Harga Y.O.U Barrier Shield',
  audience: 'BA toko langsung di Indonesia',
  objective: 'Mampu menjalankan tiga langkah menangani keberatan harga dan melakukan satu latihan di counter',
  mustInclude: ['Konversi harga per pemakaian', 'Bukti tiga lapis barrier', 'Penutup dengan ajakan mencoba'],
  mustExclude: ['Membandingkan pesaing secara merendahkan', 'Menjanjikan klaim medis'],
  optional: ['Penjelasan wewenang diskon'],
  assumptions: ['Peserta sudah lulus asesmen dasar produk', 'Dirancang untuk 5 menit, tanpa tugas tambahan'],
  sections: [
    {
      id: 'sec-1',
      title: 'Mengapa pelanggan merasa mahal',
      description: 'Ubah “mahal” menjadi keraguan, tangani emosi lebih dulu',
      keyPoints: ['Tiga kalimat validasi', 'Konversi harga ke biaya per pemakaian', 'Hindari respons membantah']
    },
    {
      id: 'sec-2',
      title: 'Bukti tiga lapis barrier',
      description: 'Jelaskan kewajaran harga lewat ceramide dan perbaikan barrier',
      keyPoints: ['Kaitan bahan dan manfaat', 'Urutan bukti: masalah → mekanisme → hasil', 'Tutup dengan kondisi kulit pelanggan']
    },
    {
      id: 'sec-3',
      title: 'Penutup dengan ajakan mencoba',
      description: 'Ubah keberatan menjadi satu percobaan langsung',
      keyPoints: ['Kalimat standar mengajak coba', 'Tindak lanjut kunjungan kedua', 'Catat umpan balik pelanggan']
    }
  ],
  parts: [
    {
      title: 'Bagian 1 · Tiga langkah menangani keberatan harga',
      outlines: [
        {
          id: 'p1-o1',
          type: 'slide',
          title: 'Sumber sebenarnya keberatan harga',
          description: 'Saat pelanggan bilang “mahal”, umumnya itu keraguan nilai',
          keyPoints: ['Validasi dulu, jangan langsung jelaskan bahan', 'Ubah “mahal” menjadi “ragu”', 'Tiga kalimat menenangkan']
        },
        {
          id: 'p1-o2',
          type: 'slide',
          title: 'Hitung harga per pemakaian',
          description: 'Turunkan persepsi harga dengan perbandingan',
          keyPoints: ['Hitung 0,8ml per pemakaian', 'Bandingkan dengan harga satu kopi', 'Hindari kalimat “sebenarnya tidak mahal”']
        },
        {
          id: 'p1-o3',
          type: 'quiz',
          title: 'Kuis: tiga langkah keberatan harga',
          description: 'Tiga soal untuk memastikan urutannya diingat',
          keyPoints: ['Langkah pertama validasi atau penjelasan?', 'Bagaimana menghitung biaya per pemakaian?', 'Apa langkah penutupnya?']
        }
      ]
    },
    {
      title: 'Bagian 2 · Latihan counter & tindak lanjut',
      outlines: [
        {
          id: 'p2-o1',
          type: 'slide',
          title: 'Skrip bukti tiga lapis barrier',
          description: 'Ceramide + perbaikan barrier + reputasi repeat order',
          keyPoints: ['Urutan bukti: masalah → mekanisme → hasil', 'Tutup dengan kondisi kulit pelanggan', 'Beri satu langkah lanjutan yang jelas']
        },
        {
          id: 'p2-o2',
          type: 'interactive',
          title: 'Role play: pelanggan minta diskon lagi',
          description: 'Peserta berperan sebagai BA, AI berperan sebagai pelanggan',
          keyPoints: ['Pertahankan anchor harga', 'Tawarkan percobaan, bukan diskon', 'Ulangi komitmen di akhir']
        },
        {
          id: 'p2-o3',
          type: 'pbl',
          title: 'Tugas: tindak lanjut percobaan satu minggu',
          description: 'Ajak 3 pelanggan mencoba dan kirim umpan balik',
          keyPoints: ['Catat daftar pelanggan', 'Follow up hari ke-3', 'Rangkum satu pelajaran toko']
        }
      ]
    }
  ]
}

export const demoContent = (lang: DemoLang): DemoContentSet => pick(lang, { zh: CONTENT_ZH, id: CONTENT_ID })

/** 需求摘要（planningOutline = 三个章节）。 */
export const demoSummary = (lang: DemoLang) => {
  const content = demoContent(lang)
  return {
    planningOutline: content.sections.map(({ id, title, description, keyPoints }) => ({
      id,
      title,
      description,
      keyPoints
    })),
    title: content.title,
    audience: content.audience,
    objective: content.objective,
    language: lang,
    targetDurationMinutes: 5,
    deliveryFormat: lang === 'id' ? 'Narasi trainer + latihan counter' : '讲师口播 + 柜台演练',
    designDirection: {
      palette: ['#FBF7F4', '#A85F4B', '#2F2A2B', '#3B8F72'],
      typography: 'Inter / 思源黑体',
      layout: lang === 'id' ? 'Dua kolom: poin di kiri, produk di kanan' : '左右分栏：左侧要点，右侧产品图',
      imagery: lang === 'id' ? 'Foto situasi counter nyata' : '真实柜台场景照片',
      mood: lang === 'id' ? 'Profesional, ramah, meyakinkan' : '专业、温和、有说服力'
    },
    assumptions: content.assumptions,
    scope: {
      mustInclude: content.mustInclude,
      mustExclude: content.mustExclude,
      optional: content.optional
    }
  }
}

/** 子课件拆分计划（默认 2 个部分）。 */
export const demoParts = (lang: DemoLang, partCount = 2): DemoPartPlan[] => {
  const content = demoContent(lang)
  return content.parts.slice(0, Math.max(1, Math.min(partCount, content.parts.length))).map((part, index) => ({
    partIndex: index + 1,
    partCount: Math.max(1, Math.min(partCount, content.parts.length)),
    title: part.title,
    estimatedDurationSeconds: 300,
    outlineCount: part.outlines.length,
    outlines: part.outlines
  }))
}

/** 逐页生成的页面种子：一个大纲一页。 */
export const demoPages = (parts: DemoPartPlan[]) => {
  const pages: Array<{
    id: string
    outlineId: string
    partIndex: number
    order: number
    title: string
    summary: string
    keyPoints: string[]
  }> = []
  for (const part of parts) {
    part.outlines.forEach((outline, index) => {
      pages.push({
        id: `${part.partIndex}:${outline.id}`,
        outlineId: outline.id,
        partIndex: part.partIndex,
        order: index + 1,
        title: outline.title,
        summary: outline.description,
        keyPoints: outline.keyPoints
      })
    })
  }
  return pages
}

/* ------------------------------------------------------------------ *
 * 课件库种子数据（课件管理列表）
 * ------------------------------------------------------------------ */
export interface DemoCourseware {
  id: number
  title: string
  summary: string
  tags: string[]
  status: number
  brandIds: number[]
  categoryIds: number[]
  productIds: number[]
  coverUrl: string
  creatorName: string
  creator?: string
  createTime: string
  publishTime?: string
  viewCount: number
  learnerCount: number
  estimatedDurationSeconds: number
  previewUrl: string
  downloadUrl: string
}

const CLASSROOM = '/mock-classroom.html'

export const DEMO_COURSEWARES: DemoCourseware[] = [
  {
    id: 501,
    title: 'Y.O.U Barrier Shield 修护精华 · 门店话术进阶课',
    summary: '价格异议三步回应 + 三层屏障举证 + 柜台演练，5 分钟一节的印尼语口播课件。',
    tags: ['新品', '护肤', '价格异议'],
    status: 20,
    brandIds: [1],
    categoryIds: [11],
    productIds: [101],
    coverUrl: '/mock/cover-you.svg',
    creatorName: '总部培训 · Sarah',
    createTime: '2026-08-28 10:12:00',
    publishTime: '2026-09-01 09:30:00',
    viewCount: 1284,
    learnerCount: 342,
    estimatedDurationSeconds: 305,
    previewUrl: CLASSROOM,
    downloadUrl: '/mock/exports/you-barrier-shield.pptx'
  },
  {
    id: 502,
    title: 'HY Amino 新品卖点速成 · 氨基酸洁面',
    summary: '面向直营门店的开架话术速成课，含 3 道随堂小测。',
    tags: ['新品', '护肤'],
    status: 20,
    brandIds: [2],
    categoryIds: [21],
    productIds: [201],
    coverUrl: '/mock/cover-hyamino.svg',
    creatorName: '总部培训 · Sarah',
    createTime: '2026-08-14 15:02:00',
    publishTime: '2026-08-18 11:00:00',
    viewCount: 962,
    learnerCount: 288,
    estimatedDurationSeconds: 268,
    previewUrl: CLASSROOM,
    downloadUrl: '/mock/exports/hy-amino.pptx'
  },
  {
    id: 503,
    title: 'BNB Peach 水光唇釉 · 连带与复购',
    summary: '唇釉与护肤的连带组合，针对客流下滑门店。',
    tags: ['彩妆', '连带'],
    status: 10,
    brandIds: [3],
    categoryIds: [31],
    productIds: [301],
    coverUrl: '/mock/cover-bnb.svg',
    creatorName: '南区培训 · Fitriani',
    createTime: '2026-09-05 09:41:00',
    viewCount: 0,
    learnerCount: 0,
    estimatedDurationSeconds: 240,
    previewUrl: CLASSROOM,
    downloadUrl: '/mock/exports/bnb-peach.pptx'
  },
  {
    id: 504,
    title: '敏感肌顾客安抚与转介绍',
    summary: '急性过敏期的安抚话术与不做承诺的边界。',
    tags: ['敏感肌', '服务力'],
    status: 20,
    brandIds: [1, 2],
    categoryIds: [11, 21],
    productIds: [102],
    coverUrl: '/mock/cover-sensitive.svg',
    creatorName: '总部培训 · Sarah',
    createTime: '2026-07-30 13:20:00',
    publishTime: '2026-08-02 10:00:00',
    viewCount: 731,
    learnerCount: 196,
    estimatedDurationSeconds: 288,
    previewUrl: CLASSROOM,
    downloadUrl: '/mock/exports/sensitive-skin.pptx'
  },
  {
    id: 505,
    title: 'DZ Supor 高客单成交拆解',
    summary: '高客单顾客的决策路径与三次异议处理，草稿待补录试。',
    tags: ['护肤', '高客单'],
    status: 0,
    brandIds: [4],
    categoryIds: [41],
    productIds: [401],
    coverUrl: '/mock/cover-dz.svg',
    creatorName: '北区培训 · Dewi',
    createTime: '2026-09-12 16:55:00',
    viewCount: 0,
    learnerCount: 0,
    estimatedDurationSeconds: 320,
    previewUrl: CLASSROOM,
    downloadUrl: '/mock/exports/dz-supor.pptx'
  }
]

/** 逐页预览 HTML（工作台右侧 1280×720 缩略/预览，与 SeriesPageCover 一致）。 */
export const slidePreviewHtml = (options: {
  title: string
  summary: string
  keyPoints: string[]
  partIndex: number
  order: number
  courseTitle: string
}) => {
  const { title, summary, keyPoints, partIndex, order } = options
  const list = keyPoints
    .map(
      (point, index) =>
        `<li><b>${String(index + 1).padStart(2, '0')}</b><span>${escapeHtml(point)}</span></li>`
    )
    .join('')
  return `<!doctype html><html lang="id"><head><meta charset="utf-8" />
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Inter","Helvetica Neue","PingFang SC",Arial,sans-serif;background:#f6f2ef;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
  .slide{width:1120px;height:630px;background:#fffdfc;border:1px solid #e7e2df;border-radius:18px;box-shadow:0 18px 40px -22px rgba(28,25,23,.35);padding:48px 56px;display:flex;flex-direction:column;gap:16px;position:relative;overflow:hidden}
  .idx{position:absolute;right:44px;top:22px;font-size:64px;font-weight:800;color:#f2ebe7}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#a85f4b;background:#fbf3f0;border:1px solid #f0d8d0;border-radius:20px;padding:5px 12px;width:fit-content}
  h1{font-size:32px;line-height:1.25;letter-spacing:-.02em;color:#1c1917;max-width:24ch;position:relative;z-index:1}
  .sub{font-size:14px;color:#78716c;border-bottom:2px solid #f0e6e1;padding-bottom:12px;max-width:56ch;position:relative;z-index:1}
  ul{display:grid;gap:10px;margin-top:4px;position:relative;z-index:1}
  li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:#44403c;background:#faf8f6;border:1px solid #f2ece8;border-radius:10px;padding:12px 14px;list-style:none}
  li b{color:#a85f4b;font-weight:700;font-variant-numeric:tabular-nums}
  .foot{margin-top:auto;display:flex;justify-content:space-between;font-size:12px;color:#827972;border-top:1px dashed #e7e2df;padding-top:12px}
</style></head>
<body><div class="slide">
  <div class="idx">${String(order).padStart(2, '0')}</div>
  <span class="eyebrow">${escapeHtml(options.courseTitle)}</span>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(summary)}</p>
  <ul>${list}</ul>
  <div class="foot"><span>Bagian ${partIndex} · Halaman ${order}</span><span>${partIndex}.${order}</span></div>
</div></body></html>`
}

export const escapeHtml = (value: string) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
