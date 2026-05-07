<template>
  <div class="page-container">
    <UiLoadingState v-if="loading" text="Loading backlog..." />

    <template v-else>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-surface-900">Backlog</h1>
          <p class="text-sm text-surface-500 mt-1">{{ tasks.length }} tasks</p>
        </div>
        <Button @click="showCreateModal = true">
          <Plus class="w-4 h-4" />
          New Task
        </Button>
      </div>

      <UiEmptyState
        v-if="tasks.length === 0"
        title="Backlog is empty"
        description="Tasks in the backlog status will appear here."
        icon="ph:list-bullets"
      >
        <Button @click="showCreateModal = true">
          <Plus class="w-4 h-4" />
          Create Task
        </Button>
      </UiEmptyState>

      <!-- Task list (simplified) -->
      <div v-else class="space-y-2">
        <div
          v-for="task in sortedTasks"
          :key="task.id"
          class="bg-white rounded-lg border border-surface-200 p-4 cursor-pointer hover:border-primary-200 transition-colors"
          @click="handleOpenTask(task)"
        >
          <div class="flex items-start gap-3">
            <KanbanPriorityBadge :priority="task.priority" />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-surface-900 truncate">{{ task.title }}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <Chip
                  v-if="task.status"
                  :label="task.status.name"
                  :color="task.status.color"
                  size="sm"
                />
                <KanbanLabelChips v-if="task.labels?.length" :labels="task.labels" />
              </div>
            </div>
            <Avatar
              v-if="task.assignee"
              :name="task.assignee.name"
              size="sm"
            />
          </div>
        </div>
      </div>

      <!-- Task side panel -->
      <KanbanTaskSidePanel
        v-if="showTaskSidePanel && selectedTask"
        :task-id="selectedTask.id"
        :project-id="projectId"
        :workspace-id="workspaceId"
        :statuses="statuses"
        :labels="labels"
        @close="closeTaskDetail"
        @updated="handleTaskUpdated"
        @deleted="handleTaskDeleted"
        @duplicated="handleTaskDuplicated"
      />

      <!-- Create modal -->
      <KanbanTaskCreateModal
        v-if="showCreateModal"
        :statuses="statuses"
        :labels="labels"
        :project-id="projectId"
        @close="showCreateModal = false"
        @created="handleTaskCreated"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Task, Status, Label } from '~/types'
import { flashHighlight } from '~/composables/useKanban'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const { tasks, loading, fetchTasks } = useTask()
const { fetchProjectDetail, projectStatuses, projectLabels } = useProject()
const { showTaskSidePanel, selectedTask, openTaskDetail, closeTaskDetail } = useKanban()
const { addLog, persistLog } = useLog()

const statuses = ref<Status[]>([])
const labels = ref<Label[]>([])
const workspaceId = ref('')
const showCreateModal = ref(false)

const sortedTasks = computed(() =>
  [...tasks.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
)

onMounted(async () => {
  const data = await fetchProjectDetail(projectId.value)
  statuses.value = data.statuses || []
  labels.value = data.labels || []
  workspaceId.value = data.workspaceId || ''
  await fetchTasks(projectId.value)
})

function handleOpenTask(task: Task) {
  openTaskDetail(task)
}

function handleTaskCreated(task: Task) {
  showCreateModal.value = false
  tasks.value.push(task)
  if (workspaceId.value) {
    persistLog(workspaceId.value, { entityType: 'task', entityId: task.id, entityName: task.title, action: 'create', message: `Created task "${task.title}"` })
  }
}

function handleTaskUpdated(task: Task) {
  const idx = tasks.value.findIndex((t) => t.id === task.id)
  if (idx !== -1) tasks.value[idx] = task
}

function handleTaskDeleted(taskId: string) {
  tasks.value = tasks.value.filter((t) => t.id !== taskId)
  closeTaskDetail()
}

function handleTaskDuplicated(task: Task) {
  tasks.value.push(task)
  flashHighlight(task.id)
  if (workspaceId.value) {
    persistLog(workspaceId.value, { entityType: 'task', entityId: task.id, entityName: task.title, action: 'duplicate', message: `Duplicated "${task.title}"` })
  }
  closeTaskDetail()
  nextTick(() => openTaskDetail(task))
}
</script>
