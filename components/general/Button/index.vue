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

const emit = defineEmits<{
  (e: 'on-click'): void
}>()

const buttonClass = computed((): string => {
  const baseClass = 'py-2.5 px-3.5 text-sm text-white stroke-white font-semibold rounded-lg flex items-center justify-center transition select-none'

  const color = (props.disabled || props.loading)
    ? `${bgColorDisabled.value} cursor-not-allowed`
    : `${bgColor.value} ${bgButtonHover.value}`

  return `${baseClass} ${color}`
})

const variant = {
  default: 'bg-gray-500',
  primary: 'bg-primary-500 ',
  success: 'bg-success-500 ',
  info: 'bg-info-500 ',
  warning: 'bg-warning-500 ',
  error: 'bg-error-500 ',
}

const variantDisabled = {
  default: 'bg-gray-400',
  primary: 'bg-primary-400',
  success: 'bg-success-400 ',
  info: 'bg-info-400 ',
  warning: 'bg-warning-400 ',
  error: 'bg-error-400 ',
}

const variantHover = {
  default: 'hover:bg-gray-400',
  primary: 'hover:bg-primary-400 ',
  success: 'hover:bg-success-400 ',
  info: 'hover:bg-info-400',
  warning: 'hover:bg-warning-400 ',
  error: 'hover:bg-error-400 ',
}

const bgColor = computed(() => {
  return variant[props.color]
})

const bgColorDisabled = computed(() => {
  return variantDisabled[props.color]
})

const bgButtonHover = computed(() => {
  return variantHover[props.color]
})
</script>

<template>
  <button :id="props.id" :type="type" :disabled="props.disabled" :class="buttonClass" @click="emit('on-click')">
    <span class="flex items-center gap-2">
      <Loading v-if="props.loading" :color="props.color" size="20"/>

      <slot v-else name="prefix" />

      <span v-if="props.label">{{ props.label }}</span>
      <slot v-else />

      <slot name="suffix" />
    </span>
  </button>
</template>

<style scoped></style>
