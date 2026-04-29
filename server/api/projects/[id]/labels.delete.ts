import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)

  const query = getQuery(event)
  const labelId = query.labelId as string

  if (!labelId) {
    throw createError({ statusCode: 400, statusMessage: 'labelId query param required' })
  }

  const db = getDb()

  await db.delete(schema.labels).where(eq(schema.labels.id, labelId))

  return { success: true }
})
