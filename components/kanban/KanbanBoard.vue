<template>
  <div class="flex flex-col h-full">
    <BoardHeader
      :statuses="statuses"
      :labels="labels"
      :task-count="tasks.length"
      :view-mode="viewMode"
      :search-query="searchQuery"
      :sort-field="sortField"
      :sort-direction="sortDirection"
      :show-filters="showFilters"
      :active-filter-count="activeFilterCount"
      :active-filter-chips="activeFilterChips"
      :total-task-count="tasks.length"
      :show-archived="showArchived"
      :is-selection-mode="isSelectionMode"
      :selected-count="selectedCount"
      :is-task-selected="isTaskSelected"
      @update:view-mode="$emit('update:viewMode', $event)"
      @create-task="$emit('createTask')"
      @update-task="$emit('updateTask', $event)"
      @open-task="$emit('openTask', $event)"
      @auto-assign="$emit('autoAssign', $event)"
      @update:search="$emit('update:search', $event)"
      @update:sort-field="$emit('update:sortField', $event)"
      @update:sort-direction="$emit('update:sortDirection', $event)"
      @update:show-filters="$emit('update:showFilters', $event)"
      @update:show-archived="$emit('update:showArchived', $event)"
      @update:selected-statuses="$emit('update:selectedStatuses', $event)"
      @update:selected-priorities="$emit('update:selectedPriorities', $event)"
      @update:selected-labels="$emit('update:selectedLabels', $event)"
      @update:selected-assignee-type="$emit('update:selectedAssigneeType', $event)"
      @update:agent-enabled-filter="$emit('update:agentEnabledFilter', $event)"
      @remove-chip="onRemoveChip"
      @clear-filters="$emit('clearFilters')"
      @toggle-selection="$emit('toggleSelection', $event)"
      @toggle-select-all="$emit('toggleSelectAll', $event)"
      @enter-selection-mode="$emit('enterSelectionMode')"
      @exit-selection-mode="$emit('exitSelectionMode')"
      @clear-selection="$emit('clearSelection')"
      @bulk-move="$emit('bulkMove', $event)"
      @bulk-archive="$emit('bulkArchive')"
      @bulk-delete="$emit('bulkDelete')"
    />

    <!-- Filter panel -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <BoardFilterPanel
        v-if="showFilters"
        :statuses="statuses"
        :labels="labels"
        :selected-statuses="selectedStatuses"
        :selected-priorities="selectedPriorities"
        :selected-labels="selectedLabels"
        :selected-assignee-type="selectedAssigneeType"
        :agent-enabled-filter="agentEnabledFilter"
        @update:selected-statuses="$emit('update:selectedStatuses', $event)"
        @update:selected-priorities="$emit('update:selectedPriorities', $event)"
        @update:selected-labels="$emit('update:selectedLabels', $event)"
        @update:selected-assignee-type="$emit('update:selectedAssigneeType', $event)"
        @update:agent-enabled-filter="$emit('update:agentEnabledFilter', $event)"
      />
    </Transition>

    <!-- Filter empty state -->
    <div
      v-if="tasks.length === 0 && totalTaskCount > 0"
      class="flex-1 flex flex-col items-center justify-center px-4"
    >
      <div class="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
        <Icon name="lucide:filter-x" class="w-7 h-7 text-surface-400" />
      </div>
      <h3 class="text-lg font-semibold text-surface-900 mb-1">No tasks match your filters</h3>
      <p class="text-sm text-surface-500 text-center max-w-sm mb-6">
        Try adjusting your filters or clear them to see all tasks.
      </p>
      <button
        class="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors"
        @click="$emit('clearFilters')"
      >
        <Icon name="lucide:x" class="w-3.5 h-3.5 inline mr-1" />
        Clear all filters
      </button>
    </div>

    <!-- Global empty state when no tasks exist at all -->
    <div
      v-else-if="tasks.length === 0 && totalTaskCount === 0"
      class="flex-1 flex flex-col items-center justify-center px-4"
    >
      <div class="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
        <Icon name="lucide:clipboard-list" class="w-7 h-7 text-surface-400" />
      </div>
      <h3 class="text-lg font-semibold text-surface-900 mb-1">No tasks yet</h3>
      <p class="text-sm text-surface-500 text-center max-w-sm mb-2">
        Tasks appear on your kanban board. Create one to get started.
      </p>
      <p class="text-xs text-surface-400 text-center max-w-sm mb-6">
        Or use Auto-Assign to let your AI agent pick up tasks automatically.
      </p>
      <button
        class="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors"
        @click="$emit('createTask')"
      >
        <Icon name="lucide:plus" class="w-3.5 h-3.5 inline mr-1" />
        Create first task
      </button>
    </div>

    <div v-else class="flex-1 overflow-x-auto overflow-y-hidden board-scroll px-3 sm:px-5 pb-4">
      <div class="flex gap-3 h-full min-h-0">
        <KanbanColumn
          v-for="col in columns"
          :key="col.status.id"
          :column="col"
          :is-selection-mode="isSelectionMode"
          :is-task-selected="isTaskSelected"
          @update-task="(data) => $emit('updateTask', data)"
          @create-task="() => $emit('createTask')"
          @open-task="(task) => $emit('openTask', task)"
          @toggle-selection="(taskId) => $emit('toggleSelection', taskId)"
          @toggle-select-all="(taskIds) => $emit('toggleSelectAll', taskIds)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task, Status, Label, TaskPriority } from '~/types'
