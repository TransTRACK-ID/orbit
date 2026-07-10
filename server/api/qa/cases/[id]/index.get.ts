import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const qaCase = await db.query.qaCases.findFirst({
    where: eq(schema.qaCases.id, id),
    with: { suite: true },
  })
  if (!qaCase) {
    throw createError({ statusCode: 404, statusMessage: 'Case not found' })
  }

  await requireProjectAccess(event, qaCase.projectId)
  return qaCase
})
