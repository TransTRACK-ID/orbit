import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: taskId } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const attachments = await db.query.taskAttachments.findMany({
    where: eq(schema.taskAttachments.taskId, taskId),
    orderBy: [asc(schema.taskAttachments.createdAt)],
  })

  return attachments.map((a) => ({
    id: a.id,
    taskId: a.taskId,
    filename: a.filename,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt,
  }))
})
