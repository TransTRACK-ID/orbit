<script setup lang="ts">
import type { PropType } from 'vue';

const props = defineProps({
  id: {
    type: String,
    default: 'tab'
  },
  modelValue: {
    type: Number,
    default: 0,
  },
  tabs: {
    type: Array as PropType<{ text: string, value: string, isVisible?: boolean }[]>,
    default: () => [],
  },
  color: {
    type: String as PropType<'primary' | 'success' | 'info' | 'warning' |'error'>,
    default: 'primary'
  }
});

const emit = defineEmits(["update:model-value"]);

const visibleTabs = computed(() => props.tabs.filter(t => t.isVisible !== false))

const tabClass = (i: number) => {
  const baseClass = "py-2 px-3 border-b-2 text-gray-500 transition";
  const color = i === Number(props.modelValue)
    ? bgColor.value
    : "border-transparent hover:bg-gray-100 hover:border-gray-300";
  return `${baseClass} ${color}`;
};

const variant = {
  primary: 'border-primary-500 bg-primary-50 text-primary-500',
  success: 'border-success-500 bg-success-50 text-success-500',
  info: 'border-info-500 bg-info-50 text-info-500', 
  warning: 'border-warning-500 bg-warning-50 text-warning-500',
  error: 'border-error-500 bg-error-50 text-error-500',
}

const bgColor = computed(() => {
  return variant[props.color]
})
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <ul class="w-fit flex flex-wrap font-semibold">
        <li v-for="(tab, i) in visibleTabs" :key="`${props.id}-${tab.value.toLowerCase()}-${i}`" class="me-3">
          <button
            type="button"
            :class="tabClass(i)"
            @click="emit('update:model-value', i)"
          >
            {{ tab.text }}
          </button>
        </li>
      </ul>

      <slot name="action-button" />
    </div>

    <slot :name="`tab-item.${props.tabs[props.modelValue]?.value}`" />
  </div>
</template>

<style scoped></style>
