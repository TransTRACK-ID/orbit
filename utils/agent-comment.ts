const ORBIT_STATUS_RE = /\[ORBIT_STATUS:\s*[a-zA-Z_\- ]+\s*\]/gi

const REPORT_HEADING_RE = /^##\s+(Summary|Results|Findings|Steps|Evidence|Conclusion)\b/im

const SUMMARY_HEADING_RE = /^##\s+Summary\b/gim

const NARRATION_PATTERNS = [
  /^(I'll|I will|Let me|First,? I'll|Now I'll|I'm going to|I need to|I am going to)\b/i,
  /^(Okay|Ok|Sure|Alright)[,.]?\s+(I'll|let me|I will)\b/i,
  /^(Starting|Testing|Checking|Opening|Navigating|Using)\b/i,
]

export function stripOrbitStatusMarkers(text: string): string {
  return text.replace(ORBIT_STATUS_RE, '').trim()
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function isNarrationParagraph(paragraph: string): boolean {
  if (/^##\s+/.test(paragraph)) return false
  if (paragraph.includes('```')) return false
  return NARRATION_PATTERNS.some(re => re.test(paragraph))
}

/**
 * Cursor stream-json sometimes emits the same report twice (assistant stream + result).
 * Trim back-to-back duplicates and repeated ## Summary blocks.
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

/**
 * Reduce streamed agent output to the final report suitable for task comments.
 * Strips planning/narration and prefers structured markdown report sections.
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

/** Sanitize agent comment bodies for display and persistence. */
export function formatAgentCommentForDisplay(raw: string): string {
  return extractAgentCommentForPersistence(raw)
}
