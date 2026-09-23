export type PlanFormat = 'h1' | 'h2' | 'bold' | 'italic' | 'ul' | 'ol' | 'quote' | 'hr'

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  )

// 只允许显式的安全协议；不解析 HTML、图片或实体编码的链接。
export function safePlanLink(value: string): boolean {
  return /^(https?:\/\/|mailto:)[^\s<>"'\u0000-\u001f\u007f]+$/i.test(value)
}

export function inlineMarkdown(value: string): string {
  const pattern = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\n]*)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g
  let result = ''
  let cursor = 0
  for (const match of value.matchAll(pattern)) {
    result += escapeHtml(value.slice(cursor, match.index))
    const [, code, label, href, bold, italic] = match
    if (code !== undefined) result += `<code>${escapeHtml(code)}</code>`
    else if (label !== undefined) {
      result += safePlanLink(href)
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
        : escapeHtml(match[0])
    } else if (bold !== undefined) result += `<strong>${escapeHtml(bold)}</strong>`
    else result += `<em>${escapeHtml(italic)}</em>`
    cursor = match.index! + match[0].length
  }
  return result + escapeHtml(value.slice(cursor))
}

export interface PlanBlock {
  start: number
  end: number
  html: string
}

// 每个块保留原始偏移，点击编辑时无需反向转换 HTML。
export function parsePlanMarkdown(source: string): PlanBlock[] {
  const lines = source.split('\n')
  const blocks: PlanBlock[] = []
  let offset = 0
  for (let index = 0; index < lines.length;) {
    const start = offset
    const line = lines[index]
    const advance = () => {
      offset += lines[index].length + 1
      index++
    }
    if (!line.trim()) {
      advance()
      continue
    }
    let html = ''
    if (/^```/.test(line)) {
      advance()
      const code: string[] = []
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index])
        advance()
      }
      if (index < lines.length) advance()
      html = `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`
    } else if (/^#{1,6}\s/.test(line)) {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line)!
      html = `<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`
      advance()
    } else if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      html = '<hr>'
      advance()
    } else if (/^\s*(?:[-+*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const matcher = ordered ? /^\s*\d+\.\s+/ : /^\s*[-+*]\s+/
      const items: string[] = []
      while (index < lines.length && matcher.test(lines[index])) {
        items.push(`<li>${inlineMarkdown(lines[index].replace(matcher, ''))}</li>`)
        advance()
      }
      const tag = ordered ? 'ol' : 'ul'
      const number = ordered ? ` start="${Number.parseInt(line.trim(), 10) || 1}"` : ''
      html = `<${tag}${number}>${items.join('')}</${tag}>`
    } else if (/^>\s?/.test(line)) {
      const quotes: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quotes.push(inlineMarkdown(lines[index].replace(/^>\s?/, '')))
        advance()
      }
      html = `<blockquote>${quotes.join('<br>')}</blockquote>`
    } else {
      const paragraph: string[] = []
      while (index < lines.length && lines[index].trim()) {
        if (
          paragraph.length &&
          /^(#{1,6}\s|```|>\s?|\s*(?:[-+*]|\d+\.)\s+|\s*(?:---+|\*\*\*+|___+)\s*$)/.test(
            lines[index]
          )
        )
          break
        paragraph.push(inlineMarkdown(lines[index]))
        advance()
      }
      html = `<p>${paragraph.join('<br>')}</p>`
    }
    blocks.push({ start, end: Math.min(source.length, offset - 1), html })
  }
  return blocks
}

/** 富文本及剪贴板只保留文档语义；危险节点、属性与链接不会进入渲染结果。 */
export function planHtmlToMarkdown(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const visit = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent || ''
    if (node.nodeType !== 1) return ''
    const element = node as HTMLElement
    const tag = element.tagName.toLowerCase()
    if (
      [
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'svg',
        'math',
        'img',
        'input',
        'button',
        'template'
      ].includes(tag)
    )
      return ''
    const content = Array.from(node.childNodes).map(visit).join('')
    if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${content.trim()}\n\n`
    if (tag === 'strong' || tag === 'b') return `**${content}**`
    if (tag === 'em' || tag === 'i') return `*${content}*`
    if (tag === 'br') return '\n'
    if (tag === 'hr') return '\n\n---\n\n'
    if (tag === 'a') {
      const href = element.getAttribute('href') || ''
      return safePlanLink(href) ? `[${content}](${href})` : content
    }
    if (tag === 'li') {
      const index = Array.from(element.parentElement?.children || []).indexOf(element) + 1
      const prefix = element.parentElement?.tagName === 'OL' ? `${index}. ` : '- '
      return `${prefix}${content.trim()}\n`
    }
    if (tag === 'blockquote')
      return `\n\n${content
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')}\n\n`
    if (tag === 'code') return `\`${content}\``
    if (['p', 'div', 'section', 'ul', 'ol', 'pre'].includes(tag)) return `\n\n${content.trim()}\n\n`
    return content
  }
  return Array.from(template.content.childNodes)
    .map(visit)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatPlan(source: string, start: number, end: number, format: PlanFormat) {
  const selected = source.slice(start, end)
  let from = start
  let to = end
  let replacement: string
  if (format === 'bold' || format === 'italic') {
    const marker = format === 'bold' ? '**' : '*'
    replacement = `${marker}${selected || '文字'}${marker}`
  } else if (format === 'hr') {
    replacement = `${start > 0 ? '\n\n' : ''}---\n\n`
  } else {
    from = source.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    if (start === 0) from = 0
    const last = end > start && source[end - 1] === '\n' ? end - 1 : end
    const newline = source.indexOf('\n', last)
    to = newline < 0 ? source.length : newline
    replacement = source
      .slice(from, to)
      .split('\n')
      .map((line, index) => {
        const text = line.replace(/^\s*(?:#{1,6}\s+|[-+*]\s+|\d+\.\s+|>\s?)/, '')
        const prefix = { h1: '# ', h2: '## ', ul: '- ', ol: `${index + 1}. `, quote: '> ' }[format]
        return prefix + text
      })
      .join('\n')
  }
  return {
    value: source.slice(0, from) + replacement + source.slice(to),
    start: from,
    end: from + replacement.length
  }
}
