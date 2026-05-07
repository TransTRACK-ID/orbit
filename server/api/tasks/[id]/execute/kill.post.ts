import { requireAuth } from '~/server/utils/auth'
import { activeProcesses } from '~/server/utils/runtime'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const entry = activeProcesses.get(id)
  if (!entry) {
    return { killed: false, reason: 'no active process' }
  }

  // Kill the process and clean up
  if (entry.heartbeat) clearInterval(entry.heartbeat)

  try { entry.proc.kill('SIGTERM') } catch {}
  setTimeout(() => {
    try { entry.proc.kill('SIGKILL') } catch {}
  }, 3000)

  // Close all streams
  for (const s of entry.streams) {
    try { s.close() } catch {}
  }

  activeProcesses.delete(id)

  return { killed: true }
})
