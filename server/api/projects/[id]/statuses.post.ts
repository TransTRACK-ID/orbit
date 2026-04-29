import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { createStatusSchema } from '~/server/utils/validation'
import { eq, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const body = await readValidatedBody(event, createStatusSchema.parse)
  const db = getDb()

  // Get next position
  const existingCount = await db
    .select({ count: count() })
    .from(schema.statuses)
    .where(eq(schema.statuses.projectId, id))

  const [status] = await db
    .insert(schema.statuses)
    .values({
      projectId: id,
      name: body.name,
      color: body.color || '#94a3b8',
      position: Number(existingCount[0]?.count || 0),
    })
    .returning()

  return status
})
