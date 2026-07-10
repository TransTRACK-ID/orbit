import { marked } from 'marked'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang, escaped }) {
      if (lang?.toLowerCase() === 'mermaid') {
        return `<div class="mermaid">${escapeHtml(text)}</div>\n`
      }
      const langClass = lang ? ` class="language-${lang}"` : ''
      const code = escaped ? text : escapeHtml(text)
      return `<pre><code${langClass}>${code}</code></pre>\n`
    },
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

function normalizeMarkdownInput(md: string): string {
  let text = md.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim()
  if (!text) return text

  // Unicode bullets → markdown list markers
  text = text.replace(/^[\t ]*[•●▪◦]\s+/gm, '- ')

  // Blank line before block elements (GFM is picky without these)
  text = text.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
  text = text.replace(/([^\n])\n([-*+] |\d+\. )/g, '$1\n\n$2')
  text = text.replace(/([^\n])\n(```)/g, '$1\n\n$2')
  text = text.replace(/([^\n])\n(>\s)/g, '$1\n\n$2')

  return text
}

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

  const normalized = normalizeMarkdownInput(md)
  return marked.parse(normalized, { async: false }) as string
}
