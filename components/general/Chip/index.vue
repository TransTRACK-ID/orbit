<script setup lang="ts">
const props = defineProps({
  label: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: 'primary'
  }
})


const bgColor = computed((): string => {
  return `${`bg-${props.color}-50 text-${props.color}-700`}`
});
</script>


<template>
  <div
    class="flex w-fit cursor-default select-none items-center space-x-1 rounded-full px-2 py-0.5 text-xs transition-all"
    :class="bgColor">
    <slot name="prefix" />
    <p>{{ props.label }}</p>
    <slot name="suffix" />
  </div>

</template>

<style scoped></style>