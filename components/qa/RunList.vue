<script setup lang="ts">
import type { QaRun } from '~/types'

defineProps<{
  runs: QaRun[]
  selectedId: string | null
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

function statusClass(status: string) {
  if (status === 'passed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'failed') return 'bg-red-100 text-red-700'
  if (status === 'running') return 'bg-blue-100 text-blue-700'
  if (status === 'blocked') return 'bg-amber-100 text-amber-700'
  return 'bg-surface-100 text-surface-600'
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="px-1 mb-2">
      <span class="text-xs font-medium text-surface-600">Runs ({{ runs.length }})</span>
    </div>
    <div v-if="loading" class="flex flex-col items-center gap-2 py-8">
      <Icon name="lucide:loader-2" class="w-4 h-4 animate-spin text-surface-400" />
      <span class="text-xs text-surface-400">Loading runs…</span>
    </div>
    <div v-else-if="runs.length === 0" class="text-xs text-surface-400 py-8 text-center">No runs yet</div>
    <div v-else class="flex-1 overflow-y-auto space-y-1">
      <button
        v-for="r in runs"
        :key="r.id"
        type="button"
        class="w-full text-left p-2.5 rounded-xl border"
        :class="selectedId === r.id ? 'border-primary-300 bg-primary-50' : 'border-surface-200 bg-white hover:border-surface-300'"
        @click="emit('select', r.id)"
      >
        <div class="flex items-center gap-2">
          <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="statusClass(r.status)">
            {{ r.status }}
          </span>
          <span class="text-xs text-surface-500 truncate">
            {{ r.plan?.name || 'Ad-hoc' }}
          </span>
        </div>
        <div class="mt-1 text-xs text-surface-500 flex items-center gap-1.5">
          <span>{{ r._passedCount || 0 }}/{{ r._totalCount || 0 }} passed</span>
          <span v-if="r.project"> · {{ r.project.name }}</span>
          <span
            v-if="r.taskId && (r.status === 'failed' || r.status === 'blocked')"
            class="inline-flex items-center gap-0.5 text-amber-600"
            title="Agent execution may need review"
          >
            ·
            <Icon name="lucide:bot" class="w-3 h-3" />
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
