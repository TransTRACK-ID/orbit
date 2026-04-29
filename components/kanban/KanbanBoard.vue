<template>
  <div class="flex flex-col h-full">
    <!-- Board header -->
    <KanbanBoardHeader
      :statuses="statuses"
      :task-count="tasks.length"
      @create-task="$emit('createTask')"
      @view-backlog="router.push(`/workspaces/${route.params.slug}/projects/${route.params.projectId}/backlog`)"
    />

    <!-- Board columns -->
    <div class="flex-1 overflow-x-auto board-scroll px-6 pb-6">
      <div class="flex gap-4 h-full min-h-0">
        <KanbanColumn
          v-for="column in columns"
          :key="column.status.id"
          :column="column"
          @update-task="handleUpdateTask"
          @create-task="() => $emit('createTask')"
          @open-task="(task) => $emit('openTask', task)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task, Status } from '~/types'
import { useSortable } from '@vueuse/integrations/useSortable'

const props = defineProps<{
  statuses: Status[]
  tasks: Task[]
}>()

const emit = defineEmits<{
  createTask: []
  updateTask: [data: { id: string; statusId: string; position: number }]
  openTask: [task: Task]
}>()

const route = useRoute()
const router = useRouter()

const columns = computed(() => {
  return props.statuses.map((status) => ({
    status,
    tasks: [...props.tasks]
      .filter((t) => t.statusId === status.id)
      .sort((a, b) => a.position - b.position),
  }))
})

function handleUpdateTask(data: { id: string; statusId: string; position: number }) {
  emit('updateTask', data)
}
</script>
