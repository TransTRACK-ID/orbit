<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <!-- Global page transition loading indicator -->
  <div
    v-if="pageLoading"
    class="fixed top-0 left-0 right-0 z-[100] h-[2px] bg-primary-500 animate-progress"
    style="box-shadow: 0 0 8px rgba(207, 81, 61, 0.4);"
  />
  <div
    v-if="pageLoading"
    class="fixed inset-0 z-[99] pointer-events-none"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
const { init } = useDarkMode()
const pageLoading = ref(false)
let loadingTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  init()

  // Show loading indicator when route navigation starts
  // Delay slightly to avoid flickering on fast transitions
  const router = useRouter()

  router.beforeEach((to, from) => {
    if (loadingTimeout) clearTimeout(loadingTimeout)
    // Query-only updates (e.g. selecting a QA run) should not block the UI.
    if (to.path === from.path) return
    loadingTimeout = setTimeout(() => {
      pageLoading.value = true
    }, 100)
  })

  router.afterEach((to, from) => {
    if (loadingTimeout) clearTimeout(loadingTimeout)
    if (to.path === from.path) return
    // Small delay to ensure page render has started
    loadingTimeout = setTimeout(() => {
      pageLoading.value = false
    }, 150)
  })

  // Handle errors
  router.onError(() => {
    if (loadingTimeout) clearTimeout(loadingTimeout)
    pageLoading.value = false
  })
})

onUnmounted(() => {
  if (loadingTimeout) clearTimeout(loadingTimeout)
})
</script>

<style>
body {
  @apply bg-surface-50 text-surface-900 antialiased;
  font-family: 'Inter', system-ui, sans-serif;
}

@keyframes progress {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(0%); }
  100% { transform: translateX(100%); }
}

.animate-progress {
  animation: progress 1.2s ease-in-out infinite;
}
</style>
