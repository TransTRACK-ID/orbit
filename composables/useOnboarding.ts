export const useOnboarding = () => {
  const { data, status, getSession } = useAuth()
  const { workspaces, fetchWorkspaces } = useWorkspace()

  const needsOnboarding = computed(() => {
    if (status.value !== 'authenticated') return false
    // If user already has workspaces, they don't need onboarding
    if (workspaces.value.length > 0) return false
    return data.value?.user?.onboardingCompleted === false
  })

  async function ensureWorkspacesLoaded() {
    if (workspaces.value.length === 0 && status.value === 'authenticated') {
      await fetchWorkspaces()
    }
  }

  async function completeOnboarding() {
    await $fetch('/api/user/onboarding', { method: 'PATCH' })
    // Force refresh session so all guards see the updated flag immediately
    await getSession({ force: true })
  }

  return {
    needsOnboarding,
    completeOnboarding,
    ensureWorkspacesLoaded,
  }
}
