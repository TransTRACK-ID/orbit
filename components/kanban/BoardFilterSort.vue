<template>
  <div class="border-b border-surface-200 bg-surface-50">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 sm:px-5 py-2">
      <!-- Search -->
      <div class="relative flex-1 max-w-xs">
        <Icon
          name="lucide:search"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter tasks..."
          class="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-surface-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
          @input="emitFilters"
        />
      </div>

      <!-- Sort -->
      <div class="flex items-center gap-1.5">
        <select
          v-model="sortField"
          class="text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer"
          @change="emitSort"
        >
          <option value="manual">Manual</option>
          <option value="priority">Priority</option>
          <option value="createdAt">Created</option>
          <option value="updatedAt">Updated</option>
          <option value="dueDate">Due date</option>
          <option value="title">Title</option>
        </select>
        <button
          class="p-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
          @click="toggleSortDirection"
        >
          <Icon
            :name="sortDirection === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
            class="w-3.5 h-3.5 text-surface-500"
          />
        </button>
      </div>

      <!-- Expand/Collapse Filters -->
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 transition-colors text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        :class="{ 'bg-surface-100': isExpanded }"
        @click="isExpanded = !isExpanded"
      >
        <Icon name="lucide:filter" class="w-3.5 h-3.5" />
        <span class="max-sm:hidden">Filters</span>
        <span
          v-if="activeFilterCount > 0"
          class="ml-0.5 px-1.5 py-0.5 rounded-full bg-accent text-white text-[10px] font-semibold min-w-[18px] text-center"
        >
          {{ activeFilterCount }}
        </span>
        <Icon
          :name="isExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          class="w-3 h-3 text-surface-400"
        />
      </button>
    </div>

    <!-- Expanded Filter Panel -->
    <div
      v-show="isExpanded"
      class="px-3 sm:px-5 pb-3 pt-1 space-y-3"
    >
      <!-- Status -->
      <div class="space-y-1.5">
        <label class="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Status</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="status in statuses"
            :key="status.id"
            class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            :class="selectedStatuses.has(status.id)
              ? 'border-surface-300 bg-surface-100 text-surface-900'
              : 'border-surface-200 bg-white text-surface-500 hover:bg-surface-50'
            "
            @click="toggleStatus(status.id)"
          >
            <span
              class="w-2 h-2 rounded-full flex-shrink-0"
              :style="{ backgroundColor: status.color }"
            />
            {{ status.name }}
          </button>
        </div>
      </div>

      <!-- Priority -->
      <div class="space-y-1.5">
        <label class="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Priority</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="p in priorities"
            :key="p.value"
            class="px-2 py-1 rounded-md text-xs border transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            :class="selectedPriorities.has(p.value)
              ? 'border-surface-300 bg-surface-100 text-surface-900'
              : 'border-surface-200 bg-white text-surface-500 hover:bg-surface-50'
            "
            @click="togglePriority(p.value)"
          >
            <span
              class="inline-block w-2 h-2 rounded-full mr-1"
              :style="{ backgroundColor: p.color }"
            />
            {{ p.label }}
          </button>
        </div>
      </div>

      <!-- Labels -->
      <div v-if="labels.length > 0" class="space-y-1.5">
        <label class="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Labels</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="label in labels"
            :key="label.id"
            class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            :class="selectedLabels.has(label.id)
              ? 'border-surface-300 bg-surface-100 text-surface-900'
              : 'border-surface-200 bg-white text-surface-500 hover:bg-surface-50'
            "
            @click="toggleLabel(label.id)"
          >
            <span
              class="w-2 h-2 rounded-full flex-shrink-0"
              :style="{ backgroundColor: label.color }"
            />
            {{ label.name }}
          </button>
        </div>
      </div>

      <!-- Assignee Type & Agent Enabled -->
      <div class="flex flex-wrap items-start gap-6">
        <!-- Assignee Type -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Assignee</label>
          <div class="flex rounded-lg border border-surface-200 overflow-hidden">
            <button
              v-for="type in assigneeTypes"
              :key="type.value"
              class="px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              :class="selectedAssigneeType === type.value
                ? 'bg-surface-100 text-surface-900 font-medium'
                : 'bg-white text-surface-500 hover:bg-surface-50'
              "
              @click="selectedAssigneeType = selectedAssigneeType === type.value ? null : type.value"
            >
              {{ type.label }}
            </button>
          </div>
        </div>

        <!-- Agent Enabled -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Agent</label>
          <button
            class="flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            :class="agentEnabledFilter === true
              ? 'border-surface-300 bg-surface-100 text-surface-900'
              : agentEnabledFilter === false
                ? 'border-surface-300 bg-surface-100 text-surface-900'
                : 'border-surface-200 bg-white text-surface-500 hover:bg-surface-50'
            "
            @click="cycleAgentEnabled"
          >
            <Icon
              :name="agentEnabledFilter === true ? 'lucide:bot' : agentEnabledFilter === false ? 'lucide:user' : 'lucide:filter'"
              class="w-3.5 h-3.5"
            />
            <span>
              {{ agentEnabledFilter === true ? 'Enabled' : agentEnabledFilter === false ? 'Disabled' : 'Any' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Active Filter Chips -->
      <div v-if="activeFilterChips.length > 0" class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-surface-200">
        <span class="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mr-1">Active</span>
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
          @click="clearAllFilters"
        >
          Clear all
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Status, Label, TaskPriority } from '~/types'

const props = defineProps<{
  statuses: Status[]
  labels: Label[]
}>()

const emit = defineEmits<{
  'update:filters': [filters: FilterState]
  'update:sort': [sort: SortState]
}>()

interface FilterState {
  search: string
  statuses: string[]
  priorities: TaskPriority[]
  labels: string[]
  assigneeType: 'user' | 'agent' | 'unassigned' | null
  agentEnabled: boolean | null
}

interface SortState {
  field: 'manual' | 'priority' | 'createdAt' | 'updatedAt' | 'dueDate' | 'title'
  direction: 'asc' | 'desc'
}

const priorities: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'none', label: 'None', color: '#94a3b8' },
]

