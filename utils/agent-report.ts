import {
  dedupeRepeatedReportSections,
  stripOrbitStatusMarkers,
} from '~/utils/agent-comment'

const SECTION_NAMES = ['Summary', 'Results', 'Findings', 'Steps', 'Evidence', 'Conclusion'] as const
export type AgentReportSectionName = typeof SECTION_NAMES[number]

export interface AgentReportListItem {
  label?: string
  value: string
}

export interface AgentReportSection {
  title: AgentReportSectionName | string
  paragraphs: string[]
  items: AgentReportListItem[]
  code?: string
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g

const NARRATION_PATTERNS = [
  /^(I'll|I will|Let me|First,? I'll|Now I'll|I'm going to|I need to|I am going to)\b/i,
  /^(Okay|Ok|Sure|Alright)[,.]?\s+(I'll|let me|I will)\b/i,
]

function sectionPattern(): string {
  return SECTION_NAMES.join('|')
}

function trimUrlPunctuation(url: string): string {
  return url.replace(/[.,;:!?)]+$/g, '')
}

/** Strip broken inline-code backticks agents emit (` SA `` email `` `). */
export function stripBrokenBackticks(text: string): string {
  return text
    .replace(/`{2,}/g, '')
    .replace(/`/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function cleanRawText(raw: string): string {
  let text = stripOrbitStatusMarkers(raw).replace(/\r\n/g, '\n').trim()
  if (!text) return ''

  text = dedupeRepeatedReportSections(text)
  text = stripBrokenBackticks(text)
  text = text.replace(/^[\t ]*[•●▪◦]\s+/gm, '- ')

  // Insert breaks before section labels when they appear inline in prose.
  text = text.replace(
    new RegExp(`(?<!^)(?<!\\n)\\s+(${sectionPattern()})\\s*:?\\s+`, 'gi'),
    '\n\n$1\n\n',
  )

  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function isNarrationLine(line: string): boolean {
  return NARRATION_PATTERNS.some(re => re.test(line.trim()))
}

function parseListItem(line: string): AgentReportListItem {
  const trimmed = line.replace(/^[-*+]\s+/, '').trim()
  const kv = trimmed.match(/^([^:]+):\s*(.+)$/)
  if (kv) {
    return {
      label: kv[1].replace(/\*\*/g, '').trim(),
      value: kv[2].trim(),
    }
  }
  return { value: trimmed }
}

function splitSentencesToItems(text: string): AgentReportListItem[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 8)
    .map(s => ({ value: s }))
}

function parseSectionBody(body: string, title: string): Omit<AgentReportSection, 'title'> {
  const paragraphs: string[] = []
  const items: AgentReportListItem[] = []
  let code: string | undefined

  const lines = body.split('\n').map(l => l.trim()).filter(Boolean)
  const isListSection = /^(Results|Findings|Steps|Evidence)$/i.test(title)

  for (const line of lines) {
    if (/^[-*+]\s/.test(line) || (isListSection && /^[^:]+:\s+.+$/.test(line))) {
      items.push(parseListItem(line))
      continue
    }

    if ((line.startsWith('{') || line.startsWith('[')) && line.length > 2) {
      code = (code ? `${code}\n` : '') + line
      continue
    }

    if (!isNarrationLine(line)) {
      paragraphs.push(line)
    }
  }

  if (isListSection && items.length === 0 && paragraphs.length === 1) {
    const sentenceItems = splitSentencesToItems(paragraphs[0]!)
    if (sentenceItems.length >= 2) {
      return { paragraphs: [], items: sentenceItems, code }
    }
  }

  return { paragraphs, items, code }
}

export function parseAgentReportSections(raw: string): AgentReportSection[] {
  const text = cleanRawText(raw)
  if (!text) return []

  const sectionRe = new RegExp(
    `(?:^|\\n)\\s*(?:#{1,6}\\s+)?(${sectionPattern()})\\s*:?\\s*(?=\\n|$)`,
    'gi',
  )

  const matches = [...text.matchAll(sectionRe)]
  if (matches.length === 0) {
    const body = parseSectionBody(text, 'Report')
    if (!body.paragraphs.length && !body.items.length && !body.code) return []
    return [{ title: 'Report', ...body }]
  }

  const sections: AgentReportSection[] = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!
    const title = match[1] as AgentReportSectionName
    const start = match.index! + match[0].length
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : text.length
    const body = text.slice(start, end).trim()
    const parsed = parseSectionBody(body, title)

    if (parsed.paragraphs.length || parsed.items.length || parsed.code) {
      sections.push({ title, ...parsed })
    }
  }

  return sections
}

export function hasAgentReportStructure(raw: string): boolean {
  const text = cleanRawText(raw)
  if (!text) return false
  return new RegExp(`(?:^|\\n)\\s*(?:#{1,6}\\s+)?(${sectionPattern()})\\b`, 'i').test(text)
}

export function serializeAgentReportSections(sections: AgentReportSection[]): string {
  const chunks: string[] = []

  for (const section of sections) {
    chunks.push(`## ${section.title}`)

    for (const paragraph of section.paragraphs) {
      chunks.push(paragraph)
    }

    for (const item of section.items) {
      if (item.label) chunks.push(`- **${item.label}:** ${item.value}`)
      else chunks.push(`- ${item.value}`)
    }

    if (section.code) {
      chunks.push('```json', section.code, '```')
    }
  }

  return chunks.join('\n\n').trim()
}

export function formatAgentReportForDisplay(raw: string): string {
  const sections = parseAgentReportSections(raw)
  if (sections.length === 0) return stripBrokenBackticks(stripOrbitStatusMarkers(raw))
  return serializeAgentReportSections(sections)
}

export function linkifyAgentText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return escaped.replace(URL_RE, (url) => {
    const href = trimUrlPunctuation(url)
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`
  })
}
