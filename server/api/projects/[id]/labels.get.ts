import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const db = getDb()

  const labels = await db.query.labels.findMany({
    where: eq(schema.labels.projectId, id),
    orderBy: (l, { asc }) => [asc(l.name)],
  })

  return labels
})
