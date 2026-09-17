/**
 * 组织架构（原型 `src/pages/OrganizationView.tsx`）的领域类型与小工具。
 *
 * 原型里节点是 `any`、图标用 lucide-react 组件；这里把图标收窄成枚举键，
 * 再映射到 yudao 全局 `<Icon icon="lucide:xxx">` 的图标名。
 */
export type OrgIconKey = 'Building2' | 'MapPin' | 'Store' | 'User'

export interface OrgNode {
  id: string
  name: string
  /** 节点类型文案（总部 / 大区 / 区域 / 门店 / 店长 / 高级BA / 初级BA） */
  type: string
  icon: OrgIconKey
  code: string
  /** 负责人 / 联络人 */
  manager?: string
  /** 联络方式（邮箱 / 电话） */
  contact?: string
  children?: OrgNode[]
}

const ORG_ICON_NAMES: Record<OrgIconKey, string> = {
  Building2: 'lucide:building-2',
  MapPin: 'lucide:map-pin',
  Store: 'lucide:store',
  User: 'lucide:user'
}

/** 等价原型 getIcon(iconName)。 */
export const resolveOrgIconName = (icon: OrgIconKey) => ORG_ICON_NAMES[icon] ?? ORG_ICON_NAMES.Building2

/** 人员类节点（终端节点，没有下级组织）。 */
const ORG_PERSON_TYPES = ['初级BA', '高级BA', '店长']

export const isOrgPersonType = (type: string) => ORG_PERSON_TYPES.includes(type)

/** 等价原型节点右侧徽标的配色分支。 */
export const orgTypeBadgeClass = (type: string) => {
  if (isOrgPersonType(type)) return 'bg-slate-100 text-[#766F73]'
  if (type === '门店') return 'bg-[#FFF7EA] text-[#B9822B]'
  return 'bg-rose-50 text-rose-600'
}
