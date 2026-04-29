import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)

  const query = getQuery(event)
  const statusId = query.statusId as string

  if (!statusId) {
    throw createError({ statusCode: 400, statusMessage: 'statusId query param required' })
  }

  const db = getDb()

  const status = await db.query.statuses.findFirst({
    where: eq(schema.statuses.id, statusId),
  })

  if (!status) {
    throw createError({ statusCode: 404, statusMessage: 'Status not found' })
  }

  if (status.isDefault) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete a default status' })
  }

  await db.delete(schema.statuses).where(eq(schema.statuses.id, statusId))

  return { success: true }
})