const assigneeTypes = [
  { value: 'user' as const, label: 'User' },
  { value: 'agent' as const, label: 'Agent' },
  { value: 'unassigned' as const, label: 'Unassigned' },
]

const isExpanded = ref(false)
const searchQuery = ref('')
const selectedStatuses = ref(new Set<string>())
const selectedPriorities = ref(new Set<TaskPriority>())
const selectedLabels = ref(new Set<string>())
const selectedAssigneeType = ref<'user' | 'agent' | 'unassigned' | null>(null)
const agentEnabledFilter = ref<boolean | null>(null)
const sortField = ref<SortState['field']>('manual')
const sortDirection = ref<SortState['direction']>('asc')

const activeFilterCount = computed(() => {
  let count = 0
  if (searchQuery.value.trim()) count++
  count += selectedStatuses.value.size
  count += selectedPriorities.value.size
  count += selectedLabels.value.size
  if (selectedAssigneeType.value !== null) count++
  if (agentEnabledFilter.value !== null) count++
  return count
})

interface FilterChip {
  key: string
  label: string
  type: 'search' | 'status' | 'priority' | 'label' | 'assigneeType' | 'agentEnabled'
}

const activeFilterChips = computed((): FilterChip[] => {
  const chips: FilterChip[] = []

  if (searchQuery.value.trim()) {
    chips.push({
      key: `search-${searchQuery.value}`,
      label: `Search: "${searchQuery.value}"`,
      type: 'search',
    })
  }

  for (const id of selectedStatuses.value) {
    const status = props.statuses.find(s => s.id === id)
    if (status) {
      chips.push({
        key: `status-${id}`,
        label: `Status: ${status.name}`,
        type: 'status',
      })
    }
  }

  for (const value of selectedPriorities.value) {
    const p = priorities.find(p => p.value === value)
    if (p) {
      chips.push({
        key: `priority-${value}`,
        label: `Priority: ${p.label}`,
        type: 'priority',
      })
    }
  }

  for (const id of selectedLabels.value) {
    const label = props.labels.find(l => l.id === id)
    if (label) {
      chips.push({
        key: `label-${id}`,
        label: `Label: ${label.name}`,
        type: 'label',
      })
    }
  }

  if (selectedAssigneeType.value) {
    const type = assigneeTypes.find(t => t.value === selectedAssigneeType.value)
    if (type) {
      chips.push({
        key: `assignee-${selectedAssigneeType.value}`,
        label: `Assignee: ${type.label}`,
        type: 'assigneeType',
      })
    }
  }

  if (agentEnabledFilter.value !== null) {
    chips.push({
      key: `agent-${agentEnabledFilter.value}`,
      label: agentEnabledFilter.value ? 'Agent: Enabled' : 'Agent: Disabled',
      type: 'agentEnabled',
    })
  }

  return chips
})

