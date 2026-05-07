import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: workspaceId } = getRouterParams(event)
  const { user } = await requireWorkspaceAccess(event, workspaceId)
  const db = getDb()

  const limit = Math.min(Number(getQuery(event).limit) || 200, 500)

  const entries = await db.query.activityFeed.findMany({
    where: (af, { eq }) => eq(af.workspaceId, workspaceId),
    orderBy: [desc(schema.activityFeed.createdAt)],
    limit,
    with: {
      user: {
        columns: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  })

  return entries
})
