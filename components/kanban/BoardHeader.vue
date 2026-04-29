<template>
  <div class="flex items-center justify-between px-6 py-3 border-b border-surface-200 bg-white">
    <div class="flex items-center gap-4">
      <h2 class="text-lg font-semibold text-surface-900">Board</h2>
      <Tab
        :tabs="tabs"
        :active="'board'"
        size="sm"
      />
    </div>

    <div class="flex items-center gap-2">
      <span class="text-sm text-surface-500">{{ taskCount }} tasks</span>
      <Button size="sm" @click="$emit('createTask')">
        <Plus class="w-3.5 h-3.5" />
        New Task
      </Button>
      <TextButton size="sm" @click="$emit('viewBacklog')">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" class="w-3.5 h-3.5"><path fill="currentColor" d="M80 64a8 8 0 0 1 8-8h128a8 8 0 0 1 0 16H88a8 8 0 0 1-8-8Zm136 56H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16Zm0 64H88a8 8 0 0 0 0 16h128a8 8 0 0 0 0-16ZM52 56a12 12 0 1 1-12-12a12 12 0 0 1 12 12Zm0 64a12 12 0 1 1-12-12a12 12 0 0 1 12 12Zm0 64a12 12 0 1 1-12-12a12 12 0 0 1 12 12Z"/></svg>
        Backlog
      </TextButton>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  statuses: any[]
  taskCount: number
}>()

defineEmits<{
  createTask: []
  viewBacklog: []
}>()

const route = useRoute()
const tabs = [
  { label: 'Board', value: 'board', to: `/workspaces/${route.params.slug}/projects/${route.params.projectId}/board` },
  { label: 'Backlog', value: 'backlog', to: `/workspaces/${route.params.slug}/projects/${route.params.projectId}/backlog` },
]
</script>
