<template>
  <div class="kanban-column flex-shrink-0">
    <!-- Column header -->
    <div class="flex items-center justify-between px-3.5 py-2.5 border-b border-surface-200 flex-shrink-0">
      <div class="flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full flex-shrink-0"
          :style="{ backgroundColor: column.status.color }"
        />
        <span class="text-xs font-semibold text-surface-700">{{ column.status.name }}</span>
        <span class="text-[10px] text-surface-500 bg-surface-100 px-1.5 py-0.5 rounded-full font-medium">
          {{ column.tasks.length }}
        </span>
      </div>
    </div>

    <!-- Droppable area -->
    <div
      ref="sortableContainer"
      class="kanban-column-body"
    >
      <KanbanTaskCard
        v-for="task in column.tasks"
        :key="task.id"
        :task="task"
        @click="$emit('openTask', task)"
      />

      <div
        v-if="column.tasks.length === 0"
        class="flex-1 flex flex-col items-center justify-center py-8 text-center"
      >
        <div class="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center mb-2">
          <Icon name="lucide:layout-grid" class="w-4 h-4 text-surface-400" />
        </div>
        <span class="text-[11px] text-surface-400 font-medium">No tasks</span>
        <span class="text-[10px] text-surface-400 mt-0.5">Drop tasks here</span>
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

useSortable(sortableContainer, props.column.tasks, {
  animation: 200,
  delay: 150,
  delayOnTouchOnly: true,
  group: {
    name: 'kanban',
    pull: true,
    put: true,
  },
  ghostClass: 'kanban-card-ghost',
  dragClass: 'kanban-card-dragging',
  onEnd: (evt: any) => {
    // Detect a click (no actual drag movement). SortableJS prevents the
    // native click event by calling preventDefault on mousedown, so we
    // catch click-to-open via onEnd instead.
    if (evt.from === evt.to && evt.oldIndex === evt.newIndex) {
      const taskId = evt.item.dataset?.id
      if (!taskId) return
      const task = props.column.tasks.find(t => t.id === taskId)
      if (task) emit('openTask', task)
      return
    }

    if (evt.from !== evt.to) return
    const taskId = evt.item.dataset?.id
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
    const taskId = evt.item.dataset?.id
    if (!taskId) return
    const tasksInColumn = [...props.column.tasks]
    const newPosition = calculatePosition(tasksInColumn, evt.newIndex)
    emit('updateTask', {
      id: taskId,
      statusId: props.column.status.id,
      position: newPosition,
    })
  },
  onMove: () => true,
})

function calculatePosition(tasks: any[], targetIndex: number): number {
  if (tasks.length === 0) return 1000
  if (targetIndex === 0) return tasks[0]?.position ? tasks[0].position / 2 : 500
  if (targetIndex >= tasks.length) {
    const last = tasks[tasks.length - 1]?.position
    return last ? last + 1000 : tasks.length * 1000 + 1000
  }
  const prev = tasks[targetIndex - 1]?.position || 0
  const next = tasks[targetIndex]?.position || prev + 1000
  return (prev + next) / 2
}
</script>
