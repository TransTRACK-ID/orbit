import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: brainstormId } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const prds = await db.query.prds.findMany({
    where: eq(schema.prds.brainstormId, brainstormId),
    with: { sections: true },
    orderBy: [desc(schema.prds.createdAt)],
  })

  return prds
})
