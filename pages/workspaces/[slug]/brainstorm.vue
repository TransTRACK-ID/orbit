<template>
  <div class="flex-1 overflow-y-auto py-5 px-4 sm:py-7 sm:px-8">
    <div v-if="workspace">
      <!-- Header matching kanban BoardHeader style -->
      <div class="flex items-center gap-3 px-3 sm:px-5 py-3.5 border-b border-surface-200 bg-white flex-shrink-0 mb-4 rounded-xl">
        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
            style="background: #8B5CF6"
          >
            <Icon name="lucide:lightbulb" class="w-4 h-4" />
          </div>
          <h2 class="text-sm font-semibold text-surface-900 flex-shrink-0">Brainstorm</h2>
          <span class="text-[10px] text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full flex-shrink-0">{{ brainstorms.length }} sessions</span>
        </div>
        <div class="flex items-center gap-1.5 ml-auto">
          <button
            class="px-3 py-1.5 rounded-lg border border-surface-200 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-surface-50 transition-colors"
            @click="showCreate = true"
          >
            <Icon name="lucide:plus" class="w-3 h-3" />
            <span class="max-sm:hidden">New Session</span>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <UiLoadingState v-if="loading" text="Loading brainstorms..." />

      <div v-else class="flex gap-4 h-[calc(100vh-180px)] min-h-[400px]">
        <!-- Sidebar: brainstorm list -->
        <div class="w-64 flex-shrink-0 flex flex-col gap-2">
          <div class="flex items-center justify-between px-1 mb-1">
            <span class="text-[10px] font-medium text-surface-400 uppercase tracking-wider">Sessions</span>
            <button
              class="text-[10px] text-surface-400 hover:text-surface-600 transition-colors"
              @click="showArchived = !showArchived"
            >
              {{ showArchived ? 'Hide archived' : 'Show archived' }}
            </button>
          </div>

          <div v-if="visibleBrainstorms.length === 0" class="text-center py-8 text-surface-400">
            <Icon name="lucide:lightbulb" class="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p class="text-xs">{{ showArchived ? 'No archived brainstorms' : 'No brainstorms yet' }}</p>
          </div>

          <div
            v-for="bs in visibleBrainstorms"
            :key="bs.id"
            class="group p-3 rounded-xl border cursor-pointer transition-all duration-150 relative"
            :class="selectedBrainstormId === bs.id
              ? 'border-primary-300 bg-primary-50 shadow-sm'
              : 'border-surface-200 bg-white hover:border-surface-300 hover:shadow-sm'"
            @click="selectBrainstorm(bs.id)"
          >
            <div class="flex items-center gap-2 mb-1">
              <Icon name="lucide:lightbulb" class="w-3.5 h-3.5 text-primary-500 flex-shrink-0" :class="bs.archived ? 'opacity-40' : ''" />
              <span class="text-xs font-semibold truncate flex-1" :class="bs.archived ? 'text-surface-400 line-through' : 'text-surface-900'">{{ bs.title }}</span>
              <button
                class="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-100 text-surface-400 hover:text-surface-600"
                :title="bs.archived ? 'Unarchive' : 'Archive'"
                @click.stop="toggleArchive(bs)"
              >
                <Icon :name="bs.archived ? 'lucide:archive-restore' : 'lucide:archive'" class="w-3 h-3" />
              </button>
            </div>
            <p v-if="bs.repository" class="text-[10px] text-surface-400 truncate ml-5">
              {{ bs.repository.name }}
            </p>
          </div>
        </div>

        <!-- Main chat panel -->
        <div class="flex-1 min-w-0">
          <BrainstormPanel
            v-if="currentBrainstorm"
            :brainstorm="currentBrainstorm"
            :messages="messages"
            :is-running="chatRunningState"
            :is-sending="sending"
            :messages-loading="messagesLoading"
            :chat-reply="currentChatReply"
            :current-step="currentChatStep"
            :projects="workspaceProjects"
            @send="handleSend"
            @start="handleStart"
            @stop="handleStop"
            @create-task="handleCreateTask"
          />
          <div v-else class="h-full flex flex-col items-center justify-center text-surface-400 bg-white border border-surface-200 rounded-xl">
            <Icon name="lucide:lightbulb" class="w-12 h-12 mb-3 opacity-30" />
            <p class="text-sm">Select or create a brainstorm session</p>
          </div>
        </div>
      </div>
    </div>

    <UiLoadingState v-else-if="loading" text="Loading workspace..." />

    <!-- Create modal -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="showCreate = false">
        <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-md p-6 animate-scale-in">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-semibold text-surface-900">New Brainstorm Session</h3>
            <button class="text-surface-400 hover:text-surface-600 transition-colors p-1" @click="showCreate = false">
              <Close size="20" class="stroke-gray-500" />
            </button>
          </div>

          <form @submit.prevent="handleCreate" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Title *</label>
              <TextInput
                v-model="createTitle"
                placeholder="e.g. API Design Discussion"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Repository</label>
              <div class="relative">
                <select
                  v-model="createRepoId"
                  class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 pr-8 appearance-none cursor-pointer focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                >
                  <option value="">No repository</option>
                  <option v-for="repo in repositories" :key="repo.id" :value="repo.id">
                    {{ repo.name }} — {{ repo.defaultBranch }}
                  </option>
                </select>
                <Icon
                  name="lucide:chevron-down"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none"
                />
              </div>
              <p class="text-xs text-surface-400 mt-1">Select a repository to chat about its codebase</p>
              <p v-if="repositories.length === 0" class="text-[10px] text-accent-600 mt-1">
                <NuxtLink :to="`/workspaces/${route.params.slug}/settings?tab=repositories&focus=add-repo`" class="underline hover:text-accent-800">
                  Connect a repository
                </NuxtLink>
                to brainstorm about your codebase.
              </p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <TextButton type="button" @on-click="showCreate = false">Cancel</TextButton>
              <Button type="submit" :loading="creating" :disabled="!createTitle.trim()">
                Create
              </Button>
            </div>

            <p v-if="createError" class="text-error-500 text-sm">{{ createError }}</p>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Brainstorm, Workspace } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { getWorkspaceBySlug } = useWorkspace()
