<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
const { init } = useDarkMode()

onMounted(() => {
  init()
})
</script>

<style>
body {
  @apply bg-surface-50 text-surface-900 antialiased;
  font-family: 'Inter', system-ui, sans-serif;
}
</style>
