import type { DeepReadonly } from 'vue'
import type { CoursewareInspectionEntry } from './coursewareInspection'
/** 核验事实独立于跟进状态；旧停止记录只从明确核验措辞恢复。 */
export function inspectionEvaluation(
  entry: DeepReadonly<CoursewareInspectionEntry>
): 'passed' | 'mismatch' | 'missing' | undefined {
  if (entry.evaluatedOutcome) return entry.evaluatedOutcome
  if (entry.outcome === 'passed') return 'passed'
  if (entry.outcome === 'mismatch' || entry.outcome === 'acknowledged') return 'mismatch'
  if (entry.status === 'missing_evidence') return 'missing'
  for (const event of [...entry.events].reverse()) {
    if (
      /已核验.*不符合|已核验.*不合规|成绩\s*\d+(?:\.\d+)?分；未达标|考核\s*\d+(?:\.\d+)?分；.*未达标/.test(
        event.text
      )
    )
      return 'mismatch'
    if (/已核验.*符合.*要求|成绩\s*\d+(?:\.\d+)?分；符合已确认标准/.test(event.text))
      return 'passed'
    if (/缺少.*暂不判断|缺少.*暂不能判断|核验依据尚不完整/.test(event.text)) return 'missing'
  }
  return undefined
}
