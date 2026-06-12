<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900">
    <h1 class="text-3xl font-semibold mb-2">
      Welcome
    </h1>
    <p class="text-gray-600 mb-6">
      Your Nuxt 3 SPA starter is ready. Edit <code class="text-sm bg-gray-200 px-1 rounded">pages/index.vue</code> to get started.
    </p>
    <p class="text-sm text-gray-500">
      API base URL: {{ config.public.apiBaseUrl }}
    </p>
  </main>
</template>
