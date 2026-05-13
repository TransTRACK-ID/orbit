<template>
  <div class="px-6 py-3 bg-white border-b border-surface-200 flex items-center gap-4 flex-wrap">
    <div class="flex items-center gap-1.5 text-sm">
      <span class="text-surface-500">Open</span>
      <span class="font-semibold text-surface-900">{{ stats?.totalOpen ?? 0 }}</span>
    </div>
    <div class="w-px h-4 bg-surface-200" />
    <div class="flex items-center gap-1.5 text-sm">
      <span class="w-2 h-2 rounded-full bg-amber-400" />
      <span class="text-surface-500">Awaiting Review</span>
      <span class="font-semibold text-surface-900">{{ stats?.awaitingReview ?? 0 }}</span>
    </div>
    <div class="w-px h-4 bg-surface-200" />
    <div class="flex items-center gap-1.5 text-sm">
      <span class="w-2 h-2 rounded-full bg-red-400" />
      <span class="text-surface-500">Needs Agent Fix</span>
      <span class="font-semibold text-surface-900">{{ stats?.needsAgentFix ?? 0 }}</span>
    </div>
    <div class="w-px h-4 bg-surface-200" />
    <div class="flex items-center gap-1.5 text-sm">
      <span class="w-2 h-2 rounded-full bg-orange-400" />
      <span class="text-surface-500">Stale</span>
      <span class="font-semibold text-surface-900">{{ stats?.stale ?? 0 }}</span>
    </div>
    <div class="w-px h-4 bg-surface-200" />
    <div class="flex items-center gap-1.5 text-sm">
      <span class="text-surface-500">Blocked</span>
      <span class="font-semibold text-surface-900">{{ stats?.mergeBlocked ?? 0 }}</span>
    </div>
    <div class="w-px h-4 bg-surface-200" />
    <div class="flex items-center gap-1.5 text-sm">
      <span class="text-surface-500">Avg Review</span>
      <span class="font-semibold text-surface-900">{{ formatDuration(stats?.avgReviewTimeMs) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  workspaceId?: string
  loading?: boolean
  stats?: {
    totalOpen: number
    awaitingReview: number
    needsAgentFix: number
    stale: number
    agentBacklog: number
    mergeBlocked: number
    highFriction: number
    avgReviewTimeMs: number
  } | null
}>()

function formatDuration(ms: number | undefined): string {
  if (!ms || ms === 0) return '—'
  const hours = Math.round(ms / (1000 * 60 * 60))
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}
</script>
