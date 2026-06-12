import { marked } from 'marked'

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens)
      const titleAttr = title ? ` title="${title}"` : ''
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
    },
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${title}"` : ''
      return `<img src="${href}" alt="${text || ''}"${titleAttr} loading="lazy" />`
    },
  },
})

export interface ParseMarkdownOptions {
  /** Returned when input is empty. Defaults to empty string. */
  emptyText?: string
}

/**
 * Parse markdown to HTML with GitHub-flavored markdown support.
 * Handles legacy escaped newlines and standard syntax (links, bold, code, etc.).
 */
export function parseMarkdown(md: string, options?: ParseMarkdownOptions): string {
  if (!md?.trim()) return options?.emptyText ?? ''

  const normalized = md.replace(/\\n/g, '\n')
  return marked.parse(normalized, { async: false }) as string
}
