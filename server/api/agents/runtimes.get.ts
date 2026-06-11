import { requireAuth } from '~/server/utils/auth'
import { getDefaultAgentRuntime, getEnabledRuntimes } from '~/server/utils/agent-runtime-config'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const runtimes = await getEnabledRuntimes()

  return {
    runtimes,
    defaultRuntime: getDefaultAgentRuntime(),
  }
})
