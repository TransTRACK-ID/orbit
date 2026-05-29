import { activeBrainstormProcesses } from '~/server/utils/brainstorm-runtime'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const query = getQuery(event)
  const fromIndex = parseInt(query.fromIndex as string) || 0

  const entry = activeBrainstormProcesses.get(id)

  if (!entry) {
    return {
      status: 'not_found',
      output: [],
      nextIndex: 0,
      completed: false,
    }
  }

  const output = entry.outputBuffer.slice(fromIndex)
  const isCompleted = entry.proc === null

  return {
    status: isCompleted ? 'completed' : 'running',
    output,
    nextIndex: entry.outputBuffer.length,
    completed: isCompleted,
    exitMessage: entry.exitMessage,
  }
})
