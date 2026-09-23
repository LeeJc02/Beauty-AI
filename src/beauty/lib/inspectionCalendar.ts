export const INSPECTION_TIME_ZONE = 'Asia/Jakarta'
export function jakartaDay(date: Date): string {
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INSPECTION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}-${parts.find((p) => p.type === 'day')!.value}`
}
export function jakartaWeek(clock: Date): { startsOn: string; endsOn: string } {
  const day = jakartaDay(clock)
  if (!day) return { startsOn: '', endsOn: '' }
  const start = new Date(`${day}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return { startsOn: start.toISOString().slice(0, 10), endsOn: end.toISOString().slice(0, 10) }
}
