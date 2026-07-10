import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const existing = await db.query.qaPlans.findFirst({
    where: eq(schema.qaPlans.id, id),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }

  await requireProjectAccess(event, existing.projectId)
  await db.delete(schema.qaPlans).where(eq(schema.qaPlans.id, id))
  return { success: true }
})
