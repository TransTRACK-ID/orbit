<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Topbar -->
    <div class="h-14 flex-shrink-0 flex items-center justify-between px-6 sm:px-8 bg-white border-b border-surface-200">
      <div class="flex items-center gap-3">
        <h1 class="text-base font-semibold text-surface-900">Releases</h1>
        <span class="text-xs text-surface-500 hidden sm:inline">Published release notes across all apps</span>
      </div>
      <div class="flex items-center gap-3">
        <TextInput
          v-model="searchQuery"
          placeholder="Search releases…"
          class="w-48 sm:w-64"
          clearable
        />
        <select
          v-model="appFilter"
          class="h-10 px-3 text-sm border border-surface-200 rounded-lg bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
        >
          <option value="">All apps</option>
          <option v-for="app in apps" :key="app.id" :value="app.name">{{ app.name }}</option>
        </select>
        <Button color="primary" @click="navigateToChangelog">
          <Icon name="lucide:plus" class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">New Release</span>
        </Button>
      </div>
    </div>

    <!-- Content -->
    <div class="p-6 sm:p-8">
      <div class="max-w-4xl">
        <!-- Loading -->
        <UiLoadingState v-if="loading" text="Loading releases…" />

        <!-- Empty state (no releases at all) -->
        <UiEmptyState
          v-else-if="filteredReleases.length === 0 && !searchQuery && !appFilter"
          title="No releases yet"
          description="Create your first release note to start tracking changes across your apps."
          tip="Releases are tied to app versions and help your team stay informed."
          icon="lucide:file-text"
        >
          <Button color="primary" @click="navigateToChangelog">
            <Icon name="lucide:plus" class="w-3.5 h-3.5" />
            Create first release
          </Button>
        </UiEmptyState>

        <!-- Filtered empty state -->
        <div v-else-if="filteredReleases.length === 0" class="py-16 text-center">
          <p class="text-sm font-medium text-surface-900 mb-1">No releases found</p>
          <span class="text-xs text-surface-500">Try adjusting your search or filter</span>
        </div>

        <!-- Release list -->
        <div v-else class="space-y-0">
          <article
            v-for="release in filteredReleases"
            :key="release.id"
            class="flex items-start gap-6 py-6 border-b border-surface-200 transition-opacity"
          >
            <!-- Date -->
            <div class="w-[120px] flex-shrink-0 font-mono text-xs text-surface-500 pt-0.5">
              {{ formatDate(release.date) }}
            </div>

            <!-- Body -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1.5">
                <NuxtLink
                  :to="`/workspaces/${slug}/releases/${release.id}`"
                  class="text-sm font-semibold text-surface-900 hover:text-accent transition-colors"
                >
                  {{ release.app }} {{ release.version }}
                </NuxtLink>
                <span
                  v-if="mediaCount(release) > 0"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-100 text-surface-500"
                >
                  <Icon name="lucide:image" class="w-3 h-3" />
                  {{ mediaCount(release) }} media
                </span>
              </div>

              <p class="text-sm text-surface-500 leading-relaxed mb-3">
                {{ release.summary || release.heroTitle || 'No summary provided.' }}
              </p>

              <div class="flex items-center gap-3 flex-wrap">
                <span class="flex items-center gap-1.5 text-xs text-surface-500">
                  <span class="w-1.5 h-1.5 rounded-full bg-accent" />
                  {{ release.app }}
                </span>

                <span
                  v-if="categoryCount(release.categories, 'added') > 0"
                  class="pill-green"
                >
                  {{ categoryCount(release.categories, 'added') }} added
                </span>
                <span
                  v-if="categoryCount(release.categories, 'fixed') > 0"
                  class="pill-blue"
                >
                  {{ categoryCount(release.categories, 'fixed') }} fixed
                </span>
                <span
                  v-if="categoryCount(release.categories, 'changed') > 0"
                  class="pill-amber"
                >
                  {{ categoryCount(release.categories, 'changed') }} changed
                </span>
                <span
                  v-if="categoryCount(release.categories, 'deprecated') > 0"
                  class="pill-purple"
                >
                  {{ categoryCount(release.categories, 'deprecated') }} deprecated
                </span>
                <span
                  v-if="categoryCount(release.categories, 'security') > 0"
                  class="pill-red"
                >
                  {{ categoryCount(release.categories, 'security') }} security
                </span>

                <NuxtLink
                  :to="`/workspaces/${slug}/changelog?app=${encodeURIComponent(release.appId)}&version=${encodeURIComponent(release.versionId)}`"
                  class="ml-auto text-xs text-surface-400 hover:text-surface-700 transition-colors"
                >
                  Edit changelog
                </NuxtLink>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FlattenedRelease, ReleaseCategories } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { workspace, getWorkspaceBySlug } = useWorkspace()
const { apps, releases, loading, fetchApps, fetchReleases } = useReleases()

const searchQuery = ref('')
const appFilter = ref('')

// Server-side data fetch
const { data: ssrData } = await useAsyncData(
  `releases-${slug.value}`,
  async () => {
    const ws = await $fetch(`/api/workspaces/by-slug/${slug.value}`)
    const [appsData, releasesData] = await Promise.all([
      $fetch(`/api/workspaces/${ws.id}/docs-apps`),
      $fetch(`/api/workspaces/${ws.id}/releases`),
    ])
    return { workspace: ws, apps: appsData, releases: releasesData }
  }
)

if (ssrData.value) {
  workspace.value = ssrData.value.workspace
  apps.value = ssrData.value.apps
  releases.value = ssrData.value.releases
}

onMounted(async () => {
  if (!workspace.value) {
    workspace.value = await getWorkspaceBySlug(slug.value)
  }
  if (workspace.value && (!apps.value.length || !releases.value.length)) {
    await Promise.all([
      fetchApps(workspace.value.id),
      fetchReleases(workspace.value.id),
    ])
  }
})

const filteredReleases = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  return releases.value.filter((r: FlattenedRelease) => {
    const matchesQuery = !query ||
      r.app.toLowerCase().includes(query) ||
      r.version.toLowerCase().includes(query) ||
      (r.summary && r.summary.toLowerCase().includes(query)) ||
      (r.heroTitle && r.heroTitle.toLowerCase().includes(query))
    const matchesApp = !appFilter.value || r.app === appFilter.value
    return matchesQuery && matchesApp
  })
})

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function categoryCount(categories: ReleaseCategories | undefined, key: keyof ReleaseCategories) {
  if (!categories) return 0
  return (categories[key] || []).length
}

function mediaCount(release: FlattenedRelease) {
  if (!release.features) return 0
  return release.features.reduce((sum, f) => sum + (f.media?.length || 0), 0)
}

function navigateToChangelog() {
  navigateTo(`/workspaces/${slug.value}/changelog`)
}
</script>

<style scoped>
.pill-green {
  @apply inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium;
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}
.pill-blue {
  @apply inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium;
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}
.pill-amber {
  @apply inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium;
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}
.pill-purple {
  @apply inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium;
  background: rgba(168, 85, 247, 0.1);
  color: #9333ea;
}
.pill-red {
  @apply inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium;
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.dark .pill-green {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}
.dark .pill-blue {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}
.dark .pill-amber {
  background: rgba(245, 158, 11, 0.15);
  color: #fcd34d;
}
.dark .pill-purple {
  background: rgba(168, 85, 247, 0.15);
  color: #c4b5fd;
}
.dark .pill-red {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}
</style>
