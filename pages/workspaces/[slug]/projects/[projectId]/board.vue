<template>
  <div class="h-full flex flex-col relative">
    <UiLoadingState v-if="loading" text="Loading board..." />

    <template v-else-if="project">
      <!-- Repository promo -->
      <WorkspaceRepositoryPromoBanner
        v-if="showRepoBanner"
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

      <KeepAlive>
        <KanbanBoard
          v-if="viewMode === 'kanban'"
          :statuses="statuses"
          :labels="labels"
          :tasks="filteredTasks"
          :view-mode="viewMode"
          :sort-field="sort.field"
          :sort-direction="sort.direction"
          :search-query="filters.search"
          :show-filters="showFilters"
          :selected-statuses="filters.statuses"
          :selected-priorities="filters.priorities"
          :selected-labels="filters.labels"
          :selected-assignee-type="filters.assigneeType"
          :agent-enabled-filter="filters.agentEnabled"
          :active-filter-count="activeFilterCount"
          :active-filter-chips="activeFilterChips"
          :total-task-count="tasks.length"
          @update:view-mode="viewMode = $event"
          @create-task="handleCreateTask"
          @update-task="handleUpdateTask"
          @open-task="handleOpenTask"
          @update:search="handleSearchUpdate"
          @update:sort-field="handleSortFieldUpdate"
          @update:sort-direction="handleSortDirectionUpdate"
          @update:show-filters="showFilters = $event"
          @update:selected-statuses="handleStatusesUpdate"
          @update:selected-priorities="handlePrioritiesUpdate"
          @update:selected-labels="handleLabelsUpdate"
          @update:selected-assignee-type="handleAssigneeTypeUpdate"
          @update:agent-enabled-filter="handleAgentEnabledUpdate"
          @remove-chip="handleRemoveChip"
          @clear-filters="clearAllFilters"
        />
        <KanbanTaskTable
          v-else-if="viewMode === 'table'"
          :statuses="statuses"
          :labels="labels"
          :tasks="filteredTasks"
          :view-mode="viewMode"
          :sort-field="sort.field"
          :sort-direction="sort.direction"
          :search-query="filters.search"
          :show-filters="showFilters"
          :selected-statuses="filters.statuses"
          :selected-priorities="filters.priorities"
          :selected-labels="filters.labels"
          :selected-assignee-type="filters.assigneeType"
          :agent-enabled-filter="filters.agentEnabled"
          :active-filter-count="activeFilterCount"
          :active-filter-chips="activeFilterChips"
          :total-task-count="tasks.length"
          @update:view-mode="viewMode = $event"
          @create-task="handleCreateTask"
          @update-task="handleUpdateTask"
          @open-task="handleOpenTask"
          @update:search="handleSearchUpdate"
          @update:sort-field="handleSortFieldUpdate"
          @update:sort-direction="handleSortDirectionUpdate"
          @update:show-filters="showFilters = $event"
          @update:selected-statuses="handleStatusesUpdate"
          @update:selected-priorities="handlePrioritiesUpdate"
          @update:selected-labels="handleLabelsUpdate"
          @update:selected-assignee-type="handleAssigneeTypeUpdate"
          @update:agent-enabled-filter="handleAgentEnabledUpdate"
          @remove-chip="handleRemoveChip"
          @clear-filters="clearAllFilters"
        />
        <KanbanTaskList
          v-else-if="viewMode === 'list'"
          :statuses="statuses"
          :labels="labels"
          :tasks="filteredTasks"
          :view-mode="viewMode"
          :sort-field="sort.field"
          :sort-direction="sort.direction"
          :search-query="filters.search"
          :show-filters="showFilters"
          :selected-statuses="filters.statuses"
          :selected-priorities="filters.priorities"
          :selected-labels="filters.labels"
          :selected-assignee-type="filters.assigneeType"
          :agent-enabled-filter="filters.agentEnabled"
          :active-filter-count="activeFilterCount"
          :active-filter-chips="activeFilterChips"
          :total-task-count="tasks.length"
          @update:view-mode="viewMode = $event"
          @create-task="handleCreateTask"
          @update-task="handleUpdateTask"
          @open-task="handleOpenTask"
          @update:search="handleSearchUpdate"
          @update:sort-field="handleSortFieldUpdate"
          @update:sort-direction="handleSortDirectionUpdate"
          @update:show-filters="showFilters = $event"
          @update:selected-statuses="handleStatusesUpdate"
          @update:selected-priorities="handlePrioritiesUpdate"
          @update:selected-labels="handleLabelsUpdate"
          @update:selected-assignee-type="handleAssigneeTypeUpdate"
          @update:agent-enabled-filter="handleAgentEnabledUpdate"
          @remove-chip="handleRemoveChip"
          @clear-filters="clearAllFilters"
        />
      </KeepAlive>
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
import type { Task, Status, Label, ProjectMember, Workspace, Repository, TaskPriority } from '~/types'
import type { Agent } from '~/types'
import { flashHighlight } from '~/composables/useKanban'
import { useLocalStorage } from '@vueuse/core'
import AgentReadyTooltip from '~/components/onboarding/AgentReadyTooltip.vue'
import { useBoardFilterSort, type FilterState, type SortState } from '~/composables/useBoardFilterSort'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const { tasks, loading, fetchTasks, createTask, updateTask } = useTask()
const { fetchProjectDetail, fetchMembers, projectStatuses, projectLabels } = useProject()
const { agents, fetchAgents } = useAgent()
const { showTaskSidePanel, selectedTask, openTaskDetail, closeTaskDetail } = useKanban()
const { repositories } = useRepository()
const { getWorkspaceBySlug } = useWorkspace()

