let initialized = false

function getTheme(): 'default' | 'dark' {
  if (!import.meta.client) return 'default'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default'
}

/**
 * Render Mermaid diagrams inside a container. Skips elements already processed.
 * No-op on the server.
 */
export async function renderMermaidIn(root: ParentNode) {
  if (!import.meta.client) return

  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid'))
    .filter(el => !el.hasAttribute('data-processed'))
  if (!nodes.length) return

  const { default: mermaid } = await import('mermaid')

  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: getTheme(),
    })
    initialized = true
  }

  try {
    await mermaid.run({ nodes })
  } catch (error) {
    console.error('Failed to render Mermaid diagram:', error)
  }
}
