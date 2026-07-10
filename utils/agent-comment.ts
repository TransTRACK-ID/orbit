const ORBIT_STATUS_RE = /\[ORBIT_STATUS:\s*[a-zA-Z_\- ]+\s*\]/gi

const SECTION_NAMES = ['Summary', 'Results', 'Findings', 'Steps', 'Evidence', 'Conclusion'] as const

const REPORT_HEADING_RE = new RegExp(
  `^(?:#{1,6}\\s+)?(?:\\*\\*)?(${SECTION_NAMES.join('|')})(?:\\*\\*)?\\b`,
  'im',
)

const SUMMARY_HEADING_RE = /^(?:#{1,6}\s+)?(?:\*\*)?Summary(?:\*\*)?\b/gim

const NARRATION_PATTERNS = [
  /^(I'll|I will|Let me|First,? I'll|Now I'll|I'm going to|I need to|I am going to)\b/i,
  /^(Okay|Ok|Sure|Alright)[,.]?\s+(I'll|let me|I will)\b/i,
  /^(Starting|Testing|Checking|Opening|Navigating|Using)\b/i,
]

const URL_RE = /https?:\/\/[^\s`<>)\]"']+/g
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

function trimUrlPunctuation(url: string): string {
  return url.replace(/[.,;:!?)]+$/g, '')
}

export function stripOrbitStatusMarkers(text: string): string {
  return text.replace(ORBIT_STATUS_RE, '').trim()
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function isNarrationParagraph(paragraph: string): boolean {
  if (/^#{1,6}\s+/.test(paragraph)) return false
  if (/^(?:\*\*)?(?:Summary|Results|Findings|Steps|Evidence|Conclusion)(?:\*\*)?\s*:?\s*$/i.test(paragraph)) return false
  if (paragraph.includes('```')) return false
  return NARRATION_PATTERNS.some(re => re.test(paragraph))
}

function sectionNamePattern(): string {
  return SECTION_NAMES.join('|')
}

/**
 * Cursor stream-json sometimes emits the same report twice (assistant stream + result).
 * Trim back-to-back duplicates and repeated Summary blocks.
 */
export function dedupeRepeatedReportSections(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const summaryMatches = [...trimmed.matchAll(SUMMARY_HEADING_RE)]
  if (summaryMatches.length >= 2 && summaryMatches[1].index !== undefined) {
    const first = trimmed.slice(summaryMatches[0].index!, summaryMatches[1].index!).trim()
    const second = trimmed.slice(summaryMatches[1].index!).trim()
    const nFirst = normalizeForCompare(first)
    const nSecond = normalizeForCompare(second)
    if (
      nFirst === nSecond
      || (nFirst.length > 80 && nSecond.startsWith(nFirst.slice(0, Math.min(120, nFirst.length))))
    ) {
      return first
    }
  }

  const normalized = normalizeForCompare(trimmed)
  const midpoint = Math.floor(normalized.length / 2)
  if (midpoint > 100 && normalized.slice(0, midpoint) === normalized.slice(midpoint)) {
    const rawMid = Math.floor(trimmed.length / 2)
    return trimmed.slice(0, rawMid).trim()
  }

  return trimmed
}

function wrapInlineCode(value: string, alreadyWrapped: Set<string>): string {
  const trimmed = value.trim()
  if (!trimmed || alreadyWrapped.has(trimmed)) return trimmed
  if (trimmed.startsWith('`') && trimmed.endsWith('`')) return trimmed
  alreadyWrapped.add(trimmed)
  return `\`${trimmed}\``
}

function inlineCodeUrlsAndEmails(text: string): string {
  const wrapped = new Set<string>()
  return text
    .replace(URL_RE, (url) => wrapInlineCode(trimUrlPunctuation(url), wrapped))
    .replace(EMAIL_RE, (email) => wrapInlineCode(email, wrapped))
}

function formatEvidenceLine(line: string): string {
  const trimmed = line.trim()
  if (!trimmed) return line

  const kv = trimmed.match(/^[-*+]?\s*(.+?):\s+(.+)$/)
  if (kv) {
    const label = kv[1].replace(/^\*\*|\*\*$/g, '').trim()
    const value = inlineCodeUrlsAndEmails(kv[2].trim())
    return `- **${label}:** ${value}`
  }

  if (/^[-*+]\s/.test(trimmed)) {
    return inlineCodeUrlsAndEmails(trimmed.replace(/^[-*+]\s*/, '- '))
  }

  return inlineCodeUrlsAndEmails(trimmed)
}

function wrapLooseJsonBlocks(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const block: string[] = [line]
      let depth = 0
      let started = false
      i++

      for (const ch of trimmed) {
        if (ch === '{' || ch === '[') depth++
        if (ch === '}' || ch === ']') depth--
        if (depth > 0) started = true
      }

      while (i < lines.length && (depth > 0 || !started || !/[}\]]$/.test(block[block.length - 1].trim()))) {
        const next = lines[i]
        block.push(next)
        for (const ch of next) {
          if (ch === '{' || ch === '[') { depth++; started = true }
          if (ch === '}' || ch === ']') depth--
        }
        i++
        if (block.length > 40) break
      }

      const joined = block.join('\n').trim()
      if (joined.length > 2) {
        out.push('```json', joined, '```')
        continue
      }
    }

    out.push(line)
    i++
  }

  return out.join('\n')
}

