import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateStatusSchema } from '~/server/utils/validation'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)

  const body = await readValidatedBody(event, updateStatusSchema.parse)

  // Expect body to have statusId (the status being updated)
  const query = getQuery(event)
  const statusId = query.statusId as string

  if (!statusId) {
    throw createError({ statusCode: 400, statusMessage: 'statusId query param required' })
  }

  const db = getDb()

  const [updated] = await db
    .update(schema.statuses)
    .set(body)
    .where(eq(schema.statuses.id, statusId))
    .returning()

  return updated
})
