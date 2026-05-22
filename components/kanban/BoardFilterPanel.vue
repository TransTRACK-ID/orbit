<template>
  <div class="px-3 sm:px-5 py-3 space-y-3 bg-surface-50 border-b border-surface-200">
    <!-- Status -->
    <div class="space-y-1.5">
      <label class="text-xs font-semibold text-surface-500">Status</label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="status in statuses"
          :key="status.id"
          class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          :class="selectedStatuses.includes(status.id)
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
      <label class="text-xs font-semibold text-surface-500">Priority</label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="p in priorities"
          :key="p.value"
          class="px-2 py-1 rounded-md text-xs border cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          :class="selectedPriorities.includes(p.value)
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
      <label class="text-xs font-semibold text-surface-500">Labels</label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="label in labels"
          :key="label.id"
          class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          :class="selectedLabels.includes(label.id)
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
        <label class="text-xs font-semibold text-surface-500">Assignee</label>
        <div class="flex rounded-lg border border-surface-200 overflow-hidden">
          <button
            v-for="type in assigneeTypes"
            :key="type.value"
          class="px-3 py-1 text-xs cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          :class="selectedAssigneeType === type.value
            ? 'bg-surface-100 text-surface-900 font-medium'
            : 'bg-white text-surface-500 hover:bg-surface-50'
          "
          @click="toggleAssigneeType(type.value)"
          >
            {{ type.label }}
          </button>
        </div>
      </div>

      <!-- Agent Enabled -->
      <div class="space-y-1.5">
        <label class="text-xs font-semibold text-surface-500">Agent</label>
        <button
          class="flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
  </div>
</template>

<script setup lang="ts">
import type { Status, Label, TaskPriority } from '~/types'

const props = defineProps<{
  statuses: Status[]
  labels: Label[]
  selectedStatuses: string[]
  selectedPriorities: TaskPriority[]
  selectedLabels: string[]
  selectedAssigneeType: 'user' | 'agent' | 'unassigned' | null
  agentEnabledFilter: boolean | null
}>()

const emit = defineEmits<{
  'update:selectedStatuses': [statuses: string[]]
  'update:selectedPriorities': [priorities: TaskPriority[]]
  'update:selectedLabels': [labels: string[]]
  'update:selectedAssigneeType': [type: 'user' | 'agent' | 'unassigned' | null]
  'update:agentEnabledFilter': [enabled: boolean | null]
}>()

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

function toggleStatus(id: string) {
  const next = props.selectedStatuses.includes(id)
    ? props.selectedStatuses.filter(s => s !== id)
    : [...props.selectedStatuses, id]
  emit('update:selectedStatuses', next)
}

function togglePriority(value: TaskPriority) {
  const next = props.selectedPriorities.includes(value)
    ? props.selectedPriorities.filter(p => p !== value)
    : [...props.selectedPriorities, value]
  emit('update:selectedPriorities', next)
}

function toggleLabel(id: string) {
  const next = props.selectedLabels.includes(id)
    ? props.selectedLabels.filter(l => l !== id)
    : [...props.selectedLabels, id]
  emit('update:selectedLabels', next)
}

function toggleAssigneeType(value: 'user' | 'agent' | 'unassigned') {
  const next = props.selectedAssigneeType === value ? null : value
  emit('update:selectedAssigneeType', next)
}

function cycleAgentEnabled() {
  let next: boolean | null
  if (props.agentEnabledFilter === null) {
    next = true
  } else if (props.agentEnabledFilter === true) {
    next = false
  } else {
    next = null
  }
  emit('update:agentEnabledFilter', next)
}
</script>
