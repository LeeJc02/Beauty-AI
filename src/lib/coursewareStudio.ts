/**
 * 在线课件 ·「生成新课件」演示数据与状态机
 *
 * 从 SalesBoost-vue（test 分支）的 `src/views/courseware/create/` 复刻而来：
 * VO 字段名、状态码、阶段串、文案都与后端 `AiCoursewareGenerationTaskRespVO`
 * 和 `coursewareCreate.*` / `coursewareStudio` 这套 i18n 保持一致，
 * 但数据全部是前端写死的演示数据（不打后端）。
 *
 * 纯函数层：不依赖 React，不写状态。界面只负责把 task 渲染成共创工作台。
 */

/* ------------------------------------------------------------------ 类型 */

export type CourseKind = "auto" | "experience" | "operation" | "knowledge";
export type GenerationLanguage = "cn" | "en" | "id";
export type PartState = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
export type PageState = "waiting" | "generating" | "retrying" | "completed" | "failed";
export type OutlineType = "slide" | "quiz" | "interactive" | "pbl";
export type GenerationPhase =
  | "sources"
  | "interview"
  | "plan"
  | "outline"
  | "pages"
  | "queued"
  | "generating_scenes"
  | "generating_media"
  | "generating_tts"
  | "persisting"
  | "finalizing"
  | "completed"
  | "failed"
  | "canceled";

export interface CwQuestionOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface CwQuestion {
  id: string;
  question: string;
  /** 「为什么问」 */
  reason?: string;
  required: boolean;
  options: CwQuestionOption[];
  recommendedOptionId?: string;
  /** 允许「None · 我自己填写」 */
  allowCustom?: boolean;
}

export interface CwAnswer {
  questionId: string;
  value: string;
  note?: string;
}

export interface CwRound {
  message?: string;
  questions: CwQuestion[];
  answers: CwAnswer[];
}

export interface CwOutline {
  id: string;
  type: OutlineType;
  title: string;
  description: string;
  keyPoints: string[];
}

export interface CwSummary {
  title?: string;
  audience?: string;
  objective?: string;
  language?: GenerationLanguage;
  targetDurationMinutes?: number;
  deliveryFormat?: string;
  planningOutline?: Omit<CwOutline, "type">[];
  assumptions?: string[];
  scope?: { mustInclude?: string[]; mustExclude?: string[]; optional?: string[] };
}

export interface CwPart {
  partIndex: number;
  partCount: number;
  title: string;
  estimatedDurationSeconds?: number;
  outlineCount?: number;
  outlines?: CwOutline[];
}

export interface CwPageState {
  id: string;
  outlineId: string;
  partIndex: number;
  order: number;
  title: string;
  summary: string;
  status: PageState;
  retryCount: number;
  maxRetries?: number;
  mediaPending: boolean;
  version: number;
  error?: string;
}

export interface CwSeriesItem {
  childJobId: string;
  coursewareId?: number | null;
  partIndex: number;
  partCount: number;
  title: string;
  status: PartState;
  progress?: number;
  retryCount?: number;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  estimatedDurationSeconds?: number;
  homeworkGenerationStatus?: string | null;
  homeworkGenerationMessage?: string | null;
  error?: string | null;
}

export interface CwTask {
  id: number;
  title?: string;
  /** 10 queued / 20 running / 21 waiting_for_user / 22 waiting_for_confirmation / 30 succeeded / 40 failed / 50 canceled */
  status: number;
  step: string;
  progress: number;
  done?: boolean;
  message?: string;
  errorMessage?: string;
  errorCode?: string;
  generation?: {
    phase: GenerationPhase;
    sourceSummary?: string;
    pages: CwPageState[];
    retry?: { phase: string; count: number; maxRetries?: number; retrying: boolean };
  };
  promptEnhancement?: {
    clarificationEligible?: boolean;
    clarificationRound?: number;
    message?: string;
    history?: CwRound[];
    questions?: CwQuestion[];
    knownRequirements?: Record<string, string>;
    assumptions?: string[];
    summary?: CwSummary;
  };
  partSelection?: {
    required: boolean;
    selectedPartIndexes?: number[];
    parts: CwPart[];
  };
  series?: { seriesId: string; title: string; items: CwSeriesItem[] };
  sourcePreparation?: { status: "pending" | "running" | "succeeded" | "failed"; error?: string };
  result?: {
    classroomId?: string;
    url?: string;
    previewUrl?: string;
    downloadUrl?: string;
    scenesCount?: number;
    exportUrls?: Record<string, string>;
  };
  generateHomeworkSync?: boolean;
  homeworkGenerationStatus?: string | null;
  homeworkGenerationMessage?: string | null;
  createTime?: string;
}

export interface CwUploadItem {
  uid: string;
  name: string;
  extension: string;
  size: number;
  progress: number;
  status: "ready" | "uploading" | "paused" | "failed" | "success";
  /** 失败原因（校验失败 / 网络中断），展示在文件名下面。 */
  error?: string;
  /** 已尝试次数：第一次失败后重试不再模拟中断。 */
  attempts?: number;
}

export interface CwForm {
  prompt: string;
  kind: CourseKind;
  files: CwUploadItem[];
  autoConfirm: boolean;
  /** 演示开关：走到「课件已完成、课后题失败」时停下，用于演示重试附加题。 */
  demoHomeworkFailure: boolean;
  language: GenerationLanguage;
  outlineEnhancement: boolean;
  generateHomeworkSync: boolean;
  enableImageGeneration: boolean;
  narratorVoiceId: string;
  mode: "ai-courseware" | "script-only";
  catalogLabel: string;
}

/* ------------------------------------------------------------------ 文案 */

export const CW_STEPS = ["梳理目标", "课程规划", "确认大纲", "生成课件"] as const;

export const CW_PHASES: Record<GenerationPhase, string> = {
  sources: "正在处理资料",
  interview: "补充课程信息",
  plan: "正在整理课程大纲",
  outline: "正在细化页面结构",
  pages: "正在逐页制作",
  queued: "等待开始",
  generating_scenes: "正在生成页面",
  generating_media: "正在生成媒体",
  generating_tts: "正在生成语音",
  persisting: "正在保存课件",
  finalizing: "正在整合课件",
  completed: "课件已完成",
  failed: "制作失败",
  canceled: "已取消",
};

