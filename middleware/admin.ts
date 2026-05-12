export default defineNuxtRouteMiddleware(() => {
  const { data: session } = useAuth()
  const user = computed(() => (session.value?.user as any) || {})

  if (user.value?.role !== 'super_admin') {
    return navigateTo('/workspaces')
  }
})
