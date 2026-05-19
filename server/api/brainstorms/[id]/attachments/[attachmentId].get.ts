import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { existsSync, createReadStream } from 'fs'

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    default: return 'application/octet-stream'
  }
}

export default defineEventHandler(async (event) => {
  const { id: brainstormId, attachmentId } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const attachment = await db.query.brainstormAttachments.findFirst({
    where: eq(schema.brainstormAttachments.id, attachmentId),
  })

  if (!attachment || attachment.brainstormId !== brainstormId) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  if (!existsSync(attachment.path)) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment file missing' })
  }

  const mime = getMimeType(attachment.path)
  setHeader(event, 'Content-Type', mime)
  setHeader(event, 'Content-Disposition', `inline; filename="${attachment.originalName}"`)

  return sendStream(event, createReadStream(attachment.path))
})
