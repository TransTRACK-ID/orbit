import { randomUUID } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import type { getDb } from '~/server/database'
import { schema } from '~/server/database'

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024 // 10 MB
export const ATTACHMENTS_DIR = process.env.ORBIT_ATTACHMENTS_DIR
  || `${process.env.HOME || '/Users/zeinersyad'}/orbit-attachments`

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export type RegisteredTaskAttachment = {
  id: string
  taskId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  createdAt: Date
}

function detectImageType(data: Buffer): { mimeType: string; ext: string } | null {
  const magic = data.slice(0, 4)
  const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47
  if (isPng) return { mimeType: 'image/png', ext: 'png' }

  const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF
  if (isJpeg) return { mimeType: 'image/jpeg', ext: 'jpg' }

  const isWebp = data.slice(0, 4).toString('ascii') === 'RIFF'
    && data.slice(8, 12).toString('ascii') === 'WEBP'
  if (isWebp) return { mimeType: 'image/webp', ext: 'webp' }

  return null
}

function mimeFromExtension(ext: string): string | null {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    default: return null
  }
}

export function validateUploadBuffer(data: Buffer, mimeType: string, originalName: string): {
  ext: string
  mimeType: string
  isImage: boolean
  isHtml: boolean
  isMd: boolean
} {
  const isMdByExtension = originalName.toLowerCase().endsWith('.md')
  const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'text/html', 'text/markdown', 'text/plain']
  if (!allowedMime.includes(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Only PNG, JPEG, JPG images, HTML files, and Markdown files are allowed.',
    })
  }
  if (mimeType === 'text/plain' && !isMdByExtension) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Only PNG, JPEG, JPG images, HTML files, and Markdown files are allowed.',
    })
  }

  const magic = data.slice(0, 4)
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

  if (isHtml) {
    const contentStart = data.slice(0, 256).toString('utf-8').trimStart().toLowerCase()
    const looksLikeHtml = contentStart.startsWith('<!doctype') || contentStart.startsWith('<html')
    if (!looksLikeHtml) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid HTML file. File must start with <!DOCTYPE or <html.',
      })
    }
  }

  if (isMd) {
    const hasBinary = data.slice(0, 1024).includes(0)
    if (hasBinary) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Markdown file. File appears to contain binary data.',
      })
    }
  }

  if (data.length > MAX_ATTACHMENT_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: `File too large (max ${MAX_ATTACHMENT_SIZE / (1024 * 1024)} MB)`,
    })
  }

  let ext: string
  if (isPng) ext = 'png'
  else if (isJpeg) ext = 'jpg'
  else if (isHtml) ext = 'html'
  else if (isMd) ext = 'md'
  else ext = 'txt'

  return { ext, mimeType, isImage, isHtml, isMd }
}

export async function registerTaskAttachmentFromBuffer(
  db: ReturnType<typeof getDb>,
  taskId: string,
  input: { data: Buffer; originalName: string; mimeType: string },
): Promise<RegisteredTaskAttachment> {
  const { ext, mimeType } = validateUploadBuffer(input.data, input.mimeType, input.originalName)
  const filename = `${randomUUID()}.${ext}`
  const taskDir = path.join(ATTACHMENTS_DIR, taskId)
  const filePath = path.join(taskDir, filename)

  mkdirSync(taskDir, { recursive: true })
  writeFileSync(filePath, input.data)

  const [attachment] = await db
    .insert(schema.taskAttachments)
    .values({
      taskId,
      filename,
      originalName: input.originalName || 'untitled',
      mimeType,
      size: input.data.length,
      path: filePath,
    })
    .returning()

  return attachment
}

export async function registerTaskAttachmentFromPath(
  db: ReturnType<typeof getDb>,
  taskId: string,
  absolutePath: string,
  originalName?: string,
): Promise<RegisteredTaskAttachment | null> {
  if (!existsSync(absolutePath)) return null

  const data = readFileSync(absolutePath)
  if (data.length === 0 || data.length > MAX_ATTACHMENT_SIZE) return null

  const ext = path.extname(absolutePath).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext)) return null

  const detected = detectImageType(data)
  const mimeType = detected?.mimeType || mimeFromExtension(ext)
  if (!mimeType) return null

  const name = originalName || path.basename(absolutePath)
  const filename = `${randomUUID()}.${detected?.ext || ext.replace(/^\./, '')}`
  const taskDir = path.join(ATTACHMENTS_DIR, taskId)
  const destPath = path.join(taskDir, filename)

  mkdirSync(taskDir, { recursive: true })
  copyFileSync(absolutePath, destPath)

  const [attachment] = await db
    .insert(schema.taskAttachments)
    .values({
      taskId,
      filename,
      originalName: name,
      mimeType,
      size: data.length,
      path: destPath,
    })
    .returning()

  return attachment
}

export function taskAttachmentPublicPath(taskId: string, attachmentId: string): string {
  return `/api/tasks/${taskId}/attachments/${attachmentId}`
}
