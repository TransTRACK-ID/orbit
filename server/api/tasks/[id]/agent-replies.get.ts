import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, inArray, and } from 'drizzle-orm'

/**
 * Returns persisted agent runtime responses for a task.
 *
 * Returns ALL agent_reply entries without session collapsing.
 * Filters runtime_log entries to avoid step-level noise in the conversation view
 * while keeping meaningful runtime output (e.g. commit messages, errors).
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
    : '#6366f1'

  const logs = await db.query.activityLogs.findMany({
    where: (al, { eq, and, inArray }) => and(
      eq(al.taskId, id),
      inArray(al.action, ['runtime_log', 'agent_reply']),
    ),
    orderBy: [desc(schema.activityLogs.createdAt)],
    limit: 500,
  })

  // Keep ALL agent_reply entries (conversational responses) — no compression
  const agentReplies = logs.filter(l => l.action === 'agent_reply')

  // For runtime_log, filter out step-level noise that would clutter the conversation view
  const skipPattern = /^(User:|Waiting for opencode|Process exited|Done|Step (started|completed)|Spawning opencode|Cloning|Cloned to|Switched to|Checked out|Including PR|Including user message|Pushed|No changes|Push failed|Exited with|Reading |Writing to |Editing |Running:|Searching:|Searching for|Listing |Notification:|Question:|Creating directory|Tool:|Agent completed your request|Agent .+ assigned (to|from)|Continuing on|Reset .* to origin state|Created fresh branch|Branch commits|Git status|HEAD:|Committed:|Auto-stash|Checkout failed|Clone failed|Branch setup failed|Created PR:|Created MR:|PR created:|MR created:|Exec:|CWD:)/i

  const runtimeLogs = logs.filter(l => {
    if (l.action !== 'runtime_log') return false
    const msg: string = l.newValue?.message || ''
    const trimmed = msg.trim()
    if (!trimmed) return false
    // Drop boilerplate step logs
    if (/^(Done\.?|Step completed|Step started|Process exited)$/i.test(trimmed)) return false
    return !skipPattern.test(trimmed)
  })

  // Merge and return ALL entries — no session collapsing, no representatives
  const allEntries = [...agentReplies, ...runtimeLogs]
  allEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return allEntries.map(log => ({
    id: log.action === 'agent_reply' ? `agent-${log.id}` : `runtime-${log.id}`,
    body: (log.newValue as { message: string }).message,
    createdAt: log.createdAt,
    agentName: defaultAgentName,
    agentColor: defaultAgentColor,
  }))
})