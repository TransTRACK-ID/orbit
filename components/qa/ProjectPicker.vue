<script setup lang="ts">
import type { Project } from '~/types'

const props = defineProps<{
  projects: Project[]
  modelValue: string | null
  disabled?: boolean
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
    class="field-input text-xs rounded-lg px-2.5 py-1.5 min-w-[160px] disabled:opacity-50"
    :disabled="disabled"
  >
    <option :value="null" disabled>Select project</option>
    <option v-for="p in projects" :key="p.id" :value="p.id">
      {{ p.name }}
    </option>
  </select>
</template>
