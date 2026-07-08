import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id: brainstormId } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const attachments = await db.query.brainstormAttachments.findMany({
    where: eq(schema.brainstormAttachments.brainstormId, brainstormId),
    orderBy: [asc(schema.brainstormAttachments.createdAt)],
  })

  return attachments.map((a) => ({
    id: a.id,
    brainstormId: a.brainstormId,
    filename: a.filename,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    hasExtractedText: !!a.extractedText,
    createdAt: a.createdAt,
  }))
})
