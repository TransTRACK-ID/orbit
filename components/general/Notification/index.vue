<script setup lang="ts">
import { computed } from 'vue';
import Close from '~/components/icons/Close/index.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  isShow: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String as () => "primary" | "success" | "warning" | "info" | "error",
    default: "primary",
  },
  isClosable: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["update:modelValue", "on-click-close"]);

function onClickClose() {
  emit("update:modelValue", false);
  emit("on-click-close");
}

const color = computed(() => {
  return {
    bg: `bg-${props.color}-100 text-${props.color}-500 border-${props.color}-500`,
    hover: `hover:bg-${props.color}-200`,
    stroke: `stroke-${props.color}-500`
  }
});
</script>

<template>
  <div
    v-if="modelValue || isShow"
    class="p-4 space-x-4 w-full flex justify-between items-center rounded-lg border"
    :class="color.bg"
  >
    <div class="space-x-4 flex items-center justify-start" :class="color.stroke">
      <slot name="prefix" />
      <slot name="default" />
    </div>

    <div
      v-if="isClosable"
      class="p-1 rounded-full cursor-pointer transition-all"
      :class="color.hover"
      @click="onClickClose"
    >
      <Close size="20" :class="color.stroke" />
    </div>
  </div>
</template>

<style scoped></style>
