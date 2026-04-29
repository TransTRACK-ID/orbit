import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const db = getDb()

  const statuses = await db.query.statuses.findMany({
    where: eq(schema.statuses.projectId, id),
    orderBy: (s, { asc }) => [asc(s.position)],
  })

  return statuses
})
