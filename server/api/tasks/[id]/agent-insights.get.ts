import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { getAgentInsightsForTask } from '~/server/utils/agent-task-insights'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  return getAgentInsightsForTask(id)
})
