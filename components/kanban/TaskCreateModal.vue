<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" @click.self="$emit('close')">
      <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-[calc(100vw-32px)] sm:max-w-md max-h-[85vh] overflow-y-auto p-4 sm:p-6 animate-scale-in my-auto">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-surface-900">Create Task</h3>
          <button class="text-surface-400 hover:text-surface-600 transition-colors p-1 flex-shrink-0" @click="$emit('close')">
            <Close class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Title *</label>
            <TextInput
              ref="titleInput"
              v-model="form.title"
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Status</label>
            <select
              v-model="form.statusId"
              class="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option v-for="s in statuses" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Priority</label>
            <select
              v-model="form.priority"
              class="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option value="none">None</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Assignee</label>
            <div class="relative">
              <button
                type="button"
                class="w-full flex items-center gap-2 text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 hover:border-surface-300 transition-colors text-left"
                @click="openAssigneePicker"
              >
                <template v-if="selectedAssignee">
                  <span
                    v-if="selectedAssignee.color"
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    :style="{ background: selectedAssignee.color }"
                  >
                    {{ selectedAssignee.initials || computedInitials(selectedAssignee.name) }}
                  </span>
                  <Avatar
                    v-else
                    :name="selectedAssignee.name"
                    size="sm"
                  />
                  <span class="flex-1 truncate">{{ selectedAssignee.name }}</span>
                </template>
                <template v-else>
                  <span class="text-surface-400 flex-1">Unassigned</span>
                </template>
                <ChevronDown class="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
              </button>

              <div
                v-if="showAssigneePicker"
                class="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-surface-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
              >
                <button
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 transition-colors"
                  @click="selectAssignee()"
                >
                  <span class="w-5 h-5 rounded-full border-2 border-dashed border-surface-300 flex items-center justify-center flex-shrink-0" />
                  Unassigned
                </button>

                <div v-if="members.length > 0" class="px-3 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Members</div>
                <button
                  v-for="m in members"
                  :key="m.userId"
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  @click="selectAssignee(m.userId, 'user', m.user?.name || '')"
                >
                  <Avatar :name="m.user?.name || 'U'" size="sm" />
                  <span class="truncate">{{ m.user?.name }}</span>
                </button>

                <div v-if="agents.length > 0" class="px-3 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wider border-t border-surface-100 mt-1 pt-1">Agents</div>
                <button
                  v-for="a in agents"
                  :key="a.id"
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  @click="selectAssignee(a.id, 'agent', a.name, a.color, a.initials)"
                >
                  <span
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    :style="{ background: a.color }"
                  >
                    {{ a.initials }}
                  </span>
                  <span class="truncate">{{ a.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Observer <span class="text-surface-400 font-normal">(optional)</span></label>
            <div class="relative">
              <button
                type="button"
                class="w-full flex items-center gap-2 text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 hover:border-surface-300 transition-colors text-left"
                @click="openObserverPicker"
              >
                <template v-if="selectedObserver">
                  <Avatar :name="selectedObserver.name" size="sm" />
                  <span class="flex-1 truncate">{{ selectedObserver.name }}</span>
                </template>
                <template v-else>
                  <span class="text-surface-400 flex-1">No observer — skip review</span>
                </template>
                <ChevronDown class="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
              </button>

              <div
                v-if="showObserverPicker"
                class="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-surface-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
              >
                <button
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 transition-colors"
                  @click="selectObserver()"
                >
                  <span class="w-5 h-5 rounded-full border-2 border-dashed border-surface-300 flex items-center justify-center flex-shrink-0" />
                  No observer
                </button>

                <div v-if="members.length > 0" class="px-3 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Members</div>
                <button
                  v-for="m in members"
                  :key="m.userId"
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  @click="selectObserver(m.userId, m.user?.name || '')"
                >
                  <Avatar :name="m.user?.name || 'U'" size="sm" />
                  <span class="truncate">{{ m.user?.name }}</span>
                </button>
              </div>
            </div>
            <p class="text-[10px] text-surface-400 mt-1">Assign a human reviewer to check the task result before completion</p>
          </div>

          <div v-if="props.repositories && props.repositories.length > 0">
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Repository <span class="text-error-500">*</span></label>
            <select
              v-model="form.repositoryId"
              required
              class="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option v-for="repo in props.repositories" :key="repo.id" :value="repo.id">
                {{ repo.name }} — {{ repo.defaultBranch }}
              </option>
            </select>
            <p class="text-[10px] text-surface-400 mt-1">Links this task to a repository for agent context</p>
          </div>

          <KanbanMarkdownEditor v-model="form.description" :rows="3" />

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Labels <span class="text-error-500">*</span></label>
            <div v-if="uniqueAvailableLabels.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="label in uniqueAvailableLabels"
                :key="label.id"
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                :class="selectedLabels.includes(label.id)
                  ? 'border-transparent text-white'
                  : 'border-surface-200 text-surface-600 hover:border-surface-300'"
                :style="selectedLabels.includes(label.id) ? { backgroundColor: label.color } : {}"
                @click="toggleLabel(label.id)"
              >
                {{ label.name }}
              </button>
            </div>
            <p v-else class="text-xs text-surface-400">No labels available. Default labels will be created automatically.</p>
            <p class="text-[10px] text-surface-400 mt-1">Select a type such as bug, feature, or improvement</p>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button class="py-2.5 px-3.5 text-sm font-semibold rounded-lg text-surface-600 hover:text-surface-900 transition-colors" @click="$emit('close')" type="button">Cancel</button>
            <Button type="submit" :loading="creating">
              <Plus class="w-4 h-4" />
              Create Task
            </Button>
          </div>

          <p v-if="error" class="text-error-500 text-sm">{{ error }}</p>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Status, Label, Task, ProjectMember, Repository } from '~/types'
import type { Agent } from '~/types'

const props = defineProps<{
  statuses: Status[]
  labels: Label[]
  projectId: string
  members: ProjectMember[]
  agents: Agent[]
  repositories?: Repository[]
}>()

const emit = defineEmits<{
  close: []
  created: [task: Task]
}>()

const { createTask } = useTask()
const { createLabel } = useProject()

const titleInput = ref<InstanceType<typeof TextInput> | null>(null)

const form = reactive({
  title: '',
  statusId: props.statuses[0]?.id || '',
  priority: 'none' as string,
  assigneeId: null as string | null,
  assigneeType: null as 'user' | 'agent' | null,
  observerId: null as string | null,
  description: '',
  repositoryId: props.repositories?.[0]?.id || null as string | null,
})

  const showAssigneePicker = ref(false)
  const selectedAssignee = ref<{ name: string; color?: string; initials?: string } | null>(null)
  const showObserverPicker = ref(false)
  const selectedObserver = ref<{ name: string } | null>(null)
  const selectedLabels = ref<string[]>([])
  const creating = ref(false)
  const error = ref('')

  const DEFAULT_LABELS = [
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#22c55e' },
    { name: 'improvement', color: '#3b82f6' },
    { name: 'docs', color: '#a855f7' },
    { name: 'chore', color: '#6b7280' },
  ]

  const availableLabels = ref<Label[]>([...props.labels])

  watch(() => props.labels, (newLabels) => {
    availableLabels.value = [...newLabels]
  }, { immediate: true })

  const uniqueAvailableLabels = computed(() => {
    const seen = new Set<string>()
    return availableLabels.value.filter((l) => {
      if (seen.has(l.name)) return false
      seen.add(l.name)
      return true
    })
  })

  async function ensureDefaultLabels() {
    const existingNames = new Set(availableLabels.value.map((l) => l.name))
    const missing = DEFAULT_LABELS.filter((d) => !existingNames.has(d.name))
    if (missing.length === 0) return

    const created: Label[] = []
    for (const def of missing) {
      try {
        const label = await createLabel(props.projectId, def)
        created.push(label)
      } catch {
        // ignore duplicate or creation errors
      }
    }
    if (created.length > 0) {
      availableLabels.value = [...availableLabels.value, ...created]
    }
  }

  function computedInitials(name: string) {
    return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function selectAssignee(id?: string, type?: 'user' | 'agent', name?: string, color?: string, initials?: string) {
    showAssigneePicker.value = false
    form.assigneeId = id || null
    form.assigneeType = type || null
    selectedAssignee.value = name ? { name, color, initials } : null
  }

  function selectObserver(id?: string, name?: string) {
    showObserverPicker.value = false
    form.observerId = id || null
    selectedObserver.value = name ? { name } : null
  }

  function openAssigneePicker() {
    showObserverPicker.value = false
    showAssigneePicker.value = !showAssigneePicker.value
  }

  function openObserverPicker() {
    showAssigneePicker.value = false
    showObserverPicker.value = !showObserverPicker.value
  }

function toggleLabel(labelId: string) {
  const idx = selectedLabels.value.indexOf(labelId)
  if (idx === -1) {
    selectedLabels.value.push(labelId)
  } else {
    selectedLabels.value.splice(idx, 1)
  }
}

async function handleCreate() {
  if (!form.title.trim()) {
    error.value = 'Title is required'
    return
  }
  if (!form.statusId) {
    error.value = 'Status is required'
    return
  }
  if (props.repositories && props.repositories.length > 0 && !form.repositoryId) {
    error.value = 'Repository is required'
    return
  }
  if (selectedLabels.value.length === 0) {
    error.value = 'At least one label (type) is required'
    return
  }

  creating.value = true
  error.value = ''

  try {
    const task = await createTask(props.projectId, {
      title: form.title,
      statusId: form.statusId,
      priority: form.priority,
      assigneeId: form.assigneeId,
      assigneeType: form.assigneeType,
      observerId: form.observerId || undefined,
      description: form.description || undefined,
      repositoryId: form.repositoryId || undefined,
      labelIds: selectedLabels.value,
    })
    emit('created', task)
  } catch (err: any) {
    error.value = err?.data?.message || 'Failed to create task'
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  await ensureDefaultLabels()
  setTimeout(() => titleInput.value?.$el?.querySelector('input')?.focus(), 100)
})
</script>
