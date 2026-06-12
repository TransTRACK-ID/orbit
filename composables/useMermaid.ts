import type { Ref, WatchSource } from 'vue'
import { renderMermaidIn } from '~/utils/mermaid'

/**
 * Render Mermaid diagrams after mount and whenever watched sources change.
 */
export function useMermaidRender(
  rootRef: Ref<HTMLElement | null | undefined>,
  ...sources: WatchSource[]
) {
  async function render() {
    if (!import.meta.client) return
    await nextTick()
    const root = rootRef.value
    if (!root) return
    await renderMermaidIn(root)
  }

  onMounted(() => { void render() })

  if (sources.length) {
    watch(sources, () => { void render() })
  }
}
