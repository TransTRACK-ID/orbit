<script setup lang="ts">
const props = defineProps({
  id: {
    type: String,
    defualt: 'item-group'
  },
  modelValue: {
    type: Object as () => any,
    default: null,
  },
  items: {
    type: Array as () => any[],
    default: [],
  },
});

const emit = defineEmits(["update:model-value"]);

function onClickItem(item: any) {
  emit(
    'update:model-value',
    JSON.stringify(item) === JSON.stringify(props.modelValue)
      ? null
      : item,
  )
}
</script>

<template>
  <div>
    <div v-if="props.items.length > 0" class="flex flex-col space-y-4">
      <div v-for="(item, i) in props.items" :key="`${props.id}-${i}`" @click.stop="onClickItem(item)">
        <slot name="item" :item="item" />
      </div>
    </div>

    <p v-else class="text-center text-gray-500 select-none">No Items</p>
  </div>
</template>

<style scoped></style>
