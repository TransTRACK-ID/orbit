<template>
  <div class="page-container">
    <div v-if="workspace">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-surface-900">{{ workspace.name }}</h1>
          <p v-if="workspace.description" class="text-surface-500 mt-1">{{ workspace.description }}</p>
        </div>
        <div class="flex items-center gap-3">
          <NuxtLink :to="`/workspaces/${workspace.slug}/settings`">
            <OutlinedButton>
              <Settings class="w-4 h-4" />
              Settings
            </OutlinedButton>
          </NuxtLink>
          <Button @click="showCreateProject = true">
            <Plus class="w-4 h-4" />
            New Project
          </Button>
        </div>
      </div>

      <!-- Loading -->
      <UiLoadingState v-if="loading" text="Loading projects..." />

      <!-- Empty state -->
      <UiEmptyState
        v-else-if="projects.length === 0"
        title="No projects yet"
        :description="`Create your first project in ${workspace.name}`"
        icon="ph:projector-screen-chart"
      >
        <Button @click="showCreateProject = true">
          <Plus class="w-4 h-4" />
          Create Project
        </Button>
      </UiEmptyState>

      <!-- Project grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
          @click="router.push(`/workspaces/${workspace.slug}/projects/${project.id}/board`)"
        />
      </div>
    </div>

    <UiLoadingState v-else-if="loading" text="Loading workspace..." />

    <!-- Create project modal -->
    <ProjectCreateModal
      v-if="showCreateProject && workspace"
      :workspace-id="workspace.id"
      @close="showCreateProject = false"
      @created="onProjectCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { Workspace, Project } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const { getWorkspaceBySlug, loading: wsLoading } = useWorkspace()
const { projects, loading, fetchProjects } = useProject()

const slug = computed(() => route.params.slug as string)
const workspace = ref<Workspace | null>(null)
const showCreateProject = ref(false)

onMounted(async () => {
  workspace.value = await getWorkspaceBySlug(slug.value)
  if (workspace.value) {
    await fetchProjects(workspace.value.id)
  }
})

function onProjectCreated(project: Project) {
  showCreateProject.value = false
  router.push(`/workspaces/${workspace.value?.slug}/projects/${project.id}/board`)
}
</script>
