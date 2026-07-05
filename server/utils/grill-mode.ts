export const GRILL_TITLE_PREFIX = '[grill] '

export type BrainstormMode = 'chat' | 'grill'

export function encodeGrillTitle(title: string): string {
  const trimmed = title.trim()
  if (trimmed.startsWith(GRILL_TITLE_PREFIX)) return trimmed
  return `${GRILL_TITLE_PREFIX}${trimmed}`
}

export function decodeBrainstormTitle(title: string): string {
  if (title.startsWith(GRILL_TITLE_PREFIX)) {
    return title.slice(GRILL_TITLE_PREFIX.length)
  }
  return title
}

export function getBrainstormMode(title: string): BrainstormMode {
  return title.startsWith(GRILL_TITLE_PREFIX) ? 'grill' : 'chat'
}

export function enrichBrainstorm<T extends { title: string }>(
  brainstorm: T,
): T & { mode: BrainstormMode; displayTitle: string } {
  return {
    ...brainstorm,
    mode: getBrainstormMode(brainstorm.title),
    displayTitle: decodeBrainstormTitle(brainstorm.title),
  }
}
