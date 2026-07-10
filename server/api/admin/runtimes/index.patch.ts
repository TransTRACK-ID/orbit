import { z } from 'zod'
import { requireSuperAdmin } from '~/server/utils/auth'
import { getDefaultAgentRuntime, updateRuntimeSettings, type AgentRuntimeId } from '~/server/utils/agent-runtime-config'

const updateRuntimeSettingsSchema = z.object({
  runtimes: z.array(z.object({
    id: z.enum(['opencode', 'cursor']),
    enabled: z.boolean(),
  })).min(1),
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readValidatedBody(event, updateRuntimeSettingsSchema.parse)

  const runtimes = await updateRuntimeSettings(body.runtimes as { id: AgentRuntimeId; enabled: boolean }[])

  return {
    runtimes,
    defaultRuntime: getDefaultAgentRuntime(),
  }
})
