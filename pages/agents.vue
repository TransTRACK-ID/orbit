<template>
  <div class="flex-1 overflow-y-auto py-5 px-4 sm:py-7 sm:px-8">
    <div class="flex items-center gap-3 mb-1 flex-wrap">
      <h1 class="text-xl font-bold text-surface-900">Agents</h1>
      <button
        class="px-3 py-1.5 rounded-lg border border-surface-200 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-surface-50 transition-colors"
        @click="openCreateModal()"
      >
        <Icon name="lucide:plus" class="w-3 h-3" />
        <span class="max-sm:hidden">Add Agent</span>
      </button>
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-surface-400 max-sm:hidden">Quick add:</span>
        <button
          class="px-2.5 py-1 rounded-md bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 text-[10px] font-semibold flex items-center gap-1 hover:bg-[#2563EB]/20 transition-colors"
          @click="openCreateModalWithTemplate('raihan')"
        >
          <Icon name="lucide:user" class="w-2.5 h-2.5" />
          Raihan
        </button>
        <button
          class="px-2.5 py-1 rounded-md bg-[#0891B2]/10 text-[#0891B2] border border-[#0891B2]/20 text-[10px] font-semibold flex items-center gap-1 hover:bg-[#0891B2]/20 transition-colors"
          @click="openCreateModalWithTemplate('ayu')"
        >
          <Icon name="lucide:pen-tool" class="w-2.5 h-2.5" />
          Ayu
        </button>
        <button
          class="px-2.5 py-1 rounded-md bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 text-[10px] font-semibold flex items-center gap-1 hover:bg-[#16A34A]/20 transition-colors"
          @click="openCreateModalWithTemplate('martin')"
        >
          <Icon name="lucide:bug" class="w-2.5 h-2.5" />
          Martin
        </button>
      </div>
    </div>
    <p class="text-xs text-surface-400 mb-6">{{ agentCounts.total }} agents across all workspaces</p>

    <!-- Stats bar -->
    <div class="flex gap-3 sm:gap-5 mb-6 p-3.5 bg-white border border-surface-200 rounded-xl flex-wrap">
      <div class="flex items-center gap-2">
        <span class="w-[9px] h-[9px] rounded-full bg-green-500" />
        <span class="font-bold text-sm">{{ agentCounts.idle }}</span>
        <span class="text-[10px] text-surface-400">Idle</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-[9px] h-[9px] rounded-full bg-accent" />
        <span class="font-bold text-sm">{{ agentCounts.busy }}</span>
        <span class="text-[10px] text-surface-400">Busy</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-[9px] h-[9px] rounded-full bg-surface-400" />
        <span class="font-bold text-sm">{{ agentCounts.offline }}</span>
        <span class="text-[10px] text-surface-400">Offline</span>
      </div>
      <div class="flex items-center gap-2 sm:ml-auto">
        <span class="font-bold text-sm">{{ agentCounts.total }}</span>
        <span class="text-[10px] text-surface-400">Total</span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <Icon name="lucide:loader-circle" class="w-5 h-5 text-surface-400 animate-spin" />
    </div>

    <!-- Empty state -->
    <div v-else-if="agents.length === 0" class="text-center py-16 text-surface-400">
      <Icon name="lucide:bot" class="w-8 h-8 mx-auto mb-3" />
      <p class="text-xs mb-4">No agents yet. Create your first agent to get started.</p>
      <button
        class="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors"
        @click="openCreateModal()"
      >
        + Add Agent
      </button>
    </div>

    <!-- Agent grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3.5">
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="border rounded-xl p-[18px] hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-150"
        :class="getAgentStatus(agent.id) === 'offline' ? 'bg-surface-50 border-surface-300 opacity-70' : 'bg-white border-surface-200'"
      >
        <div class="flex items-center gap-3 mb-2.5">
          <div
            class="relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            :style="{ background: agent.color }"
          >
            {{ agent.initials }}
            <span
              class="absolute bottom-0 right-0 w-[10px] h-[10px] rounded-full border-2 border-white"
              :class="statusDotClass(getAgentStatus(agent.id))"
            />
          </div>
          <div class="min-w-0">
            <div class="text-sm font-semibold">{{ agent.name }}</div>
            <div class="text-[10px] text-surface-400 mt-0.5">{{ agent.role }}</div>
          </div>
        </div>

        <div class="text-[10px] text-surface-400 mb-2.5 flex items-center gap-1.5">
          <Icon name="lucide:briefcase" class="w-2.5 h-2.5 text-accent" />
          {{ agent.projectName || 'Global pool' }}
        </div>

        <div class="flex items-center gap-2.5 flex-wrap mb-2.5">
          <span class="text-[9px] font-semibold flex items-center gap-1">
            <span
              class="w-[6px] h-[6px] rounded-full"
              :class="statusDotClass(getAgentStatus(agent.id))"
            />
            {{ statusLabel(getAgentStatus(agent.id)) }}
          </span>
          <span
            v-if="agent.browserEnabled"
            class="text-[9px] font-semibold flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
          >
            <Icon name="lucide:globe" class="w-2.5 h-2.5" />
            Browser
          </span>
          <span
            v-if="agent.repositoryRequired === false"
            class="text-[9px] font-semibold flex items-center gap-1 text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded"
          >
            <Icon name="lucide:external-link" class="w-2.5 h-2.5" />
            External
          </span>
        </div>

        <div class="p-2 bg-surface-50 rounded-md text-[10px] text-surface-400 leading-snug border-l-[3px] border-accent line-clamp-3">
          <strong class="text-surface-900 font-semibold">Purpose:</strong> {{ agent.purpose }}
        </div>

        <!-- Current Tasks -->
        <div v-if="getAgentCurrentTasks(agent.id).length > 0" class="mt-2.5">
          <div class="text-[9px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Current Tasks</div>
          <div class="space-y-1.5">
            <div
              v-for="task in getAgentCurrentTasks(agent.id).slice(0, 3)"
              :key="task.taskId"
              class="p-2 rounded-md border text-[10px] leading-snug"
              :class="task.status === 'running'
                ? 'bg-accent/5 border-accent/20'
                : task.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-green-50 border-green-200'"
            >
              <div class="flex items-center gap-1.5 mb-0.5">
                <span
                  class="w-[6px] h-[6px] rounded-full flex-shrink-0"
                  :class="task.status === 'running' ? 'bg-accent animate-pulse' : task.status === 'error' ? 'bg-red-400' : 'bg-green-500'"
                />
                <span class="font-semibold text-surface-900 truncate">{{ task.taskTitle }}</span>
                <span
                  class="ml-auto text-[8px] font-semibold uppercase flex-shrink-0"
                  :class="task.status === 'running' ? 'text-accent' : task.status === 'error' ? 'text-red-500' : 'text-green-600'"
                >{{ task.status }}</span>
              </div>
              <div v-if="task.branchName" class="text-[9px] text-surface-400 font-mono truncate">
                <Icon name="lucide:git-branch" class="w-2 h-2" /> {{ task.branchName }}
              </div>
              <div v-if="task.filesChanged.length > 0" class="text-[9px] text-surface-400 mt-0.5">
                {{ task.filesChanged.length }} file{{ task.filesChanged.length !== 1 ? 's' : '' }} changed
              </div>
              <div v-if="task.summary" class="text-[9px] text-surface-500 mt-0.5 line-clamp-2">{{ task.summary }}</div>
            </div>
          </div>
        </div>

        <div class="flex gap-1.5 mt-2.5 pt-2.5 border-t border-surface-200">
          <button
            class="px-2.5 py-1 rounded text-[9px] font-semibold border border-surface-200 hover:bg-surface-50 transition-colors flex items-center gap-1"
            @click="openEditModal(agent)"
          >
            <Icon name="lucide:pencil" class="w-2.5 h-2.5" />
            Edit
          </button>
          <button
            class="px-2.5 py-1 rounded text-[9px] font-semibold border border-accent text-accent hover:bg-red-50 transition-colors flex items-center gap-1"
            :disabled="deletingId === agent.id"
            :class="{ 'opacity-60 cursor-wait': deletingId === agent.id }"
            @click="handleDelete(agent)"
          >
            <svg v-if="deletingId === agent.id" class="animate-spin w-2.5 h-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <Icon v-else name="lucide:trash-2" class="w-2.5 h-2.5" />
            {{ deletingId === agent.id ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        @click.self="showDeleteConfirm = false"
      >
        <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-sm p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Icon name="lucide:alert-triangle" class="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-surface-900">Delete Agent</h3>
              <p class="text-xs text-surface-500 mt-0.5">This action cannot be undone</p>
            </div>
          </div>
          <p class="text-xs text-surface-600 mb-4">
            Are you sure you want to delete <span class="font-medium">{{ agentToDelete?.name }}</span>? This will remove the agent and cannot be recovered.
          </p>
          <div class="flex items-center justify-end gap-2">
            <button
              class="px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-600 hover:bg-surface-50 transition-colors"
              @click="showDeleteConfirm = false"
            >
              Cancel
            </button>
            <button
              class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
              :disabled="deletingId === agentToDelete?.id"
              :class="{ 'opacity-60 cursor-wait': deletingId === agentToDelete?.id }"
              @click="executeDelete"
            >
              <svg v-if="deletingId === agentToDelete?.id" class="animate-spin w-3 h-3 inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              {{ deletingId === agentToDelete?.id ? 'Deleting...' : 'Delete Agent' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Create/Edit Agent Modal (simple inline overlay) -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4"
        @click.self="closeModal"
      >
        <div class="bg-white rounded-xl w-[440px] max-w-[calc(100vw-16px)] sm:max-w-[calc(100vw-40px)] shadow-lg max-h-[90vh] overflow-y-auto">
          <div class="flex items-center gap-3 px-5 py-4 border-b border-surface-200">
            <h3 class="text-sm font-semibold flex-1">{{ editingAgent ? 'Edit Agent' : 'New Agent' }}</h3>
            <button
              class="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-100 transition-colors"
              @click="closeModal"
            >
              <Icon name="lucide:x" class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="p-5">
            <div class="mb-4">
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Agent Name</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="e.g. Codex Prime"
                class="w-full py-2 px-3 rounded-lg border border-surface-200 bg-surface-50 text-xs outline-none focus:border-accent focus:bg-white transition-colors"
              />
            </div>
            <div class="mb-4">
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Role / Title</label>
              <input
                v-model="form.role"
                type="text"
                placeholder="e.g. Senior Review Agent"
                class="w-full py-2 px-3 rounded-lg border border-surface-200 bg-surface-50 text-xs outline-none focus:border-accent focus:bg-white transition-colors"
              />
            </div>
            <div class="mb-4">
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Runtime CLI</label>
              <select
                v-model="form.runtime"
                class="w-full py-2 px-3 rounded-lg border border-surface-200 bg-surface-50 text-xs outline-none focus:border-accent focus:bg-white transition-colors"
              >
                <option v-for="runtime in runtimes" :key="runtime.id" :value="runtime.id">
                  {{ runtime.name }} — {{ runtime.desc }}
                </option>
              </select>
            </div>
            <div class="mb-4 flex flex-col gap-2">
              <label class="flex items-center gap-2 text-xs text-surface-700 cursor-pointer">
                <input v-model="form.browserEnabled" type="checkbox" class="rounded border-surface-300 text-accent focus:ring-accent" />
                <span>Browser — enable Chrome DevTools MCP (headless, uses agent LLM)</span>
              </label>
              <label class="flex items-center gap-2 text-xs text-surface-700 cursor-pointer">
                <input v-model="form.repositoryRequired" type="checkbox" class="rounded border-surface-300 text-accent focus:ring-accent" />
                <span>Repository — require task repository / worktree</span>
              </label>
            </div>
            <div class="mb-4">
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Specialization / Purpose</label>
              <textarea
                v-model="form.purpose"
                placeholder="Describe what this agent specializes in..."
                class="w-full py-2 px-3 rounded-lg border border-surface-200 bg-surface-50 text-xs outline-none focus:border-accent focus:bg-white transition-colors resize-vertical min-h-[60px]"
              />
              <div class="text-[9px] text-surface-400 mt-1">This prompt defines the agent's behavior and task focus</div>
            </div>
            <div class="mb-4">
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Status</label>
              <select
                v-model="form.status"
                class="w-full py-2 px-3 rounded-lg border border-surface-200 bg-surface-50 text-xs outline-none focus:border-accent focus:bg-white transition-colors"
              >
                <option value="idle">Idle</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div class="mb-4">
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Color</label>
              <div class="flex gap-2 flex-wrap">
                <div
                  v-for="c in agentColors"
                  :key="c"
                  class="w-8 h-8 rounded-full cursor-pointer border-[3px] transition-transform hover:scale-110"
                  :class="form.color === c ? '!border-surface-900' : 'border-transparent'"
                  :style="{ background: c }"
                  @click="form.color = c"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 justify-end px-5 py-3.5 border-t border-surface-200">
            <button
              class="px-4 py-2 rounded-lg border border-surface-200 text-[11px] font-semibold hover:bg-surface-50 transition-colors"
              @click="closeModal"
            >Cancel</button>
          <button
            class="px-4 py-2 rounded-lg bg-accent text-white text-[11px] font-semibold hover:bg-accent-hover transition-colors flex items-center gap-1.5"
            :disabled="saving"
            :class="{ 'opacity-70 cursor-wait': saving }"
            @click="saveAgent"
          >
            <svg v-if="saving" class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {{ editingAgent ? 'Save Changes' : 'Create Agent' }}
          </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Agent, AgentStatus } from '~/types'

definePageMeta({
  layout: 'default',
})

const { agents, loading, agentCounts, runtimeInfo, runtimes, getAgentStatus, runtimeReachable, fetchAgents, fetchHealth, createAgent, updateAgent, deleteAgent: deleteAgentApi, getAgentCurrentTasks, defaultRuntime, resolveTemplateRuntime } = useAgent()
const { addLog } = useLog()

let healthInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchAgents()
  healthInterval = setInterval(() => {
    fetchHealth()
  }, 5000)
})

