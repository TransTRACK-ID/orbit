<template>
  <div>
    <div class="flex items-center gap-1 mb-1.5">
      <label class="block text-sm font-medium text-surface-700">Description</label>
      <div class="ml-auto flex bg-surface-100 rounded-lg p-0.5">
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
          :class="tab === 'write' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'"
          @click="tab = 'write'"
        >
          Write
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
          :class="tab === 'preview' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'"
          @click="tab = 'preview'"
        >
          Preview
        </button>
      </div>
    </div>

    <textarea
      v-if="tab === 'write'"
      :value="modelValue"
      @input="onInput"
      :rows="rows"
      placeholder="Add a description...&#10;&#10;Supports **markdown** formatting"
      class="py-2.5 px-3.5 block w-full border border-surface-200 bg-white text-surface-900 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-y min-h-[80px] outline-none transition-colors placeholder:text-surface-400"
    />

    <div
      v-else
      class="py-2.5 px-3.5 block w-full border border-surface-200 bg-white rounded-lg text-sm min-h-[80px] text-surface-700"
    >
      <KanbanMarkdownBody
        :content="modelValue"
        empty-text="No description provided"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  rows?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const tab = ref<'write' | 'preview'>('write')

function onInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>
