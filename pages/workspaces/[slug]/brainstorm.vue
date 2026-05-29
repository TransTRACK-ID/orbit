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
          <span class="text-xs text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full flex-shrink-0">{{ brainstorms.length }} sessions</span>
        </div>
        <div class="flex items-center gap-1.5 ml-auto">
          <button
            class="px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-surface-50 transition-colors"
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
            <span class="text-xs font-medium text-surface-600">Sessions</span>
            <button
              class="text-xs text-surface-500 hover:text-surface-700 transition-colors"
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
              <span v-if="bs._prdCount" class="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {{ bs._prdCount }} PRD{{ bs._prdCount > 1 ? 's' : '' }}
              </span>
              <button
                class="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-100 text-surface-400 hover:text-surface-600"
                :title="bs.archived ? 'Unarchive' : 'Archive'"
                @click.stop="toggleArchive(bs)"
              >
                <Icon :name="bs.archived ? 'lucide:archive-restore' : 'lucide:archive'" class="w-3 h-3" />
              </button>
            </div>
            <p v-if="bs.repository" class="text-xs text-surface-500 truncate ml-5">
              {{ bs.repository.name }}
            </p>
          </div>

          <!-- PRDs for selected brainstorm -->
          <div v-if="prds.length > 0 && selectedBrainstormId" class="mt-2 pt-2 border-t border-surface-100">
            <div class="flex items-center justify-between px-1 mb-1">
              <span class="text-[10px] font-medium text-surface-500 uppercase tracking-wide">PRDs</span>
              <span class="text-[10px] text-surface-400">{{ prds.length }}</span>
            </div>
            <div class="space-y-1">
              <div
                v-for="prd in prds"
                :key="prd.id"
                class="group p-2 rounded-lg border cursor-pointer transition-all duration-150"
                :class="currentPrd?.id === prd.id
                  ? 'border-purple-300 bg-purple-50'
                  : 'border-surface-100 bg-white hover:border-surface-200'"
                @click="selectPrd(prd.id); activeTab = 'prd'"
              >
                <div class="flex items-center gap-1.5">
                  <Icon name="lucide:file-text" class="w-3 h-3 text-purple-500 flex-shrink-0" />
                  <span class="text-[11px] font-medium truncate flex-1" :class="currentPrd?.id === prd.id ? 'text-purple-700' : 'text-surface-700'">
                    {{ prd.title }}
                  </span>
                  <span
                    v-if="prd.status === 'approved'"
                    class="text-[9px] bg-green-100 text-green-600 px-1 py-0.5 rounded-full"
                  >
                    <Icon name="lucide:check" class="w-2.5 h-2.5" />
                  </span>
                </div>
                <div class="flex items-center gap-1 mt-0.5 ml-4">
                  <span class="text-[9px] text-surface-400 capitalize">{{ prd.status }}</span>
                  <span v-if="prd.version > 1" class="text-[9px] text-surface-400">v{{ prd.version }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main panel -->
        <div class="flex-1 min-w-0 flex flex-col">
          <!-- Tab switcher -->
          <div v-if="currentBrainstorm" class="flex items-center gap-1 mb-2">
            <button
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              :class="activeTab === 'chat'
                ? 'bg-primary-500 text-white'
                : 'bg-white text-surface-600 border border-surface-200 hover:bg-surface-50'"
              @click="activeTab = 'chat'"
            >
              <Icon name="lucide:messages-square" class="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              :class="activeTab === 'prd'
                ? 'bg-purple-500 text-white'
                : 'bg-white text-surface-600 border border-surface-200 hover:bg-surface-50'"
              @click="activeTab = 'prd'"
            >
              <Icon name="lucide:file-text" class="w-3.5 h-3.5" />
              PRD
              <span v-if="prds.length > 0" class="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                {{ prds.length }}
              </span>
            </button>
          </div>

          <!-- Chat panel -->
          <div v-if="activeTab === 'chat'" class="flex-1 min-h-0">
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
              @generate-prd="handleGeneratePrd"
            />
            <div v-else class="h-full flex flex-col items-center justify-center text-surface-400 bg-white border border-surface-200 rounded-xl">
              <Icon name="lucide:lightbulb" class="w-12 h-12 mb-3 opacity-30" />
              <p class="text-sm">Select or create a brainstorm session</p>
            </div>
          </div>

          <!-- PRD panel -->
          <div v-else-if="activeTab === 'prd'" class="flex-1 min-h-0">
            <PrdPanel
              v-if="currentPrd"
              :prd="currentPrd"
              :prds="prds"
              :generating="generating"
              :generating-tasks="generatingTasks"
              :generation-step="generationStep"
              :generation-progress="generationProgress"
              @regenerate="handleGeneratePrd"
              @generate-tasks="handleGenerateTasks"
              @update-prd="handleUpdatePrd"
              @update-section="handleUpdateSection"
              @delete="handleDeletePrd"
            />
            <div v-else-if="generating" class="h-full flex flex-col items-center justify-center text-surface-400 bg-white border border-surface-200 rounded-xl">
              <div class="w-12 h-12 rounded-full border-2 border-surface-200 border-t-purple-500 animate-spin mb-4" />
              <p class="text-sm font-medium">{{ generationStep }}</p>
              <p class="text-[11px] mt-1">{{ generationProgress }}%</p>
            </div>
            <div v-else class="h-full flex flex-col items-center justify-center text-surface-400 bg-white border border-surface-200 rounded-xl">
              <Icon name="lucide:file-text" class="w-12 h-12 mb-3 opacity-30" />
              <p class="text-sm">No PRD generated yet</p>
              <p class="text-[11px] mt-1">Click "Generate PRD" in the chat panel to create one</p>
            </div>
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
              <label class="block text-xs font-medium text-surface-600 mb-1.5">Title</label>
              <TextInput
                v-model="createTitle"
                placeholder="e.g. API Design Discussion"
                required
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-surface-600 mb-1.5">Repository</label>
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
              <p v-if="repositories.length === 0" class="text-xs text-accent mt-1">
                <NuxtLink :to="`/workspaces/${route.params.slug}/settings?tab=repositories&focus=add-repo`" class="underline hover:text-accent-hover transition-colors">
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

            <div v-if="createError" class="flex items-start gap-2 p-2.5 rounded-lg bg-error-50 border border-error-100">
              <Icon name="lucide:alert-circle" class="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
              <p class="text-xs text-error-600">{{ createError }}</p>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Task Review Modal -->
    <TaskReviewModal
      v-if="showTaskReviewModal"
      :tasks="generatedTasks"
      :prd-title="currentPrd?.title || ''"
      :projects="workspaceProjects"
      :committing="committing"
      @close="showTaskReviewModal = false"
      @commit="handleCommitTasks"
    />
  </div>
</template>

<script setup lang="ts">
import type { Brainstorm, Workspace, Prd, PrdSection } from '~/types'

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

const {
  prds,
  currentPrd,
  generatedTasks,
  generating,
  generatingTasks,
  committing,
  prdGenerationSteps,
  prdGenerationProgress,
  fetchPrds,
  generatePrd,
  fetchPrd,
  updatePrd,
  selectPrd,
  deletePrd,
  generateTasks,
  commitTasks,
} = usePrd()

const workspace = ref<Workspace | null | undefined>(null)
const workspaceProjects = ref<Array<{ id: string; name: string }>>([])
const selectedBrainstormId = ref<string | null>(null)
const showCreate = ref(false)
const showArchived = ref(false)
const createTitle = ref('')
const createRepoId = ref('')
const creating = ref(false)
const createError = ref('')
const activeTab = ref<'chat' | 'prd'>('chat')
const showTaskReviewModal = ref(false)

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

const generationStep = computed(() => {
  if (!currentBrainstorm.value) return ''
  return prdGenerationSteps.value[currentBrainstorm.value.id] || ''
})

const generationProgress = computed(() => {
  if (!currentBrainstorm.value) return 0
  return prdGenerationProgress.value[currentBrainstorm.value.id] || 0
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
  activeTab.value = 'chat'
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
  await fetchPrds(id)
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

// ─── PRD ───

async function handleGeneratePrd() {
  if (!currentBrainstorm.value) return
  try {
    activeTab.value = 'prd'
    await generatePrd(currentBrainstorm.value.id)
    toastSuccess('PRD generated successfully', 'PRD created')
  } catch (err: any) {
    toastError(err?.message || 'Failed to generate PRD', 'Error')
  }
}

async function handleUpdatePrd(data: Partial<Prd>) {
  if (!currentPrd.value) return
  try {
    await updatePrd(currentPrd.value.id, data)
    toastSuccess('PRD updated', 'Saved')
  } catch (err: any) {
    toastError(err?.data?.message || 'Failed to update PRD', 'Error')
  }
}

async function handleUpdateSection(sectionId: string, content: string) {
  if (!currentPrd.value || !currentPrd.value.sections) return
  try {
    const updatedSections = currentPrd.value.sections.map(s =>
      s.id === sectionId ? { ...s, content } : s
    )
    await updatePrd(currentPrd.value.id, { sections: updatedSections })
    toastSuccess('Section updated', 'Saved')
  } catch (err: any) {
    toastError(err?.data?.message || 'Failed to update section', 'Error')
  }
}

async function handleDeletePrd() {
  if (!currentPrd.value) return
  try {
    await deletePrd(currentPrd.value.id)
    toastSuccess('PRD deleted', 'Deleted')
    // If there are other PRDs, select the first one
    if (prds.value.length > 0) {
      currentPrd.value = prds.value[0]
    } else {
      currentPrd.value = null
      activeTab.value = 'chat'
    }
  } catch (err: any) {
    toastError(err?.data?.message || 'Failed to delete PRD', 'Error')
  }
}

async function handleGenerateTasks() {
  if (!currentPrd.value || workspaceProjects.value.length === 0) return
  
  // Use first project if only one, otherwise we'll need a selector
  let projectId = currentPrd.value.projectId || ''
  if (!projectId && workspaceProjects.value.length === 1) {
    projectId = workspaceProjects.value[0].id
  }
  
  if (!projectId) {
    toastError('Please select a project first', 'Error')
    return
  }

  try {
    await generateTasks(currentPrd.value.id, projectId)
    showTaskReviewModal.value = true
  } catch (err: any) {
    toastError(err?.message || 'Failed to generate tasks', 'Error')
  }
}

async function handleCommitTasks(projectId: string, tasks: any[]) {
  if (!currentPrd.value) return
  try {
    const result = await commitTasks(currentPrd.value.id, projectId, tasks)
    showTaskReviewModal.value = false
    toastSuccess(`${result.count} tasks created and added to backlog`, 'Tasks created')
  } catch (err: any) {
    toastError(err?.data?.message || 'Failed to create tasks', 'Error')
  }
}
</script>
