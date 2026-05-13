import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const messages = await db.query.brainstormMessages.findMany({
    where: eq(schema.brainstormMessages.brainstormId, id),
    orderBy: [asc(schema.brainstormMessages.createdAt)],
  })

  return messages
})
