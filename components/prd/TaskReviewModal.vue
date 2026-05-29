<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto"
      @click.self="$emit('close')"
    >
      <div
        class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Icon name="lucide:list-checks" class="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 class="text-base font-semibold text-surface-900">Review Generated Tasks</h3>
              <p class="text-xs text-surface-500 mt-0.5">
                {{ tasks.length }} tasks from "{{ prdTitle }}"
              </p>
            </div>
          </div>
          <button
            class="text-surface-400 hover:text-surface-600 transition-colors p-1 rounded-lg hover:bg-surface-100"
            @click="$emit('close')"
          >
            <Icon name="lucide:x" class="w-4 h-4" />
          </button>
        </div>

        <!-- Project selector -->
        <div class="px-6 py-3 border-b border-surface-100 bg-surface-50">
          <div class="flex items-center gap-3">
            <label class="text-xs font-medium text-surface-600 flex-shrink-0">Target project</label>
            <div class="relative flex-1">
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
        </div>

        <!-- Tasks list -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <div v-if="tasks.length === 0" class="text-center py-12 text-surface-400">
            <Icon name="lucide:clipboard-list" class="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p class="text-sm">No tasks generated yet</p>
          </div>

          <div v-else class="py-2">
            <!-- Section groups -->
            <div
              v-for="(group, sectionKey) in groupedTasks"
              :key="sectionKey"
              class="mb-4 last:mb-0"
            >
              <!-- Section header -->
              <div class="sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-6 py-2 border-b border-surface-100">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-surface-700 uppercase tracking-wide">
                      {{ formatSectionName(sectionKey) }}
                    </span>
                    <span class="text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full">
                      {{ group.length }}
                    </span>
                  </div>
                  <button
                    class="text-xs text-surface-500 hover:text-accent transition-colors flex items-center gap-1"
                    @click="toggleSectionSelect(sectionKey)"
                  >
                    <Icon
                      :name="sectionAllSelected(sectionKey) ? 'lucide:square-check' : 'lucide:square'"
                      class="w-3.5 h-3.5"
                    />
                    {{ sectionAllSelected(sectionKey) ? 'Deselect all' : 'Select all' }}
                  </button>
                </div>
              </div>

              <!-- Tasks in this section -->
              <div class="px-6 py-1 space-y-1">
                <div
                  v-for="task in group"
                  :key="task._index"
                  class="group relative"
                  :class="[
                    selectedTasks[task._index]
                      ? 'bg-surface-50'
                      : 'bg-white',
                  ]"
                >
                  <!-- Tree line for subtasks -->
                  <div
                    v-if="task.parentIndex !== null"
                    class="tree-line"
                    aria-hidden="true"
                  />

                  <div
                    class="flex items-start gap-2 p-2 rounded-lg border transition-all duration-150"
                    :class="[
                      selectedTasks[task._index]
                        ? 'border-surface-200 shadow-sm'
                        : 'border-transparent hover:border-surface-200',
                    ]"
                  >
                    <!-- Checkbox -->
                    <div class="flex-shrink-0 pt-0.5">
                      <input
                        v-model="selectedTasks[task._index]"
                        type="checkbox"
                        class="w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent cursor-pointer"
                      >
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <!-- Title row -->
                      <div class="flex items-center gap-2">
                        <!-- Tree icon -->
                        <span class="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                          <Icon
                            v-if="task.parentIndex === null"
                            name="lucide:git-branch"
                            class="w-3.5 h-3.5 text-surface-400"
                          />
                          <Icon
                            v-else
                            name="lucide:git-commit"
                            class="w-3.5 h-3.5 text-surface-300"
                          />
                        </span>

                        <!-- Title input -->
                        <div class="flex-1 min-w-0 relative">
                          <input
                            v-if="editingTitle === task._index"
                            ref="titleInput"
                            v-model="editableTasks[task._index].title"
                            class="w-full text-sm font-medium text-surface-900 bg-white border border-accent rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            @blur="editingTitle = null"
                            @keydown.enter="editingTitle = null"
                            @keydown.escape="editingTitle = null"
                          >
                          <div
                            v-else
                            class="flex items-center gap-1 group/title"
                          >
                            <span
                              class="text-sm font-medium truncate cursor-text"
                              :class="selectedTasks[task._index] ? 'text-surface-900' : 'text-surface-400 line-through'"
                              @click="startEditingTitle(task._index)"
                            >
                              {{ editableTasks[task._index].title }}
                            </span>
                            <button
                              class="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 rounded hover:bg-surface-100"
                              @click="startEditingTitle(task._index)"
                            >
                              <Icon name="lucide:pencil" class="w-3 h-3 text-surface-400" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- Meta row -->
                      <div class="flex items-center gap-2 mt-1 ml-6">
                        <span
                          class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          :class="priorityClass(editableTasks[task._index].priority)"
                        >
                          {{ editableTasks[task._index].priority }}
                        </span>
                        <span
                          v-if="editableTasks[task._index].estimateHours"
                          class="text-[10px] text-surface-500 flex items-center gap-0.5"
                        >
                          <Icon name="lucide:clock" class="w-3 h-3" />
                          {{ editableTasks[task._index].estimateHours }}h
                        </span>
                        <span class="flex items-center gap-1">
                          <span
                            v-for="label in editableTasks[task._index].labels"
                            :key="label"
                            class="text-[10px] text-surface-500 bg-surface-100 px-1.5 py-0.5 rounded"
                          >
                            {{ label }}
                          </span>
                        </span>
                      </div>

                      <!-- Description -->
                      <div class="ml-6 mt-1">
                        <button
                          v-if="editableTasks[task._index].description"
                          class="text-[10px] text-surface-400 hover:text-surface-600 transition-colors flex items-center gap-1"
                          @click="toggleDescription(task._index)"
                        >
                          <Icon
                            :name="showDescription[task._index] ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                            class="w-3 h-3"
                          />
                          {{ showDescription[task._index] ? 'Hide details' : 'Show details' }}
                        </button>
                        <div
                          v-if="showDescription[task._index]"
                          class="mt-1.5 text-xs text-surface-600 bg-surface-50 rounded-lg p-3 border border-surface-100"
                        >
                          <div class="task-markdown" v-html="parseMarkdown(editableTasks[task._index].description || '')" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-surface-100 bg-surface-50 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4 text-xs">
              <div class="flex items-center gap-1.5">
                <Icon name="lucide:check-square" class="w-3.5 h-3.5 text-surface-500" />
                <span class="text-surface-500">
                  <span class="font-semibold text-surface-700">{{ selectedCount }}</span>
                  /{{ tasks.length }} selected
                </span>
              </div>
              <div v-if="totalEstimate > 0" class="flex items-center gap-1.5">
                <Icon name="lucide:clock" class="w-3.5 h-3.5 text-surface-500" />
                <span class="text-surface-500">
                  ~<span class="font-semibold text-surface-700">{{ totalEstimate }}</span>h
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <Icon name="lucide:layers" class="w-3.5 h-3.5 text-surface-500" />
                <span class="text-surface-500">
                  <span class="font-semibold text-surface-700">{{ Object.keys(groupedTasks).length }}</span>
                  sections
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-600 hover:bg-white transition-colors"
                @click="$emit('close')"
              >
                Cancel
              </button>
              <button
                class="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                :disabled="selectedCount === 0 || !selectedProjectId || committing"
                @click="handleCommit"
              >
                <span v-if="committing" class="flex items-center gap-1.5">
                  <Icon name="lucide:loader-2" class="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </span>
                <span v-else>
                  <Icon name="lucide:plus" class="w-3.5 h-3.5" />
                  Add {{ selectedCount }} to board
                </span>
              </button>
            </div>
          </div>
          <p v-if="commitError" class="text-red-500 text-xs mt-2">{{ commitError }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
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
const editingTitle = ref<number | null>(null)
const commitError = ref('')

// Initialize when tasks change
watch(() => props.tasks, (tasks) => {
  selectedTasks.value = tasks.map(() => true)
  editableTasks.value = tasks.map(t => ({ ...t }))
  showDescription.value = tasks.map(() => false)
  editingTitle.value = null
  commitError.value = ''
}, { immediate: true })

// Group tasks by section
const groupedTasks = computed(() => {
  const groups: Record<string, (GeneratedTask & { _index: number })[]> = {}
  props.tasks.forEach((task, index) => {
    const section = task.sectionSource || 'general'
    if (!groups[section]) groups[section] = []
    groups[section].push({ ...task, _index: index })
  })
  return groups
})

// Check if all tasks in a section are selected
function sectionAllSelected(sectionKey: string): boolean {
  const indices = groupedTasks.value[sectionKey]?.map(t => t._index) || []
  if (indices.length === 0) return false
  return indices.every(idx => selectedTasks.value[idx])
}

// Toggle all tasks in a section
function toggleSectionSelect(sectionKey: string) {
  const indices = groupedTasks.value[sectionKey]?.map(t => t._index) || []
  const allSelected = sectionAllSelected(sectionKey)
  indices.forEach(idx => {
    selectedTasks.value[idx] = !allSelected
  })
}

// Format section name for display
function formatSectionName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

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

function startEditingTitle(index: number) {
  editingTitle.value = index
  // Focus the input after next tick
  nextTick(() => {
    const input = document.querySelector(`input[data-index="${index}"]`)
    if (input) (input as HTMLInputElement).focus()
  })
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
.tree-line {
  position: absolute;
  left: 1.75rem;
  top: -0.5rem;
  bottom: 50%;
  width: 1.5rem;
  border-left: 1.5px solid #E5E5EA;
  border-bottom: 1.5px solid #E5E5EA;
  border-bottom-left-radius: 6px;
  pointer-events: none;
}

.task-markdown :deep(p) {
  @apply mb-1.5 last:mb-0 text-surface-600;
}
.task-markdown :deep(ul) {
  @apply list-disc pl-4 my-1.5 space-y-0.5;
}
.task-markdown :deep(ol) {
  @apply list-decimal pl-4 my-1.5 space-y-0.5;
}
.task-markdown :deep(li) {
  @apply text-surface-600;
}
.task-markdown :deep(strong) {
  @apply font-semibold text-surface-800;
}
.task-markdown :deep(h1, h2, h3, h4) {
  @apply font-semibold text-surface-800 mb-1 mt-2 first:mt-0;
}
.task-markdown :deep(code) {
  @apply text-xs bg-surface-100 px-1 py-0.5 rounded text-surface-700;
}
</style>
