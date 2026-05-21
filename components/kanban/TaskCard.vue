<template>
  <div
    class="kanban-card"
    :class="{ agentic: isAgentRunning, highlighted: isHighlighted }"
    :data-id="task.id"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <!-- Top: Labels + Priority -->
    <div class="flex items-center gap-1.5 mb-1.5">
      <span
        v-for="label in visibleLabels"
        :key="label.id"
        class="px-1.5 py-0.5 rounded text-[10px] font-medium"
        :style="{ backgroundColor: label.color + '18', color: label.color }"
      >
        {{ label.name }}
      </span>
      <KanbanPriorityBadge
        v-if="task.priority && task.priority !== 'none'"
        :priority="task.priority"
        class="ml-auto"
      />
    </div>

    <!-- Title -->
    <h4 class="text-sm font-semibold text-surface-900 leading-snug mb-1 line-clamp-2">
      {{ task.title }}
    </h4>

    <!-- Description (optional, 1 line max) -->
    <p
      v-if="task.description"
      class="text-xs text-surface-500 leading-snug mb-2 line-clamp-1"
    >
      {{ stripMarkdown(task.description) }}
    </p>

    <!-- Agent badge (only when running) -->
    <div v-if="task.agentEnabled && isAgentRunning" class="flex items-center gap-1.5 mb-2">
      <span class="agentic-badge">
        <span class="agentic-dot" />
        <span class="text-[10px] font-medium text-primary-600">Agent running</span>
      </span>
    </div>

    <!-- Footer: Meta + Assignee -->
    <div class="flex items-center gap-2 text-[10px] text-surface-400 mt-auto">
      <span v-if="task.dueDate" class="flex items-center gap-1">
        <Icon name="lucide:calendar" class="w-3 h-3" />
        {{ formatShortDate(task.dueDate) }}
      </span>
      <span v-if="task._count?.comments" class="flex items-center gap-1">
        <Icon name="lucide:message-square" class="w-3 h-3" />
        {{ task._count.comments }}
      </span>

      <span class="ml-auto" />

      <!-- Human assignee always shown if exists -->
      <span
        v-if="task.assignee"
        class="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
        :style="{ background: task.assignee.color || '#6366F1' }"
        :title="resolveAgentName(task.assignee.name, task.assigneeId, task.assigneeType)"
      >
        {{ task.assignee.initials || computedInitials(task.assignee.name) }}
      </span>

      <!-- Bot icon only if agent enabled but idle -->
      <Icon v-else-if="task.agentEnabled" name="lucide:bot" class="w-4 h-4 text-surface-400" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '~/types'
import { highlightedTaskId } from '~/composables/useKanban'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  click: []
}>()

const { agents } = useAgent()
const isHighlighted = computed(() => highlightedTaskId.value === props.task.id)

const visibleLabels = computed(() => props.task.labels?.slice(0, 2) || [])

const isAgentRunning = computed(() => {
  if (!props.task.agentEnabled) return false
  if (!props.task.assignee) return false
  if (!props.task.status?.name) return false
  return /progress/i.test(props.task.status.name)
})

/** Pointer position when the user pressed down — used to distinguish a click
 *  from a drag. SortableJS prevents native `click` events on draggable items
 *  (via preventDefault on mousedown), so we detect clicks manually. */
const pointerStart = { x: 0, y: 0 }

function onPointerDown(e: PointerEvent) {
  pointerStart.x = e.clientX
  pointerStart.y = e.clientY
}

function onPointerUp(e: PointerEvent) {
  const dx = Math.abs(e.clientX - pointerStart.x)
  const dy = Math.abs(e.clientY - pointerStart.y)
  // If the pointer barely moved (< 8px), treat it as a click, not a drag
  if (dx < 8 && dy < 8) {
    emit('click')
  }
}

function resolveAgentName(name: string, assigneeId: string | null, assigneeType: string | null | undefined) {
  if (assigneeType === 'agent' && assigneeId) {
    const agent = agents.value.find(a => a.id === assigneeId)
    if (agent) return agent.name
  }
  return name
}

function computedInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
}

function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/[*_~`#>-]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.kanban-card.highlighted {
  animation: highlight-pulse 3s ease-out;
  outline: 2px solid #22c55e;
  outline-offset: 1px;
}

@keyframes highlight-pulse {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
</style>
