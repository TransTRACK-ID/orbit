import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { activeProcesses } from '~/server/utils/runtime'
import { accessSync, constants } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const opencodePath = process.env.OPENCODE_PATH || '/Users/zeinersyad/.opencode/bin/opencode'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = getDb()

  // 1. Check if opencode binary is reachable
  let runtimeReachable = false
  try {
    accessSync(opencodePath, constants.X_OK)
    // Verify it actually runs
    await execAsync(`"${opencodePath}" --version`, { timeout: 5000 })
    runtimeReachable = true
  } catch {
    runtimeReachable = false
  }

  // 2. Fetch all agents for this user
  const agents = await db.query.agents.findMany({
    where: eq(schema.agents.userId, user.id),
    columns: { id: true },
  })

  // 3. Find tasks assigned to agents that have active runtime processes
  const busyAgentIds = new Set<string>()
  if (runtimeReachable) {
    for (const [taskId, entry] of activeProcesses.entries()) {
      if (entry.proc.exitCode === null) {
        const task = await db.query.tasks.findFirst({
          where: eq(schema.tasks.id, taskId),
          columns: { agentAssigneeId: true },
        })
        if (task?.agentAssigneeId) {
          busyAgentIds.add(task.agentAssigneeId)
        }
      }
    }
  }

  // 4. Build health map
  const health: Record<string, 'idle' | 'busy' | 'offline'> = {}
  for (const agent of agents) {
    if (!runtimeReachable) {
      health[agent.id] = 'offline'
    } else if (busyAgentIds.has(agent.id)) {
      health[agent.id] = 'busy'
    } else {
      health[agent.id] = 'idle'
    }
  }

  return { runtimeReachable, health }
})
