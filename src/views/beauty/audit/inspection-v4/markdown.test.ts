import { describe, expect, it } from 'vitest'
import {
  formatPlan,
  inlineMarkdown,
  parsePlanMarkdown,
  safePlanLink,
  type PlanFormat
} from './markdown'

describe('计划 Markdown', () => {
  it.each([
    ['h1', '# 计划'],
    ['h2', '## 计划'],
    ['bold', '**计划**'],
    ['italic', '*计划*'],
    ['ul', '- 计划'],
    ['ol', '1. 计划'],
    ['quote', '> 计划'],
    ['hr', '---\n\n']
  ] as [PlanFormat, string][])('格式 %s', (format, expected) => {
    expect(formatPlan('计划', 0, 2, format).value).toBe(expected)
  })
  it('多行列表只替换选择的行，保留前后原文', () => {
    expect(formatPlan('开头\n甲\n乙\n结尾', 3, 6, 'ol').value).toBe('开头\n1. 甲\n2. 乙\n结尾')
    expect(formatPlan('## 标题\n正文', 0, 5, 'h1').value).toBe('# 标题\n正文')
    expect(formatPlan('第一行\n第二行', 0, 4, 'ul').value).toBe('- 第一行\n第二行')
  })
  it('渲染标题、列表、引用、分隔线、代码和段落且保留源码偏移', () => {
    const markdown =
      '# 标题\n\n## 条件\n- 甲\n- 乙\n1. 一\n2. 二\n> 引用\n---\n```html\n<img>\n```\n普通\n文本'
    const blocks = parsePlanMarkdown(markdown)
    expect(blocks.map((item) => item.html)).toEqual([
      '<h1>标题</h1>',
      '<h2>条件</h2>',
      '<ul><li>甲</li><li>乙</li></ul>',
      '<ol start="1"><li>一</li><li>二</li></ol>',
      '<blockquote>引用</blockquote>',
      '<hr>',
      '<pre><code>&lt;img&gt;</code></pre>',
      '<p>普通<br>文本</p>'
    ])
    expect(markdown.slice(blocks[2].start, blocks[2].end)).toBe('- 甲\n- 乙')
    expect(parsePlanMarkdown('```\n尚未闭合')[0].html).toContain('尚未闭合')
    expect(parsePlanMarkdown('')).toEqual([])
  })
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:foo',
    'data:text/html,x',
    'vbscript:foo',
    '//evil.com',
    'https://x\nfoo',
    'java&#115;cript:x',
    'javascript%3Aalert',
    'https://x" onmouseover="x'
  ])('拒绝危险链接 %s', (href) => {
    expect(safePlanLink(href)).toBe(false)
    expect(inlineMarkdown(`[点击](${href})`)).not.toContain('<a ')
  })
  it('转义所有原文，只生成受控标签', () => {
    expect(inlineMarkdown('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
    expect(inlineMarkdown('**<img>** *字* `<>`')).toBe(
      '<strong>&lt;img&gt;</strong> <em>字</em> <code>&lt;&gt;</code>'
    )
    expect(inlineMarkdown('[<img>](https://example.com?a=1&b=2)')).toContain(
      'href="https://example.com?a=1&amp;b=2"'
    )
    expect(inlineMarkdown('[邮箱](mailto:test@example.com)')).toContain('<a ')
  })
})
