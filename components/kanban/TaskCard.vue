<template>
  <div
    class="kanban-card group"
    :data-task-id="task.id"
    @click="$emit('click')"
  >
    <!-- Labels row -->
    <div v-if="task.labels && task.labels.length > 0" class="flex flex-wrap gap-1 mb-2">
      <span
        v-for="label in task.labels"
        :key="label.id"
        class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight"
        :style="{ backgroundColor: label.color + '20', color: label.color }"
      >
        {{ label.name }}
      </span>
    </div>

    <!-- Title -->
    <p class="text-sm font-medium text-surface-900 leading-snug mb-2 line-clamp-2">
      {{ task.title }}
    </p>

    <!-- Footer -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <!-- Priority -->
        <KanbanPriorityBadge :priority="task.priority" />

        <!-- Subtask count -->
        <span
          v-if="task.subtasks?.length"
          class="text-[11px] text-surface-400 flex items-center gap-0.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" class="w-3 h-3"><path fill="currentColor" d="M224 128v80a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h80a8 8 0 0 1 0 16H48v160h160v-80a8 8 0 0 1 16 0Zm-20.69-60.69a8 8 0 0 0-11.32-11.32L128 119.72l-20.69-20.69a8 8 0 0 0-11.32 11.32l26.83 26.83a8 8 0 0 0 11.32 0l49.17-49.17Z"/></svg>
          {{ task.subtasks.filter((s: any) => s.statusId !== task.statusId).length }}/{{ task.subtasks.length }}
        </span>

        <!-- Comment count -->
        <span
          v-if="task._count?.comments"
          class="text-[11px] text-surface-400 flex items-center gap-0.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" class="w-3 h-3"><path fill="currentColor" d="M216 48H40a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h48v40a8 8 0 0 0 13.66 5.66L129.66 192H216a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16Zm0 128H128a8 8 0 0 0-5.66 2.34L88 212.69V176a8 8 0 0 0-8-8H40V64h176ZM80 108a12 12 0 1 1-12-12a12 12 0 0 1 12 12Zm48 0a12 12 0 1 1-12-12a12 12 0 0 1 12 12Zm48 0a12 12 0 1 1-12-12a12 12 0 0 1 12 12Z"/></svg>
          {{ task._count.comments }}
        </span>
      </div>

      <!-- Assignee -->
      <Avatar
        v-if="task.assignee"
        :name="task.assignee.name"
        size="xs"
        class="flex-shrink-0"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '~/types'

defineProps<{
  task: Task
}>()

defineEmits<{
  click: []
}>()
</script>
