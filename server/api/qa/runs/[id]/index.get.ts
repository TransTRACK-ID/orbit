import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { getQaRunDetail } from '~/server/utils/qa-runs'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const run = await db.query.qaRuns.findFirst({
    where: eq(schema.qaRuns.id, id),
    columns: { projectId: true },
  })
  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'QA run not found' })
  }

  await requireProjectAccess(event, run.projectId)
  return getQaRunDetail(id)
})
