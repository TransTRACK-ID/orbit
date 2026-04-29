<script setup lang="ts">
import User from '~/components/icons/User/index.vue';
const props = defineProps({
  src: {
    type: [null, String],
    default: null
  }
})
</script>

<template>
  <div class="aspect-square h-10 min-w-10 overflow-hidden rounded-full bg-gray-300"
    :class="src ? 'border border-gray-300' : ''">
    <div v-if="props.src" class="size-full bg-cover bg-center" :style="`background-image: url(${props.src})`" />

    <div v-else class="flex size-full items-center justify-center">
      <slot name="placeholder" />
      <User v-if="!$slots.placeholder" class="stroke-white" />
    </div>
  </div>
</template>

<style scoped></style>