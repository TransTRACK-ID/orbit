<template>
  <div class="kanban-column flex-shrink-0">
    <!-- Column header -->
    <div class="flex items-center justify-between px-1 mb-1">
      <div class="flex items-center gap-2">
        <span
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          :style="{ backgroundColor: column.status.color }"
        />
        <span class="text-sm font-semibold text-surface-700">{{ column.status.name }}</span>
        <span class="text-xs text-surface-400 bg-surface-200/60 px-1.5 py-0.5 rounded-full">
          {{ column.tasks.length }}
        </span>
      </div>
      <button
        class="text-surface-400 hover:text-surface-600 transition-colors"
        @click="handleAddTask"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <!-- Droppable area -->
    <div
      ref="sortableContainer"
      class="flex flex-col gap-2 min-h-[100px] overflow-y-auto"
    >
      <KanbanTaskCard
        v-for="task in column.tasks"
        :key="task.id"
        :task="task"
        @click="$emit('openTask', task)"
      />

      <!-- Empty state -->
      <div
        v-if="column.tasks.length === 0 && !isDraggingOver"
        class="flex-1 flex items-center justify-center py-8"
      >
        <p class="text-xs text-surface-400">Drop tasks here</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import type { KanbanColumn as KanbanColumnType, Task } from '~/types'

const props = defineProps<{
  column: KanbanColumnType
}>()

const emit = defineEmits<{
  updateTask: [data: { id: string; statusId: string; position: number }]
  openTask: [task: Task]
  createTask: []
}>()

const sortableContainer = ref<HTMLElement | null>(null)
const isDraggingOver = ref(false)

// Use sortablejs for drag and drop within the column
useSortable(sortableContainer, props.column.tasks, {
  animation: 200,
  delay: 150,
  delayOnTouchOnly: true,
  group: {
    name: 'kanban',
    pull: true,
    put: true,
  },
  onStart: () => {
    isDraggingOver.value = true
  },
  onEnd: (evt: any) => {
    isDraggingOver.value = false

    const taskId = evt.item.dataset?.taskId
    if (!taskId) return

    const tasksInColumn = [...props.column.tasks]
    const newPosition = calculatePosition(tasksInColumn, evt.newIndex)

    emit('updateTask', {
      id: taskId,
      statusId: props.column.status.id,
      position: newPosition,
    })
  },
  onAdd: (evt: any) => {
    isDraggingOver.value = false

    const taskId = evt.item.dataset?.taskId
    if (!taskId) return

    const tasksInColumn = [...props.column.tasks]
    const newPosition = calculatePosition(tasksInColumn, evt.newIndex)

    emit('updateTask', {
      id: taskId,
      statusId: props.column.status.id,
      position: newPosition,
    })
  },
  // Handle cross-column drag by using onMove instead of relying on group
  onMove: (evt: any) => {
    return true
  },
})

function calculatePosition(tasks: any[], targetIndex: number): number {
  if (tasks.length === 0) return 1000
  if (targetIndex === 0) return tasks[0]?.position ? tasks[0].position / 2 : 500
  if (targetIndex >= tasks.length) return tasks[tasks.length - 1]?.position
    ? tasks[tasks.length - 1].position + 1000
    : tasks.length * 1000 + 1000
  const prev = tasks[targetIndex - 1]?.position || 0
  const next = tasks[targetIndex]?.position || prev + 1000
  return (prev + next) / 2
}

function handleAddTask() {
  emit('createTask')
}
</script>
