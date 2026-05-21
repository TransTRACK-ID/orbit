<template>
  <div class="flex flex-col h-full">
    <BoardHeader
      :statuses="statuses"
      :task-count="tasks.length"
      :view-mode="viewMode"
      @create-task="$emit('createTask')"
      @update:view-mode="$emit('update:viewMode', $event)"
    />

    <!-- Global empty state when no tasks exist -->
    <div
      v-if="tasks.length === 0"
      class="flex-1 flex flex-col items-center justify-center px-4"
    >
      <div class="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
        <Icon name="lucide:clipboard-list" class="w-7 h-7 text-surface-400" />
      </div>
      <h3 class="text-lg font-semibold text-surface-900 mb-1">No tasks yet</h3>
      <p class="text-sm text-surface-500 text-center max-w-sm mb-2">
        Tasks appear on your kanban board. Create one to get started.
      </p>
      <p class="text-xs text-surface-400 text-center max-w-sm mb-6">
        Or use Auto-Assign to let your AI agent pick up tasks automatically.
      </p>
      <button
        class="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors"
        @click="$emit('createTask')"
      >
        <Icon name="lucide:plus" class="w-3.5 h-3.5 inline mr-1" />
        Create first task
      </button>
    </div>

    <div v-else class="flex-1 overflow-x-auto overflow-y-hidden board-scroll px-3 sm:px-5 pb-4">
      <div class="flex gap-3 h-full min-h-0">
        <KanbanColumn
          v-for="col in columns"
          :key="col.status.id"
          :column="col"
          @update-task="(data) => $emit('updateTask', data)"
          @create-task="() => $emit('createTask')"
          @open-task="(task) => $emit('openTask', task)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task, Status } from '~/types'

const props = defineProps<{
  statuses: Status[]
  tasks: Task[]
  viewMode?: 'kanban' | 'table' | 'list'
}>()

const emit = defineEmits<{
  createTask: []
  updateTask: [data: { id: string; statusId: string; position: number }]
  openTask: [task: Task]
  'update:viewMode': [mode: 'kanban' | 'table' | 'list']
}>()

const columns = computed(() => {
  return props.statuses.map((status) => ({
    status,
    tasks: [...props.tasks]
      .filter((t) => t.statusId === status.id)
      .sort((a, b) => a.position - b.position),
  }))
})
</script>
