import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { existsSync, unlinkSync } from 'fs'

export default defineEventHandler(async (event) => {
  const { id: taskId, attachmentId } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  // Find attachment
  const attachment = await db.query.taskAttachments.findFirst({
    where: eq(schema.taskAttachments.id, attachmentId),
  })

  if (!attachment || attachment.taskId !== taskId) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  // Delete file from disk
  if (existsSync(attachment.path)) {
    try {
      unlinkSync(attachment.path)
    } catch {
      // Silently ignore disk deletion errors
    }
  }

  // Delete database record
  await db
    .delete(schema.taskAttachments)
    .where(eq(schema.taskAttachments.id, attachmentId))

  return { success: true }
})
