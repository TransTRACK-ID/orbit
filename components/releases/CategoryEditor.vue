<template>
  <div>
    <div class="flex items-center gap-2 mb-1.5">
      <Icon :name="icon" :class="['w-4 h-4', `text-${color}-600` as string]" />
      <span class="text-xs font-semibold text-surface-700">{{ title }}</span>
      <span class="text-[10px] text-surface-400 font-mono">{{ items.length }}</span>
    </div>
    <textarea
      v-model="rawText"
      :rows="3"
      placeholder="One item per line…"
      class="w-full text-sm px-3 py-2 border border-surface-200 rounded-lg bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-y"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue?: string[]
  title: string
  icon: string
  color: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const items = computed(() => props.modelValue || [])

const rawText = computed({
  get: () => items.value.join('\n'),
  set: (val: string) => {
    emit('update:modelValue', val.split('\n').map(s => s.trim()).filter(Boolean))
  },
})
</script>
