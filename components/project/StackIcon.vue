<template>
  <Icon :name="iconMap[stack] || 'lucide:box'" class="w-5 h-5" />
</template>

<script setup lang="ts">
const props = defineProps<{ stack: string }>()

const iconMap: Record<string, string> = {
  node: 'logos:nodejs',
  flutter: 'logos:flutter',
  php: 'logos:php',
  python: 'logos:python',
  java: 'logos:java',
  go: 'logos:go',
  rust: 'logos:rust',
}
</script>
