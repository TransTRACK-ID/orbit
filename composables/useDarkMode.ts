/** Dark mode composable — persists preference in localStorage and syncs with system preference. */
export const useDarkMode = () => {
  const isDark = useState<boolean>('dark-mode', () => false)
  const isReady = useState<boolean>('dark-mode-ready', () => false)

  function apply(isDarkMode: boolean) {
    isDark.value = isDarkMode
    const html = document.documentElement
    if (isDarkMode) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  function init() {
    const stored = localStorage.getItem('dark-mode')
    if (stored !== null) {
      apply(stored === 'true')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      apply(prefersDark)
    }
    isReady.value = true

    // Listen for system preference changes when no manual override is stored
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (localStorage.getItem('dark-mode') === null) {
        apply(e.matches)
      }
    })
  }

  function toggle() {
    const next = !isDark.value
    apply(next)
    localStorage.setItem('dark-mode', String(next))
  }

  return {
    isDark: readonly(isDark),
    isReady: readonly(isReady),
    init,
    toggle,
  }
}
