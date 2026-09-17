import { slidePreviewHtml } from '../../../lib/coursewareStudio'
import type { CoursewareGenerationTaskVO, CoursewarePagePreviewVO, CoursewarePageStateVO } from './apiTypes'

/** Vue studio 的本地 bridge：预览只由 Beauty 的演示数据生成，不访问生产 API。 */
export function createLocalCoursewareApi(getTask: () => CoursewareGenerationTaskVO | null | undefined) {
  return {
    async getGenerationPagePreview(taskId: number, pageId: string): Promise<CoursewarePagePreviewVO> {
      const task = getTask()
      const page = task?.generation?.pages.find((candidate: CoursewarePageStateVO) => candidate.id === pageId)
      if (!task || task.id !== taskId || !page || page.status !== 'completed') throw new Error('Preview unavailable')
      return {
        pageId,
        version: page.version,
        mediaPending: page.mediaPending,
        html: slidePreviewHtml(page.title, page.partIndex, page.order)
      }
    }
  }
}
