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

onMounted(() => {
  if (status.value === 'authenticated') {
    navigateTo('/workspaces')
  } else if (status.value === 'unauthenticated') {
    navigateTo('/login')
  }
})
</script>
