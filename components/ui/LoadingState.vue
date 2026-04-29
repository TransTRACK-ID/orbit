<template>
  <div class="flex items-center justify-center py-16">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      <p v-if="text" class="text-sm text-surface-500">{{ text }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>
