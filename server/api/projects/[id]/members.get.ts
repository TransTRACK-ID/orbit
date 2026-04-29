import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const db = getDb()

  const members = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.projectId, id),
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
    orderBy: (pm, { asc }) => [asc(pm.joinedAt)],
  })

  return members
})
