<template>
  <div class="flex-1 overflow-y-auto py-5 px-4 sm:py-7 sm:px-8">
    <div v-if="workspace">
      <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div class="min-w-0">
          <h1 class="text-xl font-bold text-surface-900">{{ workspace.name }}</h1>
          <p v-if="workspace.description" class="text-sm text-surface-500 mt-1">{{ workspace.description }}</p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <NuxtLink :to="`/workspaces/${workspace.slug}/settings`">
            <OutlinedButton class="max-sm:px-2 max-sm:py-1">
              <Icon name="lucide:settings" class="w-3.5 h-3.5" />
              <span class="max-sm:hidden">Settings</span>
            </OutlinedButton>
          </NuxtLink>
          <Button @click="showCreateProject = true" class="max-sm:px-2 max-sm:py-1">
            <Icon name="lucide:plus" class="w-3.5 h-3.5" />
            <span class="max-sm:hidden">New Project</span>
          </Button>
        </div>
      </div>

      <!-- Repository promo -->
      <WorkspaceRepositoryPromoBanner
        v-if="showRepoBanner"
        :workspace-id="workspace.id"
        :workspace-slug="workspace.slug"
        :dismissed-prompts="workspace.membership?.dismissedPrompts"
      />

      <!-- Getting Started Checklist (for new workspaces with 1-2 projects) -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="showGettingStarted"
          class="mb-6 p-4 rounded-xl border"
          style="border-color: rgba(207, 81, 61, 0.25); background: rgba(207, 81, 61, 0.06);"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Icon name="lucide:rocket" class="w-4 h-4 text-accent" />
              <span class="text-sm font-semibold text-surface-900">Getting started</span>
            </div>
            <button
              class="text-xs text-surface-500 hover:text-surface-700 transition-colors"
              @click="dismissGettingStarted"
            >
              Dismiss
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              v-for="(step, index) in gettingStartedSteps"
              :key="index"
              class="flex items-start gap-2.5 p-2.5 rounded-lg border"
              :class="step.completed ? 'bg-surface-100 border-surface-200' : 'bg-surface-50 border-surface-200'"
            >
              <div
                class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                :class="step.completed ? 'bg-semantic-green' : 'bg-surface-200'"
              >
                <Icon
                  v-if="step.completed"
                  name="lucide:check"
                  class="w-3 h-3 text-white"
                />
                <span v-else class="text-[10px] font-bold text-surface-600">{{ index + 1 }}</span>
              </div>
              <div>
                <p
                  class="text-xs font-medium"
                  :class="step.completed ? 'text-surface-500 line-through' : 'text-surface-900'"
                >
                  {{ step.title }}
                </p>
                <p class="text-[10px] text-surface-500 mt-0.5 leading-snug">{{ step.description }}</p>
                <NuxtLink
                  v-if="!step.completed && step.link"
                  :to="step.link"
                  class="text-[10px] text-accent font-medium hover:text-accent-hover transition-colors mt-1 inline-block"
                >
                  {{ step.action }}
                </NuxtLink>
                <button
                  v-else-if="!step.completed && step.actionClick"
                  class="text-[10px] text-accent font-medium hover:text-accent-hover transition-colors mt-1"
                  @click="step.actionClick"
                >
                  {{ step.action }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Loading -->
      <UiLoadingState v-if="loading" text="Loading projects..." />

      <!-- Empty state -->
      <UiEmptyState
        v-else-if="projects.length === 0"
        title="Your workspace is ready"
        :description="`Create your first project in ${workspace.name} to start tracking tasks with your team.`"
        tip="Projects contain kanban boards, tasks, and can have their own agents."
        icon="ph:projector-screen-chart"
      >
        <Button @click="showCreateProject = true">
          <Icon name="lucide:plus" class="w-3.5 h-3.5" />
          Create first project
        </Button>
      </UiEmptyState>

      <!-- Project grid -->
      <div v-else>
        <!-- Projects heading -->
        <div class="flex items-center gap-2 mb-4">
          <h2 class="text-sm font-semibold text-surface-700">Projects</h2>
          <span class="text-xs text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full font-medium">
            {{ projects.length }}
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="project in projects"
            :key="project.id"
            class="bg-white border border-surface-200 rounded-xl p-[18px] cursor-pointer hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-150 group relative"
            @click="navigateTo(`/workspaces/${workspace.slug}/projects/${project.id}/board`)"
          >
            <div class="flex items-start justify-between mb-3">
              <div
                class="w-[36px] h-[36px] rounded-lg flex items-center justify-center text-xs text-white"
                :style="{ background: project.color }"
              >
                <span class="text-xs font-bold">{{ projectInitials(project.name) }}</span>
              </div>
              <button
                class="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center hover:bg-error-50 text-surface-400 hover:text-error-500"
                @click.stop="openDeleteConfirm(project)"
              >
                <Icon name="lucide:trash-2" class="w-3.5 h-3.5" />
              </button>
            </div>
            <h3 class="text-sm font-semibold text-surface-900 mb-1">{{ project.name }}</h3>
            <p v-if="project.description" class="text-xs text-surface-500 leading-snug mb-3 line-clamp-2">
              {{ project.description }}
            </p>

            <!-- Stats row -->
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500">
              <span class="flex items-center gap-1">
                <Icon name="lucide:inbox" class="w-3 h-3 text-accent" />
                {{ (project._count?.tasks || 0) - (project._count?.doneTasks || 0) }} open
              </span>
              <span class="flex items-center gap-1">
                <Icon name="lucide:check-circle" class="w-3 h-3 text-green-500" />
                {{ project._count?.doneTasks || 0 }} done
              </span>
              <span class="flex items-center gap-1">
                <Icon name="lucide:users" class="w-3 h-3" />
                {{ project._count?.members || 0 }} members
              </span>
            </div>

            <!-- Onboarding hint: no tasks yet -->
            <div
              v-if="(project._count?.tasks || 0) === 0"
              class="mt-3 pt-3"
              style="border-top: 1px solid rgba(148, 163, 184, 0.15);"
            >
              <div class="flex items-center gap-1.5 text-[10px]" style="color: #94a3b8;">
                <Icon name="lucide:lightbulb" class="w-3 h-3" style="color: #fbbf24;" />
                <span>No tasks yet. Open the board to create your first one.</span>
              </div>
            </div>
          </div>

          <!-- Quick-add card -->
          <button
            class="border border-dashed border-surface-300 rounded-xl p-[18px] flex flex-col items-center justify-center gap-2 text-surface-400 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all duration-150 min-h-[140px]"
            @click="showCreateProject = true"
          >
            <Icon name="lucide:plus" class="w-5 h-5" />
            <span class="text-xs font-medium">New project</span>
          </button>
        </div>
      </div>
    </div>

    <UiLoadingState v-else-if="loading" text="Loading workspace..." />

    <!-- Create project modal -->
    <ProjectCreateModal
      v-if="showCreateProject && workspace"
      :workspace-id="workspace.id"
      :is-first-project="!hasProjects"
      @close="showCreateProject = false"
      @created="onProjectCreated"
    />

    <!-- Delete project confirmation -->
    <ModalConfirmation
      v-if="projectToDelete"
      title="Delete Project"
      :message="`Type '${projectToDelete.name}' to confirm deletion. This cannot be undone.`"
      confirm-text="Delete"
      variant="danger"
      :is-loading="deleteLoading"
      :confirm-disabled="deleteConfirmName !== projectToDelete.name"
      @confirm="handleDelete"
      @cancel="projectToDelete = null; deleteConfirmName = ''"
    >
      <template #icon>
        <Icon name="lucide:trash-2" class="w-5 h-5" />
      </template>
      <div class="w-full text-left mt-3">
        <TextInput
          v-model="deleteConfirmName"
          :placeholder="`Type ${projectToDelete.name} to confirm`"
          class="w-full"
        />
      </div>
      <template v-if="deleteConfirmName !== projectToDelete.name">
        <p class="text-xs text-error-600 mt-1">You must type the project name exactly to confirm.</p>
      </template>
    </ModalConfirmation>
  </div>
</template>

<script setup lang="ts">
import type { Workspace, Project, Repository } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const { getWorkspaceBySlug, loading: wsLoading } = useWorkspace()
const { projects, loading, fetchProjects, deleteProject } = useProject()
const { repositories } = useRepository()

const slug = computed(() => route.params.slug as string)
const workspace = ref<Workspace | null>(null)
const showCreateProject = ref(false)
const hasProjects = computed(() => projects.value.length > 0)
const projectToDelete = ref<Project | null>(null)
const deleteConfirmName = ref('')
const deleteLoading = ref(false)

// Server-side fetch workspace + repositories so the repository
// promo banner never flashes with the wrong state on initial load.
const { data: ssrData } = await useAsyncData(
  `workspace-index-${slug.value}`,
  async () => {
    const ws = await $fetch<Workspace>(`/api/workspaces/by-slug/${slug.value}`)
    const repos = await $fetch<Repository[]>(`/api/workspaces/${ws.id}/repositories`)
    return { workspace: ws, repositories: repos }
  }
)

// Sync SSR data synchronously so the banner renders with the correct state.
if (ssrData.value) {
  workspace.value = ssrData.value.workspace
  repositories.value = ssrData.value.repositories
}

const repositoriesReady = ref(ssrData.value !== null)

const showRepoBanner = computed(() => {
  if (!workspace.value || !repositoriesReady.value) return false
  return repositories.value.length === 0
})

// Getting started checklist logic
const GS_LS_KEY = `orbit_getting_started_${slug.value}`
const showGettingStarted = ref(false)

interface GettingStartedStep {
  title: string
  description: string
  action: string
  link?: string
  actionClick?: () => void
  completed: boolean
}

const gettingStartedSteps = computed<GettingStartedStep[]>(() => {
  if (!workspace.value) return []

  const hasRepos = repositories.value.length > 0
  const hasAgents = workspace.value._count?.agents ? workspace.value._count.agents > 0 : false
  const hasMembers = workspace.value._count?.members ? workspace.value._count.members > 1 : false
  const hasAnyTasks = projects.value.some(p => (p._count?.tasks || 0) > 0)

  return [
    {
      title: 'Create a project',
      description: 'Start tracking tasks on a kanban board.',
      action: 'Add project',
      actionClick: () => showCreateProject.value = true,
      completed: projects.value.length > 0,
    },
    {
      title: 'Add your first task',
      description: 'Open the board and create a task.',
      action: 'View board',
      link: projects.value.length > 0 ? `/workspaces/${workspace.value.slug}/projects/${projects.value[0].id}/board` : undefined,
      completed: hasAnyTasks,
    },
    {
      title: 'Invite a teammate',
      description: 'Collaborate on projects together.',
      action: 'Invite',
      link: `/workspaces/${workspace.value.slug}/settings`,
      completed: hasMembers,
    },
    {
      title: 'Connect a repository',
      description: 'Enable agent code changes and PR reviews.',
      action: 'Connect',
      link: `/workspaces/${workspace.value.slug}/settings?tab=repositories`,
      completed: hasRepos,
    },
  ]
})

const allStepsCompleted = computed(() => {
  return gettingStartedSteps.value.every(s => s.completed)
})

onMounted(async () => {
  if (!workspace.value) {
    workspace.value = await getWorkspaceBySlug(slug.value)
  }

  // If SSR failed or repositories aren't loaded yet, fetch them client-side.
  // Also fetch if repositories are empty but we have a workspace, to avoid
  // showing the banner when a repo exists but the shared state is stale.
  if (workspace.value && (!repositoriesReady.value || repositories.value.length === 0)) {
    try {
      const repos = await $fetch<Repository[]>(`/api/workspaces/${workspace.value.id}/repositories`)
      repositories.value = repos
    } catch {
      repositories.value = []
    } finally {
      repositoriesReady.value = true
    }
  }

  if (workspace.value) {
    await fetchProjects(workspace.value.id)
  }

  // Show getting started if not dismissed and not all completed
  const dismissed = localStorage.getItem(GS_LS_KEY)
  if (!dismissed && !allStepsCompleted.value && projects.value.length > 0 && projects.value.length <= 3) {
    showGettingStarted.value = true
  }
})

function dismissGettingStarted() {
  showGettingStarted.value = false
  localStorage.setItem(GS_LS_KEY, 'true')
}

function onProjectCreated(project: Project) {
  showCreateProject.value = false
  router.push(`/workspaces/${workspace.value?.slug}/projects/${project.id}/board`)
}

function openDeleteConfirm(project: Project) {
  projectToDelete.value = project
  deleteConfirmName.value = ''
}

async function handleDelete() {
  if (!projectToDelete.value || deleteConfirmName.value !== projectToDelete.value.name) return
  deleteLoading.value = true
  try {
    await deleteProject(projectToDelete.value.id)
    projectToDelete.value = null
    deleteConfirmName.value = ''
  } finally {
    deleteLoading.value = false
  }
}

function projectInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
</script>
