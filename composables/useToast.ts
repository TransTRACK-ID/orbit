export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title?: string
  message: string
  duration?: number
}

const toasts = ref<Toast[]>([])

export function useToast() {
  function add(toast: Omit<Toast, 'id'>) {
    const id = Math.random().toString(36).substring(2, 9)
    const duration = toast.duration ?? 4000
    toasts.value.push({ id, ...toast, duration })

    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function success(message: string, title?: string) {
    add({ type: 'success', message, title })
  }

  function error(message: string, title?: string) {
    add({ type: 'error', message, title })
  }

  function info(message: string, title?: string) {
    add({ type: 'info', message, title })
  }

  function warning(message: string, title?: string) {
    add({ type: 'warning', message, title })
  }

  return {
    toasts: readonly(toasts),
    add,
    remove,
    success,
    error,
    info,
    warning,
  }
}
