import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = getDb()

  const agents = await db.query.agents.findMany({
    where: eq(schema.agents.userId, user.id),
    orderBy: (a, { asc }) => [asc(a.createdAt)],
  })

  return agents
})
