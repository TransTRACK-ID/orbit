<script setup lang="ts">
import Loading from '~/components/icons/Loading/index.vue';
import Modal from '../Modal/index.vue';

const props = defineProps({
  id: {
    type: String,
    default: 'modal-loading'
  },
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['mounted'])
</script>

<template>
  <Modal :id="props.id" title="" @mounted="emit('mounted', $event)">
    <template #body>
      <div class="flex flex-col items-center space-y-5">
        <Loading size="80" color="primary" />

        <div class="space-y-2">
          <p class="text-lg font-semibold text-gray-900">{{ props.title }}</p>
          <p class="text-sm text-gray-500 text-center">
            {{ props.subtitle }}
          </p>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>

</style>