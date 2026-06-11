<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-[calc(100vw-32px)] sm:max-w-md max-h-[85vh] overflow-y-auto p-4 sm:p-6 animate-scale-in my-auto">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-surface-900">Create Task</h3>
          <button class="text-surface-400 hover:text-surface-600 transition-colors p-1 flex-shrink-0 min-w-11 min-h-11 flex items-center justify-center" aria-label="Close" @click="$emit('close')">
            <Close class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleCreate" class="flex flex-col gap-5">
          <!-- Core Info -->
          <div class="flex flex-col gap-3">
            <div>
              <label for="task-title" class="block text-xs font-medium text-surface-600 mb-1.5">Title <span class="text-error-500">*</span></label>
              <TextInput
                id="task-title"
                ref="titleInput"
                v-model="form.title"
                placeholder="What needs to be done?"
                required
                autofocus
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="task-status" class="block text-xs font-medium text-surface-600 mb-1.5">Status <span class="text-error-500">*</span></label>
                <select
                  id="task-status"
                  v-model="form.statusId"
                  class="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                >
                  <option v-for="s in statuses" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>

              <div>
                <label for="task-priority" class="block text-xs font-medium text-surface-600 mb-1.5">Priority</label>
                <select
                  id="task-priority"
                  v-model="form.priority"
                  class="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                >
                  <option value="none">None</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <!-- Labels (required, belongs with core metadata) -->
            <div class="pt-1">
              <label class="block text-xs font-medium text-surface-600 mb-1.5">Labels <span class="text-error-500">*</span></label>
              <div v-if="uniqueAvailableLabels.length > 0" class="flex flex-wrap gap-2">
                <button
                  v-for="label in uniqueAvailableLabels"
                  :key="label.id"
                  type="button"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors duration-150"
                  :class="selectedLabels.includes(label.id)
                    ? 'border-transparent text-white'
                    : 'border-surface-200 text-surface-600 hover:border-surface-300 focus:border-surface-400'"
                  :style="selectedLabels.includes(label.id) ? { backgroundColor: label.color } : {}"
                  @click="toggleLabel(label.id)"
                >
                  {{ label.name }}
                </button>
              </div>
              <p v-else class="text-xs text-surface-400">No labels available. Default labels will be created automatically.</p>
              <p class="text-xs text-surface-500 mt-1">Select a type such as bug, feature, or improvement</p>
            </div>
          </div>

          <!-- People & Assignment -->
          <div class="flex flex-col gap-3">
            <div>
              <label class="block text-xs font-medium text-surface-600 mb-1.5">Assignee</label>
              <div class="relative">
                <button
                  type="button"
                  class="w-full flex items-center gap-2 text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 hover:border-surface-300 focus:ring-1 focus:ring-accent focus:border-accent outline-none transition-colors text-left"
                  :aria-expanded="showAssigneePicker"
                  @click="openAssigneePicker"
                >
                  <template v-if="selectedAssignee">
                    <span
                      v-if="selectedAssignee.color"
                      class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
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
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 focus:bg-surface-50 focus:outline-none transition-colors"
                    @click="selectAssignee()"
                  >
                    <span class="w-5 h-5 rounded-full border-2 border-dashed border-surface-300 flex items-center justify-center flex-shrink-0" />
                    Unassigned
                  </button>

                  <div v-if="members.length > 0" class="px-3 py-1 text-xs font-medium text-surface-600">Members</div>
                  <button
                    v-for="m in members"
                    :key="m.userId"
                    type="button"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 focus:bg-surface-50 focus:outline-none transition-colors"
                    @click="selectAssignee(m.userId, 'user', m.user?.name || '')"
                  >
                    <Avatar :name="m.user?.name || 'U'" size="sm" />
                    <span class="truncate">{{ m.user?.name }}</span>
                  </button>

                  <div v-if="agents.length > 0" class="px-3 py-1 text-xs font-medium text-surface-600 border-t border-surface-100 mt-1 pt-1">Agents</div>
                  <button
                    v-for="a in agents"
                    :key="a.id"
                    type="button"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 focus:bg-surface-50 focus:outline-none transition-colors"
                    @click="selectAssignee(a.id, 'agent', a.name, a.color, a.initials)"
                  >
                    <span
                      class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      :style="{ background: a.color }"
                    >
                      {{ a.initials }}
                    </span>
                    <span class="truncate">{{ a.name }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Description -->
          <KanbanMarkdownEditor v-model="form.description" :rows="3" />

          <!-- Attachments -->
          <div class="flex flex-col gap-3">
            <label class="block text-xs font-medium text-surface-600 mb-1.5">
              Attachments
              <span class="text-surface-400 font-normal">({{ pendingImages.length }} / 3)</span>
            </label>

            <!-- Drag & drop zone -->
            <div
              v-if="pendingImages.length < 3"
              tabindex="0"
              role="button"
              aria-label="Upload attachments"
              class="border-2 border-dashed border-surface-300 rounded-lg p-4 text-center cursor-pointer hover:border-accent hover:bg-surface-50 focus:border-accent focus:ring-1 focus:ring-accent focus:bg-surface-50 outline-none transition-colors"
              @click="fileInput?.click()"
              @keydown.enter.prevent="fileInput?.click()"
              @keydown.space.prevent="fileInput?.click()"
              @dragover.prevent
              @drop.prevent="handleDrop"
            >
              <div class="flex flex-col items-center gap-1">
                <svg class="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M12 16h.01M8 16h.01M16 16h.01" />
                </svg>
                <span class="text-xs text-surface-500">Drop files here or click to upload</span>
                <span class="text-xs text-surface-500">PNG, JPEG, JPG, HTML, MD — max 10 MB</span>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/png,image/jpeg,image/jpg,.html,text/html,.md,text/markdown,text/plain"
                multiple
                class="hidden"
                @change="handleFileSelect"
              />
            </div>

            <!-- File previews with progress -->
            <div v-if="pendingImages.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="(img, idx) in pendingImages"
                :key="img.id"
                class="relative group"
              >
                <div v-if="img.isImage" class="w-16 h-16 rounded-lg overflow-hidden border border-surface-200 bg-surface-100">
                  <img :src="img.preview" alt="Attachment preview" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-16 h-16 rounded-lg overflow-hidden border border-surface-200 bg-surface-100 flex flex-col items-center justify-center gap-0.5 px-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-500"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13l-2 2 2 2"/><path d="M14 13l2 2-2 2"/></svg>
                  <span class="text-[8px] text-surface-500 truncate w-full text-center leading-tight">{{ img.file.name }}</span>
                </div>

                <!-- Progress overlay -->
                <div
                  v-if="img.status === 'uploading'"
                  class="absolute inset-0 bg-surface-900/50 rounded-lg flex items-center justify-center"
                >
                  <div class="w-10 h-1 bg-surface-300 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-accent transition-all duration-200"
                      :style="{ width: img.progress + '%' }"
                    />
                  </div>
                </div>

                <!-- Error overlay -->
                <div
                  v-if="img.status === 'error'"
                  class="absolute inset-0 bg-surface-900/50 rounded-lg flex items-center justify-center"
                >
                  <span class="text-xs text-error-400 font-medium">Failed</span>
                </div>

                <!-- Remove button -->
                <button
                  type="button"
                  class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-surface-700 text-white rounded-full flex items-center justify-center text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  aria-label="Remove attachment"
                  @click="removeImage(idx)"
                >
                  <Close class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Advanced: Observer + Agent -->
          <div class="flex flex-col gap-4 pt-2 border-t border-surface-100">
            <div>
              <label class="block text-xs font-medium text-surface-600 mb-1.5">Observer <span class="text-surface-400 font-normal">(optional)</span></label>
              <div class="relative">
                <button
                  type="button"
                  class="w-full flex items-center gap-2 text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 hover:border-surface-300 focus:ring-1 focus:ring-accent focus:border-accent outline-none transition-colors text-left"
                  :aria-expanded="showObserverPicker"
                  @click="openObserverPicker"
                >
                  <template v-if="selectedObserver">
                    <Avatar :name="selectedObserver.name" size="sm" />
                    <span class="flex-1 truncate">{{ selectedObserver.name }}</span>
                  </template>
                  <template v-else>
                    <span class="text-surface-400 flex-1">No observer (skip review)</span>
                  </template>
                  <ChevronDown class="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                </button>

                <div
                  v-if="showObserverPicker"
                  class="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-surface-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
                >
                  <button
                    type="button"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 focus:bg-surface-50 focus:outline-none transition-colors"
                    @click="selectObserver()"
                  >
                    <span class="w-5 h-5 rounded-full border-2 border-dashed border-surface-300 flex items-center justify-center flex-shrink-0" />
                    No observer
                  </button>

                  <div v-if="members.length > 0" class="px-3 py-1 text-xs font-medium text-surface-600">Members</div>
                  <button
                    v-for="m in members"
                    :key="m.userId"
                    type="button"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 focus:bg-surface-50 focus:outline-none transition-colors"
                    @click="selectObserver(m.userId, m.user?.name || '')"
                  >
                    <Avatar :name="m.user?.name || 'U'" size="sm" />
                    <span class="truncate">{{ m.user?.name }}</span>
                  </button>
                </div>
              </div>
              <p class="text-xs text-surface-500 mt-1">Assign a human reviewer to check the task result before completion</p>
            </div>

            <!-- Agent Section -->
            <div class="flex flex-col gap-3">
              <!-- Agent options (shown when assignee is an agent) -->
              <div v-if="form.assigneeType === 'agent'" class="bg-surface-50 rounded-lg p-4 flex flex-col gap-3">
                <div v-if="props.repositories && props.repositories.length > 0">
                  <label for="task-repo-agent" class="block text-xs font-medium text-surface-600 mb-1.5">Repository <span class="text-error-500">*</span></label>
                  <select
                    id="task-repo-agent"
                    v-model="form.repositoryId"
                    required
                    class="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  >
                    <option value="" disabled selected>Select a repository</option>
                    <option v-for="repo in props.repositories" :key="repo.id" :value="repo.id">
                      {{ repo.name }} / {{ repo.defaultBranch }}
                    </option>
                  </select>
                  <p class="text-xs text-surface-500 mt-1">Required for agent code context</p>
                </div>
                <div v-else class="p-3 rounded-lg bg-white border border-surface-200">
                  <p class="text-xs text-surface-600">
                    No repositories connected.
                    <NuxtLink
                      :to="`/workspaces/${route.params.slug}/settings?tab=repositories&focus=add-repo`"
                      class="text-accent font-medium underline hover:text-accent-hover transition-colors"
                    >
                      Connect one
                    </NuxtLink>
                    to enable agent features.
                  </p>
                </div>

                <div>
                  <label for="task-branch" class="block text-xs font-medium text-surface-600 mb-1.5">Branch Name <span class="text-surface-400 font-normal">(optional)</span></label>
                  <TextInput
                    id="task-branch"
                    v-model="form.branchName"
                    placeholder="feature/my-branch-name"
                    :is-error="!!branchNameError"
                  />
                  <p v-if="branchNameError" class="text-xs text-error-600 mt-1">{{ branchNameError }}</p>
                  <p v-else class="text-xs text-surface-500 mt-1">Custom branch name for git worktree. Defaults to task-&lt;title&gt; if empty.</p>
                </div>
              </div>


            </div>
          </div>

          <div v-if="error" class="flex items-start gap-2 p-2.5 rounded-lg bg-error-50 border border-error-100">
            <Icon name="lucide:alert-circle" class="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
            <p class="text-xs text-error-600">{{ error }}</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-4 border-t border-surface-200">
            <button class="py-2.5 px-3.5 text-sm font-semibold rounded-lg text-surface-600 hover:text-surface-900 transition-colors" @click="$emit('close')" type="button">Cancel</button>
            <Button type="submit" :loading="creating">
              <Plus class="w-4 h-4" />
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Status, Label, Task, ProjectMember, Repository } from '~/types'
import type { Agent } from '~/types'
import { validateBranchName } from '~/utils/branch-validation'

