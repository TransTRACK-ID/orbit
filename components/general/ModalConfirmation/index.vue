<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="$emit('cancel')">
      <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-sm p-6 animate-scale-in">
        <div class="flex flex-col items-center text-center gap-2 mb-6">
          <div
            v-if="$slots.icon"
            class="flex aspect-square w-12 items-center justify-center rounded-full border-[6px]"
            :class="iconClass"
          >
            <slot name="icon" />
          </div>
          <h3 class="text-lg font-semibold text-surface-900">{{ title }}</h3>
          <p v-if="subtitle || message" class="text-sm text-surface-500">{{ subtitle || message }}</p>
          <slot />
        </div>
        <div class="flex items-center gap-3">
          <button
            class="flex-1 py-2.5 px-3.5 text-sm font-semibold rounded-lg border border-surface-200 text-surface-700 hover:bg-surface-50 transition-colors"
            @click="$emit('cancel')"
          >
            {{ cancelLabel || 'Cancel' }}
          </button>
          <button
            :class="confirmClass"
            :disabled="isLoading || confirmDisabled"
            class="flex-1 py-2.5 px-3.5 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
            @click="$emit('confirm')"
          >
            {{ isLoading ? 'Loading...' : (resolvedConfirmLabel || 'Confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  message: { type: String, default: '' },
  cancelLabel: { type: String, default: 'Cancel' },
  confirmLabel: { type: String, default: 'Confirm' },
  confirmText: { type: String, default: '' },
  variant: { type: String as () => 'danger' | 'warning' | 'primary' | 'default', default: 'primary' },
  isLoading: { type: Boolean, default: false },
  confirmDisabled: { type: Boolean, default: false },
  icon: { type: String, default: '' },
})

const resolvedConfirmLabel = computed(() => props.confirmText || props.confirmLabel)

defineEmits(['confirm', 'cancel'])

const iconClass = computed(() => {
  const variants: Record<string, string> = {
    danger: 'bg-error-100 border-error-50 [&_svg]:stroke-error-500',
    warning: 'bg-warning-100 border-warning-50 [&_svg]:stroke-warning-500',
    primary: 'bg-primary-100 border-primary-50 [&_svg]:stroke-primary-500',
    default: 'bg-surface-100 border-surface-50 [&_svg]:stroke-surface-500',
  }
  return variants[props.variant] || variants.default
})

const confirmClass = computed(() => {
  const variants: Record<string, string> = {
    danger: 'bg-error-500 hover:bg-error-600',
    warning: 'bg-warning-500 hover:bg-warning-600',
    primary: 'bg-primary-500 hover:bg-primary-600',
    default: 'bg-surface-700 hover:bg-surface-800',
  }
  return variants[props.variant] || variants.primary
})
</script>