onUnmounted(() => {
  if (healthInterval) clearInterval(healthInterval)
})

const agentColors = ['#7C3AED', '#2563EB', '#DC2626', '#D97706', '#0891B2', '#16A34A', '#EC4899', '#6366F1']

const showModal = ref(false)
const editingAgent = ref<Agent | null>(null)
const saving = ref(false)
const deletingId = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const agentToDelete = ref<Agent | null>(null)

const form = reactive({
  name: '',
  role: 'Custom Agent',
  runtime: defaultRuntime.value!,
  purpose: '',
  status: 'idle' as AgentStatus,
  color: '#7C3AED',
  browserEnabled: false,
  repositoryRequired: true,
})

function openCreateModal() {
  editingAgent.value = null
  resetForm()
  showModal.value = true
}

const agentTemplates: Record<string, Partial<typeof form>> = {
  raihan: {
    name: 'Raihan',
    role: 'Software Engineer',
    runtime: 'opencode',
    purpose: 'Expert software engineer specializing in full-stack development, code review, debugging, and system architecture. Writes clean, maintainable code and provides technical guidance on best practices.',
    status: 'idle',
    color: '#2563EB',
  },
  ayu: {
    name: 'Ayu',
    role: 'Technical Writer',
    runtime: 'opencode',
    purpose: 'Skilled technical writer focused on creating clear documentation, API guides, user manuals, and release notes. Translates complex technical concepts into accessible content for diverse audiences.',
    status: 'idle',
    color: '#0891B2',
  },
  martin: {
    name: 'Martin',
    role: 'QA Engineer',
    runtime: 'opencode',
    purpose: 'Detail-oriented QA engineer responsible for test planning, automated testing, bug triage, and quality assurance workflows. Ensures software reliability through rigorous testing and clear defect reporting.',
    status: 'idle',
    color: '#16A34A',
    browserEnabled: true,
    repositoryRequired: false,
  },
}

