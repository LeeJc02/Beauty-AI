import type { AgentEvent } from './taskFlow'

export const DEMO_TRIGGER_SECONDS = 20
export const DEMO_STEP_MS = 850

/** 最近一次已完成执行的回放，不生成业务结果或通知。 */
export function latestRoundEvents(events: AgentEvent[], round: number): AgentEvent[] {
  const tagged = events.filter((event) => event.round === round)
  if (tagged.length) return tagged
  const index = events.map((event) => event.kind).lastIndexOf('analysis')
  // 旧记录无 round：以最后一个规划段为起点，避免把历史全量当作实时输出。
  const planning = events
    .map((event) => /规划|工具选择|复查 Agent/.test(event.title))
    .lastIndexOf(true)
  return events.slice(planning >= 0 ? planning : Math.max(0, index - 3)).slice(-12)
}
