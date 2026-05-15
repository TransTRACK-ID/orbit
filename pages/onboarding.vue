<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-50 px-4">
    <div class="w-full max-w-md">
      <!-- Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center gap-1.5 mb-3">
          <Icon name="lucide:orbit" class="w-5 h-5 text-accent" />
          <span class="text-sm font-bold tracking-tight text-surface-900">Orbit</span>
        </div>
        <h1 class="text-lg font-semibold text-surface-900">Let's get you set up</h1>
        <p class="text-[11px] text-surface-500 mt-1">Two quick steps and you're ready to go</p>
      </div>

      <!-- Progress dots -->
      <div class="flex items-center justify-center gap-2 mb-6">
        <div
          class="w-2 h-2 rounded-full transition-colors"
          :class="step >= 1 ? 'bg-accent' : 'bg-surface-300'"
        />
        <div
          class="w-2 h-2 rounded-full transition-colors"
          :class="step >= 2 ? 'bg-accent' : 'bg-surface-300'"
        />
        <div
          class="w-2 h-2 rounded-full transition-colors"
          :class="step >= 3 ? 'bg-accent' : 'bg-surface-300'"
        />
      </div>

      <!-- Card -->
      <div class="bg-white rounded-xl border border-surface-200 p-8">
        <!-- Step 1: Create workspace -->
        <div v-if="step === 1">
          <h2 class="text-sm font-semibold text-surface-900 mb-1">Create your workspace</h2>
          <p class="text-[11px] text-surface-500 mb-5">This is where your projects live.</p>

          <div class="space-y-4">
            <div>
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Workspace name</label>
              <TextInput
                v-model="workspaceName"
                type="text"
                placeholder="Acme Inc or Personal"
                :error-message="step1Error"
                @input="step1Error = ''"
              />
              <p class="text-[11px] text-surface-500 mt-1.5">
                Slug: <span class="font-mono text-surface-700">{{ workspaceSlug }}</span>
              </p>
            </div>

            <Button class="w-full" :loading="step1Loading" @click="handleCreateWorkspace">
              Continue
            </Button>
          </div>
        </div>

        <!-- Step 2: Create project -->
        <div v-else-if="step === 2">
          <h2 class="text-sm font-semibold text-surface-900 mb-1">Create your first project</h2>
          <p class="text-[11px] text-surface-500 mb-5">You can add more later.</p>

          <div class="space-y-4">
            <div>
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Project name</label>
              <TextInput
                v-model="projectName"
                type="text"
                placeholder="Website Redesign"
                :error-message="step2Error"
                @input="step2Error = ''"
              />
            </div>

            <label class="flex items-start gap-2.5 cursor-pointer">
              <input
                v-model="addSampleTasks"
                type="checkbox"
                class="mt-0.5 w-3.5 h-3.5 rounded border-surface-300 text-accent focus:ring-accent"
              />
              <span class="text-[11px] text-surface-600 leading-snug">
                Add sample tasks so I can see how it works
              </span>
            </label>

            <Button class="w-full" :loading="step2Loading" @click="handleCreateProject">
              Create Project
            </Button>
          </div>
        </div>

        <!-- Step 3: All set -->
        <div v-if="step === 3" class="text-center max-w-md mx-auto">
          <!-- Success Icon -->
          <div
            class="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4"
          >
            <Icon name="lucide:check" class="w-7 h-7 text-accent" />
          </div>

          <!-- Headline -->
          <h2 class="text-lg font-semibold text-surface-900 mb-2">
            {{ agentCreated ? 'Agent ready!' : 'Your workspace is ready' }}
          </h2>

          <!-- Subtitle -->
          <p class="text-sm text-surface-500 mb-6 max-w-xs mx-auto">
            {{
              agentCreated
                ? `${selectedTemplate?.name} is set up and ready to help. You can always add more agents later from the Agents page.`
                : 'Want to supercharge your workflow? Add an AI agent now, or do it later from your Agents page.'
            }}
          </p>

          <!-- Error Banner -->
          <div
            v-if="agentError"
            class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-left"
          >
            <p class="text-xs text-red-700">{{ agentError }}</p>
          </div>

          <!-- Template Selector (only shown if not yet created) -->
          <template v-if="!agentCreated">
            <div class="grid grid-cols-3 gap-3 mb-6">
              <button
                v-for="template in agentTemplates"
                :key="template.key"
                :disabled="creatingAgent"
                :class="[
                  'p-3 rounded-xl border transition-all text-left relative overflow-hidden',
                  selectedTemplate?.key === template.key && !agentError
                    ? 'border-accent bg-accent/5 ring-1 ring-accent'
                    : 'border-surface-200 hover:border-accent/50 hover:bg-surface-50',
                  creatingAgent && selectedTemplate?.key !== template.key ? 'opacity-50' : '',
                ]"
                @click="createAgentFromTemplate(template)"
              >
                <!-- Avatar -->
                <div
                  class="w-10 h-10 rounded-full mb-2 flex items-center justify-center text-white text-xs font-bold"
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

                <!-- Loading overlay for the clicked template -->
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
          <div class="flex flex-col gap-2">
            <button
              v-if="!agentCreated"
              class="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm font-semibold text-surface-700 hover:bg-surface-50 transition-colors"
              @click="goToBoard"
            >
              Skip for now
            </button>

            <button
              class="w-full px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="creatingAgent"
              @click="goToBoard"
            >
              {{
                agentCreated
                  ? 'Go to your board'
                  : 'Continue without agent'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const { createWorkspace } = useWorkspace()
const { createProject, fetchProjectDetail, projectStatuses } = useProject()
const { completeOnboarding } = useOnboarding()
const { createAgent } = useAgent()

const step = ref<1 | 2 | 3>(1)
const workspaceName = ref('')
const projectName = ref('')
const addSampleTasks = ref(true)
const step1Loading = ref(false)
const step2Loading = ref(false)
const step1Error = ref('')
const step2Error = ref('')

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
        } catch (e) {
          console.warn('Failed to create sample task:', task.title, e)
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
    await createAgent({
      name: template.name,
      role: template.role,
      runtime: template.runtime,
      purpose: template.purpose,
      status: template.status as any,
      color: template.color,
    })

    agentCreated.value = true
    // Signal that we should show the tooltip on the next board visit
    sessionStorage.setItem('orbit_show_agent_tooltip', 'true')
  } catch (err: any) {
    console.error('Failed to create agent:', err)
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
</script>
