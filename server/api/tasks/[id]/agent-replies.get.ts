import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, inArray, and } from 'drizzle-orm'

/**
 * Returns persisted agent runtime responses for a task.
 *
 * The opencode agent streams text events, producing many database rows for a
 * single response.  We collapse those into one representative entry per run.
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
    limit: 200,
  })

  // Boilerplate patterns that should NEVER appear in comments
  const skipPattern = /^(User:|Waiting for opencode|Process exited|Done|Step (started|completed)|Spawning opencode|Cloning|Cloned to|Switched to|Checked out|Including PR|Including user message|Pushed|No changes|Push failed|Exited with|Reading |Writing to |Editing |Running:|Searching:|Searching for|Listing |Notification:|Question:|Creating directory|Tool:|Agent completed your request|Agent .+ assigned (to|from)|Continuing on|Reset .* to origin state|Created fresh branch|Branch commits|Git status|HEAD:|Committed:|Auto-stash|Checkout failed|Clone failed|Branch setup failed|Summary:|Created PR:|Created MR:|PR created:|MR created:)/i

  const validLogs = logs.filter(log => {
    const msg: string = log.newValue?.message || ''
    const trimmed = msg.trim()
    if (!trimmed) return false

    // Explicit agent_reply: keep only meaningful responses
    if (log.action === 'agent_reply') {
      // Drop one-word boilerplate
      if (/^(Done\.?|Step completed|Step started|Process exited)$/i.test(trimmed)) return false
      // Drop git/PR system messages that leak into comments
      if (/^(Created PR:|Created MR:|PR created:|MR created:|Summary:|Pushed changes|No changes to push|Auto-create PR failed|Summary post failed|Push failed)/i.test(trimmed)) return false
      return true
    }

    // runtime_log: apply skip pattern
    return !skipPattern.test(trimmed)
  })

  // Separate actions
  const agentReplies = validLogs.filter(l => l.action === 'agent_reply')
  const runtimeLogs = validLogs.filter(l => l.action === 'runtime_log')

  // Drop runtime_logs already covered by an agent_reply
  const standaloneRuntimeLogs = runtimeLogs.filter(log => {
    const msg = (log.newValue?.message || '').trim()
    return !agentReplies.some(ar => (ar.newValue?.message || '').includes(msg))
  })

  // Group agent_reply entries by time proximity (same streaming session)
  const SESSION_GAP_MS = 60 * 1000
  const sortedReplies = [...agentReplies].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const sessions: typeof sortedReplies[] = []
  let currentSession: typeof sortedReplies = []

  for (const log of sortedReplies) {
    const logTime = new Date(log.createdAt).getTime()
    if (currentSession.length === 0) {
      currentSession.push(log)
    } else {
      const lastTime = new Date(currentSession[currentSession.length - 1].createdAt).getTime()
      if (logTime - lastTime <= SESSION_GAP_MS) {
        currentSession.push(log)
      } else {
        sessions.push(currentSession)
        currentSession = [log]
      }
    }
  }
  if (currentSession.length > 0) sessions.push(currentSession)

  // Keep only the LAST entry per session (complete final response)
  const representatives = sessions.map(session => session[session.length - 1])

  const allEntries = [...representatives, ...standaloneRuntimeLogs]
  allEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return allEntries.map(log => ({
    id: log.action === 'agent_reply' ? `agent-${log.id}` : `runtime-${log.id}`,
    body: (log.newValue as { message: string }).message,
    createdAt: log.createdAt,
    agentName: defaultAgentName,
    agentColor: defaultAgentColor,
  }))
})
