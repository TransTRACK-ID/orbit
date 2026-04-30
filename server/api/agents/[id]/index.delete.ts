import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  const existing = await db.query.agents.findFirst({
    where: eq(schema.agents.id, id),
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  }

  if (existing.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  await db.delete(schema.agents).where(eq(schema.agents.id, id))

  return { success: true }
})
