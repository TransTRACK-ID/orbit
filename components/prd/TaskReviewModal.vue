<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="$emit('close')">
      <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0">
          <div>
            <h3 class="text-lg font-semibold text-surface-900">Review Generated Tasks</h3>
            <p class="text-xs text-surface-500 mt-0.5">
              {{ tasks.length }} tasks extracted from "{{ prdTitle }}"
            </p>
          </div>
          <button class="text-surface-400 hover:text-surface-600 transition-colors p-1" @click="$emit('close')">
            <Icon name="lucide:x" class="w-4 h-4" />
          </button>
        </div>

        <!-- Project selector -->
        <div class="px-6 py-3 border-b border-surface-100">
          <label class="block text-xs font-medium text-surface-600 mb-1.5">Select Project</label>
          <div class="relative">
            <select
              v-model="selectedProjectId"
              class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 pr-8 appearance-none cursor-pointer focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
            >
              <option value="" disabled>Choose a project</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
            <Icon
              name="lucide:chevron-down"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none"
            />
          </div>
        </div>

        <!-- Tasks list -->
        <div class="flex-1 overflow-y-auto px-6 py-3">
          <div v-if="tasks.length === 0" class="text-center py-8 text-surface-400">
            <Icon name="lucide:clipboard-list" class="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p class="text-sm">No tasks generated yet</p>
          </div>

          <div v-else class="space-y-2">
            <!-- Select all -->
            <div class="flex items-center gap-2 pb-2 border-b border-surface-100 mb-2">
              <input
                :checked="allSelected"
                type="checkbox"
                class="w-4 h-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                @change="toggleSelectAll"
              >
              <span class="text-xs font-medium text-surface-600">
                {{ selectedCount }}/{{ tasks.length }} selected
              </span>
            </div>

            <!-- Task items -->
            <div
              v-for="(task, index) in tasks"
              :key="index"
              class="group flex items-start gap-2 p-2.5 rounded-lg border transition-colors"
              :class="[
                selectedTasks[index]
                  ? 'border-primary-200 bg-primary-50'
                  : 'border-surface-100 bg-white hover:border-surface-200',
                task.parentIndex !== null ? 'ml-6' : '',
              ]"
            >
              <input
                v-model="selectedTasks[index]"
                type="checkbox"
                class="w-4 h-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500 mt-0.5"
              >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    v-if="task.parentIndex === null"
                    class="w-4 h-4 flex items-center justify-center"
                  >
                    <Icon name="lucide:chevron-down" class="w-3 h-3 text-surface-400" />
                  </span>
                  <span v-else class="w-4 h-4 flex items-center justify-center">
                    <Icon name="lucide:corner-down-right" class="w-3 h-3 text-surface-300" />
                  </span>
                  <input
                    v-model="editableTasks[index].title"
                    class="flex-1 text-sm font-medium text-surface-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 min-w-0"
                    :class="!selectedTasks[index] ? 'text-surface-400' : ''"
                    :disabled="!selectedTasks[index]"
                  >
                </div>
                <div class="flex items-center gap-2 mt-1 ml-6">
                  <span
                    class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    :class="priorityClass(task.priority)"
                  >
                    {{ task.priority }}
                  </span>
                  <span v-if="task.estimateHours" class="text-[10px] text-surface-500">
                    {{ task.estimateHours }}h
                  </span>
                  <span class="text-[10px] text-surface-400">
                    {{ task.labels.join(', ') }}
                  </span>
                </div>
                <!-- Description preview (collapsible) -->
                <div class="ml-6 mt-1">
                  <button
                    class="text-[10px] text-surface-400 hover:text-surface-600 transition-colors"
                    @click="toggleDescription(index)"
                  >
                    {{ showDescription[index] ? 'Hide' : 'Show' }} description
                  </button>
                  <div
                    v-if="showDescription[index]"
                    class="mt-1 text-xs text-surface-600 bg-surface-50 rounded-lg p-2"
                  >
                    <div class="task-markdown" v-html="parseMarkdown(editableTasks[index].description || '')" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-surface-100 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div class="text-xs text-surface-500">
              Selected: <span class="font-semibold text-surface-700">{{ selectedCount }}</span>/{{ tasks.length }} tasks
              <span v-if="totalEstimate > 0" class="ml-2">
                · ~<span class="font-semibold text-surface-700">{{ totalEstimate }}</span> estimated hours
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors"
                @click="$emit('close')"
              >
                Cancel
              </button>
              <button
                class="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                :disabled="selectedCount === 0 || !selectedProjectId || committing"
                @click="handleCommit"
              >
                <span v-if="committing" class="flex items-center gap-1.5">
                  <Icon name="lucide:loader-2" class="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </span>
                <span v-else>Create {{ selectedCount }} Task{{ selectedCount !== 1 ? 's' : '' }}</span>
              </button>
            </div>
          </div>
          <p v-if="commitError" class="text-error-500 text-xs mt-2">{{ commitError }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { GeneratedTask } from '~/types'

const props = defineProps<{
  tasks: GeneratedTask[]
  prdTitle: string
  projects: Array<{ id: string; name: string }>
  committing: boolean
}>()

const emit = defineEmits<{
  close: []
  commit: [projectId: string, tasks: GeneratedTask[]]
}>()

const selectedProjectId = ref('')
const selectedTasks = ref<boolean[]>([])
const editableTasks = ref<GeneratedTask[]>([])
const showDescription = ref<boolean[]>([])
const commitError = ref('')

// Initialize
watch(() => props.tasks, (tasks) => {
  selectedTasks.value = tasks.map(() => true)
  editableTasks.value = tasks.map(t => ({ ...t }))
  showDescription.value = tasks.map(() => false)
}, { immediate: true })

const allSelected = computed(() => {
  return selectedTasks.value.length > 0 && selectedTasks.value.every(Boolean)
})

const selectedCount = computed(() => {
  return selectedTasks.value.filter(Boolean).length
})

const totalEstimate = computed(() => {
  return selectedTasks.value.reduce((sum, selected, idx) => {
    if (selected && editableTasks.value[idx]) {
      return sum + (editableTasks.value[idx].estimateHours || 0)
    }
    return sum
  }, 0)
})

function toggleSelectAll() {
  const newValue = !allSelected.value
  selectedTasks.value = selectedTasks.value.map(() => newValue)
}

function priorityClass(priority: string): string {
  const classes: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-green-100 text-green-700',
    none: 'bg-surface-100 text-surface-600',
  }
  return classes[priority] || classes.none
}

function toggleDescription(index: number) {
  showDescription.value[index] = !showDescription.value[index]
}

function handleCommit() {
  commitError.value = ''
  if (!selectedProjectId.value) {
    commitError.value = 'Please select a project'
    return
  }

  const selected = editableTasks.value.filter((_, idx) => selectedTasks.value[idx])
  if (selected.length === 0) {
    commitError.value = 'Please select at least one task'
    return
  }

  emit('commit', selectedProjectId.value, selected)
}

import { marked } from 'marked'

function parseMarkdown(md: string): string {
  if (!md) return ''
  return marked.parse(md, { async: false, breaks: true }) as string
}
</script>

<style scoped>
.task-markdown :deep(p) {
  @apply mb-1 last:mb-0 text-surface-700;
}
.task-markdown :deep(ul) {
  @apply list-disc pl-4 my-1 space-y-0.5;
}
.task-markdown :deep(ol) {
  @apply list-decimal pl-4 my-1 space-y-0.5;
}
.task-markdown :deep(li) {
  @apply ml-1 text-surface-700;
}
.task-markdown :deep(strong) {
  @apply font-semibold text-surface-800;
}
</style>
