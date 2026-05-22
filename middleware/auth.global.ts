import { useAuth, defineNuxtRouteMiddleware, navigateTo } from '#imports'

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check for auth-related pages
  if (to.meta?.auth === false) {
    return
  }

  // Fetch app settings to check if login is required
  // We use a separate fetch to avoid depending on useAuth's session
  let loginRequired = true
  try {
    const settings = await $fetch('/api/settings', { 
      headers: useRequestHeaders(['cookie']),
    })
    loginRequired = settings?.loginRequired ?? true
  } catch {
    // If settings API fails, default to requiring login
    loginRequired = true
  }

  // If login is not required, allow all navigation
  if (!loginRequired) {
    return
  }

  // Otherwise, enforce auth using useAuth
  const { status, signIn } = useAuth()

  // Wait for auth status to resolve
  if (status.value === 'loading') {
    await new Promise<void>((resolve) => {
      const unwatch = watch(status, (s) => {
        if (s !== 'loading') {
          unwatch()
          resolve()
        }
      })
    })
  }

  if (status.value === 'unauthenticated') {
    return signIn(undefined, { callbackUrl: to.fullPath }) as any
  }
})
