<template>
  <div class="flex-1 bg-white flex flex-col overflow-hidden min-w-0">
    <UiLoadingState v-if="loading" text="Loading PR details..." />

    <template v-else-if="pullRequest">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-surface-100 flex-shrink-0">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <!-- Status badges row -->
            <div class="flex items-center gap-1.5 mb-2">
              <span
                class="text-xs px-1.5 py-0.5 rounded-full font-medium"
                :class="statusBadgeClass"
              >
                {{ pullRequest.status }}
              </span>
              <span
                v-if="pullRequest.draft"
                class="text-xs px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500 font-medium"
              >
                Draft
              </span>
              <ReviewsReviewStateChip :state="pullRequest.reviewState" />
            </div>

            <!-- Title -->
            <h2 class="text-sm font-semibold text-surface-900 leading-snug">
              <span class="text-surface-400 font-normal mr-1">#{{ pullRequest.githubNumber }}</span>{{ pullRequest.title }}
            </h2>

            <!-- Repo + task -->
            <p class="text-xs text-surface-500 mt-1">
              <span v-if="pullRequest.repository">{{ pullRequest.repository.name }}</span>
              <span v-if="pullRequest.task"> · {{ pullRequest.task.title }}</span>
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <div
              v-if="autoSync"
              class="flex items-center gap-1 text-xs text-green-600 font-medium"
              title="Auto-sync is on"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>

            <!-- Merge button — owns all its own states (open/blocked/merging/merged) -->
            <ReviewsMergeButton
              :pull-request="pullRequest"
              @merged="$emit('merged')"
            />

            <button
              class="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 transition-colors flex items-center gap-1.5 disabled:opacity-60"
              :disabled="syncing"
              @click="$emit('sync', pullRequest.id)"
            >
              <Icon name="lucide:refresh-cw" class="w-3.5 h-3.5" :class="syncing ? 'animate-spin' : ''" />
              {{ syncing ? 'Syncing...' : 'Sync' }}
            </button>
            <a
              :href="pullRequest.url"
              target="_blank"
              class="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors flex items-center gap-1.5 no-underline"
            >
              <Icon name="lucide:external-link" class="w-3.5 h-3.5" />
              {{ platformLabel }}
            </a>
          </div>
        </div>

        <!-- Branch info + meta row -->
        <div class="flex items-center gap-4 mt-3">
          <div class="flex items-center gap-1.5 text-xs text-surface-500">
            <Icon name="lucide:git-branch" class="w-3.5 h-3.5 text-surface-400" />
            <code class="bg-surface-100 px-1.5 py-0.5 rounded text-xs font-mono">{{ pullRequest.headBranch }}</code>
            <span class="text-surface-300">→</span>
            <code class="bg-surface-100 px-1.5 py-0.5 rounded text-xs font-mono">{{ pullRequest.baseBranch }}</code>
          </div>

          <!-- Link to task -->
          <NuxtLink
            v-if="pullRequest.task"
            :to="`/workspaces/${route.params.slug}/projects/${pullRequest.task.projectId}/board?task=${pullRequest.task.id}`"
            class="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1 ml-auto no-underline"
          >
            <Icon name="lucide:kanban" class="w-3.5 h-3.5" />
            View task
          </NuxtLink>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="flex items-center gap-0 px-6 border-b border-surface-100 flex-shrink-0">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="relative px-4 py-2.5 text-xs font-medium transition-colors"
          :class="activeTab === tab.id
            ? 'text-surface-900'
            : 'text-surface-500 hover:text-surface-700'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <span
            v-if="tab.count !== undefined && tab.count > 0"
            class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium"
            :class="activeTab === tab.id ? 'bg-surface-100 text-surface-700' : 'bg-surface-50 text-surface-400'"
          >{{ tab.count }}</span>
          <!-- Active indicator -->
          <span
            class="absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-150"
            :class="activeTab === tab.id ? 'bg-accent' : 'bg-transparent'"
          />
        </button>
      </div>

      <!-- Tab panels -->
      <div class="flex-1 min-h-0 overflow-y-auto">

        <!-- Changes tab -->
        <div v-if="activeTab === 'changes'" class="p-5">
          <ReviewsDiffViewer
            :diff="diff"
            :loading="diffLoading"
          />
        </div>

        <!-- Comments tab -->
        <div v-else-if="activeTab === 'comments'" class="p-5">
          <div v-if="pullRequest.comments && pullRequest.comments.length > 0" class="space-y-3">
            <ReviewsReviewComment
              v-for="comment in pullRequest.comments"
              :key="comment.id"
              :comment="comment"
            />
          </div>
          <div v-else class="text-center py-10">
            <Icon name="lucide:message-square" class="w-8 h-8 mx-auto mb-3 text-surface-200" />
            <p class="text-sm font-medium text-surface-500">No review comments</p>
            <p class="text-xs text-surface-400 mt-1">Comments from reviewers will appear here</p>
          </div>

          <!-- Fix with Agent CTA when changes requested -->
          <div v-if="pullRequest.reviewState === 'changes_requested'" class="mt-5 pt-4 border-t border-surface-100">
            <div class="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
              <Icon name="lucide:bot" class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-red-800">Changes requested</p>
                <p class="text-xs text-red-600 mt-0.5">Let an AI agent address the reviewer's feedback automatically.</p>
                <button
                  class="mt-3 text-xs font-semibold px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  :disabled="fixingFeedback"
                  @click="$emit('fix-feedback', pullRequest.id)"
                >
                  <svg v-if="fixingFeedback" class="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  <Icon v-else name="lucide:bot" class="w-3.5 h-3.5" />
                  {{ fixingFeedback ? 'Fixing...' : 'Fix with agent' }}
                </button>
              </div>
            </div>
          </div>
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
  diff: { files: any[]; totalAdditions: number; totalDeletions: number; rawDiff: string; error?: string } | null
  loading?: boolean
  diffLoading?: boolean
  autoSync?: boolean
  fixingFeedback?: boolean
  syncing?: boolean
}>()

defineEmits<{
  sync: [id: string]
  'fix-feedback': [id: string]
  merged: []
}>()

// Default to 'changes' tab; switch to 'comments' if there are comments
const activeTab = ref<'changes' | 'comments'>('changes')

const commentCount = computed(() => props.pullRequest?.comments?.length ?? 0)
const diffFileCount = computed(() => props.diff?.files?.length ?? 0)

const tabs = computed(() => [
  { id: 'changes', label: 'Changes', count: diffFileCount.value },
  { id: 'comments', label: 'Comments', count: commentCount.value },
])

// Switch to comments tab when PR changes and has comments
watch(() => props.pullRequest?.id, () => {
  // Reset to changes tab when selecting a new PR
  activeTab.value = 'changes'
})

const statusBadgeClass = computed(() => {
  const map: Record<string, string> = {
    open: 'bg-green-50 text-green-700',
    closed: 'bg-red-50 text-red-700',
    merged: 'bg-purple-50 text-purple-700',
  }
  return map[props.pullRequest?.status ?? ''] || 'bg-surface-100 text-surface-600'
})

const platformLabel = computed(() => {
  const p = props.pullRequest?.repository?.platform
  if (p === 'gitlab' || p === 'gitlab-self-hosted') return 'GitLab'
  return 'GitHub'
})
</script>
