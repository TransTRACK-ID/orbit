<script setup lang="ts">
import type { QaRun } from '~/types'

defineProps<{
  runs: QaRun[]
  selectedId: string | null
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
    <div v-if="runs.length === 0" class="text-xs text-surface-400 py-8 text-center">No runs yet</div>
    <div class="flex-1 overflow-y-auto space-y-1">
      <button
        v-for="r in runs"
        :key="r.id"
        type="button"
        class="w-full text-left p-2.5 rounded-xl border"
        :class="selectedId === r.id ? 'border-primary-300 bg-primary-50' : 'border-surface-200 bg-white hover:border-surface-300'"
        @click="emit('select', r.id)"
      >
        <div class="flex items-center gap-2">
          <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="statusClass(r.status)">
            {{ r.status }}
          </span>
          <span class="text-[10px] text-surface-500 truncate">
            {{ r.plan?.name || 'Ad-hoc' }}
          </span>
        </div>
        <div class="mt-1 text-[10px] text-surface-500">
          {{ r._passedCount || 0 }}/{{ r._totalCount || 0 }} passed
          <span v-if="r.project"> · {{ r.project.name }}</span>
        </div>
      </button>
    </div>
  </div>
</template>
