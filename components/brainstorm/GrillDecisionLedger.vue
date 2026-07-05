<template>
  <div class="mt-2 pt-2 border-t border-surface-100">
    <div class="flex items-center justify-between px-1 mb-1.5">
      <span class="text-[10px] font-medium text-surface-500 uppercase tracking-wide flex items-center gap-1">
        <Icon name="lucide:git-branch" class="w-3 h-3" />
        Decisions
      </span>
      <span
        class="text-[10px] px-1.5 py-0.5 rounded-full"
        :class="isComplete
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-700'"
      >
        {{ resolved.length }} resolved
      </span>
    </div>

    <div v-if="resolved.length === 0 && !pending && !summary" class="px-1 py-2">
      <p class="text-[11px] text-surface-400 leading-relaxed">
        Decisions will appear here as you answer grill questions.
      </p>
    </div>

    <div v-else class="space-y-1">
      <div
        v-for="decision in resolved"
        :key="decision.messageId || `${decision.topic}-${decision.question}`"
        class="px-2 py-1.5 rounded-lg bg-white border border-surface-100"
      >
        <div class="flex items-start gap-1.5">
          <Icon name="lucide:check-circle" class="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-semibold text-surface-800 truncate">
              {{ decision.topic }}
            </p>
            <p class="text-[10px] text-surface-600 leading-snug mt-0.5 line-clamp-2">
              {{ decision.answer }}
            </p>
            <p
              v-if="decision.status === 'revised'"
              class="text-[9px] text-amber-600 mt-0.5"
            >
              Revised from recommended
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="pending"
        class="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100"
      >
        <div class="flex items-start gap-1.5">
          <Icon name="lucide:clock" class="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-semibold text-amber-900 truncate">
              {{ pending.topic || 'Pending' }}
            </p>
            <p class="text-[10px] text-amber-800 leading-snug mt-0.5 line-clamp-2">
              {{ pending.question }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="isComplete && summary"
        class="px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 mt-1"
      >
        <p class="text-[10px] font-semibold text-emerald-800 mb-0.5">Session complete</p>
        <p class="text-[10px] text-emerald-700 leading-snug line-clamp-3">{{ summary }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GrillDecision, GrillPendingDecision } from '~/types'

defineProps<{
  resolved: GrillDecision[]
  pending: GrillPendingDecision | null
  summary: string | null
  isComplete: boolean
}>()
</script>
