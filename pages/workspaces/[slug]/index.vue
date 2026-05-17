<template>
  <div class="flex-1 overflow-y-auto py-5 px-4 sm:py-7 sm:px-8">
    <div v-if="workspace">
      <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div class="min-w-0">
          <h1 class="text-xl font-bold text-surface-900">{{ workspace.name }}</h1>
          <p v-if="workspace.description" class="text-xs text-surface-400 mt-1">{{ workspace.description }}</p>
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

      <!-- Loading -->
      <UiLoadingState v-if="loading" text="Loading projects..." />

      <!-- Empty state -->
      <UiEmptyState
        v-else-if="projects.length === 0"
        title="Your workspace is ready"
        :description="`Let's create your first project in ${workspace.name} to start tracking tasks.`"
        icon="ph:projector-screen-chart"
      >
        <Button @click="showCreateProject = true">
          <Icon name="lucide:plus" class="w-3.5 h-3.5" />
          Create First Project
        </Button>
      </UiEmptyState>

      <!-- Project grid (prototype style) -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
              <span class="text-[10px] font-bold">{{ projectInitials(project.name) }}</span>
            </div>
            <button
              class="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-surface-400 hover:text-red-500"
              @click.stop="openDeleteConfirm(project)"
            >
              <Icon name="lucide:trash-2" class="w-3.5 h-3.5" />
            </button>
          </div>
          <h3 class="text-sm font-semibold mb-1">{{ project.name }}</h3>
          <p v-if="project.description" class="text-[11px] text-surface-400 leading-snug mb-3 line-clamp-2">
            {{ project.description }}
          </p>
          <div class="flex gap-4 text-[10px] text-surface-400">
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
        <p class="text-[11px] text-error-500 mt-1">You must type the project name exactly to confirm.</p>
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

onMounted(async () => {
  if (!workspace.value) {
    workspace.value = await getWorkspaceBySlug(slug.value)
  }

  // If SSR failed or repositories aren't loaded yet, fetch them client-side.
  if (!repositoriesReady.value && workspace.value) {
    try {
      const repos = await $fetch<Repository[]>(`/api/workspaces/${workspace.value.id}/repositories`)
      repositories.value = repos
    } catch (err) {
      console.error('Failed to fetch repositories:', err)
      repositories.value = []
    } finally {
      repositoriesReady.value = true
    }
  }

  if (workspace.value) {
    await fetchProjects(workspace.value.id)
  }
})

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
