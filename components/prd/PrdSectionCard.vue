<template>
  <div class="border border-surface-200 rounded-lg bg-white overflow-hidden">
    <!-- Header -->
    <button
      class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors"
      @click="isOpen = !isOpen"
    >
      <div class="flex items-center gap-2.5">
        <Icon
          name="lucide:chevron-right"
          class="w-4 h-4 text-surface-400 transition-transform duration-150"
          :class="isOpen ? 'rotate-90' : ''"
        />
        <div class="flex items-center gap-2">
          <Icon :name="sectionIcon" class="w-4 h-4 text-primary-500" />
          <h4 class="text-sm font-semibold text-surface-900">{{ section.title }}</h4>
        </div>
      </div>
      <span class="text-[10px] text-surface-400 font-medium uppercase tracking-wide">{{ section.sectionType }}</span>
    </button>

    <!-- Content -->
    <div
      v-show="isOpen"
      class="px-4 pb-4 pt-1 border-t border-surface-100"
    >
      <!-- View mode -->
      <div v-if="!isEditing" class="prd-markdown text-sm text-surface-800 leading-relaxed">
        <div v-html="parseMarkdown(section.content)" />
      </div>

      <!-- Edit mode -->
      <div v-else class="space-y-3">
        <textarea
          v-model="editedContent"
          class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors resize-y min-h-[200px]"
          rows="8"
        />
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 transition-colors"
            @click="handleSave"
          >
            Save
          </button>
          <button
            class="px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-600 hover:bg-surface-50 transition-colors"
            @click="cancelEdit"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PrdSection } from '~/types'

const props = defineProps<{
  section: PrdSection
  editing?: boolean
}>()

const emit = defineEmits<{
  save: [content: string]
}>()

const isOpen = ref(true)
const isEditing = ref(props.editing || false)
const editedContent = ref(props.section.content)

watch(() => props.editing, (val) => {
  isEditing.value = val || false
})

watch(() => props.section.content, (val) => {
  editedContent.value = val
})

const sectionIcons: Record<string, string> = {
  overview: 'lucide:book-open',
  goals: 'lucide:target',
  user_stories: 'lucide:users',
  requirements: 'lucide:list-checks',
  technical_spec: 'lucide:cpu',
  acceptance_criteria: 'lucide:check-circle',
  milestones: 'lucide:flag',
  risks: 'lucide:alert-triangle',
}

const sectionIcon = computed(() => {
  return sectionIcons[props.section.sectionType] || 'lucide:file-text'
})

function handleSave() {
  emit('save', editedContent.value)
  isEditing.value = false
}

function cancelEdit() {
  editedContent.value = props.section.content
  isEditing.value = false
}

import { marked } from 'marked'

function parseMarkdown(md: string): string {
  if (!md) return ''
  return marked.parse(md, { async: false, breaks: true }) as string
}
</script>

<style scoped>
.prd-markdown :deep(p) {
  @apply mb-2 last:mb-0 text-surface-800;
}
.prd-markdown :deep(h1) {
  @apply text-lg font-bold mt-4 mb-2 text-surface-900;
}
.prd-markdown :deep(h2) {
  @apply text-base font-semibold mt-3 mb-2 text-surface-900;
}
.prd-markdown :deep(h3) {
  @apply text-sm font-semibold mt-2 mb-1.5 text-surface-900;
}
.prd-markdown :deep(h4),
.prd-markdown :deep(h5),
.prd-markdown :deep(h6) {
  @apply text-sm font-medium mt-2 mb-1 text-surface-900;
}
.prd-markdown :deep(ul) {
  @apply list-disc pl-4 my-2 space-y-0.5;
}
.prd-markdown :deep(ol) {
  @apply list-decimal pl-4 my-2 space-y-0.5;
}
.prd-markdown :deep(li) {
  @apply ml-1 text-surface-800;
}
.prd-markdown :deep(pre) {
  @apply bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto;
}
.prd-markdown :deep(pre code) {
  @apply text-xs text-slate-300 font-mono leading-relaxed bg-transparent p-0;
}
.prd-markdown :deep(p code),
.prd-markdown :deep(li code) {
  @apply bg-surface-100 text-primary-700 px-1 py-0.5 rounded text-[11px] font-mono;
}
.prd-markdown :deep(blockquote) {
  @apply border-l-2 border-primary-300 pl-3 py-1 my-2 bg-primary-50 rounded-r text-surface-600 italic;
}
.prd-markdown :deep(hr) {
  @apply border-surface-200 my-3;
}
.prd-markdown :deep(a) {
  @apply text-primary-600 hover:text-primary-700 underline underline-offset-2;
}
.prd-markdown :deep(strong) {
  @apply font-semibold text-surface-900;
}
.prd-markdown :deep(table) {
  @apply w-full border-collapse my-2 text-xs;
}
.prd-markdown :deep(thead) {
  @apply bg-surface-100;
}
.prd-markdown :deep(th) {
  @apply px-2 py-1.5 text-left font-semibold text-surface-700 border border-surface-200;
}
.prd-markdown :deep(td) {
  @apply px-2 py-1.5 text-surface-800 border border-surface-200;
}
.prd-markdown :deep(tr:nth-child(even)) {
  background-color: var(--surface-100);
}
</style>
