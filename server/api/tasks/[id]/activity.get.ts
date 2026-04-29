import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const logs = await db.query.activityLogs.findMany({
    where: eq(schema.activityLogs.taskId, id),
    with: {
      user: {
        columns: { id: true, email: true, name: true, avatarUrl: true },
      },
    },
    orderBy: [desc(schema.activityLogs.createdAt)],
  })

  return logs
})
