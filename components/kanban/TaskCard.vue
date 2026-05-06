<template>
  <div
    class="kanban-card"
    :class="{ agentic: isAgentInProgress }"
    :data-id="task.id"
    @click="$emit('click')"
  >
    <!-- Priority badge -->
    <span
      class="inline-flex items-center gap-1 text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full mb-1.5"
      :class="priorityStyle(task.priority)"
    >
      {{ task.priority }}
    </span>

    <!-- Title -->
    <div class="text-xs font-semibold leading-snug mb-0.5 text-surface-900 line-clamp-2">
      {{ task.title }}
    </div>

    <!-- Description -->
    <div v-if="task.description" class="text-[10px] text-surface-400 leading-snug mb-2 line-clamp-2">
      {{ task.description }}
    </div>

    <!-- Labels -->
    <div v-if="task.labels && task.labels.length > 0" class="flex gap-1 flex-wrap mb-1.5">
      <span
        v-for="label in task.labels"
        :key="label.id"
        class="px-1.5 py-0.5 rounded text-[8px] font-semibold"
        :style="{ backgroundColor: label.color + '20', color: label.color }"
      >
        {{ label.name }}
      </span>
    </div>

    <!-- Agentic In Progress badge -->
    <div v-if="isAgentInProgress" class="flex items-center gap-1.5 mb-1.5">
      <span class="agentic-badge">
        <span class="agentic-dot" />
        <span>Agentic · {{ task.assignee?.name }}</span>
      </span>
    </div>

    <!-- Footer -->
    <div class="flex items-center gap-2 text-[9px] text-surface-400">
      <!-- Type -->
      <span class="card-type px-1.5 py-0.5 text-[8px]" :class="typeStyle(task)">
        {{ typeLabel(task) }}
      </span>

      <!-- Comments -->
      <span v-if="task._count?.comments" class="flex items-center gap-0.5">
        <Icon name="lucide:message-square" class="w-2.5 h-2.5" />
        {{ task._count.comments }}
      </span>

      <!-- Assignee -->
      <span
        v-if="task.assignee"
        class="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
        :style="{ background: task.assignee.color || '#6366F1' }"
        :title="task.assignee.name"
      >
        {{ task.assignee.initials || computedInitials(task.assignee.name) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '~/types'

const props = defineProps<{
  task: Task
}>()

defineEmits<{
  click: []
}>()

const isAgentInProgress = computed(() => {
  return (
    props.task.assigneeType === 'agent' &&
    props.task.assignee &&
    props.task.status?.name &&
    /progress/i.test(props.task.status.name)
  )
})

function computedInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
}

function priorityStyle(priority: string) {
  return {
    'bg-red-100 text-red-600': priority === 'critical',
    'bg-amber-100 text-amber-600': priority === 'high',
    'bg-blue-100 text-blue-600': priority === 'medium',
    'bg-gray-100 text-gray-500': priority === 'low',
    'bg-gray-50 text-gray-400': priority === 'none',
  }
}

function typeStyle(task: Task) {
  const typeMap: Record<string, string> = {
    feature: 'card-type feature',
    fix: 'card-type fix',
    review: 'card-type review',
  }
  return typeMap[task.priority] || typeMap[task._count?.comments ? 'review' : 'feature'] || 'card-type feature'
}

function typeLabel(task: Task) {
  if (task.priority === 'urgent' || task.priority === 'high') return 'Fix'
  if (task.priority === 'medium') return 'Review'
  return 'Feature'
}


</script>
