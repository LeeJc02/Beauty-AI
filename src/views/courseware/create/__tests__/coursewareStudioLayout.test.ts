import { describe, expect, it } from 'vitest'
import { compile } from 'sass'
import postcss from 'postcss'

const css = postcss.parse(
  compile('src/views/courseware/create/components/coursewareStudio.scss').css
)
// 检查编译后的全部基础声明，后写规则覆盖前写规则，避免仅匹配首个源码块。
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

describe('course studio layout contract', () => {
  it('gives multi-PPT progress a full-width row with readable labels', () => {
    expect(baseStyle('.studio__draft-header > .studio__generated-header')).toMatchObject({
      'flex-direction': 'column',
      'align-items': 'stretch',
      width: '100%'
    })
    expect(baseStyle('.studio__part-progress')).toMatchObject({ width: '100%' })
    expect(baseStyle('.studio__part-progress-label')['font-size']).toBe('12px')
    expect(baseStyle('.studio__part-tabs')).toMatchObject({
      'overflow-x': 'auto',
      flex: '0 0 auto'
    })
  })

  it('never masks scrollbars or card borders', () => {
    const structuralSelectors = /studio__(document|thread|history|draft|conversation|page)(?:\b|$)/
    css.walkRules((rule) => {
      if (!structuralSelectors.test(rule.selector)) return
      rule.walkDecls(/^(?:-webkit-)?mask(?:-image)?$/, (declaration) => {
        expect(declaration.value).toBe('none')
      })
    })
    expect(baseStyle('.studio__document')).toMatchObject({
      'overflow-y': 'auto',
      'scrollbar-gutter': 'stable'
    })
  })

  it('preserves a 30 by 88 ellipse and true panel translation without later overrides', () => {
    expect(baseStyle('.studio__swap-panels')).toMatchObject({
      width: '30px',
      height: '88px',
      'box-sizing': 'border-box',
      padding: '0',
      'border-radius': '999px'
    })
    for (const panel of ['conversation', 'draft']) {
      const style = baseStyle(`.studio__${panel}`)
      expect(style.transition).toContain('transform 620ms')
      expect(style.animation).toBeUndefined()
      expect(baseStyle(`.studio__${panel}.is-swapped`)).toMatchObject({
        transform:
          panel === 'conversation'
            ? 'translateX(calc(100% + 20px))'
            : 'translateX(calc(-100% - 20px))'
      })
      expect(baseStyle(`.studio__${panel}.is-swapped`).order).toBeUndefined()
    }
    let mobileReset = false
    let reducedMotion = false
    css.walkAtRules('media', (rule) => {
      if (rule.params === '(max-width: 768px)') {
        rule.walkRules((child) => {
          if (!child.selectors.includes('.studio__conversation.is-swapped')) return
          child.walkDecls('transform', (declaration) => {
            mobileReset ||= declaration.value === 'none'
          })
        })
      }
      if (rule.params === '(prefers-reduced-motion: reduce)') {
        rule.walkRules((child) => {
          if (!child.selectors.includes('.studio *')) return
          child.walkDecls('transition', (declaration) => {
            reducedMotion ||= declaration.value === 'none' && declaration.important
          })
        })
      }
    })
    expect(mobileReset).toBe(true)
    expect(reducedMotion).toBe(true)
  })
})
