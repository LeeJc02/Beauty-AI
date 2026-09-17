import { computed, type ComputedRef } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { DEMO_ROLES } from '@/mock/data/roles'
import type { Role } from '@/beauty/types'
import { percent } from '@/beauty/lib/inspectionEngine'
import type {
  AudienceScope,
  InspectionActor,
  InspectionRisk,
  InspectionState,
  PersonRole,
  RiskLevel,
  RiskStatus
} from '@/beauty/lib/inspectionTypes'

/**
 * 数据审计工作台的共享工具（原型 `pages/training-inspection/shared.tsx`）。
 *
 * 原型把这个文件里的 Chip / LevelBadge / Metric… 小元件和纯函数放在一起；
 * Vue 一个 SFC 只能有一个组件，所以这里只保留纯函数与常量，小组件分别落在
 * `components/Beauty*.vue`。
 */

export const LEVEL_HELP: Record<RiskLevel, string> = {
  high: '阻断发布或要求总部确认',
  medium: '允许发布，但要求负责人确认',
  low: '提示优化',
  insufficient: '不做结论，只要求补齐字段'
}

/** 演示角色的审计身份（原型 `App.tsx` 的 role → InspectionActor 映射）。 */
export const actorForRole = (role: Role): InspectionActor => {
  switch (role) {
    case 'Super Admin':
    case 'HQ Trainer':
      return {
        id: 'sarah',
        name: 'Sarah Lee',
        hq: true,
        roleLabel: '总部培训经理'
      }
    case 'Regional Training Manager':
    case 'Regional Trainer':
      return {
        id: 'fitriani',
        name: 'Fitriani',
        hq: false,
        regionId: 'south',
        roleLabel: '南区培训主管'
      }
    default:
      return {
        id: 'fitriani',
        name: 'Fitriani',
        hq: false,
        regionId: 'south',
        readOnly: true,
        roleLabel: '南区经理（只读）'
      }
  }
}

/**
 * 当前演示角色（对应原型 `App.tsx` 里受控的 `role` state）。
 *
 * 原型的 role 由 App 顶部的角色切换控制，Vue 版改成从登录用户反查：
 * - mock 的 `/system/auth/get-permission-info` 把角色 key 写进 `roles`（如 `hq_trainer`）；
 * - 同时约定 `user.id = 1000 + DEMO_ROLES 下标`。
 *
 * 与 `tasks/useTaskRole.ts`、`dashboard/components/useDashboardRole.ts` 同一套语义，
 * 这里在审计目录内自包含一份，避免跨交付单元互相依赖。只读取 DEMO_ROLES，不改 mock。
 */
export const useAuditRole = (): ComputedRef<Role> => {
  const userStore = useUserStore()

  return computed<Role>(() => {
    const roleKey = userStore.getRoles?.[0]
    const byKey = DEMO_ROLES.find((role) => role.key === roleKey)
    if (byKey) return byKey.beautyRole as Role

    const byIndex = DEMO_ROLES[(userStore.getUser?.id ?? 0) - 1000]
    return (byIndex?.beautyRole as Role) ?? 'HQ Trainer'
  })
}

export const LEVEL_TONE: Record<RiskLevel, string> = {
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-sky-50 text-sky-700 ring-sky-200',
  insufficient: 'bg-violet-50 text-violet-700 ring-violet-200'
}

export const LEVEL_DOT: Record<RiskLevel, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
  insufficient: 'bg-violet-500'
}

export const STATUS_TONE: Record<RiskStatus, string> = {
  待处理: 'bg-slate-100 text-slate-700 ring-slate-200',
  需确认: 'bg-amber-50 text-amber-700 ring-amber-200',
  处理中: 'bg-blue-50 text-blue-700 ring-blue-200',
  已解决: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  例外生效: 'bg-teal-50 text-teal-700 ring-teal-200'
}

/**
 * 原型里 `fieldClass` 在多个文件里逐字重复；这里收敛成一处常量。
 * 注意：原型的 Tailwind preflight 会给 `*` 设 `border-style: solid`，本工程的 UnoCSS
 * 没有这层 reset，所以凡是需要可见边框的地方都要显式带上 `border-solid`。
 */
export const FIELD_CLASS =
  'h-8 min-w-0 rounded-lg border border-solid border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

/** 表单小标题（原型 `SimulatePanel.tsx` / `DispositionDialog.tsx` 的 `labelClass`）。 */
export const FIELD_LABEL_CLASS = 'text-[11px] font-medium text-muted-foreground'

export const riskStatusOf = (state: InspectionState, risk: InspectionRisk): RiskStatus =>
  state.risks.find((record) => record.key === risk.key)?.status ?? '待处理'

export const isOpenRisk = (state: InspectionState, risk: InspectionRisk) =>
  riskStatusOf(state, risk) !== '已解决'

/** 区域角色只看得到自己的员工与区域，风险里的证据同步收窄。 */
export const scopeRisk = (
  risk: InspectionRisk,
  actor: InspectionActor,
  state: InspectionState
): InspectionRisk => {
  if (actor.hq) return risk
  const regionId = actor.regionId ?? ''
  const personIds = risk.personIds.filter(
    (id) => state.people.find((person) => person.id === id)?.regionId === regionId
  )
  const visibleRegions = risk.regionIds.filter((id) => id === regionId)
  if (!visibleRegions.length && risk.regionIds.length) return risk
  return {
    ...risk,
    personIds,
    regionIds: visibleRegions,
    impact: {
      ...risk.impact,
      affectedPeople: risk.personIds.length ? personIds.length : risk.impact.affectedPeople,
      affectedRegions: visibleRegions.length || risk.impact.affectedRegions
    }
  }
}

/** 存档里是 UTC 时间，展示统一换成印尼时间。 */
export const jakartaStamp = (iso: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Jakarta',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(iso))

export const formatDay = (day: string) => day.slice(5).replace('-', '/')
export const weekdayOf = (day: string) =>
  ['日', '一', '二', '三', '四', '五', '六'][new Date(`${day}T12:00:00Z`).getUTCDay()]
export const todayLabel = (day: string) => `${formatDay(day)}（周${weekdayOf(day)}）`
export const percentText = percent

/** 模拟面板的「按范围重算人员」：原型 `SimulatePanel.tsx` 的 `resolveAudience`。 */
export const resolveAudience = (
  state: InspectionState,
  input: {
    scope?: AudienceScope
    regionIds?: string[]
    roles?: PersonRole[] | null
  }
) => {
  const scope = input.scope ?? 'nationwide'
  const regionIds = input.regionIds ?? []
  const roles = input.roles ?? null
  return state.people
    .filter((person) => person.active)
    .filter((person) =>
      scope === 'nationwide' || !regionIds.length ? true : regionIds.includes(person.regionId)
    )
    .filter((person) => (roles && roles.length ? roles.includes(person.role) : true))
    .map((person) => person.id)
}
