import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  const members = await db.query.workspaceMembers.findMany({
    where: eq(schema.workspaceMembers.workspaceId, id),
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: (wm, { asc }) => [asc(wm.joinedAt)],
  })

  return members
})
