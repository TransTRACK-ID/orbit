<template>
  <div class="flex-1 bg-white flex flex-col overflow-hidden min-w-0">
    <UiLoadingState v-if="loading" text="Loading PR details..." />

    <template v-else-if="pullRequest">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-surface-100">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span
                class="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                :class="statusBadgeClass"
              >
                {{ pullRequest.status }}
              </span>
              <span
                v-if="pullRequest.draft"
                class="text-xs px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500 font-semibold"
              >
                Draft
              </span>
              <span
                class="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                :class="reviewStateBadgeClass"
              >
                {{ formatReviewState(pullRequest.reviewState) }}
              </span>
            </div>
            <h1 class="text-base font-semibold text-surface-900 leading-snug">
              #{{ pullRequest.githubNumber }} {{ pullRequest.title }}
            </h1>
            <div class="flex items-center gap-2 text-xs text-surface-500 mt-1">
              <span v-if="pullRequest.repository">{{ pullRequest.repository.name }}</span>
              <span v-if="pullRequest.task">· {{ pullRequest.task.title }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <div
              v-if="autoSync"
              class="flex items-center gap-1 text-xs text-green-600 font-medium"
              title="Auto-sync is on — this PR refreshes automatically"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
            <button
              class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 transition-colors flex items-center gap-1.5"
              @click="$emit('sync', pullRequest.id)"
            >
              <Icon name="lucide:refresh-cw" class="w-3.5 h-3.5" />
              Sync
            </button>
            <a
              :href="pullRequest.url"
              target="_blank"
              class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors flex items-center gap-1.5 no-underline"
            >
              <Icon name="lucide:external-link" class="w-3.5 h-3.5" />
              {{ platformLabel }}
            </a>
          </div>
        </div>

        <!-- Branch info -->
        <div class="flex items-center gap-2 mt-2 text-xs text-surface-500">
          <Icon name="lucide:git-branch" class="w-3.5 h-3.5" />
          <code class="bg-surface-100 px-1.5 py-0.5 rounded text-xs">{{ pullRequest.headBranch }}</code>
          <span>→</span>
          <code class="bg-surface-100 px-1.5 py-0.5 rounded text-xs">{{ pullRequest.baseBranch }}</code>
        </div>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto p-5 space-y-5">
        <!-- Diff -->
        <div>
          <h3 class="text-xs font-semibold text-surface-700 mb-2">Changes</h3>
          <ReviewsDiffViewer
            :diff="diff"
            :loading="diffLoading"
          />
        </div>

        <!-- Comments -->
        <div v-if="pullRequest.comments && pullRequest.comments.length > 0">
          <h3 class="text-xs font-semibold text-surface-700 mb-2">Review Comments</h3>
          <div class="space-y-2">
            <ReviewsReviewComment
              v-for="comment in pullRequest.comments"
              :key="comment.id"
              :comment="comment"
            />
          </div>
        </div>

        <!-- Actions -->
        <div v-if="pullRequest.reviewState === 'changes_requested'" class="flex gap-2">
          <button
            class="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors flex items-center justify-center gap-1.5"
            @click="$emit('fix-feedback', pullRequest.id)"
          >
            <Icon name="lucide:bot" class="w-3.5 h-3.5" />
            Fix with Agent
          </button>
        </div>

        <!-- Link to task -->
        <div v-if="pullRequest.task" class="pt-2 border-t border-surface-100">
          <NuxtLink
            :to="`/workspaces/${route.params.slug}/projects/${pullRequest.task.projectId}/board?task=${pullRequest.task.id}`"
            class="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1.5"
          >
            <Icon name="lucide:kanban" class="w-3.5 h-3.5" />
            View Task in Board
          </NuxtLink>
        </div>
      </div>
    </template>

    <UiEmptyState
      v-else
      title="Select a pull request"
      description="Click on a PR from the list to view details, diff, and comments."
      icon="lucide:git-pull-request"
    />
  </div>
</template>

<script setup lang="ts">
import type { PullRequest } from '~/types'

const route = useRoute()

const props = defineProps<{
  pullRequest: PullRequest | null
  diff: { files: any[]; totalAdditions: number; totalDeletions: number; rawDiff: string } | null
  loading?: boolean
  diffLoading?: boolean
  autoSync?: boolean
}>()

defineEmits<{
  sync: [id: string]
  'fix-feedback': [id: string]
}>()

const statusBadgeClass = computed(() => {
  const map: Record<string, string> = {
    open: 'bg-green-50 text-green-700',
    closed: 'bg-red-50 text-red-700',
    merged: 'bg-purple-50 text-purple-700',
  }
  return map[props.pullRequest?.status] || 'bg-surface-100 text-surface-600'
})

const reviewStateBadgeClass = computed(() => {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-green-50 text-green-700',
    changes_requested: 'bg-red-50 text-red-700',
    commented: 'bg-blue-50 text-blue-700',
  }
  return map[props.pullRequest?.reviewState] || 'bg-surface-100 text-surface-600'
})

function formatReviewState(state: string): string {
  const map: Record<string, string> = {
    pending: 'Pending Review',
    approved: 'Approved',
    changes_requested: 'Changes Requested',
    commented: 'Commented',
  }
  return map[state] || state
}

const platformLabel = computed(() => {
  const p = props.pullRequest?.repository?.platform
  if (p === 'gitlab' || p === 'gitlab-self-hosted') return 'Open in GitLab'
  return 'Open in GitHub'
})
</script>
