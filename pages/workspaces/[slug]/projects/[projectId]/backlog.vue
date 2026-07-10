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
        :members="members"
        :agents="agents"
        :repositories="repositories"
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
        :members="members"
        :agents="agents"
        :repositories="repositories"
        @close="showCreateModal = false"
        @created="handleTaskCreated"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Task, Status, Label, ProjectMember } from '~/types'
import { flashHighlight } from '~/composables/useKanban'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const { tasks, loading, fetchTasks } = useTask()
const { fetchProjectDetail, fetchMembers, projectStatuses, projectLabels } = useProject()
const { agents, fetchAgents } = useAgent()
const { repositories } = useRepository()
const { showTaskSidePanel, selectedTask, openTaskDetail, closeTaskDetail } = useKanban()
const { logs: runtimeLogs, addLog, persistLog } = useLog()

// Track which task IDs have already been advanced to review by the board-level
// watcher, so we don't double-fire if the panel opens and closes quickly.
const boardAdvancedTaskIds = new Set<string>()

// Watch in-memory runtime logs so we can auto-advance agentic tasks to
// "Review" when the agent finishes — even when the TaskSidePanel is closed.
watch(runtimeLogs, async (logs) => {
  if (!logs.length || !statuses.value.length) return
  const reviewStatus = statuses.value.find(s => /review/i.test(s.name))
  if (!reviewStatus) return

  for (const log of logs) {
    if (!/^>?\s*Done$/.test(log.msg)) continue
    const taskId = log.taskId
    if (!taskId) continue
    // Skip if the panel is currently open for this task (it handles its own advancement)
    if (showTaskSidePanel.value && selectedTask.value?.id === taskId) continue
    // Skip if already handled by the board watcher for this completion
    if (boardAdvancedTaskIds.has(taskId)) continue

    const task = tasks.value.find(t => t.id === taskId)
    if (!task || !task.agentEnabled) continue
    // Only advance if not already in review/done
    if (/review/i.test(task.status?.name || '') || /done/i.test(task.status?.name || '')) continue

    boardAdvancedTaskIds.add(taskId)
    try {
      const updated = await $fetch<any>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: { statusId: reviewStatus.id },
      })
      const idx = tasks.value.findIndex(t => t.id === taskId)
      if (idx !== -1) tasks.value[idx] = updated
    } catch {
      // Silently fail — panel will handle it when the user opens the card
    }
  }
}, { deep: false })

const statuses = ref<Status[]>([])
const labels = ref<Label[]>([])
const members = ref<ProjectMember[]>([])
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
  members.value = await fetchMembers(projectId.value)
  await Promise.all([
    fetchTasks(projectId.value),
    fetchAgents(),
  ])
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
  if (selectedTask.value && selectedTask.value.id === task.id) {
    selectedTask.value = task
  }
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
