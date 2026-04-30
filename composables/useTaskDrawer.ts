import type { Task } from '~/types'

export const useTaskDrawer = () => {
  const isOpen = useState<boolean>('taskDrawer:isOpen', () => false)
  const task = useState<Task | null>('taskDrawer:task', () => null)
  const isCreating = useState<boolean>('taskDrawer:isCreating', () => false)

  function open(t: Task) {
    task.value = t
    isCreating.value = false
    isOpen.value = true
    document.body.style.overflow = 'hidden'
  }

  function openNew() {
    task.value = null
    isCreating.value = true
    isOpen.value = true
    document.body.style.overflow = 'hidden'
  }

  function close() {
    isOpen.value = false
    task.value = null
    isCreating.value = false
    document.body.style.overflow = ''
  }

  // Reset body overflow on unmount (e.g. navigation away with drawer open)
  if (import.meta.client) {
    onUnmounted(() => {
      document.body.style.overflow = ''
    })
  }

  return {
    isOpen: readonly(isOpen),
    task: readonly(task),
    isCreating: readonly(isCreating),
    open,
    openNew,
    close,
  }
}
