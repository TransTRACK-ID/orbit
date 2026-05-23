import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { readMultipartFormData } from 'h3'
import path from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'text/html', 'text/markdown', 'text/plain']
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
  const originalName = file.filename || ''
  const isMdByExtension = originalName.toLowerCase().endsWith('.md')
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Only PNG, JPEG, JPG images, HTML files, and Markdown files are allowed.',
    })
  }
  // Only allow text/plain for .md files to avoid accepting arbitrary text files
  if (mimeType === 'text/plain' && !isMdByExtension) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Only PNG, JPEG, JPG images, HTML files, and Markdown files are allowed.',
    })
  }

  // Validate file content using magic bytes (images only)
  const magic = file.data.slice(0, 4)
  const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47
  const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF
  const isHtml = mimeType === 'text/html'
  const isMd = mimeType === 'text/markdown' || (mimeType === 'text/plain' && isMdByExtension)
  const isImage = isPng || isJpeg

  if (!isImage && !isHtml && !isMd) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file content. Only PNG, JPEG images, HTML files, and Markdown files are allowed.',
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

  // For Markdown files, do a basic content sanity check
  if (isMd) {
    const hasBinary = file.data.slice(0, 1024).includes(0)
    if (hasBinary) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Markdown file. File appears to contain binary data.',
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
  } else if (isHtml) {
    ext = 'html'
  } else if (isMd) {
    ext = 'md'
  } else {
    ext = 'txt'
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
