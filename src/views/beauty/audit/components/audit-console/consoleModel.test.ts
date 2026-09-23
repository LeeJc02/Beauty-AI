import { describe, expect, it } from 'vitest'
import {
  artifactStageOf,
  auditContextFor,
  isNearBottom,
  reportFor,
  stageShowsScope,
  type ConsoleItem
} from './consoleModel'
import type { AuditContext, AuditReport } from '@/beauty/lib/auditTools'

const context = (scopeLabel: string): AuditContext => ({
  weeks: ['2025-05-12'],
  week: '2025-05-12',
  today: '2025-05-18',
  actor: {
    id: 'actor-1',
    name: '区域主管',
    hq: false,
    regionId: 'region-south',
    roleLabel: 'Supervisor'
  },
  regionIds: ['region-south'],
  scopeLabel,
  categories: [],
  focus: 'all'
})

const reportItem = (id: string, scopeLabel: string, trailId: string): ConsoleItem => ({
  kind: 'report',
  id,
  report: {} as AuditReport,
  ctx: context(scopeLabel),
  question: '本周情况怎么样？',
  trailId
})

describe('audit console batch state', () => {
  it('does not resurrect an old report after a new batch clears the active id', () => {
    const oldReport = reportItem('report-old', '南区', 'trail-old')
    const newReport = reportItem('report-new', '全国', 'trail-new')
    const items = [oldReport, newReport]

    expect(reportFor(items, 'report-old')?.ctx.scopeLabel).toBe('南区')
    expect(reportFor(items, null)).toBeNull()
    expect(reportFor(items, 'report-new')?.ctx.scopeLabel).toBe('全国')
  })

  it('keeps clarification context ahead of the page and previous report context', () => {
    const base = context('当前区域')
    const previousReport = context('全国')
    const currentRun = context('南区')
    const clarification = context('北区')

    expect(auditContextFor(base, clarification, currentRun, previousReport)).toBe(clarification)
    expect(auditContextFor(base, null, currentRun, previousReport)).toBe(currentRun)
    expect(auditContextFor(base, null, null, previousReport)).toBe(previousReport)
  })

  it('only follows the conversation when the reader is near the bottom', () => {
    expect(isNearBottom(1000, 940, 60)).toBe(true)
    expect(isNearBottom(1000, 700, 60)).toBe(false)
    expect(isNearBottom(1000, 880, 60, 48)).toBe(false)
  })

  it('keeps the artifact side empty while the scope is still being confirmed', () => {
    // 补问期间：只是页面默认值，不能当成用户选过的条件展示。
    const stage = artifactStageOf({
      entered: true,
      pending: true,
      hasTrail: false,
      hasReport: false
    })
    expect(stage).toBe('clarifying')
    expect(stageShowsScope(stage)).toBe(false)
  })

  it('reveals scope and data only once collection starts', () => {
    expect(
      stageShowsScope(
        artifactStageOf({ entered: true, pending: false, hasTrail: true, hasReport: false })
      )
    ).toBe(true)
    expect(
      stageShowsScope(
        artifactStageOf({ entered: true, pending: false, hasTrail: true, hasReport: true })
      )
    ).toBe(true)
    expect(
      stageShowsScope(
        artifactStageOf({ entered: false, pending: false, hasTrail: false, hasReport: false })
      )
    ).toBe(false)
  })

  it('prefers the report stage over a stale trail', () => {
    expect(
      artifactStageOf({ entered: true, pending: false, hasTrail: true, hasReport: true })
    ).toBe('reporting')
  })
})