export const CW_PHASE_HINTS: Record<GenerationPhase, string> = {
  sources: "读取资料内容，为课程方案提供依据。",
  interview: "补充必要信息后继续。",
  plan: "整理课程结构、章节目标和内容要点，完成后可直接修改并确认。",
  outline: "正在根据课程规划生成逐页大纲，完成后请确认；确认前不会制作页面。",
  pages: "完成一页即可预览；列表按已确认的大纲排序。",
  queued: "任务已排队，马上开始。",
  generating_scenes: "正在逐页生成内容，已完成的页面会保留在右侧。",
  generating_media: "页面已生成，正在处理图片和视频。",
  generating_tts: "页面已生成，正在处理语音。",
  persisting: "正在保存页面和课件数据。",
  finalizing: "页面内容已制作，正在整合媒体、保存课件和同步练习。",
  completed: "全部制作已完成。",
  failed: "本次制作未完成。",
  canceled: "本次制作已停止。",
};

export const CW_PAGE_STATES: Record<PageState, string> = {
  waiting: "等待制作",
  generating: "制作中",
  retrying: "自动重试中",
  completed: "页面已完成",
  failed: "制作失败",
};

export const CW_PART_STATES: Record<PartState, string> = {
  QUEUED: "等待制作",
  RUNNING: "制作中",
  SUCCEEDED: "已完成",
  FAILED: "制作失败",
  CANCELED: "已停止",
};

export const CW_OUTLINE_TYPES: Record<OutlineType, string> = {
  slide: "讲解页",
  quiz: "随堂练习",
  interactive: "互动活动",
  pbl: "情境任务",
};

export const CW_COURSE_KINDS: { value: CourseKind; label: string; icon: string }[] = [
  { value: "auto", label: "帮我判断", icon: "sparkles" },
  { value: "experience", label: "分享经验", icon: "message-square" },
  { value: "operation", label: "教会操作", icon: "list-checks" },
  { value: "knowledge", label: "讲清方法", icon: "book-open" },
];

export const CW_EXAMPLES = [
  "客户说“太贵了”，如何回应",
  "让新人掌握产品演示流程",
  "把一次成功成交复盘成课",
];

export const CW_LANGUAGES: { value: GenerationLanguage; label: string }[] = [
  { value: "cn", label: "中文" },
  { value: "en", label: "英文" },
  { value: "id", label: "印尼语" },
];

export const CW_NARRATORS = [
  { voiceId: "id-ID-SitiNeural", voiceName: "Siti · 印尼门店培训音色", gender: "女" },
  { voiceId: "id-ID-ArdiNeural", voiceName: "Ardi · 印尼讲师音色", gender: "男" },
  { voiceId: "zh-CN-XiaoxiaoNeural", voiceName: "晓晓 · 中文讲解音色", gender: "女" },
];

export const NONE_ANSWER = "__none__";

export const createCoursewareForm = (): CwForm => ({
  prompt: "",
  kind: "auto",
  files: [],
  /** 「直接完成」开关打开：不自动补任何东西，交给工作台自己 1 秒后推进。 */
  autoConfirm: false,
  /** 演示开关：走到「课件已完成、课后题失败」时停下，用于演示重试附加题。 */
  demoHomeworkFailure: false,
  language: "id",
  outlineEnhancement: true,
  generateHomeworkSync: true,
  enableImageGeneration: true,
  narratorVoiceId: "id-ID-SitiNeural",
  mode: "ai-courseware",
  catalogLabel: "Y.O.U · 护肤 · Barrier Shield 修护精华",
});

/* -------------------------------------------------- 演示数据：反问与摘要 */

const ROUND_ONE: CwQuestion[] = [
  {
    id: "q-audience",
    question: "这堂课主要讲给谁听？",
    reason: "决定案例的难度、话术颗粒度和讲解深度。",
    required: true,
    recommendedOptionId: "a-new",
    allowCustom: true,
    options: [
      {
        id: "a-new",
        label: "门店新品导购（入职 0-3 个月）",
        description: "刚上柜、还不敢开口讲价格的新人",
        recommended: true,
      },
      {
        id: "a-senior",
        label: "资深 BA 进阶训",
        description: "已经能讲卖点，想把异议处理做扎实",
      },
      {
        id: "a-manager",
        label: "店长带教",
        description: "需要一套可以转训给店员的标准动作",
      },
    ],
  },
  {
    id: "q-objective",
    question: "你希望学员课后能独立做到什么？",
    reason: "用它来判断页面要讲到哪里、练习要做到什么程度。",
    required: true,
    recommendedOptionId: "o-3min",
    allowCustom: true,
    options: [
      {
        id: "o-3min",
        label: "3 分钟内识别价格异议类型，并给出对应回应话术",
        recommended: true,
      },
      { id: "o-points", label: "能完整复述 Barrier Shield 的三层屏障卖点" },
      { id: "o-roleplay", label: "能完成一次完整的顾客角色扮演" },
    ],
  },
];

const ROUND_TWO: CwQuestion[] = [
  {
    id: "q-material",
    question: "素材上更想用真实门店案例，还是总部标准话术？",
    reason: "真实案例口语感更强，标准话术更统一、更适合转训。",
    required: true,
    recommendedOptionId: "m-real",
    allowCustom: true,
    options: [
      {
        id: "m-real",
        label: "用南区 Plaza Senayan 门店的真实成交案例",
        description: "口语更贴近顾客，新人更容易代入",
        recommended: true,
      },
      { id: "m-hq", label: "用总部标准话术模板" },
      { id: "m-both", label: "两者都要：案例 + 标准话术对照" },
    ],
  },
  {
    id: "q-boundary",
    question: "有没有不希望涉及的内容？",
    reason: "把边界说清楚，后面生成的内容就不会越界。",
    required: true,
    recommendedOptionId: "b-competitor",
    allowCustom: true,
    options: [
      { id: "b-competitor", label: "不要出现竞品贬损话术", recommended: true },
      { id: "b-discount", label: "不要涉及具体折扣幅度" },
      { id: "b-none", label: "没有特别限制" },
    ],
  },
];

