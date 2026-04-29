<script setup lang="ts">
const props = defineProps({
  size: {
    type: String,
    default: "24",
  },
  class: {
    type: String,
    default: "stroke-gray-900",
  },
});
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="props.size"
    :height="props.size"
    :class="props.class"
    viewBox="0 0 24 24"
    fill="none"
    class="animate-spin"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke-width="3"
      stroke="currentColor"
      opacity="0.25"
    />
    <path
      d="M12 2C6.477 2 2 6.477 2 12"
      stroke-width="3"
      stroke-linecap="round"
      stroke="currentColor"
    />
  </svg>
</template>

<style scoped></style>
