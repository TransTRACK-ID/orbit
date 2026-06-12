<template>
  <div class="flex flex-col flex-1 min-h-0 overflow-hidden bg-surface-50">
    <!-- Bottleneck Stats Bar -->
    <ReviewsBottleneckStats
      :workspace-id="workspace?.id"
      :loading="bottlenecksLoading"
      :stats="bottleneckStats"
    />

    <div v-if="repositories.length === 0" class="flex-1 flex flex-col items-center justify-center p-8">
      <UiEmptyState
        title="No repositories connected"
        description="Connect a GitHub or GitLab repository to start tracking pull requests and review feedback."
        icon="lucide:git-branch"
      >
        <NuxtLink :to="`/workspaces/${slug}/settings?tab=repositories&focus=add-repo`">
          <Button>
            <Icon name="lucide:plus" class="w-3.5 h-3.5" />
            Add Repository
          </Button>
        </NuxtLink>
      </UiEmptyState>
    </div>

    <div v-else class="flex flex-1 overflow-hidden min-h-0">
      <!-- Filter Sidebar -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-x-2"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 -translate-x-2"
      >
        <ReviewsPrFilterSidebar
          v-if="showFilters"
          v-model:status="filterStatus"
          v-model:review-state="filterReviewState"
          v-model:repository-id="filterRepositoryId"
          v-model:search="filterSearch"
          :repositories="repositories"
          :loading="prsLoading"
          @refresh="loadPullRequests"
        />
      </Transition>

      <!-- PR List -->
      <ReviewsPrList
        :pull-requests="filteredPullRequests"
        :selected-id="selectedPrId"
        :loading="prsLoading"
        :refreshing="prsRefreshing"
        :auto-sync="autoSyncEnabled"
        :show-filters="showFilters"
        :active-filter-count="activeFilterCount"
        @select="selectPr"
        @toggle-auto-sync="toggleAutoSync"
        @update:show-filters="showFilters = $event"
      />

      <!-- Detail Panel -->
      <ReviewsPrDetailPanel
        :pull-request="selectedPr"
        :diff="prDiff"
        :loading="detailLoading"
        :diff-loading="diffLoading"
        :auto-sync="autoSyncEnabled"
        :fixing-feedback="fixingFeedback"
        :syncing="prSyncing"
        @sync="syncPr"
        @fix-feedback="fixFeedback"
        @merged="handleMerged"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { PullRequest, Workspace, Repository } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { getWorkspaceBySlug } = useWorkspace()
const { fetchRepositories } = useRepository()
const { startRuntime } = useAgentRuntime()

const workspace = ref<Workspace | null>(null)
const repositories = ref<Repository[]>([])
const pullRequests = ref<PullRequest[]>([])
const prsLoading = ref(false)
const prsRefreshing = ref(false) // silent background refresh indicator

const showFilters = ref(false)

const filterStatus = ref<string>('open')
const filterReviewState = ref<string | undefined>(undefined)
const filterRepositoryId = ref<string | undefined>(undefined)
const filterSearch = ref('')

const activeFilterCount = computed(() => {
  let count = 0
  if (filterSearch.value.trim()) count++
  if (filterStatus.value !== 'open') count++
  if (filterReviewState.value) count++
  if (filterRepositoryId.value) count++
  return count
})

const selectedPrId = ref<string | null>(null)
const selectedPr = ref<PullRequest | null>(null)
const detailLoading = ref(false)

const prDiff = ref<{ files: any[]; totalAdditions: number; totalDeletions: number; rawDiff: string; error?: string } | null>(null)
const diffLoading = ref(false)
const fixingFeedback = ref(false)
const prSyncing = ref(false)

const bottleneckStats = ref<any>(null)
const bottlenecksLoading = ref(false)

const autoSyncEnabled = useLocalStorage('orbit-reviews-auto-sync', false)
let autoSyncTimer: ReturnType<typeof setInterval> | null = null

const filteredPullRequests = computed(() => pullRequests.value)

function toggleAutoSync() {
  autoSyncEnabled.value = !autoSyncEnabled.value
}

async function syncAllPullRequests() {
  if (!workspace.value) return
  try {
    await $fetch(`/api/workspaces/${workspace.value.id}/pull-requests/sync-all`, { method: 'POST' })
  } catch (err) {
    console.error('Bulk PR sync failed:', err)
  }
}

function startAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer)
  // Run an immediate sync when auto-sync is turned on
  syncAllPullRequests().then(() => Promise.all([loadPullRequests(), loadBottlenecks()]))
  autoSyncTimer = setInterval(async () => {
    if (!workspace.value) return
    // Sync all open PRs against GitHub/GitLab, then refresh the list silently
    await syncAllPullRequests()
    await Promise.all([
      loadPullRequests(true), // silent — no spinner, no content wipe
      loadBottlenecks(),
    ])
    // If a PR is selected, silently refresh its detail without wiping the panel
    if (selectedPrId.value) {
      await silentRefreshPr(selectedPrId.value)
    }
  }, 30000) // every 30 seconds
}

function stopAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
}

watch(autoSyncEnabled, (enabled) => {
  if (enabled) {
    startAutoSync()
  } else {
    stopAutoSync()
  }
})

onBeforeUnmount(() => {
  stopAutoSync()
})

async function loadWorkspace() {
  workspace.value = await getWorkspaceBySlug(slug.value)
}

