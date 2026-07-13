import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { formatQaPlan } from '~/server/utils/qa-plans'
import { replaceQaPlanCasesSchema } from '~/server/utils/validation'
import { eq, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const plan = await db.query.qaPlans.findFirst({
    where: eq(schema.qaPlans.id, id),
  })
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }

  await requireProjectAccess(event, plan.projectId)
  const body = await readValidatedBody(event, replaceQaPlanCasesSchema.parse)

  if (body.caseIds.length > 0) {
    const cases = await db.query.qaCases.findMany({
      where: inArray(schema.qaCases.id, body.caseIds),
    })
    if (cases.length !== body.caseIds.length || cases.some((c) => c.projectId !== plan.projectId)) {
      throw createError({ statusCode: 400, statusMessage: 'One or more cases are invalid for this project' })
    }
  }

  await db.delete(schema.qaPlanCases).where(eq(schema.qaPlanCases.planId, id))

  if (body.caseIds.length > 0) {
    await db.insert(schema.qaPlanCases).values(
      body.caseIds.map((caseId, idx) => ({
        planId: id,
        caseId,
        sortOrder: idx,
      })),
    )
  }

  await db
    .update(schema.qaPlans)
    .set({ updatedAt: new Date() })
    .where(eq(schema.qaPlans.id, id))

  const updated = await db.query.qaPlans.findFirst({
    where: eq(schema.qaPlans.id, id),
    with: {
      planCases: {
        orderBy: (pc, { asc }) => [asc(pc.sortOrder)],
        with: { case: true },
      },
    },
  })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }

  return formatQaPlan(updated)
})
