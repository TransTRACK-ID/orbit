import { getDb, schema } from '~/server/database'
import { eq, and, ilike, desc, gt } from 'drizzle-orm'
import { fireCrashWebhook } from '~/server/utils/crash-notify'

export default defineNitroPlugin(async () => {
  const db = getDb()

  // Find all "in-progress" statuses across projects
  const inProgressStatuses = await db.query.statuses.findMany({
    where: ilike(schema.statuses.name, '%progress%'),
  })

  if (inProgressStatuses.length === 0) return

  const statusIds = inProgressStatuses.map(s => s.id)

  // Find agent-enabled tasks that are currently in-progress
  const tasks = await db.query.tasks.findMany({
    where: eq(schema.tasks.agentEnabled, true),
    with: { status: true },
  })

  const orphanedTasks = tasks.filter(t => statusIds.includes(t.statusId))

  for (const task of orphanedTasks) {
    // Check if the task has an agent_completed log
    const completedLog = await db.query.activityLogs.findFirst({
      where: and(
        eq(schema.activityLogs.taskId, task.id),
        eq(schema.activityLogs.action, 'agent_completed'),
      ),
      orderBy: [desc(schema.activityLogs.createdAt)],
    })

    if (completedLog) {
      // Work is complete but status is wrong — transition to review
      const reviewStatus = await db.query.statuses.findFirst({
        where: and(
          eq(schema.statuses.projectId, task.projectId),
          ilike(schema.statuses.name, '%review%'),
        ),
      })

      if (reviewStatus && task.statusId !== reviewStatus.id) {
        const oldStatusName = task.status?.name
        await db.update(schema.tasks)
          .set({ statusId: reviewStatus.id })
          .where(eq(schema.tasks.id, task.id))

        await db.insert(schema.activityLogs).values({
          taskId: task.id,
          userId: task.reporterId,
          action: 'status_change',
          oldValue: { statusId: task.statusId, statusName: oldStatusName },
          newValue: { statusId: reviewStatus.id, statusName: reviewStatus.name },
        })

        console.log(`[agent-recovery] Task ${task.id} auto-advanced to review (agent_completed log found)`)
      }
      continue
    }

    // Check for recent runtime activity without completion (orphaned process)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const mostRecentLog = await db.query.activityLogs.findFirst({
      where: and(
        eq(schema.activityLogs.taskId, task.id),
        gt(schema.activityLogs.createdAt, thirtyMinutesAgo),
      ),
      orderBy: [desc(schema.activityLogs.createdAt)],
    })

    if (mostRecentLog?.action === 'runtime_log') {
      // Process was likely running and got orphaned by server restart
      await db.insert(schema.activityLogs).values({
        taskId: task.id,
        userId: task.reporterId,
        action: 'agent_crash',
        newValue: {
          exitCode: null,
          signal: 'server_restart',
          type: 'orphan',
          message: 'Agent process was orphaned due to server restart while task was in progress',
        },
      })

      await fireCrashWebhook({
        taskId: task.id,
        taskTitle: task.title,
        exitCode: null,
        signal: 'server_restart',
        type: 'orphan',
        message: 'Agent process was orphaned due to server restart while task was in progress',
      })

      console.log(`[agent-recovery] Task ${task.id} marked as orphaned crash (server restart)`)
    }
  }
})