import { sortTasks, type SortState } from '~/composables/useBoardFilterSort'
import BoardFilterPanel from './BoardFilterPanel.vue'

const props = defineProps<{
  statuses: Status[]
  labels: Label[]
  tasks: Task[]
  viewMode?: 'kanban' | 'table' | 'list'
  sortField?: SortState['field']
  sortDirection?: SortState['direction']
  // Filter state
  searchQuery: string
  showFilters: boolean
  selectedStatuses: string[]
  selectedPriorities: TaskPriority[]
  selectedLabels: string[]
  selectedAssigneeType: 'user' | 'agent' | 'unassigned' | null
  agentEnabledFilter: boolean | null
  activeFilterCount: number
  activeFilterChips: { key: string; label: string; type: 'search' | 'status' | 'priority' | 'label' | 'assigneeType' | 'agentEnabled' | 'archived' }[]
  totalTaskCount: number
  showArchived: boolean
  // Selection state
  isSelectionMode?: boolean
  selectedCount?: number
  isTaskSelected?: (taskId: string) => boolean
}>()

const emit = defineEmits<{
  createTask: []
  autoAssign: [assignments: any[]]
  updateTask: [data: { id: string; statusId: string; position: number }]
  openTask: [task: Task]
  'update:viewMode': [mode: 'kanban' | 'table' | 'list']
  'update:search': [value: string]
  'update:sortField': [field: SortState['field']]
  'update:sortDirection': [direction: SortState['direction']]
  'update:showFilters': [show: boolean]
  'update:showArchived': [show: boolean]
  'update:selectedStatuses': [statuses: string[]]
  'update:selectedPriorities': [priorities: TaskPriority[]]
  'update:selectedLabels': [labels: string[]]
  'update:selectedAssigneeType': [type: 'user' | 'agent' | 'unassigned' | null]
  'update:agentEnabledFilter': [enabled: boolean | null]
  'removeChip': [chip: { key: string; label: string; type: 'search' | 'status' | 'priority' | 'label' | 'assigneeType' | 'agentEnabled' | 'archived' }]
  'clearFilters': []
  toggleSelection: [taskId: string]
  toggleSelectAll: [taskIds: string[]]
  enterSelectionMode: []
  exitSelectionMode: []
  clearSelection: []
  bulkMove: [statusId: string]
  bulkArchive: []
  bulkDelete: []
}>()

function onRemoveChip(chip: { key: string; label: string; type: 'search' | 'status' | 'priority' | 'label' | 'assigneeType' | 'agentEnabled' | 'archived' }) {
  emit('removeChip', chip)
}

const columns = computed(() => {
  return props.statuses.map((status) => {
    const columnTasks = props.tasks.filter((t) => t.statusId === status.id)
    const sortConfig: SortState = {
      field: props.sortField || 'manual',
      direction: props.sortDirection || 'asc',
    }
    return {
      status,
      tasks: sortTasks(columnTasks, sortConfig),
    }
  })
})
</script>
