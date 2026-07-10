import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { and, asc, eq, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: projectId } = getRouterParams(event)
  await requireProjectAccess(event, projectId)
  const query = getQuery(event)
  const suiteId = query.suiteId as string | undefined
  const status = query.status as string | undefined
  const db = getDb()

  const conditions = [eq(schema.qaCases.projectId, projectId)]
  if (suiteId === 'none') {
    conditions.push(isNull(schema.qaCases.suiteId))
  } else if (suiteId) {
    conditions.push(eq(schema.qaCases.suiteId, suiteId))
  }
  if (status) {
    conditions.push(eq(schema.qaCases.status, status))
  }

  return db.query.qaCases.findMany({
    where: and(...conditions),
    orderBy: [asc(schema.qaCases.sortOrder), asc(schema.qaCases.title)],
    with: {
      suite: true,
    },
  })
})
