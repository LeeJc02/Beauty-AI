import type { CoursewareCatalogOptionsVO } from '@/api/courseware'
import type { CascaderOption } from 'element-plus'

export type CatalogTargetKey = `BRAND:${number}` | `CATEGORY:${number}` | `PRODUCT:${number}`

export type CatalogTreeNode = CascaderOption

export const buildCatalogTree = (options?: CoursewareCatalogOptionsVO): CatalogTreeNode[] => {
  if (!options) return []
  const categoryNodes = new Map<number, CatalogTreeNode>()
  options.categories.forEach((category) =>
    categoryNodes.set(category.id, {
      value: `CATEGORY:${category.id}`,
      label: category.name,
      children: []
    })
  )
  options.categories.forEach((category) => {
    if (category.parentId && categoryNodes.has(category.parentId)) {
      categoryNodes.get(category.parentId)!.children!.push(categoryNodes.get(category.id)!)
    }
  })
  options.products.forEach((product) => {
    categoryNodes.get(product.categoryId)?.children?.push({
      value: `PRODUCT:${product.id}`,
      label: product.name
    })
  })
  return options.brands.map((brand) => ({
    value: `BRAND:${brand.id}`,
    label: brand.name,
    children: options.categories
      .filter(
        (category) =>
          category.brandId === brand.id &&
          (!category.parentId || !categoryNodes.has(category.parentId))
      )
      .map((category) => categoryNodes.get(category.id)!)
  }))
}

export const splitCatalogKeys = (keys: string[]) => ({
  brandIds: keys.filter((key) => key.startsWith('BRAND:')).map((key) => Number(key.slice(6))),
  categoryIds: keys.filter((key) => key.startsWith('CATEGORY:')).map((key) => Number(key.slice(9))),
  productIds: keys.filter((key) => key.startsWith('PRODUCT:')).map((key) => Number(key.slice(8)))
})

export const joinCatalogKeys = (
  brandIds: number[] = [],
  categoryIds: number[] = [],
  productIds: number[] = []
): CatalogTargetKey[] => [
  ...brandIds.map((id) => `BRAND:${id}` as CatalogTargetKey),
  ...categoryIds.map((id) => `CATEGORY:${id}` as CatalogTargetKey),
  ...productIds.map((id) => `PRODUCT:${id}` as CatalogTargetKey)
]
