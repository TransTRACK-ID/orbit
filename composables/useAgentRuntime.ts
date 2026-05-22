const eventSources = new Map<string, EventSource>()
const activeRuntimes = ref<Record<string, boolean>>({})

/** Tracks the terminal state of a task's last agent run */
export type AgentRunState = 'running' | 'done' | 'crashed' | 'error' | 'idle'
const taskRunStates = ref<Record<string, AgentRunState>>({})

export const useAgentRuntime = () => {
  const { addLog } = useLog()

  async function killServerProcess(taskId: string) {
    try {
      await $fetch(`/api/tasks/${taskId}/execute/kill`, { method: 'POST' })
    } catch {
      // Server process might already be dead, that's fine
    }
  }

  async function startRuntime(taskId: string, feedback?: string) {
    // If a runtime is already active, kill server process and stop it first
    if (eventSources.has(taskId) || activeRuntimes.value[taskId]) {
      await killServerProcess(taskId)
      stopRuntime(taskId)
    }

    // POST large feedback separately to avoid oversized URL params (431 error)
    if (feedback) {
      try {
        await $fetch(`/api/tasks/${taskId}/execute`, {
          method: 'POST',
          body: { feedback },
        })
      } catch {
        // Silently fall through — execute will still run without feedback
      }
    }

    const url = `/api/tasks/${taskId}/execute`

    const es = new EventSource(url)
    let receivedDone = false

    // Mark as running immediately
    taskRunStates.value = { ...taskRunStates.value, [taskId]: 'running' }

    es.onopen = () => {
      addLog('Runtime', '[CONN] Live stream connected', taskId)
    }

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.step) {
          addLog('Runtime', `> ${data.step}`, taskId)

          // Detect crash / error from structured SSE flags
          if (data.isCrash) {
            taskRunStates.value = { ...taskRunStates.value, [taskId]: 'crashed' }
            receivedDone = true
          } else if (data.isError) {
            taskRunStates.value = { ...taskRunStates.value, [taskId]: 'error' }
            receivedDone = true
          } else if (/^Done$/.test(data.step.trim())) {
            taskRunStates.value = { ...taskRunStates.value, [taskId]: 'done' }
            receivedDone = true
          }
        }
        if (data.agentReply) {
          addLog('Runtime', `[AGENT_REPLY] ${data.agentReply}`, taskId)
        }
      } catch {}
    }

    es.onerror = () => {
      // The browser auto-reconnects by default. We only clean up when the
      // server has told us it's done OR when the connection is truly closed
      // (readyState === CLOSED after the browser gives up reconnecting).
      if (receivedDone || es.readyState === EventSource.CLOSED) {
        eventSources.delete(taskId)
        activeRuntimes.value = { ...activeRuntimes.value, [taskId]: false }
        es.close()
      }
      // Otherwise: transient error, let browser retry.
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

  function getRunState(taskId: string): AgentRunState {
    return taskRunStates.value[taskId] ?? 'idle'
  }

  return {
    activeRuntimes: readonly(activeRuntimes),
    taskRunStates: readonly(taskRunStates),
    startRuntime,
    stopRuntime,
    isRunning,
    getRunState,
  }
}
