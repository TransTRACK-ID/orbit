<template>
  <div class="flex flex-col h-full">
    <BoardHeader
      :statuses="statuses"
      :task-count="tasks.length"
      :view-mode="viewMode"
      @create-task="$emit('createTask')"
      @update:view-mode="$emit('update:viewMode', $event)"
    />

    <div class="flex-1 overflow-x-auto overflow-y-hidden board-scroll px-3 sm:px-5 pb-4">
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
  viewMode?: 'kanban' | 'table'
}>()

const emit = defineEmits<{
  createTask: []
  updateTask: [data: { id: string; statusId: string; position: number }]
  openTask: [task: Task]
  'update:viewMode': [mode: 'kanban' | 'table']
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
