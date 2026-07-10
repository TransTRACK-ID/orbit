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
    default: 'default'
  }
})

const variant = {
  default: 'border-surface-200 text-surface-600 [&_svg]:stroke-surface-600 hover:bg-surface-50 hover:border-surface-300',
  primary: 'border-accent text-accent [&_svg]:stroke-accent hover:bg-accent-soft',
  success: 'border-success-500 text-success-500 [&_svg]:stroke-success-500 hover:bg-success-50',
  info: 'border-info-500 text-info-500 [&_svg]:stroke-info-500 hover:bg-info-50',
  warning: 'border-warning-500 text-warning-500 [&_svg]:stroke-warning-500 hover:bg-warning-50',
  error: 'border-error-500 text-error-500 [&_svg]:stroke-error-500 hover:bg-error-50',
}

const colorClass = computed(() => {
  return variant[props.color]
})

const emit = defineEmits(['on-click'])

const buttonClass = computed((): string => {
  const baseClass = 'px-3 py-1.5 text-xs font-semibold border rounded-lg flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'
  const disabled = 'disabled:border-surface-200 disabled:bg-surface-100 disabled:cursor-not-allowed disabled:text-surface-400 [&_svg]:disabled:stroke-surface-400'

  return `${baseClass} ${colorClass.value} ${disabled}`
})
</script>

<template>
  <button :id="props.id" :type="type" :disabled="props.disabled || props.loading" :class="buttonClass"
    @click="emit('on-click')">
    <span class="flex items-center gap-1.5">
      <Loading v-if="props.loading" size="20" color="default" />
      <slot v-else name="prefix" />

      <span v-if="props.label">{{ props.label }}</span>
      <slot v-else />

      <slot name="suffix" />
    </span>
  </button>
</template>

<style scoped></style>
