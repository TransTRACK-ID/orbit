<template>
  <div
    class="px-3 py-2 cursor-pointer select-none transition-colors duration-150 rounded-lg mx-2 my-0.5"
    :class="selected
      ? 'bg-accent/8 ring-1 ring-accent/20'
      : 'hover:bg-surface-50'"
  >
    <div class="flex items-start gap-2.5">
      <!-- Status Icon -->
      <div class="mt-0.5 flex-shrink-0">
        <svg
          v-if="pullRequest.status === 'open' && !pullRequest.draft"
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-green-500"
        >
          <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
        </svg>
        <svg
          v-else-if="pullRequest.status === 'merged'"
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-purple-500"
        >
          <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 18V5a2 2 0 0 1 2-2h7" /><line x1="13" y1="15" x2="18" y2="15" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-red-400"
        >
          <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
        </svg>
      </div>

      <div class="flex-1 min-w-0">
        <!-- PR number + title -->
        <p
          class="text-xs font-medium text-surface-900 truncate leading-snug"
          :class="selected ? 'text-accent font-semibold' : ''"
        >
          #{{ pullRequest.githubNumber }} {{ pullRequest.title }}
        </p>

        <!-- Repo + task -->
        <p class="text-xs text-surface-500 truncate mt-0.5">
          <span v-if="pullRequest.repository">{{ pullRequest.repository.name }}</span>
          <span v-if="pullRequest.task"> · {{ pullRequest.task.title }}</span>
        </p>

        <!-- Badges -->
        <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
          <ReviewsReviewStateChip :state="pullRequest.reviewState" />

          <span
            v-if="pullRequest.draft"
            class="text-xs px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500 font-medium"
          >
            Draft
          </span>

          <span
            v-if="pullRequest.agentFixStatus === 'in_progress'"
            class="text-xs px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium flex items-center gap-1"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
            Fixing...
          </span>
          <span
            v-else-if="pullRequest.agentFixStatus === 'done'"
            class="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium"
          >
            Fix applied
          </span>

          <span
            v-if="isStale"
            class="text-xs px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium"
          >
            Stale
          </span>
        </div>

        <!-- Age + agent -->
        <div class="flex items-center gap-2 text-xs text-surface-400 mt-1.5">
          <span>{{ formatAge(pullRequest.createdAt) }}</span>
          <span v-if="pullRequest.task?.agentAssignee" class="flex items-center gap-1">
            <span
              class="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white"
              :style="{ background: pullRequest.task.agentAssignee.color || '#6366f1' }"
            >
              {{ (pullRequest.task.agentAssignee.initials || '?').charAt(0) }}
            </span>
            <span class="truncate">{{ pullRequest.task.agentAssignee.name }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PullRequest } from '~/types'

const props = defineProps<{
  pullRequest: PullRequest
  selected?: boolean
}>()

const isStale = computed(() => {
  const age = Date.now() - new Date(props.pullRequest.createdAt).getTime()
  return age > 3 * 24 * 60 * 60 * 1000 && props.pullRequest.reviewState === 'pending'
})

function formatAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
</script>
