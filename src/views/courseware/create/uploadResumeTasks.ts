export const COURSEWARE_UPLOAD_CHUNK_SIZE = 2 * 1024 * 1024

const STORAGE_KEY = 'courseware:source-file:resume-tasks'
export const COURSEWARE_UPLOAD_RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface CoursewareUploadResumeTask {
  id: string
  uploadId: string
  objectKey: string
  configId: number
  provider: string
  mode: string
  bucket?: string
  region?: string
  endpoint?: string
  fileName: string
  fileSize: number
  fileType?: string
  fileLastModified: number
  extension: string
  chunkSize: number
  progress: number
  createdAt: number
  updatedAt: number
}

export interface CoursewareUploadResumeTaskInput {
  uploadId: string
  objectKey: string
  configId: number
  provider: string
  mode: string
  bucket?: string
  region?: string
  endpoint?: string
  file: File
  extension: string
  type?: string
  progress?: number
  chunkSize?: number
}

const now = () => Date.now()

const safeParseTasks = (raw: string | null): CoursewareUploadResumeTask[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isResumeTask) : []
  } catch {
    return []
  }
}

const isResumeTask = (value: any): value is CoursewareUploadResumeTask =>
  value &&
  typeof value.id === 'string' &&
  typeof value.uploadId === 'string' &&
  typeof value.objectKey === 'string' &&
  typeof value.configId === 'number' &&
  typeof value.fileName === 'string' &&
  typeof value.fileSize === 'number' &&
  typeof value.fileLastModified === 'number'

const readTasks = () => {
  if (typeof window === 'undefined') return []
  return safeParseTasks(window.localStorage.getItem(STORAGE_KEY))
}

const writeTasks = (tasks: CoursewareUploadResumeTask[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

export const isResumeTaskExpired = (task: CoursewareUploadResumeTask, maxAgeMs = COURSEWARE_UPLOAD_RESUME_MAX_AGE_MS) =>
  now() - task.updatedAt > maxAgeMs

export const loadCoursewareUploadResumeTasks = () => readTasks().sort((a, b) => b.updatedAt - a.updatedAt)

export const cleanupStaleCoursewareUploadResumeTasks = (maxAgeMs = COURSEWARE_UPLOAD_RESUME_MAX_AGE_MS) => {
  const tasks = readTasks()
  const freshTasks = tasks.filter((task) => !isResumeTaskExpired(task, maxAgeMs))
  if (freshTasks.length !== tasks.length) {
    writeTasks(freshTasks)
  }
  return {
    freshTasks: freshTasks.sort((a, b) => b.updatedAt - a.updatedAt),
    removedTasks: tasks.filter((task) => isResumeTaskExpired(task, maxAgeMs))
  }
}

export const buildCoursewareUploadResumeTask = (input: CoursewareUploadResumeTaskInput): CoursewareUploadResumeTask => {
  const timestamp = now()
  return {
    id: input.uploadId,
    uploadId: input.uploadId,
    objectKey: input.objectKey,
    configId: input.configId,
    provider: input.provider,
    mode: input.mode,
    bucket: input.bucket,
    region: input.region,
    endpoint: input.endpoint,
    fileName: input.file.name,
    fileSize: input.file.size,
    fileType: input.type || input.file.type,
    fileLastModified: input.file.lastModified,
    extension: input.extension,
    chunkSize: input.chunkSize || COURSEWARE_UPLOAD_CHUNK_SIZE,
    progress: Math.max(0, Math.min(99, input.progress || 0)),
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export const saveCoursewareUploadResumeTask = (task: CoursewareUploadResumeTask) => {
  const tasks = readTasks().filter((item) => item.id !== task.id)
  writeTasks([{ ...task, updatedAt: now() }, ...tasks])
}

export const updateCoursewareUploadResumeTask = (id: string | undefined, patch: Partial<CoursewareUploadResumeTask>) => {
  if (!id) return
  const tasks = readTasks()
  const index = tasks.findIndex((task) => task.id === id)
  if (index < 0) return
  tasks[index] = {
    ...tasks[index],
    ...patch,
    progress: patch.progress == null ? tasks[index].progress : Math.max(0, Math.min(99, patch.progress)),
    updatedAt: now()
  }
  writeTasks(tasks)
}

export const removeCoursewareUploadResumeTask = (id: string | undefined) => {
  if (!id) return
  writeTasks(readTasks().filter((task) => task.id !== id))
}

export const matchesCoursewareUploadResumeFile = (task: CoursewareUploadResumeTask, file: File) =>
  task.fileName === file.name &&
  task.fileSize === file.size &&
  task.fileLastModified === file.lastModified
