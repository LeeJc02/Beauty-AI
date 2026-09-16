import React from 'react';
import { CoursewareCreateFlow } from './courseware/CoursewareCreateFlow';

/** 兼容旧调用方的类型：页面内部已经自己管理生成任务，不再需要外部进度。 */
export interface CourseTask {
  status: 'generating' | 'done';
  progress: number;
  courseTitle?: string;
}

interface CourseCreationProps {
  courseTask?: CourseTask | null;
  startGeneration?: () => void;
  resetTask?: () => void;
  onExitEditor?: () => void;
  onOpenHomework?: (courseTitle: string) => void;
}

/**
 * 在线课件 › 生成新课件
 *
 * 复刻 SalesBoost-vue（test 分支）`src/views/courseware/create/`：
 * 入口卡（提示词 + 课程类型 + 参考资料 + 课程设置）→ 课程共创工作台
 * （左「与 AI 共创」反问/进度，右「课程草稿」摘要/大纲/页面）→ 系列课件预览。
 * 全部用前端演示数据驱动，不连后端。
 */
export function CourseCreation(props: CourseCreationProps) {
  void props;
  return <CoursewareCreateFlow />;
}
