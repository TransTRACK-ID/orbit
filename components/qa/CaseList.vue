<script setup lang="ts">
import type { QaCase } from '~/types'

defineProps<{
  cases: QaCase[]
  selectedId: string | null
  creating?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  create: []
}>()

function priorityClass(p: string) {
  if (p === 'high') return 'bg-red-100 text-red-700'
  if (p === 'low') return 'bg-surface-100 text-surface-600'
  return 'bg-amber-100 text-amber-700'
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex items-center justify-between px-1 mb-2">
      <span class="text-xs font-medium text-surface-600">Cases ({{ cases.length }})</span>
      <button
        type="button"
        class="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 disabled:opacity-50"
        :disabled="creating"
        @click="emit('create')"
      >
        <Icon v-if="creating" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
        <Icon v-else name="lucide:plus" class="w-3 h-3" />
        {{ creating ? 'Creating…' : 'New' }}
      </button>
    </div>

    <div v-if="cases.length === 0" class="text-xs text-surface-400 py-8 text-center">
      No cases yet
    </div>
    <div v-else class="flex-1 overflow-y-auto space-y-1">
      <button
        v-for="c in cases"
        :key="c.id"
        type="button"
        class="w-full text-left p-2.5 rounded-xl border transition-colors"
        :class="selectedId === c.id
          ? 'border-primary-300 bg-primary-50'
          : 'border-surface-200 bg-white hover:border-surface-300'"
        @click="emit('select', c.id)"
      >
        <div class="flex items-start gap-2">
          <span class="text-xs font-semibold text-surface-900 truncate flex-1">{{ c.title }}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="priorityClass(c.priority)">
            {{ c.priority }}
          </span>
        </div>
        <div class="mt-1 flex items-center gap-2 text-[10px] text-surface-500">
          <span>{{ c.steps?.length || 0 }} steps</span>
          <span>·</span>
          <span>{{ c.status }}</span>
        </div>
      </button>
    </div>
  </div>
</template>
