<template>
  <div class="w-72 bg-white border-r border-surface-200 flex flex-col flex-shrink-0 min-h-0 overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2 flex-shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <button
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 bg-surface-50 hover:bg-surface-100 transition-colors text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none flex-shrink-0"
          :class="{ 'bg-surface-100 border-surface-300': showFilters }"
          title="Show or hide filters"
          @click="$emit('update:showFilters', !showFilters)"
        >
          <Icon name="lucide:filter" class="w-3.5 h-3.5" />
          <span class="max-sm:hidden">Filters</span>
          <span
            v-if="activeFilterCount > 0"
            class="px-1.5 py-0.5 rounded-full bg-accent text-white text-xs font-semibold min-w-[18px] text-center leading-none"
          >
            {{ activeFilterCount }}
          </span>
        </button>
        <span class="text-xs font-semibold text-surface-700 truncate">
          Pull Requests
          <span class="ml-1 text-surface-400 font-normal">({{ pullRequests.length }})</span>
        </span>
      </div>
      <button
        class="text-xs font-semibold px-2 py-1 rounded-md border transition-colors flex items-center gap-1.5"
        :class="autoSync
          ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-surface-200 text-surface-500 hover:bg-surface-50'"
        :title="autoSync ? 'Auto-sync is on' : 'Auto-sync is off'"
        @click="$emit('toggle-auto-sync')"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="autoSync ? 'bg-green-500 animate-pulse' : 'bg-surface-300'"
        />
        {{ autoSync ? 'Live' : 'Manual' }}
      </button>
    </div>

    <!-- Silent refresh progress bar -->
    <div class="relative h-0.5 flex-shrink-0 overflow-hidden bg-transparent">
      <div
        class="absolute inset-y-0 left-0 bg-accent transition-all duration-500"
        :class="refreshing ? 'opacity-100 animate-shimmer' : 'opacity-0'"
        style="width: 60%"
      />
    </div>

    <!-- List -->
    <div class="flex-1 min-h-0 overflow-y-auto py-1">
      <UiLoadingState v-if="loading" text="Loading PRs..." />

      <div v-else-if="pullRequests.length === 0" class="p-8 text-center">
        <Icon name="lucide:git-pull-request" class="w-8 h-8 mx-auto mb-3 text-surface-200" />
        <p class="text-sm font-medium text-surface-600">No pull requests</p>
        <p class="text-xs text-surface-400 mt-1">Try adjusting your filters</p>
      </div>

      <div v-else>
        <ReviewsPrListItem
          v-for="pr in pullRequests"
          :key="pr.id"
          :pull-request="pr"
          :selected="selectedId === pr.id"
          @click="$emit('select', pr.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PullRequest } from '~/types'

defineProps<{
  pullRequests: PullRequest[]
  selectedId: string | null
  loading?: boolean
  refreshing?: boolean
  autoSync?: boolean
  showFilters?: boolean
  activeFilterCount?: number
}>()

defineEmits<{
  select: [id: string]
  'toggle-auto-sync': []
  'update:showFilters': [show: boolean]
}>()
</script>

<style scoped>
@keyframes shimmer {
  0% { transform: translateX(-100%); width: 40%; }
  50% { width: 70%; }
  100% { transform: translateX(200%); width: 40%; }
}
.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer { animation: none; opacity: 0.6; }
}
</style>
