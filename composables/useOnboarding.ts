export const useOnboarding = () => {
  const { data, status, getSession } = useAuth()

  const needsOnboarding = computed(() => {
    if (status.value !== 'authenticated') return false
    return data.value?.user?.onboardingCompleted === false
  })

  async function completeOnboarding() {
    await $fetch('/api/user/onboarding', { method: 'PATCH' })
    // Force refresh session so all guards see the updated flag immediately
    await getSession({ force: true })
  }

  return {
    needsOnboarding,
    completeOnboarding,
  }
}
