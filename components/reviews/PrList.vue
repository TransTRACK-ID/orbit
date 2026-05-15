<template>
  <div class="w-80 bg-white border-r border-surface-200 flex flex-col flex-shrink-0">
    <div class="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-surface-800">
        Pull Requests ({{ pullRequests.length }})
      </h2>
      <button
        class="text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors flex items-center gap-1.5"
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
        {{ autoSync ? 'Auto' : 'Manual' }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <UiLoadingState v-if="loading" text="Loading PRs..." />

      <div v-else-if="pullRequests.length === 0" class="p-6 text-center">
        <p class="text-sm text-surface-400">No pull requests found</p>
      </div>

      <div v-else class="divide-y divide-surface-100">
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
  autoSync?: boolean
}>()

defineEmits<{
  select: [id: string]
  'toggle-auto-sync': []
}>()
</script>
