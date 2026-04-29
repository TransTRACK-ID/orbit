<script setup lang="ts">
import type { PropType } from 'vue'

const model = defineModel({
  type: [null, String],
  default: null
})

const props = defineProps({
  items: {
    type: Array as PropType<{ text: string, value: string }[]>,
    default: () => []
  },
  color: {
    type: String as PropType<'primary' | 'success' | 'info' | 'warning' | 'error'>,
    default: 'primary'
  }
})

const variant = {
  primary: 'text-primary-500 bg-primary-50',
  success: 'text-success-500 bg-success-50',
  info: 'text-info-500 bg-info-50',
  warning: 'text-warning-500 bg-warning-50',
  error: 'text-error-500 bg-error-50',
}

const bgColor = computed(() => {
  return variant[props.color]
})

const buttonClasses = (value: string) => {
  const baseClass = 'py-2.5 px-4 transition'
  const color = model.value === value ? bgColor.value : 'hover:bg-gray-100'
  return `${baseClass} ${color}`
}
</script>

<template>
  <div class="grid border divide-x rounded-lg overflow-hidden"
    :style="{ gridTemplateColumns: `repeat(${props.items.length}, 1fr)` }">
    <button v-for="item in props.items" :class="buttonClasses(item.value)" @click="model = item.value">
      {{ item.text }}
    </button>
  </div>
</template>

<style scoped></style>