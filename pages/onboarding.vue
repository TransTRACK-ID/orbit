<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-50 px-4">
    <div class="w-full max-w-md">
      <!-- Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center gap-1.5 mb-3">
          <Icon name="lucide:bolt" class="w-5 h-5 text-accent" />
          <span class="text-sm font-bold tracking-tight text-surface-900">Kanvas</span>
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
                :error="step1Error"
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
                :error="step2Error"
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
        <div v-else-if="step === 3" class="text-center">
          <div class="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Icon name="lucide:check" class="w-6 h-6 text-accent" />
          </div>
          <h2 class="text-sm font-semibold text-surface-900 mb-1">Your workspace is ready</h2>
          <p class="text-[11px] text-surface-500 mb-6">You're all set to start organizing your work.</p>

          <Button class="w-full" @click="goToBoard">
            Go to your board
          </Button>
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

function goToBoard() {
  if (createdWorkspace.value && createdProject.value) {
    navigateTo(`/workspaces/${createdWorkspace.value.slug}/projects/${createdProject.value.id}/board`)
  } else {
    navigateTo('/workspaces')
  }
}
</script>
