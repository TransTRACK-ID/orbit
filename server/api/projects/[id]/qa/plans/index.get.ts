import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { formatQaPlan } from '~/server/utils/qa-plans'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  await requireProjectAccess(event, projectId)
  const db = getDb()

  const plans = await db.query.qaPlans.findMany({
    where: eq(schema.qaPlans.projectId, projectId),
    orderBy: [asc(schema.qaPlans.name)],
    with: {
      planCases: {
        orderBy: (pc, { asc: a }) => [a(pc.sortOrder)],
        with: { case: true },
      },
    },
  })

  return plans.map((plan) => formatQaPlan(plan))
})
