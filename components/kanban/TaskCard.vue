<template>
  <div
    class="kanban-card"
    :class="{ agentic: isAgentInProgress, highlighted: isHighlighted }"
    :data-id="task.id"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <!-- Priority badge -->
    <KanbanPriorityBadge
      v-if="task.priority && task.priority !== 'none'"
      :priority="task.priority"
      class="mb-1.5"
    />

    <!-- Title -->
    <div class="text-xs font-semibold leading-snug mb-0.5 text-surface-900 line-clamp-2">
      {{ task.title }}
    </div>

    <!-- Description -->
    <div v-if="task.description" class="text-[11px] text-surface-500 leading-snug mb-2 line-clamp-2">
      {{ task.description }}
    </div>

    <!-- Agentic In Progress badge -->
    <div v-if="isAgentInProgress" class="flex items-center gap-1.5 mb-1.5">
      <span class="agentic-badge">
        <span class="agentic-dot" />
        <span>Agentic · {{ resolveAgentName(task.assignee?.name || '', task.assigneeId, task.assigneeType) }}</span>
      </span>
    </div>

    <!-- Footer -->
    <div class="flex items-center gap-2 text-[10px] text-surface-500">
      <!-- Labels (first 2) -->
      <template v-if="task.labels && task.labels.length > 0">
        <span
          v-for="label in task.labels.slice(0, 2)"
          :key="label.id"
          class="px-1.5 py-0.5 rounded text-[10px] font-medium"
          :style="{ backgroundColor: label.color + '18', color: label.color }"
        >
          {{ label.name }}
        </span>
      </template>

      <!-- Comments -->
      <span v-if="task._count?.comments" class="flex items-center gap-0.5 ml-auto">
        <Icon name="lucide:message-square" class="w-3 h-3" />
        {{ task._count.comments }}
      </span>

      <!-- Spacer when no comments to push assignee right -->
      <span v-else class="ml-auto" />

      <!-- Assignee -->
      <span
        v-if="task.assignee"
        class="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
        :style="{ background: task.assignee.color || '#6366F1' }"
        :title="resolveAgentName(task.assignee.name, task.assigneeId, task.assigneeType)"
      >
        {{ task.assignee.initials || computedInitials(task.assignee.name) }}
      </span>
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

const isAgentInProgress = computed(() => {
  return (
    props.task.assigneeType === 'agent' &&
    props.task.assignee &&
    props.task.status?.name &&
    /progress/i.test(props.task.status.name)
  )
})

function computedInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
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
