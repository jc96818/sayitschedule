<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLabels } from '@/composables/useLabels'
import type { Organization, OrganizationFeatures, OrganizationSettings } from '@/types'

const props = defineProps<{
  markdown: string
  features?: OrganizationFeatures | null
  settings?: OrganizationSettings | null
  organization?: Organization | null
}>()

const router = useRouter()
const labels = useLabels()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeHref(hrefRaw: string): string {
  const href = hrefRaw.trim()
  if (!href) return '#'

  if (href.startsWith('/help/')) {
    return href.replace(/^\/help\//, '/app/help/')
  }

  if (href.startsWith('/app/')) return href
  if (href.startsWith('#')) return href
  if (href.startsWith('https://') || href.startsWith('http://')) return href

  return '#'
}

function renderInlineNoLinks(raw: string): string {
  const escaped = escapeHtml(raw)

  // Code spans (keep simple; content already escaped)
  const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bold
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // Italic
  const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  return withItalic
}

function renderInline(raw: string): string {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  let out = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = linkRe.exec(raw))) {
    out += renderInlineNoLinks(raw.slice(lastIndex, match.index))
    const text = renderInlineNoLinks(match[1])
    const href = sanitizeHref(match[2])
    out += `<a href="${escapeHtml(href)}">${text}</a>`
    lastIndex = match.index + match[0].length
  }

  out += renderInlineNoLinks(raw.slice(lastIndex))
  return out
}

function shouldShowConditional(kind: 'when' | 'when-not', expr: string): boolean {
  const trimmed = expr.trim()
  const negate = kind === 'when-not'

  const [scope, key] = trimmed.split('.', 2)
  if (!scope || !key) return negate ? true : false

  let value: unknown
  if (scope === 'features') value = props.features?.[key as keyof OrganizationFeatures]
  if (scope === 'settings') value = props.settings?.[key as keyof OrganizationSettings]
  if (scope === 'org') value = props.organization?.[key as keyof Organization]

  const truthy = value === true
  return negate ? !truthy : truthy
}

function applyHelpConditionals(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const out: string[] = []

  let mode: null | { kind: 'when' | 'when-not'; expr: string; keep: boolean } = null

  for (const line of lines) {
    const start = line.match(/^<!--\s*help:(when|when-not)\s+(.+?)\s*-->$/)
    if (start) {
      const kind = start[1] as 'when' | 'when-not'
      const expr = start[2]
      const keep = shouldShowConditional(kind, expr)
      mode = { kind, expr, keep }
      continue
    }

    const end = line.match(/^<!--\s*help:end\s*-->$/)
    if (end) {
      mode = null
      continue
    }

    if (!mode || mode.keep) out.push(line)
  }

  return out.join('\n')
}

function applyLabelTokens(markdown: string): string {
  const map: Record<string, string> = {
    'labels.staff.plural': labels.staffLabel.value,
    'labels.staff.singular': labels.staffLabelSingular.value,
    'labels.patient.plural': labels.patientLabel.value,
    'labels.patient.singular': labels.patientLabelSingular.value,
    'labels.room.plural': labels.roomLabel.value,
    'labels.room.singular': labels.roomLabelSingular.value,
    'labels.certification.plural': labels.certificationLabel.value,
    'labels.equipment.plural': labels.equipmentLabel.value
  }

  return markdown.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key: string) => map[key] ?? _m)
}