const PLANNING_SECTIONS = [
  { id: "ol-01", title: "为什么顾客说“太贵了”", description: "拆解印尼年轻顾客的价格敏感心理", keyPoints: ["价格感知≠支付能力", "社媒比价习惯", "赠品敏感度"] },
  { id: "ol-02", title: "三类价格敏感顾客画像", description: "按预算 / 功效 / 赠品分型", keyPoints: ["预算型", "功效型", "赠品型"] },
  { id: "ol-03", title: "价格异议四步回应法", description: "认可—换算—举证—成交", keyPoints: ["先共情再回应", "换算单次使用成本", "用成分举证", "给出下一步动作"] },
  { id: "ol-04", title: "Barrier Shield 三层屏障", description: "用产品实拍讲解修护机理", keyPoints: ["神经酰胺", "减少水分流失", "肤感测试"] },
  { id: "ol-05", title: "南区门店真实案例复盘", description: "复盘 Plaza Senayan 的一次价格异议成交", keyPoints: ["顾客原话", "BA 的第一句话", "转折点"] },
  { id: "ol-06", title: "异议实战演练", description: "两人一组做角色扮演", keyPoints: ["预算型场景", "功效型场景", "赠品型场景"] },
  { id: "ol-07", title: "话术对照表", description: "不推荐说法 vs 推荐说法", keyPoints: ["避免直接让价", "避免贬损竞品"] },
  { id: "ol-08", title: "小结与课后练习", description: "回顾四步法并布置练习", keyPoints: ["回看三层屏障", "课后 10 题"] },
];

const PART_ONE_OUTLINES: CwOutline[] = [
  { id: "ol-01", type: "slide", title: "为什么顾客说“太贵了”", description: "拆解印尼年轻顾客的价格敏感心理", keyPoints: ["价格感知≠支付能力", "社媒比价习惯", "赠品敏感度"] },
  { id: "ol-02", type: "slide", title: "三类价格敏感顾客画像", description: "按预算 / 功效 / 赠品分型", keyPoints: ["预算型：先问预算区间", "功效型：先讲成分", "赠品型：先讲活动"] },
  { id: "ol-03", type: "slide", title: "价格异议四步回应法", description: "认可—换算—举证—成交", keyPoints: ["先共情再回应", "换算单次使用成本", "用成分举证", "给出下一步动作"] },
  { id: "ol-04", type: "interactive", title: "判断练习：这是哪一型顾客？", description: "看三句顾客原话，判断类型", keyPoints: ["terlalu mahal", "cocok di kulit aku?", "ada hadiahnya?"] },
  { id: "ol-05", type: "slide", title: "不推荐说法 vs 推荐说法", description: "同一场景的两种回应", keyPoints: ["不要直接让价", "不要贬损竞品"] },
  { id: "ol-06", type: "pbl", title: "情境任务：接住第一句话", description: "给出一句 15 秒内的开场回应", keyPoints: ["先认可价格感受", "再问使用场景"] },
];

const PART_TWO_OUTLINES: CwOutline[] = [
  { id: "ol-11", type: "slide", title: "Barrier Shield 三层屏障", description: "用产品实拍讲解修护机理", keyPoints: ["神经酰胺", "减少水分流失", "肤感测试"] },
  { id: "ol-12", type: "slide", title: "核心成分与配方思路", description: "把成分表翻译成顾客听得懂的话", keyPoints: ["神经酰胺 NP", "角鲨烷", "无香精"] },
  { id: "ol-13", type: "slide", title: "适合谁、不适合谁", description: "明确适用边界，避免过度承诺", keyPoints: ["屏障受损", "换季泛红", "急性过敏期不建议"] },
  { id: "ol-14", type: "interactive", title: "肤感对比小互动", description: "选择肤质查看建议用法", keyPoints: ["油皮", "干皮", "混合皮"] },
  { id: "ol-15", type: "slide", title: "门店演示标准动作", description: "试色 → 试用 → 讲解三步", keyPoints: ["手背试色", "按压三下", "边涂边讲"] },
  { id: "ol-16", type: "slide", title: "竞品对比怎么讲", description: "只讲差异，不贬损", keyPoints: ["对比维度：屏障 vs 提亮", "不评价竞品缺点"] },
  { id: "ol-17", type: "slide", title: "常见顾客疑问 FAQ", description: "五个高频问题与标准回应", keyPoints: ["会不会太油", "多久见效", "能不能叠加"] },
  { id: "ol-18", type: "slide", title: "小结：三层屏障一句话", description: "把卖点收敛成一句口语", keyPoints: ["一句话卖点", "配合实物演示"] },
];

const PART_THREE_OUTLINES: CwOutline[] = [
  { id: "ol-21", type: "slide", title: "南区门店案例复盘", description: "复盘 Plaza Senayan 的一次价格异议成交", keyPoints: ["顾客原话", "BA 的第一句话", "转折点"] },
  { id: "ol-22", type: "slide", title: "案例拆解：哪一步做对了", description: "对照四步法逐句拆解", keyPoints: ["认可", "换算", "举证", "成交"] },
  { id: "ol-23", type: "pbl", title: "角色扮演：预算型顾客", description: "两人一组，5 分钟一轮", keyPoints: ["顾客脚本", "BA 任务卡", "互评表"] },
  { id: "ol-24", type: "quiz", title: "随堂练习：异议场景判断", description: "5 道单选 + 2 道简答", keyPoints: ["场景单选", "话术简答"] },
  { id: "ol-25", type: "quiz", title: "课后练习（10 题）", description: "单选 6 题 + 简答 4 题", keyPoints: ["价格异议四步法", "三层屏障"] },
];

const PARTS: CwPart[] = [
  {
    partIndex: 1,
    partCount: 3,
    title: "第一部分：读懂顾客的价格异议",
    estimatedDurationSeconds: 840,
    outlineCount: PART_ONE_OUTLINES.length,
    outlines: PART_ONE_OUTLINES,
  },
  {
    partIndex: 2,
    partCount: 3,
    title: "第二部分：Barrier Shield 产品卖点与演示",
    estimatedDurationSeconds: 1020,
    outlineCount: PART_TWO_OUTLINES.length,
    outlines: PART_TWO_OUTLINES,
  },
  {
    partIndex: 3,
    partCount: 3,
    title: "第三部分：异议实战演练与考核",
    estimatedDurationSeconds: 900,
    outlineCount: PART_THREE_OUTLINES.length,
    outlines: PART_THREE_OUTLINES,
  },
];

