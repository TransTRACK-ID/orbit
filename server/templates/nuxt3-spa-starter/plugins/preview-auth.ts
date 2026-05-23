// Preview-safe auth plugin — ensures auth state is stable in Orbit Live Preview iframe.
// This plugin detects preview mode and provides fallback auth handling to prevent
// navigation loops or crashes caused by @sidebase/nuxt-auth's default behavior in iframe contexts.

export default defineNuxtPlugin((nuxtApp) => {
  // Only run on client side
  if (process.server) return

  // Detect preview mode by URL path or cookie
  const isPreview = window.location.pathname.includes('/api/preview/') ||
    document.cookie.includes('auth.token=')

  if (!isPreview) return

  console.log('[preview-auth-plugin] Running in preview mode — URL:', window.location.pathname)

  // Patch Vue error handler to catch and log errors instead of crashing
  const originalErrorHandler = nuxtApp.vueApp.config.errorHandler
  nuxtApp.vueApp.config.errorHandler = (err, instance, info) => {
    console.error('[preview-auth-plugin] Vue error:', err, info)
    if (originalErrorHandler) {
      originalErrorHandler(err, instance, info)
    }
  }

  // Warn on unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[preview-auth-plugin] Unhandled promise rejection:', event.reason)
  })

  // If we're on the login page and already have auth data, redirect to home
  // This prevents the login form from showing when already authenticated.
  nuxtApp.hook('page:finish', () => {
    try {
      const auth = useAuth()
      const route = useRoute()
      if (route.path === '/login' && auth.status.value === 'authenticated') {
        console.log('[preview-auth-plugin] Already authenticated on login page — redirecting to /')
        navigateTo('/')
      }
    } catch (e) {
      console.error('[preview-auth-plugin] Error in page:finish hook:', e)
    }
  })
})
