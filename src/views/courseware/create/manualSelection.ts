import type { CoursewareGenerationReqVO, CoursewareGenerationOptionsVO } from '@/api/courseware'

export type CoursewareManualSelection = Pick<
  CoursewareGenerationReqVO,
  | 'generateHomeworkSync'
  | 'enableImageGeneration'
  | 'outlineEnhancementEnabled'
  | 'documentProcessingMode'
>

/** 仅使用提交时面板的状态。关闭（包括打开后关闭）时不读取前端默认生成参数。 */
export function withManualSelectionPayload<T extends Record<string, unknown>>(
  payload: T,
  enabled: boolean,
  selection: CoursewareManualSelection
): T & { manualSelectionEnabled: boolean; generationOptions?: CoursewareGenerationOptionsVO } {
  if (!enabled) {
    const {
      generateHomeworkSync,
      enableImageGeneration,
      outlineEnhancementEnabled,
      documentProcessingMode,
      ...safePayload
    } = payload as T & Partial<CoursewareManualSelection>
    void generateHomeworkSync
    void enableImageGeneration
    void outlineEnhancementEnabled
    void documentProcessingMode
    return { ...safePayload, manualSelectionEnabled: false }
  }
  return {
    ...payload,
    manualSelectionEnabled: true,
    generationOptions: {
      homework: selection.generateHomeworkSync ? 'yes' : 'no',
      imageGeneration: selection.enableImageGeneration ? 'yes' : 'no',
      splitOptimization: selection.outlineEnhancementEnabled ? 'yes' : 'no',
      coursewareMode:
        selection.documentProcessingMode === 'direct' ? 'preserve_original' : 'ai_rebuild'
    }
  }
}
