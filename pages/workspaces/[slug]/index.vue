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
          <Icon name="lucide:plus" class="w-3.5 h-3.5" />
          Create Project
        </Button>
      </UiEmptyState>

      <!-- Project grid (prototype style) -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="project in projects"
          :key="project.id"
          class="bg-white border border-surface-200 rounded-xl p-[18px] cursor-pointer hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-150"
          @click="navigateTo(`/workspaces/${workspace.slug}/projects/${project.id}/board`)"
        >
          <div
            class="w-[36px] h-[36px] rounded-lg flex items-center justify-center text-xs text-white mb-3"
            :style="{ background: project.color }"
          >
            <span class="text-[10px] font-bold">{{ projectInitials(project.name) }}</span>
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

function projectInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
</script>
