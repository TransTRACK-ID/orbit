<template>
  <div class="min-h-screen bg-surface-50 relative">
    <!-- Dark mode toggle -->
    <button
      v-if="isReady"
      type="button"
      class="fixed top-4 right-4 z-50 w-9 h-9 rounded-lg border border-surface-200 bg-surface-50/80 backdrop-blur-sm flex items-center justify-center text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors duration-150 shadow-sm"
      :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggle"
    >
      <Icon v-if="isDark" name="lucide:sun" class="w-4 h-4" />
      <Icon v-else name="lucide:moon" class="w-4 h-4" />
    </button>

    <slot />
  </div>
</template>

<script setup lang="ts">
// Minimal layout for auth pages — no sidebar, no chrome
const { isDark, isReady, toggle } = useDarkMode()
</script>
