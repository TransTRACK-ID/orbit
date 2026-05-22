import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, count } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { readMultipartFormData } from 'h3'
import path from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_ATTACHMENTS = 3
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'text/html']
const ATTACHMENTS_DIR = `${process.env.HOME || '/Users/zeinersyad'}/orbit-attachments`

export default defineEventHandler(async (event) => {
  const { id: taskId } = getRouterParams(event)
  const user = await requireAuth(event)
  const db = getDb()

  // Verify task exists
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
    columns: { id: true },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  // Check attachment limit
  const existingCount = await db
    .select({ count: count() })
    .from(schema.taskAttachments)
    .where(eq(schema.taskAttachments.taskId, taskId))

  const currentCount = Number(existingCount[0]?.count || 0)
  if (currentCount >= MAX_ATTACHMENTS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Attachment limit reached (max ${MAX_ATTACHMENTS})`,
    })
  }

  // Parse multipart form
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  const file = formData.find((f) => f.name === 'file')
  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  // Validate MIME type
  const mimeType = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Only PNG, JPEG, JPG images and HTML files are allowed.',
    })
  }

  // Validate file content using magic bytes (images only)
  const magic = file.data.slice(0, 4)
  const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47
  const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF
  const isHtml = mimeType === 'text/html'
  const isImage = isPng || isJpeg

  if (!isImage && !isHtml) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file content. Only PNG, JPEG images and HTML files are allowed.',
    })
  }

  // For HTML files, do a basic content sanity check
  if (isHtml) {
    const contentStart = file.data.slice(0, 256).toString('utf-8').trimStart().toLowerCase()
    const looksLikeHtml = contentStart.startsWith('<!doctype') || contentStart.startsWith('<html')
    if (!looksLikeHtml) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid HTML file. File must start with <!DOCTYPE or <html.',
      })
    }
  }

  // Validate file size
  if (file.data.length > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: `File too large (max ${MAX_FILE_SIZE / (1024 * 1024)} MB)`,
    })
  }

  // Determine file extension from actual content
  let ext: string
  if (isPng) {
    ext = 'png'
  } else if (isJpeg) {
    ext = 'jpg'
  } else {
    ext = 'html'
  }
  const filename = `${randomUUID()}.${ext}`
  const taskDir = path.join(ATTACHMENTS_DIR, taskId)
  const filePath = path.join(taskDir, filename)

  // Ensure directory exists
  mkdirSync(taskDir, { recursive: true })

  // Write file to disk
  writeFileSync(filePath, file.data)

  // Insert record into database
  const [attachment] = await db
    .insert(schema.taskAttachments)
    .values({
      taskId,
      filename,
      originalName: file.filename || 'untitled',
      mimeType,
      size: file.data.length,
      path: filePath,
    })
    .returning()

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
