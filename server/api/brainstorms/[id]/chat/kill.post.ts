import { requireAuth } from '~/server/utils/auth'
import { activeBrainstormProcesses } from '~/server/utils/brainstorm-runtime'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const entry = activeBrainstormProcesses.get(id)
  if (!entry) {
    return { killed: false, reason: 'no active process' }
  }

  if (entry.heartbeat) clearInterval(entry.heartbeat)

  if (entry.proc) {
    try { entry.proc.kill('SIGTERM') } catch {}
    setTimeout(() => {
      try { entry.proc?.kill('SIGKILL') } catch {}
    }, 3000)
  }

  for (const s of entry.streams) {
    try { s.close() } catch {}
  }

  activeBrainstormProcesses.delete(id)

  return { killed: true }
})