const SUMMARY: CwSummary = {
  title: "Y.O.U Barrier Shield 门店话术进阶课",
  audience: "雅加达南区门店导购（入职 0-3 个月）",
  objective: "能在 3 分钟内识别顾客价格异议类型，并用 Barrier Shield 的三层屏障卖点给出回应话术",
  language: "id",
  targetDurationMinutes: 45,
  deliveryFormat: "series",
  planningOutline: PLANNING_SECTIONS,
  assumptions: [
    "默认用印尼语授课，关键术语保留中英对照",
    "案例取自南区 Plaza Senayan 门店的真实成交记录",
  ],
  scope: {
    mustInclude: ["价格异议四步法", "Barrier Shield 三层屏障", "南区门店真实案例复盘"],
    mustExclude: ["竞品贬损话术", "具体折扣幅度承诺"],
    optional: ["复购引导"],
  },
};

const KNOWN_REQUIREMENTS: Record<string, string> = {
  experience:
    "南区门店 8 月的一次价格异议成交：顾客在柜台反复比价三次，最后因为“单次使用成本换算”成交。",
  keySteps: "先认可价格感受 → 换算单次使用成本 → 用神经酰胺成分举证 → 给出下一步试用动作。",
  boundaries: "只用于 Barrier Shield 修护精华线，不涉及防晒与彩妆；急性过敏期不做修护承诺。",
};

/** 右栏「已理解的内容」事实卡：字段与 vue 版一致。 */
export function coursewareFacts(task: CwTask) {
  const summary = task.promptEnhancement?.summary;
  const known = task.promptEnhancement?.knownRequirements ?? {};
  const facts: { key: string; icon: string; label: string; value: string }[] = [];
  const push = (key: string, icon: string, label: string, value?: string | null) => {
    if (value) facts.push({ key, icon, label, value });
  };
  push("title", "presentation", "课程主题", summary?.title);
  push("audience", "users", "面向谁", summary?.audience);
  push("objective", "target", "学完能够做到什么", summary?.objective);
  push("experience", "message-square", "你的真实经验", known.experience);
  push("keySteps", "list-checks", "提炼出的关键动作", known.keySteps);
  push("boundaries", "shield", "适用边界", known.boundaries);
  push(
    "scope",
    "layers",
    "核心内容",
    summary?.scope?.mustInclude?.length ? summary.scope.mustInclude.join("\n") : undefined,
  );
  return facts;
}

/* ------------------------------------------------------ 状态与阶段解析 */

/** vue 的 COURSEWARE_STAGE_ALIASES：把后端的 step 串归一成前端阶段。 */
const CW_STAGE_ALIASES: Record<string, GenerationPhase> = {
  queued: "queued",
  reviewing_outline: "outline",
  splitting_outline: "outline",
  generating_children: "generating_scenes",
  generating_scenes: "generating_scenes",
  generating_media: "generating_media",
  generating_tts: "generating_tts",
  persisting: "persisting",
  finalizing: "finalizing",
  completed: "completed",
  succeeded: "completed",
  failed: "failed",
};

/**
 * vue 的 resolveCoursewareTaskStage()：保留后端 step 的细粒度，
 * 避免把后半程全部显示成「生成中」；课后题还在跑时归到 finalizing。
 */
export function resolveGenerationStage(task: CwTask | null): GenerationPhase {
  if (!task) return "sources";
  const status = resolveCoursewareTaskStatus(task.status);
  if (status === 50) return "canceled";
  if (status === 40) return "failed";
  const step = String(task.step ?? "").trim().toLowerCase();
  const homeworkStatus = String(task.homeworkGenerationStatus ?? "").trim().toLowerCase();
  const homeworkPending =
    task.generateHomeworkSync === true &&
    task.done !== true &&
    ["queued", "running", "succeeded"].includes(homeworkStatus);
  if (homeworkPending && (step === "completed" || step === "finalizing" || !step))
    return "finalizing";
  if (CW_STAGE_ALIASES[step]) return CW_STAGE_ALIASES[step];
  if (status === 10) return "queued";
  if (status === 30) return "completed";
  return task.generation?.phase ?? "generating_scenes";
}

/** 课后题是否还在生成（此时课件本体已完成）。 */
export const isHomeworkGenerating = (task: CwTask | null) =>
  !!task &&
  task.generateHomeworkSync === true &&
  task.done !== true &&
  ["queued", "running"].includes(String(task.homeworkGenerationStatus ?? "").toLowerCase());

/** 课件本体已成功但课后题失败：只能重试附加题，不重新生成课件。 */
export const canRetryHomework = (task: CwTask | null) =>
  !!task &&
  resolveCoursewareTaskStatus(task.status) === 40 &&
  !!task.result?.classroomId &&
  task.homeworkGenerationStatus === "failed";

/**
 * 生成中卡片的标题与说明（对齐 vue 的 generationStatusTitle / generationStatusDescription）。
 * 文案取自 coursewareCreate.studio.*。
 */
export function resolveGenerationStatus(task: CwTask | null): {
  title: string;
  description: string;
} {
  if (!task) return { title: CW_PHASES.sources, description: CW_PHASE_HINTS.sources };
  const status = resolveCoursewareTaskStatus(task.status);
  if (status === 50)
    return {
      title: "课件生成已取消",
      description: "生成任务已取消，可返回创建页重新发起生成。",
    };
  if (status === 40)
    return {
      title: "课件生成失败",
      description:
        task.errorMessage || task.message || "生成任务未完成，请返回创建页检查资料后重新开始。",
    };
  if (status === 21)
    return {
      title: "等待补充生成要求",
      description: task.sourcePreparation
        ? "请完成所有必答项；材料解析完成后系统会继续生成。"
        : "请补充必答信息，系统将在收到回答后继续生成。",
    };
  if (status === 22)
    return {
      title: "等待确认生成摘要",
      description: "请确认系统整理后的要求摘要，确认后继续生成；拒绝后返回创建页修改原始要求。",
    };
  if (isHomeworkGenerating(task))
    return {
      title: "课后10道题生成中...",
      description: "课件已完成，正在生成并回填10道课后题，完成后统一展示。",
    };
  if (status === 10) return { title: "课件排队生成中...", description: CW_PHASE_HINTS.queued };
  const step = String(task.step ?? "").toLowerCase();
  if (step === "reviewing_outline")
    return {
      title: "AI 正在审查完整大纲...",
      description: "AI 正在梳理完整大纲并优化课程结构。",
    };
  if (step === "splitting_outline")
    return {
      title: "AI 正在拆分大纲...",
      description: "AI 正在根据资料与需求判断是否需要拆分课件。",
    };
  if (step === "generating_children")
    return {
      title: "AI 正在生成子课件...",
      description: "AI 正在依次生成各个子课件。",
    };
  const stage = resolveGenerationStage(task);
  return {
    title: CW_PHASES[stage] ?? "AI 正在深度解析文档...",
    description: CW_PHASE_HINTS[stage] ?? CW_PHASE_HINTS.pages,
  };
}

