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
      :show-archived="showArchived"
      :is-selection-mode="isSelectionMode"
      :selected-count="selectedCount"
      @create-task="$emit('createTask')"
      @auto-assign="$emit('autoAssign', $event)"
      @update:view-mode="$emit('update:viewMode', $event)"
      @update:search="$emit('update:search', $event)"
      @update:sort-field="$emit('update:sortField', $event)"
      @update:sort-direction="$emit('update:sortDirection', $event)"
      @update:show-filters="$emit('update:showFilters', $event)"
      @update:show-archived="$emit('update:showArchived', $event)"
      @remove-chip="onRemoveChip"
      @clear-filters="$emit('clearFilters')"
      @enter-selection-mode="$emit('enterSelectionMode')"
      @exit-selection-mode="$emit('exitSelectionMode')"
      @clear-selection="$emit('clearSelection')"
      @bulk-move="(statusId) => $emit('bulkMove', statusId)"
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

    <div class="flex-1 overflow-auto px-3 sm:px-5 pb-4">
      <!-- Filter empty state -->
      <div
        v-if="tasks.length === 0 && totalTaskCount > 0"
        class="flex flex-col items-center justify-center py-16"
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

      <!-- Global empty state -->
      <div v-else-if="tasks.length === 0 && totalTaskCount === 0" class="flex flex-col items-center justify-center py-16">
        <div class="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center mb-3">
          <Icon name="lucide:inbox" class="w-5 h-5 text-surface-400" />
        </div>
        <span class="text-sm font-medium text-surface-600">No tasks yet</span>
        <span class="text-xs text-surface-400 mt-1">Click "New Task" to get started</span>
      </div>

      <div v-else class="divide-y divide-surface-100">
        <div
          v-for="task in sortedTasks"
          :key="task.id"
          class="group flex items-center gap-3 py-2.5 px-2 hover:bg-surface-50 transition-colors cursor-pointer rounded-lg"
          :class="{ 'bg-primary-50': props.isSelectionMode && props.isTaskSelected?.(task.id) }"
          tabindex="0"
          @click="handleRowClick(task)"
          @keydown.enter="handleRowClick(task)"
        >
          <!-- Checkbox -->
          <div v-if="props.isSelectionMode" @click.stop>
            <input
              type="checkbox"
              :checked="props.isTaskSelected?.(task.id)"
              class="w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent cursor-pointer"
              @change="$emit('toggleSelection', task.id)"
            >
          </div>

          <!-- Status dot -->
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: task.status?.color || statuses.find(s => s.id === task.statusId)?.color || '#cbd5e1' }"
          />

          <!-- Title + meta -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-surface-900 truncate" :class="{ 'line-through text-surface-500': task.archived }">{{ task.title }}</span>
              <KanbanPriorityBadge v-if="task.priority !== 'none'" :priority="task.priority" class="flex-shrink-0" />
              <span
                v-if="task.archived"
                class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-200 text-surface-600 flex-shrink-0"
              >
                Archived
              </span>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span
                v-for="label in task.labels?.slice(0, 2)"
                :key="label.id"
                class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                :style="{ backgroundColor: label.color + '18', color: label.color }"
              >
                {{ label.name }}
              </span>
              <span v-if="(task.labels?.length || 0) > 2" class="text-[10px] text-surface-400">+{{ (task.labels?.length || 0) - 2 }}</span>
            </div>
          </div>

          <!-- Agent badge -->
          <div v-if="task.agentEnabled && isAgentInProgress(task)" class="flex items-center gap-1.5 flex-shrink-0">
            <span class="agentic-dot" />
            <span class="text-[10px] font-medium text-primary-600">Agent running</span>
          </div>

          <!-- Assignee -->
          <div class="flex items-center gap-2 flex-shrink-0 w-28 justify-end">
            <div v-if="task.assignee" class="flex items-center gap-1.5">
              <span
                class="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                :style="{ background: task.assignee.color || '#6366F1' }"
                :title="task.assignee.name"
              >
                {{ task.assignee.initials || computedInitials(task.assignee.name) }}
              </span>
              <span class="text-xs text-surface-600 truncate max-w-[80px]">{{ task.assignee.name }}</span>
            </div>
            <Icon v-else-if="task.agentEnabled" name="lucide:bot" class="w-4 h-4 text-surface-400" />
            <span v-else class="text-xs text-surface-400">—</span>
          </div>

          <!-- Due date -->
          <span class="text-xs text-surface-500 flex-shrink-0 w-20 text-right">
            {{ task.dueDate ? formatShortDate(task.dueDate) : '—' }}
          </span>

          <!-- Comments -->
          <span v-if="task._count?.comments" class="flex items-center gap-0.5 text-[10px] text-surface-400 flex-shrink-0 w-8 justify-end">
            <Icon name="lucide:message-square" class="w-3 h-3" />
            {{ task._count.comments }}
          </span>
        </div>
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
  viewMode: 'kanban' | 'table' | 'list'
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

function handleRowClick(task: Task) {
  if (props.isSelectionMode) {
    emit('toggleSelection', task.id)
  } else {
    emit('openTask', task)
  }
}

const sortedTasks = computed(() => {
  const sortConfig: SortState = {
    field: props.sortField || 'manual',
    direction: props.sortDirection || 'asc',
  }

  if (sortConfig.field === 'manual') {
    return [...props.tasks].sort((a, b) => {
      const statusOrderA = props.statuses.findIndex(s => s.id === a.statusId)
      const statusOrderB = props.statuses.findIndex(s => s.id === b.statusId)
      if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB
      return a.position - b.position
    })
  }

  return sortTasks(props.tasks, sortConfig)
})

function isAgentInProgress(task: Task): boolean {
  if (!task.agentEnabled) return false
  if (!task.assignee) return false
  if (!task.status?.name) return false
  return /progress/i.test(task.status.name)
}

function computedInitials(name: string): string {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.agentic-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #22c55e;
  animation: agentic-pulse 1.5s ease-in-out infinite;
}

@keyframes agentic-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
</style>
