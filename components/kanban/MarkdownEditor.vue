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
      class="py-2.5 px-3.5 block w-full border border-surface-200 bg-white rounded-lg text-sm min-h-[80px] prose prose-sm max-w-none text-surface-700"
      v-html="rendered"
    />
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

function parseMarkdown(md: string): string {
  return md
    .replace(/\\n/g, '\n')
    .replace(/^(#{1,6})\s+(.*)$/gm, (_, hashes, text) => {
      const level = hashes.length
      return `<h${level} class="font-semibold text-slate-800 mt-2 mb-1">${text}</h${level}>`
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^\s*[-*+]\s+(.*)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^\s*\d+\.\s+(.*)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(.*)$/gm, '<p class="mb-1">$1</p>')
    .replace(/<p class="mb-1"><h(\d)[^>]*>(.*?)<\/h\d><\/p>/g, '<h$1 class="font-semibold text-slate-800 mt-2 mb-1">$2</h$1>')
    .replace(/<p class="mb-1"><li class="ml-4">(.*?)<\/li><\/p>/g, '<li class="ml-4">$1</li>')
    .replace(/(<li class="ml-4">.*?<\/li>\s*)+/g, '<ul class="list-disc pl-2 my-1">$&</ul>')
    .replace(/\n/g, '')
}

const rendered = computed(() => {
  if (!props.modelValue) return '<p class="text-surface-400 italic">No description provided</p>'
  return parseMarkdown(props.modelValue)
})

function onInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>

<style scoped>
.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3),
.prose :deep(h4) {
  margin-top: 0.5em;
  margin-bottom: 0.25em;
  color: #1e293b;
}
.dark .prose :deep(h1),
.dark .prose :deep(h2),
.dark .prose :deep(h3),
.dark .prose :deep(h4) {
  color: #f1f5f9;
}
.prose :deep(p) {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}
.prose :deep(ul),
.prose :deep(ol) {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
  padding-left: 1.25em;
}
.prose :deep(li) {
  margin-top: 0.125em;
  margin-bottom: 0.125em;
}
.prose :deep(code) {
  background: #f1f5f9;
  padding: 0.125em 0.375em;
  border-radius: 4px;
  font-size: 0.875em;
}
.dark .prose :deep(code) {
  background: #1e293b;
  color: #e2e8f0;
}
.prose :deep(pre) {
  background: #0f172a;
  color: #e2e8f0;
  padding: 0.75em 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.prose :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
}
.prose :deep(blockquote) {
  border-left: 3px solid #e2e8f0;
  padding-left: 0.75em;
  margin: 0.5em 0;
  color: #64748b;
}
.dark .prose :deep(blockquote) {
  border-left-color: #334155;
  color: #94a3b8;
}
.prose :deep(a) {
  color: #6366f1;
  text-decoration: underline;
}
.dark .prose :deep(a) {
  color: #a5b4fc;
}
.prose :deep(img) {
  max-width: 100%;
  border-radius: 6px;
  margin: 0.5em 0;
}
.prose :deep(hr) {
  margin: 0.75em 0;
  border-color: #e2e8f0;
}
.dark .prose :deep(hr) {
  border-color: #334155;
}
.prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
}
.prose :deep(th),
.prose :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 0.375em 0.5em;
  text-align: left;
  font-size: 0.875em;
}
.dark .prose :deep(th),
.dark .prose :deep(td) {
  border-color: #334155;
}
.prose :deep(th) {
  background: #f8fafc;
  font-weight: 600;
}
.dark .prose :deep(th) {
  background: #0f172a;
}
</style>
