/** Default max agent session length (non-QA tasks). */
export const DEFAULT_AGENT_MAX_RUNTIME_MS = 15 * 60 * 1000

/** QA runs with browser MCP often need longer sessions. */
export const QA_AGENT_MAX_RUNTIME_MS = 45 * 60 * 1000

/** Linux exit code when a process is terminated by SIGTERM. */
export const SIGTERM_EXIT_CODE = 128 + 15

export function formatAgentMaxRuntimeMinutes(ms: number): number {
  return Math.round(ms / 60_000)
}
