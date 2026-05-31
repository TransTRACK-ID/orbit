import { activeProcesses } from '~/server/utils/runtime'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireAuth(event)

  const entry = activeProcesses.get(id)
  const active = !!entry && !entry.exited

  return { active }
})
