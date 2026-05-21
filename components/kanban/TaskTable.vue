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
        <thead class="sticky top-0 z-10 bg-surface-50">
          <tr class="border-b border-surface-200">
            <th class="py-3 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-36">
              Status
            </th>
            <th class="py-3 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider min-w-[220px]">
              Title
            </th>
            <th class="py-3 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-40">
              Labels
            </th>
            <th class="py-3 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-32">
              Assignee
            </th>
            <th class="py-3 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-24">
              Priority
            </th>
            <th class="py-3 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-28">
              Due Date
            </th>
            <th class="py-3 px-3 text-[11px] font-semibold text-surface-500 uppercase tracking-wider w-28">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in sortedTasks"
            :key="task.id"
            class="border-b border-surface-100 hover:bg-surface-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-surface-100 group"
            tabindex="0"
            @click="$emit('openTask', task)"
            @keydown.enter="$emit('openTask', task)"
          >
            <!-- Status -->
            <td class="py-3 px-3" @click.stop>
              <div class="flex items-center gap-2">
                <span
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: task.status?.color || statuses.find(s => s.id === task.statusId)?.color || '#cbd5e1' }"
                />
                <div class="relative">
                  <select
                    :value="task.statusId"
                    class="text-xs font-medium text-surface-700 bg-white border border-surface-200 rounded-lg pl-2 pr-6 py-1 appearance-none cursor-pointer hover:border-surface-300 hover:bg-surface-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
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
                  <Icon
                    name="lucide:chevron-down"
                    class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none"
                  />
                </div>
              </div>
              <!-- Agentic indicator -->
              <div v-if="isAgentInProgress(task)" class="flex items-center gap-1.5 mt-1">
                <span class="agentic-dot" />
                <span class="text-[10px] font-medium text-primary-600">Agentic</span>
              </div>
            </td>

            <!-- Title -->
            <td class="py-3 px-3">
              <div class="text-xs font-semibold text-surface-900 leading-snug flex items-start gap-1.5">
                <span class="line-clamp-2 flex-1">
                  <template v-for="(segment, idx) in parseTitle(task.title)" :key="idx">
                    <code
                      v-if="segment.type === 'code'"
                      class="px-1 py-0.5 rounded bg-surface-100 text-surface-700 text-[10px] font-mono border border-surface-200"
                    >
                      {{ segment.text }}
                    </code>
                    <template v-else>{{ segment.text }}</template>
                  </template>
                </span>
                <span
                  v-if="task._count?.comments"
                  class="flex items-center gap-0.5 text-[10px] text-surface-400 flex-shrink-0 mt-0.5"
                  :title="`${task._count.comments} comment${task._count.comments === 1 ? '' : 's'}`"
                >
                  <Icon name="lucide:message-square" class="w-3 h-3" />
                  {{ task._count.comments }}
                </span>
              </div>
            </td>

            <!-- Labels -->
            <td class="py-3 px-3" @click.stop>
              <div v-if="task.labels && task.labels.length > 0" class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-for="label in task.labels.slice(0, 3)"
                  :key="label.id"
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  :style="{ backgroundColor: label.color + '18', color: label.color }"
                >
                  {{ label.name }}
                </span>
                <span v-if="task.labels.length > 3" class="text-[10px] text-surface-400">
                  +{{ task.labels.length - 3 }}
                </span>
              </div>
              <span v-else class="text-xs text-surface-400">—</span>
            </td>

            <!-- Assignee -->
            <td class="py-3 px-3">
              <div v-if="task.assignee" class="flex items-center gap-2">
                <span
                  class="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                  :style="{ background: task.assignee.color || '#6366F1' }"
                  :title="task.assignee.name"
                >
                  {{ task.assignee.initials || computedInitials(task.assignee.name) }}
                </span>
                <span class="text-xs text-surface-700">{{ task.assignee.name }}</span>
              </div>
              <span v-else class="text-xs text-surface-400">—</span>
            </td>

            <!-- Priority -->
            <td class="py-3 px-3">
              <KanbanPriorityBadge v-if="task.priority !== 'none'" :priority="task.priority" />
              <span v-else class="text-xs text-surface-400">—</span>
            </td>

            <!-- Due Date -->
            <td class="py-3 px-3">
              <span class="text-xs text-surface-500">
                {{ task.dueDate ? formatDate(task.dueDate) : '—' }}
              </span>
            </td>

            <!-- Updated -->
            <td class="py-3 px-3">
              <span class="text-xs text-surface-500" :title="task.updatedAt">
                {{ relativeTime(task.updatedAt) }}
              </span>
            </td>
          </tr>

          <tr v-if="tasks.length === 0">
            <td colspan="7" class="py-12 text-center">
              <div class="flex flex-col items-center gap-2.5">
                <div class="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center">
                  <Icon name="lucide:inbox" class="w-5 h-5 text-surface-400" />
                </div>
                <span class="text-sm font-medium text-surface-600">No tasks yet</span>
                <span class="text-xs text-surface-400">Click "New Task" to get started</span>
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
  if (task.assigneeType !== 'agent') return false
  if (!task.assignee) return false
  if (!task.status?.name) return false
  return /progress/i.test(task.status.name)
}

function handleStatusChange(taskId: string, statusId: string) {
  const tasksInStatus = props.tasks.filter(t => t.statusId === statusId)
  const newPosition = tasksInStatus.length > 0
    ? Math.max(...tasksInStatus.map(t => t.position)) + 1000
    : 1000

  emit('updateTask', { id: taskId, statusId, position: newPosition })
}

interface TitleSegment {
  type: 'text' | 'code'
  text: string
}

function parseTitle(title: string): TitleSegment[] {
  const segments: TitleSegment[] = []
  const regex = /`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(title)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: title.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'code', text: match[1] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < title.length) {
    segments.push({ type: 'text', text: title.slice(lastIndex) })
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', text: title })
  }

  return segments
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
