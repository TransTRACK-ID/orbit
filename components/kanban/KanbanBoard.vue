<template>
  <div class="flex flex-col h-full">
    <BoardHeader
      :statuses="statuses"
      :task-count="tasks.length"
      @create-task="$emit('createTask')"
    />

    <div class="flex-1 overflow-x-auto board-scroll px-5 pb-4">
      <div class="flex gap-3.5 h-full min-h-0">
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
}>()

const emit = defineEmits<{
  createTask: []
  updateTask: [data: { id: string; statusId: string; position: number }]
  openTask: [task: Task]
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
