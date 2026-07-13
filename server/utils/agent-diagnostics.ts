import { getDb, schema } from '~/server/database'
import type { AgentDiagnosticSeverity } from '~/utils/agent-diagnostics'

type Db = ReturnType<typeof getDb>

export async function persistAgentDiagnostic(
  db: Db,
  taskId: string,
  userId: string,
  diag: {
    code: string
    title: string
    message: string
    severity: AgentDiagnosticSeverity
    meta?: Record<string, unknown>
  },
) {
  try {
    await db.insert(schema.activityLogs).values({
      taskId,
      userId,
      action: 'agent_diagnostic',
      newValue: {
        code: diag.code,
        title: diag.title,
        message: diag.message,
        severity: diag.severity,
        meta: diag.meta ?? null,
      },
    })
  } catch (err: any) {
    console.error('[agent-diagnostics] Failed to persist:', err?.message || err)
  }
}
