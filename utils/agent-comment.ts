const ORBIT_STATUS_RE = /\[ORBIT_STATUS:\s*[a-zA-Z_\- ]+\s*\]/gi

const REPORT_HEADING_RE = /^##\s+(Summary|Results|Findings|Steps|Evidence|Conclusion)\b/im

const NARRATION_PATTERNS = [
  /^(I'll|I will|Let me|First,? I'll|Now I'll|I'm going to|I need to|I am going to)\b/i,
  /^(Okay|Ok|Sure|Alright)[,.]?\s+(I'll|let me|I will)\b/i,
  /^(Starting|Testing|Checking|Opening|Navigating|Using)\b/i,
]

export function stripOrbitStatusMarkers(text: string): string {
  return text.replace(ORBIT_STATUS_RE, '').trim()
}

function isNarrationParagraph(paragraph: string): boolean {
  if (/^##\s+/.test(paragraph)) return false
  if (paragraph.includes('```')) return false
  return NARRATION_PATTERNS.some(re => re.test(paragraph))
}

/**
 * Reduce streamed agent output to the final report suitable for task comments.
 * Strips planning/narration and prefers structured markdown report sections.
 */
export function extractAgentCommentForPersistence(raw: string): string {
  const text = stripOrbitStatusMarkers(raw).trim()
  if (!text) return ''

  const headingMatch = text.match(REPORT_HEADING_RE)
  if (headingMatch?.index !== undefined) {
    return text.slice(headingMatch.index).trim()
  }

  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  let startIdx = 0
  while (startIdx < paragraphs.length && isNarrationParagraph(paragraphs[startIdx]!)) {
    startIdx++
  }

  if (startIdx >= paragraphs.length) return ''

  return paragraphs.slice(startIdx).join('\n\n').trim()
}
