import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, or, gte } from 'drizzle-orm'
import { activeProcesses } from '~/server/utils/runtime'
import { getQueueStatus } from '~/server/utils/browser-queue'
import { accessSync, constants } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { isCursorInstalled, isCursorAuthenticated } from '~/server/utils/cursor-agent'
import { resolveEffectiveRuntime } from '~/server/utils/agent-runtime-config'
import { getOpencodePath } from '~/server/utils/paths'

const execAsync = promisify(exec)

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = getDb()

  // 1. Check if opencode binary is reachable
  const opencodePath = getOpencodePath()
  let runtimeReachable = false
  try {
    accessSync(opencodePath, constants.X_OK)
    await execAsync(`"${opencodePath}" --version`, { timeout: 5000 })
    runtimeReachable = true
  } catch {
    runtimeReachable = false
  }

  // 2. Check if cursor binary is reachable and authenticated
  let cursorRuntimeReachable = false
  let cursorAuthMethod: 'api_key' | 'login' | 'none' = 'none'
  try {
    if (await isCursorInstalled()) {
      const auth = await isCursorAuthenticated()
      if (auth.ok) {
        cursorRuntimeReachable = true
        cursorAuthMethod = auth.method
      }
    }
  } catch {
    cursorRuntimeReachable = false
  }

  // 3. Fetch all agents for this user (with runtime for per-runtime health)
  const agents = await db.query.agents.findMany({
    where: eq(schema.agents.userId, user.id),
    columns: { id: true, runtime: true },
  })

  // 4. Find tasks assigned to agents that have active runtime processes
  const busyAgentIds = new Set<string>()
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

  // 5. Check browser QA queue for busy agents
  const browserQueue = getQueueStatus()
  if (browserQueue.isRunning && browserQueue.nextJob) {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, browserQueue.nextJob),
      columns: { agentAssigneeId: true },
    })
    if (task?.agentAssigneeId) {
      busyAgentIds.add(task.agentAssigneeId)
    }
  }

  // 6. Build health map based on each agent's effective runtime
  const health: Record<string, 'idle' | 'busy' | 'offline'> = {}
  for (const agent of agents) {
    const effectiveRuntime = await resolveEffectiveRuntime(agent.runtime)
    const runtimeOk = effectiveRuntime === 'cursor'
      ? cursorRuntimeReachable
      : effectiveRuntime === 'browser-qa'
        ? true
        : runtimeReachable
    if (!runtimeOk) {
      health[agent.id] = 'offline'
    } else if (busyAgentIds.has(agent.id)) {
      health[agent.id] = 'busy'
    } else {
      health[agent.id] = 'idle'
    }
  }

  // 7. Fetch current tasks per agent from agentTaskContext (running or last 24h)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const ctxRows = await db.query.agentTaskContext.findMany({
    where: or(
      eq(schema.agentTaskContext.status, 'running'),
      gte(schema.agentTaskContext.updatedAt, since24h),
    ),
    with: {
      task: { columns: { title: true } },
    },
    orderBy: (ctx, { desc }) => [desc(ctx.updatedAt)],
  })

  const currentTasks: Record<string, Array<{
    taskId: string
    taskTitle: string
    status: string
    branchName: string | null
    filesChanged: string[]
    summary: string | null
    startedAt: string
    completedAt: string | null
  }>> = {}

  for (const row of ctxRows) {
    if (!currentTasks[row.agentId]) currentTasks[row.agentId] = []
    const taskData = row.task as { title: string } | null
    currentTasks[row.agentId]!.push({
      taskId: row.taskId,
      taskTitle: taskData?.title ?? '(unknown)',
      status: row.status,
      branchName: row.branchName,
      filesChanged: (row.filesChanged as string[]) ?? [],
      summary: row.summary,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    })
  }

  return {
    runtimeReachable,
    cursorRuntimeReachable,
    cursorAuthMethod,
    health,
    browserQueue,
    currentTasks,
  }
})
