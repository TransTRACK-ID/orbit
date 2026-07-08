const MAX_EXTRACTED_CHARS = 50_000

export type DocumentKind = 'pdf' | 'docx' | 'text' | 'image' | 'unknown'

export function detectDocumentKind(
  data: Buffer,
  mimeType: string,
  originalName: string,
): DocumentKind {
  const ext = originalName.toLowerCase().split('.').pop() || ''
  const magic = data.slice(0, 4)

  const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47
  const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF
  if (isPng || isJpeg) return 'image'

  const isPdf = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46
  if (isPdf || mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'

  const isZip = magic[0] === 0x50 && magic[1] === 0x4B
  if (
    isZip
    && (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || ext === 'docx')
  ) {
    return 'docx'
  }

  if (
    mimeType === 'text/plain'
    || mimeType === 'text/markdown'
    || ext === 'txt'
    || ext === 'md'
  ) {
    return 'text'
  }

  return 'unknown'
}

function truncateText(text: string): string {
  const trimmed = text.replace(/\r\n/g, '\n').trim()
  if (trimmed.length <= MAX_EXTRACTED_CHARS) return trimmed
  return `${trimmed.slice(0, MAX_EXTRACTED_CHARS)}\n\n[... truncated — document exceeds ${MAX_EXTRACTED_CHARS} characters]`
}

async function extractPdfText(data: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(data))
  const { text } = await extractText(pdf, { mergePages: true })
  return typeof text === 'string' ? text : text.join('\n\n')
}

async function extractDocxText(data: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer: data })
  return result.value || ''
}

export async function extractDocumentText(
  data: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string | null> {
  const kind = detectDocumentKind(data, mimeType, originalName)

  switch (kind) {
    case 'text': {
      const hasBinary = data.slice(0, 1024).includes(0)
      if (hasBinary) return null
      return truncateText(data.toString('utf-8'))
    }
    case 'pdf':
      return truncateText(await extractPdfText(data))
    case 'docx':
      return truncateText(await extractDocxText(data))
    default:
      return null
  }
}

export function isImageKind(kind: DocumentKind): boolean {
  return kind === 'image'
}

export function isDocumentKind(kind: DocumentKind): boolean {
  return kind === 'pdf' || kind === 'docx' || kind === 'text'
}
