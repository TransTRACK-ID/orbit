import { requireSuperAdmin } from '~/server/utils/auth'
import { getDefaultAgentRuntime, getRuntimeSettings } from '~/server/utils/agent-runtime-config'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const runtimes = await getRuntimeSettings()

  return {
    runtimes,
    defaultRuntime: getDefaultAgentRuntime(),
  }
})
