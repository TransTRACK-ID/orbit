<script setup lang="ts">
import type { InputTypeHTMLAttribute, PropType } from "vue";
import Close from "~/components/icons/Close/index.vue";

const props = defineProps({
  modelValue: {
    type: [Number, String, null],
    default: null,
  },
  value: {
    type: [String, null],
    default: null,
  },
  id: {
    type: String,
    default: "",
  },
  type: {
    type: String as PropType<InputTypeHTMLAttribute>,
    default: "text",
  },
  label: {
    type: String || null,
    default: null,
  },
  placeholder: {
    type: String,
    default: "",
  },
  min: {
    type: Number || undefined,
    default: undefined,
  },
  max: {
    type: Number || undefined,
    default: undefined,
  },
  clearable: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String as () => "primary" | "success" | "info" | "warning" | "error",
    default: "primary",
  },
  errorMessage: {
    type: String,
    default: "",
  },
  isError: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["on-input", "on-click-clear", "update:modelValue", "blur", "focus"]);

const isFocused = ref(false);

const variant = {
  primary: "border-primary-500",
  success: "border-success-500",
  info: "border-info-500",
  warning: "border-warning-500",
  error: "border-error-500",
};

const borderColor = computed(() => {
  return variant[props.color];
});

function onClickClear() {
  emit("on-click-clear");
  emit("update:modelValue", "");
}


const classContainer = computed(() => {
  const baseClass =
    "w-full rounded-lg overflow-hidden stroke-gray-500 border-2 flex h-10";
  const border =
    props.isError || props.errorMessage
      ? variant.error
      : isFocused.value
      ? borderColor.value
      : "border-gray-200";
  const background = props.disabled
    ? "bg-gray-100"
    : props.isError || props.errorMessage
    ? "bg-error-50"
    : "bg-white";
  const cursor = props.disabled ? "cursor-not-allowed" : "";
  return `${baseClass} ${border} ${background} ${cursor}`;
});

const classInput = computed(() => {
  const baseClass =
    "block px-2.5 w-full h-full border-none text-gray-900 bg-transparent focus:ring-0";
  const hideSpinButton =
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const cursor = props.disabled ? "cursor-not-allowed" : "";
  return `${baseClass} ${hideSpinButton} ${cursor}`;
});

function formatValue(value: any): string {
  if (!value && value !== 0) return '';

  if (props.type === 'number') {
    const number = Number(value);
    return String(
      (props.max !== undefined && number > props.max)
        ? props.max
        : (props.min !== undefined && number < props.min)
            ? props.min
            : value,
    );
  }

  if (props.type === "text" || props.type === "email" || props.type === "password") {
    if (props.max !== undefined) {
      return String(value).slice(0, props.max);
    }
    return String(value);
  }

  return String(value).replace(/\D/g, "");
}

function onInput(value: any) {
  const formatted = formatValue(value);
  emit("on-input", formatted);
  emit("update:modelValue", formatted);
}
</script>

<template>
  <div class="flex flex-col items-start">
    <label
      v-if="props.label"
      :for="id"
      class="mb-1.5 text-sm font-[600] text-gray-700"
    >
      {{ props.label }}
      <span v-if="props.required" class="text-primary-500">*</span>
    </label>

    <slot name="prefix-above" />

    <div :class="classContainer">
      <div
        v-if="$slots.prefix"
        class="pl-2.5 inset-y-0 left-0 flex items-center pointer-events-none"
      >
        <slot name="prefix" />
      </div>

      <input
        :id="props.id"
        :value="props.value ?? props.modelValue"
        :type="props.type"
        :placeholder="props.placeholder"
        :min="props.min"
        :max="props.max"
        step="any"
        :readonly="props.readonly"
        :disabled="props.disabled"
        :class="classInput"
        @focusin="isFocused = true; emit('focus', $event)"
        @focusout="isFocused = false; emit('blur', $event)"
        @input.prevent="onInput(($event.target as HTMLInputElement)?.value)"
      />

      <div
        v-if="$slots.suffix || props.clearable"
        class="pr-2.5 inset-y-0 right-0 flex items-center"
        :class="$slots.suffix && props.clearable ? 'space-x-2' : ''"
      >
        <Close
          v-if="
            props.clearable &&
            (props.modelValue || props.value) &&
            !props.disabled
          "
          :id="`${props.id}Clear`"
          size="20"
          class="cursor-pointer transition-opacity hover:stroke-gray-700"
          @click="onClickClear"
        />

        <div class="pointer-events-none">
          <slot name="suffix" />
        </div>
      </div>
    </div>
    <p v-if="props.errorMessage" class="mt-1 text-xs text-error-500">
      {{ props.errorMessage }}
    </p>
  </div>
</template>

<style scoped></style>
