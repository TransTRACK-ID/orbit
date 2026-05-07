const eventSources = new Map<string, EventSource>()
const activeRuntimes = ref<Record<string, boolean>>({})

export const useAgentRuntime = () => {
  const { addLog } = useLog()

  function startRuntime(taskId: string, feedback?: string) {
    if (eventSources.has(taskId)) return

    const url = feedback
      ? `/api/tasks/${taskId}/execute?feedback=${encodeURIComponent(feedback)}`
      : `/api/tasks/${taskId}/execute`

    const es = new EventSource(url)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.step) {
          addLog('Runtime', `> ${data.step}`, taskId)
        }
      } catch {}
    }
    es.onerror = () => {
      es.close()
      eventSources.delete(taskId)
      activeRuntimes.value = { ...activeRuntimes.value, [taskId]: false }
    }

    eventSources.set(taskId, es)
    activeRuntimes.value = { ...activeRuntimes.value, [taskId]: true }
  }

  function stopRuntime(taskId: string) {
    const es = eventSources.get(taskId)
    if (es) {
      es.close()
      eventSources.delete(taskId)
    }
    activeRuntimes.value = { ...activeRuntimes.value, [taskId]: false }
  }

  function isRunning(taskId: string): boolean {
    return !!activeRuntimes.value[taskId]
  }

  return {
    activeRuntimes: readonly(activeRuntimes),
    startRuntime,
    stopRuntime,
    isRunning,
  }
}
