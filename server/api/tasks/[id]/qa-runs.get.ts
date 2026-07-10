import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: taskId } = getRouterParams(event)
  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
    columns: { id: true, projectId: true },
  })
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  await requireProjectAccess(event, task.projectId)

  const runs = await db.query.qaRuns.findMany({
    where: eq(schema.qaRuns.taskId, taskId),
    orderBy: [desc(schema.qaRuns.createdAt)],
    with: {
      runCases: { columns: { id: true, status: true } },
      plan: true,
    },
  })

  return runs.map((run) => {
    const total = run.runCases?.length || 0
    const passed = run.runCases?.filter((c) => c.status === 'passed').length || 0
    const failed = run.runCases?.filter((c) => c.status === 'failed' || c.status === 'blocked').length || 0
    const { runCases: _rc, ...rest } = run
    return { ...rest, _totalCount: total, _passedCount: passed, _failedCount: failed }
  })
})
