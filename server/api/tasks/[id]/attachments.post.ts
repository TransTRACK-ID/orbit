import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { readMultipartFormData } from 'h3'
import { registerTaskAttachmentFromBuffer } from '~/server/utils/task-attachment-files'

export default defineEventHandler(async (event) => {
  const { id: taskId } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
    columns: { id: true },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  const file = formData.find((f) => f.name === 'file')
  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  const attachment = await registerTaskAttachmentFromBuffer(db, taskId, {
    data: file.data,
    originalName: file.filename || 'untitled',
    mimeType: file.type || 'application/octet-stream',
  })

  return {
    id: attachment.id,
    taskId: attachment.taskId,
    filename: attachment.filename,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
  }
})
