import type { ActivityLogEntry } from '~/types'

export const useLog = () => {
  const logs = useState<ActivityLogEntry[]>('app:logs', () => [])
  const isOpen = useState<boolean>('app:logPanelOpen', () => false)

  function addLog(agent: string, msg: string, taskId?: string) {
    logs.value = [{ time: Date.now(), agent, msg, taskId }, ...logs.value]
    if (logs.value.length > 200) {
      logs.value = logs.value.slice(0, 200)
    }
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return {
    logs: readonly(logs),
    isOpen: readonly(isOpen),
    addLog,
    toggle,
    open,
    close,
  }
}
