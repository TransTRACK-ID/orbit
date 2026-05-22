export const useSidebar = () => {
  const isOpen = useState<boolean>('sidebar:open', () => false)

  // Collapsed state for desktop sidebar (icon-only mode)
  const collapsed = useState<boolean>('sidebar:collapsed', () => {
    if (import.meta.client) {
      return localStorage.getItem('orbit-sidebar-collapsed') === 'true'
    }
    return false
  })

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggleCollapse() {
    collapsed.value = !collapsed.value
    if (import.meta.client) {
      localStorage.setItem('orbit-sidebar-collapsed', String(collapsed.value))
    }
  }

  return {
    isOpen: readonly(isOpen),
    collapsed: readonly(collapsed),
    toggle,
    open,
    close,
    toggleCollapse,
  }
}
