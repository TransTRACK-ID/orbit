import { and, desc, eq, or } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'
import {
  buildAgentRunInsights,
  diagnosticFromActivityLog,
  type AgentDiagnosticEntry,
  type AgentRunInsights,
} from '~/utils/agent-diagnostics'
import { MAX_AGENT_LOOP_RESTARTS } from '~/utils/agent-loop-limit'

export type AgentTaskInsightsResult = {
  insights: AgentRunInsights | null
  runtimeLogs: Array<{ id: string; message: string; createdAt: string }>
  task: { id: string; title: string; statusName: string | null } | null
}

export async function getAgentInsightsForTask(taskId: string): Promise<AgentTaskInsightsResult> {
  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
    columns: { id: true, title: true, agentEnabled: true, assigneeType: true },
    with: { status: { columns: { name: true } } },
  })

  if (!task) {
    return { insights: null, runtimeLogs: [], task: null }
  }

  const taskMeta = {
    id: task.id,
    title: task.title,
    statusName: task.status?.name ?? null,
  }

  if (!task.agentEnabled && task.assigneeType !== 'agent') {
    return { insights: null, runtimeLogs: [], task: taskMeta }
  }

  const logs = await db.query.activityLogs.findMany({
    where: and(
      eq(schema.activityLogs.taskId, taskId),
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
      createdAt: log.createdAt.toISOString(),
    }))
    .reverse()

  return { insights, runtimeLogs, task: taskMeta }
}
