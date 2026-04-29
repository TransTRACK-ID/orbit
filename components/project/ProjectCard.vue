<template>
  <div class="bg-white rounded-xl border border-surface-200 p-5 cursor-pointer card-hover">
    <div class="flex items-center gap-3 mb-3">
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        :style="{ backgroundColor: project.color }"
      >
        {{ initials }}
      </div>
      <div class="min-w-0">
        <h3 class="font-semibold text-surface-900 truncate">{{ project.name }}</h3>
        <p v-if="project.description" class="text-xs text-surface-500 truncate mt-0.5">
          {{ project.description }}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-3 text-xs text-surface-400">
      <span class="flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" class="w-3.5 h-3.5"><path fill="currentColor" d="M88 48H40a8 8 0 0 0-8 8v48a8 8 0 0 0 8 8h48a8 8 0 0 0 8-8V56a8 8 0 0 0-8-8Zm-8 48H48V64h32Zm128-48h-80a8 8 0 0 0 0 16h80a8 8 0 0 0 0-16Zm0 48h-80a8 8 0 0 0 0 16h80a8 8 0 0 0 0-16ZM40 144h48a8 8 0 0 1 8 8v48a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8v-48a8 8 0 0 1 8-8Zm8 48h32v-32H48Zm160-48h-80a8 8 0 0 0 0 16h80a8 8 0 0 0 0-16Zm0 48h-80a8 8 0 0 0 0 16h80a8 8 0 0 0 0-16Z"/></svg>
        {{ project._count?.tasks || 0 }} tasks
      </span>
      <span class="flex items-center gap-1">
        <User class="w-3.5 h-3.5" />
        {{ project._count?.members || 0 }} members
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Project } from '~/types'

const props = defineProps<{
  project: Project
}>()

const initials = computed(() =>
  props.project.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
)
</script>