/**
 * 子课件状态：课件本体已完成、课后题还没同步时仍算「制作中」，
 * 小字提示在同步课后题（对齐 vue 的 seriesItemStatus / partState）。
 */
export function resolvePartState(item: CwSeriesItem): {
  state: PartState;
  label: string;
  note?: string;
} {
  const homework = String(item.homeworkGenerationStatus ?? "").toLowerCase();
  if (homework === "failed" || homework === "canceled")
    return {
      state: "FAILED",
      label: CW_PART_STATES.FAILED,
      note: homework === "failed" ? "课后题同步失败，可重试附加题" : undefined,
    };
  if (item.error || item.status === "FAILED")
    return { state: "FAILED", label: CW_PART_STATES.FAILED, note: item.error ?? undefined };
  if (item.status === "SUCCEEDED" && homework !== "imported")
    return { state: "RUNNING", label: CW_PART_STATES.RUNNING, note: "正在同步课后题" };
  if (item.status === "SUCCEEDED") return { state: "SUCCEEDED", label: CW_PART_STATES.SUCCEEDED };
  if (item.status === "CANCELED") return { state: "CANCELED", label: CW_PART_STATES.CANCELED };
  if (item.status === "QUEUED") return { state: "QUEUED", label: CW_PART_STATES.QUEUED };
  return { state: "RUNNING", label: CW_PART_STATES.RUNNING };
}

export const resolveCoursewareTaskStatus = (raw: unknown): number => {
  if (typeof raw === "number") return raw;
  const text = String(raw ?? "").toLowerCase();
  if (text === "queued") return 10;
  if (text === "running" || text === "reviewing_outline" || text === "splitting_outline" || text === "generating_children")
    return 20;
  if (text === "waiting_for_user") return 21;
  if (text === "waiting_for_confirmation") return 22;
  if (text === "succeeded") return 30;
  if (text === "failed") return 40;
  if (text === "canceled" || text === "cancelled") return 50;
  return 20;
};

export const isTaskActive = (status: number) =>
  [10, 20, 21, 22].includes(status);
export const isTaskFailed = (status: number) => [40, 50].includes(status);
export const isTaskSucceeded = (status: number) => status === 30;

/** 顶部四步进度：梳理目标 / 课程规划 / 确认大纲 / 生成课件。 */
export function resolveStepIndex(task: CwTask | null): number {
  if (!task) return 0;
  const status = resolveCoursewareTaskStatus(task.status);
  if (status === 21) return 0;
  if (task.partSelection?.required && status === 22) return 2;
  if (status === 22) return 1;
  const phase = task.generation?.phase;
  const step = task.step ?? "";
  if (
    phase === "pages" ||
    phase === "finalizing" ||
    ["generating_scenes", "generating_children", "generating_media", "generating_tts", "persisting", "finalizing", "assembling", "completed"].includes(step)
  )
    return 3;
  if (task.partSelection?.parts?.length || task.promptEnhancement?.summary) return 2;
  return 0;
}

/** 当前是否等用户回答反问。 */
export const waitingQuestions = (task: CwTask | null): CwQuestion[] =>
  task && resolveCoursewareTaskStatus(task.status) === 21
    ? (task.promptEnhancement?.questions ?? [])
    : [];

export const isWaitingForConfirmation = (task: CwTask | null) =>
  !!task && resolveCoursewareTaskStatus(task.status) === 22;

/** 是否需要确认拆分方案（多子课件勾选）。 */
export const isReviewingOutline = (task: CwTask | null) =>
  isWaitingForConfirmation(task) && task?.partSelection?.required === true;

export const partSelectionPlan = (task: CwTask | null) =>
  task?.partSelection?.required && task.partSelection.parts.length
    ? task.partSelection
    : null;

/** 生成结果就绪：完成且 done，附加题（如开启）也导入完成。 */
export function isResultReady(task: CwTask | null) {
  if (!task) return false;
  if (resolveCoursewareTaskStatus(task.status) !== 30 || task.done !== true) return false;
  if (task.generateHomeworkSync && task.homeworkGenerationStatus !== "imported") return false;
  const items = task.series?.items ?? [];
  return items.length ? items.every((item) => item.status === "SUCCEEDED") : true;
}

export function resolveProgress(task: CwTask | null) {
  if (!task) return 0;
  if (isResultReady(task)) return 100;
  if (isTaskFailed(resolveCoursewareTaskStatus(task.status)))
    return Math.min(99, Math.max(0, Math.round(task.progress)));
  return Math.min(100, Math.max(0, Math.round(task.progress)));
}

export const resolveSeriesProgress = (item: CwSeriesItem, withHomework: boolean) => {
  const progress = Math.min(100, Math.max(0, Math.round(item.progress ?? 0)));
  const homework = String(item.homeworkGenerationStatus ?? "").toLowerCase();
  /* 对齐 vue 的 resolveCoursewareSeriesItemProgress：课后题未同步完不显示 100%。 */
  if (homework === "failed" || homework === "canceled") return Math.min(progress, 99);
  if (withHomework && homework !== "imported")
    return item.status === "SUCCEEDED" ? (homework === "running" ? 95 : 90) : Math.min(90, progress);
  if (item.status === "SUCCEEDED") return 100;
  if (item.status === "FAILED") return Math.min(progress, 99);
  return progress;
};

