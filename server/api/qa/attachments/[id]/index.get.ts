import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { resolveQaAttachmentFile } from '~/server/utils/qa-results'
import { eq } from 'drizzle-orm'
import { createReadStream } from 'fs'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const db = getDb()

  const attachment = await db.query.qaRunAttachments.findFirst({
    where: eq(schema.qaRunAttachments.id, id),
    with: {
      runCase: {
        with: { run: true },
      },
    },
  })

  if (!attachment || !attachment.runCase?.run) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  await requireProjectAccess(event, attachment.runCase.run.projectId)

  const resolved = await resolveQaAttachmentFile(attachment)
  if (!resolved) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment file missing' })
  }

  setHeader(event, 'Content-Type', resolved.mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${attachment.originalName}"`)
  setHeader(event, 'Cache-Control', 'private, max-age=86400')

  return sendStream(event, createReadStream(resolved.path))
})
