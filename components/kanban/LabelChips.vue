<template>
  <div class="flex items-center gap-1 flex-wrap">
    <Chip
      v-for="label in labels"
      :key="label.id"
      :label="label.name"
      :color="label.color"
      size="sm"
    />
  </div>
</template>

<script setup lang="ts">
import type { Label } from '~/types'

defineProps<{
  labels: Label[]
}>()
</script>
