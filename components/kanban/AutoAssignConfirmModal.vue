<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-assign-title"
        @click.self="handleCancel"
      >
        <!-- Modal -->
        <div
          class="relative w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden animate-scale-in my-auto"
        >
          <!-- Header -->
          <div class="px-6 pt-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0">
                <Icon name="lucide:zap" class="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 id="auto-assign-title" class="text-base font-semibold text-surface-900">
                  Auto-assign tasks
                </h2>
                <p class="text-sm text-surface-500 mt-0.5">
                  Review and confirm the assignments before applying
                </p>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="px-6 pb-2">
            <!-- Summary stats -->
            <div class="flex items-center gap-4 mb-4 p-3 bg-surface-50 rounded-lg">
              <div class="flex items-center gap-2">
                <span class="text-lg font-semibold text-surface-900">{{ selectedCount }}</span>
                <span class="text-sm text-surface-500">of {{ totalCount }} tasks selected</span>
              </div>
              <div class="ml-auto flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-semantic-green" />
                <span class="text-sm text-surface-500">{{ agentGroups.length }} agents</span>
              </div>
            </div>

            <!-- Task list grouped by agent -->
            <div class="max-h-[360px] overflow-y-auto pr-1 space-y-4">
              <div
                v-for="group in agentGroups"
                :key="group.agent.id"
                class="border border-surface-200 rounded-lg overflow-hidden"
              >
                <!-- Agent header -->
                <div class="flex items-center gap-3 px-3 py-2.5 bg-surface-50 border-b border-surface-200">
                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      class="w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent focus:ring-2 cursor-pointer"
                      :checked="isGroupFullySelected(group)"
                      :indeterminate="isGroupPartiallySelected(group)"
                      @change="toggleGroup(group, $event)"
                    >
                    <span
                      class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      :style="{ background: group.agent.color }"
                    >
                      {{ getInitials(group.agent.name) }}
                    </span>
                    <span class="text-sm font-semibold text-surface-900">{{ group.agent.name }}</span>
                    <span class="text-xs text-surface-500 ml-auto">{{ group.selectedCount }}/{{ group.tasks.length }}</span>
                  </label>
                </div>

                <!-- Tasks for this agent -->
                <div class="divide-y divide-surface-100">
                  <div
                    v-for="item in group.tasks"
                    :key="item.task.id"
                    class="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-50 transition-colors"
                  >
                    <input
                      v-model="selectedIds"
                      type="checkbox"
                      class="w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent focus:ring-2 mt-0.5 cursor-pointer"
                      :value="item.task.id"
                    >
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-surface-900 leading-snug line-clamp-2">
                        {{ item.task.title }}
                      </p>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="text-xs text-surface-400">{{ item.fromStatus.name }}</span>
                        <Icon name="lucide:arrow-right" class="w-3 h-3 text-surface-400" />
                        <span class="text-xs font-medium" :style="{ color: item.toStatus.color || '#2563EB' }">
                          {{ item.toStatus.name }}
                        </span>
                      </div>
                    </div>
                    <!-- Agent selector -->
                    <div class="flex-shrink-0">
                      <select
                        :value="item.agent.id"
                        class="text-xs font-medium bg-white border border-surface-200 rounded-lg pl-2 pr-6 py-1 appearance-none cursor-pointer hover:border-surface-300 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                        @change="changeTaskAgent(item.task.id, ($event.target as HTMLSelectElement).value)"
                      >
                        <option
                          v-for="agent in allAgents"
                          :key="agent.id"
                          :value="agent.id"
                        >
                          {{ agent.name }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-200 mt-4">
            <button
              class="px-4 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              @click="handleCancel"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="selectedCount === 0"
              @click="handleConfirm"
            >
              <span v-if="selectedCount > 0">
                Assign {{ selectedCount }} task{{ selectedCount === 1 ? '' : 's' }}
              </span>
              <span v-else>No tasks selected</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Task, Status, Agent } from '~/types'

interface AssignmentItem {
  task: Task
  agent: Agent
  fromStatus: Status
  toStatus: Status
}

interface AgentGroup {
  agent: Agent
  tasks: AssignmentItem[]
  selectedCount: number
}

const props = defineProps<{
  modelValue: boolean
  assignments: AssignmentItem[]
  allAgents: Agent[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [selectedAssignments: AssignmentItem[]]
  cancel: []
}>()

// All task IDs are selected by default
const selectedIds = ref<string[]>([])
// Track which agent each task is assigned to (can be changed by user)
const taskAgentOverrides = ref<Record<string, Agent>>({})

// Reset selection when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    selectedIds.value = props.assignments.map(a => a.task.id)
    taskAgentOverrides.value = {}
  }
})

const resolvedAssignments = computed((): AssignmentItem[] => {
  return props.assignments.map(item => {
    const overrideAgent = taskAgentOverrides.value[item.task.id]
    if (overrideAgent) {
      return { ...item, agent: overrideAgent }
    }
    return item
  })
})

const agentGroups = computed((): AgentGroup[] => {
  const groups = new Map<string, AgentGroup>()

  for (const item of resolvedAssignments.value) {
    const existing = groups.get(item.agent.id)
    if (existing) {
      existing.tasks.push(item)
    } else {
      groups.set(item.agent.id, {
        agent: item.agent,
        tasks: [item],
        selectedCount: 0,
      })
    }
  }

  // Update selected counts
  for (const group of groups.values()) {
    group.selectedCount = group.tasks.filter(t => selectedIds.value.includes(t.task.id)).length
  }

  return Array.from(groups.values())
})

const selectedCount = computed(() => {
  return selectedIds.value.length
})

const totalCount = computed(() => props.assignments.length)

function isGroupFullySelected(group: AgentGroup): boolean {
  return group.tasks.every(t => selectedIds.value.includes(t.task.id))
}

function isGroupPartiallySelected(group: AgentGroup): boolean {
  const selected = group.tasks.filter(t => selectedIds.value.includes(t.task.id)).length
  return selected > 0 && selected < group.tasks.length
}

function toggleGroup(group: AgentGroup, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const ids = group.tasks.map(t => t.task.id)
  if (checked) {
    selectedIds.value = [...new Set([...selectedIds.value, ...ids])]
  } else {
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
  }
}

function changeTaskAgent(taskId: string, agentId: string) {
  const agent = props.allAgents.find(a => a.id === agentId)
  if (agent) {
    taskAgentOverrides.value[taskId] = agent
  }
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function handleCancel() {
  emit('update:modelValue', false)
  emit('cancel')
}

function handleConfirm() {
  const selected = resolvedAssignments.value.filter(a => selectedIds.value.includes(a.task.id))
  emit('update:modelValue', false)
  emit('confirm', selected)
}
</script>
