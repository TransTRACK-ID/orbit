<template>
  <div class="min-h-screen bg-surface-50 relative">
    <button
      type="button"
      class="absolute top-4 right-4 z-20 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-surface-200 bg-white text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-colors duration-150"
      :title="isDark ? 'Light mode' : 'Dark mode'"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggleDarkMode"
    >
      <Icon v-if="isDark" name="lucide:sun" class="w-4 h-4" />
      <Icon v-else name="lucide:moon" class="w-4 h-4" />
    </button>

    <slot />
  </div>
</template>

<script setup lang="ts">
// Minimal layout for auth pages — no sidebar, no chrome
const { isDark, toggle: toggleDarkMode } = useDarkMode()
</script>
