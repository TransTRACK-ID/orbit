<template>
  <div class="min-h-screen bg-surface-50 relative">
    <button
      type="button"
      class="absolute top-4 right-4 z-20 flex items-center justify-center w-9 h-9 rounded-lg border border-surface-200 bg-white dark:bg-surface-100 text-surface-500 hover:text-surface-700 hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors"
      :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
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