const route = useRoute()

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

const { createTask, uploadAttachment } = useTask()
const { createLabel } = useProject()

const titleInput = ref<InstanceType<typeof TextInput> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

interface PendingImage {
  id: string
  file: File
  preview: string
  isImage: boolean
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
}

const pendingImages = ref<PendingImage[]>([])

const form = reactive({
  title: '',
  statusId: props.statuses[0]?.id || '',
  priority: 'none' as string,
  assigneeId: null as string | null,
  assigneeType: null as 'user' | 'agent' | null,
  observerId: null as string | null,
  description: '',
  repositoryId: null as string | null,
  branchName: '' as string | null,
})

const showAssigneePicker = ref(false)
const selectedAssignee = ref<{ name: string; color?: string; initials?: string } | null>(null)
const showObserverPicker = ref(false)
const selectedObserver = ref<{ name: string } | null>(null)
const selectedLabels = ref<string[]>([])
const creating = ref(false)
const error = ref('')
const branchNameError = ref('')

watch(() => form.branchName, () => {
  branchNameError.value = ''
})

// Update branch name feature segment when title changes and agent is assigned
watch(() => form.title, (newTitle) => {
  if (form.assigneeType === 'agent' && form.branchName) {
    const segments = form.branchName.split('/')
    if (segments.length === 4) {
      segments[3] = slugifyBranchSegment(newTitle || 'feature')
      form.branchName = segments.join('/')
    }
  }
})

