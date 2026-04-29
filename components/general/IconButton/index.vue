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

const disabledBorderedClass = 'disabled:border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed [&_svg]:text-gray-300 [&_svg]:disabled:stroke-gray-600'

const variant = {
  solid: {
    default: 'bg-gray-500 hover:bg-gray-400 disabled:bg-gray-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    primary: 'bg-primary-500 hover:bg-primary-400 disabled:bg-primary-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    success: 'bg-success-500 hover:bg-success-400 disabled:bg-success-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    info: 'bg-info-500 hover:bg-info-400 disabled:bg-info-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    warning: 'bg-warning-500 hover:bg-warning-400 disabled:bg-warning-400 disabled:cursor-not-allowed [&_svg]:stroke-white',
    error: 'bg-error-500 hover:bg-error-400 disabled:bg-error-400 disabled:cursor-not-allowed [&_svg]:stroke-white'
  },
  bordered: {
    default: `border bg-white border-gray-300 hover:bg-gray-100 [&_svg]:stroke-gray-600 ${disabledBorderedClass}`,
    primary: `border bg-white border-primary-300 hover:bg-primary-100 [&_svg]:stroke-primary-600 ${disabledBorderedClass}`,
    success: `border bg-white border-success-300 hover:bg-success-100 [&_svg]:stroke-success-600 ${disabledBorderedClass}`,
    info: `border bg-white border-info-300 hover:bg-info-100 [&_svg]:stroke-info-600 ${disabledBorderedClass}`,
    warning: `border bg-white border-warning-300 hover:bg-warning-100 [&_svg]:stroke-warning-600 ${disabledBorderedClass}`,
    error: `border bg-white border-error-300 hover:bg-error-100 [&_svg]:stroke-error-600 ${disabledBorderedClass}`,
  }
};

const buttonClass = computed(() => {
  const base = 'h-11 flex items-center justify-center aspect-square transition';
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
