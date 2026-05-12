export default defineNuxtRouteMiddleware(async (to) => {
  const { status, data: session, getSession } = useAuth()

  // Wait for auth to resolve before deciding
  if (status.value === 'loading') {
    await getSession()
  }

  const user = (session.value?.user as any) || {}

  if (user?.role !== 'super_admin') {
    return navigateTo('/workspaces')
  }
})
