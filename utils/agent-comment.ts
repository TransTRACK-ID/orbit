const ORBIT_STATUS_RE = /\[ORBIT_STATUS:\s*[a-zA-Z_\- ]+\s*\]/gi

const SECTION_NAMES = ['Summary', 'Results', 'Findings', 'Steps', 'Evidence', 'Conclusion']

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

/**
 * Cursor stream-json sometimes emits the same report twice (assistant stream + result).
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
    return trimmed.slice(0, Math.floor(trimmed.length / 2)).trim()
  }

  return trimmed
}

/** Strip narration and duplicate blocks from raw agent stream output. */
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

  return dedupeRepeatedReportSections(paragraphs.slice(startIdx).join('\n\n').trim())
}
