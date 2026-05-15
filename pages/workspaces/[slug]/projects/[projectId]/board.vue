<template>
  <div class="h-full flex flex-col relative">
    <UiLoadingState v-if="loading" text="Loading board..." />

    <template v-else-if="project">
      <!-- Repository promo -->
      <RepositoryPromoBanner
        v-if="repositories.length === 0"
        :workspace-id="project.workspaceId"
        :workspace-slug="route.params.slug as string"
        :dismissed-prompts="workspace?.membership?.dismissedPrompts"
        class="mx-4 mt-4"
      />

      <!-- Agent Ready Tooltip -->
      <AgentReadyTooltip
        v-if="showAgentTooltip && tooltipAgent"
        :target-ref="newTaskButtonRef"
        :agent-name="tooltipAgent.name"
        :agent-color="tooltipAgent.color"
        @dismiss="showAgentTooltip = false"
      />

      <KanbanBoard
        :statuses="statuses"
        :tasks="tasks"
        @create-task="handleCreateTask"
        @update-task="handleUpdateTask"
        @open-task="handleOpenTask"
      />
    </template>

    <!-- Task side panel (existing) -->
    <KanbanTaskSidePanel
      v-if="showTaskSidePanel && selectedTask"
      :task-id="selectedTask.id"
      :project-id="project?.id || ''"
      :workspace-id="project?.workspaceId || ''"
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

    <!-- Create task modal -->
    <KanbanTaskCreateModal
      v-if="showCreateModal"
      :statuses="statuses"
      :labels="labels"
      :members="members"
      :agents="agents"
      :repositories="repositories"
      :project-id="project?.id || ''"
      @close="showCreateModal = false"
      @created="handleTaskCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { Task, Status, Label, ProjectMember, Workspace } from '~/types'
import type { Agent } from '~/types'
import { flashHighlight } from '~/composables/useKanban'
import AgentReadyTooltip from '~/components/onboarding/AgentReadyTooltip.vue'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const { tasks, loading, fetchTasks, createTask, updateTask } = useTask()
const { fetchProjectDetail, fetchMembers, projectStatuses, projectLabels } = useProject()
const { agents, fetchAgents } = useAgent()
const { showTaskSidePanel, selectedTask, openTaskDetail, closeTaskDetail } = useKanban()
const { repositories, fetchRepositories } = useRepository()
const { getWorkspaceBySlug } = useWorkspace()

const project = ref<any>(null)
const workspace = ref<Workspace | null>(null)
const statuses = ref<Status[]>([])
const labels = ref<Label[]>([])
const members = ref<ProjectMember[]>([])
const showCreateModal = ref(false)

// --- Agent Tooltip State ---
const newTaskButtonRef = ref<HTMLElement | null>(null)
const showAgentTooltip = ref(false)
const tooltipAgent = ref<{ name: string; color: string } | null>(null)

const { addLog, persistLog } = useLog()
const { startRuntime } = useAgentRuntime()

onMounted(async () => {
  workspace.value = await getWorkspaceBySlug(route.params.slug as string)
  const data = await fetchProjectDetail(projectId.value)
  project.value = data
  statuses.value = data.statuses || []
  labels.value = data.labels || []
  if (statuses.value.length > 0) {
    await fetchTasks(projectId.value)
  }
  members.value = await fetchMembers(projectId.value)
  await fetchAgents()
  if (data.workspaceId) {
    fetchRepositories(data.workspaceId)
  }

  await nextTick()

  const shouldShowFromOnboarding = sessionStorage.getItem('orbit_show_agent_tooltip') === 'true'
  const permanentlyDismissed = localStorage.getItem('orbit_agent_ready_tooltip_dismissed')
  const hasAgents = agents.value && agents.value.length > 0
  const hasTasks = tasks.value && tasks.value.length > 0

  if (shouldShowFromOnboarding && hasAgents && hasTasks && !permanentlyDismissed) {
    tooltipAgent.value = {
      name: agents.value[0].name,
      color: agents.value[0].color || '#6366F1',
    }
    showAgentTooltip.value = true
    // Consume the one-time flag so it doesn't appear on other projects/boards
    sessionStorage.removeItem('orbit_show_agent_tooltip')
  }

  // Find the New Task button for tooltip positioning
  newTaskButtonRef.value = document.querySelector('[data-tooltip-target="new-task"]') as HTMLElement | null
})

function handleCreateTask() {
  showCreateModal.value = true
}

async function handleTaskCreated(task: Task) {
  showCreateModal.value = false
  tasks.value.push(task)
  if (project.value?.workspaceId) {
    persistLog(project.value.workspaceId, { entityType: 'task', entityId: task.id, entityName: task.title, action: 'create', message: `Created task "${task.title}"` })
  }
}

async function handleUpdateTask(data: { id: string; statusId?: string; position?: number; [key: string]: any }) {
  const oldTask = tasks.value.find(t => t.id === data.id)
  const updated = await updateTask(data.id, data)

  if (updated && oldTask && data.statusId && oldTask.statusId !== data.statusId) {
    const newStatus = statuses.value.find(s => s.id === data.statusId)
    const oldStatus = statuses.value.find(s => s.id === oldTask.statusId)
    if (project.value?.workspaceId) {
      persistLog(project.value.workspaceId, { entityType: 'task', entityId: data.id, entityName: updated.title, action: 'status_change', message: `Moved from "${oldStatus?.name || '?'}" to "${newStatus?.name || '?'}"` })
    }
    if (updated.assigneeType === 'agent' && updated.assignee && updated.status?.name && /progress/i.test(updated.status.name)) {
      addLog('Runtime', `Agent "${updated.assignee.name}" started processing "${updated.title}"`, data.id)
      await startRuntime(data.id)
    }
  }

  if (updated && oldTask && (data.assigneeId !== undefined || data.assigneeType !== undefined)) {
    const oldAssigneeType = oldTask.assigneeType
    const newAssigneeType = updated.assigneeType
    if (oldAssigneeType !== 'agent' && newAssigneeType === 'agent' && updated.assignee) {
      addLog('Runtime', `Task "${updated.title}" assigned to agent "${updated.assignee.name}"`, data.id)
    }
  }
}

function handleOpenTask(task: Task) {
  openTaskDetail(task)
}

function handleTaskUpdated(task: Task) {
  const idx = tasks.value.findIndex((t) => t.id === task.id)
  if (idx !== -1) tasks.value[idx] = task
}

function handleTaskDuplicated(task: Task) {
  tasks.value.push(task)
  flashHighlight(task.id)
  if (project.value?.workspaceId) {
    persistLog(project.value.workspaceId, { entityType: 'task', entityId: task.id, entityName: task.title, action: 'duplicate', message: `Duplicated "${task.title}"` })
  }
  closeTaskDetail()
  nextTick(() => openTaskDetail(task))
}

function handleTaskDeleted(taskId: string) {
  tasks.value = tasks.value.filter((t) => t.id !== taskId)
  closeTaskDetail()
}
</script>
