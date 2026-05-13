<template>
  <div class="w-80 bg-white border-r border-surface-200 flex flex-col flex-shrink-0">
    <div class="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-surface-800">
        Pull Requests ({{ pullRequests.length }})
      </h2>
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
}>()

defineEmits<{
  select: [id: string]
}>()
</script>
