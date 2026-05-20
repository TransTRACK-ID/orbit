<template>
  <div class="min-h-screen bg-surface-50">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Minimal layout for auth pages — no sidebar, no chrome

// Force light mode for auth surfaces — dark mode clashes with warm workshop aesthetic
let savedDarkMode = false

function forceLightMode() {
  if (process.client) {
    savedDarkMode = document.documentElement.classList.contains('dark')
    document.documentElement.classList.remove('dark')
  }
}

function restoreDarkMode() {
  if (process.client && savedDarkMode) {
    document.documentElement.classList.add('dark')
  }
}

onMounted(() => {
  forceLightMode()
})

onUnmounted(() => {
  restoreDarkMode()
})
</script>
