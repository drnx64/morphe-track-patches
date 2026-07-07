import { escHtml } from '../utils/html'
import type { ReleaseSection } from '../types/release'

function cleanEntryDesc(str: string): string {
  if (!str) return ''
  return str
    .replace(/\s*\(\[#[0-9]+\]\([^)]+\)\)\s*$/, '')
    .replace(/\s*\[\#[0-9]+\]\([^)]+\)\s*$/, '')
    .replace(/\s*\(#[0-9]+\)\s*$/, '')
    .trim()
}

function isStructuredSection(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.trim())
  if (nonEmpty.length === 0) return false
  const listItems = nonEmpty.filter((l) => /^[*\-]/.test(l)).length
  return listItems / nonEmpty.length > 0.5
}

function parseStructuredEntries(raw: string[], section: ReleaseSection): void {
  const entries: string[] = raw.map((l) => l.replace(/^[\s]*[-*]\s+/, ''))

  for (const text of entries) {
    let commitLink = ''
    let body = text

    const commitMatch = text.match(/\s*\(\[([a-f0-9]{6,40})\]\(([^)]+)\)\)\s*$/)
    if (commitMatch) {
      commitLink = commitMatch[0].trim()
      body = text.slice(0, text.indexOf(commitMatch[0])).trim()
    }

    const scopeMatch = body.match(/^\*\*([^*]+)\*\*:\s*(.+)/)
    if (scopeMatch) {
      section.entries.push({ type: 'change', scope: scopeMatch[1].trim(), description: cleanEntryDesc(scopeMatch[2]), commitLink })
      continue
    }

    const csMatch = body.match(/^(feat|fix|chore|docs|refactor)\(([^)]+)\):\s*(.+)/)
    if (csMatch) {
      section.entries.push({ type: 'change', scope: csMatch[2].trim(), description: cleanEntryDesc(csMatch[3]), changeType: csMatch[1], commitLink })
      continue
    }

    const boldScope = body.match(/^\*\*([^*]+)\*\*\s+(.+)/)
    if (boldScope) {
      section.entries.push({ type: 'change', scope: boldScope[1].trim(), description: cleanEntryDesc(boldScope[2]), commitLink })
      continue
    }

    const actionAppMatch = body.match(/^(add|fix|update|remove|bump|improve)\s+(.+)/i)
    if (actionAppMatch) {
      section.entries.push({ type: 'change', scope: cleanEntryDesc(actionAppMatch[2]), description: actionAppMatch[1].toLowerCase(), changeType: actionAppMatch[1].toLowerCase(), commitLink })
      continue
    }

    if (commitLink) {
      const desc = cleanEntryDesc(body)
      if (desc) {
        section.entries.push({ type: 'change', scope: desc, description: '', commitLink })
        continue
      }
    }

    const colonSplit = body.match(/^([A-Za-z][A-Za-z0-9 ._-]+?):\s*(.+)/)
    if (colonSplit) {
      section.entries.push({ type: 'change', scope: colonSplit[1].trim(), description: cleanEntryDesc(colonSplit[2]), commitLink })
      continue
    }

    const desc = cleanEntryDesc(body)
    if (desc) {
      section.entries.push({ type: 'change', scope: '', description: desc, commitLink })
    }
  }
}

export function stripVersionHeader(text: string): string {
  if (!text) return ''
  const lines = text.split('\n')
  let idx = 0
  while (idx < lines.length && !lines[idx].trim()) idx++
  if (idx < lines.length) {
    const first = lines[idx].trim()
    if (/^#{1,2}\s+(?:\[[^\]]*\]\([^)]*\)|v?\d[\w.\-+]*)\s*(?:\([^)]*\))?\s*$/.test(first)) {
      lines.splice(idx, 1)
    }
  }
  return lines.join('\n').trim()
}

export function parseReleaseNotes(text: string): ReleaseSection[] {
  if (!text) return []
  const sections: ReleaseSection[] = []
  const lines = text.split('\n')

  function addLine(heading: string, line: string) {
    const s: ReleaseSection = { heading, rawLines: [line], entries: [], mode: 'structured', markdown: '' }
    sections.push(s)
    return s
  }

  let current: ReleaseSection | null = null

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    if (/^#{1,2}\s+(?:\[[\w.\-+]+\]\([^)]*\)|[\w.]+[\w.-]*)\s*(?:\([\w\-\s,:]+\))?\s*$/.test(trimmed)) continue
    if (/^\[.+\]\(.+\)/.test(trimmed) && trimmed.includes('|')) continue

    if (/^###\s*\S/.test(trimmed)) {
      current = addLine(trimmed.replace(/^###\s+/, '').trim(), '')
      continue
    }

    if (/^={2,}\s*$/.test(trimmed) && i > 0) {
      const nameLine = lines[i - 1].trim()
      if (nameLine && !nameLine.startsWith('#') && !nameLine.startsWith('=') && nameLine.length < 60) {
        current = addLine(nameLine, '')
        continue
      }
    }

    if (/^={2,}\s*$/.test(trimmed) || /^-{2,}\s*$/.test(trimmed)) continue

    if (current && current.rawLines) {
      if (trimmed) current.rawLines.push(trimmed)
    } else if (trimmed) {
      current = addLine('Overview', trimmed)
    }
  }

  for (const section of sections) {
    const raw = section.rawLines || []
    if (isStructuredSection(raw)) {
      section.mode = 'structured'
      parseStructuredEntries(raw, section)
    } else {
      section.mode = 'markdown'
      section.markdown = raw.join('\n')
    }
    delete section.rawLines
  }

  return sections.filter((s) => {
    if (s.mode === 'structured') return s.entries.length > 0
    return (s.markdown || '').trim().length > 0
  }).filter((s) => !/^v?[\d]+\.[\d]+/.test(s.heading.trim()))
}

export function getSectionClass(heading: string): string {
  const h = heading.toLowerCase()
  if (h.includes('bug fix') || h.includes('fix')) return 'release-section--fixes'
  if (h.includes('feature') || h.includes('feat')) return 'release-section--features'
  if (h.includes('support') || h.includes('update')) return 'release-section--support'
  return 'release-section--other'
}

export function getSectionLabel(heading: string): string {
  const h = heading.toLowerCase()
  if (h.includes('bug fix') || h.includes('fix')) return 'Bug Fixes'
  if (h.includes('feature') || h.includes('feat')) return 'Features'
  if (h.includes('support') || h.includes('update')) return 'Updates'
  if (h.includes('announce')) return 'Announcement'
  return heading
}

export function renderChangeType(type?: string): string {
  if (!type) return ''
  const t = type.toLowerCase()
  if (t === 'add' || t === 'bump' || t === 'feat') return '<span class="change-type change-type--add">+</span>'
  if (t === 'fix') return '<span class="change-type change-type--fix">&#10003;</span>'
  if (t === 'remove') return '<span class="change-type change-type--remove">&#8722;</span>'
  if (t === 'update' || t === 'chore' || t === 'refactor') return '<span class="change-type change-type--update">&#8631;</span>'
  if (t === 'improve' || t === 'docs') return '<span class="change-type change-type--improve">&#8593;</span>'
  return ''
}

export function renderCommitLink(linkText: string): string {
  if (!linkText) return ''
  const match = linkText.match(/\(\[([a-f0-9]{6,40})\]\(([^)]+)\)\)/)
  if (match) {
    return `<a href="${escHtml(match[2])}" target="_blank" rel="noopener" class="release-commit-link" title="${escHtml(match[2])}">${escHtml(match[1])}</a>`
  }
  return ''
}

export function renderMarkdown(text: string): string {
  if (!text) return ''
  const blocks = text.split('\n\n')
  let html = ''
  for (const block of blocks) {
    const b = block.trim()
    if (!b) continue

    if (/^\|/.test(b) && /\|[-:]+\|/.test(b)) {
      const rows = b.split('\n')
      html += '<table>'
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].split('|')
        if (cells[0]?.trim() === '') cells.shift()
        if (cells[cells.length - 1]?.trim() === '') cells.pop()
        if (r === 1 && /^\s*[-:]+\s*$/.test(cells.join(''))) continue
        const tag = r === 1 ? 'th' : 'td'
        html += '<tr>'
        for (const cell of cells) {
          html += `<${tag}>${renderInlineMarkdown(cell.trim())}</${tag}>`
        }
        html += '</tr>'
      }
      html += '</table>'
      continue
    }

    if (/^>\s?/.test(b)) {
      const qlines = b.split('\n')
      const qhtml = qlines.map((l) => l.replace(/^>\s?/, '').trim()).join('\n')
      html += `<blockquote><p>${renderInlineMarkdown(qhtml)}</p></blockquote>`
      continue
    }

    if (/^-{3,}\s*$/.test(b) || /^\*{3,}\s*$/.test(b)) {
      html += '<hr>'
      continue
    }

    if (/^[*\-]\s/.test(b)) {
      const llines = b.split('\n')
      html += '<ul>'
      for (const li of llines) {
        const item = li.replace(/^[*\-]\s+/, '').trim()
        if (item) html += `<li>${renderInlineMarkdown(item)}</li>`
      }
      html += '</ul>'
      continue
    }

    html += `<p>${renderInlineMarkdown(b)}</p>`
  }
  return html
}

export function renderInlineMarkdown(str: string): string {
  if (!str) return ''
  let html = escHtml(str)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return html
}

export function renderReleaseSections(parsed: ReleaseSection[]): string {
  if (!parsed.length) return ''
  let html = ''
  for (const section of parsed) {
    const sectionClass = getSectionClass(section.heading)
    const sectionLabel = getSectionLabel(section.heading)
    html += `<div class="release-section ${sectionClass}">`
    html += `<div class="release-section-header">${escHtml(sectionLabel)}</div>`

    if (section.mode === 'markdown') {
      html += `<div class="release-section-markdown">${renderMarkdown(section.markdown || '')}</div>`
    } else {
      for (const entry of section.entries) {
        if (entry.type === 'change') {
          html += '<div class="release-entry">'
          const ctHtml = renderChangeType(entry.changeType)
          if (ctHtml) html += ctHtml
          if (entry.scope) {
            const parts = entry.scope.split(' - ')
            const appName = parts[0]
            const featureName = parts.slice(1).join(' - ')
            html += `<span class="release-entry-scope">${escHtml(appName)}</span>`
            if (featureName) html += `<span class="release-entry-feature">${escHtml(featureName)}</span>`
          }
          if (entry.description && !ctHtml) {
            html += `<span class="release-entry-desc">${renderInlineMarkdown(entry.description)}</span>`
          }
          if (entry.commitLink) html += renderCommitLink(entry.commitLink)
          html += '</div>'
        } else if (entry.type === 'text') {
          html += `<div class="release-entry release-entry--text">${renderInlineMarkdown(entry.text || '')}</div>`
        }
      }
    }
    html += '</div>'
  }
  return html
}
