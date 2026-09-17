export const getProgressTone = (progress: number) => {
  if (progress >= 80) {
    return {
      barClass: 'bg-[#3B8F72]',
      indicatorClass: 'bg-[#3B8F72]',
      textClass: 'text-[#3B8F72]',
      hoverClass: 'group-hover:text-[#3B8F72]',
      borderClass: 'border-[#BFDCCF]',
      softClass: 'bg-[#EEF8F4]',
    };
  }

  if (progress >= 60) {
    return {
      barClass: 'bg-[#B9822B]',
      indicatorClass: 'bg-[#B9822B]',
      textClass: 'text-[#B9822B]',
      hoverClass: 'group-hover:text-[#B9822B]',
      borderClass: 'border-[#E8CCA0]',
      softClass: 'bg-[#FFF7EA]',
    };
  }

  return {
    barClass: 'bg-rose-500',
    indicatorClass: 'bg-rose-500',
    textClass: 'text-rose-600',
    hoverClass: 'group-hover:text-rose-600',
    borderClass: 'border-rose-200',
    softClass: 'bg-rose-50',
  };
};

export const brandTone = {
  textClass: 'text-[#A85F4B]',
  mutedTextClass: 'text-[#C97967]',
  bgClass: 'bg-[#FFF0E8]',
  borderClass: 'border-[#F3C9BC]',
  hoverTextClass: 'group-hover:text-[#A85F4B]',
  hoverBgClass: 'hover:bg-[#FFF0E8]',
};

export const aiActionTone = {
  buttonClass: 'bg-[#EEF1FF] text-[#515BCB] border border-[#D8DEFF] hover:bg-[#E1E7FF] hover:text-[#3F48B4] shadow-sm',
  primaryButtonClass: 'bg-[#515BCB] text-white hover:bg-[#444DB2] shadow-sm shadow-[#515BCB]/20',
  ghostButtonClass: 'text-[#515BCB] hover:bg-[#EEF1FF] hover:text-[#3F48B4]',
  iconClass: 'text-[#6974E8]',
  softClass: 'bg-[#EEF1FF]',
  borderClass: 'border-[#D8DEFF]',
  textClass: 'text-[#515BCB]',
};

export const getScoreTone = (score: number) => {
  if (score >= 90) {
    return 'text-[#3B8F72]';
  }

  if (score >= 75) {
    return 'text-[#B9822B]';
  }

  return 'text-rose-600';
};

export const getTaskStatusBadgeClass = (status: string) => {
  if (['已完成', '已达标', '已交卷', '已结束'].includes(status)) {
    return 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]';
  }

  if (['进行中', '学习中', '练习中', '考试中', '正在答题', '分析中'].includes(status)) {
    return 'border-[#E8CCA0] bg-[#FFF7EA] text-[#8B621F]';
  }

  if (['考试结束待复核', '待复核'].includes(status)) {
    return 'border-[#E8CCA0] bg-[#FFF7EA] text-[#B9822B]';
  }

  return 'border-[#E5DED8] bg-[#F8F5F3] text-[#766F73]';
};
