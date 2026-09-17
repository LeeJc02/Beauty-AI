/**
 * 数据看板统一的视觉色调工具
 * 从产品原型 Beauty-AI/src/lib/visualTones.ts 移植
 */

// ---- 进度色调 ----

export interface ProgressTone {
  barClass: string
  indicatorClass: string
  textClass: string
  hoverClass: string
  borderClass: string
  softClass: string
}

export const getProgressTone = (progress: number): ProgressTone => {
  if (progress >= 80) {
    return {
      barClass: 'bg-[#3B8F72]',
      indicatorClass: 'bg-[#3B8F72]',
      textClass: 'text-[#3B8F72]',
      hoverClass: 'group-hover:text-[#3B8F72]',
      borderClass: 'border-[#BFDCCF]',
      softClass: 'bg-[#EEF8F4]'
    }
  }
  if (progress >= 60) {
    return {
      barClass: 'bg-[#B9822B]',
      indicatorClass: 'bg-[#B9822B]',
      textClass: 'text-[#B9822B]',
      hoverClass: 'group-hover:text-[#B9822B]',
      borderClass: 'border-[#E8CCA0]',
      softClass: 'bg-[#FFF7EA]'
    }
  }
  return {
    barClass: 'bg-rose-500',
    indicatorClass: 'bg-rose-500',
    textClass: 'text-rose-600',
    hoverClass: 'group-hover:text-rose-600',
    borderClass: 'border-rose-200',
    softClass: 'bg-rose-50'
  }
}

// ---- 品牌色调 ----

export const brandTone = {
  textClass: 'text-[#A85F4B]',
  mutedTextClass: 'text-[#C97967]',
  bgClass: 'bg-[#FFF0E8]',
  borderClass: 'border-[#F3C9BC]'
}

// ---- 分数色调 ----

export const getScoreTone = (score: number): string => {
  if (score >= 90) return 'text-[#3B8F72]'
  if (score >= 75) return 'text-[#B9822B]'
  return 'text-rose-600'
}

// ---- 任务状态 Badge 色调 ----

export const getTaskStatusBadgeClass = (status: string): string => {
  if (['已完成', '已达标', '已交卷'].includes(status)) {
    return 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]'
  }
  if (['进行中', '学习中', '练习中', '考试中', '正在答题'].includes(status)) {
    return 'border-[#E8CCA0] bg-[#FFF7EA] text-[#8B621F]'
  }
  return 'border-[#E5DED8] bg-[#F8F5F3] text-[#766F73]'
}

// ---- 任务类型 Badge 色调 ----

export const getTaskTypeBadgeClass = (taskTypeCode: string): string => {
  switch ((taskTypeCode || '').toUpperCase()) {
    case 'EXAM':
      return 'border-rose-200 text-rose-600 bg-rose-50'
    case 'STUDY':
      return 'border-[#E5DED8] text-[#5D565A] bg-[#F8F5F3]'
    case 'PRACTICE':
    default:
      return 'border-[#BFDCCF] text-[#3B8F72] bg-[#EEF8F4]'
  }
}

// ---- 格式化 ----

export const formatCount = (count: number): string => {
  if (count >= 10000) return `${(count / 1000).toFixed(1)}k`
  return count.toLocaleString()
}

export const formatPracticeHours = (hours: number): string => {
  if (hours >= 10000) return `约 ${(hours / 10000).toFixed(1)} 万小时`
  return `约 ${hours.toLocaleString()} 小时`
}
