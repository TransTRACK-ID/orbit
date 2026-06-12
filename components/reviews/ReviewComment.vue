<template>
  <div class="rounded-xl bg-surface-50 border border-surface-100 p-4">
    <div class="flex items-start gap-3">
      <!-- Author avatar -->
      <div class="w-7 h-7 rounded-full bg-surface-200 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-surface-600">
        {{ (comment.author || '?').charAt(0).toUpperCase() }}
      </div>

      <div class="flex-1 min-w-0">
        <!-- Author + location -->
        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
          <span class="text-xs font-semibold text-surface-800">{{ comment.author }}</span>
          <code v-if="comment.path" class="text-xs text-surface-500 font-mono bg-surface-100 px-1.5 py-0.5 rounded truncate max-w-48">
            {{ comment.path }}{{ comment.line ? `:${comment.line}` : '' }}
          </code>
          <span v-if="comment.isReview" class="text-xs text-amber-600 font-medium ml-auto">Review</span>
        </div>

        <!-- Comment body -->
        <p class="text-xs text-surface-700 leading-relaxed whitespace-pre-wrap">{{ comment.body }}</p>

        <!-- Fix status -->
        <div v-if="comment.agentFixAppliedAt" class="mt-2 flex items-center gap-1.5">
          <Icon name="lucide:check-circle" class="w-3.5 h-3.5 text-green-500" />
          <span class="text-xs text-green-700 font-medium">Fixed by agent</span>
        </div>
        <div v-else-if="comment.resolved" class="mt-2 flex items-center gap-1.5">
          <Icon name="lucide:check" class="w-3.5 h-3.5 text-surface-400" />
          <span class="text-xs text-surface-500 font-medium">Resolved</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PrComment } from '~/types'

defineProps<{
  comment: PrComment
}>()
</script>
