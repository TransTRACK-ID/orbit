<template>
  <span
    v-if="priority !== 'none'"
    class="inline-flex items-center gap-0.5 text-[11px] font-medium px-1 py-0.5 rounded"
    :class="priorityClasses"
  >
    <Icon :name="priorityIcon" class="w-3 h-3" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import type { TaskPriority } from '~/types'

const props = defineProps<{
  priority: TaskPriority
}>()

const priorityMap: Record<TaskPriority, { label: string; icon: string; classes: string }> = {
  urgent: { label: 'Urgent', icon: 'ph:warning-circle-fill', classes: 'bg-error-100 text-error-700' },
  high: { label: 'High', icon: 'ph:arrow-up-fill', classes: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Medium', icon: 'ph:minus-fill', classes: 'bg-warning-100 text-warning-700' },
  low: { label: 'Low', icon: 'ph:arrow-down-fill', classes: 'bg-info-100 text-info-700' },
  none: { label: '', icon: '', classes: '' },
}

const priorityInfo = computed(() => priorityMap[props.priority])
const label = computed(() => priorityInfo.value.label)
const priorityIcon = computed(() => priorityInfo.value.icon)
const priorityClasses = computed(() => priorityInfo.value.classes)
</script>
