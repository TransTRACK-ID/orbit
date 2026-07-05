<template>
  <div class="rounded-xl border border-amber-200 bg-amber-50/80 overflow-hidden">
    <div class="px-3.5 py-2.5 border-b border-amber-100 flex items-center gap-2">
      <Icon name="lucide:help-circle" class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
      <p class="text-xs font-semibold text-amber-900">
        {{ metadata.topic ? `${metadata.topic} — ` : '' }}Question
      </p>
    </div>

    <div class="px-3.5 py-3 space-y-3">
      <p class="text-sm text-surface-900 leading-relaxed">{{ metadata.question }}</p>

      <div class="rounded-lg border border-amber-100 bg-white px-3 py-2.5">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1">Recommended answer</p>
        <p class="text-sm text-surface-800 leading-relaxed">{{ metadata.recommendedAnswer }}</p>
        <p v-if="metadata.rationale" class="text-[11px] text-surface-500 mt-2 leading-relaxed">
          {{ metadata.rationale }}
        </p>
      </div>

      <div v-if="!disabled && !answered" class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors flex items-center gap-1.5"
          @click="$emit('useRecommended', metadata.recommendedAnswer)"
        >
          <Icon name="lucide:check" class="w-3 h-3" />
          Use recommended
        </button>
        <p class="text-[11px] text-surface-500">Or type your own answer below</p>
      </div>

      <div v-else-if="answered" class="flex items-center gap-1.5 text-[11px] text-emerald-700">
        <Icon name="lucide:check-circle" class="w-3.5 h-3.5" />
        <span>Answer recorded</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GrillQuestionMetadata } from '~/types'

defineProps<{
  metadata: GrillQuestionMetadata
  disabled?: boolean
  answered?: boolean
}>()

defineEmits<{
  useRecommended: [answer: string]
}>()
</script>
