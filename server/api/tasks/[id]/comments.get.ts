import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const comments = await db.query.comments.findMany({
    where: eq(schema.comments.taskId, id),
    with: {
      user: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
      },
    },
    orderBy: [asc(schema.comments.createdAt)],
  })

  return comments
})
