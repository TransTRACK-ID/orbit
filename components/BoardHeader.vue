<template>
  <div class="flex items-center gap-3 px-3 sm:px-5 py-3.5 border-b border-surface-200 bg-white flex-shrink-0">
    <div class="flex items-center gap-2.5 min-w-0">
      <h2 class="text-sm font-semibold text-surface-900 flex-shrink-0">Board</h2>
      <span class="text-xs text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full flex-shrink-0 font-medium">{{ taskCount }} tasks</span>
    </div>
    <div class="flex items-center gap-1.5 ml-auto">
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
        @click="handleAutoAssign"
      >
        <Icon name="lucide:zap" class="w-3.5 h-3.5" />
        <span class="max-sm:hidden">Auto-Assign</span>
      </button>
      <button
        class="px-2 py-1.5 rounded-lg border border-surface-200 text-xs hover:bg-surface-50 transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:outline-none"
        @click="toggleAgentPanel"
        title="Agents"
      >
        <Icon name="lucide:bot" class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task, Status } from '~/types'

const props = defineProps<{
  statuses: Status[]
  taskCount: number
  viewMode?: 'kanban' | 'table' | 'list'
}>()

const emit = defineEmits<{
  createTask: []
  autoAssign: []
  'update:viewMode': [mode: 'kanban' | 'table' | 'list']
}>()

const { addLog } = useLog()
const route = useRoute()
const { tasks, fetchTasks, updateTask } = useTask()
const { agents, toggleAgentPanel: toggleAgentPanel_ } = useAgent()

function toggleAgentPanel() {
  toggleAgentPanel_()
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
