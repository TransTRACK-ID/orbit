<template>
  <div class="rounded-lg bg-surface-50 p-3">
    <div class="flex items-center gap-1.5 mb-1">
      <span class="text-[10px] font-semibold text-surface-700 bg-surface-200 rounded-full px-1.5 py-0.5">{{ comment.author }}</span>
      <span v-if="comment.path" class="text-[9px] text-surface-400 font-mono truncate">{{ comment.path }}{{ comment.line ? `:${comment.line}` : '' }}</span>
      <span v-if="comment.isReview" class="text-[9px] text-amber-500 ml-auto">review</span>
    </div>
    <div class="text-[11px] text-surface-600 leading-relaxed whitespace-pre-wrap">{{ comment.body }}</div>

    <!-- Fix status indicator -->
    <div v-if="comment.agentFixAppliedAt" class="mt-1.5 flex items-center gap-1">
      <span class="w-1 h-1 rounded-full bg-green-500" />
      <span class="text-[9px] text-green-600 font-medium">Fixed by agent</span>
    </div>
    <div v-else-if="comment.resolved" class="mt-1.5 flex items-center gap-1">
      <span class="w-1 h-1 rounded-full bg-surface-400" />
      <span class="text-[9px] text-surface-500 font-medium">Resolved</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PrComment } from '~/types'

defineProps<{
  comment: PrComment
}>()
</script>
