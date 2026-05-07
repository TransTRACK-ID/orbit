<template>
  <div class="fixed inset-0 z-50 flex">
    <div class="absolute inset-0 bg-surface-900/20 backdrop-blur-sm" @click="$emit('close')" />

    <div class="absolute right-0 top-0 bottom-0 w-[600px] max-w-[90vw] bg-white shadow-2xl border-l border-surface-200 animate-slide-in-right flex flex-col">
      <UiLoadingState v-if="loading" text="Loading task..." />

      <template v-else-if="task">
        <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div class="flex items-center gap-3">
            <KanbanPriorityBadge :priority="task.priority" />
            <span class="text-xs font-mono text-surface-400">
              {{ task.id?.slice(0, 8) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <IconButton @click="handleDuplicate">
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stroke-surface-500 w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </template>
            </IconButton>
            <IconButton @click="confirmDelete = true">
              <template #icon>
                <Trash class="stroke-surface-500 w-4 h-4" />
              </template>
            </IconButton>
            <IconButton @click="$emit('close')">
              <template #icon>
                <Close class="stroke-surface-500 w-4 h-4" />
              </template>
            </IconButton>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <div class="mb-4">
            <TextInput
              :model-value="task.title"
              placeholder="Task title"
              class="text-lg font-semibold !border-transparent !bg-transparent !px-0"
              @update:model-value="handleUpdate('title', $event)"
            />
          </div>

          <div class="grid grid-cols-2 gap-4 mb-6 p-4 bg-surface-50 rounded-xl">
            <div>
              <label class="block text-xs font-medium text-surface-500 mb-1">Status</label>
              <div class="relative">
                <select
                  :value="task.statusId"
                  class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  @change="handleUpdate('statusId', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="s in statuses" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-surface-500 mb-1">Priority</label>
              <div class="relative">
                <select
                  :value="task.priority"
                  class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  @change="handleUpdate('priority', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="none">None</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div class="relative">
              <label class="block text-xs font-medium text-surface-500 mb-1">Assignee</label>
              <button
                class="w-full flex items-center gap-2 text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 hover:border-surface-300 transition-colors text-left"
                @click="showAssigneePicker = !showAssigneePicker"
              >
                <template v-if="task.assignee">
                  <span
                    v-if="task.assignee.color"
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    :style="{ background: task.assignee.color }"
                  >
                    {{ task.assignee.initials || computedInitials(task.assignee.name) }}
                  </span>
                  <Avatar
                    v-else
                    :name="task.assignee.name"
                    size="sm"
                  />
                  <span class="flex-1 truncate">{{ task.assignee.name }}</span>
                  <span v-if="task.assigneeType === 'agent'" class="text-[9px] text-primary-500 font-semibold uppercase">Agent</span>
                </template>
                <template v-else>
                  <span class="text-surface-400 flex-1">Unassigned</span>
                </template>
                <ChevronDown class="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
              </button>

              <div v-if="isAgentInProgress" class="flex items-center gap-1.5 mt-2">
                <span class="agentic-badge">
                  <span class="agentic-dot" />
                  <span>Agentic · {{ task.assignee?.name }}</span>
                </span>
              </div>

              <div
                v-if="showAssigneePicker"
                class="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-surface-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
              >
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 transition-colors"
                  @click="assignTo()"
                >
                  <span class="w-5 h-5 rounded-full border-2 border-dashed border-surface-300 flex items-center justify-center flex-shrink-0" />
                  Unassigned
                </button>

                <div v-if="members.length > 0" class="px-3 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Members</div>
                <button
                  v-for="m in members"
                  :key="m.userId"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  :class="{ 'bg-primary-50': task.assigneeId === m.userId && task.assigneeType === 'user' }"
                  @click="assignTo(m.userId, 'user')"
                >
                  <Avatar :name="m.user?.name || 'U'" size="sm" />
                  <span class="truncate">{{ m.user?.name }}</span>
                </button>

                <div v-if="agents.length > 0" class="px-3 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wider border-t border-surface-100 mt-1 pt-1">Agents</div>
                <button
                  v-for="a in agents"
                  :key="a.id"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  :class="{ 'bg-primary-50': task.assigneeId === a.id && task.assigneeType === 'agent' }"
                  @click="assignTo(a.id, 'agent')"
                >
                  <span
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    :style="{ background: a.color }"
                  >
                    {{ a.initials }}
                  </span>
                  <span class="truncate">{{ a.name }}</span>
                  <span class="ml-auto text-[9px] text-primary-500 font-semibold uppercase">{{ a.runtime }}</span>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-surface-500 mb-1">Labels</label>
              <div v-if="task.labels?.length" class="flex flex-wrap gap-1">
                <Chip
                  v-for="label in task.labels"
                  :key="label.id"
                  :label="label.name"
                  :color="label.color"
                  size="sm"
                />
              </div>
              <span v-else class="text-sm text-surface-400">None</span>
            </div>
          </div>

          <div v-if="repositories && repositories.length > 0" class="mb-4">
            <label class="block text-xs font-medium text-surface-500 mb-1">Repository</label>
            <select
              :value="task.repositoryId"
              class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              @change="handleUpdate('repositoryId', ($event.target as HTMLSelectElement).value || null)"
            >
              <option :value="null">None</option>
              <option v-for="repo in repositories" :key="repo.id" :value="repo.id">
                {{ repo.name }} — {{ repo.defaultBranch }}
              </option>
            </select>
          </div>

          <div class="mb-6">
            <label class="block text-xs font-medium text-surface-500 mb-2">Description</label>
            <div class="border border-surface-200 rounded-lg overflow-hidden">
              <div class="border-b border-surface-100 px-3 py-2 flex gap-1 bg-surface-50">
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500" @click="toggleBold">
                  <strong class="text-xs">B</strong>
                </button>
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500" @click="toggleItalic">
                  <em class="text-xs">I</em>
                </button>
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500" @click="toggleStrike">
                  <span class="text-xs line-through">S</span>
                </button>
              </div>
              <div class="p-3 min-h-[100px]">
                <div
                  ref="editorRef"
                  contenteditable
                  class="text-sm text-surface-700 outline-none min-h-[80px]"
                  @input="handleDescriptionInput"
                />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-surface-500 mb-3">
              Comments ({{ comments.length }})
            </label>
            <div class="space-y-3 mb-4">
              <div
                v-for="comment in comments"
                :key="comment.id"
                class="flex gap-3 p-3 rounded-lg bg-surface-50"
              >
                <Avatar :name="comment.user?.name || 'U'" size="sm" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-sm font-medium text-surface-900">{{ comment.user?.name }}</span>
                    <span class="text-xs text-surface-400">{{ formatDate(comment.createdAt) }}</span>
                  </div>
                  <p class="text-sm text-surface-700">{{ comment.body }}</p>
                </div>
              </div>
            </div>

            <div class="flex gap-2">
              <TextInput
                v-model="newComment"
                placeholder="Write a comment..."
                class="flex-1"
                @keydown.enter.prevent="handleAddComment"
              />
              <Button :disabled="!newComment" @click="handleAddComment">Send</Button>
            </div>

            <div v-if="userActivityLogs.length > 0" class="mt-6 pt-4 border-t border-surface-100">
              <label class="block text-xs font-medium text-surface-500 mb-3">Activity</label>
              <div class="space-y-2">
                <div
                  v-for="log in userActivityLogs"
                  :key="log.id"
                  class="flex items-start gap-2 text-sm text-surface-500"
                >
                  <Avatar :name="log.userName || 'U'" size="xs" />
                  <div>
                    <span class="font-medium text-surface-700">{{ log.userName }}</span>
                    <span>{{ ' ' + log.message }}</span>
                    <span class="text-xs text-surface-400 ml-1">{{ log.displayTime }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="task" class="mt-6 pt-4 border-t border-surface-100">
              <div class="flex items-center gap-2 mb-3">
                <button
                  class="flex items-center gap-1 flex-1 text-left group"
                  @click="runtimeLogsExpanded = !runtimeLogsExpanded"
                >
                  <ChevronDown
                    class="w-3 h-3 text-surface-400 transition-transform duration-200"
                    :class="{ 'rotate-180': runtimeLogsExpanded }"
                  />
                  <label class="text-xs font-medium text-surface-500 cursor-pointer group-hover:text-surface-700 transition-colors">
                    Runtime ({{ runtimeLogsForTask.length }})
                  </label>
                </button>
                <button
                  v-if="isAgentInProgress && !runtimeActive"
                  class="text-[10px] font-semibold px-2 py-1 rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center gap-1"
                  @click="startRuntime(task.id); prUrl = ''; prError = ''"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                  Run
                </button>
                <button
                  v-if="runtimeActive"
                  class="text-[10px] font-semibold px-2 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
                  @click="stopRuntime(task.id)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Stop
                </button>
              </div>

              <template v-if="runtimeLogsForTask.length > 0 || runtimeActive">

              <div class="flex items-start gap-2 text-sm text-surface-500 mb-2">
                <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-600"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M9 14h6"/><path d="M12 14v4"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-medium text-surface-700">Runtime</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-semibold">LIVE</span>
                  </div>
                  <p class="text-sm text-surface-600 truncate mt-0.5">{{ latestRuntimeLog?.message || 'Waiting...' }}</p>
                </div>
              </div>

              <div
                v-if="runtimeLogsExpanded"
                class="space-y-0.5 max-h-40 overflow-y-auto rounded-lg bg-surface-50 p-2"
              >
                <div
                  v-for="log in runtimeLogsForTask"
                  :key="log.id"
                  class="flex items-start gap-1.5 py-0.5 text-[11px] leading-snug"
                >
                  <span class="text-primary-400 mt-0.5 flex-shrink-0">&#8250;</span>
                  <span class="text-surface-600 font-mono flex-1 min-w-0">{{ log.message }}</span>
                  <span class="text-surface-400 flex-shrink-0 whitespace-nowrap">{{ log.displayTime }}</span>
                </div>
              </div>

              <div v-if="runtimeCompleted && !runtimeActive" class="mt-3">
                <div
                  v-if="prSkipped"
                  class="w-full text-[11px] px-3 py-2 rounded-lg bg-surface-100 text-surface-500 flex items-center justify-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  No code changes to commit
                </div>
                <button
                  v-else-if="prLoading"
                  class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-green-500 text-white flex items-center justify-center gap-1.5 opacity-70 cursor-wait"
                  disabled
                >
                  <svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Creating PR...
                </button>
                <a
                  v-else-if="prUrl"
                  :href="prUrl"
                  target="_blank"
                  class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 no-underline"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Open PR
                </a>
                <button
                  v-else
                  class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                  @click="handleCreatePr"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                  Create PR
                </button>
                <p v-if="prError" class="text-[10px] text-red-500 mt-1">{{ prError }}</p>
              </div>
            </template>
            </div>
          </div>
        </div>
      </template>
    </div>

    <ModalConfirmation
      v-if="confirmDelete"
      title="Delete Task"
      message="Are you sure you want to delete this task? This action cannot be undone."
      confirm-text="Delete"
      variant="danger"
      @confirm="handleDelete"
      @cancel="confirmDelete = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { Task, Status, Label, Comment, ActivityLog, ProjectMember, Repository } from '~/types'
import type { Agent } from '~/types'
import { useDebounceFn } from '@vueuse/core'

const { addLog, logs: runtimeLogs } = useLog()

const props = defineProps<{
  taskId: string
  projectId: string
  statuses: Status[]
  labels: Label[]
  members: ProjectMember[]
  agents: Agent[]
  repositories?: Repository[]
}>()

const emit = defineEmits<{
  close: []
  updated: [task: Task]
  deleted: [taskId: string]
  duplicated: [task: Task]
}>()

const {
  fetchTaskDetail,
  fetchComments,
  addComment,
  fetchActivity,
  createTask: createTaskApi,
  updateTask: updateTaskApi,
  deleteTask: deleteTaskApi,
} = useTask()

const loading = ref(true)
const task = ref<Task | null>(null)
const comments = ref<Comment[]>([])
const activityLogs = ref<ActivityLog[]>([])
const newComment = ref('')
const confirmDelete = ref(false)
const editorRef = ref<HTMLDivElement | null>(null)
const showAssigneePicker = ref(false)

const isAgentInProgress = computed(() => {
  return (
    task.value?.assigneeType === 'agent' &&
    task.value?.assignee &&
    task.value?.status?.name &&
    /progress/i.test(task.value.status.name)
  )
})

const { startRuntime, stopRuntime, isRunning } = useAgentRuntime()
const runtimeActive = computed(() => task.value ? isRunning(task.value.id) : false)

function computedInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatRelativeTimeFromMs(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const runtimeLogsExpanded = ref(false)

const userActivityLogs = computed(() =>
  activityLogs.value
    .filter(log => log.action !== 'runtime_log')
    .map(log => ({
      id: log.id,
      userName: log.user?.name || 'Unknown',
      message: formatActivity(log),
      displayTime: formatRelativeTime(log.createdAt),
      timestamp: new Date(log.createdAt).getTime(),
    }))
)

const runtimeLogsForTask = computed(() => {
  const inMemoryLogs = runtimeLogs.value
    .filter(log => log.taskId === props.taskId)
    .map(log => ({
      id: `runtime-${log.time}`,
      message: log.msg,
      displayTime: formatRelativeTimeFromMs(log.time),
      timestamp: log.time,
    }))

  const persistedLogs = activityLogs.value
    .filter(log => log.action === 'runtime_log')
    .map(log => ({
      id: `persisted-${log.id}`,
      message: `> ${log.newValue?.message || ''}`,
      displayTime: formatRelativeTime(log.createdAt),
      timestamp: new Date(log.createdAt).getTime(),
    }))

  return [...inMemoryLogs, ...persistedLogs].sort((a, b) => b.timestamp - a.timestamp)
})

const latestRuntimeLog = computed(() => runtimeLogsForTask.value[0] || null)

const runtimeCompleted = computed(() =>
  runtimeLogsForTask.value.some(log => /Done|completed|exited/i.test(log.message))
)

const remotePrUrl = ref('')

const prUrl = computed(() => {
  const prLog = activityLogs.value.find(l => l.action === 'pr_created')
  return prLog?.newValue?.url || remotePrUrl.value || ''
})

const prLoading = ref(false)
const prError = ref('')
const prSkipped = ref(false)

async function checkExistingPr() {
  if (!task.value) return
  try {
    const { url } = await $fetch<{ url: string | null }>(`/api/tasks/${task.value.id}/pr`, { method: 'GET' })
    if (url) remotePrUrl.value = url
  } catch {}
}

async function handleCreatePr() {
  if (!task.value) return
  if (prUrl.value) return
  prLoading.value = true
  prError.value = ''
  try {
    const res = await $fetch<{ url: string | null; noChanges?: boolean }>(`/api/tasks/${task.value.id}/pr`, { method: 'POST' })
    if (res.noChanges) {
      prSkipped.value = true
    } else {
      activityLogs.value = await fetchActivity(props.taskId)
    }
  } catch (err: any) {
    prError.value = err.message || err.data?.statusMessage || 'Failed to create PR'
  } finally {
    prLoading.value = false
  }
}

let hasAdvanced = false

async function autoCreatePr() {
  if (!task.value || prUrl.value || prSkipped.value) return
  try {
    const res = await $fetch<{ url: string | null; noChanges?: boolean }>(`/api/tasks/${task.value.id}/pr`, { method: 'POST' })
    if (res.noChanges) {
      prSkipped.value = true
    } else {
      activityLogs.value = await fetchActivity(props.taskId)
    }
  } catch {}
  await checkExistingPr()
}

watch(runtimeCompleted, async (completed) => {
  if (completed && task.value && !runtimeActive.value && !hasAdvanced) {
    hasAdvanced = true
    await autoCreatePr()
    const doneStatus = props.statuses.find(s => /done/i.test(s.name))
    if (doneStatus && task.value.statusId !== doneStatus.id) {
      await handleUpdate('statusId', doneStatus.id)
      activityLogs.value = await fetchActivity(props.taskId)
    }
  }
})

async function assignTo(assigneeId?: string, assigneeType?: 'user' | 'agent') {
  showAssigneePicker.value = false
  if (!task.value) return
  const oldAssigneeType = task.value.assigneeType
  const updated = await updateTaskApi(task.value.id, {
    assigneeId: assigneeId || null,
    assigneeType: assigneeType || null,
  })
  if (updated) {
    if (oldAssigneeType !== 'agent' && assigneeType === 'agent' && updated.assignee) {
      addLog('Runtime', `Agent "${updated.assignee.name}" assigned to "${updated.title}"`, props.taskId)
    } else if (oldAssigneeType === 'agent' && assigneeType !== 'agent') {
      addLog('Runtime', `Agent unassigned from "${updated.title}"`, props.taskId)
    }
  }
  task.value = updated
  emit('updated', updated)
}



const renderedDescription = computed(() => {
  if (!task.value?.description) return ''
  return task.value.description
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
})

function syncDescription() {
  if (editorRef.value) {
    editorRef.value.innerHTML = task.value?.description
      ? renderedDescription.value
      : ''
  }
}

onMounted(async () => {
  try {
    task.value = await fetchTaskDetail(props.taskId)
    comments.value = await fetchComments(props.taskId)
    activityLogs.value = await fetchActivity(props.taskId)
  } catch (err) {
    console.error('Failed to load task detail:', err)
  } finally {
    loading.value = false
    nextTick(syncDescription)
  }

  if (task.value && isAgentInProgress.value && !isRunning(task.value.id)) {
    const hasLogs = activityLogs.value.some(l => l.action === 'runtime_log')
    if (!hasLogs) {
      startRuntime(task.value.id)
    } else {
      const { active } = await $fetch<{ active: boolean }>(`/api/tasks/${task.value.id}/execute/status`)
      if (active) {
        startRuntime(task.value.id)
      }
    }
  }

  await checkExistingPr()
})

async function handleUpdate(field: string, value: any) {
  if (!task.value) return
  const old = { ...task.value }
  const updated = await updateTaskApi(task.value.id, { [field]: value })
  if (updated && field === 'statusId' && old.statusId !== value) {
    const newStatus = props.statuses.find((s) => s.id === value)
    if (newStatus && /progress/i.test(newStatus.name) && updated.assigneeType === 'agent' && updated.assignee) {
      addLog('Runtime', `Agent "${updated.assignee.name}" started processing "${updated.title}"`, props.taskId)
      startRuntime(updated.id)
    }
  }
  task.value = updated
  emit('updated', updated)
}

function handleDescriptionInput(e: Event) {
  // Simple markdown-style handling
  const html = (e.target as HTMLDivElement).innerHTML
  const plain = html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<div>/g, '\n')
    .replace(/<\/div>/g, '')
    .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
    .replace(/<em>(.+?)<\/em>/g, '*$1*')
    .replace(/&nbsp;/g, ' ')
  if (task.value) {
    task.value.description = plain
  }
  debouncedSave('description', plain)
}

const debouncedSave = useDebounceFn(async (field: string, value: any) => {
  if (!task.value) return
  try {
    await updateTaskApi(task.value.id, { [field]: value })
  } catch (err) {
    console.error(`Failed to save ${field}:`, err)
  }
}, 500)

function toggleBold() {
  document.execCommand('bold')
  editorRef.value?.focus()
}

function toggleItalic() {
  document.execCommand('italic')
  editorRef.value?.focus()
}

function toggleStrike() {
  document.execCommand('strikeThrough')
  editorRef.value?.focus()
}

async function handleAddComment() {
  if (!newComment.value || !task.value) return
  await addComment(task.value.id, newComment.value)
  newComment.value = ''
  comments.value = await fetchComments(task.value.id)
}

async function handleDelete() {
  if (!task.value) return
  await deleteTaskApi(task.value.id)
  emit('deleted', task.value.id)
}

async function handleDuplicate() {
  if (!task.value) return
  const backlog = props.statuses.find(s => /backlog/i.test(s.name))
    || props.statuses.find(s => /todo/i.test(s.name))
    || props.statuses[0]
  if (!backlog) return

  const dup = await createTaskApi(props.projectId, {
    title: `${task.value.title} (copy)`,
    statusId: backlog.id,
    description: task.value.description,
    priority: task.value.priority,
    assigneeId: null,
    assigneeType: null,
    repositoryId: task.value.repositoryId,
    labelIds: task.value.labels?.map(l => l.id),
  })

  emit('duplicated', dup)
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatActivity(log: ActivityLog) {
  switch (log.action) {
    case 'status_change':
      return `moved from "${log.oldValue?.statusName}" to "${log.newValue?.statusName}"`
    case 'assignee_change': {
      const oldType = log.oldValue?.assigneeType
      const newType = log.newValue?.assigneeType
      if (oldType !== 'agent' && newType === 'agent') {
        return 'assigned to runtime agent'
      }
      if (oldType === 'agent' && newType !== 'agent') {
        return 'removed from runtime agent'
      }
      return 'changed assignee'
    }
    case 'comment_added':
      return 'added a comment'
    default:
      return log.action.replace(/_/g, ' ')
  }
}
</script>
