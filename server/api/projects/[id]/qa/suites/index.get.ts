import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  await requireProjectAccess(event, projectId)
  const db = getDb()

  const suites = await db.query.qaSuites.findMany({
    where: eq(schema.qaSuites.projectId, projectId),
    orderBy: [asc(schema.qaSuites.sortOrder), asc(schema.qaSuites.name)],
  })

  const cases = await db.query.qaCases.findMany({
    where: eq(schema.qaCases.projectId, projectId),
    columns: { id: true, suiteId: true },
  })

  const countBySuite = new Map<string, number>()
  for (const c of cases) {
    if (!c.suiteId) continue
    countBySuite.set(c.suiteId, (countBySuite.get(c.suiteId) || 0) + 1)
  }

  return suites.map((s) => ({
    ...s,
    _caseCount: countBySuite.get(s.id) || 0,
  }))
})
