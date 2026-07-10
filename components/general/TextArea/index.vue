<script setup lang="ts">
const props = defineProps({
  modelValue: {
    type: String || Number || null,
    default: ''
  },
  id: {
    type: String,
    default: "",
  },
  type: {
    type: String,
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
  required: {
    type: Boolean,
    default: false,
  },
  maxLength: {
    type: Number || undefined,
    default: undefined
  },
  rows: {
    type: [Number, String],
    default: 3
  }
});

const emit = defineEmits(["on-input", "update:modelValue"]);
</script>

<template>
  <div>
    <label
      v-if="props.label"
      :for="id"
      class="block mb-1.5 text-xs font-medium text-surface-600"
    >
      {{ props.label }}
      <span v-if="props.required" class="text-accent">*</span>
    </label>

    <div class="relative">
      <div class="absolute pl-3 inset-y-0 left-0 flex items-center pointer-events-none">
        <slot name="prefix" />
      </div>

      <textarea
        :id="props.id"
        :rows="props.rows"
        :value="props.modelValue"
        :type="props.type"
        :placeholder="props.placeholder"
        :maxlength="props.maxLength"
        class="block w-full text-sm text-surface-900 placeholder:text-surface-400 bg-white rounded-lg border border-surface-200 px-3 py-2.5 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors resize-y"
        :class="$slots.prefix ? 'pl-10' : ''"
        @input="emit('update:modelValue', $event.target?.value)"
      />
    </div>
  </div>
</template>

<style scoped></style>
