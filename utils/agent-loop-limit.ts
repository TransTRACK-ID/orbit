/** Max auto-restarts after command-loop detection before the task is moved to Review. */
export const MAX_AGENT_LOOP_RESTARTS = 3

const loopRestartCounts = new Map<string, number>()

export function incrementAgentLoopRestart(taskId: string): number {
  const count = (loopRestartCounts.get(taskId) || 0) + 1
  loopRestartCounts.set(taskId, count)
  return count
}

export function resetAgentLoopRestart(taskId: string) {
  loopRestartCounts.delete(taskId)
}

export function getAgentLoopRestartCount(taskId: string): number {
  return loopRestartCounts.get(taskId) || 0
}