const project = ref<any>(null)
const workspace = ref<Workspace | null>(null)
const statuses = ref<Status[]>([])
const labels = ref<Label[]>([])
const members = ref<ProjectMember[]>([])
const showCreateModal = ref(false)
const showFilters = ref(false)

const viewMode = useLocalStorage<'kanban' | 'table' | 'list'>(`orbit-board-view-${projectId.value}`, 'kanban')

// --- Filter / Sort State ---
const { filters, sort, loadFromStorage, saveToStorage, filteredTasks: applyFilters } = useBoardFilterSort(projectId.value)

onMounted(() => {
  loadFromStorage()
})

const filteredTasks = computed(() => {
  return applyFilters(tasks.value)
})

// --- Active filter chips ---
const priorityLabels: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
}

const assigneeTypeLabels: Record<string, string> = {
  user: 'User',
  agent: 'Agent',
  unassigned: 'Unassigned',
}

const activeFilterCount = computed(() => {
  let count = 0
  if (filters.search.trim()) count++
  count += filters.statuses.length
  count += filters.priorities.length
  count += filters.labels.length
  if (filters.assigneeType !== null) count++
  if (filters.agentEnabled !== null) count++
  return count
})

interface FilterChip {
  key: string
  label: string
  type: 'search' | 'status' | 'priority' | 'label' | 'assigneeType' | 'agentEnabled'
}

const activeFilterChips = computed((): FilterChip[] => {
  const chips: FilterChip[] = []

  if (filters.search.trim()) {
    chips.push({
      key: `search-${filters.search}`,
      label: `Search: "${filters.search}"`,
      type: 'search',
    })
  }

  for (const id of filters.statuses) {
    const status = statuses.value.find(s => s.id === id)
    if (status) {
      chips.push({
        key: `status-${id}`,
        label: `Status: ${status.name}`,
        type: 'status',
      })
    }
  }

  for (const value of filters.priorities) {
    chips.push({
      key: `priority-${value}`,
      label: `Priority: ${priorityLabels[value]}`,
      type: 'priority',
    })
  }

  for (const id of filters.labels) {
    const label = labels.value.find(l => l.id === id)
    if (label) {
      chips.push({
        key: `label-${id}`,
        label: `Label: ${label.name}`,
        type: 'label',
      })
    }
  }

  if (filters.assigneeType) {
    chips.push({
      key: `assignee-${filters.assigneeType}`,
      label: `Assignee: ${assigneeTypeLabels[filters.assigneeType]}`,
      type: 'assigneeType',
    })
  }

  if (filters.agentEnabled !== null) {
    chips.push({
      key: `agent-${filters.agentEnabled}`,
      label: filters.agentEnabled ? 'Agent: Enabled' : 'Agent: Disabled',
      type: 'agentEnabled',
    })
  }

  return chips
})

// --- Event handlers ---
function handleSearchUpdate(value: string) {
  filters.search = value
  saveToStorage()
}

function handleSortFieldUpdate(field: SortState['field']) {
  sort.field = field
  saveToStorage()
}

function handleSortDirectionUpdate(direction: SortState['direction']) {
  sort.direction = direction
  saveToStorage()
}