function openCreateModalWithTemplate(templateKey: string) {
  const template = agentTemplates[templateKey]
  if (!template) return
  editingAgent.value = null
  form.name = template.name || ''
  form.role = template.role || 'Custom Agent'
  form.runtime = resolveTemplateRuntime(template.runtime || defaultRuntime.value)
  form.purpose = template.purpose || ''
  form.status = (template.status as AgentStatus) || 'idle'
  form.color = template.color || '#7C3AED'
  form.browserEnabled = template.browserEnabled ?? false
  form.repositoryRequired = template.repositoryRequired ?? true
  showModal.value = true
}

function openEditModal(agent: Agent) {
  editingAgent.value = agent
  form.name = agent.name
  form.role = agent.role
  form.runtime = resolveTemplateRuntime(agent.runtime)
  form.purpose = agent.purpose
  form.status = agent.status
  form.color = agent.color
  form.browserEnabled = agent.browserEnabled ?? false
  form.repositoryRequired = agent.repositoryRequired ?? true
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingAgent.value = null
  resetForm()
}

function resetForm() {
  form.name = ''
  form.role = 'Custom Agent'
  form.runtime = defaultRuntime.value
  form.purpose = ''
  form.status = 'idle'
  form.color = '#7C3AED'
  form.browserEnabled = false
  form.repositoryRequired = true
}

