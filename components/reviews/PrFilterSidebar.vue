<template>
  <aside class="w-64 bg-white border-r border-surface-200 flex flex-col overflow-y-auto flex-shrink-0 min-h-0">
    <div class="p-4 border-b border-surface-100">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-surface-900">Filters</h2>
        <button
          class="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
          @click="clearFilters"
        >
          Clear
        </button>
      </div>

      <!-- Search -->
      <div class="mb-3">
        <label class="block text-xs font-medium text-surface-600 mb-1.5">Search</label>
        <div class="relative">
          <Icon name="lucide:search" class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
          <input
            v-model="search"
            type="text"
            placeholder="PR or task title..."
            class="w-full text-xs rounded-lg border border-surface-200 bg-surface-50 pl-7 pr-2 py-1.5 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          />
        </div>
      </div>

      <!-- Status -->
      <div class="mb-3">
        <label class="block text-xs font-medium text-surface-600 mb-1.5">Status</label>
        <div class="space-y-1">
          <label v-for="s in statusOptions" :key="s.value" class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="status"
              type="radio"
              :value="s.value"
              class="w-3 h-3"
            />
            <span class="text-xs text-surface-700">{{ s.label }}</span>
          </label>
        </div>
      </div>

      <!-- Review State -->
      <div class="mb-3">
        <label class="block text-xs font-medium text-surface-600 mb-1.5">Review State</label>
        <div class="space-y-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="reviewState"
              type="radio"
              value=""
              class="w-3 h-3"
            />
            <span class="text-xs text-surface-700">Any</span>
          </label>
          <label v-for="s in reviewStateOptions" :key="s.value" class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="reviewState"
              type="radio"
              :value="s.value"
              class="w-3 h-3"
            />
            <span class="text-xs text-surface-700">{{ s.label }}</span>
          </label>
        </div>
      </div>

      <!-- Repository -->
      <div v-if="repositories?.length > 0" class="mb-3">
        <label class="block text-xs font-medium text-surface-600 mb-1.5">Repository</label>
        <div class="space-y-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="repositoryId"
              type="radio"
              value=""
              class="w-3 h-3"
            />
            <span class="text-xs text-surface-700">All</span>
          </label>
          <label v-for="r in repositories" :key="r.id" class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="repositoryId"
              type="radio"
              :value="r.id"
              class="w-3 h-3"
            />
            <span class="text-xs text-surface-700 truncate">{{ r.name }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="p-4">
      <button
        class="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors flex items-center justify-center gap-1.5"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <Icon name="lucide:refresh-cw" class="w-3.5 h-3.5" />
        Refresh List
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Repository } from '~/types'

const props = withDefaults(defineProps<{
  repositories?: Repository[]
  loading?: boolean
}>(), {
  repositories: () => [],
})

defineEmits<{
  refresh: []
}>()

const status = defineModel<string>('status')
const reviewState = defineModel<string | undefined>('reviewState')
const repositoryId = defineModel<string | undefined>('repositoryId')
const search = defineModel<string>('search')

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'merged', label: 'Merged' },
]

const reviewStateOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'commented', label: 'Commented' },
]

function clearFilters() {
  status.value = 'open'
  reviewState.value = undefined
  repositoryId.value = undefined
  search.value = ''
}
</script>

<style scoped>
input[type="radio"] {
  accent-color: #CF513D;
}
</style>
