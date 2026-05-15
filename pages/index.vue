<template>
  <div class="min-h-screen flex items-center justify-center">
    <UiLoadingState />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  auth: false,
})

const { status } = useAuth()

// Redirect as soon as auth status resolves
watch(status, async (newStatus) => {
  if (newStatus === 'authenticated') {
    const { needsOnboarding, ensureWorkspacesLoaded } = useOnboarding()
    await ensureWorkspacesLoaded()
    if (needsOnboarding.value) {
      await navigateTo('/onboarding')
    } else {
      await navigateTo('/workspaces')
    }
  } else if (newStatus === 'unauthenticated') {
    await navigateTo('/login')
  }
}, { immediate: true })

// Fallback: prevent infinite loading if auth requests fail (e.g. wrong AUTH_ORIGIN)
let timeout: ReturnType<typeof setTimeout>
onMounted(() => {
  timeout = setTimeout(() => {
    if (status.value === 'loading') {
      console.warn('[auth] Status still loading after timeout — redirecting to login')
      navigateTo('/login')
    }
  }, 3000)
})

onUnmounted(() => {
  clearTimeout(timeout)
})
</script>
