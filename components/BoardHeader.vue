<template>
  <div class="border-b border-surface-200 bg-white flex-shrink-0">
    <!-- Primary toolbar row -->
    <div class="flex items-center gap-2 px-3 sm:px-5 py-3">
      <!-- Title + count -->
      <div class="flex items-center gap-2.5 min-w-0 flex-shrink-0">
        <h2 class="text-sm font-semibold text-surface-900 flex-shrink-0">Board</h2>
        <span class="text-xs text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full font-medium">{{ taskCount }} tasks</span>
      </div>

      <!-- Search -->
      <div class="relative hidden sm:block max-w-[200px]">
        <Icon
          name="lucide:search"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400"
        />
        <input
          :value="searchQuery"
          type="text"
          placeholder="Filter tasks..."
          class="w-full h-7 pl-8 pr-3 text-xs bg-surface-50 border border-surface-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
          @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Sort -->
      <div class="flex items-center gap-1">
        <select
          :value="sortField"
          class="h-7 text-xs bg-surface-50 border border-surface-200 rounded-lg px-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer"
          @change="$emit('update:sortField', ($event.target as HTMLSelectElement).value as SortState['field'])"
        >
          <option value="manual">Manual</option>
          <option value="priority">Priority</option>
          <option value="createdAt">Created</option>
          <option value="updatedAt">Updated</option>
          <option value="dueDate">Due date</option>
          <option value="title">Title</option>
        </select>
        <button
          class="h-7 w-7 flex items-center justify-center rounded-lg border border-surface-200 bg-surface-50 hover:bg-surface-100 transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
          @click="$emit('update:sortDirection', sortDirection === 'asc' ? 'desc' : 'asc')"
        >
          <Icon
            :name="sortDirection === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
            class="w-3.5 h-3.5 text-surface-500"
          />
        </button>
      </div>

      <!-- Filter toggle -->
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 bg-surface-50 hover:bg-surface-100 transition-colors text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        :class="{ 'bg-surface-100 border-surface-300': showFilters }"
        @click="$emit('update:showFilters', !showFilters)"
      >
        <Icon name="lucide:filter" class="w-3.5 h-3.5" />
        <span class="max-sm:hidden">Filters</span>
        <span
          v-if="activeFilterCount > 0"
          class="ml-1 px-1.5 py-0.5 rounded-full bg-accent text-white text-xs font-semibold min-w-[18px] text-center leading-none"
        >
          {{ activeFilterCount }}
        </span>
      </button>

      <div class="flex items-center gap-1.5 ml-auto flex-shrink-0">
        <!-- View Toggle -->
        <div class="flex items-center rounded-lg border border-surface-200 overflow-hidden">
          <button
            class="px-2 py-1.5 text-xs hover:bg-surface-50 transition-colors flex items-center focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:outline-none"
            :class="{ 'bg-surface-100 text-surface-900': viewMode === 'kanban', 'text-surface-500': viewMode !== 'kanban' }"
            title="Kanban view"
            @click="$emit('update:viewMode', 'kanban')"
          >
            <Icon name="lucide:layout-grid" class="w-3.5 h-3.5" />
          </button>
          <button
            class="px-2 py-1.5 text-xs hover:bg-surface-50 transition-colors flex items-center focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:outline-none"
            :class="{ 'bg-surface-100 text-surface-900': viewMode === 'table', 'text-surface-500': viewMode !== 'table' }"
            title="Table view"
            @click="$emit('update:viewMode', 'table')"
          >
            <Icon name="lucide:table" class="w-3.5 h-3.5" />
          </button>
          <button
            class="px-2 py-1.5 text-xs hover:bg-surface-50 transition-colors flex items-center focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:outline-none"
            :class="{ 'bg-surface-100 text-surface-900': viewMode === 'list', 'text-surface-500': viewMode !== 'list' }"
            title="List view"
            @click="$emit('update:viewMode', 'list')"
          >
            <Icon name="lucide:list" class="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          data-tooltip-target="new-task"
          class="px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium flex items-center gap-1.5 hover:bg-surface-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:outline-none"
          @click="$emit('createTask')"
        >
          <Icon name="lucide:plus" class="w-3.5 h-3.5" />
          <span class="max-sm:hidden">New Task</span>
        </button>
        <button
          class="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium flex items-center gap-1.5 hover:bg-accent-hover transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:outline-none"
          title="Assign all unassigned tasks to available AI agents"
          @click="handleAutoAssign"
        >
          <Icon name="lucide:zap" class="w-3.5 h-3.5" />
          <span class="max-sm:hidden">Auto-Assign</span>
        </button>
        <button
          class="px-2 py-1.5 rounded-lg border border-surface-200 text-xs hover:bg-surface-50 transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:outline-none"
          title="Agents"
          @click="toggleAgentPanel"
        >
          <Icon name="lucide:bot" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Active filter chips row -->
    <div
      v-if="activeFilterChips.length > 0"
      class="flex flex-wrap items-center gap-1.5 px-3 sm:px-5 pb-2.5"
    >
      <span class="text-xs font-semibold text-surface-500">Active filters</span>
      <button
        v-for="chip in activeFilterChips"
        :key="chip.key"
        class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 border border-surface-200 text-xs text-surface-700 hover:bg-surface-200 transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        @click="removeChip(chip)"
      >
        <span>{{ chip.label }}</span>
        <Icon name="lucide:x" class="w-3 h-3 text-surface-400" />
      </button>
      <button
        class="text-xs text-accent hover:text-accent-hover font-medium ml-1 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none rounded"
        @click="$emit('clearFilters')"
      >
        Clear all
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task, Status, Label, TaskPriority } from '~/types'
import type { FilterState, SortState } from '~/composables/useBoardFilterSort'