// Update branch name label segment when labels change and agent is assigned
watch(() => selectedLabels.value, () => {
  if (form.assigneeType === 'agent' && form.branchName) {
    const segments = form.branchName.split('/')
    if (segments.length === 4) {
      const firstLabel = props.labels?.find(l => selectedLabels.value.includes(l.id))
      segments[0] = firstLabel ? slugifyBranchSegment(firstLabel.name) : 'task'
      form.branchName = segments.join('/')
    }
  }
}, { deep: true })

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

function slugifyBranchSegment(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

function generateAgentBranchNameForCreate(): string {
  const firstLabel = props.labels?.find(l => selectedLabels.value.includes(l.id))
  const label = firstLabel ? slugifyBranchSegment(firstLabel.name) : 'task'
  const identity = 'new'
  const assignee = selectedObserver.value
    ? slugifyBranchSegment(selectedObserver.value.name)
    : form.assigneeType === 'agent' && selectedAssignee.value
      ? slugifyBranchSegment(selectedAssignee.value.name)
      : 'unassigned'
  const feature = slugifyBranchSegment(form.title || 'feature')
  return `${label}/${identity}/${assignee}/${feature}`
}

function selectAssignee(id?: string, type?: 'user' | 'agent', name?: string, color?: string, initials?: string) {
  showAssigneePicker.value = false
  form.assigneeId = id || null
  const wasAgent = form.assigneeType === 'agent'
  form.assigneeType = type || null
  selectedAssignee.value = name ? { name, color, initials } : null

  // Reset agent-specific fields when switching from agent to non-agent
  if (wasAgent && type !== 'agent') {
    form.repositoryId = null
    form.branchName = ''
  }

  // Auto-fill or regenerate branch name when assigning an agent
  if (type === 'agent') {
    form.branchName = generateAgentBranchNameForCreate()
  }
}

function selectObserver(id?: string, name?: string) {
  showObserverPicker.value = false
  form.observerId = id || null
  selectedObserver.value = name ? { name } : null

  // Regenerate branch name when observer changes for agent tasks
  if (form.assigneeType === 'agent') {
    form.branchName = generateAgentBranchNameForCreate()
  }
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

function validateFile(file: File): string | null {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'text/html', 'text/markdown', 'text/plain']
  if (!allowedTypes.includes(file.type)) {
    return 'Only PNG, JPEG, JPG images, HTML files, and Markdown files are allowed.'
  }
  if (file.type === 'text/plain' && !file.name.toLowerCase().endsWith('.md')) {
    return 'Only PNG, JPEG, JPG images, HTML files, and Markdown files are allowed.'
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'File too large (max 10 MB).'
  }
  return null
}

function addImageFiles(files: FileList | null) {
  if (!files) return
  for (const file of Array.from(files)) {
    if (pendingImages.value.length >= 3) break
    const validationError = validateFile(file)
    if (validationError) {
      error.value = validationError
      continue
    }
    const isImage = file.type.startsWith('image/')
    pendingImages.value.push({
      id: Math.random().toString(36).substring(2, 9),
      file,
      preview: isImage ? URL.createObjectURL(file) : '',
      isImage,
      status: 'pending',
      progress: 0,
    })
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  addImageFiles(target.files)
  target.value = ''
}

function handleDrop(e: DragEvent) {
  addImageFiles(e.dataTransfer?.files ?? null)
}

function removeImage(idx: number) {
  const img = pendingImages.value[idx]
  if (img) {
    URL.revokeObjectURL(img.preview)
    pendingImages.value.splice(idx, 1)
  }
}

async function uploadAllImages(taskId: string): Promise<number> {
  let failures = 0
  for (const img of pendingImages.value) {
    if (img.status === 'done') continue
    img.status = 'uploading'
    img.progress = 0
    try {
      await uploadAttachment(taskId, img.file, (percent) => {
        img.progress = percent
      })
      img.status = 'done'
    } catch (err: any) {
      img.status = 'error'
      failures++
    }
  }
  return failures
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
  if (form.assigneeType === 'agent' && props.repositories && props.repositories.length > 0 && !form.repositoryId) {
    error.value = 'Agent requires a repository for code context'
    return
  }
  if (selectedLabels.value.length === 0) {
    error.value = 'At least one label (type) is required'
    return
  }
  const branchError = validateBranchName(form.branchName || '')
  branchNameError.value = branchError
  if (branchError) return

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
      branchName: form.branchName || null,
      agentEnabled: form.assigneeType === 'agent',
    })

    // Upload images after task is created
    let uploadFailures = 0
    if (pendingImages.value.length > 0) {
      uploadFailures = await uploadAllImages(task.id)
    }

    if (uploadFailures > 0) {
      error.value = `${uploadFailures} image(s) failed to upload. You can retry by editing the task.`
    }

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
