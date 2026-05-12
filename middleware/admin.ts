export default defineNuxtRouteMiddleware((to) => {
  const { data: session, status } = useAuth()

  // If auth is still loading, don't redirect yet — the page will re-evaluate
  // once the session is ready. The API endpoints enforce server-side protection.
  if (status.value === 'loading') {
    return
  }

  const user = (session.value?.user as any) || {}

  if (user?.role !== 'super_admin') {
    return navigateTo('/workspaces')
  }
})
