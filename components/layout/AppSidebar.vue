<template>
  <aside
    id="sidebar"
    class="bg-white border-r border-surface-200 flex flex-col flex-shrink-0 overflow-hidden transition-all duration-200 ease-out max-lg:fixed max-lg:top-[52px] max-lg:bottom-0 max-lg:z-40 max-lg:shadow-lg max-lg:transition-transform max-lg:duration-200"
    :class="[
      sidebarCollapsed ? 'w-14' : 'w-60',
      sidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
    ]"
  >
    <div class="flex-1 overflow-y-auto py-3">
      <!-- ─── Platform ─── -->
      <div class="sidebar-group mb-1">
        <div
          class="sidebar-item"
          :class="[{ active: route.path === '/agents' }, sidebarCollapsed ? 'justify-center px-0' : '']"
          :title="sidebarCollapsed ? 'Agents' : undefined"
          @click="navigateTo('/agents'); closeOnMobile()"
        >
          <div
            class="w-[22px] h-[22px] rounded-md flex items-center justify-center text-white flex-shrink-0"
            :class="route.path === '/agents' ? 'bg-accent' : 'bg-surface-400'"
          >
            <Icon name="lucide:bot" class="w-3 h-3" />
          </div>
          <span v-if="!sidebarCollapsed" class="name flex-1 min-w-0 truncate text-sm" :class="{ 'font-semibold': route.path === '/agents' }">Agents</span>
          <span v-if="!sidebarCollapsed" class="text-xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-semibold">{{ agentCount }}</span>
        </div>

        <div
          v-if="isSuperAdmin"
          class="sidebar-item"
          :class="[{ active: route.path === '/admin' }, sidebarCollapsed ? 'justify-center px-0' : '']"
          :title="sidebarCollapsed ? 'Admin' : undefined"
          @click="navigateTo('/admin'); closeOnMobile()"
        >
          <div
            class="w-[22px] h-[22px] rounded-md flex items-center justify-center text-white flex-shrink-0"
            :class="route.path === '/admin' ? 'bg-accent' : 'bg-surface-400'"
          >
            <Icon name="lucide:shield" class="w-3 h-3" />
          </div>
          <span v-if="!sidebarCollapsed" class="name flex-1 min-w-0 truncate text-sm" :class="{ 'font-semibold': route.path === '/admin' }">Admin</span>
        </div>
      </div>

      <!-- ─── Current workspace ─── -->
      <template v-if="activeWorkspace">
        <div v-if="!sidebarCollapsed" class="sidebar-group-header mt-4">
          <span>Current workspace</span>
        </div>

        <!-- Active workspace name -->
        <div
          class="sidebar-item sidebar-item-workspace"
          :class="[
            { active: isWorkspaceOverview, 'sidebar-item-parent': isWorkspaceContext && !isWorkspaceOverview },
            sidebarCollapsed ? 'justify-center px-0' : '',
          ]"
          :title="sidebarCollapsed ? activeWorkspace.name : undefined"
          @click="navigateTo(`/workspaces/${activeWorkspace.slug}`); closeOnMobile()"
        >
          <div
            class="sidebar-avatar sidebar-avatar-workspace"
            :style="{ backgroundColor: workspaceColor(activeWorkspace) }"
          >
            <span class="text-xs font-bold">{{ activeWorkspace.name.charAt(0).toUpperCase() }}</span>
          </div>
          <span v-if="!sidebarCollapsed" class="name flex-1 min-w-0 truncate text-sm" :class="{ 'font-semibold': isWorkspaceOverview }">{{ activeWorkspace.name }}</span>
          <span v-if="!sidebarCollapsed" class="text-xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-semibold tabular-nums">{{ activeWorkspace._count?.projects || 0 }}</span>
        </div>

        <!-- Scoped under active workspace -->
        <div
          class="workspace-children"
          :class="sidebarCollapsed ? 'workspace-children--collapsed' : 'workspace-children--expanded'"
        >
          <!-- Projects -->
          <div
            v-for="proj in projects"
            :key="proj.id"
            class="sidebar-item sidebar-item-nested"
            :class="[isProjectActive(proj) ? 'active' : '', sidebarCollapsed ? 'justify-center px-0' : '']"
            :title="sidebarCollapsed ? proj.name : undefined"
            @click="navigateTo(`/workspaces/${activeWorkspace.slug}/projects/${proj.id}/board`); closeOnMobile()"
          >
            <div
              class="sidebar-avatar sidebar-avatar-project"
              :style="{ backgroundColor: proj.color }"
            >
              <span class="text-xs font-bold text-white leading-none">{{ proj.name.charAt(0) }}</span>
            </div>
            <span v-if="!sidebarCollapsed" class="flex-1 min-w-0 truncate text-sm">{{ proj.name }}</span>
            <span
              v-if="!sidebarCollapsed && projOpenCount(proj) > 0"
              class="text-xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-semibold tabular-nums"
            >{{ projOpenCount(proj) }}</span>
          </div>

          <div
            v-if="projects.length === 0 && !projectsLoading && !sidebarCollapsed"
            class="px-3 py-1.5 text-xs text-surface-400"
          >
            No projects yet
          </div>

          <div
            v-if="!sidebarCollapsed && projects.length > 0"
            class="workspace-children-divider"
            aria-hidden="true"
          />

          <p
            v-if="!sidebarCollapsed"
            class="workspace-children-label"
          >
            In this workspace
          </p>

          <div
            v-for="tool in workspaceTools"
            :key="tool.path"
            class="sidebar-item sidebar-item-nested"
            :class="[
              { active: isToolActive(tool.path) },
              sidebarCollapsed ? 'justify-center px-0' : '',
            ]"
            :title="sidebarCollapsed ? tool.label : undefined"
            @click="navigateTo(`/workspaces/${activeWorkspace.slug}/${tool.path}`); closeOnMobile()"
          >
            <div
              class="sidebar-avatar sidebar-avatar-tool"
              :class="isToolActive(tool.path) ? 'bg-accent' : 'bg-surface-400'"
            >
              <Icon :name="tool.icon" class="w-2.5 h-2.5" />
            </div>
            <span v-if="!sidebarCollapsed" class="name flex-1 min-w-0 truncate text-sm">{{ tool.label }}</span>
          </div>
        </div>
      </template>

      <!-- ─── Other workspaces ─── -->
      <template v-if="otherWorkspaces.length > 0 && !sidebarCollapsed">
        <div class="sidebar-group-header mt-4">
          <span>Other workspaces</span>
        </div>

        <div
          v-for="ws in otherWorkspaces"
          :key="ws.id"
          class="sidebar-item"
          :class="{ active: route.params.slug === ws.slug && !activeWorkspace }"
          @click="navigateTo(`/workspaces/${ws.slug}`); closeOnMobile()"
        >
          <div
            class="sidebar-avatar sidebar-avatar-workspace"
            :style="{ backgroundColor: workspaceColor(ws) }"
          >
            <span class="text-xs font-bold">{{ ws.name.charAt(0).toUpperCase() }}</span>
          </div>
          <span class="flex-1 min-w-0 truncate text-sm">{{ ws.name }}</span>
          <span class="text-xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-semibold">{{ ws._count?.projects || 0 }}</span>
        </div>
      </template>

      <!-- View all link -->
      <div v-if="workspaces.length > 1 && !sidebarCollapsed" class="px-4 py-2">
        <NuxtLink
          to="/workspaces"
          class="flex items-center gap-1.5 text-xs text-surface-400 hover:text-accent transition-colors"
          @click="closeOnMobile()"
        >
          <Icon name="lucide:layout-grid" class="w-3.5 h-3.5" />
          View all workspaces
        </NuxtLink>
      </div>

      <!-- ─── Utilities ─── -->
      <div class="mt-auto pt-4 border-t border-surface-200">
        <div v-if="activeWorkspace" class="sidebar-group">
          <div
            class="sidebar-item"
            :class="[{ active: route.path.includes('/settings') }, sidebarCollapsed ? 'justify-center px-0' : '']"
            :title="sidebarCollapsed ? 'Workspace settings' : undefined"
            @click="navigateTo(`/workspaces/${activeWorkspace.slug}/settings`); closeOnMobile()"
          >
            <Icon name="lucide:settings" class="w-4 h-4 text-surface-400" />
            <span v-if="!sidebarCollapsed" class="text-sm" :class="{ 'font-semibold': route.path.includes('/settings') }">Workspace settings</span>
          </div>
        </div>

        <button
          class="sidebar-item w-full text-surface-400 hover:text-surface-600"
          :class="sidebarCollapsed ? 'justify-center px-0' : ''"
          :title="sidebarCollapsed ? (isDark ? 'Light mode' : 'Dark mode') : undefined"
          @click="toggleDarkMode"
        >
          <Icon v-if="isDark" name="lucide:sun" class="w-4 h-4" />
          <Icon v-else name="lucide:moon" class="w-4 h-4" />
          <span v-if="!sidebarCollapsed" class="text-sm">{{ isDark ? 'Light mode' : 'Dark mode' }}</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Workspace } from '~/types'

