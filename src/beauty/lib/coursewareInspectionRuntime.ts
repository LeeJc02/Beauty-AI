import { useUserStore } from '@/store/modules/user'
import { CoursewareApi, type CoursewareGenerationTaskVO, type CoursewareVO } from '@/api/courseware'
import { isCoursewareTaskResultReady } from '@/views/courseware/create/generationTask'
import {
  createCoursewareInspectionRuntime,
  expandCoursewareInspectionSnapshots,
  type CoursewareInspectionSnapshot,
  type CoursewareInspectionRuntime
} from './coursewareInspection'
import {
  COURSEWARE_INSPECTION_SEED_VERSION,
  createCoursewareInspectionFixtures
} from './coursewareInspectionFixtures'
export * from './coursewareInspection'
import type { TrainingRecord } from './trainingInspection'

/** 培训记录生产者入口，与课件事件按 subject 隔离。 */
export function collectTrainingInspectionRecord(record: TrainingRecord): boolean {
  return useCoursewareInspectionRuntime().processTrainingRecord(record)
}

const runtimes = new WeakMap<object, CoursewareInspectionRuntime>()
const metadataRequests = new WeakMap<CoursewareInspectionRuntime, Map<string, Promise<void>>>()
/** 全局提示和巡检 UI 共用，生命周期不依赖巡检页面挂载。 */
export function useCoursewareInspectionRuntime(): CoursewareInspectionRuntime {
  const user = useUserStore()
  let runtime = runtimes.get(user)
  if (!runtime) {
    runtime = createCoursewareInspectionRuntime({
      mode: 'demo',
      seed: {
        version: COURSEWARE_INSPECTION_SEED_VERSION,
        create: createCoursewareInspectionFixtures
      },
      identity: () =>
        user.getUser?.id && user.getRoles?.[0]
          ? { userId: user.getUser.id, role: user.getRoles[0], displayName: user.getUser.nickname }
          : undefined,
      storage: {
        getItem: (key) => globalThis.localStorage.getItem(key),
        setItem: (key, value) => globalThis.localStorage.setItem(key, value)
      }
    })
    runtimes.set(user, runtime)
  }
  return runtime
}

/** 只消费已有生产者事件；终态补查一次 metadata，不增设定时器。 */
export async function collectCoursewareInspectionSnapshot(
  dto?: CoursewareGenerationTaskVO
): Promise<void> {
  const runtime = useCoursewareInspectionRuntime()
  runtime.processCoursewareSnapshot(dto)
  if (!dto) return
  // 按后端系列顺序逐产物补证据，避免响应快慢改变同人连续计数顺序。
  const identity = runtime.identityKey()
  for (const product of expandCoursewareInspectionSnapshots(dto)) {
    if (runtime.identityKey() !== identity) return
    await collectProductMetadata(runtime, product)
  }
}

async function collectProductMetadata(
  runtime: CoursewareInspectionRuntime,
  dto: CoursewareInspectionSnapshot
): Promise<void> {
  if (!isCoursewareTaskResultReady(dto)) return
  const coursewareId = dto.resultCoursewareId ?? dto.coursewareId
  if (
    !coursewareId ||
    !runtime.tasks.value.some(
      (task) =>
        task.subject !== 'training' &&
        task.mode !== 'once' &&
        !task.completedAt &&
        task.enabled &&
        task.entries.some(
          (entry) =>
            entry.generationTaskId === dto.id &&
            (!dto.productKey ||
              entry.productKey === dto.productKey ||
              entry.childJobId === dto.childJobId) &&
            !entry.retired &&
            !entry.completedAt &&
            entry.status === 'missing_evidence'
        )
    )
  )
    return
  const identity = runtime.identityKey()
  const requestKey = `${identity}:${dto.id}:${dto.externalTaskId ?? 'initial'}:${coursewareId}:${dto.snapshotVersion ?? 'unversioned'}`
  let requests = metadataRequests.get(runtime)
  if (!requests) {
    requests = new Map()
    metadataRequests.set(runtime, requests)
  }
  if (requests.has(requestKey)) return requests.get(requestKey)
  const pending = (async () => {
    try {
      const metadata: CoursewareVO | undefined = await CoursewareApi.getCourseware(coursewareId)
      if (runtime.identityKey() !== identity)
        throw new Error('请求期间账号已切换，等待原账号后续事件重试')
      if (!metadata || metadata.id !== coursewareId) throw new Error('课件证据缺失或标识不匹配')
      runtime.processCoursewareSnapshot(
        { ...dto, title: metadata.title || dto.title },
        {
          // 姓名不等于身份；不从当前登录账号猜测产物创建人。
          creatorId:
            metadata.creator && /^\d+$/.test(String(metadata.creator))
              ? metadata.creator
              : undefined,
          creatorName:
            metadata.creatorName ||
            (metadata.creator && !/^\d+$/.test(String(metadata.creator))
              ? metadata.creator
              : undefined),
          estimatedDurationSeconds: metadata.estimatedDurationSeconds ?? undefined,
          source: '课件预计学习时长'
        }
      )
    } catch {
      // 失败不永久缓存。只有下一次生产者事件才重试，不新增定时器。
      requests!.delete(requestKey)
    }
  })()
  requests.set(requestKey, pending)
  await pending
}
