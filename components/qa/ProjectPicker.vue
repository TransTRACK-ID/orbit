<script setup lang="ts">
import type { Project } from '~/types'

const props = defineProps<{
  projects: Project[]
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const selected = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
</script>

<template>
  <select
    v-model="selected"
    class="text-xs border border-surface-200 rounded-lg px-2.5 py-1.5 bg-white text-surface-800 min-w-[160px]"
  >
    <option :value="null" disabled>Select project</option>
    <option v-for="p in projects" :key="p.id" :value="p.id">
      {{ p.name }}
    </option>
  </select>
</template>