/** 结果状态：无 / 系列列表 / 单个预览。 */
export function resolveResultState(task: CwTask | null) {
  if (!isResultReady(task)) return { mode: "none" as const };
  const items = task?.series?.items ?? [];
  if (items.length > 1) return { mode: "series-list" as const, items };
  if (items.length === 1)
    return { mode: "preview" as const, items, current: items[0] };
  return {
    mode: "preview" as const,
    items: [],
    current: {
      partIndex: 1,
      partCount: 1,
      title: task?.title ?? "课件",
      previewUrl: task?.result?.previewUrl ?? task?.result?.url ?? null,
      downloadUrl: task?.result?.downloadUrl ?? null,
      estimatedDurationSeconds: undefined,
    } as CwSeriesItem,
  };
}

/** 答案展示：把选项 id 换回选项文案。 */
export function answerText(question: CwQuestion, value: string) {
  if (value === NONE_ANSWER) return "None · 我自己填写";
  const hit = question.options.find((option) => option.id === value);
  return hit?.label ?? value;
}

/** 本轮问题默认答案：推荐项优先。 */
export function defaultAnswers(questions: CwQuestion[]) {
  const answers: Record<string, string> = {};
  for (const question of questions)
    if (question.recommendedOptionId) answers[question.id] = question.recommendedOptionId;
  return answers;
}

export const answersComplete = (questions: CwQuestion[], answers: Record<string, string>) => {
  for (const question of questions) {
    if (!question.required) continue;
    const value = answers[question.id];
    if (!value) return false;
    if (value === NONE_ANSWER && !(answers[`${question.id}__text`] ?? "").trim()) return false;
  }
  return true;
};

/* ------------------------------------------------------------ 演示状态机 */

export interface CwFrame {
  /** 稳定 id，用于 React key 与调试。 */
  id: string;
  /** 停留时长（毫秒）；gate 帧会一直停到用户操作。 */
  delayMs: number;
  /** 等待用户操作（回答 / 确认）。 */
  gate?: boolean;
  label: string;
  build: (task: CwTask) => CwTask;
}

const stamp = (offsetSeconds: number) =>
  new Date(Date.now() + offsetSeconds * 1000).toISOString();

const baseTask = (form: CwForm): CwTask => ({
  id: 208417,
  title: SUMMARY.title,
  status: 10,
  step: "initializing",
  progress: 0,
  done: false,
  message: "课件生成任务已提交",
  generateHomeworkSync: form.generateHomeworkSync,
  homeworkGenerationStatus: null,
  homeworkGenerationMessage: null,
  sourcePreparation: { status: "pending" },
  generation: { phase: "plan", pages: [], sourceSummary: undefined },
  promptEnhancement: {
    clarificationEligible: true,
    clarificationRound: 0,
    questions: [],
    history: [],
    message: undefined,
    assumptions: [],
  },
  partSelection: undefined,
  series: undefined,
  result: undefined,
  createTime: stamp(0),
});

/** 按子课件状态推导页面状态：已完成的子课件整段完成，制作中的部分完成。 */
function buildPages(parts: CwPart[], items: CwSeriesItem[]): CwPageState[] {
  const pages: CwPageState[] = [];
  for (const part of parts) {
    const item = items.find((entry) => entry.partIndex === part.partIndex);
    if (!item) continue;
    const outlines = part.outlines ?? [];
    outlines.forEach((outline, index) => {
      const progress = item.progress ?? 0;
      const ratio = item.status === "SUCCEEDED" ? 1 : progress / 100;
      const threshold = (index + 1) / Math.max(1, outlines.length);
      let status: PageState = "waiting";
      if (item.status === "SUCCEEDED" || threshold <= ratio) status = "completed";
      else if (item.status === "RUNNING" && threshold - 1 / Math.max(1, outlines.length) < ratio)
        status = index === Math.floor(ratio * outlines.length) ? "generating" : "waiting";
      if (status === "generating" && index === 2 && item.retryCount)
        status = "retrying";
      pages.push({
        id: `pg-p${part.partIndex}-${String(index + 1).padStart(2, "0")}`,
        outlineId: outline.id,
        partIndex: part.partIndex,
        order: index + 1,
        title: outline.title,
        summary: outline.description,
        status,
        retryCount: status === "retrying" ? 1 : 0,
        maxRetries: 2,
        mediaPending: status !== "completed" && item.status === "RUNNING",
        version: status === "completed" ? 4 : status === "waiting" ? 0 : 2,
        error: status === "retrying" ? "页面生成超时，正在自动重试" : undefined,
      });
    });
  }
  return pages;
}

const seriesItem = (
  part: CwPart,
  status: PartState,
  progress: number,
  extra: Partial<CwSeriesItem> = {},
): CwSeriesItem => ({
  childJobId: `cw-9f3a1d20-part-${part.partIndex}`,
  coursewareId: status === "SUCCEEDED" ? 90210 + part.partIndex : null,
  partIndex: part.partIndex,
  partCount: part.partCount,
  title: part.title,
  status,
  progress,
  retryCount: part.partIndex === 2 && status !== "QUEUED" ? 1 : 0,
  previewUrl: status === "SUCCEEDED" ? `https://openmaic.demo/classroom/cl-7712${part.partIndex}` : null,
  downloadUrl: status === "SUCCEEDED" ? `https://openmaic.demo/api/classroom/cl-7712${part.partIndex}/export/pptx` : null,
  estimatedDurationSeconds: part.estimatedDurationSeconds,
  homeworkGenerationStatus: status === "SUCCEEDED" ? "imported" : null,
  error: null,
  ...extra,
});

/** 已确认的分 P 方案（用户在确认页勾选的子课件）。 */
function selectedParts(selected?: number[]): CwPart[] {
  if (!selected?.length) return PARTS;
  return PARTS.filter((part) => selected.includes(part.partIndex));
}