function handleStatusesUpdate(statuses_: string[]) {
  filters.statuses = statuses_
  saveToStorage()
}

function handlePrioritiesUpdate(priorities: TaskPriority[]) {
  filters.priorities = priorities
  saveToStorage()
}

function handleLabelsUpdate(labels_: string[]) {
  filters.labels = labels_
  saveToStorage()
}

function handleAssigneeTypeUpdate(type: 'user' | 'agent' | 'unassigned' | null) {
  filters.assigneeType = type
  saveToStorage()
}

function handleAgentEnabledUpdate(enabled: boolean | null) {
  filters.agentEnabled = enabled
  saveToStorage()
}

function handleRemoveChip(chip: FilterChip) {
  switch (chip.type) {
    case 'search':
      filters.search = ''
      break
    case 'status':
      filters.statuses = filters.statuses.filter(id => id !== chip.key.replace('status-', ''))
      break
    case 'priority':
      filters.priorities = filters.priorities.filter(p => p !== chip.key.replace('priority-', '') as TaskPriority)
      break
    case 'label':
      filters.labels = filters.labels.filter(id => id !== chip.key.replace('label-', ''))
      break
    case 'assigneeType':
      filters.assigneeType = null
      break
    case 'agentEnabled':
      filters.agentEnabled = null
      break
  }
  saveToStorage()
}

function clearAllFilters() {
  filters.search = ''
  filters.statuses = []
  filters.priorities = []
  filters.labels = []
  filters.assigneeType = null
  filters.agentEnabled = null
  saveToStorage()
}

// Server-side fetch workspace + repositories so the repository
// promo banner never flashes with the wrong state on initial load.
const { data: ssrData, error: ssrError } = await useAsyncData(
  `workspace-board-${route.params.slug as string}-${projectId.value}`,
  async () => {
    const ws = await $fetch<Workspace>(`/api/workspaces/by-slug/${route.params.slug as string}`)
    const repos = await $fetch<Repository[]>(`/api/workspaces/${ws.id}/repositories`)
    return { workspace: ws, repositories: repos }
  }
)

// Sync SSR data synchronously so the banner renders with the correct state.
if (ssrData.value) {
  workspace.value = ssrData.value.workspace
  repositories.value = ssrData.value.repositories
}

const repositoriesReady = ref(ssrData.value !== null)

const showRepoBanner = computed(() => {
  if (!repositoriesReady.value) return false
  return repositories.value.length === 0
})

// --- Agent Tooltip State ---
const newTaskButtonRef = ref<HTMLElement | null>(null)
const showAgentTooltip = ref(false)
const tooltipAgent = ref<{ name: string; color: string } | null>(null)

const { logs: runtimeLogs, addLog, persistLog } = useLog()
const { startRuntime } = useAgentRuntime()

// Track which task IDs have already been advanced to review by the board-level
// watcher, so we don't double-fire if the panel opens and closes quickly.
const boardAdvancedTaskIds = new Set<string>()

// Watch in-memory runtime logs so we can auto-advance agentic tasks to
// "Review" when the agent finishes — even when the TaskSidePanel is closed.
// The panel handles this itself when it's open, so we skip tasks that are
// currently selected (panel is mounted).
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

onMounted(async () => {
  if (!workspace.value) {
    workspace.value = await getWorkspaceBySlug(route.params.slug as string)
  }

  // If SSR failed or repositories aren't loaded yet, fetch them client-side.
  if (!repositoriesReady.value && workspace.value) {
    try {
      const repos = await $fetch<Repository[]>(`/api/workspaces/${workspace.value.id}/repositories`)
      repositories.value = repos
    } catch (err) {
      console.error('Failed to fetch repositories:', err)
      repositories.value = []
    } finally {
      repositoriesReady.value = true
    }
  }

  const data = await fetchProjectDetail(projectId.value)
  project.value = data
  statuses.value = data.statuses || []
  labels.value = data.labels || []
  if (statuses.value.length > 0) {
    await fetchTasks(projectId.value)
  }
  members.value = await fetchMembers(projectId.value)
  await fetchAgents()

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
      persistLog(project.value.workspaceId, { entityType: 'task', entityId: data.id, entityName: updated.title, action: 'status_change', message: `Moved from "${oldStatus?.name || '?' }" to "${newStatus?.name || '?' }"` })
    }
    if (updated.agentEnabled && updated.assigneeType === 'agent' && updated.assignee && updated.status?.name && /progress/i.test(updated.status.name)) {
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
