// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCoursewareUploadResumeTask,
  cleanupStaleCoursewareUploadResumeTasks,
  COURSEWARE_UPLOAD_CHUNK_SIZE,
  loadCoursewareUploadResumeTasks,
  matchesCoursewareUploadResumeFile,
  saveCoursewareUploadResumeTask,
  updateCoursewareUploadResumeTask
} from '../uploadResumeTasks'

describe('courseware upload resume tasks', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('saves, loads, and updates resume metadata with fixed chunk size', () => {
    const file = new File(['hello'], 'training.pdf', { type: 'application/pdf', lastModified: 1000 })
    const task = buildCoursewareUploadResumeTask({
      uploadId: 'upload-1',
      objectKey: 'courseware/source/training.pdf',
      configId: 1,
      provider: 'tencent_cos',
      mode: 'sts_sdk',
      file,
      extension: 'pdf'
    })

    saveCoursewareUploadResumeTask(task)
    updateCoursewareUploadResumeTask(task.id, { progress: 48 })

    const [loaded] = loadCoursewareUploadResumeTasks()
    expect(loaded.uploadId).toBe('upload-1')
    expect(loaded.chunkSize).toBe(COURSEWARE_UPLOAD_CHUNK_SIZE)
    expect(loaded.progress).toBe(48)
  })

  it('matches the same local file by name, size, and lastModified', () => {
    const file = new File(['same'], 'training.pdf', { type: 'application/pdf', lastModified: 1000 })
    const task = buildCoursewareUploadResumeTask({
      uploadId: 'upload-1',
      objectKey: 'courseware/source/training.pdf',
      configId: 1,
      provider: 'tencent_cos',
      mode: 'sts_sdk',
      file,
      extension: 'pdf'
    })

    expect(matchesCoursewareUploadResumeFile(task, file)).toBe(true)
    expect(matchesCoursewareUploadResumeFile(task, new File(['diff'], 'training.pdf', { lastModified: 1001 }))).toBe(false)
  })

  it('cleans stale resume tasks', () => {
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
    const file = new File(['hello'], 'training.pdf', { type: 'application/pdf', lastModified: 1000 })
    const task = buildCoursewareUploadResumeTask({
      uploadId: 'upload-1',
      objectKey: 'courseware/source/training.pdf',
      configId: 1,
      provider: 'tencent_cos',
      mode: 'sts_sdk',
      file,
      extension: 'pdf'
    })
    saveCoursewareUploadResumeTask(task)
    window.localStorage.setItem(
      'courseware:source-file:resume-tasks',
      JSON.stringify([{ ...task, updatedAt: Date.now() - 2000 }])
    )

    const result = cleanupStaleCoursewareUploadResumeTasks(1000)
    expect(result.freshTasks).toHaveLength(0)
    expect(result.removedTasks).toHaveLength(1)
  })
})
