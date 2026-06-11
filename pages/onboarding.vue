<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-50 px-4 relative overflow-hidden">
    <!-- Ambient warm glow -->
    <div
      class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-40 pointer-events-none"
      style="background: radial-gradient(ellipse at center, rgb(207 81 61 / 0.06), transparent 70%);"
    />
    <div
      class="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none"
      style="background: radial-gradient(ellipse at center, rgb(207 81 61 / 0.04), transparent 65%);"
    />

    <div class="w-full max-w-md relative z-10 animate-scale-in-slow">
      <!-- Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Icon name="lucide:orbit" class="w-5 h-5 text-accent" />
          </div>
          <span class="text-base font-bold tracking-tight text-surface-900">Orbit</span>
        </div>
        <h1 class="text-xl font-semibold text-surface-900">Let's get you set up</h1>
        <p class="text-xs text-surface-500 mt-1.5">Two steps to your first project</p>
      </div>

      <!-- Progress dots -->
      <div class="flex items-center justify-center gap-2 mb-6">
        <div
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="step >= 1 ? 'bg-accent scale-100' : 'bg-surface-300 scale-75'"
        />
        <div
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="step >= 2 ? 'bg-accent scale-100' : 'bg-surface-300 scale-75'"
        />
        <div
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="step >= 3 ? 'bg-accent scale-100' : 'bg-surface-300 scale-75'"
        />
      </div>

      <!-- Card -->
      <div class="bg-white rounded-xl border border-surface-200 shadow-sm p-6">
        <Transition
          mode="out-in"
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <!-- Step 1: Create workspace -->
          <div v-if="step === 1" key="step1">
            <h2 class="text-base font-semibold text-surface-900 mb-1">Create your workspace</h2>
            <p class="text-xs text-surface-500 mb-5">Where your projects and teams live.</p>

            <div class="space-y-5">
              <div class="onboarding-field" style="--delay: 0ms;">
                <label class="block text-xs font-medium text-surface-600 mb-1.5">Workspace name</label>
                <TextInput
                  ref="workspaceInput"
                  v-model="workspaceName"
                  type="text"
                  placeholder="Acme Inc or Personal"
                  :error-message="step1Error"
                  @input="step1Error = ''"
                  @keydown.enter="handleCreateWorkspace"
                />
                <p class="text-xs text-surface-500 mt-1.5">
                  Slug: <span class="font-mono text-surface-700">{{ workspaceSlug }}</span>
                </p>
              </div>

              <div class="onboarding-field" style="--delay: 80ms;">
                <Button
                  class="w-full transition-all duration-150 active:scale-[0.98]"
                  :loading="step1Loading"
                  @click="handleCreateWorkspace"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>

          <!-- Step 2: Create project -->
          <div v-else-if="step === 2" key="step2">
            <h2 class="text-base font-semibold text-surface-900 mb-1">Create your first project</h2>
            <p class="text-xs text-surface-500 mb-5">Start with something simple.</p>

            <div class="space-y-5">
              <div class="onboarding-field" style="--delay: 0ms;">
                <label class="block text-xs font-medium text-surface-600 mb-1.5">Project name</label>
                <TextInput
                  ref="projectInput"
                  v-model="projectName"
                  type="text"
                  placeholder="Website Redesign"
                  :error-message="step2Error"
                  @input="step2Error = ''"
                  @keydown.enter="handleCreateProject"
                />
              </div>

              <div class="onboarding-field" style="--delay: 60ms;">
                <label class="flex items-start gap-2.5 cursor-pointer">
                  <input
                    v-model="addSampleTasks"
                    type="checkbox"
                    class="mt-0.5 w-3.5 h-3.5 rounded border-surface-300 text-accent focus:ring-accent transition-colors"
                  />
                  <span class="text-xs text-surface-600 leading-snug">
                    Add sample tasks to explore the board
                  </span>
                </label>
              </div>

              <div class="onboarding-field flex flex-col gap-2" style="--delay: 120ms;">
                <Button
                  class="w-full transition-all duration-150 active:scale-[0.98]"
                  :loading="step2Loading"
                  @click="handleCreateProject"
                >
                  Create project
                </Button>
                <button
                  class="w-full px-3 py-2.5 rounded-lg text-sm font-medium text-surface-500 hover:text-surface-700 hover:bg-surface-50 transition-all duration-150 active:scale-[0.98]"
                  @click="step = 1"
                >
                  Back
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3: All set -->
          <div v-else-if="step === 3" key="step3" class="text-center">
            <!-- Success Icon -->
            <div
              class="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4 animate-celebrate"
            >
              <Icon name="lucide:check" class="w-7 h-7 text-accent" />
            </div>

            <!-- Headline -->
            <h2 class="text-xl font-semibold text-surface-900 mb-2">
              {{ agentCreated ? 'Agent ready!' : 'Your workspace is ready' }}
            </h2>

            <!-- Subtitle -->
            <p class="text-xs text-surface-500 mb-6 max-w-xs mx-auto leading-relaxed">
              {{
                agentCreated
                  ? `${selectedTemplate?.name} is set up and ready. Add more agents anytime from the Agents page.`
                  : 'Add an AI agent now, or set one up later from your Agents page.'
              }}
            </p>

            <!-- Error Banner -->
            <Transition
              enter-active-class="transition-all duration-300 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-all duration-200 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-if="agentError"
                class="flex items-start gap-2 mb-4 p-2.5 rounded-lg bg-error-50 border border-error-100 text-left"
              >
                <Icon name="lucide:alert-circle" class="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
                <p class="text-xs text-error-600">{{ agentError }}</p>
              </div>
            </Transition>

            <!-- Template Selector -->
            <template v-if="!agentCreated">
              <div class="grid grid-cols-3 gap-3 mb-6">
                <button
                  v-for="(template, index) in agentTemplates"
                  :key="template.key"
                  :disabled="creatingAgent"
                  :class="[
                    'agent-card p-3 rounded-xl border transition-all duration-200 text-left relative overflow-hidden',
                    selectedTemplate?.key === template.key && !agentError
                      ? 'border-accent bg-accent/5 ring-1 ring-accent scale-[1.02] shadow-sm'
                      : 'border-surface-200 hover:border-accent/50 hover:bg-surface-50 hover:-translate-y-px hover:shadow-sm',
                    creatingAgent && selectedTemplate?.key !== template.key ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ]"
                  :style="{ '--delay': `${index * 80}ms` }"
                  @click="createAgentFromTemplate(template)"
                >
                  <!-- Selected checkmark -->
                  <div
                    v-if="selectedTemplate?.key === template.key && !agentError"
                    class="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center"
                  >
                    <Icon name="lucide:check" class="w-2.5 h-2.5 text-white" />
                  </div>

                  <!-- Avatar -->
                  <div
                    class="w-10 h-10 rounded-full mb-2 flex items-center justify-center text-white text-xs font-bold transition-transform duration-200"
                    :class="{ 'scale-110': selectedTemplate?.key === template.key }"
                    :style="{ background: template.color }"
                  >
                    {{ template.name.charAt(0) }}
                  </div>
                  <div class="text-xs font-semibold text-surface-900">
                    {{ template.name }}
                  </div>
                  <div class="text-[10px] text-surface-500">
                    {{ template.role }}
                  </div>

                  <!-- Loading overlay -->
                  <div
                    v-if="creatingAgent && selectedTemplate?.key === template.key"
                    class="absolute inset-0 bg-white/80 flex items-center justify-center"
                  >
                    <Icon
                      name="lucide:loader-2"
                      class="w-5 h-5 text-accent animate-spin"
                    />
                  </div>
                </button>
              </div>
            </template>

            <!-- Action Buttons -->
            <div class="flex flex-col gap-2 onboarding-field" style="--delay: 0ms;">
              <Button
                v-if="!agentCreated"
                class="w-full transition-all duration-150 active:scale-[0.98]"
                color="default"
                @click="goToBoard"
              >
                Skip for now
              </Button>

              <Button
                class="w-full transition-all duration-150 active:scale-[0.98]"
                :loading="creatingAgent"
                @click="goToBoard"
              >
                {{ agentCreated ? 'Go to board' : 'Continue' }}
              </Button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const { data: authData, status: authStatus } = useAuth()
