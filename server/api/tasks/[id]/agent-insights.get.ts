import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, or, and } from 'drizzle-orm'
import { buildAgentRunInsights, diagnosticFromActivityLog, type AgentDiagnosticEntry } from '~/utils/agent-diagnostics'
import { MAX_AGENT_LOOP_RESTARTS } from '~/utils/agent-loop-limit'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, agentEnabled: true, assigneeType: true },
    with: { status: { columns: { name: true } } },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  if (!task.agentEnabled && task.assigneeType !== 'agent') {
    return { insights: null, runtimeLogs: [] }
  }

  const logs = await db.query.activityLogs.findMany({
    where: and(
      eq(schema.activityLogs.taskId, id),
      or(
        eq(schema.activityLogs.action, 'agent_diagnostic'),
        eq(schema.activityLogs.action, 'agent_crash'),
        eq(schema.activityLogs.action, 'agent_timeout'),
        eq(schema.activityLogs.action, 'agent_error'),
        eq(schema.activityLogs.action, 'status_change'),
        eq(schema.activityLogs.action, 'runtime_log'),
      ),
    ),
    columns: { id: true, action: true, oldValue: true, newValue: true, createdAt: true },
    orderBy: [desc(schema.activityLogs.createdAt)],
    limit: 120,
  })

  const diagnostics: AgentDiagnosticEntry[] = []
  for (const log of logs) {
    const entry = diagnosticFromActivityLog({
      id: log.id,
      action: log.action,
      oldValue: log.oldValue as Record<string, unknown> | null,
      newValue: log.newValue as Record<string, unknown> | null,
      createdAt: log.createdAt,
    })
    if (entry) diagnostics.push(entry)
  }

  const insights = buildAgentRunInsights({
    diagnostics,
    taskStatusName: task.status?.name,
    maxLoopRestarts: MAX_AGENT_LOOP_RESTARTS,
  })

  const runtimeLogs = logs
    .filter(log => log.action === 'runtime_log' && log.newValue?.message)
    .slice(0, 80)
    .map(log => ({
      id: log.id,
      message: String(log.newValue?.message || ''),
      createdAt: log.createdAt,
    }))
    .reverse()

  return { insights, runtimeLogs }
})