export function buildFrames(form: CwForm): CwFrame[] {
  const parts = PARTS;
  const frames: CwFrame[] = [];

  frames.push({
    id: "queued",
    delayMs: 1400,
    label: "排队中",
    build: (task) => ({
      ...task,
      status: 10,
      step: "queued",
      progress: 4,
      message: "任务已排队，正在准备资料解析",
      sourcePreparation: { status: "running" },
      generation: { phase: "sources", pages: [] },
      promptEnhancement: {
        ...task.promptEnhancement,
        clarificationRound: 0,
        message: "正在读取你提供的资料，同时整理课程目标。",
      },
    }),
  });

  frames.push({
    id: "interview-1",
    delayMs: 0,
    gate: true,
    label: "第 1 轮反问",
    build: (task) => ({
      ...task,
      status: 21,
      step: "waiting_for_user",
      progress: 12,
      message: "等待补充生成要求",
      sourcePreparation: { status: "succeeded" },
      generation: {
        phase: "interview",
        pages: [],
        sourceSummary:
          form.files.length
            ? `已解析参考资料：${form.files.map((file) => file.name).join("、")}`
            : "未上传参考资料，本次按对话内容整理。",
      },
      promptEnhancement: {
        ...task.promptEnhancement,
        clarificationRound: 1,
        message: "为了更贴合你的门店场景，我想先确认两个关键点。",
        questions: ROUND_ONE,
        history: [],
        knownRequirements: {},
        assumptions: [],
      },
    }),
  });

  frames.push({
    id: "interview-2",
    delayMs: 0,
    gate: true,
    label: "第 2 轮反问",
    build: (task) => ({
      ...task,
      status: 21,
      step: "waiting_for_user",
      progress: 18,
      message: "等待补充生成要求",
      generation: { ...task.generation!, phase: "interview" },
      promptEnhancement: {
        ...task.promptEnhancement,
        clarificationRound: 2,
        message: "收到，方向清楚了。再确认素材与边界就可以整理课程规划了。",
        questions: ROUND_TWO,
        history: task.promptEnhancement?.history ?? [],
      },
    }),
  });

  frames.push({
    id: "brief",
    delayMs: 0,
    gate: true,
    label: "确认课程规划",
    build: (task) => ({
      ...task,
      status: 22,
      step: "waiting_for_confirmation",
      progress: 26,
      message: "等待确认生成摘要",
      generation: { ...task.generation!, phase: "plan" },
      promptEnhancement: {
        ...task.promptEnhancement,
        message: "我把课程方向理清了，右侧是可以直接修改的课程规划。",
        questions: [],
        knownRequirements: KNOWN_REQUIREMENTS,
        assumptions: SUMMARY.assumptions,
        summary: SUMMARY,
      },
    }),
  });

  frames.push({
    id: "outline",
    delayMs: 0,
    gate: true,
    label: "确认大纲与子课件",
    build: (task) => ({
      ...task,
      status: 22,
      step: "waiting_for_part_selection",
      progress: 32,
      message: "拆分完成，请选择要生成的子课件",
      generation: { ...task.generation!, phase: "outline" },
      promptEnhancement: {
        ...task.promptEnhancement,
        message: "已整理出 3 个部分的拆分方案，请确认要生成哪些部分。",
      },
      partSelection: {
        required: true,
        selectedPartIndexes: parts.map((part) => part.partIndex),
        parts,
      },
    }),
  });

  const generationSteps: {
    id: string;
    progress: number;
    states: [PartState, number][];
    delay: number;
    phase: GenerationPhase;
    step: string;
  }[] = [
    { id: "gen-1", progress: 14, states: [["RUNNING", 22], ["QUEUED", 0], ["QUEUED", 0]], delay: 2200, phase: "generating_scenes", step: "generating_children" },
    { id: "gen-2", progress: 38, states: [["SUCCEEDED", 100], ["RUNNING", 46], ["QUEUED", 0]], delay: 2600, phase: "generating_media", step: "generating_media" },
    { id: "gen-3", progress: 66, states: [["SUCCEEDED", 100], ["SUCCEEDED", 100], ["RUNNING", 58]], delay: 2600, phase: "generating_tts", step: "generating_tts" },
    { id: "gen-4", progress: 88, states: [["SUCCEEDED", 100], ["SUCCEEDED", 100], ["SUCCEEDED", 100]], delay: 2400, phase: "finalizing", step: "persisting" },
  ];

  for (const step of generationSteps) {
    frames.push({
      id: step.id,
      delayMs: step.delay,
      label: step.id,
      build: (task) => {
        const selected = selectedParts(task.partSelection?.selectedPartIndexes);
        const items = parts.map((part, index) => {
          const [status, progress] = step.states[index] ?? ["QUEUED", 0];
          const chosen = selected.some((entry) => entry.partIndex === part.partIndex);
          return seriesItem(
            part,
            chosen ? (status as PartState) : "CANCELED",
            chosen ? progress : 0,
          );
        });
        const running = items.find((item) => item.status === "RUNNING");
        const done = items.filter((item) => item.status === "SUCCEEDED").length;
        return {
          ...task,
          status: 20,
          step: step.step,
          progress: step.progress,
          message: running
            ? `子课件 ${running.partIndex}/${items.length} 生成中`
            : "页面内容已制作，正在整合课件",
          generation: {
            phase: step.phase,
            sourceSummary: task.generation?.sourceSummary,
            pages: buildPages(parts, items),
            retry:
              step.phase === "finalizing"
                ? { phase: "tts", count: 1, maxRetries: 2, retrying: true }
                : undefined,
          },
          series: { seriesId: "sr-20260311-yb", title: `${SUMMARY.title}（系列）`, items },
          partSelection: task.partSelection
            ? { ...task.partSelection, required: false }
            : undefined,
          homeworkGenerationStatus: step.phase === "finalizing" ? "queued" : null,
          homeworkGenerationMessage:
            step.phase === "finalizing" ? "等待同步课后题" : `已完成 ${done} / ${items.length} 个子课件`,
        };
      },
    });
  }

  /** 演示：课件本体已完成、只差课后题（用于演示「重试附加题」）。 */
  if (form.demoHomeworkFailure) {
    frames.push({
      id: "homework-failed",
      delayMs: 1600,
      gate: true,
      label: "课后题失败",
      build: (task) => {
        const items = (task.series?.items ?? []).map((item) =>
          item.status === "CANCELED"
            ? item
            : { ...item, homeworkGenerationStatus: "failed" as const },
        );
        return {
          ...task,
          status: 40,
          step: "finalizing",
          progress: 99,
          message: "课后题生成失败",
          errorMessage: "课后题生成失败：题库服务超时，可只重试附加题，课件无需重新生成。",
          homeworkGenerationStatus: "failed",
          homeworkGenerationMessage: "10 道课后题生成失败",
          series: task.series ? { ...task.series, items } : undefined,
          result: {
            classroomId: "cl-77120a",
            url: "https://openmaic.demo/classroom/cl-77120a",
            previewUrl: "https://openmaic.demo/classroom/cl-77120a",
            downloadUrl: "https://openmaic.demo/api/classroom/cl-77120a/export/pptx",
            scenesCount: 24,
          },
        };
      },
    });
  }

  frames.push({
    id: "completed",
    delayMs: 2000,
    label: "完成",
    build: (task) => {
      const items = (task.series?.items ?? []).map((item) => ({
        ...item,
        status: item.status === "CANCELED" ? ("CANCELED" as PartState) : ("SUCCEEDED" as PartState),
        progress: item.status === "CANCELED" ? 0 : 100,
        homeworkGenerationStatus: item.status === "CANCELED" ? null : "imported",
        homeworkGenerationMessage: item.status === "CANCELED" ? null : "已生成并关联 10 道课后题",
      }));
      return {
        ...task,
        status: 30,
        step: "completed",
        progress: 100,
        done: true,
        message: "全部制作已完成",
        generation: {
          phase: "completed",
          sourceSummary: task.generation?.sourceSummary,
          pages: buildPages(parts, items),
          retry: undefined,
        },
        series: task.series ? { ...task.series, items } : undefined,
        homeworkGenerationStatus: "imported",
        homeworkGenerationMessage: "10 道课后题已回填到 quiz 场景",
        result: {
          classroomId: "cl-77120a",
          url: "https://openmaic.demo/classroom/cl-77120a",
          previewUrl: "https://openmaic.demo/classroom/cl-77120a",
          downloadUrl: "https://openmaic.demo/api/classroom/cl-77120a/export/pptx",
          scenesCount: 24,
          exportUrls: {
            pptx: "https://openmaic.demo/api/classroom/cl-77120a/export/pptx",
            html: "https://openmaic.demo/api/classroom/cl-77120a/export/html",
            resourcePack: "https://openmaic.demo/api/classroom/cl-77120a/export/resource-pack",
            classroomZip: "https://openmaic.demo/api/classroom/cl-77120a/export/classroom-zip",
          },
        },
      };
    },
  });

  return frames;
}

