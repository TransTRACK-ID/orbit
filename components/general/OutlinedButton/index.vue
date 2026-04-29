<script setup lang="ts">
import { computed } from "vue";
import Loading from "~/components/icons/Loading/index.vue";

const props = defineProps({
  id: {
    type: String,
    default: ''
  },
  type: {
    type: String as () => 'button' | 'submit' | 'reset',
    default: 'button',
  },
  label: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  color: {
    type: String as () => 'primary' | 'success' | 'info' | 'warning' | 'error' | 'default',
    default: 'primary'
  }
})

const variant = {
  default: 'border-gray-500 text-gray-500 [&_svg]:stroke-gray-500 hover:bg-gray-100',
  primary: 'border-primary-500 text-primary-500 [&_svg]:stroke-primary-500 hover:bg-primary-100',
  success: 'border-success-500 text-success-500 [&_svg]:stroke-success-500 hover:bg-success-100',
  info: 'border-info-500 text-info-500 [&_svg]:stroke-info-500 hover:bg-info-100',
  warning: 'border-warning-500 text-warning-500 [&_svg]:stroke-warning-500 hover:bg-warning-100',
  error: 'border-error-500 text-error-500 [&_svg]:stroke-error-500 hover:bg-error-100',
}

const colorClass = computed(() => {
  return variant[props.color]
})

const emit = defineEmits(['on-click'])

const buttonClass = computed((): string => {
  const baseClass = 'py-2.5 px-3.5 text-sm font-semibold border rounded-lg flex items-center justify-center transition'
  const disabled = 'disabled:border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-600 [&_svg]:disabled:stroke-gray-600'

  return `${baseClass} ${colorClass.value} ${disabled}`
})
</script>

<template>
  <button :id="props.id" :type="type" :disabled="props.disabled || props.loading" :class="buttonClass"
    @click="emit('on-click')">
    <span class="space-x-2 flex items-center">
      <Loading v-if="props.loading" size="20" color="default" />
      <slot v-else name="prefix" />

      <span v-if="props.label">{{ props.label }}</span>
      <slot v-else />

      <slot name="suffix" />
    </span>
  </button>
</template>

<style scoped></style>
