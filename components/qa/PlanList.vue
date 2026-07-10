<script setup lang="ts">
import type { QaPlan } from '~/types'

defineProps<{
  plans: QaPlan[]
  selectedId: string | null
  creating?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  create: []
}>()
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex items-center justify-between px-1 mb-2">
      <span class="text-xs font-medium text-surface-600">Plans</span>
      <button
        type="button"
        class="text-xs font-semibold text-primary-600 flex items-center gap-1 disabled:opacity-50"
        :disabled="creating"
        @click="emit('create')"
      >
        <Icon v-if="creating" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
        <Icon v-else name="lucide:plus" class="w-3 h-3" />
        {{ creating ? 'Creating…' : 'New' }}
      </button>
    </div>
    <div v-if="plans.length === 0" class="text-xs text-surface-400 py-8 text-center">No plans yet</div>
    <div class="flex-1 overflow-y-auto space-y-1">
      <button
        v-for="p in plans"
        :key="p.id"
        type="button"
        class="w-full text-left p-2.5 rounded-xl border"
        :class="selectedId === p.id ? 'border-primary-300 bg-primary-50' : 'border-surface-200 bg-white hover:border-surface-300'"
        @click="emit('select', p.id)"
      >
        <div class="text-xs font-semibold text-surface-900 truncate">{{ p.name }}</div>
        <div class="text-[10px] text-surface-500 mt-0.5">{{ p._caseCount || p.cases?.length || 0 }} cases</div>
      </button>
    </div>
  </div>
</template>
