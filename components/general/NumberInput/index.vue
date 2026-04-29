<script setup lang="ts">
import Minus from '~/components/icons/Minus/index.vue';
import Plus from '~/components/icons/Plus/index.vue';
import IconButton from '../IconButton/index.vue';

const props = defineProps({
   modelValue: {
    type: Number,
    default: 0,
  },
  id: {
    type: String,
    default: 'numberInput',
  },
  label: {
    type: String || null,
    default: null,
  },
  placeholder: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 999,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

watch(() => props.modelValue, (value) => {
  if (value <= props.min)
    value = props.min
  else if (value >= props.max)
    value = props.max

  emit('update:modelValue', value)
})
</script>

<template>
  <div class=" flex flex-col items-start">
    <label
      v-if="props.label"
      :for="props.id"
      class="mb-1.5 text-sm font-medium text-gray-700"
    >
      {{ props.label }}
      <span
        v-if="props.required"
        class="text-red-500"
      >*</span>
    </label>

    <div class="relative flex h-11">
      <IconButton
        :id="`${props.id}Minus`"
        :disabled="modelValue <= props.min || props.disabled"
        class="absolute rounded-r-none"
        @on-click="emit('update:modelValue', props.modelValue - 1)"
      >
        <template #icon>
          <Minus size="20" />
        </template>
      </IconButton>

      <input
        :id="props.id"
        :disabled="props.disabled"
        :value="props.modelValue"
        type="number"
        class="border w-32 rounded-lg border-gray-300 px-12 text-center [appearance:textfield] focus:border-gray-300 focus:ring-primary-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @input="emit('update:modelValue', Number($event.target?.value))"
      >

      <IconButton
        :id="`${props.id}Plus`"
        :disabled="modelValue >= props.max || props.disabled"
        class="absolute right-0 rounded-l-none"
        @on-click="emit('update:modelValue', props.modelValue + 1)"
      >
        <template #icon>
          <Plus size="20" />
        </template>
      </IconButton>
    </div>
  </div>
</template>

<style scoped></style>