async function loadRepositories() {
  if (!workspace.value) return
  repositories.value = await fetchRepositories(workspace.value.id)
}

async function loadPullRequests(silent = false) {
  if (!workspace.value) return
  if (silent) {
    prsRefreshing.value = true
  } else {
    prsLoading.value = true
  }
  try {
    const query: Record<string, string> = {}
    if (filterStatus.value) query.status = filterStatus.value
    if (filterReviewState.value) query.reviewState = filterReviewState.value
    if (filterRepositoryId.value) query.repositoryId = filterRepositoryId.value
    if (filterSearch.value) query.search = filterSearch.value

    const res = await $fetch<{ pullRequests: PullRequest[] }>(
      `/api/workspaces/${workspace.value.id}/pull-requests`,
      { query }
    )
    pullRequests.value = res.pullRequests
  } catch (err) {
    console.error('Failed to load pull requests:', err)
  } finally {
    prsLoading.value = false
    prsRefreshing.value = false
  }
}

async function loadBottlenecks() {
  if (!workspace.value) return
  bottlenecksLoading.value = true
  try {
    const res = await $fetch(`/api/workspaces/${workspace.value.id}/review-bottlenecks`)
    bottleneckStats.value = res.stats || null
  } catch (err) {
    console.error('Failed to load bottlenecks:', err)
  } finally {
    bottlenecksLoading.value = false
  }
}

async function selectPr(id: string) {
  selectedPrId.value = id
  selectedPr.value = null
  prDiff.value = null
  detailLoading.value = true
  diffLoading.value = true

  try {
    const res = await $fetch<{ pullRequest: PullRequest }>(`/api/pull-requests/${id}`)
    selectedPr.value = res.pullRequest
  } catch (err) {
    console.error('Failed to load PR detail:', err)
  } finally {
    detailLoading.value = false
  }

  try {
    const diffRes = await $fetch<{ files: any[]; totalAdditions: number; totalDeletions: number; rawDiff: string; error?: string }>(`/api/pull-requests/${id}/diff`)
    prDiff.value = diffRes
  } catch (err) {
    console.error('Failed to load diff:', err)
  } finally {
    diffLoading.value = false
  }
}

/**
 * Silent background refresh — updates state in-place without clearing content
 * or showing loading spinners. Used by auto-sync to avoid UI flash.
 */
async function silentRefreshPr(id: string) {
  try {
    const res = await $fetch<{ pullRequest: PullRequest }>(`/api/pull-requests/${id}`)
    // Only update if this PR is still selected
    if (selectedPrId.value === id) {
      selectedPr.value = res.pullRequest
    }
  } catch (err) {
    console.error('Failed to silently refresh PR detail:', err)
  }

  try {
    const diffRes = await $fetch<{ files: any[]; totalAdditions: number; totalDeletions: number; rawDiff: string; error?: string }>(`/api/pull-requests/${id}/diff`)
    if (selectedPrId.value === id) {
      prDiff.value = diffRes
    }
  } catch (err) {
    console.error('Failed to silently refresh diff:', err)
  }
}

async function syncPr(id: string) {
  prSyncing.value = true
  try {
    await $fetch(`/api/pull-requests/${id}/sync`, { method: 'POST' })
    // Refresh data without blanking the panel — silent refresh keeps content visible
    await Promise.all([
      silentRefreshPr(id),
      loadPullRequests(true),
      loadBottlenecks(),
    ])
  } catch (err) {
    console.error('Failed to sync PR:', err)
  } finally {
    prSyncing.value = false
  }
}

async function fixFeedback(id: string) {
  if (fixingFeedback.value) return
  fixingFeedback.value = true
  try {
    const res = await $fetch<{ success: true; taskId: string; commentCount: number; feedbackLength: number }>(`/api/pull-requests/${id}/fix-feedback`, { method: 'POST' })
    if (res.success && res.taskId) {
      // The server already stored the feedback; we just need to start the runtime stream
      await startRuntime(res.taskId)

      // Navigate to the task board so the user can watch the agent work
      const pr = selectedPr.value
      if (pr?.task?.project?.id) {
        await navigateTo(`/workspaces/${slug.value}/projects/${pr.task.project.id}/board?task=${pr.task.id}`)
      }
    }
  } catch (err) {
    console.error('Failed to fix feedback:', err)
  } finally {
    fixingFeedback.value = false
  }
}

async function handleMerged() {
  // Optimistically update the selected PR status in-place
  if (selectedPr.value) {
    selectedPr.value = { ...selectedPr.value, status: 'merged' }
  }
  // Silently refresh the list so the PR's status chip updates
  await loadPullRequests(true)
}

watch([filterStatus, filterReviewState, filterRepositoryId, filterSearch], () => {
  loadPullRequests()
}, { immediate: false })

onMounted(async () => {
  await loadWorkspace()
  await loadRepositories()
  await Promise.all([loadPullRequests(), loadBottlenecks()])

  // Pre-select PR from query param
  const prId = route.query.pr as string
  if (prId) {
    selectPr(prId)
    return
  }

  // Pre-select PR by task ID
  const taskId = route.query.task as string
  if (taskId) {
    const pr = pullRequests.value.find((p) => p.taskId === taskId)
    if (pr) {
      selectPr(pr.id)
    }
  }

  // Resume auto-sync if it was previously enabled
  if (autoSyncEnabled.value) {
    startAutoSync()
  }
})
</script>
