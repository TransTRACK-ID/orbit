import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const existing = await db.query.qaCases.findFirst({
    where: eq(schema.qaCases.id, id),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Case not found' })
  }

  await requireProjectAccess(event, existing.projectId)
  await db.delete(schema.qaCases).where(eq(schema.qaCases.id, id))
  return { success: true }
})
