export const getProgressTone = (progress: number) => {
  if (progress >= 80) {
    return {
      color: '#3B8F72',
      textClass: 'text-[#3B8F72]',
      borderClass: 'border-[#BFDCCF]',
      softClass: 'bg-[#EEF8F4]'
    }
  }

  if (progress >= 60) {
    return {
      color: '#B9822B',
      textClass: 'text-[#B9822B]',
      borderClass: 'border-[#E8CCA0]',
      softClass: 'bg-[#FFF7EA]'
    }
  }

  return {
    color: '#D9485F',
    textClass: 'text-[#D9485F]',
    borderClass: 'border-[#F1D8DC]',
    softClass: 'bg-[#FFF3F5]'
  }
}

export const brandTone = {
  textClass: 'text-[#A85F4B]',
  mutedTextClass: 'text-[#C97967]',
  bgClass: 'bg-[#FFF0E8]',
  borderClass: 'border-[#F3C9BC]'
}

export const aiActionTone = {
  primaryColor: '#515BCB',
  buttonClass:
    'bg-[#EEF1FF] text-[#515BCB] border border-[#D8DEFF] hover:bg-[#E1E7FF] hover:text-[#3F48B4]',
  primaryButtonClass: 'bg-[#515BCB] text-white hover:bg-[#444DB2]',
  softClass: 'bg-[#EEF1FF]',
  borderClass: 'border-[#D8DEFF]',
  textClass: 'text-[#515BCB]'
}

export const getScoreTone = (score: number) => {
  if (score >= 90) return '#3B8F72'
  if (score >= 75) return '#B9822B'
  return '#D9485F'
}

export const getTaskStatusTone = (status: string) => {
  if (['已完成', '已达标', '已交卷'].includes(status)) {
    return { color: '#3B8F72', border: '#BFDCCF', bg: '#EEF8F4' }
  }

  if (
    ['进行中', '学习中', '练习中', '考试中', '正在答题', '考试结束待复核', '待复核'].includes(
      status
    )
  ) {
    return { color: '#8B621F', border: '#E8CCA0', bg: '#FFF7EA' }
  }

  return { color: '#766F73', border: '#E5DED8', bg: '#F8F5F3' }
}
