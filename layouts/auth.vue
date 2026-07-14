<template>
  <div class="min-h-screen bg-surface-50 dark:bg-surface-950 relative">
    <button
      type="button"
      class="absolute top-4 right-4 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      :title="isDark ? 'Light mode' : 'Dark mode'"
      @click="toggleDarkMode"
    >
      <Icon v-if="isDark" name="lucide:sun" class="w-4 h-4" />
      <Icon v-else name="lucide:moon" class="w-4 h-4" />
      <span class="text-sm">{{ isDark ? 'Light mode' : 'Dark mode' }}</span>
    </button>
    <slot />
  </div>
</template>

<script setup lang="ts">
// Minimal layout for auth pages — no sidebar, no chrome
const { isDark, toggle: toggleDarkMode } = useDarkMode()
</script>
