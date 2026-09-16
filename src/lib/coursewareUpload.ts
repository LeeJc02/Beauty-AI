/**
 * 参考资料上传 · 原型演示层
 *
 * 对齐 SalesBoost-vue（test 分支）`src/views/courseware/create/index.vue`：
 * - 白名单扩展名 pdf / doc / docx / ppt / pptx，单文件上限 500MB（DEFAULT_SOURCE_FILE_MAX_SIZE_BYTES）；
 * - 状态机 ready → uploading →（paused | failed）→ success，进行中可暂停 / 继续，失败可重试，随时可移除；
 * - 断点续传：未完成的上传写入 localStorage，重选原文件后从上次进度继续；
 * - 校验失败按原文案提示（仅支持上传 PDF/Word/PPT、单个文件大小不能超过 {size}MB）。
 *
 * 原型不真的分片上传：进度由定时器推进；≥100MB 的文件会在 80% 处模拟一次
 * 「网络中断」（为了让 failed → 重试 这条分支也能演示），重试不再失败。
 */
export const UPLOAD_ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx"] as const;

export const UPLOAD_MAX_SIZE_BYTES = 500 * 1024 * 1024;
export const UPLOAD_MAX_SIZE_MB = 500;
export const UPLOAD_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx";
/** 超过这个体积的演示文件会模拟一次网络中断。 */
export const UPLOAD_FLAKY_THRESHOLD_BYTES = 100 * 1024 * 1024;

export const extensionOf = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

export interface UploadValidation {
  ok: boolean;
  extension: string;
  /** 校验失败时的提示文案，与 vue 的 i18n 一致。 */
  error?: string;
}

/** 对应 vue 的 validateUploadFile()：先看扩展名，再看体积。 */
export function validateUploadFile(name: string, size: number): UploadValidation {
  const extension = extensionOf(name);
  if (!(UPLOAD_ALLOWED_EXTENSIONS as readonly string[]).includes(extension))
    return { ok: false, extension, error: "仅支持上传 PDF、Word 或 PPT 文件" };
  if (size > UPLOAD_MAX_SIZE_BYTES)
    return {
      ok: false,
      extension,
      error: `单个文件大小不能超过 ${UPLOAD_MAX_SIZE_MB}MB`,
    };
  return { ok: true, extension };
}

export function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/* ------------------------------------------------------- 断点续传记录 */

export interface CoursewareResumeTask {
  id: string;
  fileName: string;
  fileSize: number;
  extension: string;
  progress: number;
  updatedAt: string;
}

const RESUME_KEY = "courseware-upload-resume-tasks";

export function loadResumeTasks(): CoursewareResumeTask[] {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CoursewareResumeTask =>
        !!item &&
        typeof item === "object" &&
        typeof (item as CoursewareResumeTask).id === "string" &&
        typeof (item as CoursewareResumeTask).fileName === "string",
    );
  } catch {
    return [];
  }
}

function persist(tasks: CoursewareResumeTask[]) {
  try {
    window.localStorage.setItem(RESUME_KEY, JSON.stringify(tasks.slice(0, 5)));
  } catch {
    /* 隐私模式下写不了就只在内存里演示 */
  }
}

export function upsertResumeTask(task: CoursewareResumeTask): CoursewareResumeTask[] {
  const rest = loadResumeTasks().filter((item) => item.id !== task.id);
  const next = [task, ...rest];
  persist(next);
  return next;
}

export function removeResumeTask(id: string): CoursewareResumeTask[] {
  const next = loadResumeTasks().filter((item) => item.id !== id);
  persist(next);
  return next;
}

/** 对应 vue 的 matchesCoursewareUploadResumeFile()：文件名与大小都要对得上。 */
export const matchesResumeFile = (
  task: CoursewareResumeTask,
  name: string,
  size: number,
) => task.fileName === name && task.fileSize === size;

/* --------------------------------------------------------- 演示用文件 */

export interface DemoUploadFile {
  name: string;
  size: number;
  hint: string;
}

/** 点一下就走完整条上传链路，省得演示时临时找文件。 */
export const DEMO_UPLOAD_FILES: DemoUploadFile[] = [
  {
    name: "Y.O.U_BarrierShield_门店培训材料.pptx",
    size: Math.round(53.7 * 1024 * 1024),
    hint: "53.7MB PPTX · 正常上传完成",
  },
  {
    name: "Hy_Amino_敏感肌培训与考核.pptx",
    size: Math.round(187 * 1024 * 1024),
    hint: "187MB PPTX · 会模拟一次网络中断，用来演示失败重试",
  },
  {
    name: "门店话术手册.zip",
    size: Math.round(12 * 1024 * 1024),
    hint: "ZIP · 不在白名单里，用来演示校验失败",
  },
];

/** 进度推进速度：文件越大走得越慢，给「暂停」留出点按时间。 */
export const progressStep = (size: number) => {
  const mb = size / 1024 / 1024;
  if (mb >= 150) return 3;
  if (mb >= 50) return 5;
  return 9;
};
