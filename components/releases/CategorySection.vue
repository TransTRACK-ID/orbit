<template>
  <div>
    <div class="flex items-center gap-2 mb-2">
      <Icon :name="icon" :class="['w-4 h-4', iconColorClass]" />
      <h3 class="text-sm font-semibold text-surface-900">{{ title }}</h3>
      <span class="text-xs text-surface-400 font-mono">{{ items.length }}</span>
    </div>
    <ul class="space-y-1.5 pl-6">
      <li v-for="(item, idx) in items" :key="idx" class="text-sm text-surface-600 leading-relaxed">
        {{ item }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  icon: string
  iconColorClass: string
  items: string[]
}>()
</script>
