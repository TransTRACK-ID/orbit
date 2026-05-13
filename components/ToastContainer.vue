<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-[400px] bg-white border rounded-xl shadow-lg px-4 py-3 cursor-pointer"
          :class="borderClass(toast.type)"
          @click="remove(toast.id)"
        >
          <div class="flex-shrink-0 mt-0.5">
            <Icon
              :name="iconName(toast.type)"
              class="w-4 h-4"
              :class="iconClass(toast.type)"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p v-if="toast.title" class="text-sm font-semibold text-surface-900">{{ toast.title }}</p>
            <p class="text-sm text-surface-700" :class="toast.title ? 'mt-0.5' : ''">{{ toast.message }}</p>
          </div>
          <button
            class="flex-shrink-0 text-surface-400 hover:text-surface-600 transition-colors"
            @click.stop="remove(toast.id)"
          >
            <Icon name="lucide:x" class="w-3.5 h-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { toasts, remove } = useToast()

function iconName(type: string): string {
  switch (type) {
    case 'success': return 'lucide:check-circle'
    case 'error': return 'lucide:x-circle'
    case 'warning': return 'lucide:alert-triangle'
    default: return 'lucide:info'
  }
}

function iconClass(type: string): string {
  switch (type) {
    case 'success': return 'text-green-500'
    case 'error': return 'text-red-500'
    case 'warning': return 'text-amber-500'
    default: return 'text-primary-500'
  }
}

function borderClass(type: string): string {
  switch (type) {
    case 'success': return 'border-green-200'
    case 'error': return 'border-red-200'
    case 'warning': return 'border-amber-200'
    default: return 'border-primary-200'
  }
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.96);
}

.toast-leave-active {
  position: absolute;
}
</style>
