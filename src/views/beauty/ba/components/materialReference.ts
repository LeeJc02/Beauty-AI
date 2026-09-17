import type { GoldenMaterial } from '@/beauty/types'

/** 与原型 MaterialReferenceDialog 内联的 formatTime 保持一致。 */
export const formatMaterialTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** 黄金素材的目标类型：显式字段优先，缺省时按候选类型推断。 */
export const materialTargetKind = (material: GoldenMaterial) =>
  material.targetKind ?? (material.type === 'scenario_beat' ? 'scenario' : 'product')
