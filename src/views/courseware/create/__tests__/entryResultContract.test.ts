import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildCatalogTree } from '../../catalog'

const entry = readFileSync('src/views/courseware/create/index.vue', 'utf8')
const popover = readFileSync(
  'src/views/courseware/create/components/BrandCatalogPopover.vue',
  'utf8'
)

describe('courseware entry and completed series contract', () => {
  it('places voice and catalog before uploaded materials, outside manual selection', () => {
    const identity = entry.indexOf('class="studio-entry-identity"')
    const upload = entry.indexOf('class="courseware-upload-area')
    const manual = entry.indexOf('v-model="manualSelectionPanel"')
    expect(identity).toBeGreaterThan(-1)
    expect(identity).toBeLessThan(upload)
    expect(upload).toBeLessThan(manual)
    expect(entry.match(/v-model="formData.narratorVoiceId"/g)).toHaveLength(1)
    expect(entry.match(/v-model="selectedCatalogKeys"/g)).toHaveLength(1)
  })

  it('offers only preview and return for completed series and keeps the normal preview path', () => {
    expect(entry).not.toContain('handleOpenSeriesItemDownload')
    expect(entry).toContain('handleBackToGeneration')
    expect(entry).toContain('completedWorkspaceTaskId.value')
    expect(entry).toContain("workspace: '1'")
    expect(entry).toContain('handleOpenCompletedResults')
    expect(entry).toContain('await loadCoursewarePreview(coursewareId)')
    expect(entry).toContain('<SeriesPageCover')
  })

  it('uses a compact independent tree selector and a centered management dialog', () => {
    expect(entry).toContain('<el-tree-select')
    expect(entry).not.toContain('<el-cascader')
    expect(entry).toContain('check-strictly')
    expect(entry).toContain('show-checkbox')
    expect(popover).toContain('<el-dialog')
    expect(popover).toContain('align-center')
    expect(popover).not.toContain('<el-popover')
    expect(popover).not.toContain("t('common.add')")
    expect(popover).not.toContain("t('common.refresh')")
  })

  it('refreshes catalog after dialog closes and every dropdown opening', () => {
    expect(popover).toContain('@closed="handleClosed"')
    expect(popover).toContain("emit('refreshed')")
    expect(entry).toContain('@visible-change="handleCatalogVisibleChange"')
    expect(entry).toContain('if (visible) void loadCatalogOptions()')
  })

  it('only exposes create APIs with the existing category/product permissions', () => {
    expect(popover).toContain("checkPermi(['ai:category:create'])")
    expect(popover).toContain("checkPermi(['ai:training-product:create'])")
    expect(popover).toContain('CategorySettingsApi.createBrand')
    expect(popover).toContain('CategorySettingsApi.createCategory')
    expect(popover).toContain('CategorySettingsApi.createTag')
    expect(popover).toContain('AiTrainingProductApi.create')
    expect(popover).not.toMatch(/(?:CategorySettingsApi|AiTrainingProductApi)\.(?:update|delete)/)
  })

  it('keeps newly created brands selectable before their first category exists', () => {
    const tree = buildCatalogTree({
      brands: [{ id: 1, name: '新品牌' }],
      categories: [],
      products: []
    })
    expect(tree).toHaveLength(1)
    expect(tree[0].value).toBe('BRAND:1')
  })
})
