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
    // Omit<> 去掉键后的对象无法被 TS 证明就是泛型 T（T 可能是更窄的子类型），这里显式收口。
    // 运行时返回值与原型完全一致：只少掉被剥离的四个手动参数。
    return { ...(safePayload as T), manualSelectionEnabled: false }
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
