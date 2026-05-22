<script setup lang="ts">
const props = defineProps({
  size: {
    type: String,
    default: "24",
  }
});
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" :width="props.size" :height="props.size" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="3" width="8" height="8" rx="1" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 6H12C12.5523 6 13 6.44772 13 7V13C13 13.5523 12.5523 14 12 14H6C5.44772 14 5 13.5523 5 13V7C5 6.44772 5.44772 6 6 6Z" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</template>

<style scoped></style>
