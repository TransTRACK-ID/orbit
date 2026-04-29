<template>
  <aside
    class="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-surface-200 flex flex-col z-30"
    :class="{ '-translate-x-full': !isOpen }"
  >
    <!-- Logo + Workspace Switcher -->
    <div class="p-4 border-b border-surface-100">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-primary-500 text-white flex items-center justify-center text-xs font-bold">
            O
          </div>
          <span class="font-semibold text-surface-900">Orbit</span>
        </div>
      </div>
      <WorkspaceSwitcher />
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto p-3 space-y-1">
      <!-- Workspace-level links -->
      <div v-if="currentWorkspace" class="mb-4">
        <div class="px-3 py-1.5 text-xs font-semibold text-surface-400 uppercase tracking-wider">
          Workspace
        </div>
        <NuxtLink
          :to="`/workspaces/${currentWorkspace.slug}`"
          class="sidebar-item"
          :class="{ active: route.path === `/workspaces/${currentWorkspace.slug}` }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" class="w-4 h-4"><path fill="currentColor" d="M88 48H48a8 8 0 0 0-8 8v40a8 8 0 0 0 8 8h40a8 8 0 0 0 8-8V56a8 8 0 0 0-8-8Zm-8 40H56V64h24Zm-32 72H48a8 8 0 0 0-8 8v40a8 8 0 0 0 8 8h40a8 8 0 0 0 8-8v-40a8 8 0 0 0-8-8Zm-8 40H64v-24h24Zm120-120h-40a8 8 0 0 0-8 8v40a8 8 0 0 0 8 8h40a8 8 0 0 0 8-8V56a8 8 0 0 0-8-8Zm-8 40h-24V64h24Zm-24 32h40a8 8 0 0 1 8 8v40a8 8 0 0 1-8 8h-40a8 8 0 0 1-8-8v-40a8 8 0 0 1 8-8Z"/></svg>
          Projects
        </NuxtLink>
        <NuxtLink
          :to="`/workspaces/${currentWorkspace.slug}/settings`"
          class="sidebar-item"
          :class="{ active: route.path.includes('/settings') && !route.path.includes('projects/') }"
        >
          <Settings class="w-4 h-4" />
          Settings
        </NuxtLink>
      </div>

      <!-- Projects -->
      <div v-if="projects?.length > 0" class="mb-4">
        <div class="flex items-center justify-between px-3 py-1.5">
          <span class="text-xs font-semibold text-surface-400 uppercase tracking-wider">Projects</span>
          <button
            v-if="currentWorkspace"
            class="text-surface-400 hover:text-surface-600 transition-colors"
            @click="showCreateProject = true"
          >
            <Plus class="w-3.5 h-3.5" />
          </button>
        </div>
        <NuxtLink
          v-for="project in projects"
          :key="project.id"
          :to="`/workspaces/${currentWorkspace?.slug}/projects/${project.id}/board`"
          class="sidebar-item"
          :class="{ active: route.params.projectId === project.id }"
        >
          <span
            class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :style="{ backgroundColor: project.color }"
          />
          <span class="truncate">{{ project.name }}</span>
        </NuxtLink>
      </div>

      <!-- Workspace list link -->
      <div class="pt-2 border-t border-surface-100">
        <NuxtLink to="/workspaces" class="sidebar-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" class="w-4 h-4"><path fill="currentColor" d="M224 128a96 96 0 0 1-94.79 96H128a8 8 0 0 1 0 16a104 104 0 1 0-104-104a8 8 0 0 0 16 0a88 88 0 1 1 179.8 10.06a8 8 0 0 1-7.76 8.74a8.11 8.11 0 0 1-8-7.39A87.78 87.78 0 0 1 224 128Zm-51.68-3.24a8 8 0 0 0-8.64 1.56l-30.67 28.3l-12.37-20.64a8 8 0 1 0-13.66 8.3l16.65 27.77a8.06 8.06 0 0 0 6.37 3.95h.26a8 8 0 0 0 5.57-2.24l36-33.22a8 8 0 0 0 .62-11.78Zm-88-1.82a36 36 0 1 0 36 36a36 36 0 0 0-36-36Zm0 56a20 20 0 1 1 20-20a20 20 0 0 1-20 20Z"/></svg>
          All Workspaces
        </NuxtLink>
      </div>
    </nav>

    <!-- User footer -->
    <div class="p-3 border-t border-surface-100">
      <div class="flex items-center gap-2 px-2 py-1.5">
        <Avatar :name="user?.name" size="sm" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-surface-900 truncate">{{ user?.name }}</p>
          <p class="text-xs text-surface-500 truncate">{{ user?.email }}</p>
        </div>
        <button
          class="text-surface-400 hover:text-surface-600 transition-colors p-1"
          @click="handleLogout"
        >
          <Logout class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Create project modal -->
    <ProjectCreateModal
      v-if="showCreateProject && currentWorkspace"
      :workspace-id="currentWorkspace.id"
      @close="showCreateProject = false"
      @created="onProjectCreated"
    />
  </aside>
</template>

<script setup lang="ts">
import type { Workspace, Project } from '~/types'

const { signOut, data: session } = useAuth()
const route = useRoute()
const router = useRouter()

const isOpen = ref(true)
const showCreateProject = ref(false)
  
  const user = computed(() => session.value?.user as any)

// Get current workspace from route
const currentWorkspaceSlug = computed(() => route.params.slug as string)

const { workspaces } = useWorkspace()
const { projects, fetchProjects, createProject } = useProject()

const currentWorkspace = computed<Workspace | undefined>(() =>
  workspaces.value?.find((w: Workspace) => w.slug === currentWorkspaceSlug.value)
)

// Watch for workspace changes to fetch projects
watch(currentWorkspace, async (ws) => {
  if (ws) {
    await fetchProjects(ws.id)
  }
}, { immediate: true })

async function onProjectCreated(project: Project) {
  showCreateProject.value = false
  await router.push(`/workspaces/${currentWorkspace.value?.slug}/projects/${project.id}/board`)
}

async function handleLogout() {
  await signOut()
  await router.push('/login')
}
</script>
