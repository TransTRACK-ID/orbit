<script setup lang="ts">
import type { PropType } from 'vue'

const model = defineModel({
  type: Boolean,
  default: false
})

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    default: ''
  },
  color: {
    type: String as PropType<'default' | 'primary' | 'success' | 'info' | 'warning' | 'error'>,
    default: 'default'
  }
})

const variant = {
  default: 'text-gray-500',
  primary: 'text-primary-500',
  success: 'text-success-500',
  info: 'text-info-500',
  warning: 'text-warning-500',
  error: 'text-error-500',
}

const inputClass = computed(() => {
  const baseClass = 'rounded border-gray-300 focus:ring-0'

  const color = props.disabled
    ? 'bg-gray-100'
    : variant[props.color] || variant.default

  const cursor = props.disabled
    ? 'cursor-not-allowed'
    : props.readonly ? '' : 'cursor-pointer'

  return `${baseClass} ${cursor} ${color}`
})

const labelClass = computed(() => {
  const baseClass = 'ml-2 text-xs font-semibold truncate select-none'
  const cursor = props.disabled
    ? 'cursor-not-allowed'
    : props.readonly ? '' : 'cursor-pointer'
  return `${baseClass} ${variant[props.color] || variant.default} ${cursor}`
})
</script>

<template>
  <div class="flex items-center">
    <input :checked="model" :id="props.id" :name="props.name" type="checkbox" :class="inputClass"
      :disabled="props.disabled || props.readonly" :readonly="props.readonly"
      @change="model = ($event.target as HTMLInputElement).checked">

    <label :for="props.id" :class="labelClass">{{ props.label }}</label>
  </div>
</template>

<style scoped></style>