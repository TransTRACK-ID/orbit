<script setup lang="ts">
import Loading from "~/components/icons/Loading/index.vue";

const props = defineProps({
  id: {
    type: String,
    default: "",
  },
  type: {
    type: String as () => 'button' | 'submit',
    default: 'button',
  },
  rounded: {
    type: String as () => "full" | "lg" | "md" | "none",
    default: "lg",
  },
  bordered: {
    type: Boolean,
    default: true,
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
    type: String as () => 'primary' | 'success' | 'info' | 'warning' | 'error' | 'default',
    default: 'default'
  }
});

const emit = defineEmits(["on-click"]);

const disabledBorderedClass = 'disabled:border-surface-200 disabled:bg-surface-50 disabled:cursor-not-allowed [&_svg]:text-surface-300 [&_svg]:disabled:stroke-surface-400'

const variant = {
  solid: {
    default: 'bg-surface-500 hover:bg-surface-400 disabled:bg-surface-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    primary: 'bg-primary-500 hover:bg-primary-400 disabled:bg-primary-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    success: 'bg-success-500 hover:bg-success-400 disabled:bg-success-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    info: 'bg-info-500 hover:bg-info-400 disabled:bg-info-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    warning: 'bg-warning-500 hover:bg-warning-400 disabled:bg-warning-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    error: 'bg-error-500 hover:bg-error-400 disabled:bg-error-400 disabled:cursor-not-allowed [&_svg]:stroke-white'
  },
  bordered: {
    default: `border bg-white dark:bg-surface-800 border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 [&_svg]:stroke-surface-600 dark:[&_svg]:stroke-surface-400 ${disabledBorderedClass}`,
    primary: `border bg-white dark:bg-surface-800 border-primary-300 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 [&_svg]:stroke-primary-600 dark:[&_svg]:stroke-primary-400 ${disabledBorderedClass}`,
    success: `border bg-white dark:bg-surface-800 border-success-300 dark:border-success-700 hover:bg-success-50 dark:hover:bg-success-900/20 [&_svg]:stroke-success-600 dark:[&_svg]:stroke-success-400 ${disabledBorderedClass}`,
    info: `border bg-white dark:bg-surface-800 border-info-300 dark:border-info-700 hover:bg-info-50 dark:hover:bg-info-900/20 [&_svg]:stroke-info-600 dark:[&_svg]:stroke-info-400 ${disabledBorderedClass}`,
    warning: `border bg-white dark:bg-surface-800 border-warning-300 dark:border-warning-700 hover:bg-warning-50 dark:hover:bg-warning-900/20 [&_svg]:stroke-warning-600 dark:[&_svg]:stroke-warning-400 ${disabledBorderedClass}`,
    error: `border bg-white dark:bg-surface-800 border-error-300 dark:border-error-700 hover:bg-error-50 dark:hover:bg-error-900/20 [&_svg]:stroke-error-600 dark:[&_svg]:stroke-error-400 ${disabledBorderedClass}`,
  }
};

const buttonClass = computed(() => {
  const base = 'h-11 flex items-center justify-center aspect-square transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-900';
  const rounded = `rounded-${props.rounded}`;

  const color = props.bordered
      ? `${variant.bordered[props.color]}`
      : `${variant.solid[props.color]}`

  return `${base} ${rounded} ${color}`
});
</script>

<template>
  <button :id="props.id" :disabled="props.disabled || props.loading" :type="props.type" :class="buttonClass" @click="emit('on-click')">
    <Loading v-if="props.loading" :color="props.bordered ? 'default' : props.color" size="20" />
    <slot v-else name="icon" />
  </button>
</template>

<style scoped></style>
