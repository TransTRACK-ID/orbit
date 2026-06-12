/**
 * crash-notify.ts
 * Fires a JSON POST webhook when an agent process crashes or exits with an error.
 * Set CRASH_WEBHOOK_URL in your environment to enable notifications (opt-in).
 */

export interface CrashPayload {
  taskId: string
  taskTitle: string
  /** null when the process was killed by a signal (OOM, SIGKILL, etc.) */
  exitCode: number | null
  /** e.g. "SIGKILL", "SIGTERM", or null when exited normally/abnormally */
  signal: string | null
  /** 'crash' = killed by signal / null exit code; 'error' = non-zero exit code; 'orphan' = lost due to server restart; 'timeout' = exceeded runtime limit */
  type: 'crash' | 'error' | 'spawn_error' | 'orphan' | 'timeout'
  message: string
}

export async function fireCrashWebhook(payload: CrashPayload): Promise<void> {
  const url = process.env.CRASH_WEBHOOK_URL
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'agent_crash',
        ...payload,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Fire-and-forget — never let a webhook failure affect the main flow
  }
}
