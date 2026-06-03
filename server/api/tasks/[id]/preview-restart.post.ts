import { existsSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { startPreview, stopPreview } from '~/server/utils/preview-orchestrator'
import { resolveCloneDir, resolveWorktreeDir } from '~/server/utils/worktree-resolver'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id } = getRouterParams(event)

  const db = getDb()

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: {
      repository: true,
      project: { with: { workspace: true } },
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, task.project.workspaceId), eq(wm.userId, user.id)),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (!task.repository?.url) {
    throw createError({ statusCode: 400, statusMessage: 'Task has no repository' })
  }

  const cloneDir = resolveCloneDir(task.repository.url, task.repository.name)
  const worktreeDir = resolveWorktreeDir(cloneDir, task.id)

  if (!existsSync(worktreeDir)) {
    const agentContext = await db.query.agentTaskContext.findFirst({
      where: eq(schema.agentTaskContext.taskId, task.id),
    })

    if (agentContext && agentContext.status === 'running') {
      throw createError({ statusCode: 400, statusMessage: 'Agent is still initializing. Please wait for the worktree to be created.' })
    }

    throw createError({ statusCode: 400, statusMessage: 'Task worktree not found. Run the agent first.' })
  }

  // Fetch repository environment variables from workspace settings
  const repoEnvVars = await db.query.repositoryEnvVars.findMany({
    where: eq(schema.repositoryEnvVars.repositoryId, task.repository.id),
  })

  const envVars: Record<string, string> = {}
  for (const ev of repoEnvVars) {
    envVars[ev.key] = ev.value
  }

  const existing = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.taskId, task.id),
  })

  if (existing && existing.status === 'running') {
    await stopPreview(existing.id)
    await new Promise(r => setTimeout(r, 1000))
  }

  try {
    const result = await startPreview(task.id, task.repository.id || undefined, worktreeDir, envVars)
    return {
      available: true,
      url: result.url,
      instanceId: result.instanceId,
      message: 'Preview restarted successfully',
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: `Failed to restart preview: ${err.message}` })
  }
})
