/** Max gap between last runtime log and server boot to treat as mid-run orphan. */
export const ORPHAN_LAST_LOG_BEFORE_BOOT_MS = 10 * 60 * 1000

/**
 * True when the last agent runtime log is close enough to this process boot
 * that the agent was likely still running when the previous server instance died.
 */
export function wasAgentActiveAroundServerBoot(
  lastRuntimeLogMs: number,
  nowMs = Date.now(),
  uptimeSeconds = process.uptime(),
): boolean {
  if (!Number.isFinite(lastRuntimeLogMs) || lastRuntimeLogMs <= 0) return false

  const serverBootMs = nowMs - uptimeSeconds * 1000
  const msBeforeBoot = serverBootMs - lastRuntimeLogMs

  return msBeforeBoot >= 0 && msBeforeBoot < ORPHAN_LAST_LOG_BEFORE_BOOT_MS
}

export function isOrphanActivityValue(newValue: Record<string, unknown> | null | undefined): boolean {
  if (!newValue) return false
  const type = newValue.type ?? (newValue.meta as Record<string, unknown> | undefined)?.type
  const signal = newValue.signal ?? (newValue.meta as Record<string, unknown> | undefined)?.signal
  return type === 'orphan' || signal === 'server_restart'
}