const { createWorkspace } = useWorkspace()
const { createProject, fetchProjectDetail, projectStatuses } = useProject()
const { completeOnboarding } = useOnboarding()
const { createAgent, resolveTemplateRuntime, defaultRuntime, fetchEnabledRuntimes } = useAgent()

const step = ref<1 | 2 | 3>(1)
const workspaceName = ref('')
const projectName = ref('')
const addSampleTasks = ref(true)
const step1Loading = ref(false)
const step2Loading = ref(false)
const step1Error = ref('')
const step2Error = ref('')

// Template refs for focus management
const workspaceInput = ref<any>(null)
const projectInput = ref<any>(null)

const createdWorkspace = ref<any>(null)
const createdProject = ref<any>(null)

// --- Agent Power-Up Data ---
const agentTemplates = [
  {
    key: 'raihan',
    name: 'Raihan',
    role: 'Software Engineer',
    runtime: 'opencode',
    purpose: 'Full-stack development, code review, debugging, and implementing feature requests across the codebase.',
    color: '#6366F1',
    status: 'idle',
  },
  {
    key: 'ayu',
    name: 'Ayu',
    role: 'Technical Writer',
    runtime: 'opencode',
    purpose: 'Documentation, API guides, README improvements, and technical blog posts.',
    color: '#EC4899',
    status: 'idle',
  },
  {
    key: 'martin',
    name: 'Martin',
    role: 'QA Engineer',
    runtime: 'opencode',
    purpose: 'Testing, bug triage, writing test cases, and validating fixes across projects.',
    color: '#10B981',
    status: 'idle',
  },
]

const selectedTemplate = ref<typeof agentTemplates[0] | null>(null)
const creatingAgent = ref(false)
const agentCreated = ref(false)
const agentError = ref<string | null>(null)

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 255)
}

const workspaceSlug = computed(() => generateSlug(workspaceName.value))

