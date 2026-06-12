<template>
  <span
    v-if="state"
    class="text-xs px-1.5 py-0.5 rounded-full font-medium"
    :class="classes[state] ?? 'bg-surface-100 text-surface-500'"
  >
    {{ labels[state] ?? state }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  state?: string | null
}>()

const labels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  commented: 'Commented',
}

const classes: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  changes_requested: 'bg-red-50 text-red-700',
  commented: 'bg-blue-50 text-blue-700',
}
</script>
