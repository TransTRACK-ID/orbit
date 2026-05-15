<template>
  <div
    class="px-4 py-3 cursor-pointer transition-colors"
    :class="selected ? 'bg-primary-50 border-l-2 border-primary-500' : 'hover:bg-surface-50 border-l-2 border-transparent'"
  >
    <div class="flex items-start gap-2">
      <!-- Status Icon -->
      <div class="mt-0.5 flex-shrink-0">
        <svg
          v-if="pullRequest.status === 'open' && !pullRequest.draft"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
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
          width="14"
          height="14"
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
          v-else-if="pullRequest.status === 'closed'"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-red-500"
        >
          <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-surface-400"
        >
          <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
        </svg>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 mb-0.5">
          <span class="text-xs font-medium text-surface-900 truncate">
            #{{ pullRequest.githubNumber }} {{ pullRequest.title }}
          </span>
        </div>

        <div class="flex items-center gap-1.5 text-[10px] text-surface-500 mb-1">
          <span v-if="pullRequest.repository" class="truncate">{{ pullRequest.repository.name }}</span>
          <span v-if="pullRequest.task" class="truncate">· {{ pullRequest.task.title }}</span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <span
            v-if="pullRequest.reviewState === 'changes_requested'"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold"
          >
            Changes Requested
          </span>
          <span
            v-else-if="pullRequest.reviewState === 'approved'"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-semibold"
          >
            Approved
          </span>
          <span
            v-else-if="pullRequest.reviewState === 'pending'"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold"
          >
            Pending Review
          </span>
          <span
            v-else-if="pullRequest.reviewState === 'commented'"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold"
          >
            Commented
          </span>

          <span
            v-if="pullRequest.draft"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500 font-semibold"
          >
            Draft
          </span>

          <span
            v-if="pullRequest.agentFixStatus === 'in_progress'"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-semibold flex items-center gap-1"
          >
            <span class="w-1 h-1 rounded-full bg-primary-500 animate-pulse" />
            Fixing...
          </span>
          <span
            v-else-if="pullRequest.agentFixStatus === 'done'"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-semibold"
          >
            Fix Applied
          </span>

          <span
            v-if="isStale"
            class="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 font-semibold"
          >
            Stale
          </span>
        </div>

        <div class="flex items-center gap-2 text-[10px] text-surface-400 mt-1">
          <span>{{ formatAge(pullRequest.createdAt) }}</span>
          <span v-if="pullRequest.task?.agentAssignee" class="flex items-center gap-1">
            <span
              class="w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold text-white"
              :style="{ background: pullRequest.task.agentAssignee.color || '#E84D6A' }"
            >
              {{ pullRequest.task.agentAssignee.initials }}
            </span>
            {{ pullRequest.task.agentAssignee.name }}
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
