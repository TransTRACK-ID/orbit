<template>
  <div class="grid grid-cols-1 gap-3">
    <div
      v-for="t in templates"
      :key="t.id"
      class="border border-surface-200 rounded-lg p-4 hover:border-accent cursor-pointer transition-colors"
      @click="$emit('select', t)"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <ProjectStackIcon :stack="t.stack" />
          <h4 class="text-sm font-semibold">{{ t.name }}</h4>
        </div>
        <Chip size="sm">{{ t.category }}</Chip>
      </div>
      <p class="text-xs text-surface-500">{{ t.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TemplateConfig } from '~/types'

defineProps<{
  templates: TemplateConfig[]
}>()

defineEmits<{
  select: [template: TemplateConfig]
}>()
</script>
