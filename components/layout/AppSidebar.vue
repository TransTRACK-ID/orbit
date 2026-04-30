<template>
  <aside
    id="sidebar"
    class="w-60 bg-white border-r border-surface-200 flex flex-col flex-shrink-0 overflow-hidden max-lg:fixed max-lg:left-[-100%] max-lg:top-[52px] max-lg:bottom-0 max-lg:z-40 max-lg:shadow-lg max-lg:transition-left max-lg:duration-200"
  >
    <div class="flex-1 overflow-y-auto py-3">
      <!-- Agents link -->
      <div class="sidebar-group mb-1">
        <div
          class="sidebar-item"
          :class="{ active: route.path === '/agents' }"
          style="margin-bottom: 4px"
          @click="navigateTo('/agents')"
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

      <!-- Workspaces -->
      <div v-for="ws in workspaces" :key="ws.id" class="sidebar-group">
        <div
          class="sidebar-group-header"
          @click="navigateTo(`/workspaces/${ws.slug}`)"
        >
          <Icon name="lucide:chevron-down" class="w-2 h-2 text-surface-400" :class="{ 'rotate-0': !isWsActive(ws.id), '': isWsActive(ws.id) }" />
          <span>{{ ws.name }}</span>
        </div>
        <template v-if="isWsActive(ws.id)">
          <div
            v-for="proj in wsProjects(ws.id)"
            :key="proj.id"
            class="sidebar-item"
            :class="{ active: route.params.projectId === proj.id && route.path.includes('/board') }"
            @click="navigateTo(`/workspaces/${ws.slug}/projects/${proj.id}/board`)"
          >
            <div
              class="w-5 h-5 rounded flex items-center justify-center text-[9px] text-white flex-shrink-0"
              :style="{ backgroundColor: ws.color || '#6366F1' }"
            >
              <Icon v-if="proj.icon" :name="proj.icon" class="w-2.5 h-2.5" />
              <span v-else class="text-[8px] font-bold">{{ proj.name.charAt(0) }}</span>
            </div>
            <span class="flex-1 min-w-0 truncate">{{ proj.name }}</span>
            <span class="text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-semibold">{{ projOpenCount(proj) }}</span>
          </div>
        </template>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Workspace } from '~/types'

const route = useRoute()
const router = useRouter()

const { workspaces, fetchWorkspaces } = useWorkspace()
const { agents, fetchAgents } = useAgent()

const agentCount = computed(() => agents.value.length)

onMounted(async () => {
  if (!workspaces.value || workspaces.value.length === 0) {
    await fetchWorkspaces()
  }
  if (agents.value.length === 0) {
    await fetchAgents()
  }
})

function isWsActive(wsId: string) {
  const slug = route.params.slug as string
  const ws = workspaces.value.find((w: Workspace) => w.id === wsId)
  return ws?.slug === slug
}

function wsProjects(wsId: string) {
  const slug = route.params.slug as string
  const ws = workspaces.value.find((w: Workspace) => w.id === wsId)
  if (ws?.slug !== slug) return []
  // Projects come from the workspace detail endpoint, but we can show what's stored
  return (ws as any).projects || []
}

function projOpenCount(proj: any) {
  if (!proj.cards) return proj._count?.tasks || 0
  return proj.cards.filter((c: any) => c.status !== 'done').length
}
</script>