async function saveAgent() {
  if (!form.name.trim() || saving.value) return

  saving.value = true
  try {
    const payload = {
      ...form,
      runtime: resolveTemplateRuntime(form.runtime),
    }
    if (editingAgent.value) {
      await updateAgent(editingAgent.value.id, payload)
      addLog('System', `Updated agent "${form.name}"`)
    } else {
      await createAgent(payload)
      addLog('System', `Created agent "${form.name}"`)
    }
    closeModal()
  } finally {
    saving.value = false
  }
}

function handleDelete(agent: Agent) {
  agentToDelete.value = agent
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!agentToDelete.value) return
  const agent = agentToDelete.value
  deletingId.value = agent.id
  try {
    await deleteAgentApi(agent.id)
    addLog('System', `Deleted agent "${agent.name}"`)
    showDeleteConfirm.value = false
    agentToDelete.value = null
  } finally {
    deletingId.value = null
  }
}

function runtimeName(id: string) {
  return runtimeInfo[id]?.name || 'Custom CLI'
}

function runtimeIcon(id: string) {
  return runtimeInfo[id]?.icon || 'lucide:cog'
}

const statusDotClass = (status: string) => ({
  'bg-green-500': status === 'idle',
  'bg-accent': status === 'busy',
  'bg-surface-400': status === 'offline',
})

const statusLabel = (status: string) => {
  const m: Record<string, string> = { idle: 'Idle', busy: 'Busy', offline: 'Offline' }
  return m[status] || status
}
</script>
