export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session, status } = useAuth()

  // Wait for auth to resolve
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

  const user = session.value?.user as any
  if (!user?.id) {
    return navigateTo('/login')
  }

  if (user.role !== 'super_admin') {
    return navigateTo('/workspaces')
  }
})
