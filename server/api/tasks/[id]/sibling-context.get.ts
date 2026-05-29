import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, and, or, gte, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const { id: taskId } = getRouterParams(event)
  const db = getDb()

  // Fetch the current task to get project and agent context
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
    columns: { projectId: true, agentAssigneeId: true },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  // Only include running or recently completed (last 24h)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Query sibling contexts: same agent OR same project, excluding this task
  const agentOrProjectCondition = task.agentAssigneeId
    ? or(
        eq(schema.agentTaskContext.agentId, task.agentAssigneeId),
        eq(schema.agentTaskContext.projectId, task.projectId),
      )
    : eq(schema.agentTaskContext.projectId, task.projectId)

  const rows = await db.query.agentTaskContext.findMany({
    where: and(
      sql`${schema.agentTaskContext.taskId} != ${taskId}::uuid`,
      agentOrProjectCondition,
      or(
        eq(schema.agentTaskContext.status, 'running'),
        gte(schema.agentTaskContext.updatedAt, since24h),
      ),
    ),
    with: {
      task: { columns: { title: true } },
      agent: { columns: { name: true } },
    },
    orderBy: (ctx, { desc }) => [desc(ctx.updatedAt)],
    limit: 10,
  })

  return rows.map((row) => {
    const taskData = row.task as { title: string } | null
    const agentData = row.agent as { name: string } | null
    return {
      taskId: row.taskId,
      taskTitle: taskData?.title ?? '(unknown)',
      agentName: agentData?.name ?? '(unknown)',
      status: row.status,
      branchName: row.branchName,
      filesChanged: (row.filesChanged as string[]) ?? [],
      summary: row.summary,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      updatedAt: row.updatedAt,
    }
  })
})