async function handleCreateWorkspace() {
  step1Error.value = ''
  if (!workspaceName.value.trim()) {
    step1Error.value = 'Workspace name is required'
    return
  }

  step1Loading.value = true
  try {
    const workspace = await createWorkspace({
      name: workspaceName.value.trim(),
      slug: workspaceSlug.value,
    })
    createdWorkspace.value = workspace
    step.value = 2
    // Focus project input on next tick
    nextTick(() => {
      projectInput.value?.$el?.querySelector('input')?.focus()
    })
  } catch (err: any) {
    step1Error.value = err?.data?.message || 'Failed to create workspace. Try a different name.'
  } finally {
    step1Loading.value = false
  }
}

async function handleCreateProject() {
  step2Error.value = ''
  if (!projectName.value.trim()) {
    step2Error.value = 'Project name is required'
    return
  }

  step2Loading.value = true
  try {
    const workspaceId = createdWorkspace.value.id
    const project = await createProject(workspaceId, {
      name: projectName.value.trim(),
      color: '#6366F1',
    })
    createdProject.value = project

    // Fetch project detail to get statuses for sample tasks
    await fetchProjectDetail(project.id)

    if (addSampleTasks.value) {
      const todoStatus = projectStatuses.value.find((s: any) => s.name.toLowerCase() === 'todo')
      const backlogStatus = projectStatuses.value.find((s: any) => s.name.toLowerCase() === 'backlog')

      const sampleTasks = [
        { title: 'Explore your kanban board', statusId: todoStatus?.id, priority: 'medium' },
        { title: 'Invite a team member', statusId: backlogStatus?.id, priority: 'medium' },
        { title: 'Create your first task', statusId: todoStatus?.id, priority: 'medium' },
        { title: 'Set up a Git repository', statusId: backlogStatus?.id, priority: 'medium' },
      ]

      for (const task of sampleTasks) {
        if (!task.statusId) continue
        try {
          await $fetch(`/api/projects/${project.id}/tasks`, {
            method: 'POST',
            body: {
              title: task.title,
              statusId: task.statusId,
              priority: task.priority,
              repositoryId: null,
            },
          })
        } catch {
          // Silently ignore sample task creation failures
        }
      }
    }

    await completeOnboarding()
    step.value = 3
  } catch (err: any) {
    step2Error.value = err?.data?.message || 'Failed to create project. Please try again.'
  } finally {
    step2Loading.value = false
  }
}

async function createAgentFromTemplate(template: typeof agentTemplates[0]) {
  selectedTemplate.value = template
  creatingAgent.value = true
  agentError.value = null

  try {
    await fetchEnabledRuntimes()
    await createAgent({
      name: template.name,
      role: template.role,
      runtime: resolveTemplateRuntime(template.runtime),
      purpose: template.purpose,
      status: template.status as any,
      color: template.color,
    })

    agentCreated.value = true
    // Signal that we should show the tooltip on the next board visit
    sessionStorage.setItem('orbit_show_agent_tooltip', 'true')
  } catch (err: any) {
    agentError.value = err?.message || 'Failed to create agent. You can set this up later.'
    selectedTemplate.value = null
  } finally {
    creatingAgent.value = false
  }
}

function goToBoard() {
  // If they skipped agent creation, don't show the tooltip later
  if (!agentCreated.value) {
    sessionStorage.removeItem('orbit_show_agent_tooltip')
  }

  if (createdWorkspace.value && createdProject.value) {
    navigateTo(`/workspaces/${createdWorkspace.value.slug}/projects/${createdProject.value.id}/board`)
  } else {
    navigateTo('/workspaces')
  }
}

// Auto-create workspace on mount and skip to project creation
onMounted(async () => {
  // Wait for auth session to be ready
  if (authStatus.value === 'loading') {
    const unwatch = watch(authStatus, async (newStatus) => {
      if (newStatus !== 'loading') {
        unwatch()
        await autoCreateWorkspace()
      }
    })
  } else if (authStatus.value === 'authenticated') {
    await autoCreateWorkspace()
  }
})

async function autoCreateWorkspace() {
  step1Loading.value = true
  try {
    const workspace = await $fetch('/api/workspaces/auto-create', {
      method: 'POST',
    })
    createdWorkspace.value = workspace
    step.value = 2
    // Focus project input on next tick
    nextTick(() => {
      projectInput.value?.$el?.querySelector('input')?.focus()
    })
  } catch (err: any) {
    console.error('Failed to auto-create workspace:', err)
    // If auto-create fails, let user manually create it
    workspaceName.value = authData.value?.user?.name || ''
    nextTick(() => {
      workspaceInput.value?.$el?.querySelector('input')?.focus()
    })
  } finally {
    step1Loading.value = false
  }
}
</script>

<style scoped>
/* Onboarding field stagger animation */
.onboarding-field {
  opacity: 0;
  transform: translateY(10px);
  animation: stepIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--delay, 0ms);
}

/* Agent card entrance stagger */
.agent-card {
  opacity: 0;
  transform: translateY(8px);
  animation: stepIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--delay, 0ms);
}

@keyframes stepIn {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Ensure animations respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .onboarding-field,
  .agent-card {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }
}
</style>