function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  let i = 0
  let html = ''

  function isTableSeparator(line: string): boolean {
    const t = line.trim()
    if (!t.includes('|')) return false
    return /^(\|?\s*:?-+:?\s*)+(\|?\s*:?-+:?\s*)*$/.test(t.replace(/\|/g, '|'))
  }

  function splitTableRow(line: string): string[] {
    const t = line.trim()
    const rawCells = t.split('|').map((c) => c.trim())
    const cells = rawCells.filter((c, idx) => !(idx === 0 && c === '') && !(idx === rawCells.length - 1 && c === ''))
    return cells
  }

  while (i < lines.length) {
    const line = lines[i]

    // Code fence
    const fence = line.match(/^```(\w+)?\s*$/)
    if (fence) {
      const lang = fence[1] || ''
      i += 1
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1 // consume closing fence
      html += `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`
      continue
    }

    // Headings
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      html += `<h${level}>${renderInline(heading[2].trim())}</h${level}>`
      i += 1
      continue
    }

    // Tables
    if (line.trim().includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableRow(lines[i])
      i += 2 // header + separator
      const bodyRows: string[][] = []
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        bodyRows.push(splitTableRow(lines[i]))
        i += 1
      }

      html += '<table><thead><tr>'
      for (const cell of headerCells) {
        html += `<th>${renderInline(cell)}</th>`
      }
      html += '</tr></thead><tbody>'
      for (const row of bodyRows) {
        html += '<tr>'
        for (const cell of row) {
          html += `<td>${renderInline(cell)}</td>`
        }
        html += '</tr>'
      }
      html += '</tbody></table>'
      continue
    }

    // Lists
    const ulItem = line.match(/^\s*[-*+]\s+(.+)$/)
    const olItem = line.match(/^\s*\d+\.\s+(.+)$/)
    if (ulItem || olItem) {
      const isOrdered = !!olItem
      html += isOrdered ? '<ol>' : '<ul>'
      while (i < lines.length) {
        const current = lines[i]
        const li = isOrdered ? current.match(/^\s*\d+\.\s+(.+)$/) : current.match(/^\s*[-*+]\s+(.+)$/)
        if (!li) break
        html += `<li>${renderInline(li[1].trim())}</li>`
        i += 1
      }
      html += isOrdered ? '</ol>' : '</ul>'
      continue
    }

    // Blank lines
    if (!line.trim()) {
      i += 1
      continue
    }

    // Paragraph (collect until blank line or next block)
    const paraLines: string[] = []
    while (i < lines.length) {
      const current = lines[i]
      if (!current.trim()) break
      if (/^```/.test(current)) break
      if (/^(#{1,6})\s+/.test(current)) break
      if (/^\s*[-*+]\s+/.test(current)) break
      if (/^\s*\d+\.\s+/.test(current)) break
      if (current.trim().includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break
      paraLines.push(current.trim())
      i += 1
    }
    html += `<p>${renderInline(paraLines.join(' '))}</p>`
  }

  return html
}

const html = computed(() => {
  const withLabels = applyLabelTokens(props.markdown)
  const withConditionals = applyHelpConditionals(withLabels)
  return renderMarkdownToHtml(withConditionals)
})

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const link = target?.closest?.('a') as HTMLAnchorElement | null
  if (!link) return

  const href = link.getAttribute('href') || ''
  if (href.startsWith('/app/')) {
    event.preventDefault()
    router.push(href)
  }
}
</script>

<template>
  <div class="help-markdown" @click="handleClick">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-html="html" />
  </div>
</template>

<style scoped>
.help-markdown :deep(h1),
.help-markdown :deep(h2),
.help-markdown :deep(h3),
.help-markdown :deep(h4) {
  margin: 16px 0 8px;
  color: var(--text-primary);
}

.help-markdown :deep(p) {
  margin: 10px 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.help-markdown :deep(a) {
  color: var(--primary-color);
  text-decoration: underline;
}

.help-markdown :deep(code) {
  background: var(--background-color);
  border: 1px solid var(--border-color);
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 0.95em;
}

.help-markdown :deep(pre) {
  background: var(--background-color);
  border: 1px solid var(--border-color);
  padding: 12px;
  border-radius: 10px;
  overflow: auto;
}

.help-markdown :deep(ul),
.help-markdown :deep(ol) {
  margin: 10px 0 10px 18px;
  color: var(--text-secondary);
}

.help-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 14px;
}

.help-markdown :deep(th),
.help-markdown :deep(td) {
  border: 1px solid var(--border-color);
  padding: 8px;
  text-align: left;
  vertical-align: top;
}

.help-markdown :deep(th) {
  background: var(--background-color);
  color: var(--text-primary);
  font-weight: 600;
}
</style>
