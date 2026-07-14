<template>
  <div class="min-h-screen bg-surface-50 relative">
    <button
      type="button"
      class="absolute top-4 right-4 z-20 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-colors duration-150"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
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
const { isDark, toggle: toggleDarkMode } = useDarkMode()
</script>
