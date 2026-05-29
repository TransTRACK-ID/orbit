import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const existing = await db.query.prds.findFirst({
    where: eq(schema.prds.id, id),
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'PRD not found' })
  }

  // Delete PRD (sections will cascade)
  await db.delete(schema.prds).where(eq(schema.prds.id, id))

  return { success: true }
})
