<template>
  <aside class="w-56 bg-surface-50 border-r border-surface-200 flex flex-col overflow-y-auto flex-shrink-0 min-h-0">
    <div class="px-3 pt-4 pb-3 border-b border-surface-100">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold text-surface-700">Filters</span>
        <button
          class="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
          @click="clearFilters"
        >
          Clear
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400" />
        <input
          v-model="search"
          type="text"
          placeholder="Search PRs..."
          class="w-full text-xs rounded-md border border-surface-200 bg-white pl-7 pr-2 py-1.5 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-surface-400 text-surface-700"
        />
      </div>
    </div>

    <div class="px-3 py-4 space-y-5 flex-1">
      <!-- Status -->
      <div>
        <p class="text-xs font-semibold text-surface-600 mb-2">Status</p>
        <div class="flex flex-col gap-1">
          <button
            v-for="s in statusOptions"
            :key="s.value"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left w-full transition-colors"
            :class="status === s.value
              ? 'bg-accent text-white'
              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'"
            @click="status = s.value"
          >
            <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="s.dot" />
            {{ s.label }}
          </button>
        </div>
      </div>

      <!-- Review State -->
      <div>
        <p class="text-xs font-semibold text-surface-600 mb-2">Review state</p>
        <div class="flex flex-col gap-1">
          <button
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left w-full transition-colors"
            :class="!reviewState
              ? 'bg-surface-200 text-surface-900'
              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'"
            @click="reviewState = undefined"
          >
            Any state
          </button>
          <button
            v-for="s in reviewStateOptions"
            :key="s.value"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left w-full transition-colors"
            :class="reviewState === s.value
              ? 'bg-surface-200 text-surface-900'
              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'"
            @click="reviewState = s.value"
          >
            <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="s.dot" />
            {{ s.label }}
          </button>
        </div>
      </div>

      <!-- Repository -->
      <div v-if="repositories?.length > 0">
        <p class="text-xs font-semibold text-surface-600 mb-2">Repository</p>
        <div class="flex flex-col gap-1">
          <button
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left w-full transition-colors"
            :class="!repositoryId
              ? 'bg-surface-200 text-surface-900'
              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'"
            @click="repositoryId = undefined"
          >
            All repos
          </button>
          <button
            v-for="r in repositories"
            :key="r.id"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left w-full transition-colors truncate"
            :class="repositoryId === r.id
              ? 'bg-surface-200 text-surface-900'
              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'"
            @click="repositoryId = r.id"
          >
            <Icon name="lucide:git-branch" class="w-3 h-3 flex-shrink-0 text-surface-400" />
            <span class="truncate">{{ r.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="px-3 pb-4">
      <button
        class="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-surface-200 text-surface-600 hover:bg-surface-50 hover:border-surface-300 transition-colors flex items-center justify-center gap-1.5"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <Icon name="lucide:refresh-cw" class="w-3 h-3" :class="loading ? 'animate-spin' : ''" />
        Refresh
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
  { value: 'open', label: 'Open', dot: 'bg-green-400' },
  { value: 'closed', label: 'Closed', dot: 'bg-red-400' },
  { value: 'merged', label: 'Merged', dot: 'bg-purple-400' },
]

const reviewStateOptions = [
  { value: 'pending', label: 'Pending', dot: 'bg-amber-400' },
  { value: 'approved', label: 'Approved', dot: 'bg-green-400' },
  { value: 'changes_requested', label: 'Changes requested', dot: 'bg-red-400' },
  { value: 'commented', label: 'Commented', dot: 'bg-blue-400' },
]

function clearFilters() {
  status.value = 'open'
  reviewState.value = undefined
  repositoryId.value = undefined
  search.value = ''
}
</script>
