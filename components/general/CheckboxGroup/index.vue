<script setup lang="ts">
import type { PropType } from 'vue'

const model = defineModel({
  type: Array as PropType<boolean[]>,
  default: () => []
})

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: null,
  },
  items: {
    type: Array as () => { text: string, value: string }[],
    default: () => [],
  },
  color: {
    type: String as PropType<'default' | 'primary' | 'success' | 'info' | 'warning' | 'error'>,
    default: 'default'
  }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="space-y-3">
    <p v-if="props.label" class="text-sm font-semibold text-gray-700">
      {{ props.label }}
    </p>

    <div class="space-y-2">
      <div v-for="(item, i) in items" :key="item.value" class="space-x-2">
        <general-checkbox :id="`${props.id}${i}`" :name="props.id" :value="item.value" :label="item.text"
          v-model="model[i]" :color="props.color" />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
