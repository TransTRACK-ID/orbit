<template>
  <div class="max-w-6xl mx-auto px-6 py-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Workspaces</h1>
        <p class="text-surface-500 mt-1">Manage your workspaces and collaboration</p>
      </div>
      <Button @click="showCreateModal = true">
        <Plus class="w-4 h-4" />
        New Workspace
      </Button>
    </div>

    <UiLoadingState v-if="loading" text="Loading workspaces..." />

    <UiEmptyState
      v-else-if="workspaces.length === 0"
      title="No workspaces yet"
      description="Create your first workspace to start organizing projects."
      icon="ph:folder-notch-open"
    >
      <Button @click="showCreateModal = true">
        <Plus class="w-4 h-4" />
        Create Workspace
      </Button>
    </UiEmptyState>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <WorkspaceCard
        v-for="workspace in workspaces"
        :key="workspace.id"
        :workspace="workspace"
        @click="router.push(`/workspaces/${workspace.slug}`)"
      />
    </div>

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

const showCreateModal = ref(false)

onMounted(async () => {
  await fetchWorkspaces()
})

function onWorkspaceCreated(workspace: Workspace) {
  showCreateModal.value = false
  router.push(`/workspaces/${workspace.slug}`)
}
</script>
