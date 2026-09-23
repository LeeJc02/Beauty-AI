import type { TrainingScope } from './trainingInspection'
import { jakartaDay as localDay, jakartaWeek } from './inspectionCalendar'
export function applyInspectionTime(text: string, scope: TrainingScope, clock = new Date()): void {
  text = text.replace(
    /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
    (_, y, m, d) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  )
  const range = text.match(/(\d{4}-\d{2}-\d{2})\s*(?:到|至|~)\s*(\d{4}-\d{2}-\d{2})/)
  if (range) {
    scope.timeMode = 'range'
    scope.startsOn = range[1]
    scope.endsOn = range[2]
  } else if (/昨天|昨日|明天/.test(text)) {
    scope.timeMode = 'range'
    scope.startsOn = scope.endsOn = localDay(
      new Date(clock.getTime() + (/明天/.test(text) ? 1 : -1) * 86400000)
    )
  } else if (/本周|今天|今日/.test(text)) {
    scope.timeMode = 'range'
    if (/本周/.test(text)) Object.assign(scope, jakartaWeek(clock))
    else scope.startsOn = scope.endsOn = localDay(clock)
  } else if (
    /当前(?:新品|敏感肌|彩妆|全部|新)?课件|当前数据|当前记录|当前全部|当前可见|只查当前|只看当前|截至现在|所有历史/.test(
      text
    )
  ) {
    scope.timeMode = 'current'
    scope.startsOn = scope.endsOn = undefined
  } else if (/今后|以后|之后|每当|生成时|持续新增/.test(text)) {
    scope.timeMode = 'ongoing'
    scope.startsOn = scope.endsOn = undefined
  }
  if (
    /上周|下周|上月|本月|去年|今年|最近|近\d+天|\d+点|\d+小时/.test(text) ||
    (!range && /\d{4}(?:-|年)/.test(text))
  ) {
    scope.timeMode = undefined
    scope.startsOn = scope.endsOn = undefined
  }
}
export function inspectionRangeExpired(scope: TrainingScope, clock = new Date()): boolean {
  return scope.timeMode === 'range' && validInspectionTime(scope) && scope.endsOn! < localDay(clock)
}
export function validInspectionTime(scope: TrainingScope, mode?: string): boolean {
  if (
    !scope.timeMode ||
    (mode === 'once' && scope.timeMode === 'ongoing') ||
    (mode === 'continuous' && scope.timeMode === 'current')
  )
    return false
  if (scope.timeMode !== 'range') return true
  const valid = (day?: string) =>
    Boolean(
      day &&
      /^\d{4}-\d{2}-\d{2}$/.test(day) &&
      Number.isFinite(Date.parse(day)) &&
      new Date(day).toISOString().slice(0, 10) === day
    )
  return valid(scope.startsOn) && valid(scope.endsOn) && scope.startsOn! <= scope.endsOn!
}
export function inspectionDateInRange(
  value: string | Date | undefined,
  scope: TrainingScope
): boolean | undefined {
  if (!value || !Number.isFinite(new Date(value).getTime())) return undefined
  const day = localDay(new Date(value))
  return (
    scope.timeMode !== 'range' ||
    Boolean(scope.startsOn && scope.endsOn && day >= scope.startsOn && day <= scope.endsOn)
  )
}
export function inspectionRangeActive(scope: TrainingScope, clock: Date): boolean {
  if (scope.timeMode !== 'range') return true
  const day = localDay(clock)
  return Boolean(scope.startsOn && scope.endsOn && day >= scope.startsOn && day <= scope.endsOn)
}
