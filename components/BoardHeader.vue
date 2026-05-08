<template>
  <div class="flex items-center gap-3 px-5 py-3.5 border-b border-surface-200 bg-white flex-shrink-0">
    <div class="flex items-center gap-2.5">
      <h2 class="text-sm font-semibold text-surface-900">Board</h2>
      <span class="text-[10px] text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full">{{ taskCount }} tasks</span>
    </div>
    <div class="flex items-center gap-1.5 ml-auto">
      <button
        class="px-3 py-1.5 rounded-lg border border-surface-200 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-surface-50 transition-colors"
        @click="$emit('createTask')"
      >
        <Icon name="lucide:plus" class="w-3 h-3" />
        <span class="max-sm:hidden">New Task</span>
      </button>
      <button
        class="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-semibold flex items-center gap-1.5 hover:bg-accent-hover transition-colors"
        @click="handleAutoAssign"
      >
        <Icon name="lucide:zap" class="w-3 h-3" />
        <span class="max-sm:hidden">Auto-Assign</span>
      </button>
      <button
        class="px-2 py-1.5 rounded-lg border border-surface-200 text-[11px] hover:bg-surface-50 transition-colors max-sm:flex"
        @click="toggleAgentPanel"
        title="Agents"
      >
        <Icon name="lucide:bot" class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '~/types'

const props = defineProps<{
  statuses: any[]
  taskCount: number
}>()

const emit = defineEmits<{
  createTask: []
  autoAssign: []
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

  const progressStatus = props.statuses.find((s: any) => /progress/i.test(s.name))
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
