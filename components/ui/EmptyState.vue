<template>
  <div class="flex flex-col items-center justify-center py-16 px-4">
    <div
      class="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4"
    >
      <Icon :name="icon" class="w-7 h-7 text-surface-400" />
    </div>
    <h3 class="text-lg font-semibold text-surface-900 mb-1">{{ title }}</h3>
    <p class="text-sm text-surface-500 text-center max-w-sm mb-6">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  icon?: string
}>()
</script>
