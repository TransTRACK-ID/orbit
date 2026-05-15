import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, and } from 'drizzle-orm'

/**
 * Returns persisted agent runtime responses for a task.
 *
 * Returns ONLY agent_reply entries. Runtime logs are intentionally excluded
 * from the conversation view — they belong in the live runtime stream panel.
 */
export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { agentAssigneeId: true, assigneeType: true },
    with: {
      agentAssignee: {
        columns: { id: true, name: true, color: true },
      },
    },
  })
  const defaultAgentName = task?.assigneeType === 'agent' && task?.agentAssignee
    ? task.agentAssignee.name
    : 'Agent'
  const defaultAgentColor = task?.assigneeType === 'agent' && task?.agentAssignee
    ? task.agentAssignee.color
    : '#E84D6A'

  const logs = await db.query.activityLogs.findMany({
    where: (al, { eq, and }) => and(
      eq(al.taskId, id),
      eq(al.action, 'agent_reply'),
    ),
    orderBy: [desc(schema.activityLogs.createdAt)],
    limit: 500,
  })

  // Only return agent_reply entries — runtime logs belong in the live stream panel only
  const allEntries = [...logs]
  allEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return allEntries.map(log => ({
    id: `agent-${log.id}`,
    body: (log.newValue as { message: string }).message,
    createdAt: log.createdAt,
    agentName: defaultAgentName,
    agentColor: defaultAgentColor,
  }))
})