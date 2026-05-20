<template>
  <div class="flex-1 overflow-y-auto py-5 px-4 sm:py-7 sm:px-8">
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-xl font-bold text-surface-900">Workspaces</h1>
      <button
        class="px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-surface-50 transition-colors"
        @click="showCreateModal = true"
      >
        <Icon name="lucide:plus" class="w-3 h-3" />
        Add Workspace
      </button>
    </div>
    <p class="text-xs text-surface-400 mb-7" v-if="!loading">
      {{ totalWorkspaces }} workspaces
    </p>

    <UiLoadingState v-if="loading" text="Loading workspaces..." />

    <UiEmptyState
      v-else-if="workspaces.length === 0"
      title="No workspaces yet"
      description="Workspaces group your projects and team members together."
      tip="Start with one workspace, you can add more anytime."
      icon="ph:folder-notch-open"
    >
      <button
        class="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors"
        @click="showCreateModal = true"
      >
        Create workspace
      </button>
    </UiEmptyState>

    <!-- Workspace sections (prototype style) -->
    <div v-else>
      <div v-for="ws in workspaces" :key="ws.id" class="mb-9">
        <div class="flex items-center gap-2.5 mb-4">
          <div
            class="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white flex-shrink-0"
            :style="{ background: getWsColor(ws) }"
          >
            <Icon name="lucide:folder" class="w-3 h-3" />
          </div>
          <NuxtLink :to="`/workspaces/${ws.slug}`" class="text-sm font-semibold text-surface-900 hover:text-accent transition-colors">
            {{ ws.name }}
          </NuxtLink>
          <span class="text-xs text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full font-medium">
            {{ ws._count?.projects || 0 }} projects · {{ ws._count?.members || 0 }} members
          </span>
          <NuxtLink
            class="ml-auto px-2.5 py-1 rounded-md border border-surface-200 text-xs font-semibold flex items-center gap-1 hover:bg-surface-50 transition-colors"
            :to="`/workspaces/${ws.slug}`"
          >
            <Icon name="lucide:arrow-right" class="w-2.5 h-2.5" />
            Open
          </NuxtLink>
        </div>

        <!-- Project cards (loaded on demand from detailed page) -->
        <div v-if="ws.description" class="text-sm text-surface-500 leading-snug mb-3">
          {{ ws.description }}
        </div>

        <!-- Stats cards in a row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <NuxtLink
            :to="`/workspaces/${ws.slug}`"
            class="bg-white border border-surface-200 rounded-xl p-[18px] cursor-pointer hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-150 flex items-center gap-3"
          >
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              :style="{ background: getWsColor(ws) }"
            >
              {{ wsInitials(ws.name) }}
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold text-surface-900 truncate">{{ ws.name }}</p>
              <p class="text-xs text-surface-500 mt-0.5">
                {{ ws._count?.projects || 0 }} projects · {{ ws._count?.members || 0 }} members
              </p>
            </div>
            <Icon name="lucide:chevron-right" class="w-4 h-4 text-surface-300 ml-auto flex-shrink-0" />
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Create workspace modal -->
    <WorkspaceCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="onWorkspaceCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { Workspace } from '~/types'

definePageMeta({
  layout: 'default',
})

const router = useRouter()
const { workspaces, fetchWorkspaces, loading } = useWorkspace()
const { needsOnboarding } = useOnboarding()

const showCreateModal = ref(false)
const totalWorkspaces = ref(0)

onMounted(async () => {
  await fetchWorkspaces()
  if (workspaces.value.length === 0 && needsOnboarding.value) {
    await navigateTo('/onboarding')
  }
})

watchEffect(() => {
  totalWorkspaces.value = workspaces.value.length
})

function onWorkspaceCreated(workspace: Workspace) {
  showCreateModal.value = false
  router.push(`/workspaces/${workspace.slug}`)
}

function getWsColor(ws: any) {
  return '#6366F1' // Default color since workspace schema has no color field
}

function wsInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
</script>
