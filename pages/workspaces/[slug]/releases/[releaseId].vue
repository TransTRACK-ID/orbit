<template>
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-3xl mx-auto px-6 sm:px-8 py-8">
      <!-- Breadcrumb + Actions -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2 text-sm text-surface-500">
          <NuxtLink :to="`/workspaces/${slug}/releases`" class="hover:text-accent transition-colors">
            Releases
          </NuxtLink>
          <Icon name="lucide:chevron-right" class="w-3.5 h-3.5" />
          <span class="text-surface-900 font-medium">{{ release?.app }} {{ release?.version }}</span>
        </div>
        <NuxtLink
          v-if="release"
          :to="`/workspaces/${slug}/changelog?app=${encodeURIComponent(release.appId)}&version=${encodeURIComponent(release.versionId)}`"
          class="text-xs text-surface-500 hover:text-accent transition-colors flex items-center gap-1"
        >
          <Icon name="lucide:pencil" class="w-3 h-3" />
          Edit
        </NuxtLink>
      </div>

      <!-- Loading -->
      <UiLoadingState v-if="loading" text="Loading release…" />

      <template v-else-if="release">
        <!-- Header -->
        <div class="mb-8">
          <div class="flex items-center gap-2 mb-2">
            <span class="flex items-center gap-1.5 text-xs text-surface-500">
              <span class="w-1.5 h-1.5 rounded-full bg-accent" />
              {{ release.app }}
            </span>
            <span class="text-xs text-surface-400">·</span>
            <span class="font-mono text-xs text-surface-500">{{ formatDate(release.date) }}</span>
            <span class="text-xs text-surface-400">·</span>
            <span class="text-xs text-surface-500">{{ release.author }}</span>
          </div>
          <h1 class="text-xl font-semibold text-surface-900 mb-2">
            {{ release.heroTitle || `${release.app} ${release.version}` }}
          </h1>
          <p v-if="release.summary" class="text-sm text-surface-500 leading-relaxed">
            {{ release.summary }}
          </p>
        </div>

        <!-- Features -->
        <div v-if="release.features && release.features.length > 0" class="space-y-6 mb-8">
          <div
            v-for="feature in release.features"
            :key="feature.id"
            class="bg-white dark:bg-surface-100 border border-surface-200 rounded-xl p-5"
          >
            <h3 class="text-sm font-semibold text-surface-900 mb-1.5">{{ feature.heading }}</h3>
            <p class="text-sm text-surface-500 leading-relaxed">{{ feature.description }}</p>
            <div v-if="feature.media && feature.media.length > 0" class="mt-3 flex gap-2">
              <div
                v-for="(m, idx) in feature.media"
                :key="idx"
                class="w-24 h-16 bg-surface-100 border border-surface-200 rounded-lg flex items-center justify-center text-xs text-surface-400"
              >
                <Icon :name="m.type === 'video' ? 'lucide:video' : 'lucide:image'" class="w-4 h-4 mr-1" />
                {{ m.alt || m.type }}
              </div>
            </div>
          </div>
        </div>

        <!-- Categories -->
        <div v-if="hasCategories(release.categories)" class="space-y-5">
          <ReleasesCategorySection
            v-if="release.categories.added && release.categories.added.length > 0"
            title="Added"
            icon="lucide:plus-circle"
            icon-color-class="text-green-600"
            :items="release.categories.added"
          />
          <ReleasesCategorySection
            v-if="release.categories.fixed && release.categories.fixed.length > 0"
            title="Fixed"
            icon="lucide:check-circle"
            icon-color-class="text-blue-600"
            :items="release.categories.fixed"
          />
          <ReleasesCategorySection
            v-if="release.categories.changed && release.categories.changed.length > 0"
            title="Changed"
            icon="lucide:refresh-cw"
            icon-color-class="text-amber-600"
            :items="release.categories.changed"
          />
          <ReleasesCategorySection
            v-if="release.categories.deprecated && release.categories.deprecated.length > 0"
            title="Deprecated"
            icon="lucide:alert-triangle"
            icon-color-class="text-purple-600"
            :items="release.categories.deprecated"
          />
          <ReleasesCategorySection
            v-if="release.categories.security && release.categories.security.length > 0"
            title="Security"
            icon="lucide:shield"
            icon-color-class="text-red-600"
            :items="release.categories.security"
          />
        </div>

        <!-- No content -->
        <div v-if="(!release.features || release.features.length === 0) && !hasCategories(release.categories)" class="py-12 text-center">
          <p class="text-sm text-surface-500">No detailed changelog entries yet.</p>
        </div>
      </template>
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
const releaseId = computed(() => route.params.releaseId as string)
const { workspace, getWorkspaceBySlug } = useWorkspace()
const { getRelease, loading } = useReleases()

const release = ref<FlattenedRelease | null>(null)

// Server-side fetch
const { data: ssrRelease } = await useAsyncData(
  `release-${releaseId.value}`,
  async () => {
    return await $fetch<FlattenedRelease>(`/api/releases/${releaseId.value}`)
  }
)

if (ssrRelease.value) {
  release.value = ssrRelease.value
}

onMounted(async () => {
  if (!workspace.value) {
    workspace.value = await getWorkspaceBySlug(slug.value)
  }
  if (!release.value) {
    try {
      release.value = await getRelease(releaseId.value)
    } catch (err) {
      console.error('Failed to load release:', err)
    }
  }
})

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function hasCategories(categories?: ReleaseCategories) {
  if (!categories) return false
  return Object.values(categories).some(arr => arr && arr.length > 0)
}
</script>
