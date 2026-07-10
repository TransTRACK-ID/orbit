import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { updateQaPlanSchema } from '~/server/utils/validation'
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
  const body = await readValidatedBody(event, updateQaPlanSchema.parse)

  const [updated] = await db
    .update(schema.qaPlans)
    .set(body)
    .where(eq(schema.qaPlans.id, id))
    .returning()

  return updated
})
