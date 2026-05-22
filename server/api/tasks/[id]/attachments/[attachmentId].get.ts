import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { createReadStream, existsSync } from 'fs'
import { extname } from 'path'

function getMimeType(path: string): string {
  const ext = extname(path).toLowerCase()
  switch (ext) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.html': return 'text/html'
    default: return 'application/octet-stream'
  }
}

export default defineEventHandler(async (event) => {
  const { id: taskId, attachmentId } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const attachment = await db.query.taskAttachments.findFirst({
    where: eq(schema.taskAttachments.id, attachmentId),
  })

  if (!attachment || attachment.taskId !== taskId) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  if (!existsSync(attachment.path)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found on disk' })
  }

  const mime = getMimeType(attachment.path)

  setHeader(event, 'Content-Type', mime)
  setHeader(event, 'Content-Disposition', `inline; filename="${attachment.originalName}"`)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return sendStream(event, createReadStream(attachment.path))
})
