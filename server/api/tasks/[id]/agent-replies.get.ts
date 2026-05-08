import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, inArray, and } from 'drizzle-orm'

/**
 * Returns persisted agent runtime responses for a task. These are activity
 * logs with action = 'runtime_log' or 'agent_reply' that were saved by the opencode runtime
 * during execution. Each entry contains the agent's message, timestamp, and
 * the user who triggered the run.
 *
 * Non-actionable messages (heartbeats, user echoes, boilerplate) are excluded
 * so only meaningful agent activity is returned.
 */
export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const logs = await db.query.activityLogs.findMany({
    where: (al, { eq, and, inArray }) => and(
      eq(al.taskId, id),
      inArray(al.action, ['runtime_log', 'agent_reply']),
    ),
    with: {
      user: {
        columns: { id: true, name: true },
      },
    },
    orderBy: [desc(schema.activityLogs.createdAt)],
    limit: 50,
  })

  // Filter out internal tool-call logs and boilerplate messages for runtime_log.
  // Only keep actual OpenCode response text (the agent's thinking / answers).
  const skipPattern = /^(User:|Waiting for opencode|Process exited|Done|Step (started|completed)|Spawning opencode|Cloning|Cloned to|Switched to|Checked out|Including PR|Including user message|Pushed|No changes|Push failed|Exited with|Reading |Writing to |Editing |Running:|Searching:|Searching for|Listing |Notification:|Question:|Creating directory|Tool:|Agent completed your request)/i

  const validLogs = logs.filter(log => {
    const msg: string = log.newValue?.message || ''
    const trimmed = msg.trim()
    if (!trimmed) return false
    
    // If it's an explicit agent_reply, keep it completely unfiltered EXCEPT if it's literally just 'Done'
    if (log.action === 'agent_reply') {
      if (/^(Done\.?|Step completed|Step started|Process exited)$/i.test(trimmed)) return false
      return true
    }
    
    // Otherwise apply the skip pattern for generic runtime_logs
    return !skipPattern.test(trimmed)
  })

  // Deduplicate runtime_logs that are truncated versions of agent_replies
  const deduplicatedLogs = validLogs.filter(log => {
    if (log.action === 'runtime_log') {
      const msg = (log.newValue?.message || '').trim()
      // If there is any agent_reply that contains this message, drop the runtime_log
      return !validLogs.some(other => 
        other.action === 'agent_reply' && 
        (other.newValue?.message || '').includes(msg)
      )
    }
    return true
  })

  return deduplicatedLogs.map(log => ({
    id: `agent-${log.id}`,
    body: (log.newValue as { message: string }).message,
    createdAt: log.createdAt,
    agentName: log.user?.name || 'Agent',
  }))
})
