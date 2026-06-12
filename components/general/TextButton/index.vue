<script setup lang="ts">
import { computed } from "vue";
import Loading from "~/components/icons/Loading/index.vue";

const props = defineProps({
  id: {
    type: String,
    default: "",
  },
  type: {
    type: String as () => "button" | "submit" | "reset" | undefined,
    default: "button",
  },
  label: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String as () =>  'primary' | 'success' | 'info' | 'warning' |'error' | 'default',
    default: 'default'
  }
});

const emit = defineEmits(["on-click"]);


const variant: Record<string, Record<string, string>> = {
  default: {
    default: 'text-gray-500 stroke-gray-500 hover:text-gray-700 hover:bg-gray-100',
    primary: 'text-primary-500 stroke-primary-500 hover:text-primary-700 hover:bg-primary-100',
    success: 'text-success-500 stroke-success-500 hover:text-success-700 hover:bg-success-100',
    info: 'text-info-500 stroke-info-500 hover:text-info-700 hover:bg-info-100',
    warning: 'text-warning-500 stroke-warning-500 hover:text-warning-700 hover:bg-warning-100',
    error: 'text-error-500 stroke-error-500 hover:text-error-700 hover:bg-error-100',
  },
  disabled: {
    default: 'text-gray-400',
    primary: 'text-gray-400',
    success: 'text-gray-400',
    info: 'text-gray-400',
    warning: 'text-gray-400',
    error: 'text-gray-400',
  }
}

const buttonClass = computed((): string => {
  const baseClass = 'py-2.5 px-3.5 text-sm font-semibold bg-none rounded-lg flex items-center justify-center transition'

  const color = (props.disabled || props.loading)
    ? `${variant['disabled'][props.color]} cursor-not-allowed`
    : `${variant['default'][props.color]}`

  return `${baseClass} ${color}`;
});

</script>

<template>
  <button
    :id="props.id"
    :type="type"
    :disabled="props.disabled || props.loading"
    :class="buttonClass"
    @click="emit('on-click')"
  >

  <span class="flex items-center gap-2">
      <Loading v-if="props.loading" size="20"/>
      <slot v-else name="prefix" />

      <span>{{ props.label }}</span>

      <slot name="suffix" />
    </span>
  </button>
</template>

<style scoped></style>
