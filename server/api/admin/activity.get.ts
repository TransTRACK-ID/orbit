import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { desc, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const limit = Number(getQuery(event).limit) || 50

  const activities = await db.query.activityFeed.findMany({
    orderBy: desc(schema.activityFeed.createdAt),
    limit,
    with: {
      user: true,
      workspace: true,
    },
  })

  return activities.map((a) => ({
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    entityName: a.entityName,
    message: a.message,
    user: a.user ? { id: (a.user as any).id, name: (a.user as any).name, email: (a.user as any).email } : null,
    workspace: a.workspace ? { id: (a.workspace as any).id, name: (a.workspace as any).name, slug: (a.workspace as any).slug } : null,
    createdAt: a.createdAt,
  }))
})