export const createTask = (form: CwForm) => baseTask(form);

export const CW_FRAME_COUNT = (form: CwForm) => buildFrames(form).length;

/** 反问作答：写入 history，并把答案映射到课程摘要的补充信息。 */
export function applyAnswers(
  task: CwTask,
  questions: CwQuestion[],
  answers: Record<string, string>,
  notes: Record<string, string>,
): CwTask {
  const round: CwRound = {
    message: task.promptEnhancement?.message,
    questions,
    answers: questions.map((question) => ({
      questionId: question.id,
      value: answers[question.id] ?? "",
      note: notes[question.id] || undefined,
    })),
  };
  const history = [...(task.promptEnhancement?.history ?? []), round];
  const known = { ...(task.promptEnhancement?.knownRequirements ?? {}) };
  for (const question of questions) {
    const value = answers[question.id];
    if (!value) continue;
    if (value === NONE_ANSWER) known[question.id] = answers[`${question.id}__text`] ?? "";
    else known[question.id] = answerText(question, value);
  }
  return {
    ...task,
    promptEnhancement: {
      ...task.promptEnhancement,
      history,
      knownRequirements: known,
      questions: [],
    },
  };
}

/** 生成一段用于预览 iframe 的课件页面 HTML（演示用）。 */
export function slidePreviewHtml(title: string, partIndex: number, order: number) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8" />
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Geist","Helvetica Neue",Arial,sans-serif;background:#f6f2ef;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;margin:0}
  .slide{width:min(1120px,92vw,calc((100vh - 64px) * 16 / 9));aspect-ratio:16/9;background:#fffdfc;border:1px solid #e7e2df;border-radius:18px;box-shadow:0 18px 40px -22px rgba(28,25,23,.35);padding:52px 56px;display:flex;flex-direction:column;gap:18px;position:relative;overflow:hidden}
  .idx{position:absolute;right:44px;top:26px;font-size:64px;font-weight:800;color:#f2ebe7}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#b25d49;background:#fbf3f0;border:1px solid #f0d8d0;border-radius:20px;padding:5px 12px;width:fit-content}
  h1{font-size:34px;line-height:1.25;letter-spacing:-.02em;color:#1c1917;max-width:22ch;position:relative;z-index:1}
  .sub{font-size:14px;color:#78716c;border-bottom:2px solid #f0e6e1;padding-bottom:14px;max-width:52ch;position:relative;z-index:1}
  ul{display:grid;gap:10px;margin-top:6px;position:relative;z-index:1}
  li{display:flex;gap:10px;font-size:14px;color:#44403c;background:#faf8f6;border:1px solid #f2ece8;border-radius:10px;padding:12px 14px;list-style:none}
  li b{color:#b25d49;font-weight:600}
  .foot{margin-top:auto;display:flex;justify-content:space-between;font-size:12px;color:#827972;border-top:1px dashed #e7e2df;padding-top:14px}
</style></head>
<body><div class="slide">
  <div class="idx">${String(order).padStart(2, "0")}</div>
  <span class="eyebrow">Y.O.U Barrier Shield · 门店话术进阶课</span>
  <h1>${title}</h1>
  <p class="sub">第 ${partIndex} 部分的讲解页 · 印尼语授课 · 讲师：Siti</p>
  <ul>
    <li><b>01</b> 先认可顾客的价格感受，不急着解释成分</li>
    <li><b>02</b> 把价格换算成单次使用成本</li>
    <li><b>03</b> 用神经酰胺与三层屏障做举证</li>
    <li><b>04</b> 给一个明确的下一步试用动作</li>
  </ul>
  <div class="foot"><span>Selamat pagi semuanya.</span><span>${partIndex}.${order}</span></div>
</div></body></html>`;
}
