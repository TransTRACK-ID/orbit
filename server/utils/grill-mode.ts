import type { BrainstormMode, GrillStatus } from '~/types'

export const GRILL_TITLE_PREFIX = '[grill] '

export type { BrainstormMode }

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

export function getBrainstormModeFromTitle(title: string): BrainstormMode {
  return title.startsWith(GRILL_TITLE_PREFIX) ? 'grill' : 'chat'
}

export function resolveBrainstormMode(
  brainstorm: { title: string; mode?: string | null },
): BrainstormMode {
  if (brainstorm.mode === 'grill' || brainstorm.mode === 'chat') {
    return brainstorm.mode
  }
  return getBrainstormModeFromTitle(brainstorm.title)
}

/** @deprecated Use resolveBrainstormMode */
export function getBrainstormMode(title: string): BrainstormMode {
  return getBrainstormModeFromTitle(title)
}

export function enrichBrainstorm<T extends { title: string; mode?: string | null; grillStatus?: string | null; currentQuestionId?: string | null }>(
  brainstorm: T,
): T & { mode: BrainstormMode; displayTitle: string; grillStatus: GrillStatus | null; currentQuestionId: string | null } {
  const mode = resolveBrainstormMode(brainstorm)
  const grillStatus = (brainstorm.grillStatus as GrillStatus | null | undefined) ?? null
  return {
    ...brainstorm,
    mode,
    displayTitle: decodeBrainstormTitle(brainstorm.title),
    grillStatus: mode === 'grill' ? grillStatus : null,
    currentQuestionId: mode === 'grill' ? (brainstorm.currentQuestionId ?? null) : null,
  }
}
