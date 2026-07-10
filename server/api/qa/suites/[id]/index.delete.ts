import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const suite = await db.query.qaSuites.findFirst({
    where: eq(schema.qaSuites.id, id),
  })
  if (!suite) {
    throw createError({ statusCode: 404, statusMessage: 'Suite not found' })
  }

  await requireProjectAccess(event, suite.projectId)

  await db.delete(schema.qaSuites).where(eq(schema.qaSuites.id, id))
  return { success: true }
})
