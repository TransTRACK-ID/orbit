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

            <div v-if="activityLogs.length > 0" class="mt-6 pt-4 border-t border-surface-100">
              <label class="block text-xs font-medium text-surface-500 mb-3">Activity</label>
              <div class="space-y-2">
                <div
                  v-for="log in activityLogs"
                  :key="log.id"
                  class="flex items-start gap-2 text-sm text-surface-500"
                >
                  <Avatar :name="log.user?.name || 'U'" size="xs" />
                  <div>
                    <span class="font-medium text-surface-700">{{ log.user?.name }}</span>
                    <span>
                      {{ formatActivity(log) }}
                    </span>
                    <span class="text-xs text-surface-400 ml-1">{{ formatRelativeTime(log.createdAt) }}</span>
                  </div>
                </div>
              </div>
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
import type { Task, Status, Label, Comment, ActivityLog, ProjectMember } from '~/types'
import type { Agent } from '~/types'
import { useDebounceFn } from '@vueuse/core'

const props = defineProps<{
  taskId: string
  projectId: string
  statuses: Status[]
  labels: Label[]
  members: ProjectMember[]
  agents: Agent[]
}>()

const emit = defineEmits<{
  close: []
  updated: [task: Task]
  deleted: [taskId: string]
}>()

const {
  fetchTaskDetail,
  fetchComments,
  addComment,
  fetchActivity,
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

function computedInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

async function assignTo(assigneeId?: string, assigneeType?: 'user' | 'agent') {
  showAssigneePicker.value = false
  if (!task.value) return
  const updated = await updateTaskApi(task.value.id, {
    assigneeId: assigneeId || null,
    assigneeType: assigneeType || null,
  })
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
})

async function handleUpdate(field: string, value: any) {
  if (!task.value) return
  const updated = await updateTaskApi(task.value.id, { [field]: value })
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
    case 'assignee_change':
      return 'changed assignee'
    case 'comment_added':
      return 'added a comment'
    default:
      return log.action.replace(/_/g, ' ')
  }
}
</script>
