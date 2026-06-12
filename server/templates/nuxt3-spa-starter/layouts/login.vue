<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<template>
  <div
    class="h-screen flex items-center justify-center min-h-screen bg-gray-50"
  >
    <img src="/bg-login-page.png" alt="bg-login-page" class="w-full h-full" />
    <div class="absolute">
      <div
        class="w-[1164px] space-y-8 px-20 bg-white rounded-[20px] shadow pt-14 pb-10"
      >
        <div
          class="grid lg:grid-cols-2 grid-cols-1 text-center items-center justify-between"
        >
          <div class="flex w-full items-center gap-2">
            <h1 class="text-2xl font-semibold text-gray-900">Orbit SPA Starter</h1>
          </div>
          <h2 class="text-xs text-end text-gray-400">
            © {{ currentYear }} Orbit. All rights reserved.
          </h2>
        </div>

        <slot />
      </div>
    </div>
  </div>
</template>