function toggleStatus(id: string) {
  if (selectedStatuses.value.has(id)) {
    selectedStatuses.value.delete(id)
  } else {
    selectedStatuses.value.add(id)
  }
  emitFilters()
}

function togglePriority(value: TaskPriority) {
  if (selectedPriorities.value.has(value)) {
    selectedPriorities.value.delete(value)
  } else {
    selectedPriorities.value.add(value)
  }
  emitFilters()
}

function toggleLabel(id: string) {
  if (selectedLabels.value.has(id)) {
    selectedLabels.value.delete(id)
  } else {
    selectedLabels.value.add(id)
  }
  emitFilters()
}

function cycleAgentEnabled() {
  if (agentEnabledFilter.value === null) {
    agentEnabledFilter.value = true
  } else if (agentEnabledFilter.value === true) {
    agentEnabledFilter.value = false
  } else {
    agentEnabledFilter.value = null
  }
  emitFilters()
}

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  emitSort()
}

function removeChip(chip: FilterChip) {
  switch (chip.type) {
    case 'search':
      searchQuery.value = ''
      break
    case 'status': {
      const id = chip.key.replace('status-', '')
      selectedStatuses.value.delete(id)
      break
    }
    case 'priority': {
      const value = chip.key.replace('priority-', '') as TaskPriority
      selectedPriorities.value.delete(value)
      break
    }
    case 'label': {
      const id = chip.key.replace('label-', '')
      selectedLabels.value.delete(id)
      break
    }
    case 'assigneeType':
      selectedAssigneeType.value = null
      break
    case 'agentEnabled':
      agentEnabledFilter.value = null
      break
  }
  emitFilters()
}

function clearAllFilters() {
  searchQuery.value = ''
  selectedStatuses.value.clear()
  selectedPriorities.value.clear()
  selectedLabels.value.clear()
  selectedAssigneeType.value = null
  agentEnabledFilter.value = null
  emitFilters()
}

function emitFilters() {
  emit('update:filters', {
    search: searchQuery.value.trim().toLowerCase(),
    statuses: Array.from(selectedStatuses.value),
    priorities: Array.from(selectedPriorities.value),
    labels: Array.from(selectedLabels.value),
    assigneeType: selectedAssigneeType.value,
    agentEnabled: agentEnabledFilter.value,
  })
}

function emitSort() {
  emit('update:sort', {
    field: sortField.value,
    direction: sortDirection.value,
  })
}

// Expose methods for parent to restore state
function getState() {
  return {
    filters: {
      search: searchQuery.value,
      statuses: Array.from(selectedStatuses.value),
      priorities: Array.from(selectedPriorities.value),
      labels: Array.from(selectedLabels.value),
      assigneeType: selectedAssigneeType.value,
      agentEnabled: agentEnabledFilter.value,
    },
    sort: {
      field: sortField.value,
      direction: sortDirection.value,
    },
    expanded: isExpanded.value,
  }
}

function setState(state: {
  filters?: Partial<FilterState>
  sort?: Partial<SortState>
  expanded?: boolean
}) {
  if (state.filters) {
    searchQuery.value = state.filters.search || ''
    selectedStatuses.value = new Set(state.filters.statuses || [])
    selectedPriorities.value = new Set(state.filters.priorities || [])
    selectedLabels.value = new Set(state.filters.labels || [])
    selectedAssigneeType.value = state.filters.assigneeType || null
    agentEnabledFilter.value = state.filters.agentEnabled ?? null
  }
  if (state.sort) {
    sortField.value = state.sort.field || 'manual'
    sortDirection.value = state.sort.direction || 'asc'
  }
  if (state.expanded !== undefined) {
    isExpanded.value = state.expanded
  }
}

defineExpose({ getState, setState })
</script>
