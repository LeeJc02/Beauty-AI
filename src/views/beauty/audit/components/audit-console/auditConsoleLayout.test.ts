import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compile } from 'sass'
import postcss from 'postcss'

const css = postcss.parse(
  compile(resolve(process.cwd(), 'src/views/beauty/audit/components/audit-console.scss')).css
)

function baseStyle(selector: string) {
  const declarations: Record<string, string> = {}
  css.walkRules((rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.includes(selector)) return
    rule.walkDecls((declaration) => {
      declarations[declaration.prop] = declaration.value
    })
  })
  return declarations
}

describe('audit console layout contract', () => {
  it('keeps equally sized interaction and artifact panels in fixed positions', () => {
    expect(baseStyle('.audit-console-root .studio__body')).toMatchObject({
      'grid-template-columns': 'repeat(2, minmax(0, 1fr))',
      gap: '20px'
    })
    for (const panel of ['studio__conversation', 'studio__draft']) {
      expect(baseStyle(`.audit-console-root .${panel}`)).toMatchObject({
        'border-radius': '16px',
        'min-width': '0',
        'min-height': '0'
      })
      expect(baseStyle(`.audit-console-root .${panel}.is-swapped`)).toEqual({})
    }
  })

  it('keeps reading surfaces scrollable and mobile panels switchable', () => {
    expect(baseStyle('.audit-console-root .studio__document')).toMatchObject({
      'overflow-y': 'auto',
      'scrollbar-gutter': 'stable'
    })
    expect(baseStyle('.audit-console-root .audit-thread')['overflow-y']).toBe('auto')
    let hidesInactivePanel = false
    css.walkAtRules('media', (rule) => {
      if (rule.params !== '(max-width: 768px)') return
      rule.walkRules((child) => {
        if (!child.selectors.includes('.audit-console-root .mobile-hidden')) return
        child.walkDecls('display', (declaration) => {
          hidesInactivePanel ||= declaration.value === 'none'
        })
      })
    })
    expect(hidesInactivePanel).toBe(true)
  })
})
