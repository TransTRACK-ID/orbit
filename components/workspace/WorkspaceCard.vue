<template>
  <div class="bg-white rounded-xl border border-surface-200 p-5 cursor-pointer card-hover">
    <div class="flex items-center gap-3 mb-3">
      <div
        class="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0"
      >
        {{ initials }}
      </div>
      <div class="min-w-0">
        <h3 class="font-semibold text-surface-900 truncate">{{ workspace.name }}</h3>
        <p class="text-xs text-surface-500">#{{ workspace.slug }}</p>
      </div>
    </div>

    <p v-if="workspace.description" class="text-sm text-surface-500 line-clamp-2 mb-3">
      {{ workspace.description }}
    </p>

    <div class="flex items-center gap-4 text-xs text-surface-400">
      <span class="flex items-center gap-1">
        <Folder class="w-3.5 h-3.5" />
        {{ workspace._count?.projects || 0 }} projects
      </span>
      <span class="flex items-center gap-1">
        <User class="w-3.5 h-3.5" />
        {{ workspace._count?.members || 0 }} members
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Workspace } from '~/types'

const props = defineProps<{
  workspace: Workspace
}>()

const initials = computed(() =>
  props.workspace.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
)
</script>
