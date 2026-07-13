<script setup lang="ts">
import type { AgentRunInsights } from '~/utils/agent-diagnostics'
import { formatAgentRunInsightsForCopy } from '~/utils/agent-diagnostics'

export type RuntimeLogLine = {
  id: string
  message: string
  displayTime: string
}

const props = defineProps<{
  insights: AgentRunInsights | null
  runtimeLogs?: RuntimeLogLine[]
  taskTitle?: string | null
}>()

const showDetails = ref(false)
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const severityStyles = computed(() => {
  switch (props.insights?.severity) {
    case 'error':
      return {
        border: 'border-rose-200',
        bg: 'bg-rose-50/80',
        icon: 'text-rose-600',
        title: 'text-rose-900',
        body: 'text-rose-800/90',
        meta: 'text-rose-700/80',
        divider: 'border-rose-100',
      }
    case 'warning':
      return {
        border: 'border-amber-200',
        bg: 'bg-amber-50/80',
        icon: 'text-amber-600',
        title: 'text-amber-900',
        body: 'text-amber-800/90',
        meta: 'text-amber-700/80',
        divider: 'border-amber-100',
      }
    default:
      return {
        border: 'border-surface-200',
        bg: 'bg-surface-50',
        icon: 'text-surface-500',
        title: 'text-surface-800',
        body: 'text-surface-600',
        meta: 'text-surface-500',
        divider: 'border-surface-100',
      }
  }
})

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const runtimeLogLines = computed(() => props.runtimeLogs ?? [])

const statLine = computed(() => {
  const stats = props.insights?.stats
  if (!stats) return ''
  const parts: string[] = []
  if (stats.loopRestarts) parts.push(`${stats.loopRestarts} loop${stats.loopRestarts === 1 ? '' : 's'}`)
  if (stats.timeouts) parts.push(`${stats.timeouts} timeout${stats.timeouts === 1 ? '' : 's'}`)
  const failures = stats.errors + stats.crashes
  if (failures) parts.push(`${failures} failed run${failures === 1 ? '' : 's'}`)
  if (stats.doneCount && stats.stillInProgress) {
    parts.push(`${stats.doneCount} finished without status change`)
  }
  return parts.join(' · ')
})

const hasExpandableDetails = computed(() => {
  return (props.insights?.diagnostics.length ?? 0) > 0 || runtimeLogLines.value.length > 0
})

async function copyDiagnostics() {
  if (!props.insights) return
  const text = formatAgentRunInsightsForCopy(props.insights, {
    taskTitle: props.taskTitle,
    runtimeLogs: runtimeLogLines.value,
  })
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Fallback for older browsers or denied permission
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      copied.value = true
      if (copiedTimer) clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => {
        copied.value = false
      }, 2000)
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <section
    v-if="insights"
    class="rounded-lg border p-3.5"
    :class="[severityStyles.border, severityStyles.bg]"
    aria-live="polite"
  >
    <div class="flex items-start gap-2.5">
      <svg
        v-if="insights.severity === 'error'"
        class="mt-0.5 h-4 w-4 flex-shrink-0"
        :class="severityStyles.icon"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.24 0 2.02-1.27 1.39-2.28L13.39 5.3a1.5 1.5 0 00-2.78 0L3.68 16.72c-.63 1.01.15 2.28 1.39 2.28z" />
      </svg>
      <svg
        v-else
        class="mt-0.5 h-4 w-4 flex-shrink-0"
        :class="severityStyles.icon"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold leading-snug" :class="severityStyles.title">
              {{ insights.headline }}
            </p>
            <p class="mt-1 max-w-prose text-xs leading-relaxed" :class="severityStyles.body">
              {{ insights.summary }}
            </p>
            <p v-if="statLine" class="mt-2 text-xs font-medium tabular-nums" :class="severityStyles.meta">
              {{ statLine }}
            </p>
          </div>
          <button
            type="button"
            class="flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-surface-200 bg-white/80 px-2 py-1 text-xs font-medium text-surface-600 transition-colors hover:border-surface-300 hover:text-surface-800"
            :class="copied ? 'border-emerald-200 text-emerald-700' : ''"
            :aria-label="copied ? 'Copied diagnostics' : 'Copy diagnostics for agent'"
            @click="copyDiagnostics"
          >
            <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" class="h-3 w-3" />
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>

        <ul v-if="insights.suggestions.length" class="space-y-1.5">
          <li
            v-for="(tip, i) in insights.suggestions"
            :key="i"
            class="flex gap-2 text-[11px] leading-relaxed"
            :class="severityStyles.body"
          >
            <span class="font-semibold" :class="severityStyles.icon">{{ i + 1 }}.</span>
            <span>{{ tip }}</span>
          </li>
        </ul>

        <div v-if="hasExpandableDetails" class="pt-0.5">
          <button
            type="button"
            class="text-[11px] font-medium text-surface-500 transition-colors hover:text-surface-700"
            @click="showDetails = !showDetails"
          >
            {{ showDetails ? 'Hide' : 'Show' }} details
          </button>

          <div v-if="showDetails" class="mt-2.5 space-y-3 border-t pt-2.5" :class="severityStyles.divider">
            <div v-if="insights.diagnostics.length" class="space-y-2">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-surface-500">
                Recent events
              </p>
              <ul class="space-y-2">
                <li
                  v-for="item in insights.diagnostics"
                  :key="item.id"
                  class="flex items-start justify-between gap-3"
                >
                  <div class="min-w-0">
                    <p class="text-[11px] font-medium text-surface-800">{{ item.title }}</p>
                    <p class="mt-0.5 text-[10px] leading-relaxed text-surface-600">{{ item.message }}</p>
                  </div>
                  <span class="flex-shrink-0 text-[10px] tabular-nums text-surface-400">{{ formatTime(item.timestamp) }}</span>
                </li>
              </ul>
            </div>

            <div v-if="runtimeLogLines.length">
              <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-surface-500">
                Runtime log ({{ runtimeLogLines.length }} lines)
              </p>
              <div class="max-h-44 overflow-y-auto rounded-md border border-surface-200/80 bg-white/70 px-2.5 py-2 text-[10px] leading-relaxed text-surface-700">
                <div
                  v-for="line in runtimeLogLines"
                  :key="line.id"
                  class="flex gap-2 border-b border-surface-100 py-1 last:border-0"
                >
                  <span class="flex-shrink-0 tabular-nums text-surface-400">{{ line.displayTime }}</span>
                  <span class="min-w-0 break-all font-mono">{{ line.message }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