const { repositories, fetchRepositories } = useRepository()
const {
  brainstorms,
  currentBrainstorm,
  messages,
  loading,
  sending,
  messagesLoading,
  fetchBrainstorms,
  createBrainstorm,
  fetchBrainstorm,
  fetchMessages,
  sendMessage,
  saveAssistantMessage,
  startChat,
  killChat,
  isChatRunning,
  getChatReply,
  clearChatReply,
  getChatStep,
  clearChatStep,
  archiveBrainstorm,
  convertToTask,
} = useBrainstorm()

const workspace = ref<Workspace | null | undefined>(null)
const workspaceProjects = ref<Array<{ id: string; name: string }>>([])
const selectedBrainstormId = ref<string | null>(null)
const showCreate = ref(false)
const showArchived = ref(false)
const createTitle = ref('')
const createRepoId = ref('')
const creating = ref(false)
const createError = ref('')

const visibleBrainstorms = computed(() => {
  if (showArchived.value) {
    return brainstorms.value.filter((b) => b.archived)
  }
  return brainstorms.value.filter((b) => !b.archived)
})

const chatRunningState = ref(false)
let chatCheckInterval: ReturnType<typeof setInterval> | null = null

const currentChatReply = computed(() => {
  if (!currentBrainstorm.value) return ''
  return getChatReply(currentBrainstorm.value.id)
})

const currentChatStep = computed(() => {
  if (!currentBrainstorm.value) return ''
  return getChatStep(currentBrainstorm.value.id)
})

