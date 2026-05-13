import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { executeFixFeedback } from '~/server/utils/fix-feedback'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  const db = getDb()

  // Find the pull request for this task
  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.taskId, id),
    columns: { id: true },
  })

  if (!pr) {
    throw createError({ statusCode: 404, statusMessage: 'No pull request found for this task' })
  }

  const result = await executeFixFeedback(pr.id, user.id)
  return result
})
