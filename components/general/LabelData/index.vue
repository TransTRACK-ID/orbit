<script setup lang="ts">
import { isEmpty } from '~/utils/ui';

const props = defineProps({
  label: {
    type: String,
    default: '',
  },
  data: {
    type: [null, Number, String],
    default: '',
  },
  isTruncate: {
    type: Boolean,
    default: true,
  },
  isClamp: {
    type: Boolean,
    default: false,
  },
  dataClass: {
    type: String,
    default: 'data',
  },
  emptyPlaceholder: {
    type: String,
    default: '-',
  },
})
</script>

<template>
  <div class="space-y-1">
    <p class="text-sm text-gray-500 print:text-[10px]">
      {{ props.label }}
    </p>

    <span class="flex items-center space-x-2">
      <slot name="prefix" />

      <slot name="default" />

      <p
        v-if="!$slots.default"
        class="font-medium text-gray-900 transition duration-75 print:text-xs"
        :class="[props.isTruncate ? (props.isClamp ? 'line-clamp-3' : 'truncate') : '', props.dataClass]"
      >
        {{ isEmpty(props.data) ? props.emptyPlaceholder : props.data }}
      </p>

      <slot name="suffix" />
    </span>
  </div>
</template>

<style scoped></style>
