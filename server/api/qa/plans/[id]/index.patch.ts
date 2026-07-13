import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { formatQaPlan } from '~/server/utils/qa-plans'
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

  if (Object.keys(body).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  await db
    .update(schema.qaPlans)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(schema.qaPlans.id, id))

  const refreshed = await db.query.qaPlans.findFirst({
    where: eq(schema.qaPlans.id, id),
    with: {
      planCases: {
        orderBy: (pc, { asc }) => [asc(pc.sortOrder)],
        with: { case: true },
      },
    },
  })

  if (!refreshed) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }

  return formatQaPlan(refreshed)
})