const route = useRoute()

const workspaceTools = [
  {
    label: 'Brainstorm',
    icon: 'lucide:lightbulb',
    path: 'brainstorm',
  },
  {
    label: 'Reviews',
    icon: 'lucide:git-pull-request',
    path: 'reviews',
  },
  {
    label: 'QA',
    icon: 'lucide:flask-conical',
    path: 'qa',
  },
] as const

const { workspaces, fetchWorkspaces } = useWorkspace()
const { agents, fetchAgents } = useAgent()
const { projects, fetchProjects, loading: projectsLoading } = useProject()
const { isOpen: sidebarOpen, collapsed: sidebarCollapsed, close: closeSidebar } = useSidebar()
const { data: session } = useAuth()
const { isDark, toggle: toggleDarkMode } = useDarkMode()

const agentCount = computed(() => agents.value.length)
const isSuperAdmin = computed(() => (session.value?.user as any)?.role === 'super_admin')

const activeWorkspaceSlug = computed(() => route.params.slug as string || '')

const activeWorkspace = computed(() =>
  workspaces.value.find((ws: any) => ws.slug === activeWorkspaceSlug.value) || null
)

const otherWorkspaces = computed(() =>
  workspaces.value.filter((ws: any) => ws.slug !== activeWorkspaceSlug.value)
)

const isWorkspaceOverview = computed(() => {
  if (!activeWorkspace.value) return false
  return route.path === `/workspaces/${activeWorkspace.value.slug}`
})

const isWorkspaceContext = computed(() => {
  if (!activeWorkspace.value) return false
  return route.path.startsWith(`/workspaces/${activeWorkspace.value.slug}`)
})

function isToolActive(toolPath: string) {
  if (!activeWorkspace.value) return false
  const prefix = `/workspaces/${activeWorkspace.value.slug}/${toolPath}`
  return route.path === prefix || route.path.startsWith(`${prefix}/`)
}

function isProjectActive(proj: any) {
  return route.params.projectId === proj.id && route.path.includes('/board')
}

function projOpenCount(proj: any) {
  const total = proj._count?.tasks || 0
  const done = proj._count?.doneTasks || 0
  return total - done
}

const WORKSPACE_COLOR = '#94a3b8'

function workspaceColor(_ws: Workspace) {
  return WORKSPACE_COLOR
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
