<template>
  <div class="flex flex-col h-full">
    <BoardHeader
      :statuses="statuses"
      :task-count="tasks.length"
      :view-mode="viewMode"
      @create-task="$emit('createTask')"
      @update:view-mode="$emit('update:viewMode', $event)"
    />

    <div class="flex-1 overflow-auto px-3 sm:px-5 pb-4">
      <div v-if="tasks.length === 0" class="flex flex-col items-center justify-center py-16">
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
          tabindex="0"
          @click="$emit('openTask', task)"
          @keydown.enter="$emit('openTask', task)"
        >
          <!-- Status dot -->
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: task.status?.color || statuses.find(s => s.id === task.statusId)?.color || '#cbd5e1' }"
          />

          <!-- Title + meta -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-surface-900 truncate">{{ task.title }}</span>
              <KanbanPriorityBadge v-if="task.priority !== 'none'" :priority="task.priority" class="flex-shrink-0" />
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
import type { Task, Status } from '~/types'

const props = defineProps<{
  statuses: Status[]
  tasks: Task[]
  viewMode: 'kanban' | 'table' | 'list'
}>()

const emit = defineEmits<{
  createTask: []
  updateTask: [data: { id: string; statusId: string; position: number }]
  openTask: [task: Task]
  'update:viewMode': [mode: 'kanban' | 'table' | 'list']
}>()

const sortedTasks = computed(() => {
  return [...props.tasks].sort((a, b) => {
    const statusOrderA = props.statuses.findIndex(s => s.id === a.statusId)
    const statusOrderB = props.statuses.findIndex(s => s.id === b.statusId)
    if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB
    return a.position - b.position
  })
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
