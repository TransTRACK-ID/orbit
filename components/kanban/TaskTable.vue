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
      <table class="w-full text-left border-collapse">
        <thead class="sticky top-0 z-10 bg-white">
          <tr class="border-b border-surface-200">
            <th class="py-2.5 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-32">
              Status
            </th>
            <th class="py-2.5 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-16">
              ID
            </th>
            <th class="py-2.5 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider min-w-[200px]">
              Title
            </th>
            <th class="py-2.5 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-36">
              Assignee
            </th>
            <th class="py-2.5 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-24">
              Priority
            </th>
            <th class="py-2.5 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-28">
              Due Date
            </th>
            <th class="py-2.5 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-28">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in sortedTasks"
            :key="task.id"
            class="border-b border-surface-100 hover:bg-surface-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-surface-100"
            tabindex="0"
            @click="$emit('openTask', task)"
            @keydown.enter="$emit('openTask', task)"
          >
            <!-- Status -->
            <td class="py-2.5 px-3" @click.stop>
              <div class="flex items-center gap-2">
                <span
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: task.status?.color || statuses.find(s => s.id === task.statusId)?.color || '#cbd5e1' }"
                />
                <select
                  class="text-xs font-medium text-surface-700 bg-transparent border border-transparent rounded px-1 py-0.5 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 cursor-pointer hover:text-surface-900 transition-colors"
                  :value="task.statusId"
                  @change="handleStatusChange(task.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="status in statuses"
                    :key="status.id"
                    :value="status.id"
                  >
                    {{ status.name }}
                  </option>
                </select>
              </div>
            </td>

            <!-- ID -->
            <td class="py-2.5 px-3">
              <span class="text-xs font-mono text-surface-400">#{{ task.id.slice(0, 6) }}</span>
            </td>

            <!-- Title -->
            <td class="py-2.5 px-3">
              <div class="text-xs font-semibold text-surface-900 leading-snug" v-html="formatTitle(task.title)" />
            </td>

            <!-- Assignee -->
            <td class="py-2.5 px-3">
              <div v-if="task.assignee" class="flex items-center gap-2">
                <span
                  class="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                  :style="{ background: task.assignee.color || '#6366F1' }"
                  :title="task.assignee.name"
                >
                  {{ task.assignee.initials || computedInitials(task.assignee.name) }}
                </span>
                <span class="text-xs text-surface-600">{{ task.assignee.name }}</span>
              </div>
              <span v-else class="text-xs text-surface-400">—</span>
            </td>

            <!-- Priority -->
            <td class="py-2.5 px-3">
              <KanbanPriorityBadge v-if="task.priority !== 'none'" :priority="task.priority" />
              <span v-else class="text-xs text-surface-400">—</span>
            </td>

            <!-- Due Date -->
            <td class="py-2.5 px-3">
              <span class="text-xs text-surface-500">
                {{ task.dueDate ? formatDate(task.dueDate) : '—' }}
              </span>
            </td>

            <!-- Updated -->
            <td class="py-2.5 px-3">
              <span class="text-xs text-surface-500" :title="task.updatedAt">
                {{ relativeTime(task.updatedAt) }}
              </span>
            </td>
          </tr>

          <tr v-if="tasks.length === 0">
            <td colspan="7" class="py-8 text-center">
              <div class="flex flex-col items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center">
                  <Icon name="lucide:inbox" class="w-4 h-4 text-surface-400" />
                </div>
                <span class="text-xs text-surface-500 font-medium">No tasks yet</span>
                <span class="text-[11px] text-surface-400">Click "New Task" to get started</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task, Status } from '~/types'

const props = defineProps<{
  statuses: Status[]
  tasks: Task[]
  viewMode: 'kanban' | 'table'
}>()

const emit = defineEmits<{
  createTask: []
  updateTask: [data: { id: string; statusId: string; position: number }]
  openTask: [task: Task]
  'update:viewMode': [mode: 'kanban' | 'table']
}>()

const sortedTasks = computed(() => {
  return [...props.tasks].sort((a, b) => {
    const statusOrderA = props.statuses.findIndex(s => s.id === a.statusId)
    const statusOrderB = props.statuses.findIndex(s => s.id === b.statusId)
    if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB
    return a.position - b.position
  })
})

function handleStatusChange(taskId: string, statusId: string) {
  const tasksInStatus = props.tasks.filter(t => t.statusId === statusId)
  const newPosition = tasksInStatus.length > 0
    ? Math.max(...tasksInStatus.map(t => t.position)) + 1000
    : 1000

  emit('updateTask', { id: taskId, statusId, position: newPosition })
}

function formatTitle(title: string): string {
  return title.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-surface-100 text-surface-700 text-[10px] font-mono border border-surface-200">$1</code>')
}

function computedInitials(name: string): string {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function relativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHour < 24) return `${diffHour} hr ago`
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`

  return formatDate(dateString)
}
</script>
