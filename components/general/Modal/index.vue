<template>
  <slot
    name="trigger"
    :activator="() => { toggleModal(true); emit('trigger-click') }"
  />

  <div
    :id="props.id"
    aria-hidden="true"
    class="fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain bg-black/50 backdrop-blur-sm md:p-5 print:static print:overflow-visible print:bg-transparent print:p-0"
    @click.stop="emit('modal-click-outside')"
  >
    <div :class="`relative w-full ${classModal} h-fit bg-white rounded-lg shadow print:shadow-none m-auto`">
      <div class="relative h-fit p-4 print:p-0">
        <div
          v-if="$slots.icon || !isEmpty(props.title) || !isEmpty(props.subtitle)"
          class="w-full p-2 print:hidden"
        >
          <div class="flex items-start justify-between">
            <div class="flex flex-col items-start space-y-4">
              <div
                v-if="$slots.icon"
                class="flex aspect-square w-12 items-center justify-center rounded-full border-[6px]"
                :class="iconColor"
              >
                <slot name="icon" />
              </div>

              <div
                v-if="props.title || props.subtitle"
                class="space-y-2"
              >
                <h3
                  v-if="props.title"
                  class="text-lg font-semibold text-gray-900"
                >
                  {{ props.title }}
                </h3>
                <h5
                  v-if="props.subtitle"
                  class="text-sm text-gray-500"
                >
                  {{ props.subtitle }}
                </h5>
              </div>
            </div>

            <button
              v-if="props.isHasClose"
              type="button"
              class="inline-flex items-center rounded-full bg-transparent p-1 text-sm transition hover:bg-gray-200"
              @click.prevent="toggleModal(false)"
            >
              <icon-close
                size="20"
                class="stroke-gray-700"
              />
              <span class="sr-only">Close modal</span>
            </button>
          </div>
        </div>

        <div
          :key="`${id}-${keyModal}`"
          class="w-full p-2"
        >
          <slot name="body">
            <slot />
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useModal } from '~/composables/modal'
import type { ElementEvent } from '~/types/element'
import { isEmpty } from '~/utils/ui'

const emit = defineEmits(['mounted', 'modal-opened', 'modal-closed', 'trigger-click', 'modal-click-outside'])
const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
  },
  subtitle: {
    type: String,
  },
  isHasClose: {
    type: Boolean,
    default: false,
  },
  classModal: {
    type: String,
    default: 'max-w-lg',
  },
  color: {
    type: String as () => 'primary' | 'success' | 'info' | 'warning' | 'error' | 'default',
    default: 'primary'
  },
})

const isVisible = ref<boolean>(false)

let $modal: HTMLElement | null = null
let modalTimeout: NodeJS.Timeout | null = null

const keyModal = ref(0)

const iconColor = computed(() => {
  const variant = {
    default: 'bg-gray-100 border-gray-50 [&_svg]:stroke-gray-500',
    primary: 'bg-primary-100 border-primary-50 [&_svg]:stroke-primary-500',
    success: 'bg-success-100 border-success-50 [&_svg]:stroke-success-500',
    info: 'bg-info-100 border-info-50 [&_svg]:stroke-info-500',
    warning: 'bg-warning-100 border-warning-50 [&_svg]:stroke-warning-500',
    error: 'bg-error-100 border-error-50 [&_svg]:stroke-error-500',
  }

  return variant[props.color]
})

onMounted(() => {
  $modal = document.getElementById(props.id)
  emit('mounted', setModal)
})

onUnmounted(() => {
  if (modalTimeout) {
    clearTimeout(modalTimeout)
    modalTimeout = null
  }
})

const setModal: ElementEvent = {
  show: () => toggleModal(true),
  hide: () => toggleModal(false),
  toggle: () => toggleModal(!isVisible.value),
}

const toggleModal = (value: boolean) => {
  if (value) {
    $modal?.classList.add('animate-fade-in')
    $modal?.classList.add('flex')
    $modal?.classList.remove('hidden')
    $modal?.classList.remove('animate-fade-out')

    keyModal.value++
    emit('modal-opened')
  }
  else {
    if (modalTimeout) clearTimeout(modalTimeout)
    $modal?.classList.remove('animate-fade-in')
    $modal?.classList.add('animate-fade-out')

    setTimeout(() => {
      $modal?.classList.remove('flex')
      $modal?.classList.add('hidden')
      keyModal.value++
      emit('modal-closed')
      modalTimeout = null
    }, 300,
    )
  }

  isVisible.value = value
  useModal().value = !useModal().value
}
</script>

<style scoped></style>
