import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, count } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { readMultipartFormData } from 'h3'
import path from 'path'
import {
  BRAINSTORM_MAX_ATTACHMENTS,
  parseBrainstormAttachmentText,
  validateBrainstormFile,
} from '~/server/utils/brainstorm-attachments'
import { isDocumentKind } from '~/server/utils/document-parser'

const ATTACHMENTS_DIR = `${process.env.HOME || '/Users/zeinersyad'}/orbit-attachments/brainstorms`

export default defineEventHandler(async (event) => {
  const { id: brainstormId } = getRouterParams(event)
  await requireAuth(event)
  const db = getDb()

  const brainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, brainstormId),
    columns: { id: true },
  })

  if (!brainstorm) {
    throw createError({ statusCode: 404, statusMessage: 'Brainstorm not found' })
  }

  const existingCount = await db
    .select({ count: count() })
    .from(schema.brainstormAttachments)
    .where(eq(schema.brainstormAttachments.brainstormId, brainstormId))

  const currentCount = Number(existingCount[0]?.count || 0)
  if (currentCount >= BRAINSTORM_MAX_ATTACHMENTS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Attachment limit reached (max ${BRAINSTORM_MAX_ATTACHMENTS})`,
    })
  }

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  const file = formData.find((f) => f.name === 'file')
  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  const validated = validateBrainstormFile(
    file.data,
    file.type || 'application/octet-stream',
    file.filename || 'untitled',
  )

  let extractedText: string | null = null
  if (isDocumentKind(validated.kind)) {
    extractedText = await parseBrainstormAttachmentText(validated)
  }

  const filename = `${randomUUID()}.${validated.ext}`
  const bsDir = path.join(ATTACHMENTS_DIR, brainstormId)
  const filePath = path.join(bsDir, filename)

  mkdirSync(bsDir, { recursive: true })
  writeFileSync(filePath, validated.data)

  const [attachment] = await db
    .insert(schema.brainstormAttachments)
    .values({
      brainstormId,
      filename,
      originalName: validated.originalName,
      mimeType: validated.mimeType,
      size: validated.data.length,
      path: filePath,
      extractedText,
    })
    .returning()

  return {
    id: attachment.id,
    brainstormId: attachment.brainstormId,
    filename: attachment.filename,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    hasExtractedText: !!attachment.extractedText,
    createdAt: attachment.createdAt,
  }
})
