import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const plan = await db.query.qaPlans.findFirst({
    where: eq(schema.qaPlans.id, id),
    with: {
      planCases: {
        orderBy: (pc, { asc }) => [asc(pc.sortOrder)],
        with: { case: true },
      },
    },
  })
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }

  await requireProjectAccess(event, plan.projectId)

  return {
    ...plan,
    cases: (plan.planCases || []).map((pc) => pc.case).filter(Boolean),
    _caseCount: plan.planCases?.length || 0,
  }
})
