<script setup lang="ts">
import type { AgentRunInsights } from '~/utils/agent-diagnostics'

const props = defineProps<{
  insights: AgentRunInsights | null
  loading?: boolean
}>()

const expanded = ref(true)
const showTimeline = ref(false)

const severityStyles = computed(() => {
  switch (props.insights?.severity) {
    case 'error':
      return {
        border: 'border-rose-200/70',
        bg: 'bg-gradient-to-r from-rose-50/80 to-red-50/60',
        badge: 'bg-rose-100 text-rose-700',
        title: 'text-rose-900',
        body: 'text-rose-800',
      }
    case 'warning':
      return {
        border: 'border-amber-200/70',
        bg: 'bg-gradient-to-r from-amber-50/80 to-orange-50/50',
        badge: 'bg-amber-100 text-amber-700',
        title: 'text-amber-900',
        body: 'text-amber-800',
      }
    case 'success':
      return {
        border: 'border-emerald-200/70',
        bg: 'bg-gradient-to-r from-emerald-50/70 to-green-50/50',
        badge: 'bg-emerald-100 text-emerald-700',
        title: 'text-emerald-900',
        body: 'text-emerald-800',
      }
    default:
      return {
        border: 'border-surface-200',
        bg: 'bg-gradient-to-r from-surface-50 to-surface-100/60',
        badge: 'bg-surface-200 text-surface-600',
        title: 'text-surface-800',
        body: 'text-surface-600',
      }
  }
})

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const showPanel = computed(() => {
  if (!props.insights) return false
  if (props.insights.diagnostics.length === 0) return false
  return props.insights.severity !== 'info' || props.insights.stats.stillInProgress
})
</script>

<template>
  <div
    v-if="showPanel || loading"
    class="rounded-xl border p-4 shadow-sm"
    :class="[severityStyles.border, severityStyles.bg]"
  >
    <button
      type="button"
      class="flex w-full items-start gap-3 text-left"
      @click="expanded = !expanded"
    >
      <div
        class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm"
        :class="severityStyles.title"
      >
        <svg v-if="loading" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg v-else-if="insights?.severity === 'error'" class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.24 0 2.02-1.27 1.39-2.28L13.39 5.3a1.5 1.5 0 00-2.78 0L3.68 16.72c-.63 1.01.15 2.28 1.39 2.28z" />
        </svg>
        <svg v-else-if="insights?.severity === 'warning'" class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <svg v-else class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider" :class="severityStyles.title">
            Agent run insights
          </span>
          <span
            v-if="insights"
            class="inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
            :class="severityStyles.badge"
          >
            {{ insights.severity }}
          </span>
        </div>
        <p v-if="insights" class="mt-1 text-sm font-semibold leading-snug" :class="severityStyles.title">
          {{ insights.headline }}
        </p>
        <p v-else class="mt-1 text-xs text-surface-500">Loading run diagnostics…</p>
      </div>
      <svg
        class="mt-1 h-4 w-4 flex-shrink-0 text-surface-400 transition-transform"
        :class="{ 'rotate-180': expanded }"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div v-if="expanded && insights" class="mt-3 space-y-3 border-t border-white/60 pt-3">
      <p class="text-xs leading-relaxed" :class="severityStyles.body">
        {{ insights.summary }}
      </p>

      <div
        v-if="insights.stats.loopRestarts || insights.stats.timeouts || insights.stats.errors"
        class="flex flex-wrap gap-2"
      >
        <span
          v-if="insights.stats.loopRestarts"
          class="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-amber-700"
        >
          {{ insights.stats.loopRestarts }} loop event(s)
        </span>
        <span
          v-if="insights.stats.timeouts"
          class="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-amber-700"
        >
          {{ insights.stats.timeouts }} timeout(s)
        </span>
        <span
          v-if="insights.stats.errors + insights.stats.crashes"
          class="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-rose-700"
        >
          {{ insights.stats.errors + insights.stats.crashes }} failed run(s)
        </span>
        <span
          v-if="insights.stats.doneCount"
          class="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"
        >
          {{ insights.stats.doneCount }} finished session(s)
        </span>
      </div>

      <div v-if="insights.suggestions.length" class="rounded-lg bg-white/60 p-3">
        <p class="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2">What you can do</p>
        <ul class="space-y-1.5">
          <li
            v-for="(tip, i) in insights.suggestions"
            :key="i"
            class="flex gap-2 text-[11px] leading-relaxed text-surface-700"
          >
            <span class="text-primary-500 font-bold">•</span>
            <span>{{ tip }}</span>
          </li>
        </ul>
      </div>

      <div v-if="insights.diagnostics.length">
        <button
          type="button"
          class="text-[10px] font-semibold text-surface-500 hover:text-surface-700"
          @click="showTimeline = !showTimeline"
        >
          {{ showTimeline ? 'Hide' : 'Show' }} event timeline ({{ insights.diagnostics.length }})
        </button>
        <div v-if="showTimeline" class="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-white/50 p-2">
          <div
            v-for="item in insights.diagnostics"
            :key="item.id"
            class="rounded-md border border-surface-100 bg-white px-2.5 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-semibold text-surface-800">{{ item.title }}</span>
              <span class="text-[9px] tabular-nums text-surface-400">{{ formatTime(item.timestamp) }}</span>
            </div>
            <p class="mt-0.5 text-[10px] leading-relaxed text-surface-600">{{ item.message }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
