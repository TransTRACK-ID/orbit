import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id } = getRouterParams(event)

  const db = getDb()

  // Verify user has access to this task
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, reporterId: true },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  const session = await db.query.browserSessions.findFirst({
    where: eq(schema.browserSessions.taskId, id),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  })

  return session || null
})
