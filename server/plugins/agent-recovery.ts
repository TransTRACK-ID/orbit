import { getDb, schema } from '~/server/database'
import { eq, and, ilike, desc, gt, or } from 'drizzle-orm'
import { persistAgentDiagnostic } from '~/server/utils/agent-diagnostics'
import {
  isOrphanActivityValue,
  wasAgentActiveAroundServerBoot,
} from '~/server/utils/agent-orphan-recovery'

const ORPHAN_MESSAGE = 'Agent process was orphaned due to server restart while task was in progress'

export default defineNitroPlugin(async () => {
  const db = getDb()
  const serverBootAt = new Date(Date.now() - process.uptime() * 1000)

  const inProgressStatuses = await db.query.statuses.findMany({
    where: ilike(schema.statuses.name, '%progress%'),
  })

  if (inProgressStatuses.length === 0) return

  const statusIds = new Set(inProgressStatuses.map(s => s.id))

  const tasks = await db.query.tasks.findMany({
    where: eq(schema.tasks.agentEnabled, true),
    with: { status: true },
  })

  const orphanedTasks = tasks.filter(t => statusIds.has(t.statusId))

  for (const task of orphanedTasks) {
    const completedLog = await db.query.activityLogs.findFirst({
      where: and(
        eq(schema.activityLogs.taskId, task.id),
        eq(schema.activityLogs.action, 'agent_completed'),
      ),
      orderBy: [desc(schema.activityLogs.createdAt)],
    })

    if (completedLog) {
      const reviewStatus = await db.query.statuses.findFirst({
        where: and(
          eq(schema.statuses.projectId, task.projectId),
          ilike(schema.statuses.name, '%review%'),
        ),
      })

      if (reviewStatus && task.statusId !== reviewStatus.id) {
        await db.update(schema.tasks)
          .set({ statusId: reviewStatus.id })
          .where(eq(schema.tasks.id, task.id))

        console.log(`[agent-recovery] Task ${task.id} auto-advanced to review (agent_completed log found)`)
      }
      continue
    }

    const lastRuntimeLog = await db.query.activityLogs.findFirst({
      where: and(
        eq(schema.activityLogs.taskId, task.id),
        eq(schema.activityLogs.action, 'runtime_log'),
      ),
      orderBy: [desc(schema.activityLogs.createdAt)],
    })

    if (!lastRuntimeLog) continue

    const lastLogMs = lastRuntimeLog.createdAt.getTime()
    if (!wasAgentActiveAroundServerBoot(lastLogMs)) continue

    const existingOrphan = await db.query.activityLogs.findFirst({
      where: and(
        eq(schema.activityLogs.taskId, task.id),
        gt(schema.activityLogs.createdAt, serverBootAt),
        or(
          eq(schema.activityLogs.action, 'agent_crash'),
          eq(schema.activityLogs.action, 'agent_diagnostic'),
        ),
      ),
      orderBy: [desc(schema.activityLogs.createdAt)],
    })

    if (existingOrphan && isOrphanActivityValue(existingOrphan.newValue as Record<string, unknown>)) {
      continue
    }

    await persistAgentDiagnostic(db, task.id, task.reporterId, {
      code: 'agent_crashed',
      title: 'Interrupted by server restart',
      message: ORPHAN_MESSAGE,
      severity: 'warning',
      meta: {
        type: 'orphan',
        signal: 'server_restart',
        exitCode: null,
      },
    })

    console.log(`[agent-recovery] Task ${task.id} marked as orphaned (server restart)`)
  }
})
