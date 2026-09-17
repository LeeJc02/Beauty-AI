import { coursewareCreateZh } from './coursewareCreate.zh'

// 原中文命名空间原样提取。仅补充原版模板已使用、语言包尚缺失的键。
const messages = {
  coursewareCreate: {
    ...coursewareCreateZh,
    studio: {
      ...coursewareCreateZh.studio,
      previewPrevious: '上一页',
      previewNext: '下一页',
      swapPanels: '交换左右面板',
    },
  },
}

export function t(key: string, params: Record<string, unknown> = {}): string {
  let result: unknown = messages
  for (const segment of key.split('.')) {
    if (!result || typeof result !== 'object' || !Object.hasOwn(result, segment)) return key
    result = (result as Record<string, unknown>)[segment]
  }
  if (typeof result !== 'string') return key
  return result.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  )
}

export const useI18n = () => ({ t })
