/** 演示区域：与 Beauty-AI 原型（印尼直营）保持一致。 */
export interface DemoArea {
  id: number
  name: string
  /** 区域负责人的演示账号名，用于人员档案 / 负责人展示。 */
  ownerName?: string
}

export const DEMO_HEADQUARTER_AREA: DemoArea = { id: 1, name: '全国' }

export const DEMO_AREAS: DemoArea[] = [
  DEMO_HEADQUARTER_AREA,
  { id: 2, name: '雅加达南区', ownerName: 'Fitriani' },
  { id: 3, name: '雅加达北区', ownerName: 'Dewi' },
  { id: 4, name: '巴厘岛区', ownerName: 'Putri' },
  { id: 5, name: '泗水区', ownerName: 'Rina' }
]

export const areaNameOf = (id: number) => DEMO_AREAS.find((area) => area.id === id)?.name || ''

export interface DemoDataArea {
  headquarterAreaId: number
  headquarterAreaName: string
  ownAreaId?: number
  ownAreaName?: string
  subordinateAreaIds: number[]
  subordinateAreaNames: string[]
  visibleAreaIds: number[]
  visibleAreaNames: string[]
}

/** 总部口径：可见全国。 */
export const headquarterDataArea = (): DemoDataArea => ({
  headquarterAreaId: DEMO_HEADQUARTER_AREA.id,
  headquarterAreaName: DEMO_HEADQUARTER_AREA.name,
  subordinateAreaIds: DEMO_AREAS.slice(1).map((area) => area.id),
  subordinateAreaNames: DEMO_AREAS.slice(1).map((area) => area.name),
  visibleAreaIds: DEMO_AREAS.map((area) => area.id),
  visibleAreaNames: DEMO_AREAS.map((area) => area.name)
})

/** 区域口径：自己 + 下级门店所在区。 */
export const regionalDataArea = (ownAreaId: number, subordinateAreaIds: number[] = []): DemoDataArea => {
  const visible = [ownAreaId, ...subordinateAreaIds]
  return {
    headquarterAreaId: DEMO_HEADQUARTER_AREA.id,
    headquarterAreaName: DEMO_HEADQUARTER_AREA.name,
    ownAreaId,
    ownAreaName: areaNameOf(ownAreaId),
    subordinateAreaIds,
    subordinateAreaNames: subordinateAreaIds.map(areaNameOf),
    visibleAreaIds: visible,
    visibleAreaNames: visible.map(areaNameOf)
  }
}
