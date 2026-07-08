import type { brainstormAttachments } from '~/server/database/schema/brainstorm-attachments'
import {
  detectDocumentKind,
  extractDocumentText,
  isDocumentKind,
  type DocumentKind,
} from '~/server/utils/document-parser'

export const BRAINSTORM_MAX_ATTACHMENTS = 3
export const BRAINSTORM_MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

export type BrainstormAttachmentRow = typeof brainstormAttachments.$inferSelect

export interface ValidatedBrainstormFile {
  data: Buffer
  mimeType: string
  originalName: string
  kind: DocumentKind
  ext: string
}

export function getBrainstormAcceptList(): string {
  return [
    'image/png',
    'image/jpeg',
    'image/jpg',
    '.pdf',
    '.docx',
    '.txt',
    '.md',
  ].join(',')
}

export function validateBrainstormFile(
  data: Buffer,
  mimeType: string,
  originalName: string,
): ValidatedBrainstormFile {
  if (data.length > BRAINSTORM_MAX_FILE_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: `File too large (max ${BRAINSTORM_MAX_FILE_SIZE / (1024 * 1024)} MB)`,
    })
  }

  const kind = detectDocumentKind(data, mimeType, originalName)
  if (kind === 'unknown') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Allowed: PNG, JPEG, PDF, DOCX, TXT, and Markdown.',
    })
  }

  const normalizedMime = mimeType || 'application/octet-stream'
  if (
    !ALLOWED_MIME_TYPES.includes(normalizedMime)
    && kind !== 'image'
    && !isDocumentKind(kind)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file type. Allowed: PNG, JPEG, PDF, DOCX, TXT, and Markdown.',
    })
  }

  const ext = extensionForKind(kind, data, originalName)
  return {
    data,
    mimeType: normalizedMime,
    originalName: originalName || 'untitled',
    kind,
    ext,
  }
}

function extensionForKind(kind: DocumentKind, data: Buffer, originalName: string): string {
  switch (kind) {
    case 'image': {
      const magic = data.slice(0, 4)
      const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47
      return isPng ? 'png' : 'jpg'
    }
    case 'pdf':
      return 'pdf'
    case 'docx':
      return 'docx'
    case 'text': {
      const ext = originalName.toLowerCase().split('.').pop()
      return ext === 'md' ? 'md' : 'txt'
    }
    default:
      return 'bin'
  }
}

export async function parseBrainstormAttachmentText(
  file: ValidatedBrainstormFile,
): Promise<string | null> {
  if (!isDocumentKind(file.kind)) return null
  const text = await extractDocumentText(file.data, file.mimeType, file.originalName)
  if (!text?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Could not extract text from the uploaded document.',
    })
  }
  return text
}

export function buildBrainstormAttachmentPrompt(
  attachments: BrainstormAttachmentRow[],
): string {
  if (attachments.length === 0) return ''

  const imageAttachments = attachments.filter((att) => att.mimeType.startsWith('image/'))
  const documentAttachments = attachments.filter((att) => att.extractedText?.trim())

  const lines: string[] = [
    `[ATTACHED FILES]`,
    `The user has attached ${attachments.length} file(s) to provide context for this session.`,
  ]

  if (imageAttachments.length > 0) {
    lines.push(
      '',
      'Image attachments are available for visual analysis. When asked about them, describe colors, layouts, UI elements, text content, design details, and any visual information you can see. Do NOT say you cannot see them.',
      ...imageAttachments.map((att, idx) => {
        const safeName = sanitizeAttachmentName(att.originalName)
        return `${idx + 1}. ${safeName} (${att.mimeType})`
      }),
    )
  }

  if (documentAttachments.length > 0) {
    lines.push(
      '',
      'The following documents have been parsed into text. Use this content as authoritative context when answering questions:',
    )
    for (const att of documentAttachments) {
      const safeName = sanitizeAttachmentName(att.originalName)
      lines.push(
        '',
        `--- ${safeName} (${att.mimeType}) ---`,
        att.extractedText!.trim(),
        `--- end of ${safeName} ---`,
      )
    }
  }

  const unnamedDocs = attachments.filter((att) => !att.extractedText?.trim() && !att.mimeType.startsWith('image/'))
  if (unnamedDocs.length > 0) {
    lines.push(
      '',
      'Additional file references:',
      ...unnamedDocs.map((att, idx) => {
        const safeName = sanitizeAttachmentName(att.originalName)
        return `${idx + 1}. ${safeName} (${att.mimeType})`
      }),
    )
  }

  return lines.join('\n')
}

function sanitizeAttachmentName(name: string): string {
  return name
    .replace(/[\n\r]/g, ' ')
    .replace(/[[\]]/g, '')
    .replace(/`/g, "'")
    .slice(0, 100)
}