const props = defineProps<{
  statuses: Status[]
  labels: Label[]
  taskCount: number
  viewMode?: 'kanban' | 'table' | 'list'
  searchQuery: string
  sortField?: SortState['field']
  sortDirection?: SortState['direction']
  showFilters: boolean
  activeFilterCount: number
  activeFilterChips: { key: string; label: string; type: 'search' | 'status' | 'priority' | 'label' | 'assigneeType' | 'agentEnabled' }[]
}>()

const emit = defineEmits<{
  createTask: []
  autoAssign: []
  'update:viewMode': [mode: 'kanban' | 'table' | 'list']
  'update:search': [value: string]
  'update:sortField': [field: SortState['field']]
  'update:sortDirection': [direction: SortState['direction']]
  'update:showFilters': [show: boolean]
  'removeChip': [chip: { key: string; label: string; type: 'search' | 'status' | 'priority' | 'label' | 'assigneeType' | 'agentEnabled' }]
  'clearFilters': []
}>()

const { addLog } = useLog()
const route = useRoute()
const { tasks, fetchTasks, updateTask } = useTask()
const { agents, toggleAgentPanel: toggleAgentPanel_ } = useAgent()

function toggleAgentPanel() {
  toggleAgentPanel_()
}

function removeChip(chip: { key: string; label: string; type: 'search' | 'status' | 'priority' | 'label' | 'assigneeType' | 'agentEnabled' }) {
  emit('removeChip', chip)
}

async function handleAutoAssign() {
  const projectId = route.params.projectId as string

  if (!tasks.value || tasks.value.length === 0) {
    await fetchTasks(projectId)
  }

  const unassigned = tasks.value.filter((t: Task) => !t.assigneeId)

  if (unassigned.length === 0) {
    addLog('System', 'No unassigned tasks to auto-assign')
    return
  }

  const progressStatus = props.statuses.find((s: Status) => /progress/i.test(s.name))
  const agentCandidates = agents.value.filter((a) => a.status !== 'offline')

  if (agentCandidates.length === 0) {
    addLog('System', `Found ${unassigned.length} unassigned tasks but no available agents. Create an agent first.`)
    return
  }

  let assignedCount = 0
  for (const task of unassigned) {
    const agent = agentCandidates[assignedCount % agentCandidates.length]
    try {
      const updateData: any = {
        assigneeId: agent.id,
        assigneeType: 'agent',
      }
      if (progressStatus && task.statusId !== progressStatus.id) {
        updateData.statusId = progressStatus.id
      }
      await updateTask(task.id, updateData)
      assignedCount++
    } catch {
      addLog('System', `Failed to assign "${task.title}" to "${agent.name}"`, task.id)
    }
  }

  addLog('System', `Auto-assigned ${assignedCount}/${unassigned.length} tasks to runtime agents`)
}
</script>