onMounted(async () => {
  // Reset any stuck loading state from previous sessions
  messagesLoading.value = false
  workspace.value = await getWorkspaceBySlug(slug.value)
  if (workspace.value) {
    await fetchRepositories(workspace.value.id)
    await fetchBrainstorms(workspace.value.id)
    try {
      const projects = await $fetch<Array<{ id: string; name: string }>>(`/api/workspaces/${workspace.value.id}/projects`)
      workspaceProjects.value = projects || []
    } catch {
      workspaceProjects.value = []
    }
  }
})

onUnmounted(() => {
  if (chatCheckInterval) {
    clearInterval(chatCheckInterval)
  }
})

function selectBrainstorm(id: string) {
  selectedBrainstormId.value = id
  loadBrainstorm(id)
}

async function loadBrainstorm(id: string) {
  messagesLoading.value = false
  messages.value = []
  clearChatReply(id)
  clearChatStep(id)
  chatRunningState.value = false
  await fetchBrainstorm(id)
  await fetchMessages(id)
  startChatCheck()
}

function startChatCheck() {
  if (chatCheckInterval) clearInterval(chatCheckInterval)
  let isSaving = false
  chatCheckInterval = setInterval(async () => {
    if (!currentBrainstorm.value || isSaving) return
    const bsId = currentBrainstorm.value.id
    const running = isChatRunning(bsId)

    if (chatRunningState.value && !running) {
      // Chat just finished — save reply before clearing
      const reply = getChatReply(bsId)
      clearChatReply(bsId)
      clearChatStep(bsId)

      if (reply.trim()) {
        isSaving = true
        try {
          await saveAssistantMessage(bsId, reply.trim())
        } finally {
          isSaving = false
        }
      }
    }
    chatRunningState.value = running
  }, 500)
}

async function toggleArchive(bs: Brainstorm) {
  try {
    const updated = await archiveBrainstorm(bs.id, !bs.archived)
    if (updated.archived && currentBrainstorm.value?.id === bs.id) {
      currentBrainstorm.value = null
      selectedBrainstormId.value = null
    }
  } catch (err: any) {
    toastError(err?.data?.message || 'Failed to archive brainstorm', 'Error')
  }
}

async function handleCreate() {
  if (!workspace.value || !createTitle.value.trim()) return
  creating.value = true
  createError.value = ''
  try {
    const repoId = createRepoId.value || undefined
    const bs = await createBrainstorm(workspace.value.id, {
      title: createTitle.value.trim(),
      repositoryId: repoId || null,
    })
    showCreate.value = false
    createTitle.value = ''
    createRepoId.value = ''
    selectedBrainstormId.value = bs.id
    await loadBrainstorm(bs.id)
  } catch (err: any) {
    createError.value = err?.data?.message || 'Failed to create brainstorm'
  } finally {
    creating.value = false
  }
}

async function handleSend(content: string) {
  if (!currentBrainstorm.value) return
  const bsId = currentBrainstorm.value.id

  // Save any in-progress reply before starting a new chat
  const existingReply = getChatReply(bsId)
  if (existingReply.trim()) {
    await saveAssistantMessage(bsId, existingReply.trim())
    clearChatReply(bsId)
  }
  clearChatStep(bsId)

  await sendMessage(bsId, content)
  chatRunningState.value = true
  await startChat(bsId, content)
}

function handleStart() {
  if (!currentBrainstorm.value) return
  chatRunningState.value = true
  startChat(currentBrainstorm.value.id)
}

function handleStop() {
  if (!currentBrainstorm.value) return
  killChat(currentBrainstorm.value.id)
  chatRunningState.value = false
}

const { success: toastSuccess, error: toastError } = useToast()

async function handleCreateTask(messageId: string, projectId: string) {
  if (!currentBrainstorm.value) return
  try {
    const task = await convertToTask(currentBrainstorm.value.id, messageId, projectId)
    toastSuccess(`Task "${task.title}" was created with the improvement label and added to the backlog.`, 'Task created')
  } catch (err: any) {
    toastError(err?.data?.message || 'Failed to create task', 'Error')
  }
}
</script>
