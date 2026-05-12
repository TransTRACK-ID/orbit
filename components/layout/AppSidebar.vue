<template>
  <aside
    id="sidebar"
    class="w-60 bg-white border-r border-surface-200 flex flex-col flex-shrink-0 overflow-hidden max-lg:fixed max-lg:top-[52px] max-lg:bottom-0 max-lg:z-40 max-lg:shadow-lg max-lg:transition-transform max-lg:duration-200"
    :class="sidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'"
  >
    <div class="flex-1 overflow-y-auto py-3">
      <!-- Agents link -->
      <div class="sidebar-group mb-1">
        <div
          class="sidebar-item"
          :class="{ active: route.path === '/agents' }"
          style="margin-bottom: 4px"
          @click="navigateTo('/agents'); closeOnMobile()"
        >
          <div
            class="w-[22px] h-[22px] rounded-md flex items-center justify-center text-[9px] text-white flex-shrink-0"
            style="background: #CF513D"
          >
            <Icon name="lucide:bot" class="w-2.5 h-2.5" />
          </div>
          <span class="name flex-1 min-w-0 truncate text-xs" :class="{ 'font-semibold': route.path === '/agents' }">Agents</span>
          <span class="text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-semibold">{{ agentCount }}</span>
        </div>
      </div>

      <!-- Admin link (super admin only) -->
      <div v-if="isSuperAdmin" class="sidebar-group mb-1">
        <div
          class="sidebar-item"
          :class="{ active: route.path === '/admin' }"
          style="margin-bottom: 4px"
          @click="navigateTo('/admin'); closeOnMobile()"
        >
          <div
            class="w-[22px] h-[22px] rounded-md flex items-center justify-center text-[9px] text-white flex-shrink-0"
            style="background: #7C3AED"
          >
            <Icon name="lucide:shield" class="w-2.5 h-2.5" />
          </div>
          <span class="name flex-1 min-w-0 truncate text-xs" :class="{ 'font-semibold': route.path === '/admin' }">Admin</span>
          <span class="text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-semibold">SA</span>
        </div>
      </div>

      <!-- Workspace switcher -->
      <div class="px-3 mb-2">
        <div class="relative">
          <select
            :value="activeWorkspaceSlug"
            class="w-full text-xs font-semibold rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 pr-8 appearance-none cursor-pointer focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
            @change="switchWorkspace(($event.target as HTMLSelectElement).value); closeOnMobile()"
          >
            <option value="" disabled>Select workspace</option>
            <option
              v-for="ws in workspaces"
              :key="ws.id"
              :value="ws.slug"
            >
              {{ ws.name }}
            </option>
          </select>
          <Icon
            name="lucide:chevron-down"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none"
          />
        </div>
      </div>

      <!-- Projects for active workspace -->
      <div v-if="activeWorkspace" class="sidebar-group">
        <div class="sidebar-group-header px-3 py-1.5" @click="navigateTo(`/workspaces/${activeWorkspace.slug}`); closeOnMobile()">
          <span class="text-xs font-semibold text-surface-700">{{ activeWorkspace.name }}</span>
          <span class="ml-auto text-[10px] text-surface-400">{{ projects.length }} projects</span>
        </div>

        <div v-if="projects.length === 0" class="px-3 py-2 text-[10px] text-surface-400 italic">
          No projects yet
        </div>

        <div
          v-for="proj in projects"
          :key="proj.id"
          class="sidebar-item"
          :class="{ active: route.params.projectId === proj.id && route.path.includes('/board') }"
          @click="navigateTo(`/workspaces/${activeWorkspace.slug}/projects/${proj.id}/board`); closeOnMobile()"
        >
          <div
            class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
            :style="{ backgroundColor: proj.color }"
          >
            <span class="text-[7px] font-bold text-white">{{ proj.name.charAt(0) }}</span>
          </div>
          <span class="flex-1 min-w-0 truncate text-xs">{{ proj.name }}</span>
          <span class="text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-semibold">{{ projOpenCount(proj) }}</span>
        </div>
      </div>

      <!-- Other workspaces (collapsed) -->
      <div v-for="ws in otherWorkspaces" :key="ws.id" class="sidebar-group">
        <div
          class="sidebar-item !rounded-none !border-l-0 !border-r-0"
          @click="navigateTo(`/workspaces/${ws.slug}`); closeOnMobile()"
        >
          <div
            class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
            :style="{ backgroundColor: '#94a3b8' }"
          >
            <span class="text-[7px] font-bold text-white">{{ ws.name.charAt(0).toUpperCase() }}</span>
          </div>
          <span class="flex-1 min-w-0 truncate text-xs text-surface-500">{{ ws.name }}</span>
          <Icon name="lucide:arrow-up-right" class="w-2.5 h-2.5 text-surface-300" />
        </div>
      </div>

      <!-- Workspace settings -->
      <div v-if="activeWorkspace" class="mt-2 px-3">
        <div
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] text-surface-400 hover:text-surface-600 hover:bg-surface-50 transition-colors cursor-pointer"
          @click="navigateTo(`/workspaces/${activeWorkspace.slug}/settings`); closeOnMobile()"
        >
          <Icon name="lucide:settings" class="w-3 h-3" />
          Workspace settings
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Workspace } from '~/types'

const route = useRoute()
const router = useRouter()
const { data: session } = useAuth()

const { workspaces, fetchWorkspaces } = useWorkspace()
const { agents, fetchAgents } = useAgent()
const { projects, fetchProjects, loading: projectsLoading } = useProject()
const { isOpen: sidebarOpen, close: closeSidebar } = useSidebar()

const agentCount = computed(() => agents.value.length)
const isSuperAdmin = computed(() => (session.value?.user as any)?.role === 'super_admin')

const activeWorkspaceSlug = computed(() => route.params.slug as string || '')

const activeWorkspace = computed(() =>
  workspaces.value.find((ws: any) => ws.slug === activeWorkspaceSlug.value) || null
)

const otherWorkspaces = computed(() =>
  workspaces.value.filter((ws: any) => ws.slug !== activeWorkspaceSlug.value)
)

function projOpenCount(proj: any) {
  const total = proj._count?.tasks || 0
  const done = proj._count?.doneTasks || 0
  return total - done
}

function switchWorkspace(slug: string) {
  router.push(`/workspaces/${slug}`)
}

function closeOnMobile() {
  if (window.innerWidth < 1024) {
    closeSidebar()
  }
}

// Fetch projects when workspace changes
async function loadProjects(slug: string) {
  const ws = workspaces.value.find((w: any) => w.slug === slug)
  if (ws) {
    await fetchProjects(ws.id)
  }
}

watch(activeWorkspaceSlug, async (slug) => {
  if (slug) {
    await loadProjects(slug)
  }
}, { immediate: false })

onMounted(async () => {
  if (!workspaces.value || workspaces.value.length === 0) {
    await fetchWorkspaces()
  }
  if (agents.value.length === 0) {
    await fetchAgents()
  }
  if (activeWorkspaceSlug.value) {
    await loadProjects(activeWorkspaceSlug.value)
  }
})
</script>