function stripTruncatedTail(text: string): string {
  const lines = text.split('\n')

  while (lines.length > 0) {
    const last = lines[lines.length - 1]?.trim() ?? ''
    if (!last) {
      lines.pop()
      continue
    }

    const looksTruncated = (
      /^\{[^}]*$/.test(last)
      || /^\[[^\]]*$/.test(last)
      || /^"[^"]*$/.test(last)
      || /:\s*"[^"]*$/.test(last)
      || last.endsWith('":')
      || last.endsWith(',')
    )

    if (looksTruncated) {
      lines.pop()
      continue
    }
    break
  }

  return lines.join('\n').trim()
}

/**
 * Normalize agent prose into predictable GitHub-flavored markdown so comments
 * render with headings, lists, and code blocks even when the model omits ##.
 */
export function structureAgentCommentMarkdown(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return ''

  text = text.replace(/^[\t ]*[•●▪◦]\s+/gm, '- ')

  const sections = sectionNamePattern()

  // "Summary: text on same line" → heading + paragraph
  text = text.replace(
    new RegExp(`^(${sections})\\s*:\\s*(.+)$`, 'gim'),
    '## $1\n\n$2',
  )

  // Plain or bold section labels on their own line
  text = text.replace(
    new RegExp(`^\\*\\*(${sections})\\*\\*\\s*:?\\s*$`, 'gim'),
    '## $1',
  )
  text = text.replace(
    new RegExp(`^(${sections})\\s*:?\\s*$`, 'gim'),
    '## $1',
  )

  // Single # or missing space after hashes
  text = text.replace(
    new RegExp(`^#\\s*(${sections})\\b`, 'gim'),
    '## $1',
  )

  // Ensure ## prefix on known section headings
  text = text.replace(
    new RegExp(`^#{1,6}\\s*(${sections})\\b`, 'gim'),
    '## $1',
  )

  const lines = text.split('\n')
  const structured: string[] = []
  let inEvidence = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+Evidence\b/i.test(trimmed)) inEvidence = true
    else if (/^##\s+/.test(trimmed)) inEvidence = false

    if (!trimmed) {
      structured.push('')
      continue
    }

    if (/^##\s+/.test(trimmed)) {
      structured.push(trimmed)
      continue
    }

    if (inEvidence) {
      structured.push(formatEvidenceLine(trimmed))
      continue
    }

    if (/^[-*+]\s/.test(trimmed)) {
      structured.push(formatEvidenceLine(trimmed))
      continue
    }

    structured.push(inlineCodeUrlsAndEmails(trimmed))
  }

  text = structured.join('\n')

  text = ensureBlankLinesBeforeBlocks(text)
  text = wrapLooseJsonBlocks(text)
  text = stripTruncatedTail(text)

  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function ensureBlankLinesBeforeBlocks(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    const prev = out[out.length - 1]?.trim() ?? ''
    const isHeading = /^##\s/.test(trimmed)
    const isList = /^[-*+]\s/.test(trimmed)
    const prevIsList = /^[-*+]\s/.test(prev)

    if (out.length > 0 && prev) {
      if (isHeading || (isList && !prevIsList)) {
        if (out[out.length - 1] !== '') out.push('')
      }
    }

    out.push(line)
  }

  return out.join('\n')
}

/**
 * Reduce streamed agent output to the final report suitable for task comments.
 */
export function extractAgentCommentForPersistence(raw: string): string {
  const text = stripOrbitStatusMarkers(raw).trim()
  if (!text) return ''

  const headingMatch = text.match(REPORT_HEADING_RE)
  const fromHeading = headingMatch?.index !== undefined
    ? text.slice(headingMatch.index).trim()
    : text

  const paragraphs = fromHeading.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  let startIdx = 0
  while (startIdx < paragraphs.length && isNarrationParagraph(paragraphs[startIdx]!)) {
    startIdx++
  }

  if (startIdx >= paragraphs.length) return ''

  const body = paragraphs.slice(startIdx).join('\n\n').trim()
  return dedupeRepeatedReportSections(body)
}

/** Sanitize and structure agent comment bodies for display and persistence. */
export function formatAgentCommentForDisplay(raw: string): string {
  const extracted = extractAgentCommentForPersistence(raw)
  if (!extracted) return ''
  return structureAgentCommentMarkdown(extracted)
}
